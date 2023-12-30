# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


## [Account, Item, Type]
def get_cache(dt: str, key: str):
    return frappe.cache().hget(dt, key)


## [Account, Item, Type]
def set_cache(dt: str, key: str, data):
    frappe.cache().hset(dt, key, data)


## []
def get_tmp_cache(key: str):
    return frappe.cache().get_value(key, expires=True)


## []
def set_tmp_cache(key: str, data, expiry: int):
    frappe.cache().set_value(key, data, expires_in_sec=expiry)


## []
def del_cache(dt: str, key: str):
    frappe.cache().hdel(dt, key)
    clear_cache(f"{dt}-{key}")


## [Internal]
def clear_cache(dt: str):
    frappe.cache().delete_key(dt)


# [Type]
## [Entry, Request, Settings, Type, Internal]
def get_cached_doc(dt: str, name: str=None, for_update: bool=False):
    if name is None:
        name = dt
    
    if for_update:
        clear_doc_cache(dt, name)
    
    if dt != name and not frappe.db.exists(dt, name):
        return None
    
    return frappe.get_cached_doc(dt, name, for_update=for_update)


# [Entry, Expense, Item, Request, Settings, Type]
## [Internal]
def clear_doc_cache(dt: str, name: str=None):
    if name is None:
        name = dt
    
    frappe.clear_cache(doctype=dt)
    frappe.clear_document_cache(dt, name)
    clear_cache(dt)


# [Entry]
## [Account, Entry, Item]
def get_cached_value(dt: str, name: str=None, field=None):
    if field and not isinstance(field, (str, list)):
        return None
    
    doc = get_cached_doc(dt, name)
    if not doc:
        return None
    
    if not field:
        field = "name"
    
    if isinstance(field, str):
        return doc.get(field)
    
    values = {}
    for f in field:
        if f and isinstance(f, str):
            values[f] = data.get(f)
    
    if not values:
        return None
    
    return frappe._dict(values)