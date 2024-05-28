# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Item]
def get_type_accounts(type_name: str, defs: dict=None):
    from .cache import get_cache
    
    dt = "Expense Type"
    key = f"{type_name}-expense-accounts"
    data = get_cache(dt, key)
    if data:
        return data
    
    raw = get_type_accounts_data(type_name)
    if not raw:
        return raw
    
    from .cache import set_cache
    
    data = []
    exists = []
    for i in range(len(raw)):
        v = raw.pop(0)
        if v["company"] in exists:
            continue
        
        exists.append(v["company"])
        if defs:
            v.update(defs)
        
        data.append(v)
    
    exists.clear()
    set_cache(dt, key, data)
    return data


# [Internal]
def get_type_accounts_data(type_name: str, company: str=None):
    from .cache import get_cached_value
    
    dt = "Expense Type"
    parent = get_cached_value(dt, type_name, ["lft", "rgt"])
    if not parent:
        return None
    
    from pypika.enums import Order
    
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt)
    adoc = frappe.qb.DocType("Account")
    qry = (
        frappe.qb.from_(doc)
        .select(
            doc.company,
            doc.account,
            adoc.account_currency.as_("currency")
        )
        .inner_join(pdoc)
        .on(pdoc.name == doc.parent)
        .left_join(adoc)
        .on(adoc.name == doc.account)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == "expense_accounts")
        .where(pdoc.disabled == 0)
        .where(pdoc.lft.lte(parent.lft))
        .where(pdoc.rgt.gte(parent.rgt))
        .orderby(pdoc.rgt - pdoc.lft, order=Order.asc)
    )
    if company:
        qry = qry.where(doc.company == company)
        qry = qry.limit(1)
    
    data = qry.run(as_dict=True)
    if not data or not isinstance(data, list):
        return None if company else []
    
    return data.pop(0) if company else data


# [Item]
def query_items_with_company_account(company: str):
    dt = "Expense Item"
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt).as_("parent")
    return (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .distinct()
        .inner_join(pdoc)
        .on(pdoc.name == doc.parent)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == "expense_accounts")
        .where(doc.company == company)
        .where(pdoc.disabled == 0)
    )


# [Item]
def get_item_company_account_data(parent: str, company: str):
    dt = "Expense Item"
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt)
    adoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            pdoc.uom,
            doc.account,
            adoc.account_currency.as_("currency"),
            doc.cost,
            doc.min_cost,
            doc.max_cost,
            doc.qty,
            doc.min_qty,
            doc.max_qty
        )
        .inner_join(pdoc)
        .on(pdoc.name == doc.parent)
        .inner_join(adoc)
        .on(adoc.name == doc.account)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == "expense_accounts")
        .where(doc.parent == parent)
        .where(doc.company == company)
        .limit(1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    from frappe.utils import flt
    
    data = data.pop(0)
    for k in ["cost", "qty"]:
        for x in [k, f"min_{k}", f"max_{k}"]:
            data[x] = flt(data[x])
            if data[x] < 0.0:
                data[x] = 0.0
    
    return data


# [E Entry, Entry]
def get_account_currency(account: str):
    return frappe.db.get_value("Account", account, "account_currency")


# [E Entry, Internal]
def get_accounts_currencies(accounts: list):
    doc = frappe.qb.DocType("Account")
    cdoc = frappe.qb.DocType("Currency")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.name,
            doc.account_currency
        )
        .inner_join(cdoc)
        .on(cdoc.name == doc.account_currency)
        .where(doc.name.isin(accounts))
        .where(cdoc.enabled == 1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    return {v["name"]:v["account_currency"] for v in data}