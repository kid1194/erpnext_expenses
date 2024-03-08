/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');
frappe.provide('frappe.model');


frappe.listview_settings['Expense Item'] = {
    hide_name_column: true,
    //add_fields: ['disabled'],
    onload: function(list) {
        frappe.exp().on('ready change', function() { this.setup_list(list); });
    },
    get_indicator: function(doc) {
        return cint(doc.disabled)
            ? ['Disabled', 'red', 'disabled,=,1']
            : ['Enabled', 'green', 'disabled,=,0'];
    },
};