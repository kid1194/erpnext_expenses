# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import re

import frappe
from frappe import _
from frappe.utils import (
    get_request_session,
    cint,
    now,
    markdown
)
from frappe.desk.doctype.notification_settings.notification_settings import (
    is_notifications_enabled
)

from expenses import (
    __MODULE__,
    __VERSION__,
    __PRODUCTION__
)

from .background import (
    is_job_running,
    enqueue_job
)
from .check import user_exists
from .common import (
    log_error,
    log_info,
    parse_json
)
from .doctypes import __SETTINGS__
from .filter import users_filter
from .settings import settings


## [Hooks]
def auto_check_for_update():
    if __PRODUCTION__:
        doc = settings()
        if cint(doc.is_enabled) and cint(doc.auto_check_for_update):
            process_check_for_update(doc)


# [Settings Form]
@frappe.whitelist()
def check_for_update():
    if __PRODUCTION__:
        return 0
    doc = settings()
    if not cint(doc.is_enabled):
        return 0
    
    return process_check_for_update(doc)


## [Internal]
def process_check_for_update(doc):
    try:
        http = get_request_session()
        request = http.request(
            "GET",
            "https://api.github.com/repos/kid1194/erpnext_expenses/releases/latest"
        )
        status_code = request.status_code
        result = request.json()
    except Exception as exc:
        log_error(exc)
        return 0
    
    if status_code != 200 and status_code != 201:
        log_response("Invalid response status", status_code, result)
        return 0
    
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
    
    latest_version = latest_version.pop()
    has_update = compare_versions(latest_version, __VERSION__) > 0
    
    doc.latest_check = now()
    
    if has_update:
        doc.latest_version = latest_version
        doc.has_update = 1
    
    doc.save(ignore_permissions=True)
    
    if has_update and cint(doc.send_update_notification):
        job_name = f"exp-send-notification-{latest_version}"
        if not is_job_running(job_name):
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
    if not user_exists(sender, enabled=True):
        return 0
    
    receivers = users_filter(receivers, enabled=True)
    if not receivers:
        return 0
    
    for receiver in receivers:
        if is_notifications_enabled(receiver):
            (frappe.new_doc("Notification Log")
                .update({
                    "document_type": __SETTINGS__,
                    "document_name": __SETTINGS__,
                    "from_user": sender,
                    "for_user": receiver,
                    "subject": "{0}: {1}".format(__MODULE__, _("New Version Available")),
                    "type": "Alert",
                    "email_content": "<p><h2>{0} {1}</h2></p><p>{2}</p>".format(
                        _("Version"), version, _(message)
                    )
                })
                .insert(ignore_permissions=True, ignore_mandatory=True))