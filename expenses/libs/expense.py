# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from pypika.terms import Criterion

import frappe

from .attachment import get_files_by_parents
from .background import (
    uuid_key,
    is_job_running,
    enqueue_job
)
from .check import (
    can_use_expense_claim,
    expense_claim_exists,
    expense_exists
)
from .doctypes import __EXPENSE__
from .entry_details import get_expense_entries
from .item import get_item_company_account
from .request_details import get_expense_requests
from .search import (
    filter_search,
    prepare_data
)


# [Expense]
## [Internal]
ExpenseStatus = frappe._dict({
    "Draft": "Draft",
    "Pending": "Pending",
    "Requested": "Requested",
    "Approved": "Approved",
    "Rejected": "Rejected",
    "Cancelled": "Cancelled"
})


## [Internal]
__EXPENSE_MODERATOR_ROLE__ = "Expense Moderator"


# [Expense, Expense Form]
@frappe.whitelist(methods=["POST"])
def item_expense_data(item, company):
    if (
        not item or not isinstance(item, str) or
        not company or not isinstance(company, str)
    ):
        return {}
    
    return get_item_company_account(item, company)


# [Expense Form]
@frappe.whitelist()
def expense_form_setup():
    return {
        "is_moderator": is_expense_moderator(),
        "has_expense_claim": has_expense_claim()
    }


# [Expense]
## [Internal]
def is_expense_moderator():
    return 1 if __EXPENSE_MODERATOR_ROLE__ in frappe.get_roles() else 0


# [Expense]
## [Internal]
def has_expense_claim():
    return 1 if can_use_expense_claim() else 0


# [Entry, Expense]
def is_valid_claim(expense_claim: str, paid_by: str, company: str):
    return expense_claim_exists(
        expense_claim,
        {
            "employee": paid_by,
            "company": company,
            "is_paid": 1,
            "status": "Paid",
            "docstatus": 1
        }
    )


# [Expense]
def expense_requests_exists(name: str):
    data = get_expense_requests(name)
    if not data:
        return False
    
    return True


# [Expense]
def expense_entries_exists(name: str):
    data = get_expense_entries(name)
    if not data:
        return False
    
    return True


## [Request]
def get_expenses_for_company(names: list, company: str):
    return frappe.get_all(
        __EXPENSE__,
        fields=["name"],
        filters={
            "name": ["in", names],
            "company": company,
            "docstatus": 1,
        },
        pluck="name"
    )


## [Request]
def set_expenses_restored(names: list):
    enqueue_expenses_status_change(
        names,
        "restore"
    )


## [Request]
def set_expenses_requested(names: list):
    enqueue_expenses_status_change(
        names,
        ExpenseStatus.Requested
    )


## [Request]
def set_expenses_approved(names: list):
    enqueue_expenses_status_change(
        names,
        ExpenseStatus.Approved
    )


## [Request]
def set_expenses_rejected(names: list):
    enqueue_expenses_status_change(
        names,
        ExpenseStatus.Rejected
    )


## [Request]
def get_expenses(names: list):
    doc = frappe.qb.DocType(__EXPENSE__)
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.company,
            doc.expense_account,
            doc.required_by,
            doc.description,
            doc.currency,
            doc.total,
            doc.is_paid,
            doc.paid_by,
            doc.is_advance,
            doc.party_type,
            doc.party,
            doc.project
        )
        .where(doc.name.isin(names))
        .where(Criterion.any([
            doc.status == ExpenseStatus.Pending,
            doc.status == ExpenseStatus.Requested
        ]))
        #.where(doc.owner == frappe.session.user)
        .where(doc.docstatus == 1)
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return {"error": _("Unable to get the expenses data.")}
    
    if (attachments := get_files_by_parents(
        [v["name"] for v in data],
        __EXPENSE__,
        "attachments"
    )):
        for i in range(len(data)):
            if data[i]["name"] in attachments:
                data[i]["attachments"] = attachments.get(data[i]["name"])
    
    return data


## [Request]
def search_expenses_by_company(
    company: str, search: str=None, existing: list=None,
    date: str=None, as_dict=False
):
    doc = frappe.qb.DocType(__EXPENSE__)
    qry = (
        frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.expense_item,
            doc.description,
            doc.total,
            doc.is_advance,
            doc.required_by
        )
        .where(doc.company == company)
        .where(doc.status == ExpenseStatus.Pending)
        .where(doc.owner == frappe.session.user)
        .where(doc.docstatus == 1)
    )
    
    qry = filter_search(doc, qry, __EXPENSE__, search, doc.name, "name")
    
    if existing:
        qry = qry.where(doc.name.notin(existing))
    
    if date:
        qry = qry.where(doc.required_by.lte(date))
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, __EXPENSE__, "name", search, as_dict)
    
    return data


## [Internal]
def enqueue_expenses_status_change(names: list, status: str):
    key = uuid_key(names, status)
    job_name = f"exp-set-expenses-status-{key}"
    if not is_job_running(job_name):
        enqueue_job(
            "expenses.libs.expense.set_expenses_status",
            job_name,
            names=names,
            status=status
        )


## [Internal]
def set_expenses_status(names: list, status: str):
    if status == ExpenseStatus.Requested:
        action = 1
    elif status == ExpenseStatus.Approved:
        action = 2
    elif status == ExpenseStatus.Rejected:
        action = 3
    elif status == "restore":
        action = 4
    else:
        action = 0
    
    if not action:
        return 0
    
    for name in names:
        if expense_exists(name):
            doc = frappe.get_doc(__EXPENSE__, name)
            if action == 1:
                doc.request()
            elif action == 2:
                doc.approve()
            elif action == 3:
                doc.reject()
            elif action == 4:
                doc.restore()