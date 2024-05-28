# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint
from frappe.model.document import Document

from expenses.libs import (
    clear_doc_cache,
    RequestStatus
)


class ExpensesRequest(Document):
    def before_insert(self):
        self._check_app_status()
        self._set_defaults()
    
    
    def before_validate(self):
        self._check_app_status()
        if cint(self.docstatus) == 0:
            self._set_defaults()
    
    
    def validate(self):
        self._check_app_status()
        self.flags.error_list = []
        self._validate_company()
        self._validate_date()
        self._validate_expenses()
        if self.flags.error_list:
            self._error(self.flags.error_list)
        elif self.is_new():
            self._prepare_expenses()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
    
    
    def before_submit(self):
        self._check_app_status()
        clear_doc_cache(self.doctype, self.name)
        if self.status != RequestStatus.p:
            self.status = RequestStatus.p
        if self.workflow_state != self.status:
            self.workflow_state = self.status
    
    
    def on_update(self):
        self._update_expenses()
        self._clean_flags()
    
    
    def before_update_after_submit(self):
        self._check_app_status()
        if self.workflow_state in (RequestStatus.a, RequestStatus.r):
            from expenses.libs import is_request_reviewer
            
            if not is_request_reviewer():
                self._error(_("Insufficient permission to modify the expenses request."))
        
        if (
            self.status != RequestStatus.p and
            self.workflow_state == self.status and
            (
                self.has_value_changed("company") or
                self.has_value_changed("posting_date") or
                self.has_value_changed("expenses")
            )
        ):
            self._error(_("Expenses request can't be modified."))
        
        clear_doc_cache(self.doctype, self.name)
        if self.workflow_state == RequestStatus.a:
            self.flags.expenses_status = 2
        elif self.workflow_state == RequestStatus.r:
            self.flags.expenses_status = 3
        if not self.reviewer:
            self.reviewer = frappe.session.user
        if self.status != self.workflow_state:
            self.status = self.workflow_state
    
    
    def on_update_after_submit(self):
        self._update_expenses()
        self._clean_flags()
    
    
    def before_cancel(self):
        self._check_app_status()
        if cint(self.docstatus) == 2:
            self._error(_("Expenses request \"{0}\" has already been cancelled.").format(self.name))
        if self.status != RequestStatus.p:
            self._error(_("Only pending expenses request can be cancelled."))
        if self.status != RequestStatus.c:
            self.status = RequestStatus.c
    
    
    def on_cancel(self):
        clear_doc_cache(self.doctype, self.name)
        self.flags.expenses_status = 3
        self._update_expenses()
        self._clean_flags()
    
    
    def on_trash(self):
        self._check_app_status()
        if cint(self.docstatus) == 1:
            self._error(_("Submitted expenses request can't be removed."))
    
    
    def after_delete(self):
        self._clean_flags()
    
    
    def approve(self, ignore_permissions=False):
        self._change_status(RequestStatus.a, "approve", ignore_permissions)
    
    
    def reject(self, reason: str=None, ignore_permissions=False):
        self._change_status(RequestStatus.r, "reject", ignore_permissions, reason)
    
    
    def process(self, ignore_permissions=False):
        self._change_status(RequestStatus.e, "process", ignore_permissions)
    
    
    def _set_defaults(self):
        if not self.posting_date:
            from frappe.utils import nowdate
            
            self.posting_date = nowdate()
            self.flags.def_posting_date = 1
        
        if self.expenses and (self.is_new() or self.has_value_changed("expenses")):
            changed = 0
            for v in self.expenses:
                if (
                    v.expense and (
                        v.expense_item or
                        v.total or
                        v.is_advance or
                        v.required_by
                    )
                ):
                    changed = 1
                    v.update({
                        "expense_item": None,
                        "total": None,
                        "is_advance": None,
                        "required_by": None
                    })
            
            if changed:
                self.flags.def_expenses_data = 1
        
        if not self.status or self.status != RequestStatus.d:
            self.status = RequestStatus.d
        
        if self.workflow_state != self.status:
            self.workflow_state = self.status
    
    
    def _validate_company(self):
        if not self.company:
            self._add_error(_("A valid company is required."))
        elif self.is_new() or self.has_value_changed("company"):
            from expenses.libs import company_exists
            
            if not company_exists(self.company, {"is_group": 0}):
                self._add_error(_("Company \"{0}\" is a group or doesn't exist.").format(self.company))
    
    
    def _validate_date(self):
        if self.flags.get("def_posting_date", 0):
            return 0
        if not self.posting_date:
            self._add_error(_("A valid posting date is required."))
        elif self.is_new() or self.has_value_changed("posting_date"):
            from frappe.utils import getdate
            
            if not getdate(self.posting_date):
                self._add_error(_("A valid posting date is required."))
                return 0
            
            from expenses.libs import is_request_moderator
            
            if not is_request_moderator():
                from frappe.utils import cint, date_diff
                
                if cint(date_diff(getdate(self.posting_date), getdate())) < 0:
                    self._add_error(_("Posting date must be at least of today."))
    
    
    def _validate_expenses(self):
        if not self.expenses:
            self._add_error(_("At least one valid expense is required."))
        elif self.is_new() or self.has_value_changed("expenses"):
            table = _("Expenses")
            expenses = [v.expense for v in self.expenses if v.expense]
            exist = []
            changed = 0
            if expenses:
                if self.is_new() or not self.flags.get("def_expenses_data", 0):
                    changed = 1
                else:
                    old = self.get_doc_before_save()
                    if not old:
                        self.load_doc_before_save()
                        old = self.get_doc_before_save()
                    if not old:
                        changed = 1
                    else:
                        old = [v.expense for v in old.expenses]
                        for v in expenses:
                            if v not in old:
                                changed = 1
                                break
                        
                        old.clear()
                
                if changed:
                    from expenses.libs import get_filtered_company_expenses
                    
                    expenses = get_filtered_company_expenses(self.company, expenses)
            
            for i, v in enumerate(self.expenses):
                if not v.expense:
                    self._add_error(
                        _("{0} - #{1}: A valid expense is required.")
                        .format(table, i)
                    )
                elif v.expense in exist:
                    self._add_error(
                        _("{0} - #{1}: Expense \"{2}\" already exist.")
                        .format(table, i, v.expense)
                    )
                elif v.expense not in expenses:
                    self._add_error(
                        _("{0} - #{1}: Expense \"{2}\" isn't linked to company \"{3}\".")
                        .format(table, i, v.expense, self.company)
                    )
                else:
                    exist.append(v.expense)
            
            expenses.clear()
            exist.clear()
    
    
    def _prepare_expenses(self):
        from expenses.libs import is_request_amended
        
        self.flags.expenses_status = 1
        if is_request_amended(self.name):
            from expenses.libs import restore_expenses
            
            restore_expenses([v.expense for v in self.expenses])
    
    
    def _update_expenses(self):
        if self.flags.get("expenses_status", 0):
            expenses = [v.expense for v in self.expenses]
            if self.flags.expenses_status == 1:
                from expenses.libs import request_expenses
                
                request_expenses(expenses)
            elif self.flags.expenses_status == 2:
                from expenses.libs import approve_expenses
                
                approve_expenses(expenses)
            elif self.flags.expenses_status == 3:
                from expenses.libs import reject_expenses
                
                reject_expenses(expenses)
    
    
    def _change_status(self, status, action, ignore_permissions=False, reason=None):
        if cint(self.docstatus) != 1:
            self._error(
                _("A non-submitted expenses request can't be {0}.")
                .format(_(status.lower()))
            )
        
        if not ignore_permissions:
            from expenses.libs import is_request_reviewer
            
            if not is_request_reviewer():
                self._error(
                    _("Insufficient permission to {0} the expenses request.")
                    .format(_(action))
                )
        
        self.status = status
        self.workflow_state = status
        if status == RequestStatus.r:
            self.docstatus = 2
            if reason:
                self.add_comment(
                    "Workflow",
                    reason,
                    self.owner,
                    comment_by=frappe.session.user
                )
        
        self.save(ignore_permissions=ignore_permissions)
    
    
    def _check_app_status(self):
        if not self.flags.get("status_checked", 0):
            from expenses.libs import check_app_status
            
            check_app_status()
            self.flags.status_checked = 1
    
    
    def _clean_flags(self):
        keys = [
            "error_list",
            "def_posting_date",
            "def_expenses_data",
            "expenses_status",
            "status_checked"
        ]
        for i in range(len(keys)):
            self.flags.pop(keys.pop(0), None)
    
    
    def _add_error(self, msg):
        self.flags.error_list.append(msg)
    
    
    def _error(self, msg):
        from expenses.libs import error
        
        if isinstance(msg, list):
            if len(msg) == 1:
                msg = msg.pop(0)
            else:
                msg = msg.copy()
        
        self._clean_flags()
        error(msg, _(self.doctype))