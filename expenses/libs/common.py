# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import json

import frappe

from expenses import (
    __module__,
    __production__
)


# [Internal]
if not __production__:
    from .logger import get_logger
    
    _LOGGER_ERROR = get_logger("error")
    _LOGGER_INFO = get_logger("info")
else:
    _LOGGER_ERROR = None
    _LOGGER_INFO = None


# [Entry, Journal, Update]
def log_error(data):
    if _LOGGER_ERROR:
        _LOGGER_ERROR.error(data)
    else:
        error_log({"error log": data})


# [Update]
def log_info(data):
    if _LOGGER_INFO:
        _LOGGER_INFO.info(data)
    else:
        error_log({"info log": data})


# [Internal]
def error_log(text):
    text = get_str(text)
    if text:
        from expenses.version import is_version_lt
        
        if is_version_lt(14):
            frappe.log_error(text, __module__)
        else:
            frappe.log_error(__module__, text)


# [EXP Entry, EXP Expense, EXP Item, EXP Request, EXP Type, Entry, Journal, System]
def error(text, title=None):
    text = to_str(text)
    if not text:
        text = "Unable to throw a non-string error."
    if title:
        title = to_str(title)
    if not title:
        title = __module__
    frappe.throw(text, title=title)


# [Attachment, Item, Request, Type, Update]
def parse_json(data, default=None):
    if not isinstance(data, str):
        return data
    try:
        return json.loads(data)
    except Exception:
        return default


# [Background, Expense, Internal]
def to_json(data, default=None):
    if isinstance(data, str):
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