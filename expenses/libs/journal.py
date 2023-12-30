# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import (
    cint,
    flt,
    cstr,
    today
)

from .background import (
    is_job_running,
    enqueue_job
)
from .common import (
    log_error,
    error
)
from .entry import get_entry_data


## [Internal]
_JOURNAL_ = "Journal Entry"


# [Entry]
def enqueue_journal_entry(entry: str):
    job_name = f"exp-make-journal-entry-{entry}"
    if not is_job_running(job_name):
        enqueue_job(
            "expenses.libs.journal.make_journal_entry",
            job_name,
            enqueue_after_commit=True,
            entry=entry
        )


## [Internal]
def make_journal_entry(entry: str):
    doc = get_entry_data(entry)
    if not doc:
        error(_(
            "The expenses entry \"{0}\" does not exist."
        ).format(entry), throw=False)
        return 0
    
    if cint(doc.docstatus) != 1:
        error(_(
            "The expenses entry \"{0}\" has not been submitted."
        ).format(entry), throw=False)
        return 0
    
    if frappe.db.exists(_JOURNAL_, {"bill_no": entry}):
        error(_(
            "The expenses entry \"{0}\" has already been added to journal."
        ).format(entry), throw=False)
        return 0
    
    if not doc.payment_account:
        error(_(
            "The Mode of Payment of expenses entry \"{0}\" has no linked account."
        ).format(entry), throw=False)
        return 0
    
    if (
        doc.payment_target == "Bank" and
        (not doc.payment_reference or not doc.clearance_date)
    ):
        error(_(
            "The payment reference and/or payment / clearance date for expenses entry \"{0}\" has not been set."
        ).format(entry), throw=False)
        return 0
    
    multi_currency = 0
    accounts = []
    for v in doc.expenses:
        if (
            not multi_currency and
            v.account_currency != doc.payment_currency
        ):
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
        
    if doc.payment_target == "Cash":
        doc.payment_reference = ""
        doc.clearance_date = ""
    
    accounts.append({
        "account": doc.payment_account,
        "account_currency": doc.payment_currency,
        "exchange_rate": flt(doc.exchange_rate),
        "credit_in_account_currency": flt(doc.total_in_payment_currency),
        "credit": flt(doc.total),
    })
    
    try:
        (frappe.new_doc(_JOURNAL_)
            .update({
                "title": doc.name,
                "voucher_type": _JOURNAL_,
                "posting_date": today(),
                "company": doc.company,
                "bill_no": doc.name,
                "accounts": accounts,
                "user_remark": cstr(doc.remarks),
                "mode_of_payment": doc.mode_of_payment,
                "cheque_no": cstr(doc.payment_reference),
                "cheque_date": cstr(doc.clearance_date),
                "reference_date": cstr(doc.clearance_date),
                "multi_currency": multi_currency,
            })
            .insert(ignore_permissions=True, ignore_mandatory=True)
            .submit())
    
    except Exception as exc:
        log_error(exc)
        error(_(
            "Unable to create a journal entry for expenses entry \"{0}\"."
        ).format(entry), throw=False)


# [Entry]
def cancel_journal_entry(entry: str):
    filters = {"bill_no": entry}
    if frappe.db.exists(_JOURNAL_, filters):
        try:
            frappe.get_doc(_JOURNAL_, filters).cancel()
        except Exception as exc:
            log_error(exc)
            error(_(
                "Unable to cancel the journal entry for expenses entry \"{0}\"."
            ).format(entry), throw=False)