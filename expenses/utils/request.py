# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .common import get_cached_doc
from .expense import get_expenses_data


_REQUEST = "Expenses Request"
_REQUEST_EXPENSE = "Expenses Request Expense"
_EXPENSES_FIELD = "expenses"


## Expense
def requests_of_expense_exists(expense):
    return frappe.db.exists(_REQUEST_EXPENSE, {
        "parenttype": _REQUEST,
        "parentfield": _EXPENSES_FIELD,
        "expense": expense
    })


## Expenses Request Form
@frappe.whitelist(methods=["POST"])
def add_request_reject_reason(name, reason):
    if (
        not name or not isinstance(name, str) or
        not reason or not isinstance(reason, str)
    ):
        return 0
    
    set_request_reviewer(name)
    (frappe.get_doc(_REQUEST, name)
        .add_comment(
            "Workflow",
            reason,
            comment_by=frappe.session.user
        ))
    return 1


## Expenses Request Form
@frappe.whitelist(methods=["POST"])
def set_request_reviewer(name):
    if not name or not isinstance(name, str):
        return 0
    
    frappe.db.set_value(
        _REQUEST, name, 'reviewer',
        frappe.session.user, update_modified=False
    )
    return 1


## Expenses Entry Form
@frappe.whitelist(methods=["POST"])
def get_request_data(name):
    if not name or not isinstance(name, str):
        return 0
    
    data = get_cached_doc(_REQUEST, name).as_dict()
    
    if data.status != "Approved":
        return 0
    
    expenses = get_expenses_data(
        [v.expense for v in data.expenses]
    )
    
    data.update({"expenses": expenses})
    
    return data


## Expenses Entry
def reject_request(name):
    if name and isinstance(name, str):
        doc = get_cached_doc(_REQUEST, name, True)
        doc.update({
            "status": "Rejected",
            "workflow_state": "Rejected",
        })
        doc.save(ignore_permissions=True)
        doc.cancel()