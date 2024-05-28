# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import json

import frappe

from expenses import __production__


# [Internal]
if not __production__:
    from .logger import get_logger
    
    _LOGGER_ERROR = get_logger("error")
    _LOGGER_INFO = get_logger("info")
else:
    _LOGGER_ERROR = None
    _LOGGER_INFO = None


# [Entry, Journal, Update]
def store_error(data):
    if _LOGGER_ERROR:
        _LOGGER_ERROR.error(data)


# [Update]
def store_info(data):
    if _LOGGER_INFO:
        _LOGGER_INFO.info(data)


# [Entry, Journal]
def log_error(text):
    text = get_str(text)
    if not text:
        return 0
    
    from expenses import __module__
    
    from expenses.version import is_version_lt
    
    if is_version_lt(14):
        frappe.log_error(text, __module__)
    else:
        frappe.log_error(__module__, text)


# [E Entry, E Expense, E Item, E Request, E Settings, E Type, Entry, Journal, System]
def error(text: str|list, title: str= None):
    as_list = True if isinstance(text, list) else False
    if not title:
        from expenses import __module__
        
        title = __module__
    
    frappe.throw(text, title=title, as_list=as_list)


# [Item, Request, Type, Update, Internal]
def parse_json(data, default=None):
    if isinstance(data, (list, dict)):
        return data
    try:
        return json.loads(data)
    except Exception:
        return default


# [Background, Expense, Internal]
def to_json(data, default=None):
    if (
        data and isinstance(data, str) and (
            (data.startswith("{") and data.endswith("}")) or
            (data.startswith("[") and data.endswith("]"))
        )
    ):
        return data
    try:
        return json.dumps(data)
    except Exception:
        return default


# [Internal]
def to_str(data, default=None):
    if isinstance(data, str):
        return data
    try:
        return str(data)
    except Exception:
        return default


# [Internal]
def get_str(data, default=None):
    val = to_str(data)
    if val is None:
        val = to_json(data)
    if val is None:
        return default
    return val


# [Attachment, Exchange, Request]
def json_to_list(data):
    if data:
        tmp = parse_json(data)
        if isinstance(tmp, list):
            return tmp
        if isinstance(data, str):
            return [data]
    return None