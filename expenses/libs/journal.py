# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _


# [E Entry]
def enqueue_journal_entry(entry: str):
    from .background import is_job_running
    
    job_name = f"exp-make-journal-entry-{entry}"
    if not is_job_running(job_name):
        from .background import enqueue_job
        
        enqueue_job(
            "expenses.libs.journal.make_journal_entry",
            job_name,
            entry=entry
        )


# [Internal]
def make_journal_entry(entry: str):
    from .entry import get_entry_data
    
    doc = get_entry_data(entry)
    if not doc:
        return 0
    
    if not doc.is_submitted:
        return 0
    
    dt = "Journal Entry"
    if frappe.db.exists(dt, {"bill_no": entry}):
        _log_error(_("Expenses entry \"{0}\" has already been added to journal.").format(entry))
        return 0
    
    if not doc.payment_account:
        _log_error(_("The Mode of Payment of expenses entry \"{0}\" has no linked account.").format(entry))
        return 0
    
    if (
        doc.payment_target == "Bank" and
        (not doc.payment_reference or not doc.clearance_date)
    ):
        _log_error(_("The payment reference and/or payment / clearance date for expenses entry \"{0}\" hasn't been set.").format(entry))
        return 0
    
    from frappe.utils import (
        cint,
        flt,
        cstr
    )
    
    multi_currency = 0
    accounts = []
    for v in doc.expenses:
        if v.account_currency != doc.payment_currency:
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
            "user_remark": cstr(v.description)
        })
        
    if doc.payment_target == "Cash":
        doc.payment_reference = ""
        doc.clearance_date = ""
    
    accounts.append({
        "account": doc.payment_account,
        "account_currency": doc.payment_currency,
        "exchange_rate": flt(doc.exchange_rate),
        "credit_in_account_currency": flt(doc.total_in_payment_currency),
        "credit": flt(doc.total)
    })
    
    from frappe.utils import today
    
    try:
        (frappe.new_doc(dt)
            .update({
                "title": doc.name,
                "voucher_type": dt,
                "posting_date": today(),
                "company": doc.company,
                "bill_no": doc.name,
                "accounts": accounts,
                "user_remark": cstr(doc.remarks),
                "mode_of_payment": doc.mode_of_payment,
                "cheque_no": cstr(doc.payment_reference),
                "cheque_date": cstr(doc.clearance_date),
                "reference_date": cstr(doc.clearance_date),
                "multi_currency": multi_currency
            })
            .insert(ignore_permissions=True, ignore_mandatory=True)
            .submit())
    except Exception as exc:
        from .common import store_error
        
        store_error(exc)
        _log_error(_("Unable to create a journal entry for expenses entry \"{0}\".").format(entry))


# [E Entry]
def cancel_journal_entry(entry: str):
    dt = "Journal Entry"
    filters = {"bill_no": entry}
    if frappe.db.exists(dt, filters):
        try:
            frappe.get_doc(dt, filters).cancel()
        except Exception as exc:
            from .common import store_error
            
            store_error(exc)
            _log_error(_("Unable to cancel the journal entry for expenses entry \"{0}\".").format(entry))


# [Internal]
def _log_error(msg: str):
    from .common import log_error
    
    log_error(msg)