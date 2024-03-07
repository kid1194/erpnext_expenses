# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint

from .cache import get_cached_doc


# [EXP Type]
def disable_type_descendants(lft, rgt):
    dt = "Expense Type"
    names = frappe.get_list(
        dt,
        fields=["name"],
        filters=[
            [dt, "disabled", "!=", 1],
            [dt, "lft", ">", cint(lft)],
            [dt, "rgt", "<", cint(rgt)]
        ],
        pluck="name",
        ignore_permissions=True,
        strict=False
    )
    if names and isinstance(names, list):
        doc = frappe.qb.DocType(dt)
        (
            frappe.qb.update(doc)
            .set(doc.disabled, 1)
            .where(doc.name.isin(names))
        ).run()
        
        from .cache import clear_doc_cache
        
        for name in names:
            clear_doc_cache(dt, name)


# [EXP Type Form]
@frappe.whitelist()
def search_types(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    if filters:
        from .common import parse_json
        
        filters = parse_json(filters)
    
    if not filters or not isinstance(filters, dict):
        filters = {}
    
    filters["is_group"] = 1
    
    return query_types(txt, filters, start, page_len, as_dict)


# [Item, Internal]
def query_types(txt, filters, start, page_len, as_dict=False):
    from pypika.functions import IfNull
    from pypika.terms import Criterion
    
    from .search import filter_search, prepare_data
    
    dt = "Expense Type"
    fdoc = frappe.qb.DocType(dt).as_("parent")
    fqry = (
        frappe.qb.from_(fdoc)
        .select(fdoc.name)
        .where(fdoc.disabled == 0)
        .where(fdoc.is_group == 1)
    )
    
    doc = frappe.qb.DocType(dt)
    qry = (
        frappe.qb.from_(doc)
        .select(doc.name, doc.name.as_("label"))
        .where(doc.disabled == 0)
        .where(Criterion.any([
            IfNull(doc.parent_type, "") == "",
            doc.parent_type.isin(fqry)
        ]))
    )
    qry = filter_search(doc, qry, dt, txt, doc.name, "name")
    
    if filters:
        if filters.get("is_not", "") and isinstance(filters["is_not"], str):
            qry = qry.where(doc.name != filters["is_not"])
        
        if "is_group" in filters:
            qry = qry.where(doc.is_group == cint(filters["is_group"]))
        
        if (
            filters.get("not_child_of", "") and
            isinstance(filters["not_child_of"], str)
        ):
            from .cache import get_cached_value
            
            parent = get_cached_value(dt, filters["not_child_of"], ["lft", "rgt"])
            if parent:
                qry = qry.where(doc.lft.lt(cint(parent.lft)))
                qry = qry.where(doc.rgt.gt(cint(parent.rgt)))
        
        if cint(filters.get("has_accounts", 0)):
            from .account import filter_types_with_accounts
            
            qry = filter_types_with_accounts(qry, doc)
    
    data = qry.run(as_dict=as_dict)
    data = prepare_data(data, dt, "name", txt, as_dict)
    return data


# [EXP Type Form]
@frappe.whitelist()
def get_companies_accounts():
    dt = "Company"
    return frappe.get_list(
        dt,
        fields=[
            "name as company",
            "default_expense_account as account"
        ],
        filters=[[dt, "is_group", "=", 0]],
        ignore_permissions=True,
        strict=False
    )


# [EXP Type Form, EXP Type Tree]
@frappe.whitelist(methods=["POST"])
def convert_group_to_item(name, parent_type=None):
    if (
        not name or not isinstance(name, str) or
        (parent_type and not isinstance(parent_type, str))
    ):
        return 0
    
    doc = get_cached_doc("Expense Type", name)
    if not doc:
        return {"error": _("The expense type does not exist.")}
    
    return doc.convert_group_to_item(parent_type);


# [EXP Type Form, EXP Type Tree]
@frappe.whitelist(methods=["POST"])
def convert_item_to_group(name):
    if not name or not isinstance(name, str):
        return 0
    
    doc = get_cached_doc("Expense Type", name)
    if not doc:
        return {"error": _("The expense type does not exist.")}
    
    return doc.convert_item_to_group();


# [EXP Type Tree]
@frappe.whitelist()
def get_type_children(doctype, parent, is_root=False):
    return frappe.get_list(
        "Expense Type",
        fields=[
            "name as value",
            "is_group as expandable",
            "parent_type as parent"
        ],
        filters=[
            ["docstatus", "=", 0],
            [
                "ifnull(`parent_type`,\"\")",
                "=",
                "" if is_root else parent
            ]
        ],
        ignore_permissions=True,
        strict=False
    )


# [Item]
def get_type_company_account(name: str, company: str):
    from .cache import get_cache, set_cache
    
    dt = "Expense Type"
    key = f"{name}-{company}-account-data"
    cache = get_cache(dt, key)
    if cache and isinstance(cache, dict):
        return cache
    
    from .account import get_type_company_account_data
    
    data = get_type_company_account_data(name, company)
    if not (data is None):
        set_cache(dt, key, data)
    
    return data


# [Item]
def get_types_filter_query():
    dt = "Expense Type"
    doc = frappe.qb.DocType(dt)
    return (
        frappe.qb.from_(doc)
        .select(doc.name)
        .where(doc.disabled == 0)
        .where(doc.is_group == 0)
    )