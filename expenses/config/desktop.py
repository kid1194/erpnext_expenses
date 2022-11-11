# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _


def get_data():
    return [
        {
            "module_name": "Expenses",
            "category": "Modules",
            "color": "blue",
            "icon": "octicon octicon-note",
            "type": "module",
            "label": _("Expenses"),
            "description": _("Expenses Management")
        }
    ]