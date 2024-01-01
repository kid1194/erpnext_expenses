# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe


# [Settings]
def emit_app_status_changed(data=None, after_commit=True):
    emit_event("exp_app_status_changed", data, after_commit)


# [Type]
def emit_type_changed(data=None, after_commit=True):
    emit_event("exp_type_changed", data, after_commit)


# [Item]
def emit_item_changed(data=None, after_commit=True):
    emit_event("exp_item_changed", data, after_commit)


# [Expense]
def emit_expense_changed(data=None, after_commit=True):
    emit_event("exp_expense_changed", data, after_commit)


# [Request]
def emit_request_changed(data=None, after_commit=True):
    emit_event("exp_expenses_request_changed", data, after_commit)


# [Entry]
def emit_entry_changed(data=None, after_commit=True):
    emit_event("exp_expenses_entry_changed", data, after_commit)


## [Internal]
def emit_event(event: str, data, after_commit: bool=True):
    frappe.publish_realtime(
        event=event,
        message=data,
        after_commit=after_commit
    )