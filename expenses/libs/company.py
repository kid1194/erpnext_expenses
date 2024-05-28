# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _


# [Entry]
def get_company_account(company: str, type_val: str):
    types = {
        "Bank": "default_bank_account",
        "Cash": "default_cash_account"
    }
    if type_val not in types:
        return None
    
    return frappe.db.get_value("Company", company, types[type_val])


# [E Entry, E Entry Form]
@frappe.whitelist(methods=["POST"])
def get_company_currency(name, local=False):
    if not name or not isinstance(name, str):
        if local:
            return None
        return {"error": _("Arguments required to get company currency are invalid.")}
    
    val = frappe.db.get_value("Company", name, "default_currency")
    if val is None and not local:
        return {"error": _("Company \"{0}\" doesn't exist.").format(name)}
    
    return val