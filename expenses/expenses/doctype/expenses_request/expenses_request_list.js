/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide("frappe.listview_settings");


frappe.listview_settings['Expenses Request'] = {
    hide_name_column: true,
    button: {
        show: function(doc) {
            return frappe.user_roles.includes('Expenses Reviewer')
            && doc.status === 'Approved';
        },
        get_label: function(doc) {
            return __('Make Entry');
        },
        get_description: function(doc) {
            return __('Make expenses entry for {0}', [doc.name]);
        },
        action: function(doc) {
            E.set_cache('make-expenses-entry', doc.name);
            frappe.set_route('Form', 'Expenses Entry');
        },
    },
    formatters: {
        reviewer: function(v) {
            return v || '';
        },
    },
};