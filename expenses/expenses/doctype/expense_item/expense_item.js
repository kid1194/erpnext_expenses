/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Item', {
    onload: function(frm) {
        frappe.exp()
            .on('ready change', function() { this.setup_form(frm); })
            .on('on_alert', function(d, t) {
                frm._item.errs.includes(t) && (d.title = __(frm.doctype));
            });
        frm._item = {
            errs: ['fatal', 'error'],
            ignore: 0,
            table: frappe.exp().table(2),
            type: null,
        };
        frm.set_query('expense_type', function(doc) {
            return {query: frappe.exp().get_method('search_item_types')};
        });
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let qry = {filters: {is_group: 0}};
            if (frm._item.table.length)
                qry.filters.name = ['not in', frm._item.table.col(1)];
            return qry;
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            let qry = {filters: {
                is_group: 0, root_type: 'Expense',
                company: cstr(locals[cdt][cdn].company),
            }};
            if (frm._item.table.length) {
                let names = frappe.exp().$filter(frm._item.table.col(2), frappe.exp().$isStrVal);
                if (names.length) qry.filters.name = ['not in', names];
            }
            return qry;
        });
        frm.add_fetch('account', 'account_currency', 'currency', 'Expense Item Account');
        if (frm.is_new()) return;
        frm._item.type = cstr(frm.doc.expense_type);
        frm.events.clean_expense_accounts(frm, 1);
        frm.events.sync_expense_accounts(frm, 1);
    },
    expense_type: function(frm) {
        let val = cstr(frm.doc.expense_type);
        if (!val.length) {
            frm._item.type = null;
            frm.events.enqueue_sync_expense_accounts(frm, 1);
            return frm.events.clean_expense_accounts(frm);
        }
        if (frm._item.type === val) return;
        frm._item.type = val;
        frm.events.clean_expense_accounts(frm);
        frm.events.enqueue_sync_expense_accounts(frm);
    },
    validate: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.name)) {
            frappe.exp().fatal(__('A valid name is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.expense_type)) {
            frappe.exp().fatal(__('A valid expense type is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.uom)) {
            frappe.exp().fatal(__('A valid unit of measure (UOM) is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expense_accounts)) {
            frappe.exp().fatal(__('At least one company expense account is required.'));
            return false;
        }
        return frm.events.validate_expense_accounts(frm);
    },
    toggle_accounts: function(frm) {
    },
    enqueue_sync_expense_accounts: function(frm, clear) {
        frm._item.timeout && frappe.exp().$timeout(frm._item.timeout);
        if (clear) delete frm._item.timeout;
        else frm._item.tm = frappe.exp().$timeout(function() {
            delete frm._item.timeout;
            frm.events.sync_expense_accounts(frm);
        }, 1000);
    },
    sync_expense_accounts: function(frm, save) {
        if (!frappe.exp().$isStrVal(frm.doc.expense_type)) return;
        var type = cstr(frm.doc.expense_type),
        tkey = 'expense_accounts',
        map = {};
        if (frappe.exp().$isArrVal(frm.doc[tkey]))
            frappe.exp().$reduce(frm.doc[tkey], function(v, i, r) {
                r[cstr(v.company)] = v;
            }, map);
        
        frappe.exp().request(
            'get_type_accounts_list',
            {type_name: type},
            function(ret) {
                if (!this.$isArr(ret)) {
                    this.error_(__('Unable to import expense accounts from expense type "{0}".', [type]));
                    return frm.events.clean_expense_accounts(frm);
                }
                if (!ret.length) return frm.events.clean_expense_accounts(frm);
                let ks = ['account', 'currency', 'inherited'], ch = 0;
                for (let i = 0, l = ret.length, v, c, r, t; i < l; i++) {
                    v = ret[i];
                    c = cstr(v.company);
                    r = map[c] || frm.add_child(tkey, v);
                    if (!map[c]) ch++;
                    else {
                        delete map[c];
                        for (let x = 0; x < 3; x++) {
                            if (x < 2 && cstr(r[ks[x]]) !== cstr(v[ks[x]]) && ++ch)
                                r[ks[x]] = cstr(v[ks[x]]);
                            else if (x > 1 && !cint(r[ks[x]]) && ++ch) r[ks[x]] = 1;
                        }
                    }
                    frm._item.table.add(cstr(r.name), c, cstr(r.account));
                }
                for (let c in map) {
                    if (cint(map[c].inherited) && ++ch) map[c].inherited = 0;
                }
                save && ch ? frm.save_or_update() : frm.refresh_field(tkey);
            },
            function(e) {
                this._error('Failed to import expense accounts', type, e.message);
                this.error_(__('Failed to import expense accounts from expense type "{0}".', [type]));
            }
        );
    },
    clean_expense_accounts: function(frm, load) {
        load && frm._item.table.length && frm._item.table.clear();
        let tkey = 'expense_accounts';
        if (!frappe.exp().$isArrVal(frm.doc[tkey])) return;
        for (let i = 0, x = 0, v; i < frm.doc[tkey].length; i++) {
            v = frm.doc[tkey][i];
            if (load) frm._item.table.add(cstr(v.name), cstr(v.company), cstr(v.account));
            else if (cint(v.inherited)) v.inherited = 0;
        }
        if (!load) frm.refresh_field(tkey);
    },
    validate_expense_accounts: function(frm) {
        let tkey = 'expense_accounts',
        table = __('Expense Accounts'),
        err = [];
        for (let i = 0, x = 0, l = frm.doc[tkey].length, v, n, k; i < l; i++) {
            v = frm.doc[tkey][i];
            n = cstr(v.name);
            k = 'company';
            if (!frm._type.table.has(n)) frm._type.table.add(n, v[k], cstr(v.account));
            if (cint(v.inherited)) continue;
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


frappe.ui.form.on('Expense Item Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        frm._item.table.del(cdn);
    },
    company: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'company',
        val = cstr(row[key]),
        acc = cstr(row.account),
        cur = cstr(row.currency),
        err;
        if (!val.length) {
            frm._item.table.del(cdn);
        } else if (frm._item.table.has(val, 1)) {
            val = '';
            frm._item.table.del(cdn);
            err = __('Company has already been selected.');
        } else {
            frm._item.table.add(cdn, val, acc.length ? acc : null);
        }
        if (!val.length) {
            frm._item.ignore++;
            err && frappe.model.set_value(cdt, cdn, key, val);
            acc.length && frappe.model.set_value(cdt, cdn, 'account', '');
            cur.length && frappe.model.set_value(cdt, cdn, 'currency', '');
            frm._item.ignore--;
        }
        frappe.exp().rfield_status(frm, 'expense_accounts', cdn, key, err);
    },
    account: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'account',
        val = cstr(row[key]),
        cur = cstr(row.currency),
        err;
        if (!val.length && cur.length) frappe.model.set_value(cdt, cdn, 'currency', '');
        if (!frappe.exp().$isStrVal(row.company)) return;
        if (!val.length) {
            err = __('A valid expense account is required.');
        } else if (frm._item.table.has(val, 2)) {
            err = __('Expense account has already been selected.');
        }
        frm._item.table.add(cdn, null, val);
        if (err) {
            frm._item.ignore++;
            val.length && frappe.model.set_value(cdt, cdn, key, '');
            cur.length && frappe.model.set_value(cdt, cdn, 'currency', '');
            frm._item.ignore--;
        }
        frappe.exp().rfield_status(frm, 'expense_accounts', cdn, key, err);
    },
    cost: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'cost',
        val = flt(row[key]);
        if (val < 0) {
            frm._item.ignore++;
            frappe.model.set_value(cdt, cdn, key, 0);
            frm._item.ignore--;
        }
    },
    min_cost: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'cost',
        val = flt(row['min_' + key]);
        if (val < 0 || (flt(row[key]) > 0 && val > 0) || 0 < flt(row['max_' + key]) <= val) {
            frm._item.ignore++;
            frappe.model.set_value(cdt, cdn, 'min_' + key, 0);
            frm._item.ignore--;
        }
    },
    max_cost: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'cost',
        val = flt(row['max_' + key]);
        if (val < 0 || (flt(row[key]) > 0 && val > 0) || 0 < flt(row['min_' + key]) >= val) {
            frm._item.ignore++;
            frappe.model.set_value(cdt, cdn, 'max_' + key, 0);
            frm._item.ignore--;
        }
    },
    qty: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'qty',
        val = flt(row[key]);
        if (val < 0) {
            frm._item.ignore++;
            frappe.model.set_value(cdt, cdn, key, 0);
            frm._item.ignore--;
        }
    },
    min_qty: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'qty',
        val = flt(row['min_' + key]);
        if (val < 0 || (flt(row[key]) > 0 && val > 0) || 0 < flt(row['max_' + key]) <= val) {
            frm._item.ignore++;
            frappe.model.set_value(cdt, cdn, 'min_' + key, 0);
            frm._item.ignore--;
        }
    },
    max_qty: function(frm, cdt, cdn) {
        if (frm._item.ignore) return;
        let row = locals[cdt][cdn],
        key = 'qty',
        val = flt(row['max_' + key]);
        if (val < 0 || (flt(row[key]) > 0 && val > 0) || 0 < flt(row['min_' + key]) >= val) {
            frm._item.ignore++;
            frappe.model.set_value(cdt, cdn, 'max_' + key, 0);
            frm._item.ignore--;
        }
    }
});