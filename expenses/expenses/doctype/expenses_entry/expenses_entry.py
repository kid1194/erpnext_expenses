# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, getdate

from expenses.utils import (
    error,
    clear_document_cache,
    get_cached_value,
    get_mode_of_payment_data,
    get_current_exchange_rate,
    reject_request,
    enqueue_journal_entry
)


class ExpensesEntry(Document):
    def before_validate(self):
        if self.docstatus == 0 and self.company:
            
            if self.mode_of_payment:
                if not self.payment_account or not self.payment_currency:
                    mop_data = get_mode_of_payment_data(self.mode_of_payment, self.company)
                    self.payment_account = mop_data["account"]
                    self.payment_target = mop_data["type"]
                    self.payment_currency = mop_data["currency"]
            
            company_currency = get_cached_value("Company", self.company, "default_currency")
            
            if not flt(self.exchange_rate):
                self.exchange_rate = get_current_exchange_rate(
                    self.payment_currency, company_currency, self.posting_date
                )
                self.total_in_account_currency = 0
            
            if self.expenses:
                for v in self.expenses:
                    if v.account and not v.account_currency:
                        v.account_currency = get_cached_value("Account", v.account, "account_currency")
                    if v.account_currency and not flt(v.exchange_rate):
                        v.exchange_rate = flt(get_current_exchange_rate(
                            v.account_currency, company_currency, self.posting_date
                        ))
                        v.cost = 0
                        self.total_in_account_currency = 0
                        self.total = 0
                        
                    if flt(v.cost_in_account_currency) and not flt(v.cost):
                        v.cost = flt(flt(v.cost_in_account_currency) * flt(v.exchange_rate))
                    if self.default_project and not v.project:
                        v.project = self.default_project
                    if self.default_cost_center and not v.cost_center:
                        v.cost_center = self.default_cost_center
            
                if not flt(self.total):
                    total = 0
                    for v in self.expenses:
                        total += flt(v.cost)
                    self.total = flt(total)
                
                if not flt(self.total_in_account_currency):
                    self.total_in_account_currency = flt(flt(self.total) / flt(self.exchange_rate))
    
    
    def validate(self):
        if not self.company:
            error(_("The company is mandatory"))
        if not self.mode_of_payment:
            error(_("The mode of payment is mandatory"))
        if not self.posting_date:
            error(_("The posting date is mandatory"))
        if not self.expenses:
            error(_("The expenses table must have at least one entry"))
        if self.payment_target == "Bank":
            if not self.payment_reference:
                error(_("The payment reference is mandatory"))
            if not self.clearance_date:
                error(_("The reference / clearance date is mandatory"))
        
        if cint(self.docstatus) == 0:
            self.validate_expenses()
    
    
     def before_save(self):
        self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
    
    
    def before_update_after_submit(self):
        clear_document_cache(self.doctype, self.name)
        self.check_changes()
    
    
    def after_submit(self):
        enqueue_journal_entry(self.name)
    
    
    def on_cancel(self):
        clear_document_cache(self.doctype, self.name)
        is self.expenses_request_ref:
            reject_request(self.expenses_request_ref)
    
    
    def on_trash(self):
        if cint(self.docstatus) != 2:
            error(_("Cannot delete a non-cancelled expenses entry"))
    
    
    def after_delete(self):
        clear_document_cache(self.doctype, self.name)
    
    
    def validate_expenses(self):
        accounts = [v.account for v in self.expenses]
        for account in accounts:
            if get_cached_value("Account", account, "company") != self.company:
                error(_("The expense account {0} does not belong to {0}").format(
                    account, self.company
                ))
    
    
    def check_changes(self):
        self.load_doc_before_save()
        old = self.get_doc_before_save()
        keys = [
            "company", "mode_of_payment", "posting_date",
            "default_project", "default_cost_center",
            "payment_account", "payment_currency",
            "payment_reference", "clearance_date",
            "expenses_request_ref"
        ]
        for k in keys:
            if self.get(k) != old.get(k):
                error(_("The expenses entry cannot be modified after submit"))
        
        if (
            len(self.expenses) != len(old.expenses) or
            flt(self.exchange_rate) != flt(old.exchange_rate) or
            flt(self.total) != flt(old.total)
        ):
            error(_("The expenses entry cannot be modified after submit"))
        
        old_accounts = [v.account for v in old.expenses]
        for v in self.expenses:
            if v.account not in old_accounts:
                error(_("The expenses cannot be modified after submit"))