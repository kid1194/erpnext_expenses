# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from .common import get_cached_doc
from .doctypes import _SETTINGS


# Common
def settings(for_update=False):
    return get_cached_doc(_SETTINGS, for_update)