# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [E Settings]
def emit_settings_changed(data=None):
    emit_event("exp_settings_changed", data)


# [Internal]
def emit_event(event: str, data):
    frappe.publish_realtime(event=event, message=data)