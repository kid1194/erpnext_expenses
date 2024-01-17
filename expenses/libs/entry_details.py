# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


## [Expense]
def get_expense_entries(expense: str):
    dt = "Expenses Entry"
    doc = frappe.qb.DocType(f"{dt} Details")
    data = (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .where(doc.expense_ref == expense)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == "expenses")
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    return data