# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import hashlib
import uuid

import frappe
from frappe.utils import cstr

from expenses.version import __frappe_v15__

from .common import to_json


## [Expense]
def uuid_key(args):
    return cstr(uuid.UUID(hashlib.sha256(
        to_json(args, "").encode("utf-8")
    ).hexdigest()[::2]))


## [Expense, Journal, Update]
def is_job_running(name: str):
    if __frappe_v15__:
        from frappe.utils.background_jobs import is_job_enqueued
        return is_job_enqueued(name)
    
    else:
        from frappe.core.page.background_jobs.background_jobs import get_info
        jobs = [d.get("job_name") for d in get_info("Jobs", job_status="active")]
        return True if name in jobs else False


## [Attachment, Expense, Journal, Update]
def enqueue_job(method: str, job_name: str, **kwargs):
    if __frappe_v15__:
        frappe.enqueue(
            method,
            job_id=job_name,
            is_async=True,
            **kwargs
        )
    else:
        frappe.enqueue(
            method,
            job_name=job_name,
            is_async=True,
            **kwargs
        )