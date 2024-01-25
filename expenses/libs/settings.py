# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import cint


## [Install, Update, Internal]
def settings(for_update=False):
    from .cache import get_cached_doc
    
    return get_cached_doc("Expenses Settings", None, for_update)


# [JS]
## [Update]
@frappe.whitelist()
def is_enabled():
    return cint(settings().is_enabled) == 1