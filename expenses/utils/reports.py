# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .search import (
    filter_search,
    prepare_data
)


@frappe.whitelist()
def search_reviewers(
    doctype, txt, searchfield, start, page_len, filters, as_dict=False
):
    dt = "User"
    doc = frappe.qb.DocType(dt)
    qry = (frappe.qb.from_(doc)
        .select(doc.name))
    
    qry = filter_search(doc, qry, dt, txt, doc.name, "name")
    
    hrDoc = frappe.qb.DocType("Has Role")
    hrQry = (frappe.qb.from_(hrDoc)
        .select(hrDoc.parent)
        .where(hrDoc.parenttype == dt)
        .where(hrDoc.parentfield == "roles")
        .where(hrDoc.role == "Expenses Reviewer"))
    qry = qry.where(doc.name.isin(hrQry))
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, dt, "name", txt, as_dict)
    
    return data