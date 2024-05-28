# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [E Settings, Update]
def users_filter(names: list, attrs: dict=None, enabled: bool=None):
    return all_filter("User", "name", names, attrs, enabled, "enabled", 1)


# [E Item, E Type]
def companies_filter(names: list, attrs: dict=None):
    return all_filter("Company", "name", names, attrs)


# [E Entry, E Item, E Type]
def company_accounts_filter(names: list, attrs: dict=None, enabled: bool=None):
    return all_filter("Account", ["name", "company"], names, attrs, enabled, "disabled", 0)


# [E Entry]
def projects_filter(names: list, attrs: dict=None):
    return all_filter("Project", "name", names, attrs)


# [E Entry]
def cost_centers_filter(names: list, attrs: dict=None, enabled: bool=None):
    return all_filter("Cost Center", "name", names, attrs, enabled, "disabled", 0)


# [E Entry]
def employees_filter(names: list, attrs: dict=None, enabled: bool=None):
    return all_filter("Employee", "name", names, attrs, enabled, "status", "Active")


# [E Entry]
def expense_claims_filter(names: list, attrs: dict=None):
    return all_filter("Expense Claim", ["name", "employee"], names, attrs)


# [E Entry]
def parties_filter(dt: str, names: list, attrs: dict=None, enabled: bool=None):
    return all_filter(dt, "name", names, attrs, enabled)


# [Check, Internal]
def all_filter(
    dt: str, field: str|list, names: list, attrs: dict=None,
    enabled: bool=None, status_col: str="disabled", status_val: str|int=0
):
    if isinstance(field, str):
        field = [field]
    
    filters = [[dt, field[0], "in", list(set(names))]]
    if attrs:
        for k in attrs:
            if isinstance(attrs[k], list):
                if len(attrs[k]) > 1 and isinstance(attrs[k][1], list):
                    filters.append([dt, k, attrs[k][0], attrs[k][1]])
                else:
                    filters.append([dt, k, "in", attrs[k]])
            else:
                filters.append([dt, k, "=", attrs[k]])
    
    if enabled == True:
        filters.append([dt, status_col, "=", status_val])
    elif enabled == False:
        filters.append([dt, status_col, "!=", status_val])
    
    flen = len(field)
    data = frappe.get_all(
        dt,
        fields=field,
        filters=filters,
        pluck=field[0] if flen == 1 else None,
        ignore_permissions=True,
        strict=False
    )
    if not data or not isinstance(data, list):
        return None
    
    if flen == 1:
        return [v for v in data if v in names]
    
    if flen == 2:
        return {v[field[0]]:v[field[1]] for v in data if v[field[0]] in names}
    
    return {v[field[0]]:v for v in data if v[field[0]] in names}