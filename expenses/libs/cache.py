# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Account, Expense, Item, Type]
def get_cache(dt: str, key: str, expires=False):
    return frappe.cache().get_value(f"{dt}-{key}", expires=expires)


# [Account, Expense, Item, Type]
def set_cache(dt: str, key: str, data, expiry: int=None):
    frappe.cache().set_value(f"{dt}-{key}", data, expires_in_sec=expiry)


# [Entry, Request, Settings, Type, Internal]
def get_cached_doc(dt: str, name: str=None):
    if name is None:
        name = dt
    
    if dt != name and not frappe.db.exists(dt, name):
        return None
    
    return frappe.get_cached_doc(dt, name)


# [E Entry, E Expense, E Item, E Request, E Settings, E Type]
def clear_doc_cache(dt: str, name: str=None):
    frappe.cache().delete_keys(dt)
    frappe.clear_cache(doctype=dt)
    frappe.clear_document_cache(dt, name or dt)


# []
def get_cached_value(dt: str, name: str, field, raw: bool=False):
    if not field or not isinstance(field, (str, list)):
        return None
    
    doc = get_cached_doc(dt, name)
    if not doc:
        return None
    
    if isinstance(field, str):
        return doc.get(field)
    
    values = {}
    for f in field:
        if f and isinstance(f, str):
            values[f] = doc.get(f, None)
    
    if not values:
        return None
    
    return values if raw else frappe._dict(values)