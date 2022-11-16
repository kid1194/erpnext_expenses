# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import flt

from .doctypes import _ACCOUNT


## Self Type
## Self Item
def get_company_account_data_by_parent(company, parent, parenttype, parentfield):
    doc = frappe.qb.DocType(_ACCOUNT)
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
        .where(doc.parenttype == parenttype)
        .where(doc.parentfield == parentfield)
        .limit(1)
    ).run(as_dict=True)
    
    data = data.pop(0) if data and isinstance(data, list) else None
    if data:
        data = frappe._dict(data)
        for k in ["cost", "qty"]:
            data[k] = flt(data[k])
            data["min_" + k] = flt(data["min_" + k])
            data["max_" + k] = flt(data["max_" + k])
    
    return data