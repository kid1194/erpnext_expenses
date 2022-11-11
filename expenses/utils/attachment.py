# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .common import parse_json_if_valid


_ATTACHMENT = "Expense Attachment"


## Expense Form
@frappe.whitelist(methods=["POST"])
def delete_attach_files(files):
    if not files:
        return 0
    
    files = parse_json_if_valid(files)
    
    if not files or not isinstance(files, list):
        return 0
    
    dt = "File"
    for f in files:
        if frappe.db.exists(dt, f):
            (frappe.get_doc(dt, f)
                .delete(ignore_permissions=True))
    
    return 1


## Self Expense
def get_attachments_by_parents(parents, parenttype, parentfield):
    doc = frappe.qb.DocType(_ATTACHMENT)
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.parent,
            doc.file,
            doc.description,
        )
        .where(doc.parent.isin(parents))
        .where(doc.parenttype == parenttype)
        .where(doc.parentfield == parentfield)
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    groups = {}
    for v in data:
        k = v["parent"]
        if k not in groups:
            groups[k] = []
        
        groups[k].append({
            "file": v["file"],
            "description": v["description"],
        })
    
    return groups