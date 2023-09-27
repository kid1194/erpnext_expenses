# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


def before_uninstall():
    _remove_link_from_workspace()


def _remove_link_from_workspace():
    dt = "Workspace"
    name = "Accounting"
    if not frappe.db.exists(dt, name):
        return 0
        
    doc = frappe.get_doc(dt, name)
    keys = [
        "Expense Type",
        "Expense Item",
        "Expense",
        "Expenses Entry",
        "Expenses Request",
        "Expenses Settings"
    ]
    found = 0
    
    for v in doc.links:
        if v.type == "Link" and v.label in keys:
            try:
                doc.links.remove(v)
                found = 1
            except Exception:
                pass
    
    if found:
        doc.save(ignore_permissions=True)