# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe.model.document import Document

from expenses import __version__
from expenses.utils import compare_versions, clear_document_cache


class ExpensesSettings(Document):
    @property
    def has_update(self):
        return 1 if compare_versions(self.latest_version, __version__) > 0 else 0
    
    
    def before_save(self):
        clear_document_cache(self.doctype)