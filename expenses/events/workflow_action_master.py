# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from frappe import _

from expenses.utils.common import error


def before_save(doc, method=None):
    evaluate(doc, "modified")


def before_rename(doc, method=None):
    evaluate(doc, "renamed")


def on_trash(doc, method=None):
    evaluate(doc, "trashed")


def evaluate(doc, action):
    names = ["Submit", "Cancel", "Approve", "Reject"]
    if (
        (
            action == "renamed" and
            doc.get_doc_before_save().name in names and
            doc.name not in names
        ) or
        (action != "renamed" and doc.name in names)
    ):
        error(_(
            "This workflow action master belongs to the Expenses plugin and should not be {0}."
        ).format(action))