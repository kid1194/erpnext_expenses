# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import has_common

from .cache import get_cached_doc
from .common import parse_json


# [EXP Request, Internal]
RequestStatus = frappe._dict({
    "Draft": "Draft",
    "Pending": "Pending",
    "Cancelled": "Cancelled",
    "Approved": "Approved",
    "Rejected": "Rejected",
    "Processed": "Processed"
})


# [EXP Request]
def is_company_expenses(expenses: list, company: str):
    from .expense import get_expenses_for_company
    
    data = get_expenses_for_company(expenses, company)
    if not data or len(data) != len(expenses):
        return False
    
    return True


# [EXP Request]
def is_request_amended(name: str):
    from .check import get_count
    
    return get_count("Expenses Request", {"amended_from": name}) > 0


# [EXP Request]
def restore_expenses(expenses: list):
    from .expense import set_expenses_restored
    
    set_expenses_restored(expenses)


# [EXP Request]
def request_expenses(expenses: list):
    from .expense import set_expenses_requested
    
    set_expenses_requested(expenses)


# [EXP Request]
def approve_expenses(expenses: list):
    from .expense import set_expenses_approved
    
    set_expenses_approved(expenses)


# [EXP Request]
def reject_expenses(expenses: list):
    from .expense import set_expenses_rejected
    
    set_expenses_rejected(expenses)


# [EXP Request Form]
@frappe.whitelist()
def request_form_setup():
    return {
        "is_moderator": is_request_moderator(),
        "is_reviewer": is_request_reviewer()
    }


# [EXP Request, Internal]
def is_request_moderator():
    return 1 if "Expenses Request Moderator" in frappe.get_roles() else 0


# [EXP Request, Internal]
def is_request_reviewer():
    return 1 if "Expenses Request Reviewer" in frappe.get_roles() else 0


# [EXP Request Form]
@frappe.whitelist(methods=["POST"])
def get_expenses_data(expenses):
    expenses = parse_json(expenses)
    if not expenses or not isinstance(expenses, list):
        return []
    
    expense = [v for v in expenses if v and isinstance(v, str)]
    if not expenses:
        return []
    
    from .expense import get_expenses
    
    return get_expenses(expenses)


# [EXP Request Form]
@frappe.whitelist()
def search_company_expenses(
    doctype, txt, searchfield, start, page_len, filters, as_dict=False
):
    if (
        not filters or
        not getattr(filters, "company", "") or
        not isinstance(filters.get("company"), str)
    ):
        return []
    
    company = filters.get("company")
    existing = None
    date = None
    if (
        getattr(filters, "existing", "") and
        isinstance(filters.get("existing"), (str, list))
    ):
        existing = filters.get("existing")
        existing = parse_json(existing)
        if existing and isinstance(existing, list):
            existing = [v for v in existing if v and isinstance(v, str)]
        else:
            existing = None
    
    if (
        getattr(filters, "date", "") and
        isinstance(filters.get("date"), str)
    ):
        date = filters.get("date")
    
    if not txt or not isinstance(txt, str):
        txt = None
    
    return search_expenses_by_company(
        company, txt, existing, date, as_dict
    )


# [EXP Request Form]
@frappe.whitelist(methods=["POST"])
def reject_request(name, reason):
    if (
        not name or not isinstance(name, str) or
        not isinstance(reason, str)
    ):
        return 0
    
    doc = get_cached_doc("Expenses Request", name)
    if not doc:
        return 0
    
    doc.add_comment(
        "Workflow",
        reason,
        doc.owner,
        comment_by=frappe.session.user
    )
    return 1


# [Entry]
def get_request(name: str):
    from .expense import get_expenses
    
    doc = get_cached_doc("Expenses Request", name)
    if not doc or doc.status != RequestStatus.Approved:
        return None
    
    data = doc.as_dict(
        no_nulls=False,
        no_default_fields=False,
        convert_dates_to_str=True,
        no_child_table_fields=False
    )
    data["expenses"] = get_expenses([v.expense for v in doc.expenses])
    return data


# [EXP Entry]
def process_request(name: str):
    get_cached_doc("Expenses Request", name).process(ignore_permissions=True)


# [EXP Entry]
def reject_request(name: str):
    get_cached_doc("Expenses Request", name).reject(ignore_permissions=True)