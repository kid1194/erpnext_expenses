# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.utils import cstr
from frappe.model.document import Document

from expenses.libs import get_cached_value


class ExpenseItemAccount(Document):
    @property
    def currency(self):
        return cstr(get_cached_value("Account", self.account, "account_currency"))