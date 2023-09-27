# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.model.document import Document

from expenses.utils import get_cached_value


class ExpenseAccount(Document):
    @property
    def currency(self):
        if not self._currency and self.account:
            self._currency = get_cached_value(
                "Account", self.account, "account_currency"
            )
        return self._currency