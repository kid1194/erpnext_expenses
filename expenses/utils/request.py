# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .cache import get_cached_doc
from .expense import get_expenses_data


# Expense
def requests_of_expense_exists(expense):
    return frappe.db.exists("Expenses Request Details", {
        "parenttype": "Expenses Request",
        "parentfield": "expenses",
        "expense": expense
    })


# Request Form
@frappe.whitelist(methods=["POST"])
def add_request_rejection_comment(name, comment):
    if (
        not name or not isinstance(name, str) or
        not comment or not isinstance(comment, str)
    ):
        return 0
    
    (get_cached_doc("Expenses Request", name)
        .add_comment(
            "Workflow",
            comment,
            comment_by=frappe.session.user
        ))
    return 1


# Entry Form
@frappe.whitelist(methods=["POST"])
def get_request_data(name):
    if not name or not isinstance(name, str):
        return 0
    
    data = get_cached_doc("Expenses Request", name).as_dict()
    
    if data.status != "Approved":
        return 0
    
    expenses = get_expenses_data(
        [v.expense for v in data.expenses]
    )
    
    data.update({"expenses": expenses})
    
    return data


# Entry
def process_request(name):
    if name and isinstance(name, str):
        get_cached_doc("Expenses Request", name, True).process()


# Entry
def reject_request(name):
    if name and isinstance(name, str):
        get_cached_doc("Expenses Request", name, True).reject()