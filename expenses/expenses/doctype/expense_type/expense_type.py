# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint, flt
from frappe.utils.nestedset import NestedSet

from expenses.utils import (
    error,
    clear_doc_cache,
    get_cached_value,
    type_children_exists,
    items_of_expense_type_exists,
    disable_type_descendants
)


class ExpenseType(NestedSet):
    nsm_parent_field = "parent_type"
    
    
    def before_validate(self):
        if not cint(self.is_group) and self.parent_type:
            self.parent_type = None
        
        if self.expense_accounts:
            existing = {}
            for i in range(len(self.expense_accounts)):
                v = self.expense_accounts[i]
                if (
                    not v.company or not v.account or
                    (v.company in existing and existing[v.company] == v.account)
                ):
                    self.expense_accounts.remove(v)
                else:
                    existing[v.company] = v.account
                    # v.cost = 0
                    # v.min_cost = 0
                    # v.max_cost = 0
                    # v.qty = 0
                    # v.min_qty = 0
                    # v.max_qty = 0
    
    
    def validate(self):
        if not self.type_name:
            error(_("{0} name is mandatory").format(self.doctype))
        if not cint(self.is_group) and not self.parent_type:
            error(_("{0} parent is mandatory").format(self.doctype))
        if not self.expense_accounts:
            error(_("{0} must have at least one expense account").format(self.doctype))
        
        self._validate_name()
        self._validate_parent()
        self._validate_type()
        self._validate_accounts()
    
    
    def before_save(self):
        if not self.get_doc_before_save():
            self.load_doc_before_save()
        clear_doc_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
        if (
            not self.is_new() and cint(self.disabled) and
            cint(self.is_group) and type_children_exists(self.name) and
            self.get_doc_before_save() and not cint(self.get_doc_before_save().disabled)
        ):
            self._disable_descendants = True
    
    
    def on_update(self):
        if self._disable_descendants:
            self._disable_descendants = False
            disable_type_descendants(self.lft, self.rgt)
        if not frappe.local.flags.ignore_update_nsm:
            super(ExpenseType, self).on_update()
    
    
    def on_trash(self):
        is_group = cint(self.is_group)
        if is_group and type_children_exists(self.name):
            error(
                _("{0} group with child items cannot be deleted")
                .format(self.doctype)
            )
        if not is_group and items_of_expense_type_exists(self.name):
            error(
                _("{0} with existing expense items cannot be deleted")
                .format(self.doctype)
            )
        
        super(ExpenseType, self).on_trash(True)
    
    
    @frappe.whitelist(methods=["POST"])
    def convert_group_to_item(self, parent_type=None):
        if not self.parent_type and not parent_type:
            return {"error": "Please provide a parent type"}
        
        if cint(self.is_group) and type_children_exists(self.name):
            return {
                "error": "{0} group with child items cannot be converted to a child",
                "args": [self.doctype],
            }
        
        if parent_type:
            if (error := self._validate_parent(parent_type, True)):
                return error
            
            self.parent_type = parent_type
        
        self.is_group = 0
        self.save()
        return 1
    
    
    @frappe.whitelist()
    def convert_item_to_group(self):
        if not cint(self.is_group) and items_of_expense_type_exists(self.name):
            return {
                "error": "{0} with existing expense items cannot be converted to a group",
                "args": [self.doctype],
            }
        
        self.is_group = 1
        self.save()
        return 1
    
    
    def _validate_name(self):
        if frappe.db.exists(self.doctype, self.name):
            error(_("{0} \"{1}\" already exist").format(self.doctype, self.name))
    
    
    def _validate_parent(self, parent_type=None, return_error=None):
        if not parent_type:
            parent_type = self.parent_type
        
        if parent_type:
            if not frappe.db.exists(self.doctype, parent_type):
                error_msg = "{0} \"{1}\" does not exist"
                if return_error:
                    return {"error": error_msg, "args": [self.doctype, parent_type]}
                else:
                    error(_(error_msg).format(self.doctype, parent_type))
            else:
                parent = get_cached_value(self.doctype, parent_type, ["name", "is_group"])
                if parent.name == self.name:
                    error_msg = "{0} \"{1}\" cannot be the parent of itself"
                    if return_error:
                        return {"error": error_msg, "args": [self.doctype, parent_type]}
                    else:
                        error(_(error_msg).format(self.doctype, parent_type))
                if not cint(parent.is_group):
                    error_msg = "{0} \"{1}\" must be a group"
                    if return_error:
                        return {"error": error_msg, "args": [self.doctype, parent_type]}
                    else:
                        error(_(error_msg).format(self.doctype, parent_type))
    
    
    def _validate_type(self):
        if not self.is_new():
            if not self.get_doc_before_save():
                self.load_doc_before_save()
            if self.get_doc_before_save():
                existing_is_group = cint(self.get_doc_before_save().is_group)
                is_group = cint(self.is_group)
                if is_group != existing_is_group:
                    if is_group and items_of_expense_type_exists(self.name):
                        error(
                            _("{0} with existing expense items cannot be converted to a group")
                            .format(self.doctype)
                        )
                    if not is_group and type_children_exists(self.name):
                        error(
                            _("{0} group with child nodes cannot be converted to a child")
                            .format(self.doctype)
                        )
    
    
    def _validate_accounts(self):
        for v in self.expense_accounts:
            if not frappe.db.exists("Account", {"name": v.account, "company": v.company}):
                error(
                    _("Expense account \"{0}\" does not exist or does not belong to company \"{1}\"")
                    .format(v.account, v.company)
                )