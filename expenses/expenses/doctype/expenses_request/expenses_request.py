# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from expenses.utils import (
    error,
    clear_document_cache,
    is_expenses_belongs_to_company,
    reserve_request_expenses,
    release_request_expenses
)


class ExpensesRequest(Document):
    def before_validate(self):
        if cint(self.docstatus) == 0:
            if self.expenses:
                existing = []
                for v in self.expenses:
                    if v.expense in existing:
                        self.expenses.remove(v)
                    else:
                        existing.append(v.expense)
    
    
    def validate(self):
        if not self.company:
            error(_("The company field is mandatory"))
        if not self.posting_date:
            error(_("The posting date field is mandatory"))
        if not self.expenses:
            error(_("The expenses table must have at least one expense"))
        
        if cint(self.docstatus) == 0:
            self.validate_expenses()
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
    
    
    def on_update(self):
       self.handle_expenses()
    
    
    def before_update_after_submit(self):
        clear_document_cache(self.doctype, self.name)
        self.check_changes()
    
    
    def before_cancel(self):
        if self.status == "Processed":
            error(_("Cannot cancel a processed expenses request before canceling its expenses entry"))
    
    
    def on_cancel(self):
        clear_document_cache(self.doctype, self.name)
        self._release_expenses = True
        self.handle_expenses()
    
    
    def on_trash(self):
        if cint(self.docstatus) != 2:
            error(_("Cannot delete a non-cancelled expenses request"))
    
    
    def after_delete(self):
        clear_document_cache(self.doctype, self.name)
        self._release_expenses = True
        self.handle_expenses()
    
    
    def validate_expenses(self):
        if (not is_expenses_belongs_to_company(
            [v.expense for v in self.expenses],
            self.company
        )):
            error(
                (_("The some of the expenses does not belong to {0}")
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
                error(_("The expenses cannot be modified after submit"))
    
    
    def handle_expenses(self):
         if self._reserve_expenses:
            self._reserve_expenses = False
            reserve_request_expenses([v.expense for v in self.expenses])
         elif self._release_expenses:
            self._release_expenses = False
            release_request_expenses([v.expense for v in self.expenses])