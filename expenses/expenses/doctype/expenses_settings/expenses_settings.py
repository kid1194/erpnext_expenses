# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _, throw
from frappe.utils import cint
from frappe.model.document import Document

from expenses.libs import (
    clear_doc_cache,
    user_exists,
    users_exists,
    emit_app_status_changed
)


class ExpensesSettings(Document):
    def before_validate(self):
        if (
            cint(self.is_enabled) and
            cint(self.send_update_notification) and
            self.update_notification_receivers
        ):
            existing = []
            for v in self.update_notification_receivers:
                if v.user in existing:
                    self.update_notification_receivers.remove(v)
                else:
                    existing.append(v.user)
    
    
    def validate(self):
        if (
            cint(self.is_enabled) and
            cint(self.send_update_notification)
        ):
            self._check_sender()
            self._check_receivers()
    
    
    def before_save(self):
        clear_doc_cache(self.doctype)
    
    
    def after_save(self):
        if self.has_value_changed("is_enabled"):
            emit_app_status_changed({"is_enabled": cint(self.is_enabled) > 0})
    
    
    def _check_sender(self):
        if not self.update_notification_sender:
            throw(_("A valid update notification sender is required."))
        
        if not user_exists(self.update_notification_sender):
            throw(_("The update notification sender selected does not exist."))
    
    
    def _check_receivers(self):
        if not self.update_notification_receivers:
            throw(_("At least one enabled update notification receiver is required."))
        
        if not users_exists([v.user for v in self.update_notification_receivers]):
            if len(self.update_notification_receivers) > 1:
                throw(_("Some of the selected update notification receivers does not exist."))
            else:
                throw(_("The selected update notification receiver does not exist."))