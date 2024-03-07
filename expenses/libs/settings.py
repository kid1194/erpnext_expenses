# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Install, Update, Internal]
def settings(for_update=False):
    from .cache import get_cached_doc
    
    return get_cached_doc("Expenses Settings", None, for_update)


# [EXP JS, Update]
@frappe.whitelist()
def is_enabled():
    from frappe.utils import cint
    
    return cint(settings().is_enabled) > 0


# [Exp Type]
def check_app_status():
    if not is_enabled():
        from expenses import __module__
        
        from .common import error
        
        error(_("{0} app is disabled.").format(_(__module__)))