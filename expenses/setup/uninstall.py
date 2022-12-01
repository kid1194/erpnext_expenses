# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from expenses.utils.common import clear_document_cache
from expenses.utils.doctypes import _REQUEST, _ENTRY


def before_uninstall():
    clear_document_cache(_ENTRY)
    eDoc = frappe.qb.DocType(_ENTRY)
    (
        frappe.qb.update(eDoc)
        .set(eDoc.docstatus, 2)
        .where(eDoc.docstatus == 1)
    ).run()
    
    clear_document_cache(_REQUEST)
    rDoc = frappe.qb.DocType(_REQUEST)
    (
        frappe.qb.update(rDoc)
        .set(rDoc.docstatus, 2)
        .where(rDoc.docstatus == 1)
    ).run()


def after_uninstall():
    data = {
        "Role": "Expenses Reviewer",
        "Workflow": "Expenses Request Review",
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
            "Reject"
        ],
    }
    for doctype, name in data.items():
        if isinstance(name, list):
            for doc_name in name:
                delete_doc(doctype, doc_name)
        else:
            delete_doc(doctype, name)


def delete_doc(doctype, name):
    frappe.delete_doc(
        doctype,
        name,
        force=True,
        ignore_permissions=True,
        ignore_on_trash=True,
        ignore_missing=True,
        delete_permanently=True
    )