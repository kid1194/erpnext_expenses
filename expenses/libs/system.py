# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Install, Expense, Update, Internal]
def settings():
    from .cache import get_cached_doc
    
    return get_cached_doc("Expenses Settings")


# [EXP JS]
@frappe.whitelist()
def get_settings():
    from expenses import __production__
    
    doc = settings()
    return {
        "is_enabled": 1 if doc._is_enabled else 0,
        "prod": 1 if __production__ else 0
    }


# [E Entry, E Expense, E Item, E Request, E Type]
def check_app_status():
    if not settings()._is_enabled:
        from frappe import _
        
        from expenses import __module__
        
        from .common import error
        
        error(_("{0} app is disabled.").format(_(__module__)))