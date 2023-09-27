/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Entry', {
    setup: function(frm) {
        frappe.Expenses();
        frappe.E.form(frm);
        frm.X = {
            form_disabled: 0,
            expenses_grid_btn: 0,
            base_currency: frappe.boot.sysdefaults.currency,
            del_files: frappe.E.tableArray(),
        };
        
        frm.X.get_exchange_rate = function(from, to, fn) {
            frappe.E.call(
                'get_current_exchange_rate',
                {
                    from_currency: from,
                    to_currency: to,
                },
                function(v) {
                    v = flt(v);
                    if (v < 1) v = 1;
                    frappe.E.fnCall(fn, v);
                }
            );
        };
        frm.X.update_exchange_rate = function(cdt, cdn) {
            let c = cdt && cdn
                ? locals[cdt][cdn].account_currency
                : frm.doc.payment_currency;
            if (!c || !frm.X.base_currency) return;
            frm.X.get_exchange_rate(c, frm.X.base_currency, function(v) {
                if (cdt && cdn) {
                    if (v <= flt(locals[cdt][cdn].exchange_rate)) return;
                    frappe.E.setDocValue(locals[cdt][cdn], 'exchange_rate', v);
                } else {
                    if (v > flt(frm.doc.exchange_rate))
                        frm.set_value('exchange_rate', v);
                }
            });
        };
        frm.X.update_exchange_rates = function() {
            if (!frm.X.base_currency || !frm.doc.payment_currency) return;
            var cc = frm.X.base_currency;
            frappe.E.runTasks(
                frappe.E.map(frm.doc.expenses, function(r) {
                    return frm.X.get_exchange_rate(r.account_currency, cc, function(v) {
                        if (v > flt(r.exchange_rate)) r.exchange_rate = v;
                    });
                })
            ).finally(function() {
                frm.X.get_exchange_rate(frm.doc.payment_currency, cc, function(v) {
                    if (v > flt(frm.doc.exchange_rate))
                        frm.set_value('exchange_rate', v);
                    else frappe.E.refreshField('expenses');
                });
            });
        };
        frm.X.update_totals = function() {
            var total = 0;
            frappe.E.each(frm.doc.expenses, function(r) {
                r.cost = flt(flt(r.cost_in_account_currency) * flt(r.exchange_rate));
                total += flt(r.cost);
            });
            frm.set_value('total_in_payment_currency',
                flt(total / flt(frm.doc.exchange_rate)));
            frm.set_value('total', total);
            frappe.E.refreshField('expenses');
        };
    },
    onload: function(frm) {
        frm.add_fetch('mode_of_payment', 'type', 'payment_target', frm.doctype);
        
        if (cint(frm.doc.docstatus) > 0) {
            frm.X.form_disabled = 1;
            frm.disable_form();
            frm.set_intro(__('{0} has been submitted', [frm.doctype]), 'green');
            return;
        }
        
        if (frm.is_new()) {
            var request = frappe.E.popCache('make-expenses-entry');
            if (request && frappe.E.isString(request)) {
                frm.set_value('expenses_request_ref', request);
                frappe.E.call(
                    'get_request_data',
                    {name: request},
                    function(ret) {
                        if (!frappe.E.isPlainObject(ret)) {
                            frappe.E.error('Unable to get the expenses request data of {0}', [request]);
                            return;
                        }
                        frm.set_value('company', ret.company);
                        frm.set_value('remarks', ret.remarks);
                        var keys = 'description paid_by expense_claim party_type party project'.split(' ');
                        frappe.E.each(ret.expenses, function(v) {
                            let row = frm.add_child('expenses');
                            frappe.E.each(keys, function(k) { row[k] = v[k]; });
                            row.expense_ref = v.name;
                            row.account = v.expense_account;
                            row.account_currency = v.currency;
                            row.cost_in_account_currency = flt(v.total);
                            row.is_paid = cint(v.is_paid);
                            row.is_advance = cint(v.is_advance);
                            if (frappe.E.isArray(v.attachments) && v.attachments.length) {
                                frappe.E.each(v.attachments, function(a) {
                                    a.expenses_entry_row_ref = row.name;
                                    frm.add_child('attachments', a);
                                });
                            }
                        });
                        frappe.E.setFieldsProperty(
                            ['company', 'remarks', 'expenses', 'attachments'],
                            'read_only', 1
                        );
                        frappe.E.setFieldsProperties(['expenses', 'attachments'], {
                            cannot_delete_rows: 1,
                            allow_bulk_edit: 0,
                        });
                        frm.get_field('expenses').grid.df.cannot_delete_rows = 1;
                        frm.get_field('attachments').grid.df.cannot_delete_rows = 1;
                        frappe.E.refreshField('company', 'remarks', 'expenses', 'attachments');
                        frm.X.update_exchange_rates();
                    }
                );
            }
            request = null;
        }
        
        frm.set_query('company', {filters: {is_group: 0}});
        frm.set_query('mode_of_payment', {filters: {type: ['in', ['Cash', 'Bank']]}});
        frappe.E.each(['default_project', 'project'], function(k, i) {
            let fn = function() { return {company: frm.doc.company}; };
            frm.set_query(k, i > 0 ? 'expenses' : fn, i > 0 ? fn : null);
        });
        frappe.E.each(['default_cost_center', 'cost_center'], function(k, i) {
            let fn = function() { return {company: frm.doc.company}; };
            frm.set_query(k, i > 0 ? 'expenses' : fn, i > 0 ? fn : null);
        });
        
        frappe.E.call('with_expense_claim', function(ret) {
            if (!!ret) {
                frm.X.with_expense_claim = true;
                frappe.E.setFieldProperties('expense_claim', {options: 'Expense Claim', hidden: 0,}, 'expenses');
                frm.set_query('expense_claim', 'expenses', function(frm, cdt, cdn) {
                    let row = locals[cdt][cdn];
                    return {
                        filters: {
                            employee: row.paid_by,
                            company: frm.doc.company,
                            is_paid: 1,
                            status: 'Paid',
                            docstatus: 1,
                        }
                    };
                });
            }
        });
    },
    refresh: function(frm) {
        if (!frm.X.form_disabled && !frm.X.expenses_grid_btn) {
            frm.X.expenses_grid_btn = 1;
            frm.get_field('expenses').grid.add_custom_button(
                __('Update Exchange Rates'),
                function() {
                    let fields = [],
                    exist = [];
                    frappe.E.each(frm.doc.expenses, function(v) {
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
                            if (!ret || !frappe.E.isObject(ret)) return;
                            frappe.E.each(frm.doc.expenses, function(v) {
                                let k = frappe.scrub(v.account_currency).toLowerCase();
                                if (!ret[k]) return;
                                v.exchange_rate = flt(ret[k]);
                                frappe.E.refreshRowField('expenses', v.name, 'exchange_rate');
                            });
                        },
                        __('Update Exchange Rates'),
                        __('Save')
                    );
                },
                'bottom'
            );
        }
        frm.X.update_totals();
    },
    company: function(frm) {
        if (!frm.doc.company) frm.set_value('mode_of_payment', '');
    },
    mode_of_payment: function(frm) {
        var mop = frm.doc.mode_of_payment;
        if (!mop) {
            frm.set_value('payment_account', '');
            frm.set_value('payment_target', '');
            frm.set_value('payment_currency', frm.X.base_currency);
            return;
        }
        frappe.E.call(
            'get_mode_of_payment_data',
            {
                mode_of_payment: mop,
                company: frm.doc.company,
            },
            function(ret) {
                if (!ret || !frappe.E.isPlainObject(ret)) {
                    frappe.E.error(
                        'Unable to get the mode of payment data of {0} for {1}',
                        [mop, frm.doc.company]
                    );
                    return;
                }
                frm.X.base_currency = ret.company_currency;
                frm.set_value('payment_account', ret.account);
                frm.set_value('payment_target', ret.type);
                frm.set_value('payment_currency', ret.currency);
                frm.X.update_exchange_rate();
            }
        );
    },
    exchange_rate: function(frm) {
        if (flt(frm.doc.exchange_rate) <= 0) frm.X.update_exchange_rate();
        else frm.X.update_totals();
    },
    after_save: function(frm) {
        if (!cint(frm.doc.docstatus) && frm.X.del_files.length) {
            frappe.E.call(
                'delete_attach_files',
                {
                    doctype: frm.doctype,
                    name: frm.doc.name || frm.docname,
                    files: frm.X.del_files.col(0),
                },
                function() { frm.X.del_files.clear(); }
            );
        }
    },
});

frappe.ui.form.on('Expenses Entry Details', {
    account: function(frm, cdt, cdn) {
        if (locals[cdt][cdn].account) frm.X.update_exchange_rate(cdt, cdn);
    },
    exchange_rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (flt(row.exchange_rate) <= 0) frm.X.update_exchange_rate(cdt, cdn);
        else frm.X.update_totals();
    },
    is_paid: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!cint(row.is_paid))
            frappe.E.setDocValue(row, {paid_by: '', expense_claim: ''});
    },
    paid_by: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.paid_by) frappe.E.setDocValue(row, 'expense_claim', '');
    },
    party_type: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.party_type) frappe.E.setDocValue(row, 'party', '');
    },
});

frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.expenses_entry_row_ref) {
            frappe.E.error('Removing attachments is not allowed', true);
        }
        if (cstr(row.file).length)
            frm.X.del_files.add(row.name || cdn, row.file, 0);
    },
    file: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (cstr(row.file).length)
            frm.X.del_files.del(row.name || cdn);
    },
});