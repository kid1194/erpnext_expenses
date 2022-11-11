# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint, flt, today

from .common import error
from .entry import get_entry_data


## Expenses Entry
def enqueue_journal_entry(expenses_entry):
    frappe.enqueue(
        "expenses.utils.make_journal_entry",
        job_name=f"expenses-make-journal-entry-{expenses_entry}",
        is_async=True,
        enqueue_after_commit=True,
        expenses_entry=expenses_entry
    )


## Self
def make_journal_entry(expenses_entry):
    entry = get_entry_data(expenses_entry)
    
    if cint(entry.docstatus) != 1:
        return 0
    
    doctype = "Journal Entry"
    if frappe.db.exists(doctype, {"bill_no": entry.name}):
        return 0
    
    multi_currency = 0
    accounts = []
    for v in entry.expenses:
        if v.account_currency != entry.payment_currency:
            multi_currency = 1
        
        accounts.append({
            "account": v.account,
            "party_type": v.party_type,
            "party": v.party,
            "cost_center": v.cost_center,
            "project": v.project,
            "account_currency": v.account_currency,
            "exchange_rate": flt(v.exchange_rate),
            "debit_in_account_currency": flt(v.cost_in_account_currency),
            "debt": flt(v.cost),
            "is_advance": cint(v.is_advance),
            "user_remark": str(v.description),
        })
    
    if (
        entry.payment_target != "Cash" and
        (
            not entry.payment_reference or
            not entry.clearance_date
        )
    ):
        error(_("Payment Reference and Date are Required for all non-cash payments"))
    
    else:
        entry.payment_reference = ""
        entry.clearance_date = ""
    
    if not entry.payment_account:
        error(_("The selected Mode of Payment has no linked account"))
    
    accounts.append({
        "account": entry.payment_account,
        "account_currency": entry.payment_currency,
        "exchange_rate": flt(entry.exchange_rate),
        "credit_in_account_currency": flt(entry.total_in_payment_currency),
        "credit": flt(entry.total),
    })
    
    try:
        (frappe.new_doc(doctype)
            .update({
                "title": entry.name,
                "voucher_type": doctype,
                "posting_date": today(),
                "company": entry.company,
                "accounts": accounts,
                "user_remark": entry.remarks,
                "mode_of_payment": entry.mode_of_payment,
                "cheque_date": entry.clearance_date,
                "reference_date": entry.clearance_date,
                "cheque_no": entry.payment_reference,
                #"pay_to_recd_from": entry.payment_to,
                "bill_no": entry.name,
                "multi_currency": multi_currency,
            })
            .insert(ignore_permissions=True, ignore_mandatory=True)
            .submit())
    
    except Exception:
        error(
            (_("Unable to create a Journal Entry for the expense entry {0}")
                .format(entry.name))
        )