# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import json

import frappe

from expenses import __module__, __production__
from .logger import get_logger


_LOGGER_ERROR = get_logger("error") if not __production__ else None
_LOGGER_INFO = get_logger("info") if not __production__ else None


def error(text, throw=True):
    if not isinstance(text, str):
        text = to_json(text, str(text))
    frappe.log_error(__module__, text)
    if throw:
        frappe.throw(text, title=__module__)


def log_error(data):
    if _LOGGER_ERROR:
        _LOGGER_ERROR.error(data)
    else:
        log_fallback("error", data)


def log_info(data):
    if _LOGGER_INFO:
        _LOGGER_INFO.info(data)
    else:
        log_fallback("info", data)


def log_fallback(key, data):
    val = {f"{key}": data}
    raw = None
    
    try:
        raw = json.dumps(val)
    except Exception:
        raw = val
    
    if not isinstance(raw, str):
        try:
            raw = str(val)
        except Exception:
            raw = val
    
    if raw:
        error(raw, False)


def parse_json(data, default=None):
    if not isinstance(data, str):
        return data
    if default is None:
        default = data
    try:
        return json.loads(data)
    except Exception:
        return default


def to_json(data, default=None):
    if isinstance(data, str):
        return data
    if default is None:
        default = data
    try:
        return json.dumps(data)
    except Exception:
        return default