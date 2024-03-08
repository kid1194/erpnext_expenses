# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint
from frappe.utils.nestedset import NestedSet

from expenses.libs import (
    error,
    clear_doc_cache,
    type_exists,
    type_children_exists,
    items_of_type_exists
)


class ExpenseType(NestedSet):
    nsm_parent_field = "parent_type"
    nsm_oldparent_field = "old_parent_type"
    
    
    _ignored_fields = ["old_parent_type", "lft", "rgt"]
    
    
    def before_insert(self):
        self._clean_accounts()
    
    
    def before_validate(self):
        self._clean_accounts()
    
    
    def validate(self):
        from expenses.libs import check_app_status
        
        check_app_status()
        self._validate_name()
        self._validate_parent()
        self._validate_type()
        self._validate_accounts()
    
    
    def before_rename(self, olddn, newdn, merge=False):
        super(ExpenseType, self).before_rename(olddn, newdn, merge)
        
        clear_doc_cache(self.doctype, olddn)
    
    
    def before_save(self):
        clear_doc_cache(self.doctype, self.name)
        if not self.is_new():
            if (
                self.has_value_changed("disabled") and
                self.is_disabled and self.is_group_type and
                type_children_exists(self.name)
            ):
                self.flags.disable_descendants = True
                self.flags.emit_change = True
            
            else:
                for f in self.meta.get("fields", []):
                    if (
                        f.fieldname not in self._ignored_fields and
                        self.has_value_changed(f.fieldname)
                    ):
                        self.flags.emit_change = True
                        break
    
    
    def on_update(self):
        if self.flags.get("disable_descendants", False):
            from expenses.libs import disable_type_descendants
            
            self.flags.pop("disable_descendants")
            disable_type_descendants(self.lft, self.rgt)
        
        if not frappe.local.flags.ignore_update_nsm:
            super(ExpenseType, self).on_update()
        
        if self.flags.get("emit_change", False):
            self.flags.pop("emit_change")
            self._emit_change(True)
    
    
    def on_trash(self):
        if self.is_group_type and type_children_exists(self.name):
            self._error(_("An expense type group with existing child types cannot be removed."))
        elif not self.is_group_type and items_of_type_exists(self.name):
            self._error(_("An expense type with existing expense items cannot be removed."))
        
        super(ExpenseType, self).on_trash(True)
    
    
    def after_delete(self):
        clear_doc_cache(self.doctype, self.name)
        self._emit_change()
    
    
    def convert_group_to_item(self, parent_type=None):
        if not self.is_group_type:
            return 1
        
        if not self.parent_type and not parent_type:
            return {"error": _("A valid parent type is required.")}
        
        if type_children_exists(self.name):
            return {"error": _("An expense type group with existing child types cannot be converted to a child.")}
        
        if parent_type and self.parent_type != parent_type:
            error = self._validate_parent(parent_type)
            if error:
                return error
            
            self.parent_type = parent_type
        
        self.is_group = 0
        self.save()
        return 1
    
    
    def convert_item_to_group(self):
        if self.is_group_type:
            return 1
        
        if items_of_type_exists(self.name):
            return {"error": _("An expense type with existing expense items cannot be converted to a group.")}
        
        self.is_group = 1
        self.save()
        return 1
    
    
    @property
    def is_disabled(self):
        return cint(self.disabled) > 0
    
    
    @property
    def is_group_type(self):
        return cint(self.is_group) > 0
    
    
    def _clean_accounts(self):
        if self.expense_accounts:
            exist = []
            for v in self.expense_accounts:
                if not v.company or not v.account or v.company in exist:
                    self.expense_accounts.remove(v)
                else:
                    exist.append(v.company)
    
    
    def _validate_name(self):
        if not self.name:
            self._error(_("A valid expense type name is required."))
    
    
    def _validate_parent(self, parent_type=None):
        ret = True if parent_type else False
        if not ret:
            parent_type = self.parent_type
        
        if not parent_type and not self.is_group_type:
            err = _("A valid parent type is required.")
            if ret:
                return {"error": err}
            
            self._error(err)
        
        if parent_type:
            if parent_type == self.name:
                err = _("A type cannot be its own parent.")
                if ret:
                    return {"error": err}
                
                self._error(err)
            
            from expenses.libs import get_cached_doc
            
            parent = get_cached_doc(self.doctype, parent_type)
            if not parent or parent.is_disabled:
                err = _("The parent type \"{0}\" is disabled or does not exist.").format(parent_type)
                if ret:
                    return {"error": err}
                
                self._error(err)
            
            if not parent.is_group_type:
                err = _("The parent type \"{0}\" must be a group.").format(parent_type)
                if ret:
                    return {"error": err}
                
                self._error(err)
    
    
    def _validate_type(self):
        if not self.is_new() and self.has_value_changed("is_group"):
            if self.is_group_type and items_of_type_exists(self.name):
                self._error(_("An expense type with existing expense items cannot be converted to a group."))
            if not self.is_group_type and type_children_exists(self.name):
                self._error(_("An expense type group with child types cannot be converted to a child."))
    
    
    def _validate_accounts(self):
        if self.expense_accounts:
            from expenses.libs import account_exists
            
            for v in self.expense_accounts:
                if not account_exists(v.account, {"company": v.company}, True):
                    self._error(_(
                        "The expense account \"{0}\" is disabled, does not exist or does not belong to company \"{1}\"."
                    ).format(v.account, v.company))
    
    
    def _emit_change(self, change=False):
        from expenses.libs import emit_type_changed
        
        emit_type_changed({
            "action": "change" if change else "trash",
            "type": self.name
        })
    
    
    def _error(self, msg):
        error(msg, _(self.doctype))