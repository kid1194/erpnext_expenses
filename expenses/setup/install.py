# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.utils import now
from frappe.utils.user import get_system_managers

from expenses import __version__
from expenses.utils import settings


def after_install():
    if (managers := get_system_managers(only_name=True)):
        if "Administrator" in managers:
            sender = "Administrator"
        else:
            sender = managers[0]
        
        doc = settings(True)
        doc.update_notification_sender = sender
        
        if doc.update_notification_receivers:
            doc.update_notification_receivers.clear()
        
        for manager in managers:
            doc.append(
                "update_notification_receivers",
                {"user": manager}
            )
        
        doc.latest_version = __version__
        doc.latest_check = now()
        doc.has_update = 0
        
        doc.save(ignore_permissions=True)
    
    _add_link_to_workspace()


def _add_link_to_workspace():
    dt = "Workspace"
    
    name = "Expenses"
    if frappe.db.exists(dt, name):
        db_doc = frappe.qb.DocType(dt)
        (
            frappe.qb.from_(db_doc)
            .delete()
            .where(db_doc.name == name)
        ).run()
    
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
    
    for v in doc.links:
        if v.type == "Link" and v.label in keys:
            try:
                doc.links.remove(v)
            except Exception:
                pass
    
    for key in keys:
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