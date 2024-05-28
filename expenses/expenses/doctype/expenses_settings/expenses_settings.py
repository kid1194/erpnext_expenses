# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _
from frappe.utils import cint
from frappe.model.document import Document


class ExpensesSettings(Document):
    def validate(self):
        if self._send_update_notification:
            self._check_sender()
            self._check_receivers()
    
    
    def before_save(self):
        from expenses.libs import clear_doc_cache
        
        clear_doc_cache(self.doctype)
    
    
    def after_save(self):
        if self.has_value_changed("is_enabled"):
            from expenses.libs import emit_settings_changed
            
            emit_settings_changed({
                "is_enabled": 1 if self._is_enabled else 0
            })
    
    
    @property
    def _is_enabled(self):
        return cint(self.is_enabled) > 0
    
    
    @property
    def _reqd_expense_claim_if_paid(self):
        return cint(self.reqd_expense_claim_if_paid) > 0
    
    
    @property
    def _auto_check_for_update(self):
        return cint(self.auto_check_for_update) > 0
    
    
    @property
    def _send_update_notification(self):
        return cint(self.send_update_notification) > 0
    
    
    def _check_sender(self):
        if not self.update_notification_sender:
            self._error(_("A valid update notification sender is required."))
        
        from expenses.libs import user_exists
        
        if not user_exists(self.update_notification_sender):
            self._error(_("Update notification sender doesn't exist."))
    
    
    def _check_receivers(self):
        if self.update_notification_receivers:
            from expenses.libs import users_filter
            
            users = users_filter([v.user for v in self.update_notification_receivers])
            exist = []
            notfound = []
            for v in self.update_notification_receivers:
                if v.user not in users or v.user in exist:
                    notfound.append(v)
                else:
                    exist.append(v.user)
            
            users.clear()
            exist.clear()
            if notfound:
                for i in range(len(notfound)):
                    self.update_notification_receivers.remove(notfound.pop(0))
        
        if not self.update_notification_receivers:
            self._error(_("At least one valid update notification receiver is required."))
    
    
    def _error(self, msg):
        from expenses.libs import error
        
        error(msg, _(self.doctype))