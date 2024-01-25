# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _, throw
from frappe.utils import (
    cint,
    nowdate
)
from frappe.model.document import Document
from frappe.model.docstatus import DocStatus

from expenses.libs import (
    clear_doc_cache,
    RequestStatus,
    is_company_expenses,
    is_request_amended,
    restore_expenses,
    request_expenses,
    approve_expenses,
    reject_expenses,
    is_request_moderator,
    is_request_reviewer,
    emit_request_changed
)


class ExpensesRequest(Document):
    def before_validate(self):
        if (
            self.is_new() and (
                not self.posting_date or
                (
                    self.posting_date and
                    self.posting_date != nowdate() and
                    not is_request_moderator()
                )
            )
        ):
            self.posting_date = nowdate()
        
        elif (
            self.docstatus.is_draft() and (
                not self.posting_date or
                (
                    self.posting_date and
                    self.has_value_changed("posting_date") and
                    self.posting_date != self._get_old_posting_date() and
                    not is_request_moderator()
                )
            )
        ):
            self.posting_date = nowdate()
        
        if (
            (
                self.is_new() and self.expenses
            ) or (
                self.docstatus.is_draft() and
                self.has_value_changed("expenses")
            )
        ):
            existing = []
            defs = {
                "expense_item": None,
                "total": None,
                "is_advance": None,
                "required_by": None
            }
            for v in self.expenses:
                if not v.expense or v.expense in existing:
                    self.expenses.remove(v)
                else:
                    existing.append(v.expense)
                    v.update(defs)
    
    
    def validate(self):
        if self.docstatus.is_draft():
            if not self.company:
                throw(_("A valid expense request company is required."))
            if not self.posting_date:
                throw(_("A valid expense request posting date is required."))
            if not self.expenses:
                throw(_("At least one valid expense is required."))
            
            self._validate_expenses()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if not self.status:
            self.status = RequestStatus.Draft
        
        if self.workflow_state != self.status:
            self.workflow_state = self.status
        
        if self.is_new():
            self.flags.expenses_status = 1
            if is_request_amended(self.name) and self.expenses:
                restore_expenses([v.expense for v in self.expenses])
        
        self._check_change()
    
    
    def before_submit(self):
        clear_doc_cache(self.doctype, self.name)
        if (
            not self.status or
            self.status != RequestStatus.Pending
        ):
            self.status = RequestStatus.Pending
        
        if self.workflow_state != self.status:
            self.workflow_state = self.status
        
        self.flags.emit_change = True
    
    
    def on_update(self):
        if self.flags.get("expenses_status", 0):
            self._handle_expenses()
        
        self._emit_change_event()
    
    
    def before_update_after_submit(self):
        is_reviewer = is_request_reviewer()
        if (
            (
                self.workflow_state == RequestStatus.Approved or
                self.workflow_state == RequestStatus.Rejected
            ) and not is_request_reviewer()
        ):
            throw(_("Insufficient permission to modify the expenses request."))
        
        if (
            self.status != RequestStatus.Pending and
            self.workflow_state == self.status and
            (
                self.has_value_changed("company") or
                self.has_value_changed("posting_date") or
                self.has_value_changed("expenses")
            )
        ):
            throw(_("The expenses request cannot be modified."))
        
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
        if self.flags.get("expenses_status", 0):
            self._handle_expenses()
        
        self._emit_change_event()
    
    
    def before_cancel(self):
        if self.docstatus.is_cancelled():
            throw(_("The expenses request \"{0}\" has already been cancelled.").format(self.name))
        
        if self.status != RequestStatus.Pending:
            if self.status == RequestStatus.Approved:
                throw(_("An approved expenses request cannot be cancelled."))
            elif self.status == RequestStatus.Rejected:
                throw(_("A rejected expenses request cannot be cancelled."))
            elif self.status == RequestStatus.Processed:
                throw(_("A processed expenses request cannot be cancelled."))
            else:
                throw(_("An expenses request with invalid status cannot be cancelled."))
        
        self.status = RequestStatus.Cancelled
    
    
    def on_cancel(self):
        clear_doc_cache(self.doctype, self.name)
        
        self.flags.expenses_status = 3
        self._handle_expenses()
        
        self.flags.emit_change = True
        self._emit_change_event()
    
    
    def on_trash(self):
        if self.docstatus.is_submitted():
            throw(_("A submitted expenses request cannot be removed."))
    
    
    def after_delete(self):
        self.flags.emit_change = True
        self._emit_change_event("trash")
    
    
    def approve(self, ignore_permissions=False):
        self._change_status(RequestStatus.Approved, "approve", ignore_permissions)
    
    
    def reject(self, reason: str=None, ignore_permissions=False):
        self._change_status(RequestStatus.Rejected, "reject", ignore_permissions, reason)
    
    
    def process(self, ignore_permissions=False):
        self._change_status(RequestStatus.Processed, "process", ignore_permissions)
    
    
    def _validate_expenses(self):
        if (not is_company_expenses(
            [v.expense for v in self.expenses],
            self.company
        )):
            throw(_("An expenses request cannot include expenses of multiple companies."))
    
    
    def _handle_expenses(self):
        if self.flags.get("expenses_status", 0):
            expenses = [v.expense for v in self.expenses]
            if self.flags.expenses_status == 1:
                request_expenses(expenses)
            elif self.flags.expenses_status == 2:
                approve_expenses(expenses)
            elif self.flags.expenses_status == 3:
                reject_expenses(expenses)
            
            self.flags.pop("expenses_status")
    
    
    def _change_status(self, status, action, ignore_permissions=False, reason=None):
        if not self.docstatus.is_submitted():
            status = status.lower()
            throw(_(f"The expenses request cannot be {status}."))
        
        if (
            not ignore_permissions and
            not is_request_reviewer()
        ):
            throw(_(f"Insufficient permission to {action} an expenses request."))
        
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
    
    
    def _get_old_posting_date(self):
        if self.is_new():
            return None
        
        doc = self.get_doc_before_save()
        if not doc:
            self.load_doc_before_save()
            doc = self.get_doc_before_save()
        
        if not doc:
            return None
        
        return doc.posting_date
    
    
    def _check_change(self):
        if not self.is_new():
            submitted = self.docstatus.is_submitted()
            for f in self.meta.get("fields"):
                if (
                    self.has_value_changed(f.fieldname) and
                    (
                        (
                            submitted and
                            f.fieldname == "workflow_state"
                        ) or (
                            not submitted and
                            not cint(f.allow_on_submit)
                        )
                    )
                ):
                    self.flags.emit_change = True
                    break
    
    
    def _emit_change_event(self, action="change"):
        if self.flags.get("emit_change", False):
            self.flags.pop("emit_change")
            emit_request_changed({
                "action": action,
                "request": self.name
            })