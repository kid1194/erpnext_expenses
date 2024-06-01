# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [E Settings, Update]
def user_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("User", name, attrs, enabled, "enabled", 1)


# [E Type]
def type_children_exists(parent: str):
    return _has("Expense Type", {"parent_type": parent})


# [E Type]
def type_items_exists(expense_type: str):
    return _has("Expense Item", {"expense_type": expense_type})


# [E Item, E Type]
def type_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("Expense Type", name, attrs, enabled)


# [E Expense]
def item_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("Expense Item", name, attrs, enabled)


# [E Item]
def uom_exists(name: str, attrs: dict=None):
    return _exists("UOM", name, attrs)


# [E Item]
def has_item_expenses(expense_item: str):
    return _has("Expense", {"expense_item": expense_item})


# [E Entry, E Expense, E Request]
def company_exists(name: str, attrs: dict=None):
    return _exists("Company", name, attrs)


# [E Entry, E Expense]
def party_exists(dt: str, name: str, attrs: dict=None, enabled: bool=None):
    return _exists(dt, name, attrs, enabled)


# [Entry, Expense]
def can_use_expense_claim():
    return _exists("DocType", "Expense Claim")


# [Expense]
def expense_claim_exists(name: str, attrs: dict=None):
    return _exists("Expense Claim", name, attrs)


# [Expense]
def expense_exists(name: str, attrs: dict=None):
    return _exists("Expense", name, attrs)


# [E Entry]
def mode_of_payment_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("Mode of Payment", name, attrs, enabled, "enabled", 1)


# [E Entry]
def project_exists(name: str, attrs: dict=None):
    return _exists("Project", name, attrs)


# [E Entry]
def cost_center_exists(name: str, attrs: dict=None, enabled: bool=None):
    return _exists("Cost Center", name, attrs, enabled, "disabled", 0)


# [Request, Internal]
def get_count(dt: str, filters: dict):
    return frappe.db.count(dt, filters)


# [Internal]
def _has(dt: str, filters: dict):
    return get_count(dt, filters) > 0


# [Internal]
def _exists(
    dt: str, name: str, attrs: dict=None, enabled: bool=None,
    status_col: str="disabled", status_val: str|int=0
):
    params = {"doctype": dt}
    if name:
        params["name"] = name
    if attrs:
        params.update(attrs)
    if enabled == True:
        params[status_col] = ["=", status_val]
    elif enabled == False:
        params[status_col] = ["!=", status_val]
    if frappe.db.exists(params) is None:
        return False
    return True


# [Internal]
def _all_exists(
    dt: str, field: str, names: list, attrs: dict=None,
    enabled: bool=None, status_col: str="disabled", status_val: int=0
):
    from .filter import all_filter
    
    data = all_filter(dt, field, names, attrs, enabled, status_col, status_val)
    if not data or len(data) != len(names):
        return False
    
    for v in names:
        if v not in data:
            return False
    
    return True