# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _


# [E Entry, E Entry Form]
@frappe.whitelist(methods=["POST"])
def get_exchange_rate(_from: str|list, _to: str, date: str=None, args: str=None, local: bool=False):
    from .common import json_to_list
    
    _from = json_to_list(_from)
    
    if (
        not _from or not isinstance(_from, list) or
        not _to or not isinstance(_to, str) or
        (date and not isinstance(date, str)) or
        (args and not isinstance(args, str))
    ):
        if local:
            return 1.0
        
        return {"error": _("Arguments required to get the exchange rate/rates are invalid.")}
    
    _from = [v for v in _from if v and isinstance(v, str)]
    if _from and _to in _from:
        _from.remove(_to)
    
    if not _from:
        if local:
            return 1.0
        
        return {"error": _("From currency/currencies required to get the exchange rate/rates is empty.")}
    
    if not date:
        from frappe.utils import nowdate
        
        date = nowdate()
    
    from frappe.utils import flt
    
    multi = len(_from) > 1
    dt = "Currency Exchange"
    fields = ["from_currency", "exchange_rate"]
    filters = [
        [dt, "date", "<=", f"{date} 00:00:00.000"],
        [
            dt, fields[0],
            "in" if multi else "=",
            _from if multi else _from[0]
        ],
        [dt, fields[1], "=", _to]
    ]
    if args == "for_buying":
        filters.append([dt, args, "=", 1])
    elif args == "for_selling":
        filters.append([dt, args, "=", 1])
    
    settings = frappe.get_doc("Accounts Settings")
    if settings:
        from frappe.utils import cint
        
        if (
            not cint(settings.get("allow_stale")) and
            cint(settings.get("stale_days"))
        ):
            from frappe.utils import (
                add_days,
                get_datetime_str
            )
            
            days = cint(settings.stale_days)
            check_date = get_datetime_str(add_days(date, -days))
            filters.append([dt, "date", ">", check_date])
    
    data = frappe.get_all(
        dt,
        fields=fields,
        filters=filters,
        order_by="date desc",
        ignore_permissions=True,
        strict=False
    )
    if data and isinstance(data, list):
        if not multi:
            return flt(data.pop(0)[fields[1]])
        
        return {v[fields[0]]:flt(v[fields[1]]) for v in data}
    
    data = {k:1.0 for k in _from}
    found = 0
    try:
        for k in _from:
            key = "currency_exchange_rate_{0}:{1}:{2}".format(date, k, _to)
            val = frappe.cache().get(key)
            if flt(val) >= 1:
                found += 1
                data[k] = flt(val)
    
    except Exception:
        from .common import (
            store_error,
            log_error
        )
        
        found = 0
        store_error({
            "error": "Failed to get exchange rate/rates",
            "_from": _from,
            "_to": _to,
            "date": date,
            "args": args
        })
        log_error(_("Failed to get exchange rate/rates."))
    
    if found or local:
        return data if multi else data[_from[0]]
    
    return {"error": _("Unable to get the exchange rate/rates value.")}