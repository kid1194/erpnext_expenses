# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _, throw
from frappe.utils import flt
from frappe.model.document import Document

from expenses.libs import (
    clear_doc_cache,
    get_count,
    type_exists,
    account_exists,
    has_item_expenses,
    emit_item_changed
)


class ExpenseItem(Document):
    _emit_change = False
    
    
    def before_validate(self):
        if self.expense_accounts:
            existing = []
            keys = ["cost", "qty"]
            for v in self.expense_accounts:
                if (
                    not v.company or
                    not v.account or
                    v.company in existing
                ):
                    self.expense_accounts.remove(v)
                
                else:
                    existing.append(v.company)
                    for k in keys:
                        mk = f"min_{k}"
                        xk = f"max_{k}"
                        val = flt(v[k])
                        if val != 0:
                            if val < 0:
                                v[k] = 0
                            v[mk] = 0
                            v[xk] = 0
                        else:
                            mval = flt(v[mk])
                            xval = flt(v[xk])
                            if xval < 0:
                                v[xk] = 0
                            if mval < 0 or mval > xval:
                                v[mk] = 0
    
    
    def validate(self):
        self._validate_name()
        self._validate_type()
        self._validate_accounts()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self._get_name())
        
        if not self.is_new():
            for f in self.meta.get("fields"):
                if self.has_value_changed(f.fieldname):
                    self._emit_change = True
                    break
    
    
    def on_update(self):
        if self._emit_change:
            self._emit_change = False
            emit_item_changed({
                "action": "change",
                "item": self.name,
                "old_item": self._get_name()
            })
    
    
    def on_trash(self):
        if has_item_expenses(self.name):
            throw(_(
                "An expense item with existing linked expenses cannot be removed."
            ))
    
    
    def after_delete(self):
        emit_item_changed({
            "action": "trash",
            "item": self.name
        })
    
    
    def _validate_name(self):
        if not self.name:
            throw(_("A valid expense item name is required."))
        
        count = get_count(self.doctype, {"name": self.name})
        limit = 1 if not self.is_new() else 0
        if count != limit:
            throw(_("The expense item \"{0}\" already exists.").format(self.name))
    
    
    def _validate_type(self):
        if not self.expense_type:
            throw(_("A valid expense type is required."))
        
        if not type_exists(self.expense_type, enabled=True):
            throw(_("The expense type \"{0}\" is disabled or does not exist.").format(self.expense_type))
    
    
    def _validate_accounts(self):
        if self.expense_accounts:
            for v in self.expense_accounts:
                if not account_exists(v.account, {"company": v.company}, True):
                    throw(_(
                        "The expense account \"{0}\" is disabled, does not exist or does not belong to company \"{1}\"."
                    ).format(v.account, v.company))
    
    
    def _get_old_doc(self):
        if self.is_new():
            return None
        
        doc = self.get_doc_before_save()
        if not doc:
            self.load_doc_before_save()
            doc = self.get_doc_before_save()
        
        return doc
    
    
    def _get_name(self, doc=None):
        if not doc:
            doc = self._get_old_doc()
        
        if doc and doc.name and doc.name != self.name:
            return doc.name
        
        return self.name