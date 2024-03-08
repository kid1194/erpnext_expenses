# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from pypika.enums import Order

import frappe
from frappe.utils import flt


# [Internal]
__FIELD__ = "expense_accounts"


# [Type]
def filter_types_with_accounts(qry, doc):
    from pypika.functions import IfNull
    
    from frappe.query_builder.functions import Count
    
    dt = "Expense Type"
    pdoc = frappe.qb.DocType(dt)
    adoc = frappe.qb.DocType(f"{dt} Account")
    fqry = (
        frappe.qb.from_(adoc)
        .select(Count(adoc.parent))
        .where(adoc.parent == pdoc.name)
        .where(adoc.parenttype == dt)
        .where(adoc.parentfield == __FIELD__)
        .limit(1)
    )
    data = (
        frappe.qb.from_(pdoc)
        .select(pdoc.lft, pdoc.rgt)
        .where(pdoc.disabled == 0)
        .where(IfNull(fqry, 0) > 0)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return qry
    
    from pypika.terms import Criterion
        
    filters = []
    for v in data:
        filters.append(Criterion.all([
            doc.lft.gte(v["lft"]),
            doc.rgt.lte(v["rgt"])
        ]))
    
    return qry.where(Criterion.any(filters))


# []
def get_types_with_accounts():
    from .cache import get_cache, set_cache
    
    dt = "Expense Type"
    key = "types-with-expense-accounts"
    data = get_cache(dt, key)
    if data and isinstance(data, list):
        return data
    
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt)
    data = (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .distinct()
        .left_join(pdoc)
        .on(pdoc.name == doc.parent)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == __FIELD__)
        .where(pdoc.disabled == 0)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    data = [v["parent"] for v in data]
    set_cache(dt, key, data)
    return data


# [Item]
def get_type_accounts(type_name: str, defs: dict=None):
    from .cache import (
        get_cached_value,
        get_cache,
        set_cache
    )
    
    dt = "Expense Type"
    key = f"{type_name}-expense-accounts"
    data = get_cache(dt, key)
    if data and isinstance(data, list):
        return data
    
    type_data = get_cached_value(dt, type_name, ["lft", "rgt"])
    
    fdoc = frappe.qb.DocType(dt).as_("parent")
    fqry = (
        frappe.qb.from_(fdoc)
        .select(fdoc.name)
        .where(fdoc.lft.lte(type_data.lft))
        .where(fdoc.rgt.gte(type_data.rgt))
    )
    
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt)
    adoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.company,
            doc.account,
            adoc.account_currency.as_("currency")
        )
        .left_join(pdoc)
        .on(pdoc.name == doc.parent)
        .inner_join(adoc)
        .on(adoc.name == doc.account)
        .where(doc.parent.isin(fqry))
        .where(doc.parenttype == dt)
        .where(doc.parentfield == __FIELD__)
        .orderby(pdoc.rgt - pdoc.lft, order=Order.desc)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    exists = []
    for v in data:
        if v["company"] in exists:
            data.remove(v)
        else:
            if defs:
                v.update(defs)
            exists.append(v["company"])
    
    set_cache(dt, key, data)
    return data


# [Type]
def get_type_company_account_data(parent: str, company: str):
    from .cache import get_cached_value
    
    dt = "Expense Type"
    type_data = get_cached_value(dt, parent, ["lft", "rgt"])
    
    fdoc = frappe.qb.DocType(dt).as_("parent")
    fqry = (
        frappe.qb.from_(fdoc)
        .select(fdoc.name)
        .where(fdoc.disabled == 0)
        .where(fdoc.lft.lte(type_data.lft))
        .where(fdoc.rgt.gte(type_data.rgt))
    )
    
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt)
    adoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.account,
            adoc.account_currency.as_("currency")
        )
        .left_join(pdoc)
        .on(pdoc.name == doc.parent)
        .inner_join(adoc)
        .on(adoc.name == doc.account)
        .where(doc.parent.isin(fqry))
        .where(doc.company == company)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == __FIELD__)
        .orderby(pdoc.lft, order=Order.desc)
        .limit(1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    return data.pop(0)


# [Item]
def get_items_with_company_account_query(company):
    dt = "Expense Item"
    doc = frappe.qb.DocType(f"{dt} Account")
    pdoc = frappe.qb.DocType(dt).as_("parent")
    return (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .distinct()
        .left_join(pdoc)
        .on(pdoc.name == doc.parent)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == __FIELD__)
        .where(doc.company == company)
        .where(pdoc.disabled == 0)
    )


# [Item]
def get_item_company_account_data(parent: str, company: str):
    dt = "Expense Item"
    doc = frappe.qb.DocType(f"{dt} Account")
    adoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.account,
            adoc.account_currency.as_("currency"),
            doc.cost,
            doc.min_cost,
            doc.max_cost,
            doc.qty,
            doc.min_qty,
            doc.max_qty
        )
        .inner_join(adoc)
        .on(adoc.name == doc.account)
        .where(doc.parent == parent)
        .where(doc.company == company)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == __FIELD__)
        .limit(1)
    ).run(as_dict=True)
    if not data or not isinstance(data, list):
        return None
    
    data = data.pop(0)
    for k in ("cost", "qty"):
        data[k] = flt(data[k])
        data["min_" + k] = flt(data["min_" + k])
        data["max_" + k] = flt(data["max_" + k])
    
    return data