# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _
from frappe.model.document import Document
from frappe.utils import (
    flt,
    cint
)

from expenses.libs import clear_doc_cache


class ExpensesEntry(Document):
    def before_insert(self):
        self._check_app_status()
        self._set_defaults()
    
    
    def before_validate(self):
        self._check_app_status()
        if cint(self.docstatus) == 0:
            self._set_defaults()
    
    
    def validate(self):
        self._check_app_status()
        self.flags.error_list = []
        self._validate_company()
        self._validate_mop()
        self._validate_date()
        self._validate_dimensions()
        self._validate_expenses()
        self._validate_payment()
        if self.flags.error_list:
            self._error(self.flags.error_list)
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if self.is_new() and self.expenses_request_ref:
            self.flags.request_status = 1
        
        if not self.is_new() and self.has_value_changed("attachments"):
            self._trash_old_attachments()
    
    
    def before_submit(self):
        self._check_app_status()
        clear_doc_cache(self.doctype, self.name)
        self.flags.journal_status = 1
    
    
    def on_update(self):
        self._handle_request()
        self._clean_flags()
    
    
    def after_submit(self):
        self._handle_journal()
        self._clean_flags()
    
    
    def before_update_after_submit(self):
        self._check_app_status()
        clear_doc_cache(self.doctype, self.name)
        for f in self.meta.get("fields", []):
            if not cint(f.allow_on_submit) and self.has_value_changed(f.fieldname):
                self._error(
                    _("Expenses entry can't be modified after {0}.")
                    .format(_("submit") if self._is_submitted else _("cancel"))
                )
                break
    
    
    def on_update_after_submit(self):
        self._clean_flags()
    
    
    def before_cancel(self):
        self._check_app_status()
        clear_doc_cache(self.doctype, self.name)
        if self.expenses_request_ref:
            self.flags.request_status = 2
        self.flags.journal_status = 2
    
    
    def on_cancel(self):
        self._handle_request()
        self._handle_journal()
        self._clean_flags()
    
    
    def on_trash(self):
        self._check_app_status()
        if self._is_submitted:
            self._error(_("Submitted expenses entry can't be removed."))
        
        clear_doc_cache(self.doctype, self.name)
        if self.attachments:
            self._trash_files([v.file for v in self.attachments if v.file])
    
    
    def after_delete(self):
        self._clean_flags()
    
    
    @property
    def _is_custom_exchange_rate(self):
        return cint(self.custom_exchange_rate) > 0
    
    
    @property
    def _is_submitted(self):
        return cint(self.docstatus) == 1
    
    
    @property
    def _has_expense_claim(self):
        if not isinstance(self.flags.get("has_expense_claim", 0), int):
            from expenses.libs import has_expense_claim
            
            self.flags.has_expense_claim = has_expense_claim()
        
        return self.flags.has_expense_claim > 0
    
    
    @property
    def _expense_claim_reqd(self):
        if not isinstance(self.flags.get("expense_claim_reqd", 0), int):
            if not self._has_expense_claim:
                self.flags.expense_claim_reqd = 0
            else:
                from expenses.libs import expense_claim_reqd_if_paid
                
                self.flags.expense_claim_reqd = expense_claim_reqd_if_paid()
        
        return self.flags.expense_claim_reqd > 0
    
    
    def _set_defaults(self):
        self._load_company_currency()
        self._set_mop_data()
        self._set_default_date()
        self._set_default_exchange_rate()
        self._set_expenses_data()
        self._update_totals()
        self._clean_attachments()
    
    
    def _set_mop_data(self):
        if (
            self.company and self.mode_of_payment and (
                self.is_new() or
                self.has_value_changed("company") or
                self.has_value_changed("mode_of_payment")
            )
        ):
            from expenses.libs import get_mode_of_payment_data
            
            mop = get_mode_of_payment_data(self.mode_of_payment, self.company, True)
            if not mop:
                mop = {}
            
            self.payment_target = mop.pop("type", None)
            self.payment_account = mop.pop("account", None)
            self.payment_currency = mop.pop("currency", None)
    
    
    def _set_default_date(self):
        if not self.posting_date:
            from frappe.utils import nowdate
            
            self.posting_date = nowdate()
            self.flags.def_posting_date = 1
    
    
    def _set_default_exchange_rate(self):
        if not self._is_custom_exchange_rate and flt(self.exchange_rate) < 1:
            self.exchange_rate = self._get_exchange_rate(self.payment_currency)
    
    
    def _set_expenses_data(self):
        if not self.expenses or (not self.is_new() and not self.has_value_changed("expenses")):
            return 0
        
        self._load_company_currency()
        self._load_expenses_data()
        tmp = {"currency": []}
        for v in self.expenses:
            if v.account and not v.expense_ref:
                tmp["currency"].append(v.account)
        
        if tmp["currency"]:
            from expenses.libs import get_accounts_currencies
            
            tmp["currency"] = get_accounts_currencies(tmp["currency"])
        
        if not self._is_custom_exchange_rate or not self.flags.company_currency:
            tmp["rates"] = {}
        else:
            tmp["rates"] = []
            for v in self.expenses:
                if v.account and v.account in tmp["currency"]:
                    tmp["rates"].append(tmp["currency"][v.account])
                elif v.expense_ref and v.expense_ref in self.flags.expenses_data:
                    tmp["rates"].append(self.flags.expenses_data[v.expense_ref]["currency"])
            
            if tmp["rates"]:
                tmp["rates"] = self._get_exchange_rate(tmp["rates"])
        
        self.flags.expenses_errors = []
        for v in self.expenses:
            if v.expense_ref:
                if v.expense_ref not in self.flags.expenses_data:
                    self.flags.expenses_errors[v.name] = 1
                    continue
                
                v.update(self.flags.expenses_data[v.expense_ref])
            
            if not v.account:
                self.flags.expenses_errors[v.name] = 2
                continue
            
            if flt(v.cost_in_account_currency) < 1:
                self.flags.expenses_errors[v.name] = 3
                continue
            
            if not v.account_currency:
                if v.account not in tmp["currency"]:
                    self.flags.expenses_errors[v.name] = 4
                    continue
                
                v.account_currency = tmp["currency"][v.account]
            
            if flt(v.exchange_rate) < 1:
                if v.account_currency not in tmp["rates"]:
                    self.flags.expenses_errors[v.name] = 5
                    continue
                
                v.exchange_rate = tmp["rates"][v.account_currency]
            
            v.cost = flt(flt(v.cost_in_account_currency) * flt(v.exchange_rate))
            
            is_paid = cint(v.is_paid)
            if is_paid and not v.paid_by:
                v.is_paid = 0
                is_paid = 0
            elif not is_paid and v.paid_by:
                v.is_paid = 1
                is_paid = 1
            
            if not is_paid and v.expense_claim:
                v.expense_claim = None
            elif is_paid and v.expense_claim:
                if not self._has_expense_claim:
                    v.expense_claim = None
            
            if v.party_type and not v.party:
                v.party_type = None
            elif not v.party_type and v.party:
                v.party = None
            
            if not v.project and self.default_project:
                v.project = self.default_project
            
            if not v.cost_center and self.default_cost_center:
                v.cost_center = self.default_cost_center
        
        tmp.clear()
    
    
    def _update_totals(self):
        self.total = 0.0
        for v in self.expenses:
            self.total += flt(v.cost)
        
        self.total_in_payment_currency = flt(flt(self.total) / flt(self.exchange_rate))
    
    
    def _clean_attachments(self):
        if self.attachments and (self.is_new() or self.has_value_changed("attachments")):
            remove = []
            for v in self.attachments:
                if not v.file:
                    remove.append(v)
            
            if remove:
                for i in range(len(remove)):
                    self.attachments.remove(remove.pop(0))
    
    
    def _validate_company(self):
        if not self.company:
            self._add_error(_("A valid company is required."))
        elif self.is_new() or self.has_value_changed("company"):
            from expenses.libs import company_exists
            
            if not company_exists(self.company, {"is_group": 0}):
                self._add_error(_("Company \"{0}\" is a group or doesn't exist.").format(self.company))
    
    
    def _validate_mop(self):
        if not self.mode_of_payment:
            self._add_error(_("A valid mode of payment is required."))
        elif self.is_new() or self.has_value_changed("mode_of_payment"):
            from expenses.libs import mode_of_payment_exists
            
            if not mode_of_payment_exists(self.mode_of_payment, None, True):
                self._add_error(_("Mode of payment \"{0}\" is disabled or doesn't exist.").format(self.mode_of_payment))
            elif not self.payment_target or not self.payment_account or not self.payment_currency:
                self._add_error(_("Failed to get the type, account and currency of mode of payment \"{0}\".").format(self.mode_of_payment))
    
    
    def _validate_date(self):
        if not self.posting_date:
            self._add_error(_("A valid posting date is required."))
        elif self.is_new() or self.has_value_changed("posting_date"):
            from frappe.utils import getdate
            
            if not getdate(self.posting_date):
                self._add_error(_("A valid posting date is required."))
                return 0
            
            from expenses.libs import is_entry_moderator
            
            if not is_entry_moderator():
                from frappe.utils import date_diff
                
                if cint(date_diff(getdate(self.posting_date), getdate())) < 0:
                    self._add_error(_("Posting date must be at least of today."))
    
    
    def _validate_dimensions(self):
        if self.default_project and (self.is_new() or self.has_value_changed("default_project")):
            from expenses.libs import project_exists
            
            if not project_exists(self.default_project, {
                "status": "Open",
                "is_active": "Yes",
                "company": ["in", [self.company, ""]]
            }):
                self._add_error(
                    _("Default project \"{0}\" isn't open, isn't active, is linked to a company other than \"{1}\" or doesn't exist.")
                    .format(self.default_project, self.company)
                )
        
        if self.default_cost_center and (self.is_new() or self.has_value_changed("default_cost_center")):
            from expenses.libs import cost_center_exists
            
            if not cost_center_exists(self.default_cost_center, {"is_group": 0, "company": self.company}, True):
                self._add_error(
                    _("Default cost center \"{0}\" is a group, isn't linked to company \"{1}\" or doesn't exist.")
                    .format(self.default_cost_center, self.company)
                )
    
    
    def _validate_expenses(self):
        if not self.expenses:
            self._add_error(_("At least one valid expense is required."))
            return 0
        
        if not self.is_new() and not self.has_value_changed("expenses"):
            return 0
            
        tmp = {
            "accounts": [],
            "projects": [],
            "centers": [],
            "employees": [],
            "claims": [],
            "parties": {}
        }
        for v in self.expenses:
            if v.account:
                tmp["accounts"].append(v.account)
            if v.project and v.project != self.default_project:
                tmp["projects"].append(v.project)
            if v.cost_center and v.cost_center != self.default_cost_center:
                tmp["centers"].append(v.cost_center)
            if cint(v.is_paid):
                if v.paid_by:
                    tmp["employees"].append(v.paid_by)
                if v.expense_claim:
                    tmp["claims"].append(v.expense_claim)
            if v.party_type and v.party:
                if v.party_type not in tmp["parties"]:
                    tmp["parties"][v.party_type] = []
                tmp["parties"][v.party_type].append(v.party)
        
        if tmp["accounts"]:
            from expenses.libs import company_accounts_filter
            
            tmp["accounts"] = company_accounts_filter(tmp["accounts"], None, True)
        
        if tmp["projects"]:
            from expenses.libs import projects_filter
            
            tmp["projects"] = projects_filter(tmp["projects"], {
                "status": "Open",
                "is_active": "Yes",
                "company": ["in", [self.company, ""]]
            })
        
        if tmp["centers"]:
            from expenses.libs import cost_centers_filter
            
            tmp["centers"] = cost_centers_filter(tmp["centers"], {"is_group": 0, "company": self.company}, True)
        
        if tmp["employees"]:
            from expenses.libs import employees_filter
            
            tmp["employees"] = employees_filter(tmp["employees"], {"company": self.company}, True)
        
        if tmp["claims"]:
            from expenses.libs import expense_claims_filter
            
            tmp["claims"] = expense_claims_filter(tmp["claims"], {
                "company": self.company,
                "is_paid": 1,
                "status": "Paid",
                "docstatus": 1
            })
        
        if tmp["parties"]:
            from expenses.libs import parties_filter
            
            for k in tmp["parties"]:
                tmp["parties"][k] = parties_filter(k, tmp["parties"][k], enabled=True)
        
        self._load_company_currency()
        self._load_expenses_data()
        if not isinstance(self.flags.get("expenses_errors", ""), list):
            self.flags.expenses_errors = []
        
        table = _("Expenses")
        for i, v in enumerate(self.expenses):
            err = 0
            if v.name in self.flags.expenses_errors:
                err = self.flags.expenses_errors[v.name]
            
            if err == 1 or (v.expense_ref and v.expense_ref not in self.flags.expenses_data):
                self._add_error(
                    _("{0} - #{1}: Expense reference \"{2}\" isn't approved, not linked to company \"{3}\" or doesn't exist.")
                    .format(table, i, v.expense_ref, self.company)
                )
            
            if err == 2 or not v.account:
                if v.expense_ref:
                    self._add_error(
                        _("{0} - Row #{1}: Expense reference \"{2}\" has invalid expense account.")
                        .format(table, i, v.expense_ref)
                    )
                else:
                    self._add_error(_("{0} - Row #{1}: A valid expense account is required.").format(table, i))
            
            if v.account not in tmp["accounts"] or tmp["accounts"][v.account] != self.company:
                if v.expense_ref:
                    self._add_error(
                        _("{0} - Row #{1}: Expense account \"{2}\" of expense reference \"{3}\" is disabled, isn't linked to company \"{4}\" or doesn't exist.")
                        .format(table, i, v.account, v.expense_ref, self.company)
                    )
                else:
                    self._add_error(
                        _("{0} - Row #{1}: Expense account \"{2}\" is disabled, isn't linked to company \"{3}\" or doesn't exist.")
                        .format(table, i, v.account, self.company)
                    )
            
            if err == 3 or flt(v.cost_in_account_currency) < 1:
                if v.expense_ref:
                    self._add_error(_("{0} - Row #{1}: Expense reference \"{2}\" has invalid expense cost.").format(table, i, v.expense_ref))
                else:
                    self._add_error(_("{0} - Row #{1}: A valid expense cost is required.").format(table, i))
            
            if err == 4 or not v.account_currency:
                if v.expense_ref:
                    self._add_error(
                        _("{0} - Row #{1}: Unable to get currency for expense account \"{2}\" of expense reference \"{3}\".")
                        .format(table, i, v.account, v.expense_ref)
                    )
                else:
                    self._add_error(
                        _("{0} - Row #{1}: Unable to get currency for expense account \"{2}\".")
                        .format(table, i, v.account)
                    )
            
            if v.project and v.project != self.default_project and v.project not in tmp["projects"]:
                if v.expense_ref:
                    self._add_error(
                        _("{0} - Row #{1}: Project \"{2}\" of expense reference \"{3}\" isn't open, isn't active, is linked to a company other than \"{4}\" or doesn't exist.")
                        .format(table, i, v.project, v.expense_ref, self.company)
                    )
                else:
                    self._add_error(
                        _("{0} - Row #{1}: Project \"{2}\" isn't open, isn't active, is linked to a company other than \"{3}\" or doesn't exist.")
                        .format(table, i, v.project, self.company)
                    )
            
            if v.cost_center and v.cost_center != self.default_cost_center and v.cost_center not in tmp["centers"]:
                if v.expense_ref:
                    self._add_error(
                        _("{0} - Row #{1}: Cost center \"{2}\" of expense reference \"{3}\" is a group, isn't linked to company \"{4}\" or doesn't exist.")
                        .format(table, i, v.cost_center, v.expense_ref, self.company)
                    )
                else:
                    self._add_error(
                        _("{0} - Row #{1}: Cost center \"{2}\" is a group, isn't linked to company \"{3}\" or doesn't exist.")
                        .format(table, i, v.cost_center, self.company)
                    )
            
            if flt(v.exchange_rate) < 1:
                if v.expense_ref:
                    self._add_error(
                        _("{0} - Row #{1}: Unable to get the exchange rate of {2} to {3} for expense reference \"{4}\".")
                        .format(table, i, v.account_currency, self.flags.company_currency, v.expense_ref))
                elif self._is_custom_exchange_rate:
                    self._add_error(
                        _("{0} - Row #{1}: Exchange rate of {2} to {3} is invalid.")
                        .format(table, i, v.account_currency, self.flags.company_currency)
                    )
                else:
                    self._add_error(
                        _("{0} - Row #{1}: Unable to get the exchange rate of {2} to {3}.")
                        .format(table, i, v.account_currency, self.flags.company_currency)
                    )
            
            if flt(v.cost) <= 0:
                v.cost = flt(flt(v.cost_in_account_currency) * flt(v.exchange_rate))
                if flt(v.cost) <= 0:
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: Expense cost in company currency for expense reference \"{3}\" is invalid.")
                            .format(table, i, v.expense_ref)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: Expense cost in company currency is invalid.")
                            .format(table, i)
                        )
            
            if cint(v.is_paid):
                if not v.paid_by:
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: Paid by employee of expense reference \"{2}\" is invalid.")
                            .format(table, i, v.expense_ref)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: A valid paid by employee is required.")
                            .format(table, i)
                        )
                
                if v.paid_by not in tmp["employees"]:
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: Paid by employee of expense reference \"{2}\" isn't active or isn't working for company \"{3}\".")
                            .format(table, i, v.expense_ref, self.company)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: Paid by employee isn't active or isn't working for company \"{2}\".")
                            .format(table, i, self.company)
                        )
                
                if not v.expense_claim and self._expense_claim_reqd:
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: Expense claim of expense reference \"{2}\" is invalid.")
                            .format(table, i, v.expense_ref)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: A valid expense claim is required.")
                            .format(table, i)
                        )
                
                if v.expense_claim and (v.expense_claim not in tmp["claims"] or tmp["claims"][v.expense_claim] != v.paid_by):
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: Expense claim \"{2}\" of expense reference \"{3}\" hasn't been submitted, not paid, not linked to company \"{4}\", not paid by employee \"{5}\" or doesn't exist.")
                            .format(table, i, v.expense_claim, v.expense_ref, self.company, v.paid_by)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: Expense claim \"{2}\" hasn't been submitted, not paid, not linked to company \"{3}\", not paid by employee \"{4}\" or doesn't exist.")
                            .format(table, i, v.expense_claim, self.company, v.paid_by)
                        )
            
            if v.party_type:
                if not v.party:
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: Party reference of expense reference \"{2}\" is invalid.")
                            .format(table, i, v.expense_ref)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: A valid party reference is required.")
                            .format(table, i)
                        )
                
                if v.party_type not in tmp["parties"] or v.party not in tmp["parties"][v.party_type]:
                    if v.expense_ref:
                        self._add_error(
                            _("{0} - Row #{1}: {2} \"{3}\" of expense reference \"{4}\" is disabled or doesn't exist.")
                            .format(table, i, v.party_type, v.party, v.expense_ref)
                        )
                    else:
                        self._add_error(
                            _("{0} - Row #{1}: {2} \"{3}\" is disabled or doesn't exist.")
                            .format(table, i, v.party_type, v.party)
                        )
    
        tmp.clear()
    
    
    def _validate_payment(self):
        if self.payment_target == "Bank":
            if not self.payment_reference:
                self._error(_("A valid payment reference is required."))
            
            if not self.clearance_date:
                self._error(_("A valid reference / clearance date is required."))
        
        if flt(self.exchange_rate) < 1:
            if self._is_custom_exchange_rate:
                self._error(
                    _("Exchange rate of {0} to {1} is invalid.")
                    .format(self.payment_currency, self.flags.company_currency)
                )
            else:
                self._error(
                    _("Unable to get the exchange rate of {0} to {1}.")
                    .format(self.payment_currency, self.flags.company_currency)
                )
        
        if flt(self.total_in_payment_currency) <= 0:
            self._error(_("Total cost is invalid."))
        
        if flt(self.total) <= 0:
            self._error(_("Total cost in company currency is invalid."))
    
    
    def _handle_request(self):
        status = self.flags.get("request_status", 0)
        if status == 1:
            from expenses.libs import process_request
            
            process_request(self.expenses_request_ref)
        
        elif status == 2:
            from expenses.libs import reject_request
            
            reject_request(self.expenses_request_ref)
    
    
    def _handle_journal(self):
        status = self.flags.get("journal_status", 0)
        if status == 1:
            from expenses.libs import enqueue_journal_entry
            
            enqueue_journal_entry(self.name)
        
        elif status == 2:
            from expenses.libs import cancel_journal_entry
            
            cancel_journal_entry(self.name)
    
    
    def _get_old_doc(self):
        if self.is_new():
            return None
        
        doc = self.get_doc_before_save()
        if not doc:
            self.load_doc_before_save()
            doc = self.get_doc_before_save()
        
        return doc
    
    
    def _load_company_currency(self):
        if isinstance(self.flags.get("company_currency", 0), str):
            return 0
        
        if not self.company:
            self.flags.company_currency = ""
        else:
            from expenses.libs import get_company_currency
        
            self.flags.company_currency = get_company_currency(self.company, True)
    
    
    def _get_exchange_rate(self, _from):
        if not self.flags.company_currency or not _from:
            return 1.0
        
        from expenses.libs import get_exchange_rate
        
        return get_exchange_rate(
            _from, self.flags.company_currency,
            self.posting_date, local=True
        )
    
    
    def _load_expenses_data(self):
        if isinstance(self.flags.get("expenses_data", ""), dict):
            return 0
        
        if not self.company:
            self.flags.expenses_data = {}
            return 0
        
        data = [v.expense_ref for v in self.expenses if v.expense_ref]
        if not data:
            self.flags.expenses_data = {}
        else:
            from expenses.libs import get_expenses_data
                
            self.flags.expenses_data = get_expenses_data(data, self.company)
            data.clear()
    
    
    def _trash_old_attachments(self):
        old = self._get_old_doc()
        if not old or not old.attachments:
            return 0
        
        files = [v.file for v in old.attachments if v.file]
        if self.attachments:
            for v in self.attachments:
                if v.file and v.file in files:
                    files.remove(v.file)
        
        if files:
            self._trash_files(files)
            files.clear()
    
    
    def _trash_files(self, files):
        from expenses.libs import delete_attach_files
            
        delete_attach_files(self.doctype, self.name, files)
    
    
    def _check_app_status(self):
        if not self.flags.get("status_checked", 0):
            from expenses.libs import check_app_status
            
            check_app_status()
            self.flags.status_checked = 1
    
    
    def _clean_flags(self):
        keys = [
            "company_currency",
            "def_posting_date",
            "expenses_data",
            "expenses_errors",
            "has_expense_claim",
            "expense_claim_reqd",
            "request_status",
            "journal_status",
            "status_checked"
        ]
        for i in range(len(keys)):
            self.flags.pop(keys.pop(0), None)
    
    
    def _add_error(self, msg):
        self.flags.error_list.append(msg)
    
    
    def _error(self, msg):
        from expenses.libs import error
        
        if isinstance(msg, list):
            if len(msg) == 1:
                msg = msg.pop(0)
            else:
                msg = msg.copy()
        
        self._clean_flags()
        error(msg, _(self.doctype))