# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import (
    flt,
    nowdate,
    get_datetime_str,
    add_days
)

from .cache import (
    get_cached_value,
    get_cached_doc
)
from .check import can_use_expense_claim
from .common import error
from .request import get_request


## [Install, Internal]
__ENTRY__ = "Expenses Entry"


## [Internal]
__ENTRY_DETAILS__ = "Expenses Entry Details"


## [Internal]
__ENTRY_MODERATOR_ROLE__ = "Expenses Entry Moderator"


## [Expense]
def get_expense_entries(expense: str):
    doc = frappe.qb.DocType(__ENTRY_DETAILS__)
    data = (
        frappe.qb.from_(doc)
        .select(doc.parent)
        .where(doc.expense_ref == expense)
        .where(doc.parenttype == __ENTRY__)
        .where(doc.parentfield == "expenses")
    ).run(as_dict=True)
    
    if not data or not isinstance(data, list):
        return None
    
    return data


# [Entry, Entry Form]
@frappe.whitelist(methods=["POST"])
def get_mode_of_payment_data(mode_of_payment, company):
    if (
        not mode_of_payment or not isinstance(mode_of_payment, str) or
        not company or not isinstance(company, str)
    ):
        return {}
    
    mop_type = get_cached_value("Mode of Payment", mode_of_payment, "type")
    
    doc = frappe.qb.DocType("Mode of Payment Account")
    adoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(doc)
        .select(
            adoc.name.as_("account"),
            adoc.account_currency.as_("currency")
        )
        .inner_join(adoc)
        .on(adoc.name == doc.default_account)
        .where(doc.parent == mode_of_payment)
        .where(doc.parenttype == "Mode of Payment")
        .where(doc.parentfield == "accounts")
        .where(doc.company == company)
        .limit(1)
    ).run(as_dict=True)
    
    if data and isinstance(data, list):
        data = data.pop(0)
    
    else:
        data = {
            "account": None,
            "currency": None
        }
        
        if mop_type == "Bank":
            data["account"] = get_cached_value("Company", company, "default_bank_account")
        elif mop_type == "Cash":
            data["account"] = get_cached_value("Company", company, "default_cash_account")
        
        if data["account"]:
            data["currency"] = get_cached_value("Account", data["account"], "account_currency")
    
    data["type"] = mop_type
    data["company_currency"] = get_cached_value("Company", company, "default_currency")
    
    return data


# [Entry]
## [Internal]
def is_entry_moderator():
    return 1 if __ENTRY_MODERATOR_ROLE__ in frappe.get_roles() else 0


# [Entry, Entry Form]
@frappe.whitelist()
def entry_form_setup():
    return {
        "is_moderator": is_entry_moderator(),
        "has_expense_claim": can_use_expense_claim()
    }


# [Entry, Entry Form]
@frappe.whitelist(methods=["POST"])
def get_current_exchange_rate(from_currency, to_currency, date=None):
    return get_exchange_rate_value(from_currency, to_currency, date)


# [Entry Form]
@frappe.whitelist(methods=["POST"])
def get_request_data(name):
    if not name or not isinstance(name, str):
        return 0
    
    data = get_request(name)
    if not data:
        return 0
    
    return data


## [Internal]
def get_exchange_rate_value(from_currency, to_currency: str, date=None, args=None):
    if (
        not from_currency or
        not isinstance(from_currency, (str, list)) or
        not to_currency or
        not isinstance(to_currency, str) or
        from_currency == to_currency or
        (date and not isinstance(date, str)) or
        (args and not isinstance(args, str))
    ):
        return 1.0
    
    if not date:
        date = nowdate()
    
    currency_settings = frappe.get_doc("Accounts Settings").as_dict()
    allow_stale_rates = currency_settings.get("allow_stale")
    
    is_multi = 0
    filters = [
        ["date", "<=", get_datetime_str(date)],
        ["to_currency", "=", to_currency],
    ]
    
    if isinstance(from_currency, list):
        from_currency = [v for v in from_currency if v and isinstance(v, str)]
        if not from_currency:
            return 1.0
        
        is_multi = 1
        filters.append(["from_currency", "in", from_currency])
    else:
        filters.append(["from_currency", "=", from_currency])

    if args == "for_buying":
        filters.append(["for_buying", "=", "1"])
    elif args == "for_selling":
        filters.append(["for_selling", "=", "1"])

    if not allow_stale_rates:
        stale_days = currency_settings.get("stale_days")
        checkpoint_date = add_days(date, -stale_days)
        filters.append(["date", ">", get_datetime_str(checkpoint_date)])
    
    if not is_multi:
        entries = frappe.get_all(
            "Currency Exchange",
            fields=["exchange_rate"],
            filters=filters,
            order_by="date desc",
            limit=1,
            pluck="exchange_rate"
        )
        
        if entries:
            return flt(entries[0])
    
    else:
        entries = frappe.get_all(
            "Currency Exchange",
            fields=["from_currency", "exchange_rate"],
            filters=filters,
            order_by="date desc"
        )
        if entries:
            return {v["from_currency"]:flt(v["exchange_rate"]) for v in entries}

    try:
        cache = frappe.cache()
        
        if not is_multi:
            key = "currency_exchange_rate_{0}:{1}:{2}".format(date, from_currency, to_currency)
            value = cache.get(key)
            if value:
                return flt(value)
        
        else:
            value = {}
            for k in from_currency:
                key = "currency_exchange_rate_{0}:{1}:{2}".format(date, k, to_currency)
                val = cache.get(key)
                if not val:
                    val = 1.0
                
                value[k] = flt(val)
            
            return value
    
    except Exception:
        log_error({
            "error": "Failed to get exchange rate/rates",
            "data": {
                "from_currency": from_currency,
                "to_currency": to_currency,
                "date": date,
                "args": args
            }
        })
        
        error(_("Failed to get exchange rates."), throw=False)
        
        if not is_multi:
            return 1.0
        
        return {k:1.0 for k in from_currency}


## [Journal]
def get_entry_data(name: str):
    return get_cached_doc(__ENTRY__, name)