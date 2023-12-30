/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');
frappe.provide('frappe.model');


frappe.listview_settings['Expense'] = {
    onload: function(list) {
        frappe.listview_settings.Expense.list = list;
        frappe.exp()
            .on('ready', function() {
                if (!this.is_enabled) {
                    list.page.clear_actions_menu();
                    return;
                }
                frappe.listview_settings.Expense.action_btn = list.page.add_actions_menu_item(
                    __('Create Request'),
                    function() {
                        var selected = frappe.listview_settings.Expense.list.get_checked_items(),
                        company = null,
                        expenses = [];
                        if (!selected.length) {
                            frappe.exp().error(
                                'Expense List Error',
                                'At least one company expense must be selected in order to create an expense request.'
                            );
                            return;
                        }
                        $.each(selected, function(i, v) {
                            if (cint(v.docstatus) !== 1) return;
                            let comp = cstr(v.company);
                            if (!company || company === comp) expenses.push(cstr(v.name));
                            if (!company) company = comp;
                        });
                        var callback = function() {
                            frappe.listview_settings.Expense.list.clear_checked_items();
                            frappe.exp().set_cache('create-expenses-request', {
                                company: company,
                                expenses: expenses,
                            });
                            frappe.router.set_route('Form', 'Expenses Request');
                        };
                        if (expenses.length === selected.length) callback();
                        else frappe.confirm(
                            __(
                                'The selected expense entries can only belong to one company. '
                                + 'Therefore, only the entries for "{0}" will be included in the expenses request.',
                                [company]
                            )
                            + '<p>' + __('Do you want to continue?') + '</p>',
                            callback,
                            function() {
                                frappe.listview_settings.Expense.list.clear_checked_items();
                            }
                        );
                    },
                    true
                );
            })
            .on('ready change', function() {
                frappe.dom.unfreeze();
                var btn = frappe.listview_settings.Expense.action_btn;
                if (!this.is_enabled) {
                    if (btn) btn.hide();
                    frappe.dom.freeze(
                        '<strong class="text-danger">'
                        + __('The Expenses app has been disabled.')
                        + '</strong>'
                    );
                } else if (btn) btn.show();
            });
        
        try {
            list.orig_get_args = list.get_args;
            list.get_args = function() {
                var args = this.orig_get_args(),
                dt = this.doctype;
                if (dt === 'Expense') {
                    if (!args.fields) args.fields = [];
                    var field;
                    $.each(['party_type', 'party', 'paid_by'], function(i, k) {
                        field = frappe.model.get_full_column_name(k, dt);
                        if (args.fields.indexOf(field) < 0) args.fields.push(field);
                    });
                }
                return args;
            };
            list.setup_columns();
            list.refresh(true);
        } catch(e) {
            console.error('[Expenses][Expense List]: Onload error', e.message, e.stack);
        }
    },
    get_indicator: function(doc) {
        var opts = {
            Draft: ['gray', 0],
            Pending: ['orange', 1],
            Requested: ['blue', 1],
            Approved: ['green', 1],
            Rejected: ['red', 2],
            Cancelled: ['red', 2],
        },
        status = cstr(doc.status);
        return [
            status,
            opts[status][0],
            'status,=,\'' + status + '\'|docstatus,=,' + opts[status][1]
        ];
    },
    formatters: {
        name: function(v, df, doc) {
            var html = [];
            if (
                cstr(doc.party_type).length
                && cstr(doc.party).length
            ) html.push('<small class="text-muted mr-4">' + __(cstr(doc.party_type)) + ': ' + cstr(doc.party) + '</small>');
            if (cstr(doc.paid_by).length)
                html.push('<small class="text-muted mr-4">' + __('Paid By') + ': ' + cstr(doc.paid_by) + '</small>');
            html = v + (html.length ? '<br/>' + html.join('') : '');
            return html;
        },
        is_advance: function(v) {
            return __(cint(v) ? 'Yes' : 'No');
        },
    },
};