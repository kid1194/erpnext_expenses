/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Type', {
    onload: function(frm) {
        frappe.exp()
            .on('ready change', function() { this.setup_form(frm); })
            .on('on_alert', function(d, t) {
                frm._type.errs.includes(t) && (d.title = __(frm.doctype));
            });
        frm._type = {
            errs: ['fatal', 'error'],
            ignore: 0,
            from_tree: 0,
            inits: {},
            group: null,
            disabled_desc: __('Disabling an expense type group will result in disabling all its descendants.'),
            table: frappe.exp().table(2),
            toolbar: [
                {
                    key: 'conv_to_group',
                    label: __('Convert To Group'),
                    method: 'convert_item_to_group',
                    error: __('Unable to convert expense type item to a group.')
                },
                {
                    key: 'conv_to_item',
                    label: __('Convert To Item'),
                    method: 'convert_group_to_item',
                    error: __('Unable to convert expense type group to an item.')
                },
            ],
        };
        frm.set_query('parent_type', function(doc) {
            let qry = {query: frappe.exp().get_method('search_types')};
            if (!frm.is_new()) qry.filters = {is_not: cstr(frm.docname)};
            return qry;
        });
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let qry = {filters: {is_group: 0}};
            if (frm._type.table.length)
                qry.filters.name = ['not in', frm._type.table.col(1)];
            return qry;
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            let qry = {filters: {
                is_group: 0, root_type: 'Expense',
                company: cstr(locals[cdt][cdn].company),
            }};
            if (frm._type.table.length) {
                let names = frappe.exp().$filter(frm._type.table.col(2), frappe.exp().$isStrVal);
                if (names.length) qry.filters.name = ['not in', names];
            }
            return qry;
        });
        if (!frm.is_new()) {
            let tkey = 'expense_accounts';
            if (frappe.exp().$isArrVal(frm.doc[tkey]))
                for (let i = 0, l = frm.doc[tkey].length, v; i < l; i++) {
                    v = frm.doc[tkey][i];
                    frm._type.table.add(cstr(v.name), cstr(v.company), cstr(v.account));
                }
        } else if (frappe.has_route_options()) {
            frm._type.from_tree = cint(frappe.route_options.from_tree) == 1;
            delete frappe.route_options.from_tree;
        }
    },
    refresh: function(frm) {
        if (frm.is_new()) {
            !frm._type.inits.import && frm.events.toggle_import_button(frm);
        } else {
            !frm._type.inits.desc && frm.events.toggle_disabled_desc(frm);
            frm._type.inits.import && frm.events.toggle_import_button(frm, 1);
        }
    },
    is_group: function(frm) {
        let val = cint(frm.doc.is_group) > 0 ? 0 : 1;
        frm.set_df_property('parent_type', {reqd: val, bold: val});
        frm._type.inits.desc && frm.events.toggle_disabled_desc(frm);
    },
    validate: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.name)) {
            frappe.exp().fatal(__('A valid name is required.'));
            return false;
        }
        if (!cint(frm.doc.is_group) && !frappe.exp().$isStrVal(frm.doc.parent_type)) {
            frappe.exp().fatal(__('A valid parent expense type is required.'));
            return false;
        }
        if (frappe.exp().$isArrVal(frm.doc.expense_accounts))
            return frm.events.validate_expense_accounts(frm);
    },
    after_save: function(frm) {
        if (frm._type.from_tree) {
            frm._type.from_tree = 0;
            frappe.exp().success_(
                '<a href="#" class="alert-link" data-action="back">'
                + __('Go Back To Tree View.')
                + '</a>',
                {back: function(e) {
                    e && e.preventDefault && e.preventDefault();
                    frappe.set_route('Tree', frm.doctype);
                }}
            );
        }
    },
    toggle_disabled_desc: function(frm, del) {
        if (del) {
            frm._type.inits.desc && frm.events.toggle_switch_button(frm, 1);
            delete frm._type.inits.desc;
            return;
        }
        let init = !frm._type.inits.desc,
        val = cint(frm.doc.is_group);
        if (init) frm._type.inits.desc = 1;
        else if (frm._type.group === val) return;
        !init && frm.events.toggle_switch_button(frm, 1);
        frm._type.group = val;
        (!init || val) && frappe.exp().field_desc(
            frm, 'disabled', val ? frm._type.disabled_desc : null
        );
        frm.events.toggle_switch_button(frm);
    },
    toggle_switch_button: function(frm, del) {
        let idx = frm._type.group,
        bar = frm._type.toolbar[idx];
        if (frm.custom_buttons[bar.label]) {
            if (!del) return;
            frm.custom_buttons[bar.label].remove();
            delete frm.custom_buttons[bar.label];
            delete frm._type.inits.switch;
        }
        if (del || frm._type.inits.switch === idx) return;
        frm._type.inits.switch = idx;
        frm.add_custom_button(bar.label, function() {
            let action = !frm._type.group || frappe.exp().$isStrVal(frm.doc.parent_type)
                ? 'switch_action_request' : 'prompt_switch_parent';
            if (!frm.is_dirty()) frm.events[action](frm);
            else frappe.confirm(
                __('Unsaved changes will be lost. Do you wish to continue?'),
                frappe.exp().$afn(function(e) { frm.events[e](frm); }, [action])
            );
        });
        frm.change_custom_button_type(bar.label, null, 'info');
    },
    toggle_import_button: function(frm, del) {
        if (frm._type.inits.import && !del) return;
        let grid = frappe.exp().get_grid(frm, 'expense_accounts');
        if (!grid) return;
        let label = __('Import Companies Accounts');
        if (grid.custom_buttons[label]) {
            if (!del) return;
            grid.custom_buttons[label].remove();
            delete grid.custom_buttons[label];
            delete frm._type.inits.import;
        }
        if (del || frm._type.inits.import) return;
        frm._type.inits.import = 1;
        grid.add_custom_button(label, function(e) {
            frm.events.import_companies_accounts(frm, $(e.target));
        });
    },
    import_companies_accounts: function(frm, $btn) {
        $btn.attr('disabled', true);
        frappe.exp().request('get_companies_accounts', null, function(ret) {
            if (!this.$isArrVal(ret)) {
                $btn.attr('disabled', false);
                return this.info_(__('No companies accounts to import.'));
            }
            let tkey = 'expense_accounts',
            field = frm.get_field(tkey),
            map = {},
            x = 0;
            if (this.$isArrVal(frm.doc[tkey]))
                for (let i = 0, l = frm.doc[tkey].length, v; i < l; i++) {
                    v = frm.doc[tkey][i];
                    map[cstr(v.company)] = v;
                }
            for (let i = 0, l = ret.length, v, r; i < l; i++) {
                v = ret[i];
                if (!this.$isStrVal(v.company) || !this.$isStrVal(v.account)) continue;
                r = map[v.company] || frm.add_child('expense_accounts', v);
                if (!map[v.company]) x++;
                else if (cstr(r.account) !== v.account) {
                    r.account = v.account;
                    x++;
                }
                frm._type.table.add(cstr(r.name), v.company, v.account);
            }
            x && frm.refresh_field('expense_accounts');
            this.success_(__('Companies accounts imported successfully.'));
            $btn.attr('disabled', false);
        },
        function(e) {
            $btn.attr('disabled', false);
            this._error('Import companies accounts', e.message);
            this.error_(__('Failed to import companies accounts.'));
        });
    },
    switch_action_request: function(frm, val) {
        let data = {name: cstr(frm.docname)};
        if (val) data.parent_type = val;
        var bar = frm._type.toolbar[frm._type.group];
        frappe.exp().request(
            bar.method, data,
            function(ret) {
                if (!ret) this.error_(bar.error);
                else if (ret.error) this.error_(ret.error);
                else {
                    this.success_(__('Expense type converted successfully.'));
                    frm.events.toggle_disabled_desc(frm, 1);
                    frm.reload_doc();
                }
            },
            function(e) {
                this.error_(e.self ? e.message : bar.error);
            }
        );
    },
    prompt_switch_parent: function(frm) {
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
            function(ret) {
                if (ret && frappe.exp().$isStrVal(ret.parent_type))
                    frm.events.switch_action_request(frm, ret.parent_type);
            },
            __('Select Parent'),
            __('Convert')
        );
    },
    validate_expense_accounts: function(frm) {
        let tkey = 'expense_accounts',
        table = __('Expense Accounts'),
        err = [];
        for (let i = 0, x = 0, l = frm.doc[tkey].length, v, n, k, r; i < l; i++) {
            v = frm.doc[tkey][i];
            n = cstr(v.name);
            k = 'company';
            if (!frm._type.table.has(n)) frm._type.table.add(n, v[k], cstr(v.account));
            if (!frappe.exp().$isStrVal(v[k])) {
                err[x++] = __('{0} - #{1}: A valid company is required.', [table, i]);
                continue;
            }
            if (frm._type.table.val(v[k], 1) !== n) {
                err[x++] = __('{0} - #{1}: Company "{2}" already exist.', [table, i, v[k]]);
                continue;
            }
            k = 'account';
            if (!frappe.exp().$isStrVal(v[k])) {
                err[x++] = __('{0} - #{1}: A valid expense account is required.', [table, i]);
                continue;
            }
            if (frm._type.table.val(v[k], 2) !== n) {
                err[x++] = __('{0} - #{1}: Expense account "{2}" already exist.', [table, i, v[k]]);
                continue;
            }
        }
        if (!err.length) return;
        frappe.exp().fatal(err);
        return false;
    }
});


