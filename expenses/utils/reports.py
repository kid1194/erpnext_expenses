# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe

from .search import filter_search, prepare_data


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def search_reviewers(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    doctype = "User"
    doc = frappe.qb.DocType(doctype)
    qry = (frappe.qb.from_(doc)
        .select(doc.name))
    
    qry = filter_search(doc, qry, doctype, txt, doc.name, "name")
    
    hrDoc = frappe.qb.DocType("Has Role")
    hrQry = (frappe.qb.from_(hrDoc)
        .select(hrDoc.parent)
        .where(hrDoc.parenttype == doctype)
        .where(hrDoc.parentfield == "roles")
        .where(hrDoc.role == "Expenses Reviewer"))
    qry = qry.where(doc.name.isin(hrQry))
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, "name", txt, as_dict)
    
    return data