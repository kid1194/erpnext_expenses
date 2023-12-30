# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from expenses import __name__
from .install import _DOCTYPES_


## [Hooks]
def before_uninstall():
    _remove_roles()
    _remove_link_from_workspace()
    frappe.clear_cache()


## [Internal]
def _remove_roles():
    roles = [
        "Expense Supervisor",
        "Expenses Reviewer",
        
        "Expense Moderator",
        "Expenses Request Moderator",
        "Expenses Request Reviewer",
        "Expenses Entry Moderator"
    ]
    
    dt = "Has Role"
    db_doc = frappe.qb.DocType(dt)
    (
        frappe.qb.from_(db_doc)
        .delete()
        .where(db_doc.role.isin(roles))
    ).run()
    
    dt = "Role"
    db_doc = frappe.qb.DocType(dt)
    (
        frappe.qb.from_(db_doc)
        .delete()
        .where(db_doc.name.isin(roles))
    ).run()


## [Internal]
def _remove_link_from_workspace():
    dt = "Workspace"
    db_doc = frappe.qb.DocType(dt)
    (
        frappe.qb.from_(db_doc)
        .delete()
        .where(db_doc.name == __name__)
    ).run()
    
    name = "Accounting"
    if not frappe.db.exists(dt, name):
        return 0
        
    doc = frappe.get_doc(dt, name)
    found = 0
    
    for v in doc.links:
        if v.type == "Link" and v.label in _DOCTYPES_:
            try:
                doc.links.remove(v)
                found = 1
            except Exception:
                pass
    
    if found:
        doc.save(ignore_permissions=True)