frappe.ui.form.on('Expense Type Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        frm._type.table.del(cdn);
    },
    company: function(frm, cdt, cdn) {
        if (frm._type.ignore) return;
        let row = locals[cdt][cdn],
        key = 'company',
        val = cstr(row[key]),
        acc = cstr(row.account),
        err;
        if (!val.length) {
            frm._type.table.del(cdn);
            if (acc.length) {
                frm._type.ignore++;
                frappe.model.set_value(cdt, cdn, 'account', '');
                frm._type.ignore--;
            }
        } else if (
            frm._type.table.has(val, 1)
            && frm._type.table.val(val, 1) !== cdn
        ) {
            frm._type.table.del(cdn);
            frm._type.ignore++;
            frappe.model.set_value(cdt, cdn, key, '');
            acc.length && frappe.model.set_value(cdt, cdn, 'account', '');
            frm._type.ignore--;
            err = __('Company has already been selected.');
        } else {
            frm._type.table.add(cdn, val, acc.length ? acc : null);
        }
        frappe.exp().rfield_status(frm, 'expense_accounts', cdn, key, err);
    },
    account: function(frm, cdt, cdn) {
        if (frm._type.ignore) return;
        let row = locals[cdt][cdn],
        key = 'account',
        val = cstr(row[key]),
        err;
        if (!frappe.exp().$isStrVal(row.company)) return;
        if (!val.length) {
            err = __('A valid expense account is required.');
        } else if (
            frm._type.table.has(val, 2)
            && frm._type.table.val(val, 2) !== cdn
        ) {
            val = '';
            frm._type.ignore++;
            frappe.model.set_value(cdt, cdn, key, val);
            frm._type.ignore--;
            err = __('Expense account has already been selected.');
        }
        frm._type.table.add(cdn, null, val);
        frappe.exp().rfield_status(frm, 'expense_accounts', cdn, key, err);
    },
});