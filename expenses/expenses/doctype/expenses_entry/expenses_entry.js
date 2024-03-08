/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Entry', {
    onload: function(frm) {
        frappe.exp().on('ready change', function() { this.setup_form(frm); });
        frm._entry = {
            is_draft: false,
            is_disabled: false,
            is_moderator: false,
            is_expenses_ready: false,
            base_currency: cstr(frappe.boot.sysdefaults.currency),
            del_files: frappe.exp().table(),
            qry_fn: function() { return function(doc) { return {company: cstr(doc.company)}; }; },
            get_exchange_rate: function(from, to, fn) {
                frappe.exp().request(
                    'get_current_exchange_rate',
                    {from_currency: from, to_currency: to},
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
                        frappe.model.set_value(cdt, cdn, 'exchange_rate', v);
                    } else {
                        if (v > flt(frm.doc.exchange_rate)) frm.set_value('exchange_rate', v);
                    }
                });
            },
            update_totals: function() { frm.events.update_totals(frm); },
        };
        frm._entry.is_draft = !!frm.is_new() || cint(frm.doc.docstatus) < 1;
        frm.add_fetch('mode_of_payment', 'type', 'payment_target', frm.doctype);
        if (!frm._entry.is_draft) {
            frm._entry.is_disabled = true;
            let cancel = cint(frm.doc.docstatus) > 1;
            frappe.exp().disable_form(frm,
                __('The expenses entry has been {0}.',
                    [cancel ? __('cancelled') : __('submitted')]
                ),
                cancel ? 'red' : 'green'
            );
            return;
        }
        if (!!frm.is_new()) {
            let req = frappe.route_options;
            if (frappe.exp().$isDataObj(req) && frappe.exp().$isStrVal(req.expenses_request_ref)) {
                req = req.expenses_request_ref;
                frm.set_value('expenses_request_ref', req);
                frappe.exp().request(
                    'get_request_data', {name: req},
                    function(ret) {
                        if (!this.$isDataObjVal(ret))
                            return this.error(
                                __(frm.doctype),
                                __('Unable to get the expenses request data for "{0}".', [req])
                            );
                        
                        frm.set_value({company: cstr(ret.company), remarks: cstr(ret.remarks)});
                        let keys = 'description paid_by expense_claim party_type party project'.split(' ');
                        for (let i = 0, l = ret.expenses.length, v, r; i < l; i++) {
                            v = ret.expenses[i];
                            r = {};
                            for (let x = 0, y = keys.length; x < y; x++)
                                r[keys[x]] = cstr(v[keys[x]]);
                            r.expense_ref = cstr(v.name);
                            r.account = cstr(v.expense_account);
                            r.account_currency = cstr(v.currency);
                            r.cost_in_account_currency = flt(v.total);
                            r.is_paid = cint(v.is_paid);
                            r.is_advance = cint(v.is_advance);
                            frm.add_child('expenses', r);
                            if (this.$isArrVal(v.attachments))
                                for (let x = 0, y = v.attachments.length, a; x < y; x++) {
                                    a = v.attachments[i];
                                    a.expenses_entry_row_ref = cstr(r.name);
                                    frm.add_child('attachments', a);
                                }
                        }
                        this.disable_field(frm, 'company')
                            .disable_field(frm, 'remarks')
                            .disable_table(frm, 'expenses')
                            .disable_table(frm, 'attachments');
                        frm.events.update_exchange_rates(frm);
                    }
                );
            }
        }
        frm.set_query('company', function(doc) { return {filters: {is_group: 0}}; });
        frm.set_query('mode_of_payment', function(doc) { return {filters: {type: ['in', ['Cash', 'Bank']]}}; });
        let keys = ['default_project', 'default_cost_center', 'project', 'cost_center'];
        for (let i = 0, l = keys.length; i < l; i++)
            frm.set_query(k, i > 1 ? 'expenses' : frm._entry.qry_fn(), i > 1 ? frm._entry.qry_fn() : null);
        
        frappe.exp().request(
            'entry_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObjVal(ret)) return;
                frm._entry.is_moderator = !!ret.is_moderator;
                if (frm._entry.is_moderator)
                    frm.set_df_property('posting_date', {reqd: 1, bold: 1, read_only: 0});
                if (!ret.has_expense_claim) return;
                let grid = frm.get_field('expenses').grid;
                grid.update_docfield_property('expense_claim', 'options', 'Expense Claim');
                grid.update_docfield_property('expense_claim', 'hidden', 0);
                frm.set_query('expense_claim', 'expenses', function(doc, cdt, cdn) {
                    let row = locals[cdt][cdn];
                    return {filters: {
                        employee: cstr(row.paid_by),
                        company: cstr(doc.company),
                        is_paid: 1,
                        status: 'Paid',
                        docstatus: 1,
                    }};
                });
            }
        );
    },
    refresh: function(frm) {
        frm.events.update_totals(frm);
        if (!frm._entry.is_draft || frm._entry.is_disabled || frm._entry.is_expenses_ready) return; 
        frm._entry.is_expenses_ready = true;
        frm.get_field('expenses').grid.add_custom_button(
            __('Update Exchange Rates'), function() {
                let fields = [], exist = [];
                for (let i = 0, l = frm.doc.expenses.length, v, k; i < l; i++) {
                    v = frm.doc.expenses[i];
                    k = cstr(v.account_currency);
                    if (exist.includes(k)) continue;
                    exist.push(k);
                    fields.push({
                        fieldname: k + '_ex',
                        fieldtype: 'Float',
                        label: __(frappe.scrub(k).toLowerCase()),
                        precision: '9',
                        reqd: 1,
                        bold: 1,
                        value: flt(v.exchange_rate),
                    });
                }
                frappe.prompt(
                    fields,
                    function(ret) {
                        if (!frappe.exp().$isDataObjVal(ret)) return;
                        for (let i = 0, l = frm.doc.expenses.length, v, cdn, key; i < l; i++) {
                            v = frm.doc.expenses[i];
                            cdn = cstr(v.name);
                            key = cstr(v.account_currency);
                            if (ret[key] != null) frm.model.set_value(
                                'Expenses Entry Details', cdn,
                                'exchange_rate', flt(ret[key])
                            );
                        }
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
        if (!frappe.exp().$isStrVal(frm.doc.company)) frm.set_value('mode_of_payment', '');
    },
    mode_of_payment: function(frm) {
        var val = cstr(frm.doc.mode_of_payment);
        if (!val.length) return frm.set_value({
            payment_account: '',
            payment_target: '',
            payment_currency: frm._entry.base_currency
        });
        frappe.exp().request(
            'get_mode_of_payment_data',
            {
                mode_of_payment: val,
                company: cstr(frm.doc.company),
            },
            function(ret) {
                if (!this.$isDataObjVal(ret)) return this.error(
                    __(frm.doctype), __('Unable to get the mode of payment data of {0} for {1}',
                        [val, cstr(frm.doc.company)])
                );
                frm._entry.base_currency = cstr(ret.company_currency);
                frm.set_value({
                    payment_account: cstr(ret.account),
                    payment_target: cstr(ret.type),
                    payment_currency: cstr(ret.currency)
                });
                frm._entry.update_exchange_rate();
            }
        );
    },
    exchange_rate: function(frm) {
        if (flt(frm.doc.exchange_rate) <= 0) frm._entry.update_exchange_rate();
        else frm.events.update_totals(frm);
    },
    validat: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.company)) {
            frappe.exp()
                .focus(frm, 'company')
                .error(__(frm.doctype), __('A valid company is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.mode_of_payment)) {
            frappe.exp()
                .focus(frm, 'mode_of_payment')
                .error(__(frm.doctype), __('A valid mode of payment is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.posting_date)) {
            frappe.exp()
                .focus(frm, 'posting_date')
                .error(__(frm.doctype), __('A valid posting date is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expenses)) {
            frappe.exp()
                .focus(frm, 'expenses')
                .error(__(frm.doctype), __('At least on valid expense is required.'));
            return false;
        }
        if (cstr(frm.doc.payment_target) === 'Bank') {
            if (!frappe.exp().$isStrVal(frm.doc.payment_reference)) {
                frappe.exp()
                    .focus(frm, 'payment_reference')
                    .error(__(frm.doctype), __('A valid payment reference is required.'));
                return false;
            }
            if (!frappe.exp().$isStrVal(frm.doc.clearance_date)) {
                frappe.exp()
                    .focus(frm, 'clearance_date')
                    .error(__(frm.doctype), __('A valid reference/clearance date is required.'));
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
                    name: cstr(frm.docname),
                    files: frm._entry.del_files.col(),
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
        let from = [main], curr;
        for (let i = 0, l = frm.doc.expenses.length, r; i < l; i++) {
            r = frm.doc.expenses[i];
            curr = cstr(r.account_currency);
            if (curr.length) {
                if (!data[curr]) data[curr] = [];
                data[curr].push([cstr(r.name), flt(r.exchange_rate)]);
                if (from.indexOf(curr) < 0) from.push(curr);
            }
        }
        frm._entry.get_exchange_rate(from, base, function(rates) {
            if (!this.$isDataObjVal(rates)) return;
            function setter(vals, rate) {
                for (let i = 0, l = vals.length, v; i < l; i++) {
                    v = vals[i];
                    if (rate > v[1]) {
                        if (!v[0]) frm.set_value('exchange_rate', rate);
                        else frm.model.set_value('Expenses Entry Details', v[0], 'exchange_rate', rate);
                    }
                }
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
        for (let i = 0, l = frm.doc.expenses.length, r; i < l; i++) {
            r = frm.doc.expenses[i];
            r.cost = flt(flt(r.cost_in_account_currency) * flt(r.exchange_rate));
            total += flt(r.cost);
        }
        frm.set_value('total_in_payment_currency',
            flt(total / flt(frm.doc.exchange_rate)));
        frm.set_value('total', total);
    },
});


frappe.ui.form.on('Expenses Entry Details', {
    account: function(frm, cdt, cdn) {
        let val = cstr(locals[cdt][cdn].account);
        if (val.length) frm._entry.update_exchange_rate(cdt, cdn);
    },
    exchange_rate: function(frm, cdt, cdn) {
        let val = flt(locals[cdt][cdn].exchange_rate);
        if (val <= 0) frm._entry.update_exchange_rate(cdt, cdn);
        else frm._entry.update_totals();
    },
    is_paid: function(frm, cdt, cdn) {
        let val = cint(locals[cdt][cdn].is_paid);
        if (!val) frm.model.set_value(cdt, cdn, {paid_by: '', expense_claim: ''});
    },
    paid_by: function(frm, cdt, cdn) {
        let val = cstr(locals[cdt][cdn].paid_by);
        if (!val.length) frm.model.set_value(cdt, cdn, 'expense_claim', '');
    },
    party_type: function(frm, cdt, cdn) {
        let val = cstr(locals[cdt][cdn].party_type);
        if (!val.length) frm.model.set_value(cdt, cdn, 'party', '');
    },
});


frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        file = cstr(row.file);
        if (frappe.exp().$isStrVal(row.expenses_entry_row_ref))
            frappe.exp().error(__(frm.doctype), __('Removing attachments is not allowed.'));
        else if (file.length) frm._entry.del_files.add(file);
    },
    file: function(frm, cdt, cdn) {
        let file = cstr(locals[cdt][cdn].file);
        if (file.length) frm._entry.del_files.del(file);
    },
});