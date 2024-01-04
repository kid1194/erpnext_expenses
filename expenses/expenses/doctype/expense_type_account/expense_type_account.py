# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.utils import cstr
from frappe.model.document import Document

from expenses.libs import (
    __ACCOUNT__,
    get_cached_value
)


class ExpenseTypeAccount(Document):
    @property
    def currency(self):
        return cstr(get_cached_value(__ACCOUNT__, self.account, "account_currency"))