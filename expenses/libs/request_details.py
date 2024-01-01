# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .doctypes import (
    __REQUEST__,
    __REQUEST_DETAILS__
)


## [Expense]
def get_expense_requests(expense: str):
    doc = frappe.qb.DocType(__REQUEST__)
    ddoc = frappe.qb.DocType(__REQUEST_DETAILS__)
    data = (
        frappe.qb.from_(ddoc)
        .select(doc.name)
        .left_join(doc)
        .on(doc.name == ddoc.parent)
        .where(ddoc.expense == expense)
        .where(ddoc.parenttype == __REQUEST__)
        .where(ddoc.parentfield == "expenses")
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    return data