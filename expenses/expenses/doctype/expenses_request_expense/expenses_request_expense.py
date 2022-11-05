# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


from frappe.model.document import Document

from expenses.utils import get_expense


class ExpensesRequestExpense(Document):
    @property
    def expense_item(self):
        return self.get_expense("expense_item")
    
    
    @property
    def required_by(self):
        return self.get_expense("required_by")
    
    
    @property
    def description(self):
        return self.get_expense("description")
    
    
    @property
    def currency(self):
        return self.get_expense("currency")
    
    
    @property
    def total(self):
        return self.get_expense("total")
    
    
    @property
    def is_paid(self):
        return self.get_expense("is_paid")
    
    
    @property
    def paid_by(self):
        return self.get_expense("paid_by")
    
    
    @property
    def is_advance(self):
        return self.get_expense("is_advance")
    
    
    @property
    def party_type(self):
        return self.get_expense("party_type")
    
    
    @property
    def party(self):
        return self.get_expense("party")
    
    
    def get_expense(self, key):
        if not self._expense:
            self._expense = get_expense(self.expense)
        return self._expense.get(key)