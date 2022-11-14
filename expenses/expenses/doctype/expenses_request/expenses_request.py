# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.model.document import Document

from expenses.utils import (
    error,
    clear_document_cache,
    is_expenses_belongs_to_company,
    reserve_request_expenses,
    release_request_expenses,
    approve_request_expenses
)


class ExpensesRequest(Document):
    def before_validate(self):
        if self.docstatus.is_draft():
            if self.expenses:
                existing = []
                for i in range(len(self.expenses)):
                    v = self.expenses[i]
                    if not v.expense or v.expense in existing:
                        self.expenses.remove(v)
                    else:
                        existing.append(v.expense)
    
    
    def validate(self):
        if not self.company:
            error(_("The company is mandatory"))
        if not self.posting_date:
            error(_("The posting date is mandatory"))
        if not self.expenses:
            error(_("The expenses table must have at least one expense"))
        if self.docstatus.is_draft():
            self.validate_expenses()
            if not self.workflow_state:
                self.workflow_state = "Draft"
        else:
            self.check_changes()
    
    
    def before_save(self):
        self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
        if self.is_new():
            self._reserve_expenses = True
    
    
    def before_submit(self):
        clear_document_cache(self.doctype, self.name)
        self.check_changes()
        if self.status == "Draft":
            self.status = "Pending"
            self.workflow_state = "Pending"
    
    
    def on_update(self):
        self.handle_expenses()
    
    
    def before_update_after_submit(self):
        clear_document_cache(self.doctype, self.name)
        self.check_changes()
        if self.status == "Approved":
            if self.workflow_state != self.status:
                self.workflow_state = "Approved"
            self.reviewer = frappe.session.user
            self._approve_expenses = True
    
    
    def on_update_after_submit(self):
        self.handle_expenses()
    
    
    def before_cancel(self):
        if self.status == "Processed":
            error(_("Cannot cancel a processed expenses request before canceling its expenses entry"))
        elif self.status == "Rejected":
            if self.workflow_state != self.status:
                self.workflow_state = "Rejected"
            self.reviewer = frappe.session.user
    
    
    def on_cancel(self):
        clear_document_cache(self.doctype, self.name)
        self._release_expenses = True
        self.handle_expenses()
    
    
    def on_trash(self):
        if not self.docstatus.is_cancelled():
            error(_("Cannot delete a non-cancelled expenses request"))
    
    
    def validate_expenses(self):
        if (not is_expenses_belongs_to_company(
            [v.expense for v in self.expenses],
            self.company
        )):
            error(
                (_("Some of the expenses does not belong to {0}")
                    .format(self.company))
            )
    
    
    def check_changes(self):
        self.load_doc_before_save()
        old = self.get_doc_before_save()
        if (
            self.company != old.company or
            self.posting_date != old.posting_date or
            len(self.expenses) != len(old.expenses)
        ):
            error(_("The expenses request cannot be modified after submit"))
        
        old_expenses = [v.expense for v in old.expenses]
        for v in self.expenses:
            if v.expense not in old_expenses:
                error(_("The expenses table cannot be modified after submit"))
    
    
    def handle_expenses(self):
        if self._reserve_expenses:
            self._reserve_expenses = False
            reserve_request_expenses([v.expense for v in self.expenses])
        elif self._release_expenses:
            self._release_expenses = False
            release_request_expenses([v.expense for v in self.expenses])
        elif self._approve_expenses:
            self._approve_expenses = False
            approve_request_expenses([v.expense for v in self.expenses])
    
    
    def approve(self, ignore_permissions=False):
        self.change_status("Approved", "approve", ignore_permissions)
    
    
    def reject(self, ignore_permissions=False):
        self.change_status("Rejected", "reject", ignore_permissions)
    
    
    def process(self, ignore_permissions=False):
        self.change_status("Processed", "process", ignore_permissions)
    
    
    def change_status(self, status, action, ignore_permissions=False):
        if not self.docstatus.is_submitted():
            error(_("The expenses request cannot be {0}").format(status.lower()))
        else:
            if not ignore_permissions and "Expenses Reviewer" not in frappe.get_roles():
                error(_("Insufficient permission to {0} expenses request").format(action))
            
            self.status = status
            self.workflow_state = status
            self.save(ignore_permissions=ignore_permissions)
            if status == "Rejected":
                self.cancel()