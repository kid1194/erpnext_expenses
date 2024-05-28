# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [E Request, Internal]
RequestStatus = frappe._dict({
    "d": "Draft",
    "p": "Pending",
    "c": "Cancelled",
    "a": "Approved",
    "r": "Rejected",
    "e": "Processed"
})


# [Internal]
def get_request_doc(name: str):
    from .cache import get_cached_doc
    
    return get_cached_doc("Expenses Request", name)


# [E Request, Internal]
def get_filtered_company_expenses(company: str, expenses: list):
    from .expense import get_expenses_for_company
    
    data = get_expenses_for_company(expenses, company)
    if not data or not isinstance(data, list):
        return []
    
    return data


# [E Request]
def is_request_amended(name: str):
    from .check import get_count
    
    return get_count("Expenses Request", {"amended_from": name}) > 0


# [E Request]
def restore_expenses(expenses: list):
    from .expense import set_expenses_restored
    
    set_expenses_restored(expenses)


# [E Request]
def request_expenses(expenses: list):
    from .expense import set_expenses_requested
    
    set_expenses_requested(expenses)


# [E Request]
def approve_expenses(expenses: list):
    from .expense import set_expenses_approved
    
    set_expenses_approved(expenses)


# [E Request]
def reject_expenses(expenses: list):
    from .expense import set_expenses_rejected
    
    set_expenses_rejected(expenses)


# [E Request Form]
@frappe.whitelist()
def request_form_setup():
    return {
        "is_moderator": is_request_moderator(),
        "is_reviewer": is_request_reviewer()
    }


# [E Request, Internal]
def is_request_moderator():
    return 1 if "Expenses Request Moderator" in frappe.get_roles() else 0


# [E Request, Internal]
def is_request_reviewer():
    return 1 if "Expenses Request Reviewer" in frappe.get_roles() else 0


# [E Request Form]
@frappe.whitelist(methods=["POST"])
def get_expenses_data(expenses):
    from .common import json_to_list
    
    expenses = json_to_list(expenses)
    if not expenses or not isinstance(expenses, list):
        return []
    
    tmp = expenses.copy()
    for i in range(len(tmp)):
        v = tmp.pop(0)
        if not v or not isinstance(v, str):
            expenses.remove(v)
    if not expenses:
        return []
    
    from .expense import get_expenses
    
    return get_expenses(expenses)


# [E Request Form]
@frappe.whitelist()
def search_company_expenses(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    if filters:
        from .common import parse_json
        
        filters = parse_json(filters)
    
    if (
        not filters or not isinstance(filters, dict) or
        not filters.get("company", "") or
        not isinstance(filters["company"], str)
    ):
        return []
    
    company = filters.pop("company")
    if "ignored" in filters:
        tmp = filters.pop("ignored")
        if tmp and isinstance(tmp, (str, list)):
            from .common import json_to_list
            
            tmp = json_to_list(tmp)
            if tmp and isinstance(tmp, list):
                xtmp = []
                for i in range(len(tmp)):
                    v = tmp.pop(0)
                    if v and isinstance(v, str):
                        xtmp.append(v)
                
                if xtmp:
                    filters["ignored"] = xtmp
    if "max_date" in filters:
        tmp = filters.pop("max_date")
        if tmp and isinstance(tmp, str):
            filters["max_date"] = tmp
    if "owner" in filters:
        tmp = filters.pop("owner")
        if tmp and isinstance(tmp, str):
            filters["owner"] = tmp
    
    if not txt or not isinstance(txt, str):
        txt = None
    
    from .expense import search_expenses_by_company
    
    return search_expenses_by_company(company, filters, txt, as_dict)


# [E Request Form]
@frappe.whitelist(methods=["POST"])
def filter_company_expenses(company, expenses):
    from .common import json_to_list
    
    expenses = json_to_list(expenses)
    if (
        not company or not isinstance(company, str) or
        not expenses or not isinstance(expenses, list)
    ):
        return 0
    
    tmp = expenses.copy()
    for i in range(len(tmp)):
        v = tmp.pop(0)
        if not v or not isinstance(v, str):
            expenses.remove(v)
    
    if not expenses:
        return 0
    
    data = get_filtered_company_expenses(company, expenses)
    if not data:
        return 0
    
    return data


# [E Request Form]
@frappe.whitelist(methods=["POST"])
def reject_request_reason(name, reason):
    if (
        not name or not isinstance(name, str) or
        not reason or not isinstance(reason, str)
    ):
        return 0
    
    doc = get_request_doc(name)
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
    doc = get_request_doc(name)
    if not doc or doc.status != RequestStatus.a:
        return None
    
    from .expense import get_expenses
    
    data = doc.as_dict(
        no_nulls=False,
        no_default_fields=False,
        convert_dates_to_str=True,
        no_child_table_fields=False
    )
    data["expenses"] = get_expenses([v.expense for v in doc.expenses])
    return data


# [E Entry]
def process_request(name: str):
    get_request_doc(name).process(ignore_permissions=True)


# [E Entry]
def reject_request(name: str):
    get_request_doc(name).reject(ignore_permissions=True)