# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import cstr

from .cache import (
    get_cache,
    set_cache,
    get_cached_value
)
from .account import get_item_company_account_data
from .search import (
    filter_search,
    prepare_data
)
from .type import (
    type_accounts,
    get_type_company_account_data,
    get_types_filter_query
)


## [Account, Check, Install, Internal]
__ITEM__ = "Expense Item"


# [Item Form]
@frappe.whitelist(methods=["POST"])
def get_type_accounts(type_name):
    data = type_accounts(type_name)
    if not data:
        return 0
    
    ret = {}
    for v in data:
        ret[v["company"]] = {
            "account": v["account"],
            "currency": v["currency"]
        }
    
    return ret


## [Expense]
def get_item_company_account(item: str, company: str):
    key = f"{item}-{company}-account-data"
    cache = get_cache(__ITEM__, key)
    if cache and isinstance(cache, dict):
        return cache
    
    expense_type = get_cached_value(__ITEM__, item, "expense_type")
    if not expense_type:
        return {}
    
    valid = True
    default = {
        "cost": 0.0,
        "min_cost": 0.0,
        "max_cost": 0.0,
        "qty": 0.0,
        "min_qty": 0.0,
        "max_qty": 0.0
    }
    if (data := get_type_company_account_data(cstr(expense_type), company)):
        if (item_data := get_item_company_account_data(item, company)):
            data.update(item_data)
        else:
            data.update(default)
    
    else:
        valid = False
        data = frappe._dict({"account": "", "currency": ""})
        data.update(default)
        
        if (acc := get_cached_value("Company", company, "default_expense_account")):
            if (cur := get_cached_value("Account", cstr(acc), "account_currency")):
                data.update({
                    "account": cstr(acc),
                    "currency": cstr(cur)
                })
                valid = True
    
    if valid:
        set_cache(__ITEM__, key, data)
    
    return data


# [Exoense Form]
@frappe.whitelist()
def search_items(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    doc = frappe.qb.DocType(__ITEM__)
    qry = (frappe.qb.from_(doc)
        .select(doc.name)
        .where(doc.disabled == 0)
        .where(doc.expense_type.isin(get_types_filter_query())))
    
    qry = filter_search(doc, qry, __ITEM__, txt, doc.name, "name")
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, __ITEM__, "name", txt, as_dict)
    
    return data