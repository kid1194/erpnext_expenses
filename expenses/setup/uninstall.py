# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Install, Internal]
def get_doctypes():
    return [
        "Expense Attachment",
        "Expense Item Account",
        "Expense Type Account",
        "Expenses Entry Details",
        "Expenses Request Details",
        "Expenses Update Receiver",
        "Expenses Entry",
        "Expenses Request",
        "Expense",
        "Expense Item",
        "Expense Type",
        "Expenses Settings"
    ]


# [Install, Hooks]
def after_uninstall():
    doctypes = get_doctypes()
    roles = [
        "Expense Supervisor",
        "Expenses Reviewer",
        
        "Expense Moderator",
        "Expenses Request Moderator",
        "Expenses Request Reviewer",
        "Expenses Entry Moderator"
    ]
    _workspace_uninstall(doctypes)
    _fixtures_uninstall(roles)
    _doctypes_uninstall(doctypes, roles)
    _fixtures_cleanup()
    frappe.clear_cache()


# [Internal]
def _workspace_uninstall(doctypes):
    try:
        dt = "Workspace"
        name = "Accounting"
        if not frappe.db.exists(dt, name):
            return 0
        
        doc = frappe.get_doc(dt, name)
        remove = []
        for v in doc.links:
            if v.link_to and v.link_to in doctypes:
                remove.append(v)
        if remove:
            for i in range(len(remove)):
                doc.links.remove(remove.pop(0))
            doc.save(ignore_permissions=True)
    except Exception:
        pass


# [Internal]
def _fixtures_uninstall(roles):
    try:
        doc = frappe.qb.DocType("Has Role")
        (
            frappe.qb.from_(doc)
            .delete()
            .where(doc.role.isin(roles))
        ).run()
    except Exception:
        pass


# [Internal]
def _doctypes_uninstall(doctypes, roles):
    from frappe.model.delete_doc import delete_doc
    
    from expenses import __module__
    
    docs = [
        ["Workspace", [__module__]],
        ["Report", ["Expenses Entry Report"]],
        ["Workflow", ["Expenses Request Review"]],
        ["Print Format", [
            "Expense",
            "Expenses Entry",
            "Expenses Request"
        ]],
        ["DocType", doctypes],
        ["Role", roles],
        ["Module Def", [__module__]]
    ]
    for v in docs:
        for name in v[1]:
            try:
                delete_doc(
                    v[0], name,
                    ignore_permissions=True,
                    ignore_missing=True,
                    ignore_on_trash=True,
                    delete_permanently=True
                )
            except Exception:
                pass


# [Internal]
def _fixtures_cleanup():
    try:
        actions = [
            "Submit",
            "Cancel",
            "Approve",
            "Reject"
        ]
        count = frappe.db.count(
            "Workflow Transition",
            {"action": ["in", actions]}
        )
        if not count:
            doc = frappe.qb.DocType("Workflow Action Master")
            (
                frappe.qb.from_(doc)
                .delete()
                .where(doc.name.isin(actions))
            ).run()
    except Exception:
        pass
    
    try:
        states = [
            "Draft",
            "Pending",
            "Cancelled",
            "Approved",
            "Rejected",
            "Processed"
        ]
        count = frappe.db.count(
            "Workflow Transition",
            {"state": ["in", states]}
        )
        if not count:
            count = frappe.doc.count(
                "Workflow Document State",
                {"state": ["in", states]}
            )
        if not count:
            doc = frappe.qb.DocType("Workflow State")
            (
                frappe.qb.from_(doc)
                .delete()
                .where(doc.name.isin(states))
            ).run()
    except Exception:
        pass