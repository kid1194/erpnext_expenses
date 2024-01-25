# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _, throw
from frappe.utils import (
    cint,
    flt,
    getdate,
    date_diff
)
from frappe.model.document import Document
from frappe.model.docstatus import DocStatus

from expenses.libs import (
    clear_doc_cache,
    ExpenseStatus,
    item_expense_data,
    is_expense_moderator,
    has_expense_claim,
    is_valid_claim,
    expense_requests_exists,
    expense_entries_exists,
    delete_attach_files,
    emit_expense_changed
)


class Expense(Document):
    def before_validate(self):
        if self.docstatus.is_draft():
            if self.expense_item and self.company:
                temp = item_expense_data(self.expense_item, self.company)
                if temp:
                    if not self.expense_account or self.expense_account != temp.account:
                        self.expense_account = temp.account
                    if not self.currency or self.currency != temp.currency:
                        self.currency = temp.currency
                
                    change = 0
                    for k in ["cost", "qty"]:
                        if temp[k] and flt(self.get(k)) != temp[k]:
                            self.set(k, temp[k])
                            change += 1
                        
                        else:
                            mk = f"min_{k}"
                            xk = f"max_{k}"
                            if temp[mk] and flt(self.get(k)) < temp[mk]:
                                self.set(k, temp[mk])
                                change += 1
                            if temp[xk] and flt(self.get(k)) > temp[xk]:
                                self.set(k, temp[xk])
                                change += 1
                    
                    if change:
                        self.total = flt(flt(self.cost) * flt(self.qty))
            
            if not cint(self.is_paid):
                if self.paid_by:
                    self.paid_by = None
                if self.expense_claim:
                    self.expense_claim = None
            
            if self.party and not self.party_type:
                self.party = None
            elif not self.party and self.party_type:
                self.party_type = None
            
            if self.attachments:
                existing = []
                for v in self.attachments:
                    if not v.file or v.file in existing:
                        self.attachments.remove(v)
                    else:
                        existing.append(v.file)
    
    
    def validate(self):
        if not self.company:
            throw(_("A valid expense company is required."))
        if not self.expense_item:
            throw(_("A valid expense item is required."))
        if not self.required_by or not getdate(self.required_by):
            throw(_("A valid expense required by date is required."))
        if (
            (self.is_new() or self.has_value_changed("required_by")) and
            not is_expense_moderator() and
            cint(date_diff(getdate(self.required_by), getdate())) < 0
        ):
            throw(_("The expense required by date must be of today or later."))
        if flt(self.cost) <= 0:
            throw(_("A positive expense cost is required."))
        if flt(self.qty) <= 0:
            throw(_("A positive expense quantity is required."))
        if cint(self.is_paid):
            if not self.paid_by:
                throw(_("A valid paid by employee is required."))
            if has_expense_claim():
                if not self.expense_claim:
                    throw(_("A valid expense claim reference is required."))
                if not is_valid_claim(self.expense_claim, self.paid_by, self.company):
                    throw(_(
                        "The expense claim referenced has not been submitted, "
                        + "is not paid, does not belong to the company, "
                        + "not paid by the employee or does not exist."
                    ))
        if self.party_type and not self.party:
            throw(_("A valid expense party reference is required."))
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if not self.status:
            self.status = ExpenseStatus.Draft
        
        self._check_change()
    
    
    def before_submit(self):
        clear_doc_cache(self.doctype, self.name)
        
        if self.status != ExpenseStatus.Pending:
            self.status = ExpenseStatus.Pending
        
        self.flags.emit_change = True
    
    
    def on_update(self):
        self._emit_change_event()
    
    
    def before_update_after_submit(self):
        self._check_change()
    
    
    def on_update_after_submit(self):
        clear_doc_cache(self.doctype, self.name)
        
        if (
            not self.docstatus.is_cancelled() and
            (
                self.status == ExpenseStatus.Rejected or
                self.status == ExpenseStatus.Cancelled
            )
        ):
            self._check_links(str(self.status).lower())
            self.docstatus = DocStatus.cancelled()
        
        self._emit_change_event()
    
    
    def before_cancel(self):
        self._check_links("cancelled")
        
        if self.status != ExpenseStatus.Pending:
            if self.status == ExpenseStatus.Requested:
                throw(_("A requested expense cannot be cancelled."))
            elif self.status == ExpenseStatus.Approved:
                throw(_("An approved expense cannot be cancelled."))
            elif self.status == ExpenseStatus.Rejected:
                throw(_("A rejected expense cannot be cancelled."))
            else:
                throw(_("Only pending expenses can be cancelled."))
        
        self.status = ExpenseStatus.Cancelled
    
    
    def on_cancel(self):
        self.flags.emit_change = True
        self._emit_change_event()
    
    
    def on_trash(self):
        if self.docstatus.is_submitted():
            throw(_("A submitted expense cannot be removed."))
        
        if self.attachments:
            delete_attach_files(
                self.doctype,
                self.name,
                [v.file for v in self.attachments]
            )
    
    
    def after_delete(self):
        self.flags.emit_change = True
        self._emit_change_event("trash")
    
    
    def request(self):
        if (
            self.docstatus.is_submitted() and
            self.status == ExpenseStatus.Pending
        ):
            self.status = ExpenseStatus.Requested
            self.save()
        else:
            throw(_(
                "The expense cannot be requested since it is not a pending."
            ))
    
    
    def approve(self):
        if (
            self.docstatus.is_submitted() and
            self.status == ExpenseStatus.Requested
        ):
            self.status = ExpenseStatus.Approved
            self.save()
        else:
            throw(_(
                "The expense cannot be approved since it has not been requested."
            ))
    
    
    def reject(self):
        if (
            self.docstatus.is_submitted() and
            self.status == ExpenseStatus.Requested
        ):
            self.status = ExpenseStatus.Rejected
            self.docstatus = DocStatus.cancelled()
            self.save()
        else:
            throw(_(
                "The expense cannot be rejected since it has not been requested."
            ))
    
    
    def restore(self):
        if (
            self.docstatus.is_cancelled() and
            self.status == ExpenseStatus.Rejected
        ):
            self.status = ExpenseStatus.Pending
            self.is_restored = 1
            self.docstatus = DocStatus.submitted()
            self.save()
        else:
            throw(_(
                "The expense status cannot be restored since it has not been rejected."
            ))
    
    
    def _check_links(self, action: str):
        if (
            self.status != ExpenseStatus.Draft and
            self.status != ExpenseStatus.Pending and
            (
                expense_requests_exists(self.name) or
                expense_entries_exists(self.name)
            )
        ):
            throw(_(f"An expense with linked expenses requests cannot be {action}."))
    
    
    def _check_change(self):
        if not self.is_new():
            ignore = ["status"]
            for f in self.meta.get("fields"):
                if (
                    f.fieldname not in ignore and
                    self.has_value_changed(f.fieldname)
                ):
                    self.flags.emit_change = True
                    break
    
    
    def _emit_change_event(self, action="change"):
        if self.flags.get("emit_change", False):
            self.flags.pop("emit_change")
            emit_expense_changed({
                "action": action,
                "expense": self.name
            })