# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.model.document import Document


class ExpenseTypeAccount(Document):
    @property
    def currency(self):
        from frappe.utils import cstr
        
        from expenses.libs import get_cached_value
        
        return cstr(get_cached_value("Account", self.account, "account_currency"))