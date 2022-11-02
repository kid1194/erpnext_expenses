/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.provide("frappe.listview_settings");


frappe.listview_settings['Expense Item'] = {
    hide_name_column: true,
    get_indicator: function(doc) {
        return cint(doc.disabled)
            ? [__('Disabled'), 'red', 'disabled,=,Yes']
            : [__('Enabled'), 'green', 'disabled,=,No'];
    },
};