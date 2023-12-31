# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import now
from frappe.utils.user import get_system_managers

from expenses import (
    __name__,
    __version__
)
from expenses.libs import (
    settings,
    __TYPE__,
    __ITEM__,
    __EXPENSE__,
    __REQUEST__,
    __ENTRY__,
    __SETTINGS__
)


# [Uninstall, Internal]
_DOCTYPES_ = [
    __TYPE__,
    __ITEM__,
    __EXPENSE__,
    __REQUEST__,
    __ENTRY__,
    __SETTINGS__
]


## [Hooks]
def after_install():
    cleanup()
    
    doc = settings()
    
    if (managers := get_system_managers(only_name=True)):
        doc.auto_check_for_update = 1
        doc.send_update_notification = 1
        
        if "Administrator" in managers:
            sender = "Administrator"
        else:
            sender = managers[0]
        
        doc.update_notification_sender = sender
        
        if doc.update_notification_receivers:
            doc.update_notification_receivers.clear()
        
        for manager in managers:
            doc.append(
                "update_notification_receivers",
                {"user": manager}
            )
        
        if not doc.update_notification_receivers:
            doc.send_update_notification = 0
            
    else:
        doc.auto_check_for_update = 0
        doc.send_update_notification = 0
    
    doc.current_version = __version__
    doc.latest_version = __version__
    doc.latest_check = now()
    doc.has_update = 0
        
    doc.save(ignore_permissions=True)
    
    _add_link_to_workspace()


## [Uninstall, Internal]
def cleanup():
    roles = [
        "Expense Supervisor",
        "Expenses Reviewer"
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
    
    dt = "Workspace"
    db_doc = frappe.qb.DocType(dt)
    (
        frappe.qb.from_(db_doc)
        .delete()
        .where(db_doc.name == __name__)
    ).run()
        
    frappe.clear_cache()


## [Internal]
def _add_link_to_workspace():
    name = "Accounting"
    if not frappe.db.exists(dt, name):
        return 0
    
    doc = frappe.get_doc(dt, name)
    for v in doc.links:
        if v.type == "Link" and v.label in _DOCTYPES_:
            try:
                doc.links.remove(v)
            except Exception:
                pass
    
    for key in _DOCTYPES_:
        doc.append("links", {
            "dependencies": "",
            "hidden": 0,
            "is_query_report": 0,
            "label": key,
            "link_count": 0,
            "link_to": key,
            "link_type": "DocType",
            "onboard": 0,
            "type": "Link"
        })
    
    doc.save(ignore_permissions=True)