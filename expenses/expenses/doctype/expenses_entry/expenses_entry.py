# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _, throw
from frappe.utils import nowdate
from frappe.model.document import Document
from frappe.utils import (
    flt,
    cint,
    nowdate
)

from expenses.libs import (
    clear_doc_cache,
    get_cached_value,
    get_mode_of_payment_data,
    get_current_exchange_rate,
    is_entry_moderator,
    can_use_expense_claim,
    account_exists,
    is_valid_claim,
    process_request,
    reject_request,
    enqueue_journal_entry,
    cancel_journal_entry,
    delete_attach_files,
    emit_entry_changed
)


class ExpensesEntry(Document):
    _emit_change = 0
    _request_status = 0
    _journal_status = 0
    
    
    def before_validate(self):
        if (
            self.is_new() and (
                not self.posting_date or
                (
                    self.posting_date and
                    self.posting_date != nowdate() and
                    not is_entry_moderator()
                )
            )
        ):
            self.posting_date = nowdate()
        
        elif (
            self.docstatus.is_draft() and (
                not self.posting_date or
                (
                    self.posting_date and
                    self.has_value_changed("posting_date") and
                    self.posting_date != self._get_old_posting_date() and
                    not is_entry_moderator()
                )
            )
        ):
            self.posting_date = nowdate()
        
        if self.docstatus.is_draft():
            if self.company:
                company_currency = None
                if self.mode_of_payment:
                    if (
                        not self.payment_account or
                        not self.payment_target or
                        not self.payment_currency
                    ):
                        mop = get_mode_of_payment_data(self.mode_of_payment, self.company)
                        self.payment_account = mop["account"]
                        self.payment_target = mop["type"]
                        self.payment_currency = mop["currency"]
                        company_currency = mop["company_currency"]
                
                if (
                    not flt(self.exchange_rate) and
                    self.payment_currency
                ):
                    if not company_currency:
                        company_currency = self._get_company_currency()
                    
                    self.exchange_rate = get_current_exchange_rate(
                        self.payment_currency, company_currency, self.posting_date
                    )
                    self.total_in_account_currency = 0
                
                if self.expenses:
                    for v in self.expenses:
                        if not v.account or flt(v.cost_in_account_currency) < 1:
                            self.expenses.remove(v)
                            continue
                        
                        if not v.account_currency:
                            v.account_currency = get_cached_value("Account", v.account, "account_currency")
                        
                        if not flt(v.exchange_rate):
                            if not company_currency:
                                company_currency = self._get_company_currency()
                            
                            v.exchange_rate = get_current_exchange_rate(
                                v.account_currency, company_currency, self.posting_date
                            )
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
            for v in self.attachments:
                if not v.file or v.file in existing:
                    self.attachments.remove(v)
                else:
                    existing.append(v.file)
    
    
    def validate(self):
        if self.docstatus.is_draft():
            if not self.company:
                throw(_("A valid expenses entry company is required."))
            if not self.mode_of_payment:
                throw(_("A valid expenses entry mode of payment is required."))
            if not self.posting_date:
                throw(_("A valid expenses entry posting date is required."))
            if not self.expenses:
                throw(_("At least one valid expenses entry is required."))
            if self.payment_target == "Bank":
                if not self.payment_reference:
                    throw(_("A valid expenses entry payment reference is required."))
                if not self.clearance_date:
                    throw(_("A valid expenses entry reference / clearance date is required."))
            
            self._validate_expenses()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if self.is_new() and self.expenses_request_ref:
            self._request_status = 1
        
        self._check_change()
    
    
    def before_submit(self):
        clear_doc_cache(self.doctype, self.name)
        self._journal_status = 1
        self._emit_change = 1
    
    
    def on_update(self):
        if self._request_status:
            self._handle_request()
        
        self._emit_change_event()
    
    
    def after_submit(self):
        if self._journal_status == 1:
            self._journal_status = 0
            enqueue_journal_entry(self.name)
    
    
    def before_update_after_submit(self):
        clear_doc_cache(self.doctype, self.name)
        for f in self.meta.get("fields"):
            if (
                not cint(f.allow_on_submit) and
                self.has_value_changed(f.fieldname)
            ):
                throw(_(
                    "The expenses entry cannot be modified after {0}."
                ).format("submit" if self.docstatus.is_submitted() else "cancel"))
                break
    
    
    def before_cancel(self):
        if self.expenses_request_ref:
            self._request_status = 2
        if self.docstatus.is_submitted():
            self._journal_status = 2
    
    
    def on_cancel(self):
        clear_doc_cache(self.doctype, self.name)
        if self._request_status:
            self._handle_request()
        
        if self._journal_status == 2:
            self._journal_status = 0
            cancel_journal_entry(self.name)
        
        self._emit_change = 1
        self._emit_change_event()
    
    
    def on_trash(self):
        if self.docstatus.is_submitted():
            throw(_("A submitted expenses entry cannot be removed."))
        
        if self.attachments:
            delete_attach_files(
                self.doctype,
                self.name,
                [v.file for v in self.attachments]
            )
    
    
    def after_delete(self):
        self._emit_change = 1
        self._emit_change_event("trash")
    
    
    def _validate_expenses(self):
        use_expense_claim = can_use_expense_claim()
        for v in self.expenses:
            if not account_exists(v.account, {"company": v.company}, True):
                throw(_(
                    "The expense account \"{0}\" is disabled, does not exist or does not belong to company \"{1}\"."
                ).format(v.account, v.company))
            
            if cint(v.is_paid):
                if not v.paid_by:
                    throw(_(
                        "A valid paid by employee for expense account \"{0}\" is required."
                    ).format(v.account))
                if use_expense_claim:
                    if not v.expense_claim:
                        throw(_(
                            "A valid expense claim reference for expense account \"{0}\" is required."
                        ).format(v.account))
                    if not is_valid_claim(v.expense_claim, v.paid_by, self.company):
                        throw(_(
                            "The expense claim reference for expense account \"{0}\" "
                            + "has not been submitted, "
                            + "is not paid, does not belong to the company, "
                            + "not paid by the employee or does not exist."
                        ).format(v.account))
    
    
    def _handle_request(self):
        if self._request_status == 1:
            process_request(self.expenses_request_ref)
        
        elif self._request_status == 2:
            reject_request(self.expenses_request_ref)
        
        self._request_status = 0
    
    
    def _get_old_doc(self):
        if self.is_new():
            return None
        
        doc = self.get_doc_before_save()
        if not doc:
            self.load_doc_before_save()
            doc = self.get_doc_before_save()
        
        return doc
    
    
    def _get_old_posting_date(self):
        doc = self._get_old_doc()
        if not doc:
            return None
        
        return doc.posting_date
    
    
    def _get_company_currency(self):
        return get_cached_value("Company", self.company, "default_currency")
    
    
    def _check_change(self):
        if not self.is_new():
            for f in self.meta.get("fields"):
                if self.has_value_changed(f.fieldname):
                    self._emit_change = 1
                    break
    
    
    def _emit_change_event(self, action="change"):
        if self._emit_change:
            self._emit_change = 0
            emit_entry_changed({
                "action": action,
                "entry": self.name
            })