# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _
from frappe.utils import flt
from frappe.model.document import Document

from expenses.libs import (
    error,
    clear_doc_cache
)


class ExpenseItem(Document):
    def before_insert(self):
        self._inherit_accounts()
    
    
    def before_validate(self):
        self._inherit_accounts()
    
    
    def validate(self):
        from expenses.libs import check_app_status
        
        check_app_status()
        self._validate_name()
        self._validate_type()
        self._validate_accounts()
    
    
    def before_rename(self, olddn, newdn, merge=False):
        clear_doc_cache(self.doctype, olddn)
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        
        if not self.is_new():
            for f in self.meta.get("fields", []):
                if self.has_value_changed(f.fieldname):
                    self.flags.emit_change = True
                    break
    
    
    def on_update(self):
        self._emit_change()
    
    
    def on_trash(self):
        from expenses.libs import has_item_expenses
        
        if has_item_expenses(self.name):
            self._error(_("An expense item with existing linked expenses cannot be removed."))
    
    
    def after_delete(self):
        self.flags.emit_change = True
        self._emit_change(True)
    
    
    def _inherit_accounts(self):
        if self.expense_type:
            from expenses.libs import get_type_accounts_list
            
            accounts = get_type_accounts_list(self.expense_type)
            if not self.expense_accounts:
                for v in accounts:
                    self.append("expense_accounts", v)
            else:
                accounts_len = len(accounts)
                accounts = {v["company"]:v for v in accounts}
                keys = ["cost", "qty"]
                exist = []
                for v in self.expense_accounts:
                    if v.company not in accounts or v.company in exist:
                        self.expense_accounts.remove(v)
                    else:
                        exist.append(v.company)
                        if accounts[v.company]["account"] != v.account:
                            v.account = accounts[v.company]["account"]
                        for k in keys:
                            mk = f"min_{k}"
                            xk = f"max_{k}"
                            va = flt(v.get(k))
                            if va != 0:
                                if va < 0:
                                    v.set(k, 0)
                                v.set(mk, 0)
                                v.set(xk, 0)
                            else:
                                mv = flt(v.get(mk))
                                xv = flt(v.get(xk))
                                if xv < 0:
                                    v.set(xk, 0)
                                if mv < 0 or mv > xv:
                                    v.set(mk, 0)
                
                if accounts_len != len(self.expense_accounts):
                    exist = [v.company for v in self.expense_accounts]
                    for company in accounts:
                        if company not in exist:
                            self.append("expense_accounts", accounts[company])
    
    
    def _validate_name(self):
        if not self.name:
            self._error(_("A valid expense item name is required."))
        
        from expenses.libs import get_count
        
        count = get_count(self.doctype, {"name": self.name})
        limit = 1 if not self.is_new() else 0
        if count != limit:
            self._error(_("The expense item \"{0}\" already exists.").format(self.name))
    
    
    def _validate_type(self):
        if not self.expense_type:
            self._error(_("A valid expense type is required."))
        
        from expenses.libs import type_exists
        
        if not type_exists(self.expense_type):
            self._error(_("The expense type \"{0}\" does not exist.").format(self.expense_type))
    
    
    def _validate_accounts(self):
        if not self.expense_accounts:
            self._error(_("At least one inherited expense account from expense type is required."))
    
    
    def _emit_change(self, trash=False):
        if self.flags.get("emit_change", False):
            from expenses.libs import emit_item_changed
            
            self.flags.pop("emit_change")
            emit_item_changed({
                "action": "trash" if trash else "change",
                "item": self.name
            })
    
    
    def _error(self, msg):
        error(msg, _("Expense Item Error"))