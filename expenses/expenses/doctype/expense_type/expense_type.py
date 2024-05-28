# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint
from frappe.utils.nestedset import NestedSet

from expenses.libs import clear_doc_cache


class ExpenseType(NestedSet):
    nsm_parent_field = "parent_type"
    nsm_oldparent_field = "old_parent_type"
    
    
    def validate(self):
        self._check_app_status()
        self.flags.error_list = []
        self._validate_name()
        self._validate_type()
        self._validate_parent()
        self._validate_accounts()
        if self.flags.error_list:
            self._error(self.flags.error_list)
    
    
    def before_rename(self, olddn, newdn, merge=False):
        self._check_app_status()
        
        super(ExpenseType, self).before_rename(olddn, newdn, merge)
        
        clear_doc_cache(self.doctype, olddn)
        self._clean_flags()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if (
            not self.is_new() and
            self.has_value_changed("disabled") and
            self._is_disabled and self._is_group
        ):
            self.flags.disable_descendants = 1
    
    
    def on_update(self):
        if self.flags.pop("disable_descendants", 0):
            from expenses.libs import disable_type_descendants
            
            disable_type_descendants(self.lft, self.rgt)
        
        if self.flags.pop("reload_linked_items", 0):
            from expenses.libs import reload_type_linked_items
            
            reload_type_linked_items(self.lft, self.rgt)
        
        self._clean_flags()
        if not frappe.local.flags.ignore_update_nsm:
            super(ExpenseType, self).on_update()
    
    
    def on_trash(self):
        self._check_app_status()
        if self._is_group:
            from expenses.libs import type_children_exists
        
            if type_children_exists(self.name):
                self._error(_("Expense type group with existing child items can't be removed."))
        else:
            from expenses.libs import type_items_exists
            
            if type_items_exists(self.name):
                self._error(_("Expense type with linked expense items can't be removed."))
        
        super(ExpenseType, self).on_trash(True)
    
    
    def after_delete(self):
        self._clean_flags()
        clear_doc_cache(self.doctype, self.name)
    
    
    def convert_to_item(self, parent_type=None):
        if not self._is_group:
            return {"success": 1}
        
        if not parent_type:
            if not self.parent_type:
                return {"error": _("A valid parent expense type is required.")}
        
        from expenses.libs import type_children_exists
        
        if type_children_exists(self.name):
            return {"error": _("Expense type group with existing child items can't be converted to an item.")}
        
        if parent_type and self.parent_type != parent_type:
            error = self._check_parent(parent_type, False)
            if error:
                return error
            
            self.parent_type = parent_type
        
        self.is_group = 0
        self.save(ignore_permissions=True)
        return {"success": 1}
    
    
    def convert_to_group(self):
        if self._is_group:
            return {"success": 1}
        
        from expenses.libs import type_items_exists
        
        if type_items_exists(self.name):
            return {"error": _("Expense type with linked expense items can't be converted to a group.")}
        
        self.is_group = 1
        self.save(ignore_permissions=True)
        return {"success": 1}
    
    
    @property
    def _is_disabled(self):
        return cint(self.disabled) > 0
    
    
    @property
    def _is_group(self):
        return cint(self.is_group) > 0
    
    
    def _validate_name(self):
        if not self.name:
            self._error(_("A valid name is required."))
    
    
    def _validate_type(self):
        if not self.is_new() and self.has_value_changed("is_group"):
            self._error(_("Set once fields can't be changed."))
    
    
    def _validate_parent(self):
        if not self._is_group and not self.parent_type:
            self._add_error(_("A valid parent expense type is required."))
        elif self.parent_type and (self.is_new() or self.has_value_changed("parent_type")):
            self._check_parent(self.parent_type, True)
    
    
    def _validate_accounts(self):
        if not self.expense_accounts or (not self.is_new() and not self.has_value_changed("expense_accounts")):
            return 0
        
        table = _("Expense Accounts")
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
        if not self.is_new() and not self.flags.error_list:
            self.flags.reload_linked_items = 1
    
    
    def _check_parent(self, parent_type, _throw):
        if parent_type == self.name:
            err = _("Expense type can't be its own parent.")
            if _throw:
                self._add_error(err)
            return {"error": err} if not _throw else 0
        
        from expenses.libs import type_exists
        
        if not type_exists(parent_type, {"is_group": 1}):
            err = _("Parent expense type \"{0}\" isn't a group or doesn't exist.").format(parent_type)
            if _throw:
                self._add_error(err)
            return {"error": err} if not _throw else 0
    
    
    def _check_app_status(self):
        if not self.flags.get("status_checked", 0):
            from expenses.libs import check_app_status
            
            check_app_status()
            self.flags.status_checked = 1
    
    
    def _clean_flags(self):
        keys = [
            "error_list",
            "disable_descendants",
            "reload_linked_items",
            "status_checked"
        ]
        for i in range(len(keys)):
            self.flags.pop(keys.pop(0), 0)
    
    
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