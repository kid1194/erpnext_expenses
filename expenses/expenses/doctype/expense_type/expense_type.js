/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Type', {
    setup: function(frm) {
        frappe.Expenses();
        frappe.E.form(frm);
        frm._is_new = frm.is_new();
        frm._add_all_companies_btn = 0;
        frm._companies = frappe.E.tableArray();
        frm._toolbar = [
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
        ];
    },
    onload: function(frm) {
        frm.set_query('parent_type', function() {
            return {
                query: frappe.E.path('search_types'),
                filters: {
                    name: ['!=', frm.doc.name || ''],
                    is_group: 1,
                },
            };
        });
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let filters = {is_group: 0};
            if (frm._companies.length)
                filters.name = ['not in', frm._companies.col(0)];
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
        
        if (!frm._is_new)
            frappe.E.each(frm.doc.expense_accounts, function(v) {
                frm._companies
                    .add(v.name, v.company, 0)
                    .add(v.name, v.account, 1);
            });
    },
    refresh: function(frm) {
        frm.trigger('form_init');
    },
    validate: function(frm) {
        if (!cstr(frm.doc.type_name).length) {
            frappe.E.setFieldError('type_name', 'Name is mandatory', true);
            return false;
        }
        if (cint(frm.doc.is_group) && !cstr(frm.doc.parent_type).length) {
            frappe.E.setFieldError('parent_type', 'Parent type is mandatory', true);
            return false;
        }
    },
    after_save: function(frm) {
        if (frm._add_all_companies_btn && frm._is_new)
            frm.get_field('expense_accounts').grid.clear_custom_buttons();
        frm._is_new = false;
    },
    form_init: function(frm) {
        frm.trigger('setup_child_table');
        if (!frm._is_new) {
            frm.trigger('toggle_disabled_desc');
            frm.trigger('add_toolbar_buttons');
        }
    },
    setup_child_table: function(frm) {
        if (frm._add_all_companies_btn || !frm._is_new) return;
        frm._add_all_companies_btn = 1;
        frm.get_field('expense_accounts').grid.add_custom_button(
            __('Add All Companies'),
            function() {
                frappe.dom.freeze(__('Adding Expense Accounts'));
                frappe.E.getList(
                    'Company',
                    {
                        fields: ['name', 'default_expense_account'],
                        filters: {is_group: 0},
                    },
                    function(ret) {
                        if (!frappe.E.isArray(ret) || !ret.length) {
                            frappe.E.error('Unable to get the list of companies');
                            return;
                        }
                        let exist = frm._companies.col(0),
                        row;
                        frappe.E.each(ret, function(v) {
                            if (exist.indexOf(v.name) >= 0) return;
                            row = frm.add_child('expense_accounts', {
                                company: v.name,
                                account: v.default_expense_account,
                            });
                            frm._companies
                                .add(row.name, row.company, 0)
                                .add(row.name, row.account, 1);
                        });
                    },
                    function() { frappe.dom.unfreeze(); }
                );
            }
        )
        .removeClass('btn-default')
        .addClass('btn-secondary');
    },
    toggle_disabled_desc: function(frm) {
        let field = frm.get_field('disabled');
        if (!cint(frm.doc.is_group)) {
            field.toggle_description(false);
            return;
        }
        field.set_new_description(__(
            'Disabling a group will disable all its children (groups and items)'
        ));
        field.toggle_description(true);
    },
    add_toolbar_buttons: function(frm) {
        var toolbar = frm._toolbar[cint(frm.doc.is_group) ? 0 : 1];
        let btn = __(toolbar[0]);
        if (frm.custom_buttons[btn]) return;
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            if (frm.is_dirty()) {
                frappe.E.error('Please save the changes first');
                return;
            }
            function resolve(vals) {
                frappe.E.call(
                    [frm.doc, toolbar[1]],
                    vals ? {parent_type: vals.parent_type} : null,
                    function(ret) {
                        if (!ret) {
                            frappe.E.error(toolbar[2]);
                            return;
                        }
                        if (frappe.E.isPlainObject(ret) && ret.error) {
                            frappe.E.error(ret.error, ret.args);
                            return;
                        }
                        frm.reload_doc();
                    }
                );
            }
            if (!cint(frm.doc.is_group) || cstr(frm.doc.parent_type).length) {
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
                                query: frappe.E.path('search_types'),
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
});

frappe.ui.form.on('Expense Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frm._companies.del(row.name || cdn);
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!cstr(row.company).length) {
            frm._companies.del(row.name || cdn);
            if (cstr(row.account).length)
                frappe.E.setDocValue(row, 'account', '');
        } else frm._companies.add(row.name || cdn, row.company, 0);
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!cstr(row.company).length) {
            frappe.E.error('Please select a company first');
            if (cstr(row.account).length)
                frappe.E.setDocValue(row, 'account', '');
            return;
        }
        if (!cstr(row.account).length && !cstr(row.company).length) return;
        let ckey = frm._companies.eqKey(row.account, 1),
        crow = frm._companies.eqRow(row.account, 1);
        if (
            ckey && crow && ckey !== (row.name || cdn)
            && crow[0] === row.company
        ) {
            frappe.E.error(
                'The expense account "{0}" for "{1}" already exist',
                [row.account, row.company]
            );
            frappe.E.setDocValue(row, 'account', '');
            return;
        }
        frm._companies.add(row.name || cdn, row.account, 1);
    },
});