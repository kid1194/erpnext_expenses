# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import re

import frappe
from frappe import _
from frappe.utils import cint

from expenses import (
    __module__,
    __version__,
    __production__
)

from .settings import settings


# [Hooks]
def auto_check_for_update():
    if __production__:
        doc = settings()
        if cint(doc.is_enabled) and cint(doc.auto_check_for_update):
            process_check_for_update(doc)


# [EXP Settings Form]
@frappe.whitelist()
def check_for_update():
    if not __production__:
        return 0
    doc = settings()
    if not cint(doc.is_enabled):
        return 0
    
    return process_check_for_update(doc)


# [Internal]
def process_check_for_update(doc):
    from frappe.utils import get_request_session
    
    try:
        http = get_request_session()
        request = http.request(
            "GET",
            "https://api.github.com/repos/kid1194/erpnext_expenses/releases/latest"
        )
        status_code = request.status_code
        result = request.json()
    except Exception as exc:
        from .common import log_error
        
        log_error(exc)
        return 0
    
    if status_code != 200 and status_code != 201:
        log_response("Invalid response status", status_code, result)
        return 0
    
    from .common import parse_json
    
    data = parse_json(result)
    if (
        not data or not isinstance(data, dict) or
        not getattr(data, "tag_name", "") or
        not getattr(data, "body", "")
    ):
        log_response("Invalid response data", status_code, result)
        return 0
    
    latest_version = re.findall(r"(\d+(?:\.\d+)+)", str(data.get("tag_name")))
    if not latest_version:
        log_response("Invalid response update version", status_code, result)
        return 0
    
    from frappe.utils import now
    
    latest_version = latest_version.pop()
    has_update = compare_versions(latest_version, __version__) > 0
    doc.latest_check = now()
    if has_update:
        doc.latest_version = latest_version
        doc.has_update = 1
    
    doc.save(ignore_permissions=True)
    
    if has_update and cint(doc.send_update_notification):
        from .background import is_job_running, enqueue_job
        
        job_name = f"exp-send-notification-{latest_version}"
        if not is_job_running(job_name):
            from frappe.utils import markdown
            
            enqueue_job(
                "expenses.libs.update.send_notification",
                job_name,
                version=latest_version,
                sender=doc.update_notification_sender,
                receivers=[v.user for v in doc.update_notification_receivers],
                message=markdown(data.get("body"))
            )
    
    return 1


# [Internal]
def log_response(message, status, result):
    from .common import log_info
    
    log_info({
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
    
    doc = {
        "document_type": "Expenses Settings",
        "document_name": "Expenses Settings",
        "from_user": sender,
        "subject": "{0}: {1}".format(__module__, _("New Version Available")),
        "type": "Alert",
        "email_content": "<p><h2>{0} {1}</h2></p><p>{2}</p>".format(
            _("Version"), version, _(message)
        )
    }
    for receiver in receivers:
        if is_notifications_enabled(receiver):
            (frappe.new_doc("Notification Log")
                .update(doc)
                .update({"for_user": receiver})
                .insert(ignore_permissions=True, ignore_mandatory=True))