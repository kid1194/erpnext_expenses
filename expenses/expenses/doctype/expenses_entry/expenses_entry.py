# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import (
    flt,
    cint,
    nowdate
)

from expenses.libs import (
    clear_doc_cache,
    get_cached_value
)


class ExpensesEntry(Document):
    def before_insert(self):
        self._set_defaults(True)
    
    
    def before_validate(self):
        self._set_defaults()
    
    
    def validate(self):
        if self.docstatus.is_draft():
            if not self.company:
                self._error(_("A valid company is required."))
            if not self.mode_of_payment:
                self._error(_("A valid mode of payment is required."))
            if not self.posting_date:
                self._error(_("A valid posting date is required."))
            if not self.expenses:
                self._error(_("At least one valid expense is required."))
            if self.payment_target == "Bank":
                if not self.payment_reference:
                    self._error(_("A valid payment reference is required."))
                if not self.clearance_date:
                    self._error(_("A valid reference / clearance date is required."))
            
            self._validate_expenses()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if self.is_new() and self.expenses_request_ref:
            self.flags.request_status = 1
        
        self._check_change()
    
    
    def before_submit(self):
        clear_doc_cache(self.doctype, self.name)
        self.flags.journal_status = 1
        self.flags.emit_change = True
    
    
    def on_update(self):
        if self.flags.get("request_status", 0):
            self._handle_request()
        
        self._emit_change()
    
    
    def after_submit(self):
        if self.flags.get("journal_status", 0) == 1:
            from expenses.libs import enqueue_journal_entry
            
            self.flags.pop("journal_status")
            enqueue_journal_entry(self.name)
    
    
    def before_update_after_submit(self):
        clear_doc_cache(self.doctype, self.name)
        for f in self.meta.get("fields", []):
            if (
                not cint(f.allow_on_submit) and
                self.has_value_changed(f.fieldname)
            ):
                self._error(_(
                    "The expenses entry cannot be modified after {0}."
                ).format(_("submit") if self.docstatus.is_submitted() else _("cancel")))
                break
    
    
    def before_cancel(self):
        if self.expenses_request_ref:
            self.flags.request_status = 2
        if self.docstatus.is_submitted():
            self.flags.journal_status = 2
    
    
    def on_cancel(self):
        clear_doc_cache(self.doctype, self.name)
        if self.flags.get("request_status", 0):
            self._handle_request()
        
        if self.flags.get("journal_status", 0) == 2:
            from expenses.libs import cancel_journal_entry
            
            self.flags.pop("journal_status")
            cancel_journal_entry(self.name)
        
        self.flags.emit_change = True
        self._emit_change()
    
    
    def on_trash(self):
        if self.docstatus.is_submitted():
            self._error(_("A submitted expenses entry cannot be removed."))
        
        if self.attachments:
            from expenses.libs import delete_attach_files
            
            delete_attach_files(
                self.doctype,
                self.name,
                [v.file for v in self.attachments]
            )
    
    
    def after_delete(self):
        self.flags.emit_change = True
        self._emit_change("trash")
    
    
    def _set_defaults(self, insert=False):
        from expenses.libs import is_entry_moderator
        
        if not insert:
            insert = self.is_new()
        
        now = nowdate()
        is_moderator = is_entry_moderator()
        if (
            insert and (
                not self.posting_date or (
                    self.posting_date != now and
                    not is_moderator
                )
            )
        ):
            self.posting_date = now
        
        elif (
            self.docstatus.is_draft() and (
                not self.posting_date or
                (
                    self.has_value_changed("posting_date") and
                    self.posting_date != self._get_old_posting_date() and
                    not is_moderator
                )
            )
        ):
            self.posting_date = now
        
        if self.docstatus.is_draft():
            if self.company:
                company_currency = None
                if self.mode_of_payment:
                    if not self.payment_account or not self.payment_target or not self.payment_currency:
                        from expenses.libs import get_mode_of_payment_data
                        
                        mop = get_mode_of_payment_data(self.mode_of_payment, self.company)
                        if mop:
                            self.payment_account = mop["account"]
                            self.payment_target = mop["type"]
                            self.payment_currency = mop["currency"]
                            company_currency = mop["company_currency"]
                
                from expenses.libs import get_current_exchange_rate
                
                if not flt(self.exchange_rate) and self.payment_currency:
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
            exist = []
            for v in self.attachments:
                if not v.file or v.file in exist:
                    self.attachments.remove(v)
                else:
                    exist.append(v.file)
    
    
    def _validate_expenses(self):
        from expenses.libs import (
            can_use_expense_claim,
            account_exists,
            is_valid_claim
        )
        
        use_expense_claim = can_use_expense_claim()
        for v in self.expenses:
            if not account_exists(v.account, {"company": v.company}, True):
                self._error(_(
                    "The expense account \"{0}\" is disabled, does not exist or does not belong to company \"{1}\"."
                ).format(v.account, v.company))
            
            if cint(v.is_paid):
                if not v.paid_by:
                    self._error(_(
                        "A valid paid by employee for expense account \"{0}\" is required."
                    ).format(v.account))
                if use_expense_claim:
                    if not v.expense_claim:
                        self._error(_(
                            "A valid expense claim reference for expense account \"{0}\" is required."
                        ).format(v.account))
                    if not is_valid_claim(v.expense_claim, v.paid_by, self.company):
                        self._error(_(
                            "The expense claim reference for expense account \"{0}\" "
                            + "has not been submitted, "
                            + "is not paid, does not belong to the company, "
                            + "not paid by the employee or does not exist."
                        ).format(v.account))
    
    
    def _handle_request(self):
        if self.flags.get("request_status", 0) == 1:
            from expenses.libs import process_request
            
            process_request(self.expenses_request_ref)
        
        elif self.flags.get("request_status", 0) == 2:
            from expenses.libs import reject_request
            
            reject_request(self.expenses_request_ref)
        
        self.flags.pop("request_status")
    
    
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
            for f in self.meta.get("fields", []):
                if self.has_value_changed(f.fieldname):
                    self.flags.emit_change = True
                    break
    
    
    def _emit_change(self, action="change"):
        if self.flags.get("emit_change", False):
            from expenses.libs import emit_entry_changed
            
            self.flags.pop("emit_change")
            emit_entry_changed({
                "action": action,
                "entry": self.name
            })
    
    
    def _error(self, msg):
        error(msg, _("Expenses Entry Error"))