# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from . import __version__ as app_version


app_name = "expenses"
app_title = "Expenses"
app_publisher = "Ameen Ahmed (Level Up)"
app_description = "An expenses management module for ERPNext."
app_icon = "octicon octicon-note"
app_color = "blue"
app_email = "kid1194@gmail.com"
app_license = "MIT"


doctype_js = {
    "Expenses Settings": "public/js/expenses.js",
    "Expense Type": [
        "public/js/expenses.js",
        "public/js/expenses.unique_array.js"
    ],
    "Expense Item": [
        "public/js/expenses.js",
        "public/js/expenses.unique_array.js"
    ],
    "Expense": "public/js/expenses.js",
    "Expenses Request": [
        "public/js/expenses.js",
        "public/js/form_dialog.js"
    ],
    "Expenses Entry": "public/js/expenses.js"
}


doctype_list_js = {
    "Expense": [
        "public/js/expenses.js",
        "public/js/expenses.form_dialog.js"
    ]
}


doctype_tree_js = {
    "Expense Type": [
        "public/js/expenses.js",
        "public/js/expenses.form_dialog.js",
        "public/js/expenses.unique_array.js"
    ]
}


after_install = "expenses.setup.install.after_install"
after_uninstall = "expenses.setup.uninstall.after_uninstall"


fixtures = [
    "Role",
    "Workflow",
    "Workflow State",
    "Workflow Action Master"
]


scheduler_events = {
    "daily": [
        "expenses.utils.update.auto_check_for_update"
    ]
}


treeviews = [
    "Expense Type"
]