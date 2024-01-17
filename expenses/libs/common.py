# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import json

import frappe
from frappe import _

from expenses import (
    __module__,
    __production__
)
from expenses.version import __frappe_v13__

from .logger import get_logger


## [Internal]
_LOGGER_ERROR = get_logger("error") if not __production__ else None


## [Internal]
_LOGGER_INFO = get_logger("info") if not __production__ else None


## [Entry, Journal, Update]
def log_error(data):
    if _LOGGER_ERROR:
        _LOGGER_ERROR.error(data)
    else:
        error({"error log": data}, throw=False)


## [Update]
def log_info(data):
    if _LOGGER_INFO:
        _LOGGER_INFO.info(data)
    else:
        error({"info log": data}, throw=False)


## [Entry, Journal]
def error(text, log=True, throw=True):
    if not log and not throw:
        log = True
    
    if not isinstance(text, str):
        old = text
        text = to_str(old)
        if not text:
            text = to_json(old)
        if not text:
            text = "Unable to log or throw a non-string error."
    
    if log:
        if __frappe_v13__:
            frappe.log_error(text, __module__)
        else:
            frappe.log_error(__module__, text)
    
    if throw:
        frappe.throw(text, title=__module__)


## [Attachment, Request, Type, Update]
def parse_json(data, default=None):
    if not isinstance(data, str):
        return data
    try:
        return json.loads(data)
    except Exception:
        return default


## [Background, Expense, Internal]
def to_json(data, default=None):
    if isinstance(data, str):
        return data
    try:
        return json.dumps(data)
    except Exception:
        return default


## [Internal]
def to_str(data, default=None):
    if isinstance(data, str):
        return data
    try:
        return str(data)
    except Exception:
        return default