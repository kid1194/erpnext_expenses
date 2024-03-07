# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import cstr


# [EXP Item Form]
@frappe.whitelist()
def search_item_types(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    if filters:
        from .common import parse_json
        
        filters = parse_json(filters)
    
    if not filters or not isinstance(filters, dict):
        filters = {}
    
    from .type import query_types
    
    filters["is_group"] = 0
    filters["has_accounts"] = 1
    return query_types(txt, filters, start, page_len, as_dict)


# [EXP Item, EXP Item Form]
@frappe.whitelist(methods=["POST"])
def get_type_accounts_list(type_name):
    if not type_name or not isinstance(type_name, str):
        return None
    
    from .account import get_type_accounts
    
    data = get_type_accounts(type_name, {
        "cost": 0.0,
        "min_cost": 0.0,
        "max_cost": 0.0,
        "qty": 0.0,
        "min_qty": 0.0,
        "max_qty": 0.0
    })
    return data if not (data is None) else 0


# [Expense]
def get_item_company_account(item: str, company: str):
    from .cache import (
        get_cached_value,
        get_cache,
        set_cache
    )
    
    dt = "Expense Item"
    key = f"{item}-{company}-account-data"
    cache = get_cache(dt, key)
    if cache and isinstance(cache, dict):
        return cache
    
    from .account import get_item_company_account_data
    
    data = get_item_company_account_data(item, company)
    if not data:
        expense_type = get_cached_value(dt, item, "expense_type")
        if not expense_type:
            return {}
        
        from .type import get_type_company_account_data
        
        data = get_type_company_account_data(cstr(expense_type), company)
        if not data:
            return {}
        
        data.update({
            "cost": 0.0,
            "min_cost": 0.0,
            "max_cost": 0.0,
            "qty": 0.0,
            "min_qty": 0.0,
            "max_qty": 0.0
        })
    
    set_cache(dt, key, data)
    return data


# [EXP Exoense Form]
@frappe.whitelist()
def search_items(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    if filters:
        from .common import parse_json
        
        filters = parse_json(filters)
    
    if (
        not filters or not isinstance(filters, dict) or
        not filters.get("company", "") or
        not isinstance(filters["company"], str)
    ):
        return []
    
    from .account import get_items_with_company_account_query
    from .search import filter_search, prepare_data
    from .type import get_types_filter_query
    
    dt = "Expense Item"
    doc = frappe.qb.DocType(dt)
    qry = (
        frappe.qb.from_(doc)
        .select(doc.name, doc.name.as_("label"))
        .where(doc.disabled == 0)
        .where(doc.name.isin(get_items_with_company_account_query(filters["company"])))
        .where(doc.expense_type.isin(get_types_filter_query()))
    )
    qry = filter_search(doc, qry, dt, txt, doc.name, "name")
    data = qry.run(as_dict=as_dict)
    data = prepare_data(data, dt, "name", txt, as_dict)
    return data