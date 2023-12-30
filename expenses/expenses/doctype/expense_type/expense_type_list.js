/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');
frappe.provide('frappe.model');


frappe.listview_settings['Expense Type'] = {
    onload: function(list) {
        frappe.exp()
            .on('ready change', function() {
                frappe.dom.unfreeze();
                if (!this.is_enabled)
                    frappe.dom.freeze(
                        '<strong class="text-danger">'
                        + __('The Expenses app has been disabled.')
                        + '</strong>'
                    );
            });
        try {
            list.orig_get_args = list.get_args;
            list.get_args = function() {
                let args = this.orig_get_args();
                if (this.doctype === 'Expense Type') {
                    let field = frappe.model.get_full_column_name('disabled', this.doctype);
                    if (args.fields.indexOf(field) < 0) args.fields.push(field);
                }
                return args;
            };
            list.setup_columns();
            list.refresh(true);
        } catch(e) {
            console.error('[Expenses][Expense Type List]: Onload error', e.message, e.stack);
        }
    },
    get_indicator: function(doc) {
        return cint(doc.disabled)
            ? ['Disabled', 'red', 'disabled,=,1']
            : ['Enabled', 'green', 'disabled,=,0'];
    },
    formatters: {
        parent_type: function(v) {
            v = cstr(v);
            return v.length ? v : __('Root');
        },
        is_group: function(v) {
            return __(cint(v) ? 'Yes' : 'No');
        },
    },
};