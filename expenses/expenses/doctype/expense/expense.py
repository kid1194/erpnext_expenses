# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint, flt, cstr, getdate
from frappe.model.document import Document

from expenses.utils import (
    error,
    clear_document_cache,
    get_item_company_account_data,
    with_expense_claim,
    requests_of_expense_exists,
    entries_of_expense_exists
)


class Expense(Document):
    def before_validate(self):
        if not cint(self.is_requested):
            if self.expense_item and self.company:
                temp = get_item_company_account_data(self.expense_item, self.company)
                if not self.expense_account or not self.currency:
                    self.expense_account = temp.account
                    self.currency = temp.currency
                
                old_cost = flt(self.cost)
                old_qty = flt(self.qty)
                
                for k in ["cost", "qty"]:
                    if temp[k]:
                        self.set(k, temp[k])
                    else:
                        min_k = "min_" + k
                        max_k = "max_" + k
                        if temp[min_k] or temp[max_k]:
                            if temp[min_k] and flt(self.get(k)) < temp[min_k]:
                                self.set(k, temp[min_k])
                            elif temp[max_k] and flt(self.get(k)) > temp[max_k]:
                                self.set(k, temp[max_k])
                
                if old_cost != flt(self.cost) or old_qty != flt(self.qty):
                    self.total = flt(flt(self.cost) * flt(self.qty))
            
            if not cint(self.is_paid):
                self.paid_by = None
                self.expense_claim = None
            elif self.expense_claim and not with_expense_claim():
                self.expense_claim = None
            
            if not self.party_type:
                self.party = None
            
            if self.attachments:
                existing = []
                for i in range(len(self.attachments)):
                    v = self.attachments[i]
                    if not v.file or v.file in existing:
                        self.attachments.remove(v)
                    else:
                        existing.append(v.file)
    
    
    def validate(self):
        if not self.company:
            error(_("The company is mandatory"))
        elif not self.expense_item:
            error(_("The expense item is mandatory"))
        elif not self.required_by or not getdate(self.required_by):
            error(_("The required by date is mandatory"))
        elif not self.currency:
            error(_("The currency is mandatory"))
        elif flt(self.cost) <= 0:
            error(_("The cost is mandatory"))
        elif flt(self.qty) <= 0:
            error(_("The quantity is mandatory"))
        elif cint(self.is_paid) and not self.paid_by:
            error(_("The paid by is mandatory"))
        elif cint(self.is_paid) and with_expense_claim():
            if not self.expense_claim:
                error(_("The expense claim is mandatory"))
            elif not frappe.db.exists('Expense Claim', {
                "name": self.expense_claim,
                "employee": self.paid_by,
                "company": self.company,
                "is_paid": 1,
                "status": "Paid",
                "docstatus": 1
            }):
                error(_("The expense claim is invalid"))
        elif self.party_type and not self.party:
            error(_("The party is mandatory"))
        elif cint(self.is_requested):
            self.check_changes()
    
    
    def before_save(self):
        self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
    
    
    def on_trash(self):
        if (
            cint(self.is_requested) or
            requests_of_expense_exists(self.name) or
            entries_of_expense_exists(self.name)
        ):
            error(_("The expense cannot be removed before removing its reference in the expenses request doctype"))
    
    
    def check_changes(self):
        self.load_doc_before_save()
        old = self.get_doc_before_save()
        keys = [
            "company", "expense_item", "required_by", "description",
            "currency", "paid_by", "expense_claim", "project",
            "party_type", "party"
        ]
        for k in keys:
            if cstr(self.get(k)) != cstr(old.get(k)):
                error(_("The expense cannot be modified after adding it to an expenses request"))
        
        if (
            flt(self.cost) != flt(old.cost) or
            flt(self.qty) != flt(old.qty) or
            cint(self.is_paid) != cint(old.is_paid) or
            cint(self.is_advance) != cint(old.is_advance)
        ):
            error(_("The expense cannot be modified after adding it to an expenses request"))