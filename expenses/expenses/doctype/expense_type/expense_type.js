/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Type', {
    onload: function(frm) {
        frappe.exp().on('ready change', function() { this.setup_form(frm); });
        frm._type = {
            is_group: 0,
            tree: {show: 0, ready: 0, pending: 0},
            table: {ready: 0, data: frappe.exp().table(2)},
            toolbar: {
                pending: 0,
                list: [
                    [
                        __('Convert To Item'),
                        'convert_group_to_item',
                        __('Unable to convert the expense type group to an item.')
                    ],
                    [
                        __('Convert To Group'),
                        'convert_item_to_group',
                        __('Unable to convert the expense type item to a group.')
                    ],
                ],
            },
            go_to_tree: function() { frappe.set_route('Tree', frm.doctype); },
        };
        frm.set_query('parent_type', function(doc) {
            let qry = {query: frappe.exp().get_method('search_types')};
            if (!frm.is_new()) qry.filters = {is_not: cstr(frm.docname)};
            return qry;
        });
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let filters = {is_group: 0};
            if (frm._type.table.data.length)
                filters.name = ['not in', frm._type.table.data.col(1)];
            return {filters: filters};
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            return {filters: {
                is_group: 0, root_type: 'Expense',
                company: cstr(locals[cdt][cdn].company),
            }};
        });
        if (!!frm.is_new()) frm._type.tree.show = !!(frappe.route_options || {}).from_tree;
        else if (frappe.exp().$isArrVal(frm.doc.expense_accounts))
            for (let i = 0, l = frm.doc.expense_accounts.length, v; i < l; i++) {
                v = frm.doc.expense_accounts[i];
                frm._type.table.data.add(cstr(v.name), cstr(v.company), cstr(v.account));
            }
    },
    refresh: function(frm) {
        if (!!frm.is_new()) {
            if (frm._type.tree.show && !frm._type.tree.ready) frm.events.setup_tree_toolbar(frm);
            if (!frm._type.table.ready) frm.events.setup_child_table(frm);
        } else {
            if (frm._type.tree.ready) frm.events.setup_tree_toolbar(frm, 1);
            if (frm._type.table.ready) frm.events.setup_child_table(frm, 1);
            frm.events.toggle_disabled_desc(frm);
        }
    },
    is_group: function(frm) {
        let val = cint(frm.doc.is_group) > 0 ? 0 : 1;
        frm.set_df_property('parent_type', 'reqd', val);
        frm.set_df_property('parent_type', 'bold', val);
        frm.events.toggle_disabled_desc(frm);
    },
    validate: function(frm) {
        if (!cstr(frm.doc.name).length) {
            frappe.throw(__('A valid name is required.'));
            return false;
        }
        if (!cint(frm.doc.is_group) && !cstr(frm.doc.parent_type).length) {
            frappe.throw(__('A valid parent type is required.'));
            return false;
        }
    },
    after_save: function(frm) {
        if (frm._type.tree.pending) return frm._type.go_to_tree();
        if (frm._type.table.ready) frm.events.setup_child_table(frm, 1);
        if (frm._type.toolbar.pending) frm.events.toolbar_action_handler(frm);
    },
    setup_tree_toolbar: function(frm, del) {
        let btn = __('Go Back');
        if (del && frm.custom_buttons[btn]) {
            frm._type.tree.show = frm._type.tree.ready = 0;
            frm.custom_buttons[btn].remove();
            delete frm.custom_buttons[btn];
        }
        if (del) return;
        frm._type.tree.ready = 1;
        frm.add_custom_button(btn, function() {
            if (!frm.is_dirty()) frm._type.go_to_tree();
            else {
                frm._type.tree.pending = 1;
                frappe.exp().warn(__('The form contains some unsaved changes. Click "Save" in order to proceed.'));
            }
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
    setup_child_table: function(frm, del) {
        let grid = frm.get_field('expense_accounts').grid,
        label = __('Import Companies Accounts');
        if (del && grid.custom_buttons[label]) {
            frm._type.table.ready = 0;
            grid.custom_buttons[label].remove();
            delete grid.custom_buttons[label];
        }
        if (del) return;
        frm._type.table.ready = 1;
        grid.add_custom_button(
            label, frappe.exp().$fn(function(e) {
                var $btn = $(e.target);
                $btn.attr('disabled', true);
                this.disable_table(frm, 'expense_accounts')
                .request('get_companies_accounts', null, function(ret) {
                    if (!this.$isArrVal(ret)) {
                        $btn.attr('disabled', false);
                        this.enable_table(frm, 'expense_accounts');
                        frappe.show_alert({
                            indicator: 'blue',
                            message: __('There are no companies to import.'),
                        });
                        return;
                    }
                    let x = 0;
                    for (let i = 0, l = ret.length, v, c, r; i < l; i++) {
                        v = ret[i];
                        c = cstr(v.company);
                        if (frm._type.table.data.has(c, 1)) continue;
                        x++;
                        r = frm.add_child('expense_accounts', {company: c, account: cstr(v.account)});
                        frm._type.table.data.add(cstr(r.name), cstr(r.company), cstr(r.account));
                    }
                    $btn.attr('disabled', false);
                    this.enable_table(frm, 'expense_accounts');
                    frappe.show_alert({
                        indicator: x ? 'green' : 'blue',
                        message: x ? __('The expense accounts table has been updated successfully.')
                            : __('The expense accounts table already has all the companies.'),
                    }); 
                },
                function(e) {
                    $btn.attr('disabled', false);
                    this.enable_table(frm, 'expense_accounts');
                    frappe.show_alert({indicator: 'red', message: e.message});
                }
            );
        }))
        .removeClass('btn-default')
        .addClass('btn-secondary');
    },
    toggle_disabled_desc: function(frm) {
        let val = cint(frm.doc.is_group);
        if (!!frm.is_new()) frm._type.is_group = val;
        if (val === frm._type.is_group) return;
        frm.events.add_toolbar_buttons(frm, 1);
        frm._type.is_group = val;
        frappe.exp().set_field_desc(frm, 'disabled', !frm._type.is_group ? null
            : __('Disabling an expense type group will result in disabling all its child types and their linked expense items')
        );
        frm.events.add_toolbar_buttons(frm);
    },
    add_toolbar_buttons: function(frm, del) {
        let btn = frm._type.toolbar.list[frm._type.is_group ? 0 : 1][0];
        if (del && frm.custom_buttons[btn]) {
            frm.custom_buttons[btn].remove();
            delete frm.custom_buttons[btn];
        }
        if (del) return;
        frm.add_custom_button(btn, function() {
            if (!frm.is_dirty()) frm.events.toolbar_action_handler(frm);
            else {
                frm._type.toolbar.pending = 1;
                frappe.exp().error(__('The form contains some unsaved changes. Click "Save" in order to proceed.'));
            }
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
    toolbar_action_handler: function(frm) {
        frm._type.toolbar.pending = 0;
        if (!frm._type.is_group || cstr(frm.doc.parent_type).length)
            frm.events.toolbar_action_request(frm);
        else
            frm.events.toolbar_action_prompt(frm);
    },
    toolbar_action_request: function(frm, val) {
        frappe.exp().request(
            frm._type.toolbar.list[frm._type.is_group ? 0 : 1][1],
            {
                name: cstr(frm.docname),
                parent_type: frappe.exp().$isStrVal(val) ? val : null
            },
            function(ret) {
                if (!ret) this.error(frm._type.toolbar.list[frm._type.is_group ? 0 : 1][2]);
                else if (ret.error) this.error(ret.error);
                else frm.reload_doc();
            }
        );
    },
    toolbar_action_prompt: function(frm) {
        frappe.prompt(
            [{
                fieldname: 'parent_type',
                fieldtype: 'Link',
                label: __('Parent Type'),
                options: 'Expense Type',
                reqd: 1,
                bold: 1,
                get_query: function() {
                    return {
                        query: frappe.exp().get_method('search_types'),
                        filters: {is_not: cstr(frm.docname)},
                    };
                },
            }],
            function(ret) { ret && frm.events.toolbar_action_request(frm, cstr(ret.parent_type)); },
            __('Select A Parent Type'),
            __('Convert')
        );
    }
});


frappe.ui.form.on('Expense Type Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        frm._type.table.data.del(cstr(cdn));
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        name = cstr(cdn),
        company = cstr(row.company),
        account = cstr(row.account);
        if (!company.length) {
            frm._type.table.data.del(name);
            if (account.length) frappe.model.set_value(cdt, cdn, 'account', '');
        } else if (
            !frm._type.table.data.has(name)
            && frm._type.table.data.has(company, 1)
        ) {
            let vals = {company: ''}
            if (account.length) vals.account = '';
            frappe.model.set_value(cdt, cdn, vals);
            frappe.exp().invalid_field(frm, 'expense_accounts', cdn, 'company',
                __('Company has already been selected.'))
        } else {
            frm._type.table.data.add(name, company, null);
            frappe.exp().valid_field(frm, 'expense_accounts', cdn, 'company');
        }
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        account = cstr(row.account);
        if (account.length)
            frm._type.table.data.add(cstr(cdn), cstr(row.company), account);
    },
});