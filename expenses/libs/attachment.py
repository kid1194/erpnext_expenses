# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [E Entry, E Entry Form, E Expense, E Expense Form]
@frappe.whitelist(methods=["POST"])
def delete_attach_files(doctype, name, files):
    if (
        not doctype or not isinstance(doctype, str) or
        not name or not isinstance(name, str) or
        not files or not isinstance(files, (str, list))
    ):
        return 0
    
    from .common import json_to_list
    
    files = json_to_list(files)
    
    if not files or not isinstance(files, list):
        return 0
    
    from .background import (
        uuid_key,
        is_job_running
    )
    
    job_id = uuid_key([doctype, files])
    job_id = f"exp-files-delete-{job_id}"
    if is_job_running(job_id):
        return 1
    
    files = frappe.get_all(
        "File",
        fields=["name"],
        filters=[
            ["file_url", "in", files],
            ["attached_to_doctype", "=", doctype],
            ["ifnull(`attached_to_name`,\"\")", "in", [name, ""]]
        ],
        pluck="name",
        ignore_permissions=True,
        strict=False
    )
    if not files or not isinstance(files, list):
        return 0
    
    from .background import enqueue_job
        
    enqueue_job(
        "expenses.libs.attachment.files_delete",
        job_id,
        timeout=len(files) * 3,
        files=files
    )
    
    return 1


# [Internal]
def files_delete(files: list):
    files = list(set(files))
    for i in range(len(files)):
        frappe.get_doc("File", files.pop(0)).delete(ignore_permissions=True)


# [Expense]
def get_files_by_parents(parents: list, parent_type: str, parent_field: str):
    dt = "Expense Attachment"
    raw = frappe.get_all(
        dt,
        fields=["parent", "file", "description"],
        filters=[
            [dt, "parent", "in", parents],
            [dt, "parenttype", "=", parent_type],
            [dt, "parentfield", "=", parent_field]
        ],
        ignore_permissions=True,
        strict=False
    )
    if not raw or not isinstance(raw, list):
        return None
    
    data = {}
    for i in range(len(raw)):
        v = raw.pop(0)
        k = v.pop("parent")
        if k not in data:
            data[k] = []
        
        data[k].append(v)
    
    return data