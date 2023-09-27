# ERPNext Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _, _dict

from .common import to_json


def get_cache(dt, key):
    return frappe.cache().hget(dt, key)


def set_cache(dt, key, data):
    frappe.cache().hset(dt, key, data)


def get_tmp_cache(dt, key):
    return frappe.cache().get_value(f"{dt}-{key}", expires=True)


def set_tmp_cache(dt, key, data, expiry):
    frappe.cache().set_value(f"{dt}-{key}", data, expires_in_sec=expiry)


def del_cache(dt, key):
    frappe.cache().hdel(dt, key)
    clear_cache(f"{dt}-{key}")


def clear_cache(dt):
    frappe.cache().delete_key(dt)


def get_cached_doc(dt, name=None, for_update=False):
    if isinstance(name, bool):
        for_update = name
        name = None
    
    if name is None:
        name = dt
    
    if for_update:
        clear_doc_cache(dt, name)
    
    if dt != name and not frappe.db.exists(dt, name):
        return None
    
    return frappe.get_cached_doc(dt, name, for_update=for_update)


def clear_doc_cache(dt, name=None):
    if name is None:
        name = dt
    frappe.clear_cache(doctype=dt)
    frappe.clear_document_cache(dt, name)
    clear_cache(dt)


def get_cached_value(dt, filters, field, as_dict=False):
    _name = filters if isinstance(filters, str) else None
    _as_dict = as_dict
    _dict_val = 1 if isinstance(field, list) else 0
    
    if _name:
        if as_dict and not _dict_val:
            as_dict = False
        
        val = frappe.get_cached_value(dt, _name, field, as_dict=as_dict)
        if val and isinstance(val, list) and not _dict_val:
            val = val.pop()
    
    else:
        val = frappe.db.get_value(dt, filters, field, as_dict=as_dict)
    
    if not val:
        if _name:
            error(_("Unable to get the value/s of {0} from {1}.{2}.").format(
                to_json(field) if _dict_val else field,
                dt, _name
            ))
        
        else:
            error(_("Unable to get the value/s of {0} from {1} as filtered by {2}.").format(
                to_json(field) if _dict_val else field,
                dt, to_json(filters.keys())
            ))
    
    if _as_dict and not isinstance(val, dict):
        val = _dict(zip(
            field if _dict_val else [field],
            val if isinstance(val, list) else [val]
        ))
    
    return val