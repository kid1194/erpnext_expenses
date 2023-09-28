# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from .cache import get_cached_doc


# Common
def settings(for_update=False):
    return get_cached_doc("Expenses Settings", for_update)