# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from expenses.utils import (
    error,
    clear_document_cache,
    is_doc_exist,
    get_cached_value,
    get_mode_of_payment_data,
    get_current_exchange_rate,
    with_expense_claim,
    process_request,
    reject_request,
    enqueue_journal_entry,
    cancel_journal_entry,
    delete_attach_files
)


class ExpensesEntry(Document):
    def before_validate(self):
        if self.docstatus.is_draft() and self.company:
            
            if self.mode_of_payment:
                if not self.payment_account or not self.payment_target or not self.payment_currency:
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
                _with_expense_claim = with_expense_claim()
                for i in range(len(self.expenses)):
                    v = self.expenses[i]
                    if not v.account or flt(v.cost_in_account_currency) <= 0:
                        self.expenses.remove(v)
                        continue
                    
                    if not v.account_currency:
                        v.account_currency = get_cached_value("Account", v.account, "account_currency")
                    
                    if not flt(v.exchange_rate):
                        v.exchange_rate = flt(get_current_exchange_rate(
                            v.account_currency, company_currency, self.posting_date
                        ))
                        v.cost = 0
                        self.total_in_account_currency = 0
                        self.total = 0
                        
                    if not flt(v.cost):
                        v.cost = flt(flt(v.cost_in_account_currency) * flt(v.exchange_rate))
                    
                    if not cint(v.is_paid):
                        v.paid_by = None
                        v.expense_claim = None
                    
                    if v.party_type and not v.party:
                        v.party_type = None
                    
                    if not v.project:
                        v.project = self.default_project or None
                    
                    if not v.cost_center:
                        v.cost_center = self.default_cost_center or None
            
                if not flt(self.total):
                    total = 0
                    for v in self.expenses:
                        total += flt(v.cost)
                    self.total = flt(total)
                
                if not flt(self.total_in_account_currency):
                    self.total_in_account_currency = flt(flt(self.total) / flt(self.exchange_rate))
        
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
        if not self.mode_of_payment:
            error(_("Mode of payment is mandatory"))
        if not self.posting_date:
            error(_("Posting date is mandatory"))
        if not self.expenses:
            error(_("Expenses table must have at least one entry"))
        if self.payment_target == "Bank":
            if not self.payment_reference:
                error(_("Payment reference is mandatory"))
            if not self.clearance_date:
                error(_("Reference / clearance date is mandatory"))
        
        if self.docstatus.is_draft():
            self.validate_expenses()
    
    
    def validate_expenses(self):
        _with_expense_claim = with_expense_claim()
        for v in self.expenses:
            if not is_doc_exist("Account", v.account):
                error(
                    _("Expense account \"{0}\" does not exist").format(v.account)
                )
            if not is_doc_exist("Account", {"name": v.account, "company": v.company}):
                error(
                    _("Expense account \"{0}\" does not belong to company \"{1}\"")
                    .format(v.account, v.company)
                )
            if cint(v.is_paid) and not v.paid_by:
                error(_("Paid by for expense account \"{0}\" is mandatory").format(v.account))
            if cint(v.is_paid) and _with_expense_claim:
                if not v.expense_claim:
                    error(_("Expense claim for expense account \"{0}\" is mandatory").format(v.account))
                elif not is_doc_exist('Expense Claim', {
                    "name": v.expense_claim,
                    "employee": v.paid_by,
                    "company": self.company,
                    "is_paid": 1,
                    "status": "Paid",
                    "docstatus": 1
                }):
                    error(_("Expense claim for expense account \"{0}\" is invalid").format(v.account))
    
    
    def before_save(self):
        if not self.get_doc_before_save():
            self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
        if self.is_new() and self.expenses_request_ref:
            self._process_request = True
    
    
    def on_update(self):
        self.handle_request()
    
    
    def before_update_after_submit(self):
        clear_document_cache(self.doctype, self.name)
        self.check_changes()
    
    
    def check_changes(self):
        if not self.get_doc_before_save():
            self.load_doc_before_save()
        if self.get_doc_before_save():
            old = self.get_doc_before_save()
            as_len = ["expenses", "attachments"]
            as_flt = ["exchange_rate", "total"]
            for k, v in old.items():
                if (
                    (k in as_len and len(v) != len(self.get(k))) or
                    (k in as_flt and flt(v) != flt(self.get(k))) or
                    (v != self.get(k))
                ):
                    error(_("{0} cannot be modified after submit").format(self.doctype))
            
            as_flt = ["cost_in_account_currency", "exchange_rate", "cost"]
            as_int = ["is_advance", "is_paid"]
            for i in range(len(self.expenses)):
                for k, v in self.expenses[i].items():
                    if (
                        (k in as_flt and flt(v) != flt(old.expenses[i].get(k))) or
                        (k in as_int and cint(v) != cint(old.expenses[i].get(k))) or
                        (v != old.expenses[i].get(k))
                    ):
                        error(_("{0} cannot be modified after submit").format(self.doctype))
    
    
    def after_submit(self):
        enqueue_journal_entry(self.name)
    
    
    def before_cancel(self):
        if self.expenses_request_ref:
            self._reject_request = True
    
    
    def on_cancel(self):
        clear_document_cache(self.doctype, self.name)
        self.handle_request()
        if self.docstatus.is_submitted():
            cancel_journal_entry(self.name)
    
    
    def handle_request(self):
        if self._process_request:
            self._process_request = False
            process_request(self.expenses_request_ref)
        elif self._reject_request:
            self._reject_request = False
            reject_request(self.expenses_request_ref)
    
    
    def on_trash(self):
        if not self.docstatus.is_cancelled():
            error(_("Cannot delete a non-cancelled {0}").format(self.doctype))
        
        if self.attachments:
            delete_attach_files(
                self.doctype,
                self.name,
                [v.file for v in self.attachments]
            )