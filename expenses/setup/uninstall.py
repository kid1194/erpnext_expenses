# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe


def after_uninstall():
    data = {
        "Role": "Expense Reviewer",
        "Workflow": "Expense Review",
        "Workflow State": [
            "Draft",
            "Pending",
            "Cancelled",
            "Approved",
            "Rejected",
            "Processed"
        ],
        "Workflow Action Master": [
            "Submit",
            "Cancel",
            "Approve",
            "Reject",
            "Make Entry"
        ],
    }
    for doctype, name in data.items():
        if not isinstance(name, list):
            delete_doc(doctype, name)
        else:
            for doc_name in name:
                delete_doc(doctype, doc_name)


def delete_accounting_workspace_link():
    dt = "Workspace"
    name = "Accounting"
    if frappe.db.exists(dt, name):
        doc = frappe.get_doc(dt, name)
        key = "Expenses"
        link = [v for v in doc.links if v.type == "Link" and v.label == key]
        if not link:
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


def delete_doc(doctype, name):
    frappe.delete_doc(
        doctype,
        name,
        ignore_permissions=True,
        ignore_missing=True,
        delete_permanently=True
    )