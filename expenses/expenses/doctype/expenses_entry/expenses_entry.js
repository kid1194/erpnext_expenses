/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.ui.form.on('Expenses Entry', {
    setup: function(frm) {
        frappe.Expenses.init(frm);
        frm.E = {
            company_currency: frappe.boot.sysdefaults.currency,
            mops: {},
        };
        frm.E.update_exchange_description = function(cdt, cdn) {
            let c = cdt && cdn ? locals[cdt][cdn].account_currency
                : frm.doc.payment_currency,
            cc = frm.E.company_currency,
            show = c && cc,
            f = cdt && cdn ? E.get_row_field('expenses', cdn, 'exchange_rate')
                : frm.get_field('exchange_rate');
            frm.E.set_field_description(f, c, cc, show);
        };
        frm.E.update_exchange_descriptions = function() {
            frm.E.update_exchange_description();
            E.each(frm.doc.expenses, function(r) {
                frm.E.update_exchange_description('Expenses Entry Account', r.name);
            });
        };
        frm.E.set_field_description = function(f, p, t, s) {
            if (!f) return;
            if (!s) {
                f.set_description && f.set_description();
                return;
            }
            f.set_new_description && f.set_new_description(p + ' to ' + t);
            f.toggle_description && f.toggle_description(true);
        };
        frm.E.update_exchange_rate = function(cdt, cdn) {
            let c = cdt && cdn ? locals[cdt][cdn].account_currency
                : frm.doc.payment_currency;
            if (!frm.E.company_currency || !c) return;
            E.get_exchange_rate(c, frm.E.company_currency, function(v) {
                if (cdt && cdn) {
                    if (v <= flt(locals[cdt][cdn].exchange_rate)) return;
                    locals[cdt][cdn].exchange_rate = v;
                    E.refresh_row_field('expenses', cdn, 'exchange_rate');
                } else {
                    if (v > flt(frm.doc.exchange_rate))
                        frm.set_value('exchange_rate', v);
                }
                frm.E.update_totals();
            });
        };
        frm.E.update_exchange_rates = function() {
            if (!frm.E.company_currency || !frm.doc.payment_currency) return;
            var cc = frm.E.company_currency,
            tasks = [];
            tasks.push(E.get_exchange_rate(frm.doc.payment_currency, cc, function(v) {
                if (v > flt(frm.doc.exchange_rate))
                    frm.set_value('exchange_rate', v);
            }));
            E.each(frm.doc.expenses, function(r) {
                tasks.push(E.get_exchange_rate(r.account_currency, cc, function(v) {
                    if (v > flt(r.exchange_rate)) {
                        r.exchange_rate = v;
                        r.cost = flt(flt(r.cost_in_account_currency) * r.exchange_rate);
                        E.refresh_row_field('expenses', r.name, 'exchange_rate', 'cost');
                    }
                }));
            });
            tasks.push(frm.E.update_totals);
            Promise.all(tasks).then(function() { tasks = null; });
        };
        frm.E.update_totals = function() {
            var cc = frm.E.company_currency;
            var total = 0;
            E.each(frm.doc.expenses, function(r) {
                total += flt(r.cost);
            });
            frm.set_value('total_in_payment_currency',
                flt(total / flt(frm.doc.exchange_rate)));
            frm.set_value('total', total);
        };
        E.call('has_hrm', function(ret) {
            if (!!ret) {
                E.set_dfs_property(
                    ['is_paid', 'paid_by', 'type_column'], 'hidden', 1, 'expenses'
                );
                E.set_df_property('type_adv_column', 'hidden', 0, 'expenses');
            }
        });
    },
    onload: function(frm) {
        frm.add_fetch('mode_of_payment', 'type', 'payment_target', frm.doctype);
        if (cint(frm.doc.docstatus) > 0) return;
        frm.set_query('company', {filters: {is_group: 0}});
        frm.set_query('mode_of_payment', {filters: {type: ['in', ['Cash', 'Bank']]}});
        E.each(['default_project', 'project'], function(k, i) {
            let fn = function() { return {company: frm.doc.company}; };
            frm.set_query(k, i > 0 ? 'expenses' : fn, i > 0 ? fn : null);
        });
        E.each(['default_cost_center', 'cost_center'], function(k, i) {
            let fn = function() { return {company: frm.doc.company}; };
            frm.set_query(k, i > 0 ? 'expenses' : fn, i > 0 ? fn : null);
        });
        if (frm.is_new()) {
            var request = E.pop_cache('make-expenses-entry');
            if (request && typeof request === 'string') {
                frm.set_value('expenses_request_ref', request);
                E.call(
                    'get_request_data',
                    {name: request},
                    function(ret) {
                        if (!E.is_obj(ret)) {
                            E.error('Unable to get the expenses request data of {0}', [request]);
                            return;
                        }
                        frm.set_value('company', ret.company);
                        frm.set_value('remarks', ret.remarks);
                        E.set_dfs_property(
                            ['company', 'remarks', 'expenses', 'attachments'], 'read_only', 1);
                        var keys = 'description paid_by party_type party project'.split(' ');
                        E.each(ret.expenses, function(v) {
                            let row = frm.add_child('expenses');
                            E.each(keys, function(k) { row[k] = v[k]; });
                            row.expense_ref = v.name;
                            row.account = v.expense_account;
                            row.account_currency = v.currency;
                            row.cost_in_account_currency = flt(v.total);
                            row.is_paid = cint(v.is_paid);
                            row.is_advance = cint(v.is_advance);
                            if (E.is_arr(v.attachments) && v.attachments.length) {
                                E.each(v.attachments, function(a) {
                                    a.expenses_entry_row_ref = row.name;
                                    frm.add_child('attachments', a);
                                });
                            }
                        });
                        E.refresh_field('company', 'expenses', 'attachments');
                        frm.E.update_exchange_rates();
                    }
                );
            }
            request = null;
        }
    },
    company: function(frm) {
        if (!frm.doc.company) frm.set_value('mode_of_payment', '');
    },
    mode_of_payment: function(frm) {
        var mop = frm.doc.mode_of_payment;
        if (!mop) {
            frm.set_value('payment_account', '');
            frm.set_value('payment_target', '');
            frm.set_value('payment_currency', frm.E.company_currency);
            frm.E.update_exchange_description();
            return;
        }
        (new Promise(function(resolve, reject) {
            if (frm.E.mops[mop]) {
                resolve(frm.E.mops[mop]);
                return;
            }
            E.call(
                'get_mode_of_payment_data',
                {
                    mode_of_payment: mop,
                    company: frm.doc.company,
                },
                function(ret) {
                    if (!ret || !$.isPlainObject(ret)) {
                        reject();
                        return;
                    }
                    frm.E.mops[mop] = ret;
                    resolve(ret);
                }
            );
        })).then(function(ret) {
            frm.E.company_currency = ret.company_currency;
            frm.set_value('payment_account', ret.account);
            frm.set_value('payment_target', ret.type);
            frm.set_value('payment_currency', ret.currency);
            frm.E.update_exchange_description();
            frm.E.update_exchange_rate();
        });
    },
    exchange_rate: function(frm) {
        if (flt(frm.doc.exchange_rate) <= 0) frm.E.update_exchange_rate();
        else frm.E.update_totals();
    },
});

frappe.ui.form.on('Expenses Entry Account', {
    account: function(frm, cdt, cdn) {
        frm.E.update_exchange_description(cdt, cdn);
        if (locals[cdt][cdn].account) {
            frm.E.update_exchange_rate(cdt, cdn);
        }
        frm.E.update_exchange_description(cdt, cdn);
    },
    exchange_rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (flt(row.exchange_rate) <= 0) frm.E.update_exchange_rate(cdt, cdn);
        else frm.E.update_totals();
    },
});

frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.expenses_entry_row_ref) {
            E.error('Removing attachments is not allowed', true);
        }
    },
});