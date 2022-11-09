# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.utils import cint, flt, getdate
from frappe.model.document import Document

from expenses.utils import (
    error,
    clear_document_cache,
    get_item_company_account_data,
    requests_of_expense_exists
)


class Expense(Document):
    def before_validate(self):
        if not cint(self.is_requested):
            if self.expense_item and self.company:
                temp = get_item_company_account_data(self.expense_item, self.company)
                if not self.expense_account or not self.currency:
                    self.expense_account = temp.get("account")
                    self.currency = temp.get("currency")
                
                old_cost = flt(self.cost)
                old_qty = flt(self.qty)
                
                t_cost = flt(temp.get("cost"))
                t_min_cost = flt(temp.get("min_cost")
                t_max_cost = flt(temp.get("max_cost")
                if t_cost:
                    self.cost = t_cost
                elif t_min_cost or t_max_cost:
                    if t_min_cost and flt(self.cost) < t_min_cost:
                        self.cost = t_min_cost
                    elif t_max_cost and flt(self.cost) > t_max_cost:
                        self.cost = t_max_cost
                
                t_qty = flt(temp.get("qty"))
                t_min_qty = flt(temp.get("min_qty")
                t_max_qty = flt(temp.get("max_qty")
                if t_qty:
                    self.qty = t_qty
                elif t_min_qty or t_max_qty:
                    if t_min_qty and flt(self.qty) < t_min_qty:
                        self.qty = t_min_qty
                    elif t_max_qty and flt(self.qty) > t_max_qty:
                        self.qty = t_max_qty
                
                if old_cost != flt(self.cost) or old_qty != flt(self.qty):
                    self.total = flt(flt(self.cost) * flt(self.qty))
            
            if not cint(self.is_paid):
                self.paid_by = None
            
            if not self.party_type:
                self.party = None
            
            if self.attachments:
                existing = []
                for v in self.attachments:
                    if not v.file or v.file in existing:
                        self.attachments.remove(v)
                    else:
                        existing.append(v.file)
    
    
    def validate(self):
        if not self.company:
            error(_("The company is mandatory"))
        if not self.expense_item:
            error(_("The expense item is mandatory"))
        if not self.required_by:
            error(_("The required by date is mandatory"))
        elif getdate(self.required_by) < getdate():
            error(_("The minimum required by date is today"))
        if not self.currency:
            error(_("The currency is mandatory"))
        if flt(self.cost) <= 0:
            error(_("The cost is mandatory"))
        if flt(self.qty) <= 0:
            error(_("The quantity is mandatory"))
        if cint(self.is_paid) and not self.paid_by:
            error(_("The paid by is mandatory"))
        if self.party_type and not self.party:
            error(_("The party is mandatory"))
        
        self.check_changes()
    
    
    def before_save(self):
        self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
    
    
    def on_trash(self):
        if cint(self.is_requested) or requests_of_expense_exists(self.name):
            error(_("The expense cannot be removed before removing its reference in the expenses request doctype"))
    
    
    def check_changes(self):
        if cint(self.is_requested):
            self.load_doc_before_save()
            old = self.get_doc_before_save()
            keys = [
                "company", "expense_item", "required_by", "description",
                "currency", "paid_by", "project", "party_type", "party"
            ]
            for k in keys:
                if str(self.get(k)) != str(old.get(k)):
                    error(_("The expense cannot be modified after adding it to an expenses request"))
            
            if (
                flt(self.cost) != flt(old.cost) or
                flt(self.qty) != flt(old.qty) or
                cint(self.is_paid) != cint(old.is_paid) or
                cint(self.is_advance) != cint(old.is_advance)
            ):
                error(_("The expense cannot be modified after adding it to an expenses request"))