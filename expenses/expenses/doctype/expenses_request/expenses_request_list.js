/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings['Expenses Request'] = {
    onload: function(list) {
        frappe.exp().on('ready change', function() { this.setup_list(list); });
    },
    button: {
        show: function(doc) {
            return frappe.user_roles.includes('Expenses Reviewer')
            && cint(doc.docstatus) === 1 && cstr(doc.status) === 'Approved';
        },
        get_label: function(doc) {
            return __('Create Entry');
        },
        get_description: function(doc) {
            return __('Create expenses entry for "{0}".', [cstr(doc.name)]);
        },
        action: function(doc) {
            frappe.new_doc('Expenses Entry', {expenses_request_ref: cstr(doc.name)});
        },
    },
    formatters: {
        reviewer: function(v) { return cstr(v); },
    },
};