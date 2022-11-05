ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe

from .attachment import get_attachments_by_parents
from .common import parse_json_if_valid, log_error, get_cached_doc
from .search import filter_search, prepare_data


_EXPENSE = "Expense"


## Expense Item
def expenses_of_item_exists(item):
    return frappe.db.exists(_EXPENSE, {"expense_item": item})


## Expense Form
## Expense List
## Expense Entry Form
@frappe.whitelist()
def has_hrm():
    dt = "DocType"
    has_employee = frappe.db.exists(dt, "Employee")
    has_claim = frappe.db.exists(dt, "Expense Claim")
    return 1 if has_employee and has_claim else 0


## Expense List
@frappe.whitelist(methods=["POST"])
def add_expense(data):
    if data:
        data = parse_json_if_valid(data)
    
    if not data or not isinstance(data, dict):
        return 0
    
    try:
        (frappe.new_doc(_EXPENSE)
            .update(data)
            .insert(ignore_permissions=True, ignore_mandatory=True))
    except Exception as exc:
        log_error(exc)
        return 0
    
    return 1


## Expenses Request
def is_expenses_belongs_to_company(names, company):
    if (
        not names or not isinstance(names, list) or
        not company or not isinstance(company, str)
    ):
        return False
    
    data = frappe.get_all(
        _EXPENSE,
        fields=["name"],
        filters={
            "name": ["in", names],
            "company": company,
            "docstatus": ["!=", 2],
        },
        pluck="name"
    )
    
    return len(data) == len(names)


## Expenses Request Form
@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def search_company_expenses(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    if not filters or not isinstance(filters.get("company"), str):
        return []
    
    doc = frappe.qb.DocType(_EXPENSE)
    qry = (frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.expense_item,
            doc.description,
            doc.total,
            doc.is_advance,
            doc.required_by
        )
        .where(doc.company == filters.get("company"))
        .where(doc.is_requested == 0)
        .where(doc.docstatus != 2))
    
    qry = filter_search(doc, qry, _EXPENSE, txt, doc.name, "name")
    
    if (existing := filters.get("existing")):
        existing = parse_json_if_valid(existing)
        
        if existing and isinstance(existing, list):
            qry = qry.where(doc.name.notin(existing))
    
    if (date := filters.get("date")):
        if isinstance(date, str):
            qry = qry.where(doc.required_by.lte(date))
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, "name", txt, as_dict)
    
    return data


## Expenses Request
def reserve_request_expenses(expenses):
    doc = frappe.qb.DocType(_EXPENSE)
    (
        frappe.qb.update(doc)
        .set(doc.is_requested, 1)
        .where(doc.name.isin(expenses))
        .where(doc.is_requested == 0)
        .where(doc.docstatus != 2)
    ).run()


## Expenses Request
def release_request_expenses(expenses):
    doc = frappe.qb.DocType(_EXPENSE)
    (
        frappe.qb.update(doc)
        .set(doc.is_requested, 0)
        .set(doc.is_approved, 0)
        .where(doc.name.isin(expenses))
        .where(doc.is_requested == 1)
        .where(doc.docstatus != 2)
    ).run()


## Expenses Request
def approve_request_expenses(expenses):
    doc = frappe.qb.DocType(_EXPENSE)
    (
        frappe.qb.update(doc)
        .set(doc.is_approved, 1)
        .where(doc.name.isin(expenses))
        .where(doc.is_requested == 1)
        .where(doc.is_approved == 0)
        .where(doc.docstatus != 2)
    ).run()


## Self Request
def get_expenses_data(expenses):
    doc = frappe.qb.DocType(_EXPENSE)
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
        .where(doc.name.isin(expenses))
        .where(doc.is_requested == 1)
        .where(doc.docstatus != 2)
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        error(_("Unable to get the data of the expenses"))
    
    if (attachments := get_attachments_by_parents(
        [v["name"] for v in data],
        _EXPENSE,
        "attachments"
    )):
        for i in range(len(data)):
            if data[i]["name"] in attachments:
                data[i]["attachments"] = attachments.get(data[i]["name"])
    
    return data


# Expenses Request Expense
def get_expense(name):
    return get_cached_doc(_EXPENSE, name).as_dict()