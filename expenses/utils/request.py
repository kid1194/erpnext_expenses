# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .common import get_cached_doc
from .doctypes import _REQUEST, _REQUEST_EXPENSES, _REQUEST_DETAILS
from .expense import get_expenses_data


## Expense
def requests_of_expense_exists(expense):
    return frappe.db.exists(_REQUEST_DETAILS, {
        "parenttype": _REQUEST,
        "parentfield": _REQUEST_EXPENSES,
        "expense": expense
    })


## Expenses Request Form
@frappe.whitelist(methods=["POST"])
def add_request_rejection_comment(name, comment):
    if (
        not name or not isinstance(name, str) or
        not comment or not isinstance(comment, str)
    ):
        return 0
    
    (get_cached_doc(_REQUEST, name)
        .add_comment(
            "Workflow",
            comment,
            comment_by=frappe.session.user
        ))
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
def process_request(name):
    if name and isinstance(name, str):
        get_cached_doc(_REQUEST, name, True).process()


## Expenses Entry
def reject_request(name):
    if name and isinstance(name, str):
        get_cached_doc(_REQUEST, name, True).reject()