# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document

from expenses.utils import (
    error,
    clear_doc_cache,
    get_cached_value,
    expenses_of_item_exists
)


class ExpenseItem(Document):
    def before_validate(self):
        if self.expense_accounts:
            existing = {}
            for i in range(len(self.expense_accounts)):
                v = self.expense_accounts[i]
                if (
                    not v.company or not v.account or
                    (v.company in existing and existing[v.company] == v.account)
                ):
                    self.expense_accounts.remove(v)
                else:
                    existing[v.company] = v.account
                    for k in ["cost", "qty"]:
                        min_k = "min_" + k
                        max_k = "max_" + k
                        val = flt(v[k])
                        if val != 0:
                            if val < 0:
                                v[k] = 0
                            v[min_k] = 0
                            v[max_k] = 0
                        else:
                            min_val = flt(v[min_k])
                            max_val = flt(v[max_k])
                            if max_val < 0:
                                v[max_k] = 0
                            if min_val < 0 or min_val > max_val:
                                v[min_k] = 0
    
    
    def validate(self):
        if not self.item_name:
            error(_("Name is mandatory"))
        if not self.expense_type:
            error(_("Expense type is mandatory"))
        
        self._validate_name()
        self._validate_type()
        self._validate_accounts()
    
    
    def before_save(self):
        if not self.get_doc_before_save():
            self.load_doc_before_save()
        clear_doc_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
    
    
    def on_trash(self):
        if expenses_of_item_exists(self.name):
            error(
                _("{0} cannot be removed before removing its references in Expense doctype")
                .format(self.doctype)
            )
    
    
    def _validate_name(self):
        if frappe.db.exists(self.doctype, self.name):
            error(_("{0} \"{1}\" already exist").format(self.doctype, self.name))
    
    
    def _validate_type(self):
        if frappe.db.exists("Expense Type", {"name": self.expense_Type, "disabled": 0}):
            error(_("Expense Type \"{1}\" is disabled or does not exist").format(self.expense_Type))
    
    
    def _validate_accounts(self):
        if self.expense_accounts:
            for v in self.expense_accounts:
                if not frappe.db.exists("Account", {"name": v.account, "company": v.company}):
                    error(
                        _("Expense account \"{0}\" does not exist or does not belong to company \"{1}\"")
                        .format(v.account, v.company)
                    )