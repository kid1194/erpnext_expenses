/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings['Expenses Request'] = {
    onload: function(list) {
        frappe.exp().on('ready change', function() {
            frappe.dom.unfreeze();
            if (!this.is_enabled)
                frappe.dom.freeze(
                    '<strong class="text-danger">'
                    + __('The Expenses app has been disabled.')
                    + '</strong>'
                );
        });
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
            return __('Create expenses entry for "{0}"', [cstr(doc.name)]);
        },
        action: function(doc) {
            frappe.exp().set_cache('create-expenses-entry', cstr(doc.name));
            frappe.set_route('Form', 'Expenses Entry');
        },
    },
    formatters: {
        reviewer: function(v) {
            return cstr(v);
        },
    },
};