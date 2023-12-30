/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Entry', {
    setup: function(frm) {
        frappe.exp()
            .on('ready change', function() {
                this.setup_form(frm);
            })
            .on('exp_expenses_entry_changed', function(ret) {
                if (!ret) return;
                if (
                    cstr(ret.action) === 'change'
                    && cstr(ret.entry) === cstr(frm.doc.name)
                ) {
                    let message = __('The expenses entry data has changed. Reload to update the form.');
                    if (frm.is_dirty())
                        message = message + '<br/><strong class="text-danger">'
                            + __('Warning: All the unsaved changes will be discarded.')
                        + '</strong>';
                    
                    frappe.warn(
                        __('Expenses Entry Changed'),
                        message,
                        function() { frm.reload_doc(); },
                        __('Reload')
                    );
                } else if (
                    cstr(ret.action) === 'trash'
                    && cstr(ret.entry) === cstr(frm.doc.name)
                ) {
                    window.setTimeout(function() {
                        frappe.set_route('List', 'Expenses Entry');
                    }, 6000);
                    frappe.throw({
                        title: __('Expenses Entry Removed'),
                        message: __('The expenses entry has been removed. You will be redirected automatically back to the List View.'),
                    });
                }
            });
        frm._entry = {
            is_draft: false,
            is_disabled: false,
            is_moderator: false,
            is_expenses_ready: false,
            base_currency: cstr(frappe.boot.sysdefaults.currency),
            del_files: frappe.exp().table(1),
            get_exchange_rate: function(from, to, fn) {
                frappe.exp().request(
                    'get_current_exchange_rate',
                    {
                        from_currency: from,
                        to_currency: to,
                    },
                    function(v) {
                        if (!this.$isDataObj(v)) {
                            v = flt(v);
                            if (v < 1) v = 1;
                        }
                        fn.call(this, v);
                    }
                );
            },
            update_exchange_rate: function(cdt, cdn) {
                let from = cdt && cdn
                    ? cstr(locals[cdt][cdn].account_currency)
                    : cstr(frm.doc.payment_currency),
                base = frm._entry.base_currency;
                if (!from.length || !base.length) return;
                frm._entry.get_exchange_rate(from, base, function(v) {
                    if (cdt && cdn) {
                        if (v <= flt(locals[cdt][cdn].exchange_rate)) return;
                        frappe.model.set_value(locals[cdt][cdn], 'exchange_rate', v);
                    } else {
                        if (v > flt(frm.doc.exchange_rate))
                            frm.set_value('exchange_rate', v);
                    }
                });
            },
            update_totals: function() { frm.trigger('update_totals'); },
        };
    },
    onload: function(frm) {
        frm._entry.is_draft = !!frm.is_new() || cint(frm.doc.docstatus) < 1;
        
        frm.add_fetch('mode_of_payment', 'type', 'payment_target', frm.doctype);
        
        if (!frm._entry.is_draft) {
            frm._entry.is_disabled = true;
            frappe.exp().disable_form(frm);
            let cancel = cint(frm.doc.docstatus) > 1;
            frm.set_intro(
                __(
                    'The expenses entry has been {0}.',
                    [cancel ? 'cancelled' : 'submitted']
                ),
                cancel ? 'red' : 'green'
            );
            return;
        }
        
        if (frm.is_new()) {
            let cache = frappe.exp().pop_cache('create-expenses-entry');
            if (cache && frappe.exp().$isStr(cache.request))
                frm.set_value('expenses_request_ref', cache.request);
                frappe.exp().request(
                    'get_request_data',
                    {name: cache.request},
                    function(ret) {
                        if (!this.$isDataObj(ret)) {
                            frappe.exp().error(
                                'Expenses Entry Error',
                                'Unable to get the expenses request data for "{0}".',
                                [cache.request]
                            );
                            return;
                        }
                        frm.set_value('company', cstr(ret.company));
                        frm.set_value('remarks', cstr(ret.remarks));
                        let keys = 'description paid_by expense_claim party_type party project'.split(' ');
                        ret.expenses.forEach(function(v) {
                            let row = frm.add_child('expenses');
                            keys.forEach(function(k) { row[k] = cstr(v[k]); });
                            row.expense_ref = cstr(v.name);
                            row.account = cstr(v.expense_account);
                            row.account_currency = cstr(v.currency);
                            row.cost_in_account_currency = flt(v.total);
                            row.is_paid = cint(v.is_paid);
                            row.is_advance = cint(v.is_advance);
                            if (frappe.exp().$isArr(v.attachments) && v.attachments.length) {
                                v.attachments.forEach(function(a) {
                                    a = $.extend(true, {}, a);
                                    a.expenses_entry_row_ref = cstr(row.name);
                                    frm.add_child('attachments', a);
                                });
                            }
                        });
                        ['expenses', 'attachments'].forEach(function(f) {
                            frm.set_df_property(f, 'cannot_delete_rows', 1);
                            frm.set_df_property(f, 'allow_bulk_edit', 0);
                            frm.get_field(f).grid.df.cannot_delete_rows = 1;
                        });
                        ['company', 'remarks', 'expenses', 'attachments'].forEach(function(f) {
                            frm.set_df_property(f, 'read_only', 1);
                            frm.refresh_field(f);
                        });
                        frm.trigger('update_exchange_rates');
                    }
                );
        }
        
        frm.set_query('company', {filters: {is_group: 0}});
        frm.set_query('mode_of_payment', {filters: {type: ['in', ['Cash', 'Bank']]}});
        ['default_project', 'default_cost_center', 'project', 'cost_center'].forEach(function(k, i) {
            let fn = function() { return {company: cstr(frm.doc.company)}; };
            frm.set_query(k, i > 1 ? 'expenses' : fn, i > 1 ? fn : null);
        });
        
        frappe.exp().request(
            'entry_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObj(ret)) return;
                frm._entry.is_moderator = !!ret.is_moderator;
                if (frm._entry.is_moderator) {
                    frm.set_df_property('posting_date', 'reqd', 1);
                    frm.set_df_property('posting_date', 'bold', 1);
                    frm.set_df_property('posting_date', 'read_only', 0);
                }
                if (!ret.has_expense_claim) return;
                let grid = frappe.exp().get_grid(frm, 'expenses');
                grid.update_docfield_property('expense_claim', 'options', 'Expense Claim');
                grid.update_docfield_property('expense_claim', 'hidden', 0);
                frm.set_query('expense_claim', 'expenses', function(frm, cdt, cdn) {
                    let row = locals[cdt][cdn];
                    return {
                        filters: {
                            employee: cstr(row.paid_by),
                            company: cstr(frm.doc.company),
                            is_paid: 1,
                            status: 'Paid',
                            docstatus: 1,
                        }
                    };
                });
            }
        );
    },
    refresh: function(frm) {
        frm.trigger('update_totals');
        if (!frm._entry.is_draft || frm._entry.is_disabled || frm._entry.is_expenses_ready) return; 
        frm._entry.is_expenses_ready = true;
        frm.get_field('expenses').grid.add_custom_button(
            __('Update Exchange Rates'),
            function() {
                let fields = [],
                exist = [];
                frm.doc.expenses.forEach(function(v) {
                    let key = cstr(v.account_currency);
                    if (exist.indexOf(key) >= 0) return;
                    exist.push(key);
                    fields.push({
                        fieldname: key + '_ex',
                        fieldtype: 'Float',
                        label: frappe.scrub(key).toLowerCase(),
                        precision: '9',
                        reqd: 1,
                        bold: 1,
                        value: flt(v.exchange_rate),
                    });
                });
                frappe.prompt(
                    fields,
                    function(ret) {
                        if (!ret || !frappe.exp().$isDataObj(ret)) return;
                        frm.doc.expenses.forEach(function(v) {
                            let cdn = cstr(v.name),
                            key = cstr(v.account_currency);
                            if (ret[key] == null) return;
                            v.exchange_rate = ;
                            frm.model.set_value(
                                locals['Expenses Entry Details'][cdn],
                                'exchange_rate', flt(ret[key])
                            );
                        });
                        frm.refresh_field('expenses');
                    },
                    __('Update Exchange Rates'),
                    __('Save')
                );
            },
            'bottom'
        );
    },
    company: function(frm) {
        if (!cstr(frm.doc.company).length)
            frm.set_value('mode_of_payment', '');
    },
    mode_of_payment: function(frm) {
        var mop = cstr(frm.doc.mode_of_payment);
        if (!mop.length) {
            frm.set_value('payment_account', '');
            frm.set_value('payment_target', '');
            frm.set_value('payment_currency', frm._entry.base_currency);
            return;
        }
        frappe.exp().request(
            'get_mode_of_payment_data',
            {
                mode_of_payment: mop,
                company: cstr(frm.doc.company),
            },
            function(ret) {
                if (!ret || !this.$isDataObj(ret)) {
                    this.error(
                        'Unable to get the mode of payment data of {0} for {1}',
                        [mop, cstr(frm.doc.company)]
                    );
                    return;
                }
                frm._entry.base_currency = cstr(ret.company_currency);
                frm.set_value('payment_account', cstr(ret.account));
                frm.set_value('payment_target', cstr(ret.type));
                frm.set_value('payment_currency', cstr(ret.currency));
                frm._entry.update_exchange_rate();
            }
        );
    },
    exchange_rate: function(frm) {
        if (flt(frm.doc.exchange_rate) <= 0)
            frm._entry.update_exchange_rate();
        else frm.trigger('update_totals');
    },
    validat: function(frm) {
        if (!cstr(frm.doc.company).length) {
            frappe.exp()
                .focus(frm, 'company')
                .error('A valid expenses entry company is required.');
            return false;
        }
        if (!cstr(frm.doc.mode_of_payment).length) {
            frappe.exp()
                .focus(frm, 'mode_of_payment')
                .error('A valid expenses entry mode of payment is required.');
            return false;
        }
        if (!cstr(frm.doc.posting_date).length) {
            frappe.exp()
                .focus(frm, 'posting_date')
                .error('A valid expenses entry posting date is required.');
            return false;
        }
        if (!(frm.doc.expenses || []).length) {
            frappe.exp()
                .focus(frm, 'expenses')
                .error('At least on valid expenses entry is required.');
            return false;
        }
        if (cstr(frm.doc.payment_target) === 'Bank') {
            if (!cstr(frm.doc.payment_reference).length) {
                frappe.exp()
                    .focus(frm, 'payment_reference')
                    .error('A valid expenses entry payment reference is required.');
                return false;
            }
            if (!cstr(frm.doc.clearance_date).length) {
                frappe.exp()
                    .focus(frm, 'clearance_date')
                    .error('A valid expenses entry reference / clearance date is required.');
                return false;
            }
        }
    },
    after_save: function(frm) {
        if (frm._entry.is_draft && frm._entry.del_files.length)
            frappe.exp().request(
                'delete_attach_files',
                {
                    doctype: cstr(frm.doctype),
                    name: cstr(frm.doc.name || frm.docname),
                    files: frm._entry.del_files.col(1),
                },
                function() { frm._entry.del_files.clear(); }
            );
    },
    update_exchange_rates: function(frm) {
        let main = cstr(frm.doc.payment_currency),
        base = frm._entry.base_currency;
        if (!main.length || !base.length) return;
        var data = {};
        data[main] = [[null, flt(frm.doc.exchange_rate)]];
        let from = [main],
        curr;
        frm.doc.expenses.forEach(function(r) {
            curr = cstr(r.account_currency);
            if (curr.length) {
                if (!data[curr]) data[curr] = [];
                data[curr].push([cstr(r.name), flt(r.exchange_rate)]);
                if (from.indexOf(curr) < 0) from.push(curr);
            }
        });
        frm._entry.get_exchange_rate(from, base, function(rates) {
            if (!this.$isDataObj(rates)) {
                return;
            }
            function setter(vals, rate) {
                vals.forEach(function(val) {
                    if (rate > val[1]) {
                        if (!val[0]) frm.set_value('exchange_rate', rate);
                        else frm.model.set_value(
                            locals['Expenses Entry Details'][val[0]],
                            'exchange_rate', rate
                        );
                    }
                });
            }
            let vals, key, rate;
            for (key in rates) {
                vals = data[key];
                if (!vals) continue;
                rate = flt(rates[key]);
                if (rate < 1) rate = 1;
                setter(vals, rate);
            }
            frm.refresh_field('expenses');
        });
    },
    update_totals: function(frm) {
        let total = 0;
        frm.doc.expenses.forEach(function(r) {
            r.cost = flt(flt(r.cost_in_account_currency) * flt(r.exchange_rate));
            total += flt(r.cost);
        });
        frm.set_value('total_in_payment_currency',
            flt(total / flt(frm.doc.exchange_rate)));
        frm.set_value('total', total);
    },
});

frappe.ui.form.on('Expenses Entry Details', {
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = cstr(row.account);
        if (val.length) frm._entry.update_exchange_rate(cdt, cdn);
    },
    exchange_rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.exchange_rate);
        if (val <= 0) frm._entry.update_exchange_rate(cdt, cdn);
        else frm._entry.update_totals();
    },
    is_paid: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = cint(row.is_paid);
        if (!val) {
            frm.model.set_value(row, 'paid_by', '');
            frm.model.set_value(row, 'expense_claim', '');
        }
    },
    paid_by: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = cstr(row.paid_by);
        if (!val.length) 
            frm.model.set_value(row, 'expense_claim', '');
    },
    party_type: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = cstr(row.party_type);
        if (!val.length) 
            frm.model.set_value(row, 'party', '');
    },
});

frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = cstr(row.expenses_entry_row_ref),
        file = cstr(row.file);
        if (val.length)
            frappe.exp().error('Removing attachments is not allowed.');
        if (file.length)
            frm._entry.del_files.add(cstr(row.name || cdn), file);
    },
    file: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        file = cstr(row.file);
        if (file.length)
            frm._entry.del_files.del(cstr(row.name || cdn));
    },
});