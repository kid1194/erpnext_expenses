/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.ui.form.on('Expense Type', {
    setup: function(frm) {
        E.frm(frm);
        frm.E = {
            companies_list: null,
            companies: E.unique_array(),
            toolbar: [
                [
                    'Convert To Item',
                    'convert_group_to_item',
                    'Unable to convert the expense type group to an item'
                ],
                [
                    'Convert To Group',
                    'convert_item_to_group',
                    'Unable to convert the expense type item to a group'
                ],
            ],
        };
    },
    onload: function(frm) {
        frm.set_query('parent_type', function() {
            return {
                query: E.path('search_types'),
                filters: {
                    is_not: frm.doc.name || '',
                    is_group: 1,
                },
            };
        });
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let filters = {is_group: 0};
            if (frm.E.companies.length) {
                filters.name = ['not in', frm.E.companies.all()];
            }
            return {filters};
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            return {
                filters: {
                    is_group: 0,
                    root_type: 'Expense',
                    company: locals[cdt][cdn].company,
                }
            };
        });
        if (!frm.is_new()) return;
        frm.get_field('expense_accounts').grid.add_custom_button(
            __('Add All Companies'),
            function() {
                function resolve(ret) {
                    E.each(ret, function(v) {
                        if (frm.E.companies.has(v.name)) return;
                        let row = frm.add_child('expense_accounts', {
                            company: v.name,
                            account: v.default_expense_account,
                        });
                        frm.E.companies.rpush(row.company, row.name);
                    });
                }
                if (frm.E.companies_list) {
                    resolve(frm.E.companies_list);
                    return;
                }
                E.get_list(
                    'Company',
                    {
                        fields: ['name', 'default_expense_account'],
                        filters: {is_group: 0},
                    },
                    function(ret) {
                        if (!E.is_arr(ret) || !ret.length) {
                            E.error('Unable to get the list of companies');
                            return;
                        }
                        frm.E.companies_list = ret;
                        resolve(ret);
                    }
                );
            }
        )
        .removeClass('btn-default')
        .addClass('btn-secondary');
    },
    refresh: function(frm) {
        frm.trigger('toggle_disabled_desc');
		frm.trigger('add_toolbar_buttons');
    },
    is_group: function(frm) {
        frm.trigger('toggle_disabled_desc');
    },
    toggle_disabled_desc: function(frm) {
        if (frm.is_new()) return;
        let desc = cint(frm.doc.is_group)
            ? 'Disabling a group will disable all its children, groups and items'
            : '',
        field = frm.get_field('disabled');
        field.set_description(desc);
        field.toggle_description(!!frm.doc.is_group);
    },
    add_toolbar_buttons: function(frm) {
        if (frm.is_new()) return;
        var toolbar = frm.E.toolbar[cint(frm.doc.is_group) ? 0 : 1];
        let btn = __(toolbar[0]);
        if (!frm.custom_buttons[btn]) {
            frm.clear_custom_buttons();
            frm.add_custom_button(btn, function() {
                if (frm.is_dirty()) {
                    E.error('Please save the changes first');
                    return;
                }
                function resolve(vals) {
                    E.call(
                        [frm.doc, toolbar[1]],
                        vals ? {parent_type: vals.parent_type} : null,
                        function(ret) {
                            if (!ret) {
                                E.error(toolbar[2]);
                                return;
                            }
                            if (E.is_obj(ret) && ret.error) {
                                E.error(ret.error);
                                return;
                            }
                            frm.reload_doc();
                        }
                    );
                }
                if (!cint(frm.doc.is_group) || frm.doc.parent_type) {
                    resolve();
                    return;
                }
                frappe.prompt(
                    [
                        {
                            fieldname: 'parent_type',
                            fieldtype: 'Link',
                            label: __('Parent Type'),
                            options: 'Expense Type',
                            reqd: 1,
                            bold: 1,
                            get_query: function() {
                                return {
                                    query: E.path('search_types'),
                                    filters: {
                                        is_not: frm.doc.name || '',
                                        is_group: 1,
                                    },
                                };
                            },
                        },
                    ],
                    function(ret) {
                        resolve(ret);
                    },
                    __('Select A Parent Type'),
                    __('Convert')
                );
            });
            frm.change_custom_button_type(btn, null, 'info');
        }
    }
});

frappe.ui.form.on('Expense Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        frm.E.companies.del(locals[cdt][cdn].company, cdn);
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.company) {
            frm.E.companies.del(null, cdn);
            row.account = '';
            E.refresh_row_df('expense_accounts', cdn, 'account');
            return;
        }
        if (frm.E.companies.has(row.company)) {
            E.error(
                'The expense account for {0} already exist',
                [row.company]
            );
            row.company = '';
            E.refresh_row_df('expense_accounts', cdn, 'company');
            return;
        }
        frm.E.companies.rpush(row.company, cdn);
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.account || row.company) return;
        E.error('Please select a company first');
        row.account = '';
        E.refresh_row_df('expense_accounts', cdn, 'account');
    },
});