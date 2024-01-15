# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import now
from frappe.utils.user import get_system_managers

from expenses import (
    __VERSION__,
    __PRODUCTION__
)

from expenses.libs.settings import settings

from .uninstall import (
    __DOCTYPES__ as doctypes,
    after_uninstall
)


## [Hooks]
def before_install():
    if not __PRODUCTION__:
        after_uninstall()


## [Hooks]
def after_sync():
    _settings_setup()
    _workspace_setup()


## [Internal]
def _settings_setup():
    try:
        doc = settings()
        
        managers = get_system_managers(only_name=True)
        if managers:
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
                if manager != sender:
                    doc.append(
                        "update_notification_receivers",
                        {"user": manager}
                    )
            
            if not doc.update_notification_receivers:
                doc.send_update_notification = 0
                
        else:
            doc.auto_check_for_update = 0
            doc.send_update_notification = 0
        
        doc.current_version = __VERSION__
        doc.latest_version = __VERSION__
        doc.latest_check = now()
        doc.has_update = 0
            
        doc.save(ignore_permissions=True)
    except Exception:
        pass


## [Internal]
def _workspace_setup():
    try:
        dt = "Workspace"
        name = "Accounting"
        if not frappe.db.exists(dt, name):
            return 0
        
        doc = frappe.get_doc(dt, name)
        for doctype in doctypes:
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