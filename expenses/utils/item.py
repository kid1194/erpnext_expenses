# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe

from .account import get_company_account_data_by_parent
from .cache import (
    get_cache,
    set_cache,
    get_cached_value
)
from .search import (
    filter_search,
    prepare_data
)
from .type import (
    get_types_filter_query,
    get_type_company_account_data
)


## Expense Type
def items_of_expense_type_exists(expense_type):
    return frappe.db.exists("Expense Item", {"expense_type": expense_type})


## Expense Form
## Expense List
@frappe.whitelist()
def search_items(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    dt = "Expense Item"
    doc = frappe.qb.DocType(dt)
    qry = (frappe.qb.from_(doc)
        .select(doc.name)
        .where(doc.disabled == 0))
    
    qry = filter_search(doc, qry, dt, txt, doc.name, "name")
    
    type_qry = get_types_filter_query()
    qry = qry.where(doc.expense_type.isin(type_qry))
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, dt, "name", txt, as_dict)
    
    return data


## Expense Form
## Expense List
## Expense
@frappe.whitelist(methods=["POST"])
def get_item_company_account_data(item, company):
    if (
        not item or not isinstance(item, str) or
        not company or not isinstance(company, str)
    ):
        return {}
    
    ckey = f"{item}-{company}-accounts-data"
    dt = "Expense Item"
    cache = get_cache(dt, ckey)
    if cache and isinstance(cache, dict):
        return cache
    
    if not frappe.db.exists(dt, item):
        return {}
    
    expense_type = get_cached_value(dt, item, "expense_type")
    if (data := get_type_company_account_data(expense_type, company)):
        if (item_data := get_company_account_data_by_parent(
            company,
            item,
            dt,
            "expense_accounts"
        )):
            if isinstance(item_data, dict):
                for k, v in item_data.items():
                    if v:
                        data[k] = v
    
    else:
        account = ""
        currency = ""
        
        if frappe.db.exists("Company", company):
            account = get_cached_value("Company", company, "default_expense_account")
        if account and frappe.db.exists("Account", account):
            currency = get_cached_value("Account", account, "account_currency")
        
        data = frappe._dict({
            "account": account,
            "currency": currency,
            "cost": 0.0,
            "min_cost": 0.0,
            "max_cost": 0.0,
            "qty": 0.0,
            "min_qty": 0.0,
            "max_qty": 0.0,
        })
    
    set_cache(dt, ckey, data)
    
    return data