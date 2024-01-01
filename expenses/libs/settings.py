# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe.utils import cint

from .cache import get_cached_doc
from .doctypes import __SETTINGS__


## [Install, Update, Internal]
def settings(for_update=False):
    return get_cached_doc(__SETTINGS__, None, for_update)


# [JS]
## [Update]
@frappe.whitelist()
def is_enabled():
    return cint(getattr(settings(), "is_enabled", 0)) == 1