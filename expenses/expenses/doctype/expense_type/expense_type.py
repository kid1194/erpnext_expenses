# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe import _
from frappe.utils import cint, flt
from frappe.utils.nestedset import NestedSet

from expenses.utils import (
    error,
    clear_document_cache,
    disable_items_of_expense_types,
    type_children_exists,
    items_of_expense_type_exists
)


class ExpenseType(NestedSet):
    nsm_parent_field = "parent_type"
    
    
    def autoname(self):
        if self.type_name:
            self.name = self.type_name
    
    
    def before_validate(self):
        if cint(self.is_group):
            self.expense_accounts.clear()
        else:
            existing = []
            for v in self.expense_accounts:
                if (
                    not v.company or
                    v.company in existing or
                    not v.account
                ):
                    self.expense_accounts.remove(v)
                else:
                    existing.append(v.company)
                    if flt(v.cost) != 0:
                        v.cost = 0
                    if flt(v.qty) != 0:
                        v.qty = 0
    
    
    def validate(self):
        if not self.type_name:
            error(_("The name field is mandatory"))
        if not cint(self.is_group) and not self.parent_type:
            error(_("The parent type field is mandatory"))
        if frappe.db.exists(self.doctype, self.name):
            error(_("{0} expense type already exist").format(self.name))
        
        self.validate_parent()
        self.validate_group_or_item()
        self.validate_accounts()
    
    
    def validate_parent(self, parent_type=None):
        if not parent_type:
            parent_type = self.parent_type
        
        if parent_type:
            par = frappe.db.get_value(self.doctype, parent_type, ["name", "is_group"], as_dict=1)
            if not par:
                error(_("The expense type parent \"{0}\" does not exist").format(parent_type))
            elif par.name == self.name:
                error(_("The expense type \"{0}\" cannot be the parent of itself").format(self.name))
            elif not cint(par.is_group):
                error(_("The expense type parent \"{0}\" must be a group").format(parent_type))
    
    
    def validate_group_or_item(self):
        if not self.is_new():
            existing_is_group = frappe.db.get_value(self.doctype, self.name, "is_group", pluck=True)
            is_group = cint(self.is_group)
            if is_group != cint(existing_is_group):
                if is_group and self.check_if_items_exist():
                    error(_("{0} with existing expense items cannot be converted to a group".format(self.doctype)))
                elif not is_group and self.check_if_children_exist():
                    error(_("{0} group with child nodes cannot be converted to a child".format(self.doctype)))
    
    
    def validate_accounts(self):
        if not cint(self.is_group):
            if not self.expense_accounts:
                error(_("The expense type must have at least one company expense account"))
            else:
                for v in self.expense_accounts:
                    if frappe.db.get_value("Account", v.account, "company") != v.company:
                        error(
                            (_("The expense account \"{0}\" does not belong to the company \"{1}\"")
                                .format(v.account, v.company))
                        )
    
    
    def before_save(self):
        self.load_doc_before_save()
        clear_document_cache(
            self.doctype,
            self.name if not self.get_doc_before_save() else self.get_doc_before_save().name
        )
        if (
            not self.is_new() and cint(self.disabled) and
            cint(self.is_group) and self.check_if_children_exist() and
            self.get_doc_before_save() and not cint(self.get_doc_before_save().disabled)
        ):
            self._disable_descendants = True
    
    
    def on_update(self):
        if self._disable_descendants:
            self._disable_descendants = False
            types = frappe.get_all(
                self.doctype,
                fields=["name"],
                filters={
                    "disabled": 0,
                    "lft": [">", self.lft],
                    "rgt": ["<", self.rgt],
                },
                pluck="name"
            )
            disable_items_of_expense_types(types)
            doc = frappe.qb.DocType(self.doctype)
            (
                frappe.qb.update(doc)
                .set(doc.disabled, 1)
                .where(doc.name.isin(types))
            ).run()
        
        if not frappe.local.flags.ignore_update_nsm:
            super(ExpenseType, self).on_update()
    
    
    def on_trash(self):
        is_group = cint(self.is_group)
        if is_group and self.check_if_children_exist():
            error(_("{0} group with child items cannot be deleted".format(self.doctype)))
        elif not is_group and self.check_if_items_exist():
            error(_("{0} with existing expense items cannot be deleted".format(self.doctype)))
        else:
            super(ExpenseType, self).on_trash(True)
    
    
    @frappe.whitelist()
    def convert_group_to_item(self, parent_type=None):
        if not self.parent_type and not parent_type:
            return {"error": "Please provide a parent type"}
        
        if cint(self.is_group) and self.check_if_children_exist():
            return {"error": "{0} group with child items cannot be converted to a child".format(self.doctype)}
        
        if parent_type:
            self.validate_parent(parent_type)
            self.parent_type = parent_type
        
        self.is_group = 0
        self.save()
        return 1
    
    
    @frappe.whitelist()
    def convert_item_to_group(self):
        if not cint(self.is_group) and self.check_if_items_exist():
            return {"error": "{0} with existing expense items cannot be converted to a group".format(self.doctype)}
        
        self.is_group = 1
        self.expense_accounts.clear()
        self.save()
        return 1
    
    
    def check_if_children_exist(self):
        return type_children_exists(self.name)
    
    
    def check_if_items_exist(self):
        return items_of_expense_type_exists(self.name)