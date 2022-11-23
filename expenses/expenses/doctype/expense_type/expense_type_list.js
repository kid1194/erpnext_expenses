/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings['Expense Type'] = {
    hide_name_column: true,
    get_indicator: function(doc) {
        return cint(doc.disabled)
            ? ['Disabled', 'red', 'disabled,=,1']
            : ['Enabled', 'green', 'disabled,=,0'];
    },
    formatters: {
        parent_type: function(v) {
            return v || __('Root');
        },
        is_group: function(v) {
            return __(cint(v) ? 'Yes' : 'No');
        },
    },
};