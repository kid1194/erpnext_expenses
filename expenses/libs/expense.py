# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [EXP Expense, Internal]
ExpenseStatus = frappe._dict({
    "Draft": "Draft",
    "Pending": "Pending",
    "Requested": "Requested",
    "Approved": "Approved",
    "Rejected": "Rejected",
    "Cancelled": "Cancelled"
})


# [EXP Expense, EXP Expense Form]
@frappe.whitelist(methods=["POST"])
def item_expense_data(item, company):
    if (
        not item or not isinstance(item, str) or
        not company or not isinstance(company, str)
    ):
        return {}
    
    from .item import get_item_company_account
    
    return get_item_company_account(item, company)


# [EXP Expense Form]
@frappe.whitelist()
def expense_form_setup():
    return {
        "is_moderator": is_expense_moderator(),
        "has_expense_claim": has_expense_claim()
    }


# [EXP Expense, Internal]
def is_expense_moderator():
    return 1 if "Expense Moderator" in frappe.get_roles() else 0


# [EXP Expense, Internal]
def has_expense_claim():
    from .check import can_use_expense_claim
    
    return 1 if can_use_expense_claim() else 0


# [EXP Entry, EXP Expense]
def is_valid_claim(expense_claim: str, paid_by: str, company: str):
    from .check import expense_claim_exists
    
    return expense_claim_exists(expense_claim, {
        "employee": paid_by,
        "company": company,
        "is_paid": 1,
        "status": "Paid",
        "docstatus": 1
    })


# [EXP Expense]
def expense_requests_exists(name: str):
    from .request_details import get_expense_requests
    
    return 1 if get_expense_requests(name) else 0


# [EXP Expense]
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
    enqueue_expenses_status_change(names, ExpenseStatus.Requested)


# [Request]
def set_expenses_approved(names: list):
    enqueue_expenses_status_change(names, ExpenseStatus.Approved)


# [Request]
def set_expenses_rejected(names: list):
    enqueue_expenses_status_change(names, ExpenseStatus.Rejected)


# [Request]
def get_expenses(names: list):
    from pypika.terms import Criterion
    
    dt = "Expense"
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
        .where(doc.status.isin([ExpenseStatus.Pending, ExpenseStatus.Requested]))
        #.where(doc.owner == frappe.session.user)
        .where(doc.docstatus == 1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return {"error": _("Unable to get the expenses data.")}
    
    from .attachment import get_files_by_parents
    
    attachments = get_files_by_parents([v["name"] for v in data], dt, "attachments")
    if attachments:
        for v in data:
            if v["name"] in attachments:
                v["attachments"] = attachments[v["name"]]
    
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
        .where(doc.status == ExpenseStatus.Pending)
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
        is_job_running,
        enqueue_job
    )
    
    key = uuid_key([names, status])
    job_name = f"exp-set-expenses-status-{key}"
    if not is_job_running(job_name):
        enqueue_job(
            "expenses.libs.expense.set_expenses_status",
            job_name,
            names=names,
            status=status
        )


# [Internal]
def set_expenses_status(names: list, status: str):
    from .check import expense_exists
    
    for name in names:
        if expense_exists(name):
            doc = frappe.get_doc("Expense", name)
            if status == ExpenseStatus.Requested:
                doc.request()
            elif status == ExpenseStatus.Approved:
                doc.approve()
            elif status == ExpenseStatus.Rejected:
                doc.reject()
            elif status == "restore":
                doc.restore()