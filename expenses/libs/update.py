# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import re

import frappe
from frappe import _
from frappe.utils import cint

from expenses import __production__


# [Hooks]
def auto_check_for_update():
    if __production__:
        from .system import settings
        
        doc = settings()
        if doc._is_enabled and doc._auto_check_for_update:
            update_check(doc)


# [EXP Settings Form]
@frappe.whitelist()
def check_for_update():
    if not __production__:
        return 0
    
    return update_check()


# [Internal]
def update_check(doc=None):
    from frappe.utils import get_request_session
    
    from expenses import __api__
    
    try:
        http = get_request_session()
        request = http.request("GET", __api__)
        status_code = request.status_code
        result = request.json()
    except Exception as exc:
        from .common import store_error
        
        store_error(exc)
        return 0
    
    if status_code != 200 and status_code != 201:
        log_response("Invalid response status", status_code, result)
        return 0
    
    from .common import parse_json
    
    data = parse_json(result)
    if (
        not data or not isinstance(data, dict) or
        not data.get("tag_name", "") or
        not isinstance(data["tag_name"], (str, int, float))
    ):
        log_response("Invalid response data", status_code, result)
        return 0
    
    latest_version = re.findall(r"(\d+(?:\.\d+)+)", str(data["tag_name"]))
    if not latest_version:
        log_response("Invalid response update version", status_code, result)
        return 0
    
    from frappe.utils import now
    
    from expenses import __version__
    
    latest_version = latest_version.pop()
    has_update = compare_versions(latest_version, __version__) > 0
    
    if not doc:
        from .system import settings
        
        doc = settings()
    
    doc.latest_check = now()
    if has_update:
        doc.latest_version = latest_version
        doc.has_update = 1
    
    doc.save(ignore_permissions=True)
    
    if has_update and doc._is_enabled and doc._send_update_notification:
        from .background import is_job_running
        
        job_name = f"exp-send-notification-{latest_version}"
        if not is_job_running(job_name):
            from .background import enqueue_job
            
            enqueue_job(
                "expenses.libs.update.send_notification",
                job_name,
                version=latest_version,
                sender=doc.update_notification_sender,
                receivers=[v.user for v in doc.update_notification_receivers],
                message=data.get("body", "")
            )
    
    return 1


# [Internal]
def log_response(message, status, result):
    from .common import store_info
    
    store_info({
        "action": "check for update",
        "message": message,
        "response": {
            "status": status,
            "result": result
        }
    })


## [Internal]
def compare_versions(verA, verB):
    verA = verA.split(".")
    lenA = len(verA)
    verB = verB.split(".")
    lenB = len(verB)
    
    if lenA > lenB:
        for i in range(lenB, lenA):
            verB.append(0)
    elif lenA < lenB:
        for i in range(lenA, lenB):
            verA.append(0)
    
    for a, b in zip(verA, verB):
        d = cint(a) - cint(b)
        if d == 0:
            continue
        return 1 if d > 0 else -1
    
    return 0


## [Internal]
def send_notification(version, sender, receivers, message):
    from .check import user_exists
    
    if not user_exists(sender, enabled=True):
        return 0
    
    from .filter import users_filter
    
    receivers = users_filter(receivers, enabled=True)
    if not receivers:
        return 0
    
    from frappe.desk.doctype.notification_settings.notification_settings import (
        is_notifications_enabled
    )
    
    from expenses import __module__
    
    if message:
        from frappe.utils import markdown
        
        message = _(markdown(message))
    else:
        message = _("No update message.")
    
    doc = {
        "document_type": "Expenses Settings",
        "document_name": "Expenses Settings",
        "from_user": sender,
        "subject": "{0}: {1}".format(__module__, _("New version available")),
        "type": "Alert",
        "email_content": "<p><h2>{0} {1}</h2></p><p>{2}</p>".format(
            _("Version"), version, message
        )
    }
    for receiver in receivers:
        if is_notifications_enabled(receiver):
            (frappe.new_doc("Notification Log")
                .update(doc)
                .update({"for_user": receiver})
                .insert(ignore_permissions=True, ignore_mandatory=True))