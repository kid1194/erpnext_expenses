# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [E Expense, Internal]
ExpenseStatus = frappe._dict({
    "d": "Draft",
    "p": "Pending",
    "r": "Requested",
    "a": "Approved",
    "j": "Rejected",
    "c": "Cancelled"
})


# [E Expense, E Expense Form]
@frappe.whitelist(methods=["POST"])
def item_expense_data(item, company):
    if (
        not item or not isinstance(item, str) or
        not company or not isinstance(company, str)
    ):
        return {}
    
    from .item import get_item_company_account
    
    return get_item_company_account(item, company)


# [E Expense, Internal]
def is_expense_moderator():
    return 1 if "Expense Moderator" in frappe.get_roles() else 0


# [E Entry, E Expense, Entry, Internal]
def has_expense_claim():
    from .check import can_use_expense_claim
    
    return 1 if can_use_expense_claim() else 0


# [E Entry, E Expense, Entry, Internal]
def expense_claim_reqd_if_paid():
    from .system import settings
    
    return 1 if settings()._reqd_expense_claim_if_paid else 0


# [E Expense Form]
@frappe.whitelist()
def expense_form_setup():
    has_claim = has_expense_claim()
    return {
        "is_moderator": is_expense_moderator(),
        "has_expense_claim": has_claim,
        "expense_claim_reqd": expense_claim_reqd_if_paid() if has_claim else 0
    }


# [E Expense]
def is_valid_claim(expense_claim: str, paid_by: str, company: str):
    from .check import expense_claim_exists
    
    return expense_claim_exists(expense_claim, {
        "employee": paid_by,
        "company": company,
        "is_paid": 1,
        "status": "Paid",
        "docstatus": 1
    })


# [E Expense]
def expense_requests_exists(name: str):
    from .request_details import get_expense_requests
    
    return 1 if get_expense_requests(name) else 0


# [E Expense]
def expense_entries_exists(name: str):
    from .entry_details import get_expense_entries
    
    return 1 if get_expense_entries(name) else 0


# [Request]
def get_expenses_for_company(names: list, company: str):
    dt = "Expense"
    return frappe.get_all(
        dt,
        fields=["name"],
        filters=[
            [dt, "name", ["in", names]],
            [dt, "company", company],
            [dt, "docstatus", 1]
        ],
        pluck="name",
        ignore_permissions=True,
        strict=False
    )


# [Request]
def set_expenses_restored(names: list):
    enqueue_expenses_status_change(names, "restore")


# [Request]
def set_expenses_requested(names: list):
    enqueue_expenses_status_change(names, ExpenseStatus.r)


# [Request]
def set_expenses_approved(names: list):
    enqueue_expenses_status_change(names, ExpenseStatus.a)


# [Request]
def set_expenses_rejected(names: list):
    enqueue_expenses_status_change(names, ExpenseStatus.j)


# [Request]
def get_expenses(names: list):
    from .background import uuid_key
    from .cache import get_cache
    
    dt = "Expense"
    key = uuid_key(names)
    data = get_cache(dt, key)
    if data and isinstance(data, list):
        return data
    
    doc = frappe.qb.DocType(dt)
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.company,
            doc.expense_account,
            doc.required_by,
            doc.description,
            doc.currency,
            doc.total,
            doc.is_paid,
            doc.paid_by,
            doc.is_advance,
            doc.party_type,
            doc.party,
            doc.project
        )
        .where(doc.name.isin(names))
        .where(doc.status.isin([ExpenseStatus.p, ExpenseStatus.r]))
        .where(doc.docstatus == 1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        from frappe import _
        
        return {"error": _("Unable to get the expenses data.")}
    
    from .attachment import get_files_by_parents
    
    attachments = get_files_by_parents([v["name"] for v in data], dt, "attachments")
    if attachments:
        for v in data:
            if v["name"] in attachments:
                v["attachments"] = attachments[v["name"]]
    
    from .cache import set_cache
    
    set_cache(dt, key, data)
    return data


# [Request]
def search_expenses_by_company(company, filters, search=None, as_dict=False):
    from .search import filter_search, prepare_data
    
    dt = "Expense"
    doc = frappe.qb.DocType(dt)
    qry = (
        frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.expense_item,
            doc.description,
            doc.total,
            doc.is_advance,
            doc.required_by
        )
        .where(doc.company == company)
        .where(doc.status == ExpenseStatus.p)
        .where(doc.docstatus == 1)
    )
    qry = filter_search(doc, qry, dt, search, doc.name, "name")
    if "ignored" in filters:
        qry = qry.where(doc.name.notin(filters["ignored"]))
    if "max_date" in filters:
        qry = qry.where(doc.required_by.lte(filters["max_date"]))
    if "owner" in filters:
        qry = qry.where(doc.owner == filters["owner"])
    data = qry.run(as_dict=as_dict)
    data = prepare_data(data, dt, "name", search, as_dict)
    return data


# [Internal]
def enqueue_expenses_status_change(names: list, status: str):
    from .background import (
        uuid_key,
        is_job_running
    )
    
    key = uuid_key([names, status])
    job_name = f"exp-set-expenses-status-{key}"
    if not is_job_running(job_name):
        from .background import enqueue_job
        
        enqueue_job(
            "expenses.libs.expense.set_expenses_status",
            job_name,
            timeout=len(names) * 5,
            names=names,
            status=status
        )


# [Internal]
def set_expenses_status(names: list, status: str):
    from .check import expense_exists
    
    for name in names:
        if expense_exists(name):
            doc = frappe.get_doc("Expense", name)
            if status == ExpenseStatus.r:
                doc.request()
            elif status == ExpenseStatus.a:
                doc.approve()
            elif status == ExpenseStatus.j:
                doc.reject()
            elif status == "restore":
                doc.restore()


# [E Entry]
def get_expenses_data(names: list, company: str):
    from .background import uuid_key
    from .cache import get_cache
    
    dt = "Expense"
    key = uuid_key([names, company])
    data = get_cache(dt, key)
    if data and isinstance(data, dict):
        return data
    
    doc = frappe.qb.DocType(dt)
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.expense_account,
            doc.required_by,
            doc.description,
            doc.currency,
            doc.total,
            doc.is_advance,
            doc.is_paid,
            doc.paid_by,
            doc.expense_claim,
            doc.party_type,
            doc.party,
            doc.project
        )
        .where(doc.name.isin(names))
        .where(doc.company == company)
        .where(doc.status == ExpenseStatus.a)
        .where(doc.docstatus == 1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return {}
    
    from frappe.utils import cint, flt
    
    ret = {}
    str_keys = [
        "expense_account", "required_by",
        "description", "currency",
        "paid_by", "party_type",
        "party", "expense_claim", "project"
    ]
    int_keys = ["is_advance", "is_paid"]
    for v in data:
        for k in str_keys:
            if not v[k]:
                v[k] = None
        
        for k in int_keys:
            v[k] = 1 if cint(v[k]) > 0 else 0
        
        v["account"] = v.pop("expense_account")
        v["account_currency"] = v.pop("currency")
        v["cost_in_account_currency"] = flt(v.pop("total"))
        ret[v.pop("name")] = v
    
    from .cache import set_cache
    
    set_cache(dt, key, ret)
    return ret