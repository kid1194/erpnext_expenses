# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


## [Expense]
def get_expense_entries(expense: str):
    doc = frappe.qb.DocType("Expenses Entry Details")
    data = (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .where(doc.expense_ref == expense)
        .where(doc.parenttype == "Expenses Entry")
        .where(doc.parentfield == "expenses")
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    return data