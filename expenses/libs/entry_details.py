# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .doctypes import (
    __ENTRY__,
    __ENTRY_DETAILS__
)


## [Expense]
def get_expense_entries(expense: str):
    doc = frappe.qb.DocType(__ENTRY_DETAILS__)
    data = (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .where(doc.expense_ref == expense)
        .where(doc.parenttype == __ENTRY__)
        .where(doc.parentfield == "expenses")
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    return data