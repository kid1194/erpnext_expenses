/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Entry', {
    setup: function(frm) {
        E.frm(frm);
        frm.E = {
            company_currency: frappe.boot.sysdefaults.currency,
            mops: {},
        };
        
        E.call('has_hrm', function(ret) {
            if (!!ret) {
                E.dfs_property(
                    ['is_paid', 'paid_by', 'type_column'], 'hidden', 1, 'expenses'
                );
                E.df_property('type_adv_column', 'hidden', 0, 'expenses');
            }
        });
        
        if (frm.doc.docstatus > 0) return;
        
        frm.E.update_exchange_rate = function(cdt, cdn) {
            let c = cdt && cdn ? locals[cdt][cdn].account_currency
                : frm.doc.payment_currency;
            if (!frm.E.company_currency || !c) return;
            E.get_exchange_rate(c, frm.E.company_currency, function(v) {
                if (cdt && cdn) {
                    if (v <= flt(locals[cdt][cdn].exchange_rate)) return;
                    locals[cdt][cdn].exchange_rate = v;
                    E.refresh_row_df('expenses', cdn, 'exchange_rate');
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
                        E.refresh_row_df('expenses', r.name, 'exchange_rate');
                    }
                }));
            });
            tasks.push(frm.E.update_totals);
            Promise.all(tasks).finally(function() { tasks = null; });
        };
        frm.E.update_totals = function() {
            var cc = frm.E.company_currency;
            var total = 0;
            E.each(frm.doc.expenses, function(r) {
                r.cost = flt(flt(r.cost_in_account_currency) * flt(r.exchange_rate));
                total += flt(r.cost);
                E.refresh_row_df('expenses', r.name, 'cost');
            });
            frm.set_value('total_in_payment_currency',
                flt(total / flt(frm.doc.exchange_rate)));
            frm.set_value('total', total);
        };
    },
    onload: function(frm) {
        frm.add_fetch('mode_of_payment', 'type', 'payment_target', frm.doctype);
        if (cint(frm.doc.docstatus) > 0) {
            frm.read_only();
            return;
        }
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
            if (request && E.is_str(request)) {
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
                        E.dfs_property(
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
                        E.refresh_df('company', 'remarks', 'expenses', 'attachments');
                        frm.E.update_exchange_rates();
                    }
                );
            }
            request = null;
        }
        frm.get_field('expenses').grid.add_custom_button(
            __('Set Exchange Rates'),
            function() {
                let fields = [],
                exist = [];
                E.each(frm.doc.expenses, function(v) {
                    if (exist.indexOf(v.account_currency) >= 0) return;
                    fields.push({
                        fieldname: v.account_currency + '_ex',
                        fieldtype: 'Float',
                        label: frappe.scrub(v.account_currency).toLowerCase(),
                        precision: '9',
                        reqd: 1,
                        bold: 1,
                        value: v.exchange_rate,
                    });
                });
                frappe.prompt(
                    fields,
                    function(ret) {
                        E.each(frm.doc.expenses, function(v) {
                            let k = frappe.scrub(v.account_currency).toLowerCase();
                            if (!ret[k]) return;
                            v.exchange_rate = flt(ret[k]);
                            E.refresh_row_df('expenses', v.name, 'exchange_rate');
                        });
                    },
                    __('Set Exchange Rates'),
                    __('Save')
                );
            },
            'bottom'
        );
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
            return;
        }
        function resolve(ret) {
            frm.E.company_currency = ret.company_currency;
            frm.set_value('payment_account', ret.account);
            frm.set_value('payment_target', ret.type);
            frm.set_value('payment_currency', ret.currency);
            frm.E.update_exchange_rate();
        }
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
                if (!ret || !E.is_obj(ret)) {
                    E.error(
                        'Unable to get the mode of payment data of {0} for {1}',
                        [mop, frm.doc.company]
                    );
                    return;
                }
                frm.E.mops[mop] = ret;
                resolve(ret);
            }
        );
    },
    exchange_rate: function(frm) {
        if (flt(frm.doc.exchange_rate) <= 0) frm.E.update_exchange_rate();
        else frm.E.update_totals();
    },
});

frappe.ui.form.on('Expenses Entry Account', {
    account: function(frm, cdt, cdn) {
        if (locals[cdt][cdn].account)
            frm.E.update_exchange_rate(cdt, cdn);
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
        if (row.expenses_entry_row_ref)
            E.error('Removing attachments is not allowed', true);
    },
});