/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.datetime');
frappe.provide('frappe.perm');


frappe.ui.form.on('Expense', {
    onload: function(frm) {
        frappe.exp()
            .on('ready change', function() { this.setup_form(frm); })
            .on('on_alert', function(d, t) {
                frm._exp.errs.includes(t) && (d.title = __(frm.doctype));
            })
            .on('form_enabled form_disabled', function() { frm.events.update_doc_form(frm); });
        frm._exp = {
            errs: ['fatal', 'error'],
            ignore: 0,
            is_draft: 1,
            is_submitted: 0,
            is_cancelled: 0,
            is_pending: 0,
            is_requested: 0,
            is_approved: 0,
            is_rejected: 0,
            form: null,
            is_moderator: false,
            has_expense_claim: false,
            expense_claim_reqd: false,
            date: {obj: moment(), str: null, dt: null},
            cost: {eq: 0, min: 0, max: 0},
            qty: {eq: 0, min: 0, max: 0},
            table: {status: 1, data: frappe.exp().table(), lock: null},
            moment: function(v, t) {
                return moment(cstr(v), frappe['defaultDate' + (t ? 'time' : '') + 'Format']);
            }
        };
        if (!frm.is_new() && frappe.exp().$isStrVal(frm.doc.creation))
            frm._exp.date.obj = frm._exp.moment(frm.doc.creation, 1);
        frm._exp.date.str = frm._exp.date.obj.format(frappe.defaultDateFormat);
        frm._exp.date.dt = frappe.datetime.moment_to_date_obj(frm._exp.date.obj);
        frm.events.update_doc_status(frm);
        if (!frm._exp.is_draft) {
            frm.events.update_doc_form(frm);
            frm._exp.table.status && frm.events.update_attachments(frm, 1);
        } else {
            frm.set_query('company', function(doc) { return {filters: {is_group: 0}}; });
            frm.set_query('expense_item', function(doc) {
                return {
                    query: frappe.exp().get_method('search_items'),
                    filters: {company: cstr(doc.company)}
                };
            });
            frm.add_fetch('expense_item', 'uom', 'uom', frm.doctype);
            frm.add_fetch('expense_account', 'account_currency', 'currency', frm.doctype);
            frm.events.update_attachments(frm, 1);
        }
        frappe.exp().request(
            'expense_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObjVal(ret))
                    return this._error('Expense setup data received is invalid.', ret);
                
                frm._exp.is_moderator = !!ret.is_moderator;
                if (!frm._exp.is_moderator) {
                    let field = frm.get_field('required_by');
                    if (field.df) {
                        field.df.options = field.df.options || {};
                        field.df.options.startDate = frm._exp.date.dt;
                        field.df.options.minDate = frm._exp.date.dt;
                    }
                    if (field.datepicker && field.datepicker.opts) {
                        field.datepicker.opts.startDate = frm._exp.date.dt;
                        field.datepicker.opts.minDate = frm._exp.date.dt;
                    }
                    frm.refresh_field('required_by');
                }
                frm._exp.has_expense_claim = !!ret.has_expense_claim;
                frm._exp.expense_claim_reqd = !!ret.expense_claim_reqd;
                if (!frm._exp.has_expense_claim) return;
                frm.set_df_property('expense_claim', {options: 'Expense Claim', hidden: 0});
                if (frm._exp.expense_claim_reqd)
                    frm.set_df_property('expense_claim', {
                        bold: 1,
                        mandatory_depends_on: 'eval:doc.is_paid && doc.paid_by',
                        read_only_depends_on: 'eval:!doc.is_paid || !doc.paid_by'
                    });
                frm.set_query('expense_claim', function(doc) {
                    return {filters: {
                        employee: cstr(doc.paid_by),
                        company: cstr(doc.company),
                        is_paid: 1,
                        status: 'Paid',
                        docstatus: 1,
                    }};
                });
            }
        );
    },
    refresh: function(frm) { frm.events.setup_toolbar(frm); },
    company: function(frm) {
        let val = cstr(frm.doc.company);
        !val.length && frm.set_value('expense_item', '');
    },
    expense_item: function(frm) {
        let val = cstr(frm.doc.expense_item);
        frm.events.enqueue_update_expense_data(frm, !val.length);
    },
    required_by: function(frm) {
        if (frm._exp.is_moderator || frm._exp.ignore) return;
        let val = cstr(frm.doc.required_by);
        val = val.length ? frm._exp.moment(val) : null;
        if (!val || cint(val.diff(frm._exp.date.obj, 'days')) < 0) {
            frm._exp.ignore++;
            frm.set_value('required_by', frm._exp.date.str);
            frm._exp.ignore--;
        }
    },
    cost: function(frm) {
        if (frm._exp.ignore) return;
        if (!frm._exp.cost) return frm.events.update_total(frm);
        let key = 'cost',
        val = flt(frm.doc[key]),
        nval = val <= 0 ? 1 : val;
        if (frm._exp[key].eq && frm._exp[key].eq !== nval) nval = frm._exp[key].eq;
        else if (0 < frm._exp[key].min > nval) nval = frm._exp[key].min;
        else if (0 < frm._exp[key].max < nval) nval = frm._exp[key].max;
        if (nval !== val) {
            frm._exp.ignore++;
            frm.set_value(key, nval);
            frm._exp.ignore--;
        }
        frm.events.update_total(frm);
    },
    qty: function(frm) {
        if (frm._exp.ignore) return;
        if (!frm._exp.qty) return frm.events.update_total(frm);
        let key = 'qty',
        val = flt(frm.doc[key]),
        nval = val <= 0 ? 1 : val;
        if (frm._exp[key].eq && frm._exp[key].eq !== nval) nval = frm._exp[key].eq;
        else if (0 < frm._exp[key].min > nval) nval = frm._exp[key].min;
        else if (0 < frm._exp[key].max < nval) nval = frm._exp[key].max;
        if (nval !== val) {
            frm._exp.ignore++;
            frm.set_value(key, nval);
            frm._exp.ignore--;
        }
        frm.events.update_total(frm);
    },
    validate: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.company)) {
            frappe.exp().fatal(__('A valid company is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.expense_item)) {
            frappe.exp().fatal(__('A valid expense item is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.required_by)) {
            frappe.exp().fatal(__('A valid required by date is required.'));
            return false;
        }
        if (!frm._exp.is_moderator) {
            let val = frm._exp.moment(frm.doc.required_by);
            if (cint(val.diff(frm._exp.date.obj, 'days')) < 0) {
                let dur = !frappe.exp().$isStrVal(frm.doc.creation) ? __('today') : frm._exp.date.str;
                frappe.exp().fatal(__('The required by date must be equals to {0} or later.', [dur]));
                return false;
            }
        }
        let val = flt(frm.doc.cost);
        if (val <= 0) {
            frappe.exp().fatal(__('A valid cost is required.'));
            return false;
        }
        let label = __('Cost');
        if (frm._exp.cost.eq && frm._exp.cost.eq !== val) {
            frappe.exp().fatal(__('{0} must be equals to {1}.', [label, frm._exp.cost.eq]));
            return false;
        }
        if (0 < frm._exp.cost.min > val) {
            frappe.exp().fatal(__('{0} must be greater than or equals to {1}.', [label, frm._exp.cost.min]));
            return false;
        }
        if (0 < frm._exp.cost.max < val) {
            frappe.exp().fatal(__('{0} must be less than or equals to {1}.', [label, frm._exp.cost.max]));
            return false;
        }
        val = flt(frm.doc.qty);
        if (val <= 0) {
            frappe.exp().fatal(__('A valid quantity is required.'));
            return false;
        }
        label = __('Quantity');
        if (frm._exp.qty.eq && frm._exp.qty.eq !== val) {
            frappe.exp().fatal(__('{0} must be equals to {1}.', [label, frm._exp.qty.eq]));
            return false;
        }
        if (0 < frm._exp.qty.min > val) {
            frappe.exp().fatal(__('{0} must be greater than or equals to {1}.', [label, frm._exp.qty.min]));
            return false;
        }
        if (0 < frm._exp.qty.max < val) {
            frappe.exp().fatal(__('{0} must be less than or equals to {1}.', [label, frm._exp.qty.max]));
            return false;
        }
        if (cint(frm.doc.is_paid)) {
            if (!frappe.exp().$isStrVal(frm.doc.paid_by)) {
                frappe.exp().fatal(__('A valid paid by employee is required.'));
                return false;
            }
            if (
                frm._exp.expense_claim_reqd
                && !frappe.exp().$isStrVal(frm.doc.expense_claim)
            ) {
                frappe.exp().fatal(__('A valid expense claim reference is required.'));
                return false;
            }
        }
        if (
            frappe.exp().$isStrVal(frm.doc.party_type)
            && !frappe.exp().$isStrVal(frm.doc.party)
        ) {
            frappe.exp().fatal(__('A valid party reference is required.'));
            return false;
        }
        frm.events.update_attachments(frm);
    },
    after_save: function(frm) {
        frm.events.clean_attachments(frm);
        frm.events.update_doc_status(frm);
        frm.events.update_doc_form(frm);
    },
    on_submit: function(frm) {
        frm.events.update_doc_status(frm);
        frm.events.update_doc_form(frm);
    },
    after_cancel: function(frm) {
        frm.events.update_doc_status(frm);
        frm.events.update_doc_form(frm);
    },
    update_doc_status: function(frm) {
        let is_new = !!frm.is_new(),
        status = cint(frm.doc.docstatus);
        frm._exp.is_draft = is_new || status === 0;
        frm._exp.is_submitted = !is_new && status === 1;
        frm._exp.is_cancelled = !is_new && status === 2;
        status = cstr(frm.doc.status).toLowerCase();
        let data = {
            pending: ['is_submitted', __('Pending'), 'orange'],
            requested: ['is_submitted', __('Requested'), 'blue'],
            approved: ['is_submitted', __('Approved'), 'green'],
            rejected: ['is_cancelled', __('Rejected'), 'red'],
            cancelled: ['is_cancelled', __('Cancelled'), 'red'],
        };
        for (let k in data) {
            frm._exp['is_' + k] = frm._exp[data[k][0]] && status === k;
            if (frm._exp['is_' + k]) frm._exp.form = {
                message: __('Expense has been {0}.', [data[k][1]]),
                color: data[k][2],
            };
        }
    },
    update_doc_form: function(frm) {
        if (!frappe.exp().is_enabled || frm._exp.is_draft) return;
        if (frm._exp.is_pending) {
            frm._exp.table.status = 1;
            frm._exp.form.ignore = ['attachments'];
        } if (frm._exp.is_requested) {
            frm._exp.table.status = 1;
            frm._exp.form.ignore = ['attachments'];
            frm._exp.table.lock = frappe.exp().table();
            frm.events.update_attachments(frm, 0, 1);
        } else {
            frm._exp.table.status = 0;
        }
        frappe.exp().disable_form(frm, frm._exp.form);
    },
    update_attachments: function(frm, load, lock) {
        let tkey = 'attachments';
        if (!frappe.exp().$isArrVal(frm.doc[tkey])) return;
        let keep = !lock && !load ? [] : null;
        for (let i = 0, x = 0, l = frm.doc[tkey].length, f; i < l; i++) {
            f = frm.doc[tkey][i];
            if (!frappe.exp().$isStrVal(f.file)) continue;
            if (load || !lock) {
                if (!load) keep[x++] = f;
                frm._exp.table.data.add(f.file);
            } else {
                f = cstr(f.name);
                frm._exp.table.lock.add(f);
                frappe.exp().toggle_rfield(frm, tkey, f, 'file', 0);
                f = frappe.exp().get_row(frm, tkey, f);
                if (f && f.wrapper) {
                    f.wrapper.find('.grid-row-check').prop('disabled', true);
                    f.wrapper.find('.grid-duplicate-row, .grid-delete-row').prop('disabled', true);
                    if (f.grid_form)
                        f.grid_form.wrapper.find('.grid-duplicate-row .grid-delete-row').prop('disabled', true);
                }
            }
        }
        if (!keep || keep.length === frm.doc[tkey].length) return;
        frm._exp.ignore++;
        frm.set_value(tkey, keep);
        frm._exp.ignore--;
    },
    setup_toolbar: function(frm) {
        frm.events.setup_save_add_button(frm);
        frm.events.setup_request_button(frm);
    },
    setup_save_add_button: function(frm) {
        let label = __('Save & Add');
        if (frm.custom_buttons[label]) {
            if (frm._exp.is_draft) return;
            frm.custom_buttons[label].remove();
            delete frm.custom_buttons[label];
        }
        if (!frm._exp.is_draft) return;
        frm.add_custom_button(label, function() {
            if (frm.save_disabled) return;
            frm.save().then(function() {
                frappe.new_doc(frm.doctype, {company: cstr(frm.doc.company)});
            });
        });
        frm.change_custom_button_type(label, null, 'success');
    },
    setup_request_button: function(frm) {
        let label = __('Request');
        if (frm.custom_buttons[label]) {
            if (frm._exp.is_pending) return;
            frm.custom_buttons[label].remove();
            delete frm.custom_buttons[label];
        }
        if (!frm._exp.is_pending) return;
        frm.add_custom_button(label, function() {
            frappe.new_doc('Expenses Request', {
                company: cstr(frm.doc.company),
                expense: cstr(frm.docname),
            });
        });
        frm.change_custom_button_type(label, null, 'success');
    },
    enqueue_update_expense_data: function(frm, clear) {
        frm._exp.timeout && frappe.exp().$timeout(frm._exp.timeout);
        if (clear || !frm._exp.is_draft) {
            delete frm._exp.timeout;
            return;
        }
        frm.set_value('expense_account', '');
        frm.set_value('currency', '');
        frm.set_value('uom', '');
        for (let k in frm._exp.cost) frm._exp.cost[k] = 0.0;
        for (let k in frm._exp.qty) frm._exp.qty[k] = 0.0;
        frm._exp.timeout = frappe.exp().$timeout(function() {
            delete frm._exp.timeout;
            frm.events.update_expense_data(frm);
        }, 2000);
    },
    update_expense_data: function(frm) {
        var company = cstr(frm.doc.company),
        item = cstr(frm.doc.expense_item);
        frappe.exp().request(
            'item_expense_data',
            {item: item, company: company},
            function(ret) {
                if (!this.$isBaseObj(ret) || !this.$isStrVal(ret.account) || !this.$isStrVal(ret.currency))
                    return this.error(__('Expense item "{0}" doesn\'t have an expense account linked to company "{1}".', [item, company]));
                
                frm.set_value('expense_account', ret.account);
                frm.set_value('currency', ret.currency);
                frm.set_value('uom', ret.uom);
                frm._exp.cost.eq = flt(ret.cost);
                frm._exp.cost.min = flt(ret.min_cost);
                frm._exp.cost.max = flt(ret.max_cost);
                if (frm._exp.cost.eq > 0) {
                    frm.set_value('cost', frm._exp.cost.eq);
                    frm.toggle_enable('cost', 0);
                }
                frm._exp.qty.eq = flt(ret.qty);
                frm._exp.qty.min = flt(ret.min_qty);
                frm._exp.qty.max = flt(ret.max_qty);
                if (frm._exp.qty.eq > 0) {
                    frm.set_value('qty', frm._exp.qty.eq);
                    frm.toggle_enable('qty', 0);
                }
            },
            function(e) {
                this.error(e.self ? e.message : __('Expense item "{0}" doesn\'t have an expense account linked to company "{1}".', [item, company]));
            }
        );
    },
    update_total: function(frm) {
        let cost = flt(frm.doc.cost),
        qty = flt(frm.doc.qty);
        frm.set_value('total', flt(cost * qty));
    },
    clean_attachments: function(frm) {
        if (!frm._exp.table.status || !frm._exp.table.data.length) return;
        let tkey = 'attachments';
        if (frappe.exp().$isArrVal(frm.doc[tkey])) {
            for (let i = 0, l = frm.doc[tkey].length; i < l; i++)
                frm._exp.table.data.del(frm.doc[tkey][i].file);
            if (!frm._exp.table.data.length) return;
        }
        frappe.exp().request(
            'delete_attach_files',
            {
                doctype: cstr(frm.doctype),
                name: cstr(frm.docname),
                files: frm._exp.table.data.col(),
            },
            function() { frm._exp.table.data.clear(); }
        );
    },
});


frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        if (!frm._exp.table.status)
            frappe.exp().fatal(__('Removing attachments isn\'t allowed.'));
        else if (frm._exp.table.lock && frm._exp.table.lock.has(cdn))
            frappe.exp().fatal(__('Removing attachment isn\'t allowed.'));
    },
    file: function(frm, cdt, cdn) {
        let file = cstr(locals[cdt][cdn].file);
        file.length && frm._exp.table.data.add(file);
    }
});