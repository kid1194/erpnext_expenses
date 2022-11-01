# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.model.document import Document

from expenses.utils import (
    error,
    clear_document_cache,
    get_type_companies,
    expenses_of_item_exists
)


class ExpenseItem(Document):
    def autoname(self):
        if self.item_name:
            self.name = self.item_name
    
    
    def before_validate(self):
        if self.expense_accounts:
            existing = []
            for v in self.expense_accounts:
                if (
                    not v.company or
                    v.company in existing or
                    not v.account
                ):
                    self.expense_accounts.remove(v)
                else:
                    existing.append(v.company)
                    if flt(v.cost) < 0:
                        v.cost = 0
                    if flt(v.qty) < 0:
                        v.qty = 0
    
    
    def validate(self):
        if not self.item_name:
            error(_("The name field is mandatory"))
        if not self.expense_type:
            error(_("The expense type field is mandatory"))
        if frappe.db.exists(self.doctype, self.name):
            error(_("{0} expense item already exist").format(self.name))
        
        self.validate_accounts()
    
    
    def validate_accounts(self):
        if self.expense_accounts:
            companies = get_type_companies(self.expense_type)
            for v in self.expense_accounts:
                if v.company not in companies:
                    error(
                        (_("The company \"{0}\" has not been referenced in the expense type \"{1}\"")
                            .format(v.company, self.expense_type))
                    )
                if frappe.get_cached_value("Account", v.account, "company") != v.company:
                    error(
                        (_("The expense account \"{0}\" does not belong to the company \"{1}\"")
                            .format(v.account, v.company))
                    )
    
    
    def before_save(self):
        self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
    
    
    def on_trash(self):
        if expenses_of_item_exists(self.name):
            error(_(
                ("{0} cannot be removed before removing its reference in other doctypes"
                    .format(self.doctype))
            ))