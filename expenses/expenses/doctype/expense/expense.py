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
    is_doc_exist,
    get_item_company_account_data,
    with_expense_claim,
    requests_of_expense_exists,
    entries_of_expense_exists,
    delete_attach_files
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
            error(_("Company is mandatory"))
        if not self.expense_item:
            error(_("Expense item is mandatory"))
        if not self.required_by or not getdate(self.required_by):
            error(_("Required by date is mandatory"))
        if not self.currency:
            error(_("Currency is mandatory"))
        if flt(self.cost) <= 0:
            error(_("Cost is mandatory"))
        if flt(self.qty) <= 0:
            error(_("Quantity is mandatory"))
        if cint(self.is_paid) and not self.paid_by:
            error(_("Paid by is mandatory"))
        if cint(self.is_paid) and with_expense_claim():
            if not self.expense_claim:
                error(_("Expense claim is mandatory"))
            elif not is_doc_exist('Expense Claim', {
                "name": self.expense_claim,
                "employee": self.paid_by,
                "company": self.company,
                "is_paid": 1,
                "status": "Paid",
                "docstatus": 1
            }):
                error(_("Expense claim is invalid"))
        if self.party_type and not self.party:
            error(_("Party is mandatory"))
        if cint(self.is_requested):
            self.check_changes()
    
    
    def before_save(self):
        if not self.get_doc_before_save():
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
            error(
                _("{0} cannot be removed before removing its expenses request references")
                .format(self.doctype)
            )
        
        if self.attachments:
            delete_attach_files(
                self.doctype,
                self.name,
                [v.file for v in self.attachments]
            )
    
    
    def check_changes(self):
        if not self.get_doc_before_save():
            self.load_doc_before_save()
        if self.get_doc_before_save():
            old = self.get_doc_before_save()
            keys = [
                "company", "expense_item", "required_by", "description",
                "currency", "paid_by", "expense_claim", "project",
                "party_type", "party"
            ]
            for k in keys:
                if cstr(self.get(k)) != cstr(old.get(k)):
                    error(
                        _("{0} cannot be modified after being requested")
                        .format(self.doctype)
                    )
            
            if (
                flt(self.cost) != flt(old.cost) or
                flt(self.qty) != flt(old.qty) or
                cint(self.is_paid) != cint(old.is_paid) or
                cint(self.is_advance) != cint(old.is_advance)
            ):
                error(
                    _("{0} cannot be modified after being requested")
                    .format(self.doctype)
                )