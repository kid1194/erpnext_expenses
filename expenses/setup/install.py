# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from expenses import (
    __version__,
    __production__
)


# [Hooks]
def before_install():
    if not __production__:
        from .uninstall import after_uninstall
        
        after_uninstall()


# [Hooks]
def after_sync():
    _settings_setup()
    _workspace_setup()


# [Internal]
def _settings_setup():
    from frappe.utils import now
    from frappe.utils.user import get_system_managers
    
    from expenses.libs.settings import settings
    
    try:
        doc = settings()
        managers = get_system_managers(only_name=True)
        if managers:
            if "Administrator" in managers:
                doc.update_notification_sender = "Administrator"
            else:
                doc.update_notification_sender = managers[0]
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
                doc.send_update_notification = 1
        else:
            doc.send_update_notification = 0
        
        doc.current_version = __version__
        doc.latest_version = __version__
        doc.latest_check = now()
        doc.has_update = 0
        doc.save(ignore_permissions=True)
    except Exception:
        pass


# [Internal]
def _workspace_setup():
    try:
        dt = "Workspace"
        name = "Accounting"
        if not frappe.db.exists(dt, name):
            return 0
        
        from .uninstall import get_doctypes
        
        doc = frappe.get_doc(dt, name)
        for doctype in get_doctypes():
            doc.append("links", {
                "dependencies": "",
                "hidden": 0,
                "is_query_report": 0,
                "label": doctype,
                "link_count": 0,
                "link_to": doctype,
                "link_type": "DocType",
                "onboard": 0,
                "type": "Link"
            })
        doc.save(ignore_permissions=True)
    except Exception:
        pass