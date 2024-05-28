# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint


# [Internal]
def get_type(name: str):
    from .cache import get_cached_doc
    
    return get_cached_doc("Expense Type", name)


# [E Type]
def disable_type_descendants(lft: int, rgt: int):
    names = get_type_descendants(lft, rgt, enabled=True)
    if not names:
        return 0
    
    from .cache import clear_doc_cache
    
    dt = "Expense Type"
    doc = frappe.qb.DocType(dt)
    (
        frappe.qb.update(doc)
        .set(doc.disabled, 1)
        .where(doc.name.isin(names))
    ).run()
    for name in names:
        clear_doc_cache(dt, name)


# [E Type]
def reload_type_linked_items(lft: int, rgt: int):
    names = get_type_descendants(lft, rgt, with_self=True)
    if not names:
        return 0
    
    from .item import reload_items_of_types
    
    reload_items_of_types(names)


# [Internal]
def get_type_descendants(lft: int, rgt: int, with_self=False, enabled=False):
    dt = "Expense Type"
    filters = [
        [dt, "lft", ">=" if with_self else ">", cint(lft)],
        [dt, "rgt", "<=" if with_self else "<", cint(rgt)]
    ]
    if enabled:
        filters.append([dt, "disabled", "!=", 1])
    
    names = frappe.get_list(
        dt,
        fields=["name"],
        filters=filters,
        pluck="name",
        ignore_permissions=True,
        strict=False
    )
    if not names or not isinstance(names, list):
        return 0
    
    return names


# [E Type Form]
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
    
    from .search import (
        filter_search,
        prepare_data
    )
    
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
        .select(
            doc.name.as_("label"),
            doc.name.as_("value")
        )
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
        
        if "is_group" in filters and isinstance(filters["is_group"], int):
            qry = qry.where(doc.is_group == filters["is_group"])
        
        if filters.get("not_child_of", "") and isinstance(filters["not_child_of"], str):
            parent = get_type(filters["not_child_of"])
            if parent:
                qry = qry.where(doc.lft.lt(cint(parent.lft)))
                qry = qry.where(doc.rgt.gt(cint(parent.rgt)))
    
    data = qry.run(as_dict=as_dict)
    data = prepare_data(data, dt, "name", txt, as_dict)
    return data


# [E Type Form]
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


# [E Type Form, E Type Tree]
@frappe.whitelist(methods=["POST"])
def convert_group_to_item(name, parent_type=None):
    if (
        not name or not isinstance(name, str) or
        (parent_type and not isinstance(parent_type, str))
    ):
        return {"error": _("Arguments required to convert group to an item are invalid.")}
    
    doc = get_type(name)
    if not doc:
        return {"error": _("Expense type to be converted from a group to an item doesn't exist.")}
    
    return doc.convert_to_item(parent_type)


# [E Type Form, E Type Tree]
@frappe.whitelist(methods=["POST"])
def convert_item_to_group(name):
    if not name or not isinstance(name, str):
        return {"error": _("Arguments required to convert an item to a group are invalid.")}
    
    doc = get_type(name)
    if not doc:
        return {"error": _("Expense type to be converted from an item to a group doesn't exist.")}
    
    return doc.convert_to_group()


# [E Type Tree]
@frappe.whitelist()
def get_type_children(doctype, parent=None, is_root=False):
    if not parent:
        return [{"value": "Expense Types", "expandable": 1, "parent": ""}]
    
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
def get_types_filter_query():
    doc = frappe.qb.DocType("Expense Type")
    return (
        frappe.qb.from_(doc)
        .select(doc.name)
        .where(doc.disabled == 0)
        .where(doc.is_group == 0)
    )