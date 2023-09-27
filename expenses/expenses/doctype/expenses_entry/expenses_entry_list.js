/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings['Expenses Entry'] = {
    hide_name_column: true,
    formatters: {
        payment_reference: function(v) {
            return v || '';
        },
        clearance_date: function(v) {
            return v || '';
        },
    },
};