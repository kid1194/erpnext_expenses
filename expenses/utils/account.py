# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe.utils import flt


_ACCOUNT = "Expense Account"


## Expense Type
def get_companies_filter_query_by_parent(parent, parenttype, parentfield, only_query=False):
    doc = frappe.qb.DocType(_ACCOUNT)
    qry = (frappe.qb.from_(doc)
        .select(doc.company)
        .where(doc.parent == parent)
        .where(doc.parenttype == parenttype)
        .where(doc.parentfield == parentfield))
    
    if only_query:
        return qry
    
    return _ACCOUNT, doc, qry


## Self Type
def get_companies_by_parent(parent, parenttype, parentfield):
    qry = get_companies_filter_query_by_parent(parent, parenttype, parentfield, True)
    return qry.run(as_dict=True)


## Self Type
## Self Item
def get_company_account_data_by_parent(company, parent, parenttype, parentfield):
    doc = frappe.qb.DocType(_ACCOUNT)
    aDoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.account,
            aDoc.account_currency.as_("currency"),
            doc.cost,
            doc.min_cost,
            doc.max_cost,
            doc.qty,
            doc.min_qty,
            doc.max_qty
        )
        .inner_join(aDoc)
        .on(aDoc.name == doc.account)
        .where(doc.company == company)
        .where(doc.parent == parent)
        .where(doc.parenttype == parenttype)
        .where(doc.parentfield == parentfield)
        .limit(1)
    ).run(as_dict=True)
    
    data = data.pop(0) if data and isinstance(data, list) else None
    if data:
        for k in ["cost", "qty"]:
            data[k] = flt(data[k])
            data["min_" + k] = flt(data["min_" + k])
            data["max_" + k] = flt(data["max_" + k])
    
    return data


###
# Self Type
# Self Item
def get_account_data_by_parents(parents, companies, parenttype, parentfield):
    doc = frappe.qb.DocType(_ACCOUNT)
    aDoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            doc.parent.as_("name"),
            doc.company,
            doc.account,
            aDoc.account_currency.as_("currency"),
            doc.cost,
            doc.min_cost,
            doc.max_cost,
            doc.qty,
            doc.min_qty,
            doc.max_qty
        )
        .inner_join(aDoc)
        .on(aDoc.name == doc.account)
        .where(doc.company.isin(companies))
        .where(doc.parent.isin(parents))
        .where(doc.parenttype == parenttype)
        .where(doc.parentfield == parentfield)
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    for i in range(len(data)):
        for k in ["cost", "qty"]:
            data[i][k] = flt(data[i][k])
            data[i]["min_" + k] = flt(data[i]["min_" + k])
            data[i]["max_" + k] = flt(data[i]["max_" + k])
    
    return data