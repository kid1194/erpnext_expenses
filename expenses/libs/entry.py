# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _


# [E Entry, E Entry Form]
@frappe.whitelist(methods=["POST"])
def get_mode_of_payment_data(mode_of_payment, company, local=False):
    if (
        not mode_of_payment or
        not isinstance(mode_of_payment, str) or
        not company or not isinstance(company, str)
    ):
        if local:
            return None
        
        return {"error": _("Arguments required to get mode of payment data are invalid.")}
    
    dt = "Mode of Payment"
    mop_type = frappe.db.get_value(dt, mode_of_payment, "type")
    if not mop_type:
        if local:
            return None
        
        return {"error": _("Mode of payment \"{0}\" doesn't exist.").format(mode_of_payment)}
    
    adt = "Account"
    doc = frappe.qb.DocType(f"{dt} {adt}")
    adoc = frappe.qb.DocType(adt)
    data = (
        frappe.qb.from_(doc)
        .select(
            adoc.name.as_("account"),
            adoc.account_currency.as_("currency")
        )
        .inner_join(adoc)
        .on(adoc.name == doc.default_account)
        .where(doc.parent == mode_of_payment)
        .where(doc.parenttype == dt)
        .where(doc.parentfield == "accounts")
        .where(doc.company == company)
        .limit(1)
    ).run(as_dict=True)
    if data and isinstance(data, list):
        data = data.pop(0)
        data["type"] = mop_type
        return data
    
    from .company import get_company_account
    
    account = get_company_account(company, mop_type)
    if not account:
        if local:
            return None
        
        return {"error": _("{0} account for company \"{1}\" isn't found.").format(mop_type, company)}
    
    from .account import get_account_currency
    
    currency = get_account_currency(account)
    if not currency:
        if local:
            return None
        
        return {"error": _("Account currency for \"{0}\" isn't found.").format(account)}
    
    return {
        "type": mop_type,
        "account": account,
        "currency": currency
    }


# [E Entry, Internal]
def is_entry_moderator():
    return 1 if "Expenses Entry Moderator" in frappe.get_roles() else 0


# [E Entry, E Entry Form]
@frappe.whitelist()
def entry_form_setup():
    from .expense import (
        has_expense_claim,
        expense_claim_reqd_if_paid
    )
    
    has_expense_claim = has_expense_claim()
    return {
        "is_moderator": is_entry_moderator(),
        "has_expense_claim": has_expense_claim,
        "expense_claim_reqd": expense_claim_reqd_if_paid() if has_expense_claim else 0
    }


# [E Entry Form]
@frappe.whitelist(methods=["POST"])
def get_request_data(name):
    if not name or not isinstance(name, str):
        return 0
    
    from .request import get_request
    
    data = get_request(name)
    if not data:
        data = 0
    return data


# [Journal]
def get_entry_data(name: str):
    from .cache import get_cached_doc
    
    return get_cached_doc("Expenses Entry", name)