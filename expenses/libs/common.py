# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import json

import frappe
from frappe import _

from expenses import (
    __name__,
    __production__
)

from .logger import get_logger


## [Internal]
_LOGGER_ERROR = get_logger("error") if not __production__ else None


## [Internal]
_LOGGER_INFO = get_logger("info") if not __production__ else None


## [Entry, Journal]
def error(text, log=True, throw=True):
    if not isinstance(text, str):
        text = to_json(text)
        if not text:
            text = _("Unable to log or throw a non-string error.")
    
    if log:
        frappe.log_error(__module__, text)
    
    if throw:
        frappe.throw(text, title=__module__)


## [Entry, Journal, Update]
def log_error(data):
    if _LOGGER_ERROR:
        _LOGGER_ERROR.error(data)


## []
def log_info(data):
    if _LOGGER_INFO:
        _LOGGER_INFO.info(data)


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