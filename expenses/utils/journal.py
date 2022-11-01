# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.utils import cint, flt, today

from .common import get_cached_doc, error
from .entry import _Entry


## Expenses Entry
def enqueue_journal_entry(expenses_entry):
    frappe.enqueue(
        "expenses.utils.make_journal_entry",
        job_name=f"expenses-make-journal-entry-{expenses_entry}",
        is_async=True,
        enqueue_after_commit=True,
        expenses_entry=expenses_entry
    )


def make_journal_entry(expenses_entry):
    entry = get_cached_doc(_Entry, expenses_entry)
    
    if cint(entry.docstatus) != 1:
        return 0
    
    doctype = "Journal Entry"
    if frappe.db.exists(doctype, {"bill_no": entry.name}):
        return 0
    
    multi_currency = 0
    accounts = []
    for v in entry.expenses:
        if v.expense_currency != entry.total_currency:
            multi_currency = 1
        
        expense_data = get_item_expense_data(v.item, entry.company)
        accounts.append({
            "account": expense_data.account,
            "party_type": v.party_type,
            "party": v.party,
            "cost_center": v.cost_center,
            "project": v.project,
            "account_currency": expense_data.currency,
            "exchange_rate": v.exchange_rate,
            "debit_in_account_currency": flt(v.expense_total),
            "is_advance": v.is_advance,
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
        entry.clearance_date = ""
        entry.payment_reference = ""
    
    if not entry.payment_account:
        error(_("The selected Mode of Payment has no linked account"))
    
    accounts.append({
        "account": entry.payment_account,
        "account_currency": entry.total_currency,
        "exchange_rate": entry.exchange_rate,
        "credit_in_account_currency": flt(entry.total),
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
            .submit(ignore_permissions=True))
    
    except Exception:
        error(
            (_("Unable to create a Journal Entry for the expense entry {0}")
                .format(entry.name))
        )