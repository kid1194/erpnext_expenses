# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


from frappe.model.document import Document

from expenses.utils import get_expense


class ExpensesRequestExpense(Document):
    @property
    def expense_item(self):
        self.get_virtuals();
        return self._expense_item
    
    
    @property
    def description(self):
        self.get_virtuals();
        return self._description
    
    
    @property
    def currency(self):
        self.get_virtuals();
        return self._currency
    
    
    @property
    def total(self):
        self.get_virtuals();
        return self._total
    
    
    @property
    def is_advance(self):
        self.get_virtuals();
        return self._is_advance
    
    
    def get_virtuals(self):
        if not self._expense_item:
            doc = get_expense(self.expense)
            self._expense_item = doc.expense_item
            self._description = doc.description
            self._currency = doc.currency
            self._total = doc.total
            self._is_advance = doc.is_advance