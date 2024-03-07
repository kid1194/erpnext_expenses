# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [EXP Settings]
def emit_app_status_changed(data=None):
    emit_event("exp_app_status_changed", data)


# [EXP Type]
def emit_type_changed(data=None):
    emit_event("exp_type_changed", data)


# [EXP Item]
def emit_item_changed(data=None):
    emit_event("exp_item_changed", data)


# [EXP Expense]
def emit_expense_changed(data=None):
    emit_event("exp_expense_changed", data)


# [EXP Request]
def emit_request_changed(data=None):
    emit_event("exp_expenses_request_changed", data)


# [EXP Entry]
def emit_entry_changed(data=None):
    emit_event("exp_expenses_entry_changed", data)


# [Internal]
def emit_event(event: str, data):
    frappe.publish_realtime(event=event, message=data)