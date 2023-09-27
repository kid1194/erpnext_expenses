# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _dict
from frappe.utils import flt


# Type
# Item
def get_company_account_data_by_parent(company, parent, parent_type, parent_field):
    doc = frappe.qb.DocType("Expense Account")
    aDoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.account,
            aDoc.account_currency.as_("currency"),
            doc.cost,
            doc.min_cost,
            doc.max_cost,
            doc.qty,
            doc.min_qty,
            doc.max_qty
        )
        .inner_join(aDoc)
        .on(aDoc.name == doc.account)
        .where(doc.company == company)
        .where(doc.parent == parent)
        .where(doc.parenttype == parent_type)
        .where(doc.parentfield == parent_field)
        .limit(1)
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    data = data.pop(0)
    for k in ["cost", "qty"]:
        data[k] = flt(data[k])
        data["min_" + k] = flt(data["min_" + k])
        data["max_" + k] = flt(data["max_" + k])
    
    return _dict(data)