/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Type', {
    setup: function(frm) {
        frappe.exp()
            .on('ready change', function() {
                this.setup_form(frm);
            })
            .on('exp_type_changed', function(ret) {
                if (!ret) return;
                if (cstr(ret.action) === 'change' && (
                    cstr(ret.type) === cstr(frm.doc.name)
                    || cstr(ret.old_type) === cstr(frm.doc.name)
                )) {
                    let message = __('The expense type data has changed. Reload to update the form.');
                    if (frm.is_dirty())
                        message = message + '<br/><strong class="text-danger">'
                            + __('Warning: All the unsaved changes will be discarded.')
                        + '</strong>';
                    
                    frappe.warn(
                        __('Expense Type Changed'),
                        message,
                        function() { frm.reload_doc(); },
                        __('Reload')
                    );
                } else if (
                    cstr(ret.action) === 'trash'
                    && cstr(ret.type) === cstr(frm.doc.name)
                ) {
                    window.setTimeout(function() {
                        frm.trigger('go_to_tree');
                    }, 6000);
                    frappe.throw({
                        title: __('Expense Type Removed'),
                        message: __('The expense type has been removed. You will be redirected automatically back to the Tree View.'),
                    });
                }
            });
        frm._type = {
            is_new: false,
            reqd_accounts: true,
            has_accounts: [],
            tree: {
                show: false,
                ready: false,
                pending: false,
            },
            table: {
                ready: false,
                data: frappe.exp().table(2),
            },
            toolbar: {
                ready: false,
                pending: false,
                list: [
                    [
                        'Convert To Item',
                        'convert_group_to_item',
                        'Unable to convert the expense type group to an item.'
                    ],
                    [
                        'Convert To Group',
                        'convert_item_to_group',
                        'Unable to convert the expense type item to a group.'
                    ],
                ],
            },
        };
    },
    onload: function(frm) {
        frm._type.is_new = !!frm.is_new();
        
        frm.set_query('parent_type', function() {
            let filters = {is_group: 1},
            name = cstr(frm.doc.name);
            if (name.length && cint(frm.doc.is_group))
                filters.name = ['!=', name];
            return {
                query: frappe.exp().path('search_types'),
                filters: filters,
            };
        });
        
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let filters = {is_group: 0},
            companies = frm._type.table.data.col(1);
            if (companies.length) filters.name = ['not in', companies];
            return {filters: filters};
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            return {filters: {
                is_group: 0,
                root_type: 'Expense',
                company: cstr(locals[cdt][cdn].company),
            }};
        });
        
        frappe.exp().request(
            'type_form_setup',
            null,
            function(ret) {
                if (this.$isDataObj(ret) && this.$isArr(ret.has_accounts))
                    frm._type.has_accounts = ret.has_accounts;
            }
        );
        
        if (!frm._type.is_new && (frm.doc.expense_accounts || []).length) {
            var del = [];
            frm.doc.expense_accounts.forEach(function(v, i) {
                let name = cstr(v.name),
                company = cstr(v.company);
                if (
                    !frm._type.table.data.has(name)
                    && !frm._type.table.data.has(company, 1)
                ) frm._type.table.data.add(name, company, cstr(v.account));
                else del.push(i);
            });
            if (del.length) {
                var table = frm.doc.expense_accounts.slice();
                del.reverse().forEach(function(i) {
                    table.splice(i, 1);
                });
                frm.set_value('expense_accounts', table);
                frm.refresh_field('expense_accounts');
            }
        }
        
        if (frm._type.is_new) {
            let tmp = frappe.exp().pop_cache('create-expense-type');
            if (frappe.exp().$isDataObj(tmp)) {
                frm._type.tree.show = true;
                if (!frappe.exp().$isEmptyObj(tmp)) {
                    if (cint(tmp.is_group)) frm.set_value('is_group', 1);
                    if (cstr(tmp.parent_type).length)
                        frm.set_value('parent_type', frappe.utils.escape_html(cstr(tmp.parent_type)));
                    frm.trigger('check_expense_accounts_status');
                }
            }
        }
    },
    refresh: function(frm) {
        frm.trigger('form_init');
    },
    is_group: function(frm) {
        frm.trigger('check_expense_accounts_status');
    },
    parent_type: function(frm) {
        frm.trigger('check_expense_accounts_status');
    },
    validate: function(frm) {
        if (!cstr(frm.doc.name).length) {
            frappe.exp()
                .focus(frm, 'name')
                .error('A valid expense type name is required.');
            return false;
        }
        if (!cint(frm.doc.is_group) && !cstr(frm.doc.parent_type).length) {
            frappe.exp()
                .focus(frm, 'parent_type')
                .error('A valid expense type parent is required.');
            return false;
        }
        if (!(frm.doc.expense_accounts || []).length) {
            frappe.exp()
                .focus(frm, 'expense_accounts')
                .error('At least one valid expense account is required.');
            return false;
        }
    },
    after_save: function(frm) {
        if (frm._type.tree.ready && frm._type.tree.pending) {
            frm.trigger('go_to_tree');
            return;
        }
        if (frm._type.table.ready && frm._type.is_new)
            frm.trigger('unsetup_child_table');
        frm._type.is_new = false;
        if (frm._type.toolbar.ready && frm._type.toolbar.pending)
            frm.trigger('toolbar_action_handler');
    },
    form_init: function(frm) {
        if (frm._type.is_new && frm._type.tree.show && !frm._type.tree.ready)
            frm.trigger('setup_tree_toolbar');
        if (frm._type.is_new && !frm._type.table.ready)
            frm.trigger('setup_child_table');
        if (!frm._type.is_new) frm.trigger('toggle_disabled_desc');
        if (!frm._type.is_new && !frm._type.toolbar.ready)
            frm.trigger('add_toolbar_buttons');
    },
    check_expense_accounts_status: function(frm) {
        let parent = cstr(frm.doc.parent_type),
        reqd = !cint(frm.doc.is_group) && (
            !parent.length
            || frm._type.has_accounts.indexOf(parent) < 0
        );
        if (frm._type.reqd_accounts === reqd) return;
        frm._type.reqd_accounts = reqd;
        frm.trigger('update_expense_accounts_status');
    },
    update_expense_accounts_status: function(frm) {
        let table = 'expense_accounts',
        reqd = frm._type.reqd_accounts ? 1 : 0;
        frm.toggle_reqd(table, reqd);
        frm.set_df_property(table, 'bold', reqd);
        frm.refresh_field(table);
    },
    setup_tree_toolbar: function(frm) {
        frm._type.tree.ready = true;
        let btn = __('Go Back');
        if (frm.custom_buttons[btn]) return;
        frm.add_custom_button(btn, function() {
            if (!frm.is_dirty()) frm.trigger('go_to_tree');
            else {
                frm._type.tree.pending = true;
                frappe.exp().error('The form contains some unsaved changes. Click "Save" in order to proceed.');
            }
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
    go_to_tree: function(frm) {
        frappe.set_route('Tree', frm.doctype);
    },
    setup_child_table: function(frm) {
        frm._type.table.ready = true;
        var field_grid = frm.get_field('expense_accounts').grid;
        field_grid.add_custom_button(
            __('Add All Companies'),
            function() {
                frappe.dom.freeze(__('Adding all companies and their default expense accounts.'));
                frappe.exp().request(
                    'get_all_companies_accounts',
                    null,
                    function(ret) {
                        frappe.dom.unfreeze();
                        if (!this.$isArr(ret) || !ret.length) {
                            frappe.show_alert({
                                indicator: 'blue',
                                message: __('There are no companies to add.'),
                            });
                            return;
                        }
                        
                        let start = frm._type.table.data.length;
                        ret.forEach(function(v) {
                            let company = cstr(v.name);
                            if (!frm._type.table.data.has(company, 1)) {
                                let row = frm.add_child(
                                    'expense_accounts',
                                    {company: company, account: cstr(v.default_expense_account)}
                                );
                                frm._type.table.data.add(
                                    cstr(row.name),
                                    cstr(row.company),
                                    cstr(row.account)
                                );
                            }
                        });
                        
                        if (start < frm._type.table.data.length)
                            frappe.show_alert({
                                indicator: 'green',
                                message: __('The expense accounts table has been updated successfully.'),
                            });
                        else
                            frappe.show_alert({
                                indicator: 'blue',
                                message: __('The expense accounts table already has all the companies.'),
                            });
                        
                        frm.trigger('unsetup_child_table');
                    },
                    function(e) {
                        frappe.dom.unfreeze();
                        frappe.show_alert({
                            indicator: 'red',
                            message: e.message,
                        });
                    }
                );
            }
        )
        .removeClass('btn-default')
        .addClass('btn-secondary');
        
        field_grid.add_custom_button(
            __('Copy From'),
            function() {
                frappe.prompt(
                    [
                        {
                            fieldname: 'expense_type',
                            fieldtype: 'Link',
                            label: __('Expense Type'),
                            options: 'Expense Type',
                            reqd: 1,
                            bold: 1,
                            get_query: function() {
                                return {
                                    query: frappe.exp().path('search_types'),
                                    filters: {
                                        name: ['!=', cstr(frm.doc.name)],
                                    },
                                };
                            },
                        },
                    ],
                    function(vals) {
                        frappe.dom.freeze(__('Copying expense accounts from "{0}".', [vals.expense_type]));
                        frappe.exp().request(
                            'type_accounts',
                            {name: vals.expense_type},
                            function(ret) {
                                frappe.dom.unfreeze();
                                if (!this.$isArr(ret) || !ret.length) {
                                    frappe.show_alert({
                                        indicator: 'blue',
                                        message: __('The selected expense type has no expense accounts.'),
                                    });
                                    return;
                                }
                                
                                ret.forEach(function(v) {
                                    let company = cstr(v.company);
                                    if (!frm._type.table.data.has(company, 1)) {
                                        let row = frm.add_child(
                                            'expense_accounts',
                                            {company: company, account: cstr(v.account)}
                                        );
                                        frm._type.table.data.add(
                                            cstr(row.name),
                                            cstr(row.company),
                                            cstr(row.account)
                                        );
                                    }
                                });
                                
                                frappe.show_alert({
                                    indicator: 'green',
                                    message: __('The expense accounts table has been updated successfully.'),
                                });
                                
                                frm.trigger('unsetup_child_table');
                            },
                            function(e) {
                                frappe.dom.unfreeze();
                                frappe.show_alert({
                                    indicator: 'red',
                                    message: e.message,
                                });
                            }
                        );
                    },
                    __('Select Expense Type'),
                    __('Copy')
                );
            }
        )
        .removeClass('btn-default')
        .addClass('btn-secondary');
    },
    unsetup_child_table: function(frm) {
        frm._type.table.ready = false;
        let label = __('Add All Companies'),
        grid = frm.get_field('expense_accounts').grid,
        btn = grid.custom_buttons[label];
        if (btn) {
            btn.remove();
            delete grid.custom_buttons[label];
        }
    },
    toggle_disabled_desc: function(frm) {
        let field = frm.get_field('disabled');
        if (!cint(frm.doc.is_group)) field.toggle_description(false);
        else {
            field.set_new_description(__(
                'Disabling an expense type group will result in '
                + 'disabling all its child types and their linked expense items'
            ));
            field.toggle_description(true);
        }
    },
    add_toolbar_buttons: function(frm) {
        if (frm._type.toolbar.ready) return;
        frm._type.toolbar.ready = true;
        var toolbar = frm._type.toolbar.list[cint(frm.doc.is_group) ? 0 : 1];
        let btn = __(toolbar[0]);
        if (frm.custom_buttons[btn]) return;
        frm.add_custom_button(btn, function() {
            if (!frm.is_dirty()) frm.trigger('toolbar_action_handler');
            else {
                frm._type.toolbar.pending = true;
                frappe.exp().error('The form contains some unsaved changes. Click "Save" in order to proceed.');
            }
            
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
    toolbar_action_handler: function(frm) {
        frm._type.toolbar.pending = false;
        if (!cint(frm.doc.is_group) || cstr(frm.doc.parent_type).length)
            frm.trigger('toolbar_action_request');
        else
            frm.trigger('toolbar_action_prompt');
    },
    toolbar_action_request: function(frm) {
        let toolbar = frm._type.toolbar.list[cint(frm.doc.is_group) ? 0 : 1],
        vals = frm._type.toolbar.values;
        delete frm._type.toolbar.values;
        frappe.exp().request(
            toolbar[1],
            {
                name: frm.doc.name,
                parent_type: vals ? cstr(vals.parent_type) : null
            },
            function(ret) {
                if (!ret) frappe.exp().error(toolbar[2]);
                else if (ret.error) frappe.exp().error(ret.error);
                else frm.reload_doc();
            }
        );
    },
    toolbar_action_prompt: function(frm) {
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
                            query: frappe.exp().path('search_types'),
                            filters: {
                                name: ['!=', cstr(frm.doc.name)],
                                is_group: 1,
                            },
                        };
                    },
                },
            ],
            function(ret) {
                frm._type.toolbar.values = ret;
                frm.trigger('toolbar_action_request');
            },
            __('Select A Parent Type'),
            __('Convert')
        );
    }
});

frappe.ui.form.on('Expense Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frm._type.table.data.del(cstr(row.name || cdn));
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        name = cstr(row.name || cdn),
        company = cstr(row.company),
        account = cstr(row.account);
        if (!company.length) {
            frm._type.table.data.del(name);
            if (account.length) frappe.model.set_value(row, 'account', '');
        } else if (frm._type.table.data.has(company, 1)) {
            frm._type.table.data.del(name);
            frappe.model.set_value(row, 'company', '');
            if (account.length) frappe.model.set_value(row, 'account', '');
        } else {
            frm._type.table.data.add(name, company, null);
        }
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        name = cstr(row.name || cdn),
        company = cstr(row.company),
        account = cstr(row.account);
        if (!account.length) return;
        if (!company.length || !frm._type.table.data.has(company, 1)) {
            frm._type.table.data.del(name);
            if (account.length) frappe.model.set_value(row, 'account', '');
            return;
        }
        frm._type.table.data.add(name, null, account);
    },
});