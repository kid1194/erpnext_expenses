/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Entry', {
    onload: function(frm) {
        frappe.exp()
            .on('ready change', function() { this.setup_form(frm); })
            .on('on_alert', function(d, t) {
                frm._ent.errs.includes(t) && (d.title = __(frm.doctype));
            });
        frm._ent = {
            errs: ['fatal', 'error'],
            is_draft: false,
            is_disabled: false,
            is_moderator: false,
            has_expense_claim: false,
            date: {obj: moment(), str: null},
            table: {ready: false},
            company: null,
            mop: null,
            currency: cstr(frappe.boot.sysdefaults.currency),
            is_custom: 0,
            cache: {},
            files: frappe.exp().table(),
            moment: function(v, t) {
                t = t ? frappe.defaultDatetimeFormat : frappe.defaultDateFormat;
                return moment(cstr(v), t);
            },
        };
        frm._ent.is_draft = !!frm.is_new() || cint(frm.doc.docstatus) === 0;
        frm.add_fetch('mode_of_payment', 'type', 'payment_target', frm.doctype);
        if (!frm._ent.is_draft) return frm.events.disable_form(frm);
        frm._ent.date.str = frm._ent.date.obj.format(frappe.defaultDateFormat);
        frm.set_query('company', function(doc) { return {filters: {is_group: 0}}; });
        frm.set_query('mode_of_payment', function(doc) { return {filters: {type: ['in', ['Cash', 'Bank']]}}; });
        frm.set_query('default_project', function(doc) {
            return {filters: {
                status: 'Open',
                is_active: 'Yes',
                company: ['in', [cstr(doc.company), '']]
            }};
        });
        frm.set_query('default_cost_center', function(doc) {
            return {filters: {
                is_group: 0,
                company: cstr(doc.company)
            }};
        });
        frm.set_query('project', 'expenses', function(doc) {
            return {filters: {
                status: 'Open',
                is_active: 'Yes',
                company: ['in', [cstr(doc.company), '']]
            }};
        });
        frm.set_query('cost_center', 'expenses', function(doc) {
            return {filters: {
                is_group: 0,
                company: cstr(doc.company)
            }};
        });
        frappe.exp().request(
            'entry_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObjVal(ret)) return;
                frm._ent.is_moderator = !!ret.is_moderator;
                let key = 'posting_date';
                if (frm._ent.is_moderator)
                    frm.set_df_property(key, {reqd: 1, bold: 1, read_only: 0});
                else if (frm.is_new() || !this.$isStrVal(frm.doc[key])) {
                    frm._ent.ignore++;
                    frm.set_value(key, frm._ent.date.str);
                    frm._ent.ignore--;
                }
                if (!ret.has_expense_claim) return;
                frm._ent.has_expense_claim = true;
                this.tfield_prop(frm, 'expenses', 'expense_claim', {
                    options: 'Expense Claim',
                    hidden: 0,
                });
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
        if (!frm.is_new()) {
            frm._ent.company = cstr(frm.doc.company);
            frm._ent.mop = cstr(frm.doc.mode_of_payment);
            frm.events.toggle_exchange_rate(frm);
        } else if (frappe.has_route_options()) frm.events.load_request(frm);
    },
    refresh: function(frm) {
        frm.events.update_totals(frm);
        if (!frm._ent.is_draft) return;
        !frm._ent.table.ready && frm.events.setup_table(frm);
    },
    company: function(frm) {
        let val = cstr(frm.doc.company);
        if (frm._ent.company === val) return;
        frm._ent.company = val;
        if (!val.length) frm.set_value('mode_of_payment', '');
        else frappe.exp().request(
            'get_company_currency',
            {name: val},
            function(ret) {
                if (this.$isStrVal(ret)) frm._ent.currency = ret;
                else this._error('Unable to get the company currency.', ret, cstr(frm.doc.company));
            },
            function(e) {
                this._error(e.self ? e.message : 'Failed to get the company currency.', cstr(frm.doc.company));
                frm._ent.currency = cstr(frappe.boot.sysdefaults.currency);
            }
        );
    },
    mode_of_payment: function(frm) {
        let val = cstr(frm.doc.mode_of_payment);
        if (frm._ent.mop === val) return;
        frm._ent.mop = val;
        if (val.length) frm.events.update_mop(frm);
        else frm.set_value({
            payment_account: '',
            payment_target: '',
            payment_currency: frm._ent.currency,
            exchange_rate: 1.0
        });
    },
    posting_date: function(frm) {
        if (frm._ent.ignore) return;
        let key = 'posting_date',
        val = cstr(frm.doc[key]);
        if (!val.length) {
            frm._ent.ignore++;
            frm.set_value('posting_date', frm._ent.date.str);
            frm._ent.ignore--;
        }
    },
    custom_exchange_rate: function(frm) {
        frm.events.toggle_exchange_rate(frm);
    },
    exchange_rate: function(frm) {
        flt(frm.doc.exchange_rate) < 1
            ? frm.events.update_exchange_rate(frm)
            : frm.events.update_totals(frm);
    },
    validate: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.company)) {
            frappe.exp().fatal(__('A valid company is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.mode_of_payment)) {
            frappe.exp().fatal(__('A valid mode of payment is required.'));
            return false;
        }
        if (
            !frappe.exp().$isStrVal(frm.doc.payment_account)
            || !frappe.exp().$isStrVal(frm.doc.payment_target)
        ) {
            frappe.exp().fatal(__('Failed to get the mode of payment data.'));
            return false;
        }
        if (!frm._ent.is_moderator && (
            !frappe.exp().$isStrVal(frm.doc.posting_date)
            || cint(frm._ent.moment(frm.doc.posting_date).diff(frm._ent.date.obj, 'days')) < 0
        )) {
            frm._ent.ignore++;
            frm.set_value('posting_date', frm._ent.date.str);
            frm._ent.ignore--;
        }
        if (!frappe.exp().$isStrVal(frm.doc.posting_date)) {
            frappe.exp().fatal(__('A valid posting date is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expenses)) {
            frappe.exp().fatal(__('At least on valid expense is required.'));
            return false;
        }
        if (cstr(frm.doc.payment_target) === 'Bank') {
            if (!frappe.exp().$isStrVal(frm.doc.payment_reference)) {
                frappe.exp().fatal(__('A valid payment reference is required.'));
                return false;
            }
            if (!frappe.exp().$isStrVal(frm.doc.clearance_date)) {
                frappe.exp().fatal(__('A valid reference/clearance date is required.'));
                return false;
            }
        }
    },
    after_save: function(frm) {
        if (frm._ent.is_draft && frm._ent.files.length) {
            let tkey = 'attachments';
            if (frappe.exp().$isArrVal(frm.doc[tkey]))
                for (let i = 0, l = frm.doc[tkey].length, v; i < l; i++) {
                    v = cstr(frm.doc[tkey][i].file);
                    v.length && frm._ent.files.del(v);
                }
            if (frm._ent.files.length)
                frappe.exp().request(
                    'delete_attach_files',
                    {
                        doctype: cstr(frm.doctype),
                        name: cstr(frm.docname),
                        files: frm._ent.files.col(),
                    },
                    function() { frm._ent.files.clear(); }
                );
        }
    },
    disable_form: function(frm) {
        frm._ent.is_disabled = true;
        let cancelled = cint(frm.doc.docstatus) > 1,
        status = cancelled ? __('cancelled') : __('submitted'),
        color = cancelled ? 'red' : 'green';
        frappe.exp().disable_form(frm, __('Expenses entry has been {0}.', [status]), color);
    },
    load_request: function(frm) {
        var ref = frappe.route_options.expenses_request_ref;
        delete frappe.route_options.expenses_request_ref;
        if (!frappe.exp().$isStrVal(ref)) return;
        frm.set_value('expenses_request_ref', ref);
        frappe.exp().request(
            'get_request_data', {name: ref},
            function(ret) {
                if (!this.$isDataObjVal(ret))
                    return this.error(
                        __('Unable to get the expenses request data for "{0}".', [ref])
                    );
                
                frm.set_value({company: cstr(ret.company), remarks: cstr(ret.remarks)});
                let ks = 'description paid_by expense_claim party_type party project'.split(' '),
                kl = ks.length;
                for (let i = 0, l = ret.expenses.length, v, r; i < l; i++) {
                    v = ret.expenses[i];
                    r = {};
                    for (let x = 0; x < kl; x++) r[ks[x]] = cstr(v[ks[x]]);
                    r.expense_ref = cstr(v.name);
                    r.account = cstr(v.expense_account);
                    r.account_currency = cstr(v.currency);
                    r.cost_in_account_currency = flt(v.total);
                    r.is_paid = cint(v.is_paid);
                    r.is_advance = cint(v.is_advance);
                    r = frm.add_child('expenses', r);
                    if (!this.$isArrVal(v.attachments)) continue;
                    r = cstr(r.name);
                    for (let x = 0, y = v.attachments.length, a; x < y; x++) {
                        a = v.attachments[i];
                        a.expenses_entry_row_ref = r;
                        a = frm.add_child('attachments', a);
                        frm._ent.files.add(cstr(a.file));
                    }
                }
                this.toggle_field(frm, 'company', 0)
                    .toggle_field(frm, 'remarks', 0)
                    .toggle_field(frm, 'expenses', 0)
                    .toggle_table(frm, 'attachments', 0);
                
                frm.events.refresh_exchange_rates(frm);
            }
        );
    },
    update_mop: function(frm) {
        frappe.exp().request(
            'get_mode_of_payment_data',
            {
                mode_of_payment: cstr(frm.doc.mode_of_payment),
                company: cstr(frm.doc.company),
            },
            function(ret) {
                if (!this.$isDataObjVal(ret))
                    return this._error('Unable to get the mode of payment data.',
                        ret, cstr(frm.doc.mode_of_payment), cstr(frm.doc.company));
                
                frm.set_value({
                    payment_account: cstr(ret.account),
                    payment_target: cstr(ret.type),
                    payment_currency: cstr(ret.currency)
                });
                frm.events.update_exchange_rate(frm);
            },
            function(e) {
                this._error(e.self ? e.message : 'Failed to get the mode of payment data.',
                    cstr(frm.doc.mode_of_payment), cstr(frm.doc.company));
            }
        );
    },
    toggle_exchange_rate: function(frm) {
        let val = cint(frm.doc.custom_exchange_rate) ? 1 : 0,
        key = 'exchange_rate';
        if (frm._ent.is_custom === val) return;
        frm._ent.is_custom = val;
        frm.set_df_property(key, {reqd: val, bold: val, read_only: val ? 0 : 1});
        let tkey = 'expenses';
        frappe.exp().tfield_prop(frm, tkey, key, {reqd: val, bold: val, read_only: val ? 0 : 1});
        if (frappe.exp().$isArrVal(frm.doc[tkey])) {
            for (let i = 0, l = frm.doc[tkey].length, r; i < l; i++) {
                r = frm.doc[tkey][i];
                frappe.exp().rfield_prop(frm, tkey, r.name, key, {reqd: val, bold: val, read_only: val ? 0 : 1});
            }
            frm.refresh_field(tkey);
        }
        if (!frm._ent.table.ready) return;
        let grid = frappe.exp().get_grid(frm, tkey),
        label = __('Update Exchange Rates');
        if (grid && grid.custom_buttons[label])
            grid.custom_buttons[label].prop('disabled', val > 0);
    },
    update_totals: function(frm) {
        let tkey = 'expenses',
        total = 0.0;
        if (frappe.exp().$isArrVal(frm.doc[tkey]))
            for (let i = 0, l = frm.doc[tkey].length, r; i < l; i++) {
                r = frm.doc[tkey][i];
                r.cost = flt(flt(r.cost_in_account_currency) * flt(r.exchange_rate));
                total += flt(r.cost);
            }
        frm.set_value(
            'total_in_payment_currency',
            flt(total / flt(frm.doc.exchange_rate))
        );
        frm.set_value('total', total);
    },
    setup_table: function(frm) {
        frm._ent.table.ready = true;
        var tkey = 'expenses';
        let grid = frappe.exp().get_grid(frm, tkey),
        label = __('Update Exchange Rates');
        if (!grid || grid.custom_buttons[label]) return;
        grid.add_custom_button(label, function() {
            if (!frappe.exp().$isArrVal(frm.doc[tkey])) return;
            let fields = [],
            exist = [];
            for (let i = 0, l = frm.doc[tkey].length, v, k; i < l; i++) {
                v = frm.doc[tkey][i];
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
                    let cdt = 'Expenses Entry Details',
                    key = 'exchange_rate';
                    for (let i = 0, l = frm.doc[tkey].length, v, r, k; i < l; i++) {
                        v = frm.doc[tkey][i];
                        r = cstr(v.name);
                        k = cstr(v.account_currency) + '_ex';
                        if (ret[k] != null) frm.model.set_value(cdt, r, key, flt(ret[k]));
                    }
                    frm.refresh_field(tkey);
                },
                __('Update Exchange Rates'),
                __('Save')
            );
        }, 'bottom');
    },
    update_exchange_rate: function(frm, cdn) {
        if (!frm._ent.is_custom || !frappe.exp().$isStrVal(frm._ent.currency)) return;
        var cdt = 'Expenses Entry Details';
        let from = cdn ? locals[cdt][cdn].account_currency : frm.doc.payment_currency;
        if (!frappe.exp().$isStrVal(from)) return;
        function _update(v) {
            frm._ent.ignore++;
            let f = v == null;
            if (f) v = 1.0;
            if (cdn) {
                if (f || v > flt(locals[cdt][cdn].exchange_rate))
                    frappe.model.set_value(cdt, cdn, 'exchange_rate', v);
            } else {
                if (f || v > flt(frm.doc.exchange_rate)) frm.set_value('exchange_rate', v);
            }
            frm._ent.ignore--;
        }
        if (from === frm._ent.currency) _update();
        else frm.events.get_exchange_rate(frm, from, frm._ent.currency, _update);
    },
    refresh_exchange_rates: function(frm) {
        if (!frm._ent.is_custom) return;
        let main = cstr(frm.doc.payment_currency),
        base = frm._ent.currency;
        if (!main.length || !base.length) return;
        var data = {[main]: [[null, flt(frm.doc.exchange_rate)]]};
        let tkey = 'expenses',
        from = [main];
        for (let i = 0, l = frm.doc[tkey].length, r, c; i < l; i++) {
            r = frm.doc[tkey][i];
            c = cstr(r.account_currency);
            if (!c.length) return;
            if (!data[c]) data[c] = [];
            data[c].push([cstr(r.name), flt(r.exchange_rate)]);
            if (!from.includes(c)) from.push(c);
        }
        frm.events.get_exchange_rate(frm, from, base, function(rates) {
            if (!this.$isDataObjVal(rates)) return;
            let rate;
            frm._ent.ignore++;
            for (let key in rates) {
                if (!data[key]) continue;
                rate = flt(rates[key]);
                if (rate < 1) rate = 1;
                for (let i = 0, l = data[key].length, v; i < l; i++) {
                    v = data[key][i];
                    if (rate < v[1]) continue;
                    if (v[0] == null) frm.set_value('exchange_rate', rate);
                    else frm.model.set_value('Expenses Entry Details', v[0], 'exchange_rate', rate);
                }
            }
            frm._ent.ignore--;
            frm.refresh_field('expenses');
        });
    },
    get_exchange_rate: function(frm, from, to, fn) {
        var _data, _from;
        if (frappe.exp().$isStrVal(from)) {
            if (frm._ent.cache[from] == null) _from = from;
            else return fn.call(frappe.exp(), frm._ent.cache[from]);
        } else {
            _data = {};
            _from = [];
            for (let i = 0, l = from.length; i < l; i++) {
                if (frm._ent.cache[from[i]] == null) _from.push(from[i]);
                else _data[from[i]] = frm._ent.cache[from[i]];
            }
            if (!_from.length) return fn.call(frappe.exp(), _data);
        }
        if (!frappe.exp().$isStrVal(frm.doc.posting_date)) {
            frm._ent.ignore++;
            frm.set_value('posting_date', frm._ent.date.str);
            frm._ent.ignore--;
        }
        frappe.exp().request(
            'get_exchange_rate',
            {
                _from: _from,
                _to: to,
                date: cstr(frm.doc.posting_date)
            },
            function(v) {
                if (!this.$isArr(_from)) {
                    v = flt(v);
                    if (v < 1) v = 1;
                    frm._ent.cache[_from] = v;
                    return fn.call(this, v);
                }
                
                for (let i = 0, l = _from.length, k; i < l; i++) {
                    k = _from[i];
                    if (v[k] == null) v[k] = 1.0;
                    else {
                        v[k] = flt(v[k]);
                        if (v[k] < 1) v[k] = 1;
                    }
                    _data[k] = v[k];
                    frm._ent.cache[k] = v[k];
                }
                fn.call(this, _data);
            },
            function(e) {
                this._error(e.self ? e.message : 'Failed to get the exchange rate.', _from, to);
                if (!this.$isArr(_from)) return fn.call(this, 1.0);
                for (let i = 0, l = _from.length; i < l; i++) _data[_from[i]] = 1.0;
                fn.call(this, _data);
            }
        );
    },
});


frappe.ui.form.on('Expenses Entry Details', {
    account: function(frm, cdt, cdn) {
        let val = cstr(locals[cdt][cdn].account);
        if (val.length) frm.events.update_exchange_rate(frm, cdn);
    },
    exchange_rate: function(frm, cdt, cdn) {
        let val = flt(locals[cdt][cdn].exchange_rate);
        if (val <= 0) frm.events.update_exchange_rate(frm, cdn);
        else frm.events.update_totals(frm);
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
        let row = locals[cdt][cdn];
        if (frappe.exp().$isStrVal(row.expenses_entry_row_ref))
            frappe.exp().fatal(__('Removing attachments isn\'t allowed.'));
    },
    file: function(frm, cdt, cdn) {
        let file = cstr(locals[cdt][cdn].file);
        if (file.length) frm._ent.files.add(file);
    },
});