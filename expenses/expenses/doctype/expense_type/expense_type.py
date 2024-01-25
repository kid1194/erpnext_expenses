# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _, throw
from frappe.utils import cint, flt
from frappe.utils.nestedset import NestedSet

from expenses.libs import (
    clear_doc_cache,
    get_cached_doc,
    get_count,
    type_exists,
    account_exists,
    type_children_exists,
    items_of_type_exists,
    get_type_lft_rgt,
    type_has_descendants,
    disable_type_descendants,
    emit_type_changed
)


class ExpenseType(NestedSet):
    nsm_parent_field = "parent_type"
    
    
    def before_validate(self):
        if self.expense_accounts:
            existing = []
            for v in self.expense_accounts:
                if (
                    not v.company or
                    not v.account or
                    v.company in existing
                ):
                    self.expense_accounts.remove(v)
                
                else:
                    existing.append(v.company)
    
    
    def validate(self):
        self._validate_name()
        self._validate_parent()
        self._validate_type()
        self._validate_accounts()
    
    
    def before_save(self):
        doc = self._get_old_doc()
        name = self._get_name(doc)
        clear_doc_cache(self.doctype, name)
        
        if not self.is_new():
            if (
                doc and
                not cint(doc.disabled) and
                cint(self.disabled) and
                cint(self.is_group) and
                type_children_exists(name)
            ):
                self.flags.disable_descendants = True
                self.flags.old_data = get_type_lft_rgt(self.name)
                self.flags.emit_change = True
            
            if not self.flags.get("emit_change", False):
                for f in self.meta.get("fields", []):
                    if self.has_value_changed(f.fieldname):
                        self.flags.emit_change = True
                        break
    
    
    def on_update(self):
        if self.flags.get("disable_descendants", False):
            old = self.flags.old_data
            self.flags.pop("disable_descendants")
            self.flags.pop("old_data")
            
            cur = get_type_lft_rgt(self.name)
            if cur:
                if type_has_descendants(cur.lft, cur.rgt):
                    disable_type_descendants(cur.lft, cur.rgt)
                elif (
                    old and
                    (cur.lft != old.lft or cur.rgt != old.rgt) and
                    type_has_descendants(old.lft, old.rgt)
                ):
                    disable_type_descendants(old.lft, old.rgt)
        
        if not frappe.local.flags.ignore_update_nsm:
            super(ExpenseType, self).on_update()
        
        if self.flags.get("emit_change", False):
            self.flags.pop("emit_change")
            emit_type_changed({
                "action": "change",
                "type": self.name,
                "old_type": self._get_name()
            })
    
    
    def on_trash(self):
        is_group = cint(self.is_group)
        if is_group and type_children_exists(self.name):
            throw(_(
                "An expense type group with existing child types cannot be removed."
            ))
        
        elif not is_group and items_of_type_exists(self.name):
            throw(_(
                "An expense type with existing expense items cannot be removed."
            ))
        
        super(ExpenseType, self).on_trash(True)
    
    
    def after_delete(self):
        emit_type_changed({
            "action": "trash",
            "type": self.name
        })
    
    
    def convert_group_to_item(self, parent_type=None):
        is_group = cint(self.is_group)
        if not is_group:
            return 1
        
        if not self.parent_type and not parent_type:
            return {"error": _("A valid expense parent type is required.")}
        
        if is_group and type_children_exists(self.name):
            return {
                "error": _("An expense type group with existing child types cannot be converted to a child.")
            }
        
        if parent_type:
            error = self._validate_parent(parent_type, True)
            if error:
                return error
            
            self.parent_type = parent_type
        
        self.is_group = 0
        self.save()
        
        return 1
    
    
    def convert_item_to_group(self):
        is_group = cint(self.is_group)
        if is_group:
            return 1
        
        if not is_group and items_of_type_exists(self.name):
            return {
                "error": _("An expense type with existing expense items cannot be converted to a group")
            }
        
        self.is_group = 1
        self.save()
        
        return 1
    
    
    def _validate_name(self):
        if not self.name:
            throw(_("A valid expense type name is required."))
        
        count = get_count(self.doctype, {"name": self.name})
        limit = 1 if not self.is_new() else 0
        if count != limit:
            throw(_("The expense type \"{0}\" already exists.").format(self.name))
    
    
    def _validate_parent(self, parent_type=None, return_error=False):
        if not parent_type:
            parent_type = self.parent_type
        
        if (
            not parent_type and
            not cint(self.is_group)
        ):
            throw(_("A valid expense type parent is required."))
        
        if parent_type:
            if not type_exists(parent_type, enabled=True):
                err = _("The expense type parent \"{0}\" is disabled or does not exist.").format(parent_type)
                if return_error:
                    return {"error": err}
                else:
                    throw(err)
            
            else:
                parent = get_cached_doc(self.doctype, parent_type)
                if parent.name == self.name:
                    err = _("The expense type cannot be the parent of itself.").format(self.name)
                    if return_error:
                        return {"error": err}
                    else:
                        throw(err)
                
                if not cint(parent.is_group):
                    err = _("The expense type parent \"{0}\" must be a group.").format(parent_type)
                    if return_error:
                        return {"error": err}
                    else:
                        throw(err)
    
    
    def _validate_type(self):
        doc = self._get_old_doc()
        if doc:
            name = self._get_name(doc)
            is_group = cint(self.is_group)
            is_old_group = cint(doc.is_group)
            
            if (
                is_group and not is_old_group and
                items_of_type_exists(name)
            ):
                throw(_(
                    "An expense type with existing expense items cannot be converted to a group."
                ))
            
            if (
                not is_group and is_old_group and
                type_children_exists(name)
            ):
                throw(_(
                    "An expense type group with child types cannot be converted to a child."
                ))
    
    
    def _validate_accounts(self):
        if not self.expense_accounts:
            throw(_("At least one valid expense account is required."))
        
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