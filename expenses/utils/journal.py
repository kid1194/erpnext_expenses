# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint, flt, cstr, today

from .common import error
from .entry import get_entry_data


_JOURNAL = "Journal Entry"


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
    if frappe.db.exists(_JOURNAL, {"bill_no": expenses_entry}):
        return 0
    
    entry = get_entry_data(expenses_entry)
    if cint(entry.docstatus) != 1:
        return 0
    
    if not entry.payment_account:
        error(_("The selected Mode of Payment has no linked account"))
        return 0
    
    if (
        entry.payment_target != "Cash" and
        (not entry.payment_reference or not entry.clearance_date)
    ):
        error(_("Payment Reference and Date are Required for all non-cash payments"))
        return 0
    
    date = today()
    multi_currency = 0
    accounts = []
    can_claim = frappe.db.exists("DocType", "Expense Claim")
    claims = []
    for v in entry.expenses:
        if not multi_currency and v.account_currency != entry.payment_currency:
            multi_currency = 1
        
        accounts.append({
            "account": v.account,
            "party_type": cstr(v.party_type),
            "party": cstr(v.party),
            "cost_center": cstr(v.cost_center),
            "project": cstr(v.project),
            "account_currency": v.account_currency,
            "exchange_rate": flt(v.exchange_rate),
            "debit_in_account_currency": flt(v.cost_in_account_currency),
            "debt": flt(v.cost),
            "is_advance": cint(v.is_advance),
            "user_remark": cstr(v.description),
        })
        
        if can_claim and cint(v.is_paid) and v.paid_by:
            claims.append({
                "naming_series": "",
                "posting_date": date,
                "employee": v.paid_by,
                "company": entry.company,
                "payable_account": v.payable_account,
                "expense_approver": "",
                "approval_status": "Approved",
                "expenses": [
                    {
                        "expense_date": date,
                        "expense_type": "",
                        "default_account": v.account,
                        "amount": flt(v.cost),
                        "cost_center": cstr(v.cost_center),
                    }
                ],
                "taxes": [],
                "cost_center": cstr(v.cost_center),
                "project": cstr(v.project),
                "remark": cstr(v.description),
                #"is_paid": 1,
                #"mode_of_payment": entry.mode_of_payment,
            })
        
    if entry.payment_target == "Cash":
        entry.payment_reference = ""
        entry.clearance_date = ""
    
    accounts.append({
        "account": entry.payment_account,
        "account_currency": entry.payment_currency,
        "exchange_rate": flt(entry.exchange_rate),
        "credit_in_account_currency": flt(entry.total_in_payment_currency),
        "credit": flt(entry.total),
    })
    
    try:
        (frappe.new_doc(_JOURNAL)
            .update({
                "title": entry.name,
                "voucher_type": _JOURNAL,
                "posting_date": date,
                "company": entry.company,
                "bill_no": entry.name,
                "accounts": accounts,
                "user_remark": cstr(entry.remarks),
                "mode_of_payment": entry.mode_of_payment,
                "cheque_no": cstr(entry.payment_reference),
                "cheque_date": cstr(entry.clearance_date),
                "reference_date": cstr(entry.clearance_date),
                "multi_currency": multi_currency,
            })
            .insert(ignore_permissions=True, ignore_mandatory=True)
            .submit())
    
    except Exception:
        error(_(
            "Unable to create a Journal Entry for the expense entry {0}"
        ).format(entry.name))


## Expenses Entry
def cancel_journal_entry(expenses_entry):
    filters = {"bill_no": expenses_entry}
    if frappe.db.exists(_JOURNAL, filters):
        frappe.get_doc(_JOURNAL, filters).cancel()