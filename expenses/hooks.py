# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


from . import __version__ as app_version
from frappe import __version__ as frappe_version


app_name = "expenses"
app_title = "Expenses"
app_publisher = "Ameen Ahmed (Level Up)"
app_description = "An expenses management module for ERPNext."
app_icon = "octicon octicon-note"
app_color = "blue"
app_email = "kid1194@gmail.com"
app_license = "MIT"


is_frappe_above_v13 = int(frappe_version.split('.')[0]) > 13


app_include_js = [
    "expenses.bundle.js"
] if is_frappe_above_v13 else [
    "assets/expenses/js/expenses.js"
]


doctype_js = {
    "Expenses Settings": "public/js/expenses.js",
    "Expense Type": "public/js/expenses.js",
    "Expense Item": "public/js/expenses.js",
    "Expense": "public/js/expenses.js",
    "Expenses Request": "public/js/expenses.js",
    "Expenses Entry": "public/js/expenses.js"
}


doctype_list_js = {
    "Expense Type": "public/js/expenses.js",
    "Expense Item": "public/js/expenses.js",
    "Expense": "public/js/expenses.js",
    "Expenses Request": "public/js/expenses.js",
    "Expenses Entry": "public/js/expenses.js",
}


doctype_tree_js = {
    "Expense Type": "public/js/expenses.js"
}


after_install = "expenses.setup.install.after_install"
after_uninstall = "expenses.setup.uninstall.after_uninstall"


doc_events = {
    "Role": {
        "before_rename": "expenses.events.role.before_rename",
        "on_trash": "expenses.events.role.on_trash",
    },
    "Workflow": {
        "before_save": "expenses.events.workflow.before_save",
        "before_rename": "expenses.events.workflow.before_rename",
        "on_trash": "expenses.events.workflow.on_trash",
    }
}


fixtures = [
    "Role",
    "Workflow",
    "Workflow State",
    "Workflow Action Master",
    # {
    #     "dt": "Print Format",
    #     "filter": {
    #         "name": ["in", ["Expense Request"]]
    #     }
    # },
]


scheduler_events = {
    "daily": [
        "expenses.utils.update.auto_check_for_update"
    ]
}


treeviews = [
    "Expense Type"
]