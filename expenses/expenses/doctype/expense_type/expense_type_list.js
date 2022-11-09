/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.provide("frappe.listview_settings");


frappe.listview_settings['Expense Type'] = {
    hide_name_column: true,
    formatters: {
        parent_type: function(v) {
            return v || __('Root');
        },
        is_group: function(v) {
            return __(cint(v) ? 'Yes' : 'No');
        }
    },
};