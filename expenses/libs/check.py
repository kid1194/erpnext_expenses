# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [EXP Settings]
def users_exists(names: list, attrs: dict=None, enabled: bool=None):
    return _all_exists("User", "name", names, attrs, enabled, "enabled", 1)


# [EXP Settings, Update]
def user_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("User", name, attrs, enabled, "enabled", 1)


# [EXP Item, EXP Type]
def type_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("Expense Type", name, attrs, enabled)


# [EXP Type]
def type_children_exists(parent: str):
    return _has("Expense Type", {"parent_type": parent})


# [EXP Type]
def items_of_type_exists(expense_type: str):
    return _has("Expense Item", {"expense_type": expense_type})


# [EXP Entry, EXP Type]
def account_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("Account", name, attrs, enabled)


# [EXP Item]
def has_item_expenses(expense_item: str):
    return _has("Expense", {"expense_item": expense_item})


# [EXP Item, Request, Internal]
def get_count(dt: str, filters: dict):
    return frappe.db.count(dt, filters)


# [Entry, Expense]
def can_use_expense_claim():
    return _exists("DocType", "Expense Claim")


# [Expense]
def expense_claim_exists(name: str, attrs: dict=None):
    return _exists("Expense Claim", name, attrs)


# [Expense]
def expense_exists(name: str, attrs: dict=None):
    return _exists("Expense", name, attrs)


# [Internal]
def _has(dt: str, filters: dict):
    return get_count(dt, filters) > 0


# [Internal]
def _exists(
    dt: str, name: str, attrs: dict=None, enabled: bool=None,
    status_col: str="disabled", enabled_val: int=0
):
    params = {"doctype": dt}
    
    if name:
        params["name"] = name
    
    if attrs:
        params.update(attrs)
    
    if enabled == True:
        params[status_col] = ["=", enabled_val]
    elif enabled == False:
        params[status_col] = ["!=", enabled_val]
    
    return frappe.db.exists(params) != None


# [Internal]
def _all_exists(
    dt: str, field: str, names: list, attrs: dict=None,
    enabled: bool=None, status_col: str="disabled", enabled_val: int=0
):
    from .filter import all_filter
    
    data = all_filter(dt, field, names, attrs, enabled, status_col, enabled_val)
    if not data or len(data) != len(names):
        return False
    
    for v in names:
        if v not in data:
            return False
    
    return True