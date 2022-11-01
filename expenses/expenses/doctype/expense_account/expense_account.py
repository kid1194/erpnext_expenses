# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


import frappe
from frappe.model.document import Document


class ExpenseAccount(Document):
    @property
    def currency(self):
        if not self._currency and self.account:
            self._currency = frappe.get_cached_value(
                "Account", self.account,
                "account_currency", pluck=True
            )
        return self._currency