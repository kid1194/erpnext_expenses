# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Update]
def users_filter(names: list, attrs: dict=None, enabled: bool=None):
    return all_filter("User", "name", names, attrs, enabled, "enabled", 1)


# [Check, Internal]
def all_filter(
    dt: str, field: str, names: list, attrs: dict=None,
    enabled: bool=None, status_col: str="disabled", enabled_val: int=0
):
    filters = [[dt, field, "in", list(set(names))]]
    
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
        filters.append([dt, status_col, "=", enabled_val])
    elif enabled == False:
        filters.append([dt, status_col, "!=", enabled_val])
    
    data = frappe.get_all(
        dt,
        fields=[field],
        filters=filters,
        pluck=field,
        strict=False
    )
    if not data or not isinstance(data, list):
        return None
    
    return [v for v in data if v in names]