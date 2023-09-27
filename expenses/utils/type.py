# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint
from pypika.terms import Criterion
from pypika.enums import Order

from .account import get_company_account_data_by_parent
from .cache import (
    get_cache,
    set_cache,
    get_cached_doc
)
from .common import (
    error,
    parse_json
)
from .search import (
    filter_search,
    prepare_data
)


# Type Form
# Item Form
@frappe.whitelist()
def search_types(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    dt = "Expense Type"
    doc = frappe.qb.DocType(dt)
    qry = (frappe.qb.from_(doc)
        .select(doc.name)
        .where(doc.disabled == 0))
    
    qry = filter_search(doc, qry, dt, txt, doc.name, "name")
    
    pdoc = frappe.qb.DocType(dt).as_("parent")
    parent_qry = (frappe.qb.from_(pdoc)
        .select(pdoc.name)
        .where(pdoc.disabled == 0)
        .where(pdoc.is_group == 1)
        .where(pdoc.lft.lt(doc.lft))
        .where(pdoc.rgt.gt(doc.rgt))
        .orderby(doc.lft, order=Order.desc))
    qry = qry.where(Criterion.any([
        doc.parent_type.isnull(),
        doc.parent_type == "",
        doc.parent_type.isin(parent_qry)
    ]))
    
    if (name := filters.get("name")):
        if isinstance(name, str):
            name = parse_json(name)
        if (
            isinstance(name, list) and len(name) == 2 and
            isinstance(name[0], str) and name[1]
        ):
            if name[0] == "=" and isinstance(name[1], str):
                qry = qry.where(doc.name == name[1])
            elif name[0] == "!=" and isinstance(name[1], str):
                qry = qry.where(doc.name != name[1])
            elif name[0] == "in"and isinstance(name[1], list):
                qry = qry.where(doc.name.isin(name[1]))
            elif name[0] == "not in"and isinstance(name[1], list):
                qry = qry.where(doc.name.notin(name[1]))
    
    is_group = 1 if cint(filters.get("is_group")) else 0
    qry = qry.where(doc.is_group == is_group)
    
    data = qry.run(as_dict=as_dict)
    
    data = prepare_data(data, dt, "name", txt, as_dict)
    
    return data


# Type
def type_children_exists(name):
    return frappe.doc.exists("Expense Type", {"parent_type": name})


# Type
def disable_type_descendants(lft, rgt):
    doc = frappe.qb.DocType("Expense Type")
    (
        frappe.qb.update(doc)
        .set(doc.disabled, 1)
        .where(doc.disabled == 0)
        .where(doc.lft.gt(lft))
        .where(doc.rgt.lt(rgt))
    ).run()


# Type Tree
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
            ["docstatus", "<", 2],
            [
                "ifnull(`{0}`,\"\")".format("parent_type"),
                "=",
                "" if is_root else parent
            ]
        ]
    )


# Internal
_TYPE_FIELDS_ = ["type_name", "is_group", "expense_accounts"]


# Type Tree
@frappe.whitelist()
def add_type_node(args=None):
    from frappe.desk.treeview import make_tree_args
    
    dt = "Expense Type"
    
    if not args:
        args = frappe.local.form_dict
    
    if not args:
        return {"error": "{0} data is invalid", "args": [dt]}
    
    args.doctype = dt
    args = make_tree_args(**args)
    
    doc = frappe.new_doc(dt)
    
    if args.get("ignore_permissions"):
        doc.flags.ignore_permissions = True
        args.pop("ignore_permissions")
    
    for k, v in args.items():
        if k in _TYPE_FIELDS_:
            doc.set(k, v)
    
    parent_field = "parent_" + dt.lower().replace(" ", "_")
    parent_col = "parent_type"
    
    if cint(doc.get("is_root")):
        doc.set(parent_col, None)
        doc.flags.ignore_mandatory = True
    else:
        if not doc.get(parent_col):
            if args.get("parent"):
                doc.set(parent_col, args.get("parent"))
            elif args.get(parent_field):
                doc.set(parent_col, args.get(parent_field))
        
        if not doc.get(parent_col):
            return {"error": "{0} must have a parent", "args": [dt]}
    
    doc.insert(ignore_permissions=True)
    
    return doc.name


# Item
def get_type_company_account_data(name, company):
    if not name or not isinstance(name, str):
        return {}
    
    ckey = f"{name}-{company}-accounts-data"
    dt = "Expense Type"
    cache = get_cache(dt, ckey)
    if cache and isinstance(cache, dict):
        return cache
    
    data = get_company_account_data_by_parent(company, name, dt, "expense_accounts")
    
    if not data:
        for parent in get_cached_doc(dt, name).get_ancestors():
            data = get_company_account_data_by_parent(
                company, parent, dt, "expense_accounts"
            )
            if data and isinstance(data, dict):
                break
            
    if not data or not isinstance(data, dict):
        error(
            (_("Unable to get the account data of the type {0} and company {1}")
                .format(name, company))
        )
    
    set_cache(dt, ckey, data)
    
    return data


# Item
def get_types_filter_query():
    doc = frappe.qb.DocType("Expense Type")
    return (frappe.qb.from_(doc)
        .select(doc.name)
        .where(doc.disabled == 0)
        .where(doc.is_group == 0))