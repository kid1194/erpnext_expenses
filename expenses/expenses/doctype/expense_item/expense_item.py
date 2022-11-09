# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document

from expenses.utils import (
    error,
    get_cached_value,
    clear_document_cache,
    expenses_of_item_exists
)


class ExpenseItem(Document):
    def before_validate(self):
        if self.expense_accounts:
            existing = []
            for v in self.expense_accounts:
                if not v.company or v.company in existing:
                    self.expense_accounts.remove(v)
                else:
                    existing.append(v.company)
                    cost = flt(v.cost)
                    if cost < 0 or cost > 0:
                        if cost < 0:
                            v.cost = 0
                        v.min_cost = 0
                        v.max_cost = 0
                    else:
                        min_cost = flt(v.min_cost)
                        max_cost = flt(v.max_cost)
                        if min_cost < 0:
                            v.min_cost = 0
                        elif max_cost < 0:
                            v.max_cost = 0
                        elif min_cost > 0 and min_cost > max_cost:
                            v.min_cost = 0
                    qty = flt(v.qty)
                    if qty < 0 or qty > 0:
                        if qty < 0:
                            v.qty = 0
                        v.min_qty = 0
                        v.max_qty = 0
                    else:
                        min_qty = flt(v.min_qty)
                        max_qty = flt(v.max_qty)
                        if min_qty < 0:
                            v.min_qty = 0
                        elif max_qty < 0:
                            v.max_qty = 0
                        elif min_qty > 0 and min_qty > max_qty:
                            v.min_qty = 0
    
    
    def validate(self):
        if not self.item_name:
            error(_("The name is mandatory"))
        if not self.expense_type:
            error(_("The expense type is mandatory"))
        if frappe.db.exists(self.doctype, self.name):
            error(_("{0} already exist").format(self.name))
        
        self.validate_accounts()
    
    
    def validate_accounts(self):
        if self.expense_accounts:
            for v in self.expense_accounts:
                if v.account and get_cached_value("Account", v.account, "company") != v.company:
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
                ("{0} cannot be removed before removing its reference in Expense doctype"
                    .format(self.doctype))
            ))