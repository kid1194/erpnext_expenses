# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .common import get_cache, set_cache


# Expenses Doc Dialog
@frappe.whitelist(methods=["POST"])
def get_docfields(doctype):
    if not doctype or not isinstance(doctype, str):
        return []
    
    cache = get_cache(doctype, doctype)
    if cache and isinstance(cache, list):
        return cache
    
    fields = get_doctype_fields(doctype)
    
    if fields:
        set_cache(doctype, doctype, fields)
    
    return fields


# Self
def get_doctype_fields(doctype):
    fields = frappe.get_all(
        "DocField",
        fields=["*"],
        filters={
            "parent": doctype,
            "parenttype": "DocType",
            "parentfield": "fields",
        }
    )
    for i in range(len(fields)):
        f = fields[i]
        if "Table" in f["fieldtype"]:
            f["fields"] = get_doctype_fields(f["options"])
    
    return fields