/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings['Expense Type'] = {
    onload: function(list) {
        frappe.exp().on('ready change', function() { this.setup_list(list); });
    },
    get_indicator: function(doc) {
        return cint(doc.disabled)
            ? [__('Disabled'), 'red', 'disabled,=,1']
            : [__('Enabled'), 'green', 'disabled,=,0'];
    },
    formatters: {
        parent_type: function(v) { return frappe.exp().$isStrVal(v) ? v : __('Root'); },
        is_group: function(v) { return __(cint(v) ? 'Yes' : 'No'); },
    },
};