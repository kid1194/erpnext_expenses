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
    __name__,
    __version__,
    __production__
)

from .background import (
    is_job_running,
    enqueue_job
)
from .check import user_exists
from .common import (
    log_error,
    parse_json
)
from .filter import users_filter
from .settings import (
    __SETTINGS__,
    settings,
    is_enabled
)


## [Hooks]
def auto_check_for_update():
    if __production__ and is_enabled():
        check_for_update()


# [Settings Form]
## [Internal]
@frappe.whitelist()
def check_for_update():
    try:
        http = get_request_session()
        request = http.request(
            "GET",
            "https://api.github.com/repos/kid1194/erpnext_expenses/releases/latest"
        )
        status_code = request.status_code
        data = request.json()
    except Exception as exc:
        log_error(exc)
        return 0
    
    if status_code != 200 and status_code != 201:
        return 0
    
    data = parse_json(data)
    
    if (
        not data or not isinstance(data, dict) or
        not getattr(data, "tag_name", "") or
        not getattr(data, "body", "")
    ):
        return 0
    
    latest_version = re.findall(r"(\d+(?:\.\d+)+)", str(data.get("tag_name")))
    if not latest_version:
        return 0
    
    latest_version = latest_version.pop()
    has_update = compare_versions(latest_version, __version__) > 0
    
    doc = settings()
    doc.latest_check = now()
    
    if has_update:
        doc.latest_version = latest_version
        doc.has_update = 1
    
    doc.save(ignore_permissions=True)
    
    if (
        has_update and
        cint(doc.send_update_notification) and
        user_exists(doc.update_notification_sender, enabled=True)
    ):
        enqueue_send_notification(
            latest_version,
            doc.update_notification_sender,
            [v.user for v in doc.update_notification_receivers],
            markdown(response.get("body"))
        )
    
    return 1


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
def enqueue_send_notification(version, sender, receivers, message):
    job_name = f"exp-send-notification-{version}"
    if not is_job_running(job_name):
        enqueue_job(
            "expenses.libs.update.send_notification",
            job_name,
            version=version,
            sender=sender,
            receivers=receivers,
            message=message
        )


## [Internal]
def send_notification(version, sender, receivers, message):
    receivers = users_filter(receivers, enabled=True);
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
                    "subject": "{0}: {1}".format(__name__, _("New Version Available")),
                    "type": "Alert",
                    "email_content": "<p><h2>{0} {1}</h2></p><p>{2}</p>".format(
                        _("Version"), version, _(message)
                    ),
                })
                .insert(ignore_permissions=True, ignore_mandatory=True))