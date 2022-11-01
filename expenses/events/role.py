# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


from frappe import _

from expenses.utils import error


def before_rename(doc, method=None):
    check(doc, "renamed")


def on_trash(doc, method=None):
    check(doc, "trashed")


def check(doc, action):
    name = "Expenses Reviewer"
    if (
        (
            action == "trashed" and
            doc.name == name
        ) or (
            action == "renamed" and
            doc.get_doc_before_save().name == name and
            doc.name != name
        )
    ):
        error(_(
            "This role belongs to the Expenses plugin and should not be {0}."
        ).format(action))