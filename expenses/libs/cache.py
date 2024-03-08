# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Account, Item, Type]
def get_cache(dt: str, key: str, expires=False):
    return frappe.cache().get_value(f"{dt}-{key}", expires=expires)


# [Account, Item, Type]
def set_cache(dt: str, key: str, data, expiry: int=None):
    frappe.cache().set_value(f"{dt}-{key}", data, expires_in_sec=expiry)


# []
def del_cache(dt: str, key: str):
    frappe.cache().delete_key(f"{dt}-{key}")


# [EXP Type, Entry, Request, Settings, Type, Internal]
def get_cached_doc(dt: str, name: str=None, for_update: bool=False):
    if name is None:
        name = dt
    
    if for_update:
        clear_doc_cache(dt, name)
    
    if dt != name and not frappe.db.exists(dt, name):
        return None
    
    return frappe.get_cached_doc(dt, name, for_update=for_update)


# [EXP Entry, EXP Expense, EXP Item, EXP Request, EXP Settings, EXP Type, Internal]
def clear_doc_cache(dt: str, name: str=None):
    frappe.cache().delete_keys(dt)
    frappe.clear_cache(doctype=dt)
    if name is None:
        name = dt
    frappe.clear_document_cache(dt, name)


# [Account, EXP Entry, Entry, Item]
def get_cached_value(dt: str, name: str, field):
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
            values[f] = doc.get(f)
    
    if not values:
        return None
    
    return frappe._dict(values)