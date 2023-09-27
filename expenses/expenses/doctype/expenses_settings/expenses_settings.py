# Expenses © 2023
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.model.document import Document

from expenses.utils import clear_doc_cache


class ExpensesSettings(Document):
    def before_save(self):
        clear_doc_cache(self.doctype)