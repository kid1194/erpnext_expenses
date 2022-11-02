# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _

from erpnext.setup.utils import get_exchange_rate

from .common import error, get_cached_doc, get_cached_value
from .search import filter_search


_ENTRY = "Expenses Entry"
_ENTRY_ACCOUNT = "Expenses Entry Account"
_ENTRY_EXPENSES_FIELD = "expenses"


## Expenses Entry Form
## Expenses Entry
@frappe.whitelist(methods=["POST"])
def get_mode_of_payment_data(mode_of_payment, company):
    if (
        not mode_of_payment or not isinstance(mode_of_payment, str) or
        not company or not isinstance(company, str)
    ):
        return {}
    
    maDoc = frappe.qb.DocType("Mode of Payment Account")
    aDoc = frappe.qb.DocType("Account")
    data = (
        frappe.qb.from_(maDoc)
        .select(
            aDoc.name.as_("account"),
            aDoc.account_currency.as_("currency")
        )
        .inner_join(aDoc)
        .on(aDoc.name == maDoc.default_account)
        .where(maDoc.parent == mode_of_payment)
        .where(maDoc.parenttype == "Mode of Payment")
        .where(maDoc.parentfield == "accounts")
        .where(maDoc.company == company)
        .limit(1)
    ).run(as_dict=True)
    
    if data and isinstance(data, list):
        data = data[0]
    
    mop_type = get_cached_value("Mode of Payment", mode_of_payment, "type")
    
    if not data or not isinstance(data, dict):
        if mop_type == "Bank":
            def_account = get_cached_value("Company", company, "default_bank_account")
        elif mop_type == "Cash":
            def_account = get_cached_value("Company", company, "default_cash_account")
        
        data = {
            "account": def_account,
            "currency": get_cached_value("Account", def_account, "account_currency"),
        }
    
    data["type"] = mop_type
    data["company_currency"] = get_cached_value("Company", company, "default_currency")
    
    return data


## Expenses Entry Form
## Expenses Entry
@frappe.whitelist(methods=["POST"])
def get_current_exchange_rate(from_currency, to_currency, date=None):
    rate = get_exchange_rate(from_currency, to_currency, date, "for_buying")
    
    if not rate or not isinstance(rate, float) or rate < 1:
        rate = 1.0
    
    return rate


## Self Journal
def get_entry_data(name):
    return get_cached_doc(_Entry, name)