# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _
from frappe.utils import (
    cint,
    flt
)
from frappe.model.document import Document

from expenses.libs import (
    clear_doc_cache,
    ExpenseStatus
)


class Expense(Document):
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
        self.flags.def_cost = {"eq": 0.0, "min": 0.0, "max": 0.0}
        self.flags.def_qty = {"eq": 0.0, "min": 0.0, "max": 0.0}
        self._validate_company()
        self._validate_expense_item()
        self._validate_expense_data()
        self._validate_date()
        self._validate_cost_qty()
        self._validate_paid()
        self._validate_party()
        self._validate_attachments()
        if self.flags.error_list:
            self._error(self.flags.error_list)
        else:
            self._update_total()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if not self.status:
            self.status = ExpenseStatus.d
        if not self.is_new() and self.has_value_changed("attachments"):
            self._process_attachments()
    
    
    def before_submit(self):
        self._check_app_status()
        clear_doc_cache(self.doctype, self.name)
        self._clean_flags()
        self.status = ExpenseStatus.p
    
    
    def on_update(self):
        self._clean_flags()
    
    
    def before_update_after_submit(self):
        self._check_app_status()
        if (
            not self._is_cancelled and
            self.status in (ExpenseStatus.j, ExpenseStatus.c)
        ):
            self._check_links(_(str(self.status).lower()))
            self.docstatus = 2
        
        clear_doc_cache(self.doctype, self.name)
        if (
            self.status in (ExpenseStatus.p, ExpenseStatus.r) and
            self.has_value_changed("attachments")
        ):
            self._process_attachments()
    
    
    def on_update_after_submit(self):
        self._clean_flags()
    
    
    def before_cancel(self):
        self._check_app_status()
        if not self.flags.get("by_request", 0):
            self._check_links(_("cancelled"))
            if self.status == ExpenseStatus.r:
                self._error(_("Requested expense can't be cancelled."))
            elif self.status == ExpenseStatus.a:
                self._error(_("Approved expense can't be cancelled."))
            elif self.status == ExpenseStatus.j:
                self._error(_("Rejected expense can't be cancelled."))
            elif self.status != ExpenseStatus.c:
                self._error(_("Only pending expenses can be cancelled."))
            
            self.status = ExpenseStatus.c
        
        clear_doc_cache(self.doctype, self.name)
    
    
    def on_cancel(self):
        self._clean_flags()
    
    
    def on_trash(self):
        self._check_app_status()
        if self._is_submitted:
            self._error(_("Submitted expense can't be removed."))
        
        clear_doc_cache(self.doctype, self.name)
        if self.attachments:
            self._delete_attachments([v.file for v in self.attachments])
    
    
    def after_delete(self):
        self._clean_flags()
    
    
    @property
    def _is_paid(self):
        return cint(self.is_paid) > 0
    
    
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
    
    
    @property
    def _is_submitted(self):
        return cint(self.docstatus) == 1
    
    
    @property
    def _is_cancelled(self):
        return cint(self.docstatus) == 2
    
    
    def request(self):
        if self._is_submitted and self.status == ExpenseStatus.p:
            self.status = ExpenseStatus.r
            self.save(ignore_permissions=True)
        else:
            self._error(_("Only pending expenses can be requested."))
    
    
    def approve(self):
        if self._is_submitted and self.status == ExpenseStatus.r:
            self.status = ExpenseStatus.a
            self.save(ignore_permissions=True)
        else:
            self._error(_("Only requested expenses can be approved."))
    
    
    def reject(self):
        if self._is_submitted and self.status == ExpenseStatus.r:
            self.flags.by_request = 1
            self.status = ExpenseStatus.j
            self.docstatus = 2
            self.save(ignore_permissions=True)
        else:
            self._error(_("Only requested expenses can be rejected."))
    
    
    def restore(self):
        if self._is_cancelled and self.status == ExpenseStatus.j:
            self.status = ExpenseStatus.p
            self.is_restored = 1
            self.docstatus = 1
            self.save(ignore_permissions=True)
        else:
            self._error(_("Only rejected expenses can be restored."))
    
    
    def _set_defaults(self):
        if not self._is_paid:
            if self.paid_by:
                self.paid_by = None
            if self.expense_claim:
                self.expense_claim = None
        else:
            if self.expense_claim and not self._has_expense_claim:
                self.expense_claim = None
        
        if not self.party and self.party_type:
            self.party_type = None
    
    
    def _validate_company(self):
        if not self.company:
            self._add_error(_("A valid company is required."))
        elif self.is_new() or self.has_value_changed("company"):
            from expenses.libs import company_exists
            
            self.flags.company_changed = 1
            if not company_exists(self.company, {"is_group": 0}):
                self._add_error(_("Company \"{0}\" is a group or doesn't exist.").format(self.company))
                self.flags.no_company = 1
    
    
    def _validate_expense_item(self):
        if not self.expense_item:
            self._add_error(_("A valid expense item is required."))
        elif self.is_new() or self.has_value_changed("expense_item"):
            from expenses.libs import item_exists
            
            self.flags.expense_item_changed = 1
            if not item_exists(self.expense_item, enabled=True):
                self._add_error(_("Expense item \"{0}\" is disabled or doesn't exist.").format(self.expense_item))
                self.no_expense_item = 1
    
    
    def _validate_expense_data(self):
        if (
            (self.flags.get("company_changed", 0) or self.flags.get("expense_item_changed", 0)) and
            not self.flags.get("no_company", 0) and not self.flags.get("no_expense_item", 0)
        ):
            from expenses.libs import item_expense_data
            
            tmp = item_expense_data(self.expense_item, self.company)
            if not tmp:
                self.uom = None
                self.expense_account = None
                self.currency = None
                self._add_error(
                    _("Expense item \"{0}\" doesn't have an expense account linked to company \"{1}\".")
                    .format(self.expense_item, self.company)
                )
            else:
                self.uom = tmp["uom"]
                self.expense_account = tmp["account"]
                self.currency = tmp["currency"]
                for k in ["cost", "qty"]:
                    f = self.flags.get(f"def_{k}")
                    if flt(tmp[k]) > 0:
                        f["eq"] = flt(tmp[k])
                    tk = f"min_{k}"
                    if flt(tmp[tk]) > 0:
                        f["min"] = flt(tmp[tk])
                    tk = f"max_{k}"
                    if flt(tmp[tk]) > 0:
                        f["max"] = flt(tmp[tk])
    
    
    def _validate_date(self):
        if not self.required_by:
            self._add_error(_("A valid required by date is required."))
        elif self.is_new() or self.has_value_changed("required_by"):
            from frappe.utils import getdate
            
            if not getdate(self.required_by):
                self._add_error(_("A valid required by date is required."))
            else:
                from expenses.libs import is_expense_moderator
                
                if not is_expense_moderator():
                    from frappe.utils import date_diff
                    
                    creation_dt = self.get("creation")
                    min_dt = getdate(creation_dt)
                    if cint(date_diff(getdate(self.required_by), min_dt)) < 0:
                        if creation_dt:
                            from frappe.utils import DATE_FORMAT
                            
                            creation_dt = min_dt.strftime(DATE_FORMAT)
                        
                        self._add_error(
                            _("Required by date must be equals to {0} or later.")
                            .format(creation_dt or _("today"))
                        )
    
    
    def _validate_cost_qty(self):
        fields = []
        if flt(self.cost) <= 0:
            self._add_error(_("A valid cost is required."))
        else:
            fields.append(["cost", _("Cost")])
        
        if flt(self.qty) <= 0:
            self._add_error(_("A valid quantity is required."))
        else:
            fields.append(["qty", _("Quantity")])
        
        if fields:
            for i in range(len(fields)):
                k = fields.pop(0)
                v = flt(self.get(k[0]))
                f = self.flags.get(f"def_{k[0]}")
                if f["eq"] > 0 and f["eq"] != v:
                    self._add_error(_("{0} must be equals to {1}.").format(k[1], f["eq"]))
                elif f["min"] > 0 and f["min"] > v:
                    self._add_error(_("{0} must be greater than or equals to {1}.").format(k[1], f["min"]))
                elif f["max"] > 0 and f["max"] < v:
                    self._add_error(_("{0} must be less than or equals to {1}.").format(k[1], f["max"]))
    
    
    def _validate_paid(self):
        if self._is_paid:
            if not self.paid_by:
                self._add_error(_("A valid paid by employee is required."))
            elif self.is_new() or self.has_value_changed("paid_by"):
                from expenses.libs import employee_exists
                
                if not employee_exists(self.paid_by, {"company": self.company}, True):
                    self._add_error(_("Paid by employee isn't active or isn't working for company \"{0}\".").format(self.company))
            
            if not self.expense_claim:
                if self._expense_claim_reqd:
                    self._add_error(_("A valid expense claim reference is required."))
            elif self.is_new() or self.has_value_changed("expense_claim"):
                from expenses.libs import is_valid_claim
                
                if not is_valid_claim(self.expense_claim, self.paid_by, self.company):
                    self._add_error(
                        _("Expense claim \"{0}\" hasn't been submitted, not paid, not linked to company, not paid by employee or doesn't exist.")
                        .format(self.expense_claim)
                    )
    
    
    def _validate_party(self):
        if self.party_type:
            if not self.party:
                self._add_error(_("A valid party reference is required."))
            elif self.is_new() or self.has_value_changed("party"):
                from expenses.libs import party_exists
                
                if not party_exists(self.party_type, self.party, enabled=True):
                    self._add_error(
                        _("{0} \"{1}\" is disabled or doesn't exist.")
                        .format(self.party_type, self.party)
                    )
    
    
    def _validate_attachments(self):
        if self.attachments:
            table = _("Attachments")
            exist = []
            for i, v in enumerate(self.attachments):
                if not v.file:
                    self._add_error(_("{0} - #{1}: A valid attachment file is required.").format(table, i))
                elif v.file in exist:
                    self._add_error(_("{0} - #{1}: Attachment file \"{2}\" already exist.").format(table, i, v.file))
                else:
                    exist.append(v.file)
    
    
    def _update_total(self):
        if self.has_value_changed("cost") or self.has_value_changed("qty"):
            self.total = flt(flt(self.cost) * flt(self.qty))
    
    
    def _check_links(self, action: str):
        if self.status in (ExpenseStatus.d, ExpenseStatus.p):
            return 0
        
        from expenses.libs import expense_requests_exists
        
        if expense_requests_exists(self.name):
            self._error(_("Expense with linked expenses request can't be {0}.").format(action))
        
        from expenses.libs import expense_entries_exists
        
        if expense_entries_exists(self.name):
            self._error(_("Expense with linked expenses entry can't be {0}.").format(action))
    
    
    def _process_attachments(self):
        old = self.get_doc_before_save()
        if not old:
            self.load_doc_before_save()
            old = self.get_doc_before_save()
        if old and old.attachments:
            files = [v.file for v in self.attachments] if self.attachments else None
            dels = []
            for v in old.attachments:
                if not files or v.file not in files:
                    dels.append(v.file)
            
            if dels:
                self._delete_attachments(dels)
    
    
    def _delete_attachments(self, files):
        from expenses.libs import delete_attach_files
            
        delete_attach_files(self.doctype, self.name, files)
    
    
    def _check_app_status(self):
        if not self.flags.get("status_checked", 0):
            from expenses.libs import check_app_status
            
            check_app_status()
            self.flags.status_checked = 1
    
    
    def _clean_flags(self):
        keys = [
            "by_request",
            "error_list",
            "def_cost",
            "def_qty",
            "company_changed",
            "no_company",
            "expense_item_changed",
            "no_expense_item",
            "has_expense_claim",
            "expense_claim_reqd",
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