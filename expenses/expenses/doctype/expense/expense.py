# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _
from frappe.utils import (
    cint,
    flt,
    getdate
)
from frappe.model.document import Document
from frappe.model.docstatus import DocStatus

from expenses.libs import (
    error,
    clear_doc_cache,
    ExpenseStatus
)


class Expense(Document):
    def before_insert(self):
        self._set_defaults()
        self._clean_files()
    
    
    def before_validate(self):
        if self.docstatus.is_draft():
            self._set_defaults()
            self._clean_files()
    
    
    def validate(self):
        from expenses.libs import check_app_status
        
        check_app_status()
        if not self.company:
            self._error(_("A valid company is required."))
        if not self.expense_item:
            self._error(_("A valid expense item is required."))
        if not self.required_by or not getdate(self.required_by):
            self._error(_("A valid required by date is required."))
        
        if (
            (self.is_new() or self.has_value_changed("required_by")) and
            not is_expense_moderator()
        ):
            from frappe.utils import date_diff
            
            from expenses.libs import is_expense_moderator
            
            min_dt = self.get("creation", "")
            min_dt = getdate(min_dt) if min_dt else getdate()
            if cint(date_diff(getdate(self.required_by), min_dt)) < 0:
                self._error(_("The required by date must be of {0} or later.").format(_("today") if self.is_new() else _("expense creation")))
        
        if flt(self.cost) <= 0:
            self._error(_("A valid cost is required."))
        if flt(self.qty) <= 0:
            self._error(_("A valid quantity is required."))
        if cint(self.is_paid):
            if not self.paid_by:
                self._error(_("A valid paid by employee is required."))
            
            from expenses.libs import has_expense_claim
            
            if has_expense_claim():
                if not self.expense_claim:
                    self._error(_("A valid expense claim reference is required."))
                
                from expenses.libs import is_valid_claim
                
                if not is_valid_claim(self.expense_claim, self.paid_by, self.company):
                    self._error(_("The expense claim \"{0}\" has not been submitted, is not paid, does not belong to company, not paid by the employee or does not exist.")
                        .format(self.expense_claim))
        
        if self.party_type and not self.party:
            self._error(_("A valid party reference is required."))
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if not self.status:
            self.status = ExpenseStatus.Draft
        
        self._check_change()
        if not self.is_new() and self.has_value_changed("attachments"):
            self._process_attachments()
    
    
    def before_submit(self):
        clear_doc_cache(self.doctype, self.name)
        self.flags.emit_change = True
        if self.status != ExpenseStatus.Pending:
            self.status = ExpenseStatus.Pending
    
    
    def on_update(self):
        self._emit_change()
    
    
    def before_update_after_submit(self):
        if (
            not self.docstatus.is_cancelled() and
            self.status in (ExpenseStatus.Rejected, ExpenseStatus.Cancelled)
        ):
            self._check_links(str(self.status).lower())
            self.docstatus = DocStatus.cancelled()
        
        clear_doc_cache(self.doctype, self.name)
        self._check_change()
        if (
            self.status in (ExpenseStatus.Pending, ExpenseStatus.Requested) and
            self.has_value_changed("attachments")
        ):
            self._process_attachments()
    
    
    def on_update_after_submit(self):
        self._emit_change()
    
    
    def before_cancel(self):
        if not self.flags.get("by_request", False):
            self._check_links("cancelled")
            
            if self.status != ExpenseStatus.Pending:
                if self.status == ExpenseStatus.Requested:
                    self._error(_("A requested expense cannot be cancelled."))
                elif self.status == ExpenseStatus.Approved:
                    self._error(_("An approved expense cannot be cancelled."))
                elif self.status == ExpenseStatus.Rejected:
                    self._error(_("A rejected expense cannot be cancelled."))
                else:
                    self._error(_("Only pending expenses can be cancelled."))
            
            self.status = ExpenseStatus.Cancelled
        
        clear_doc_cache(self.doctype, self.name)
    
    
    def on_cancel(self):
        self.flags.emit_change = True
        self._emit_change()
    
    
    def on_trash(self):
        if self.docstatus.is_submitted():
            self._error(_("A submitted expense cannot be removed."))
        
        clear_doc_cache(self.doctype, self.name)
        if self.attachments:
            self._delete_attachments([v.file for v in self.attachments])
    
    
    def after_delete(self):
        self.flags.emit_change = True
        self._emit_change("trash")
    
    
    def request(self):
        if self.docstatus.is_submitted() and self.status == ExpenseStatus.Pending:
            self.status = ExpenseStatus.Requested
            self.save()
        else:
            self._error(_("Only pending expenses can be requested."))
    
    
    def approve(self):
        if self.docstatus.is_submitted() and self.status == ExpenseStatus.Requested:
            self.status = ExpenseStatus.Approved
            self.save()
        else:
            self._error(_("Only requested expenses can be approved."))
    
    
    def reject(self):
        if self.docstatus.is_submitted() and self.status == ExpenseStatus.Requested:
            self.flags.by_request = True
            self.status = ExpenseStatus.Rejected
            self.cancel()
        else:
            self._error(_("Only requested expenses can be rejected."))
    
    
    def restore(self):
        if self.docstatus.is_cancelled() and self.status == ExpenseStatus.Rejected:
            self.status = ExpenseStatus.Pending
            self.is_restored = 1
            self.docstatus = DocStatus.submitted()
            self.save()
        else:
            self._error(_("Only rejected expenses can be restored."))
    
    
    def _set_defaults(self):
        self._set_item_defaults()
            
        if cint(self.is_paid):
            if not self.paid_by and not self.expense_claim:
                self.is_paid = 0
        else:
            if self.paid_by:
                self.paid_by = None
            if self.expense_claim:
                self.expense_claim = None
        
        if self.party and not self.party_type:
            self.party = None
        elif not self.party and self.party_type:
            self.party_type = None
    
    
    def _set_item_defaults(self):
        if self.expense_item and self.company:
            from expenses.libs import item_expense_data
            
            tmp = item_expense_data(self.expense_item, self.company)
            if not tmp:
                self._error(_("Failed to get the expense data for expense item \"{0}\" of company \"{1}\".")
                    .format(self.expense_item, self.company))
            else:
                if self.expense_account != tmp["account"]:
                    self.expense_account = tmp["account"]
                if self.currency != tmp["currency"]:
                    self.currency = tmp["currency"]
                
                change = 0
                for k in ["cost", "qty"]:
                    if tmp[k] and flt(self.get(k)) != tmp[k]:
                        self.set(k, tmp[k])
                        change += 1
                    else:
                        mk = f"min_{k}"
                        xk = f"max_{k}"
                        if tmp[mk] and flt(self.get(k)) < tmp[mk]:
                            self.set(k, tmp[mk])
                            change += 1
                        if tmp[xk] and flt(self.get(k)) > tmp[xk]:
                            self.set(k, tmp[xk])
                            change += 1
                
                if change:
                    self.total = flt(flt(self.cost) * flt(self.qty))
    
    
    def _clean_files(self):
        if self.attachments:
            exist = []
            for v in self.attachments:
                if not v.file or v.file in exist:
                    self.attachments.remove(v)
                else:
                    exist.append(v.file)
    
    
    def _check_links(self, action: str):
        from expenses.libs import (
            expense_requests_exists,
            expense_entries_exists
        )
        
        if (
            self.status not in (ExpenseStatus.Draft, ExpenseStatus.Pending) and (
                expense_requests_exists(self.name) or expense_entries_exists(self.name)
            )
        ):
            self._error(_("An expense with a linked expenses request cannot be {0}.").format(_(action)))
    
    
    def _check_change(self):
        if not self.is_new():
            ignore = ["status", "is_restored"]
            for f in self.meta.get("fields"):
                if (
                    f.fieldname not in ignore and
                    self.has_value_changed(f.fieldname)
                ):
                    self.flags.emit_change = True
                    break
    
    
    def _emit_change(self, action="change"):
        if self.flags.get("emit_change", False):
            from expenses.libs import emit_expense_changed
            
            self.flags.pop("emit_change")
            emit_expense_changed({
                "action": action,
                "expense": self.name
            })
    
    
    def _process_attachments(self):
        old = self.get_doc_before_save()
        if not doc:
            self.load_doc_before_save()
            old = self.get_doc_before_save()
        if doc and doc.attachments:
            if not self.attachments:
                files = None
            else:
                files = [v.file for v in self.attachments]
            
            dels = []
            for v in doc.attachments:
                if not files or v.file not in files:
                    dels.append(v.file)
            
            if dels:
                self._delete_attachments(dels)
    
    
    def _delete_attachments(self, files):
        from expenses.libs import delete_attach_files
            
        delete_attach_files(self.doctype, self.name, files)
    
    
    def _error(self, msg):
        error(msg, _(self.doctype))