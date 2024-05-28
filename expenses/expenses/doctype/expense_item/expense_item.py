# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _
from frappe.utils import cint, flt
from frappe.model.document import Document

from expenses.libs import clear_doc_cache


class ExpenseItem(Document):
    def validate(self):
        self._check_app_status()
        self.flags.error_list = []
        self._validate_name()
        self._validate_type()
        self._validate_uom()
        self._validate_accounts()
        if self.flags.error_list:
            self._error(self.flags.error_list)
    
    
    def before_rename(self, olddn, newdn, merge=False):
        self._check_app_status()
        clear_doc_cache(self.doctype, olddn)
        self._clean_flags()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
    
    
    def on_update(self):
        self._clean_flags()
    
    
    def on_trash(self):
        self._check_app_status()
        
        from expenses.libs import has_item_expenses
        
        if has_item_expenses(self.name):
            self._error(_("Expense item with existing linked expenses can't be removed."))
    
    
    def after_delete(self):
        clear_doc_cache(self.doctype, self.name)
        self._clean_flags()
    
    
    def reload_expense_accounts(self):
        from expenses.libs import get_type_accounts_list
        
        accounts = get_type_accounts_list(self.expense_type)
        if not accounts:
            changed = self._reset_accounts()
            if changed:
                self.save(ignore_permissions=True)
            return changed
        
        if not self.expense_accounts:
            self._add_accounts(accounts)
            self.save(ignore_permissions=True)
            return 1
        
        companies = [v["company"] for v in accounts]
        changed = 0
        for v in self.expense_accounts:
            if v.company in companies:
                data = companies.index(v.company)
                companies.pop(data)
                data = accounts.pop(data)
                if v.account != data["account"]:
                    v.account = data["account"]
                    changed = 1
                if v.currency != data["currency"]:
                    v.currency = data["currency"]
                    changed = 1
                if not cint(v.inherited):
                    v.inherited = 1
                    changed = 1
            elif cint(v.inherited):
                v.inherited = 0
                changed = 1
        
        if accounts:
            changed = 1
            self._add_accounts(accounts)
        
        if changed:
            self.flags.reload_accounts = 1
            self.save(ignore_permissions=True)
        return changed
    
    
    def _validate_name(self):
        if not self.name:
            self._error(_("A valid name is required."))
    
    
    def _validate_type(self):
        if not self.expense_type:
            self._add_error(_("A valid expense type is required."))
        elif self.is_new() or self.has_value_changed("expense_type"):
            from expenses.libs import type_exists
            
            if not type_exists(self.expense_type):
                self._add_error(_("Expense type \"{0}\" doesn't exist.").format(self.expense_type))
            else:
                self._inherit_accounts()
    
    
    def _validate_uom(self):
        if not self.uom:
            self._add_error(_("A valid unit of measure (UOM) is required."))
        elif self.is_new() or self.has_value_changed("uom"):
            from expenses.libs import uom_exists
            
            if not uom_exists(self.uom):
                self._add_error(_("Unit of measure (UOM) \"{0}\" doesn't exist.").format(self.uom))
    
    
    def _validate_accounts(self):
        if not self.expense_accounts:
            self._add_error(_("At least one company expense account is required."))
        elif (
            self.is_new() or (
                self.has_value_changed("expense_accounts") and
                not self.flags.get("reload_accounts", 0)
            )
        ):
            self._prepare_accounts()
            table = _("Expense Accounts & Defaults")
            ext = {"company": [], "account": []}
            fil = {"companies": [], "accounts": []}
            for v in self.expense_accounts:
                if v.company:
                    fil["companies"].append(v.company)
                if v.account:
                    fil["accounts"].append(v.account)
            
            if fil["companies"]:
                from expenses.libs import companies_filter
                
                fil["companies"] = companies_filter(fil["companies"], {"is_group": 0})
            
            if fil["accounts"]:
                from expenses.libs import company_accounts_filter
                
                fil["accounts"] = company_accounts_filter(fil["accounts"])
            
            for i, v in enumerate(self.expense_accounts):
                if not v.company:
                    self._add_error(_("{0} - #{1}: A valid company is required.").format(table, i))
                    continue
                if v.company in ext["company"]:
                    self._add_error(_("{0} - #{1}: Company \"{2}\" already exist.").format(table, i, v.company))
                    continue
                if v.company not in fil["companies"]:
                    self._add_error(_("{0} - #{1}: Company \"{2}\" is a group or doesn't exist.").format(table, i, v.company))
                    continue
                ext["company"].append(v.company)
                if not v.account:
                    self._add_error(_("{0} - #{1}: A valid expense account is required.").format(table, i))
                    continue
                if v.account in ext["account"]:
                    self._add_error(_("{0} - #{1}: Expense account \"{2}\" already exist.").format(table, i, v.account))
                    continue
                if v.account not in fil["accounts"] or v.company != fil["accounts"][v.account]:
                    self._add_error(
                        _("{0} - #{1}: Expense account \"{2}\" isn't linked to company \"{3}\" or doesn't exist.")
                        .format(table, i, v.account, v.company)
                    )
                    continue
                ext["account"].append(v.account)
            
            ext.clear()
            fil.clear()
    
    
    def _inherit_accounts(self):
        from expenses.libs import get_type_accounts_list
        
        accounts = get_type_accounts_list(self.expense_type)
        if not accounts:
            return self._reset_accounts()
        
        if not self.expense_accounts:
            self._add_accounts(accounts)
            return 0
        
        companies = [v["company"] for v in accounts]
        self._reset_accounts()
        for v in self.expense_accounts:
            if not v.company or not v.account:
                continue
            if v.company in companies:
                data = companies.index(v.company)
                companies.pop(data)
                data = accounts.pop(data)
                v.account = data["account"]
                v.currency = data["currency"]
                v.inherited = 1
        
        if accounts:
            self._add_accounts(accounts)
    
    
    def _prepare_accounts(self):
        keys = ["cost", "qty"]
        for v in self.expense_accounts:
            for k in keys:
                t = flt(v.get(k))
                if t < 0:
                    v.set(k, 0)
                if t > 0 or flt(v.get(f"min_{k}")) < 0:
                    v.set(f"min_{k}", 0)
                if t > 0 or flt(v.get(f"max_{k}")) < 0:
                    v.set(f"max_{k}", 0)
    
    
    def _reset_accounts(self):
        changed = 0
        if self.expense_accounts:
            for v in self.expense_accounts:
                if cint(v.inherited):
                    v.inherited = 0
                    changed = 1
        return changed
    
    
    def _add_accounts(self, accounts):
        for i in range(len(accounts)):
            self.append("expense_accounts", accounts.pop(0))
    
    
    def _check_app_status(self):
        if not self.flags.get("status_checked", 0):
            from expenses.libs import check_app_status
            
            check_app_status()
            self.flags.status_checked = 1
    
    
    def _clean_flags(self):
        keys = [
            "reload_accounts",
            "error_list",
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