# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Expense]
def get_expense_requests(expense: str):
    dt = "Expenses Request"
    doc = frappe.qb.DocType(dt)
    ddoc = frappe.qb.DocType(f"{dt} Details")
    data = (
        frappe.qb.from_(ddoc)
        .select(doc.name)
        .left_join(doc)
        .on(doc.name == ddoc.parent)
        .where(ddoc.expense == expense)
        .where(ddoc.parenttype == dt)
        .where(ddoc.parentfield == "expenses")
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    return data