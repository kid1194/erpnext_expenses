# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint, nowdate
from frappe.model.document import Document
from frappe.model.docstatus import DocStatus

from expenses.libs import (
    error,
    clear_doc_cache,
    is_request_reviewer
)


class ExpensesRequest(Document):
    def before_insert(self):
        self._set_defaults(True)
        self._prepare_expenses()
    
    
    def before_validate(self):
        self._set_defaults()
    
    
    def validate(self):
        if self.docstatus.is_draft():
            if not self.company:
                self._error(_("A valid company is required."))
            if not self.posting_date:
                self._error(_("A valid posting date is required."))
            if not self.expenses:
                self._error(_("At least one valid expense is required."))
            
            self._validate_expenses()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        self._prepare_expenses()
        self._check_change()
    
    
    def before_submit(self):
        clear_doc_cache(self.doctype, self.name)
        if self.status != RequestStatus.Pending:
            self.status = RequestStatus.Pending
        if self.workflow_state != self.status:
            self.workflow_state = self.status
        self.flags.emit_change = True
    
    
    def on_update(self):
        self._handle_expenses()
        self._emit_change()
    
    
    def before_update_after_submit(self):
        if (
            self.workflow_state in (RequestStatus.Approved, RequestStatus.Rejected) and
            not is_request_reviewer()
        ):
            self._error(_("Insufficient permission to modify the expenses request."))
        
        if (
            self.status != RequestStatus.Pending and
            self.workflow_state == self.status and
            (
                self.has_value_changed("company") or
                self.has_value_changed("posting_date") or
                self.has_value_changed("expenses")
            )
        ):
            self._error(_("The expenses request cannot be modified."))
        
        clear_doc_cache(self.doctype, self.name)
        if self.workflow_state == RequestStatus.Approved:
            self.flags.expenses_status = 2
        elif self.workflow_state == RequestStatus.Rejected:
            self.flags.expenses_status = 3
        if not self.reviewer:
            self.reviewer = frappe.session.user
        if self.status != self.workflow_state:
            self.status = self.workflow_state
        self._check_change()
    
    
    def on_update_after_submit(self):
        self._handle_expenses()
        self._emit_change()
    
    
    def before_cancel(self):
        if self.docstatus.is_cancelled():
            self._error(_("Expenses request \"{0}\" has already been cancelled.").format(self.name))
        if self.status != RequestStatus.Pending:
            if self.status == RequestStatus.Approved:
                self._error(_("Approved expenses request cannot be cancelled."))
            elif self.status == RequestStatus.Rejected:
                self._error(_("Rejected expenses request cannot be cancelled."))
            elif self.status == RequestStatus.Processed:
                self._error(_("Processed expenses request cannot be cancelled."))
            else:
                self._error(_("Only pending expenses request can be cancelled."))
        
        self.status = RequestStatus.Cancelled
    
    
    def on_cancel(self):
        clear_doc_cache(self.doctype, self.name)
        
        self.flags.expenses_status = 3
        self._handle_expenses()
        
        self.flags.emit_change = True
        self._emit_change()
    
    
    def on_trash(self):
        if self.docstatus.is_submitted():
            self._error(_("Submitted expenses request cannot be removed."))
    
    
    def after_delete(self):
        self.flags.emit_change = True
        self._emit_change("trash")
    
    
    def approve(self, ignore_permissions=False):
        self._change_status(RequestStatus.Approved, "approve", ignore_permissions)
    
    
    def reject(self, reason: str=None, ignore_permissions=False):
        self._change_status(RequestStatus.Rejected, "reject", ignore_permissions, reason)
    
    
    def process(self, ignore_permissions=False):
        self._change_status(RequestStatus.Processed, "process", ignore_permissions)
    
    
    def _set_defaults(self, insert=False):
        from expenses.libs import is_request_moderator
        
        insert = insert or self.is_new()
        now = nowdate()
        is_moderator = is_request_moderator()
        if (
            insert and (
                not self.posting_date or (
                    self.posting_date != now and
                    not is_moderator
                )
            )
        ):
            self.posting_date = now
        elif (
            not insert and self.docstatus.is_draft() and (
                not self.posting_date or (
                    self.has_value_changed("posting_date") and
                    self.posting_date != self._old_posting_date() and
                    not is_moderator
                )
            )
        ):
            self.posting_date = now
        
        if (
            (insert and self.expenses) or
            (self.docstatus.is_draft() and self.has_value_changed("expenses"))
        ):
            exist = []
            defs = {
                "expense_item": None,
                "total": None,
                "is_advance": None,
                "required_by": None
            }
            for v in self.expenses:
                if not v.expense or v.expense in exist:
                    self.expenses.remove(v)
                else:
                    exist.append(v.expense)
                    v.update(defs)
        
        if not self.status:
            self.status = RequestStatus.Draft
        
        if self.workflow_state != self.status:
            self.workflow_state = self.status
    
    
    def _prepare_expenses(self):
        if self.is_new():
            from expenses.libs import is_request_amended
            
            self.flags.expenses_status = 1
            if is_request_amended(self.name) and self.expenses:
                from expenses.libs import restore_expenses
                
                restore_expenses([v.expense for v in self.expenses])
    
    
    def _validate_expenses(self):
        from expenses.libs import is_company_expenses
        
        if not is_company_expenses([v.expense for v in self.expenses], self.company):
            self._error(_("An expenses request can only include expenses for a single company."))
    
    
    def _handle_expenses(self):
        if self.flags.get("expenses_status", 0):
            status = self.flags.pop("expenses_status")
            expenses = [v.expense for v in self.expenses]
            if status == 1:
                from expenses.libs import request_expenses
                
                request_expenses(expenses)
            elif status == 2:
                from expenses.libs import approve_expenses
                
                approve_expenses(expenses)
            elif status == 3:
                from expenses.libs import reject_expenses
                
                reject_expenses(expenses)
    
    
    def _change_status(self, status, action, ignore_permissions=False, reason=None):
        if not self.docstatus.is_submitted():
            status = status.lower()
            self._error(_("Expenses request cannot be {0}.").format(_(status)))
        
        if not ignore_permissions and not is_request_reviewer():
            self._error(_("Insufficient permission to {0} an expenses request.").format(_(action)))
        
        self.status = status
        self.workflow_state = status
        
        if status == RequestStatus.Rejected:
            self.docstatus = DocStatus.cancelled()
            if reason:
                self.add_comment(
                    "Workflow",
                    reason,
                    self.owner,
                    comment_by=frappe.session.user
                )
        
        self.save(ignore_permissions=ignore_permissions)
    
    
    def _old_posting_date(self):
        if self.is_new():
            return None
        doc = self.get_doc_before_save()
        if not doc:
            self.load_doc_before_save()
            doc = self.get_doc_before_save()
        return doc.posting_date if doc else None
    
    
    def _check_change(self):
        if not self.is_new():
            submitted = self.docstatus.is_submitted()
            for f in self.meta.get("fields", []):
                if (
                    self.has_value_changed(f.fieldname) and (
                        (submitted and f.fieldname == "workflow_state") or
                        (not submitted and not cint(f.allow_on_submit))
                    )
                ):
                    self.flags.emit_change = True
                    break
    
    
    def _emit_change(self, action="change"):
        if self.flags.get("emit_change", False):
            from expenses.libs import emit_request_changed
            
            self.flags.pop("emit_change")
            emit_request_changed({
                "action": action,
                "request": self.name
            })
    
    
    def _error(self, msg):
        error(msg, _("Expenses Request Error"))