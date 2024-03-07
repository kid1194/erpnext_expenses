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
        frappe.exp().on('ready change', function() { this.setup_form(frm); });
        frm._expense = {
            err: __('Expense Error'),
            status: {
                pending: ['is_submitted', __('Pending'), 'orange'],
                requested: ['is_submitted', __('Requested'), 'blue'],
                approved: ['is_submitted', __('Approved'), 'green'],
                rejected: ['is_cancelled', __('Rejected'), 'red'],
                cancelled: ['is_cancelled', __('Cancelled'), 'red'],
            },
            is_new: !!frm.is_new(),
            is_draft: false,
            is_submitted: false,
            is_cancelled: false,
            doc_status: null,
            doc_status_color: null,
            is_pending: false,
            is_requested: false,
            is_approved: false,
            is_rejected: false,
            is_table_disabled: false,
            is_moderator: true,
            has_expense_claim: false,
            min_date: null,
            min_date_dt: null,
            cost: null,
            qty: null,
            files: frappe.exp().table(1),
        };
        
        if (!!frm.is_new()) frm._expense.min_date = moment();
        else frm._expense.min_date = moment(cstr(frm.doc.creation, frappe.defaultDatetimeFormat));
        frm._expense.min_date_dt = frappe.datetime.moment_to_date_obj(frm._expense.min_date);
        
        frm.events.update_doc_status(frm);
        
        frappe.exp().request(
            'expense_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObjVal(ret)) return;
                frm._expense.is_moderator = !!ret.is_moderator;
                if (frm._expense.is_moderator) frm._expense.min_date_dt = null;
                else {
                    frm.set_df_property('required_by', 'options', {
                        startDate: frm._expense.min_date_dt,
                        minDate: frm._expense.min_date_dt
                    });
                    let field = frm.get_field('required_by');
                    if (field.datepicker && field.datepicker.opts) {
                        field.datepicker.opts.startDate = frm._expense.min_date_dt;
                        field.datepicker.opts.minDate = frm._expense.min_date_dt;
                    }
                    frm.refresh_field('required_by');
                }
                
                frm._expense.has_expense_claim = !!ret.has_expense_claim;
                if (frm._expense.has_expense_claim) {
                    frm.set_df_property('expense_claim', {options: 'Expense Claim', hidden: 0});
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
            }
        );
        
        if (frm._expense.is_draft) {
            frm.set_query('company', {filters: {is_group: 0}});
            frm.set_query('expense_item', function(doc) {
                return {
                    query: frappe.exp().get_method('search_items'),
                    filters: {company: cstr(doc.company)}
                };
            });
            return;
        }
        
        frm.events.update_doc_form(frm);
    },
    refresh: function(frm) { frm.events.add_toolbar_button(frm); },
    company: function(frm) {
        let val = cstr(frm.doc.company);
        if (!val.length) frm.set_value('expense_item', '');
    },
    expense_item: function(frm) {
        let val = cstr(frm.doc.expense_item);
        if (val.length) frm.events.enqueue_update_expense_data(frm);
        else frm.events.enqueue_update_expense_data(frm, 1);
    },
    required_by: function(frm) {
        if (frm._expense.is_moderator) return;
        let val = cstr(frm.doc.required_by);
        if (!val.length || !frm._expense.min_date_dt) return;
        val = moment(val, frappe.defaultDateFormat);
        if (cint(val.diff(frm._expense.min_date, 'days')) < 0)
            frm.set_value('required_by', frm._expense.min_date.format(frappe.defaultDateFormat));
    },
    cost: function(frm) {
        if (!frm._expense.is_draft || !frm._expense.cost) return;
        let val = flt(frm.doc.cost),
        nval = val <= 0 ? 1 : val;
        if (frm._expense.cost.min && val < frm._expense.cost.min) nval = frm._expense.cost.min;
        else if (frm._expense.cost.max && val > frm._expense.cost.max) nval = frm._expense.cost.max;
        if (nval !== val) frm.set_value('cost', nval);
        frm.events.update_total(frm);
    },
    qty: function(frm) {
        if (!frm._expense.is_draft || !frm._expense.qty) return;
        let val = flt(frm.doc.qty),
        nval = val <= 0 ? 1 : val;
        if (frm._expense.qty.min && val < frm._expense.qty.min) nval = frm._expense.qty.min;
        else if (frm._expense.qty.max && val > frm._expense.qty.max) nval = frm._expense.qty.max;
        if (nval !== val) frm.set_value('qty', nval);
        frm.events.update_total(frm);
    },
    is_paid: function(frm) {
        let val = cint(frm.doc.is_paid);
        if (!val && cstr(frm.doc.paid_by).length) frm.set_value('paid_by', '');
        if (frm._expense.has_expense_claim) {
            frm.toggle_reqd('expense_claim', !!val);
            frm.toggle_enable('expense_claim', !!val);
        }
    },
    paid_by: function(frm) {
        if (!cstr(frm.doc.paid_by).length) frm.set_value('expense_claim', '');
    },
    expense_claim: function(frm) {
        if (cstr(frm.doc.expense_claim).length && !frm._expense.has_expense_claim) frm.set_value('expense_claim', '');
    },
    party_type: function(frm) {
        if (!cstr(frm.doc.party_type).length) frm.set_value('party', '');
    },
    validate: function(frm) {
        if (!cstr(frm.doc.company).length) {
            frappe.exp()
                .focus(frm, 'company')
                .error(frm._expense.err, __('A valid company is required.'));
            return false;
        }
        if (!cstr(frm.doc.expense_item).length) {
            frappe.exp()
                .focus(frm, 'expense_item')
                .error(frm._expense.err, __('A valid expense item is required.'));
            return false;
        }
        if (!cstr(frm.doc.required_by).length) {
            frappe.exp()
                .focus(frm, 'required_by')
                .error(frm._expense.err, __('A valid required by date is required.'));
            return false;
        }
        if (!frm._expense.is_moderator) {
            required_by = moment(cstr(frm.doc.required_by), frappe.defaultDateFormat);
            if (cint(required_by.diff(frm._expense.min_date, 'days')) < 0) {
                frappe.exp()
                    .focus(frm, 'required_by')
                    .error(frm._expense.err, __('The required by date must be of {0} or later.',
                        [!!frm.is_new() ? __('today') : __('expense creation')]));
                return false;
            }
        }
        if (cint(frm.doc.cost) < 1) {
            frappe.exp()
                .focus(frm, 'cost')
                .error(frm._expense.err, __('A valid expense cost is required.'));
            return false;
        }
        if (cint(frm.doc.qty) < 1) {
            frappe.exp()
                .focus(frm, 'qty')
                .error(frm._expense.err, __('A valid expense quantity is required.'));
            return false;
        }
        if (cint(frm.doc.is_paid)) {
            if (!cstr(frm.doc.paid_by).length) {
                frappe.exp()
                    .focus(frm, 'paid_by')
                    .error(frm._expense.err, __('A valid paid by employee is required.'));
                return false;
            }
            if (frm._expense.has_expense_claim && !cstr(frm.doc.expense_claim).length) {
                frappe.exp()
                    .focus(frm, 'expense_claim')
                    .error(frm._expense.err, __('A valid expense claim reference is required.'));
                return false;
            }
        }
        if (cstr(frm.doc.party_type).length && !cstr(frm.doc.party).length) {
            frappe.exp()
                .focus(frm, 'party')
                .error(frm._expense.err, __('A valid party reference is required.'));
            return false;
        }
    },
    after_save: function(frm) {
        if (
            !frm._expense.is_approved && !frm._expense.is_rejected
            && frm._expense.files.length
        )
            frappe.exp().request(
                'delete_attach_files',
                {
                    doctype: cstr(frm.doctype),
                    name: cstr(frm.docname),
                    files: frm._expense.files.col(1),
                },
                function() { frm._expense.files.clear(); }
            );
        frm.events.update_doc_status(frm);
        frm.events.update_doc_form(frm);
    },
    on_submit: function(frm) {
        frm.events.update_doc_status(frm);
        frm.events.update_doc_form(frm);
    },
    update_doc_status: function(frm) {
        let status = cint(frm.doc.docstatus);
        frm._expense.is_draft = !!frm.is_new() || status === 0;
        frm._expense.is_submitted = !frm.is_new() && status === 1;
        frm._expense.is_cancelled = !frm.is_new() && status === 2;
        status = cstr(frm.doc.status).toLowerCase();
        for (let k in frm._expense.status) {
            let v = frm._expense.status[k];
            frm._expense['is_' + k] = frm._expense[v[0]] && status === k;
            frm._expense.status[k] = v[1];
            if (frm._expense['is_' + k]) {
                frm._expense.doc_status = v[1];
                frm._expense.doc_status_color = v[2];
            }
        }
    },
    update_doc_form: function(frm) {
        if (frm._expense.is_draft || frm._expense.is_pending || frm._expense.is_requested) {
            if (frm._expense.is_table_disabled) {
                frm._expense.is_table_disabled = 0;
                frappe.exp().enable_table(frm, 'attachments');
            }
        } else {
            if (!frm._expense.is_table_disabled) {
                frm._expense.is_table_disabled = 1;
                frappe.exp().disable_table(frm, 'attachments');
            }
        }
        if (!frm._expense.is_draft) frappe.exp().disable_form(
            frm, __('The expense has been {0}.', [frm._expense.doc_status]),
            frm._expense.doc_status_color
        );
    },
    add_toolbar_button: function(frm) {
        let btn = __('Create Request');
        if (frm.custom_buttons[btn]) {
            if (!frm._expense.is_pending) {
                frm.custom_buttons[btn].remove();
                delete frm.custom_buttons[btn];
            }
            return;
        }
        if (!frm._expense.is_pending) return;
        frm.add_custom_button(btn, function() {
            frappe.route_options = {
                company: cstr(frm.doc.company),
                expense: cstr(frm.docname),
            };
            frappe.set_route('Form', 'Expenses Request');
        });
        frm.change_custom_button_type(btn, null, 'success');
    },
    enqueue_update_expense_data: function(frm, clear) {
        frappe.exp().$timeout(frm._expense.expense_data_ts);
        frm._expense.expense_data_ts = null;
        frm.set_value('expense_account', '');
        frm.set_value('currency', '');
        frm._expense.cost = frm._expense.qty = null;
        !clear && (frm._expense.expense_data_ts = frappe.exp().$timeout(function() {
            frm._expense.expense_data_ts = null;
            frm.events.update_expense_data(frm);
        }, 1000));
    },
    update_expense_data: function(frm) {
        if (!frm._expense.is_draft) return;
        var company = cstr(frm.doc.company),
        item = cstr(frm.doc.expense_item);
        frappe.exp().request(
            'item_expense_data',
            {item: item, company: company},
            function(ret) {
                if (!this.$isDataObj(ret) || !this.$isStrVal(ret.account) || !this.$isStrVal(ret.currency))
                    return this.error(
                        frm._expense.err,
                        __('Unable to get the expense data for item "{0}".', [item])
                    );
                frm.set_value('expense_account', ret.account);
                frm.set_value('currency', ret.currency);
                if (flt(ret.cost) > 0) {
                    frm.set_value('cost', flt(ret.cost));
                    frm.toggle_enable('cost', 0);
                } else if (flt(ret.min_cost) > 0 || flt(ret.max_cost) > 0) {
                    frm._expense.cost = {min: flt(ret.min_cost), max: flt(ret.max_cost)};
                }
                if (flt(ret.qty) > 0) {
                    frm.set_value('qty', flt(ret.qty));
                    frm.toggle_enable('qty', 0);
                } else if (flt(ret.min_qty) > 0 || flt(ret.max_qty) > 0) {
                    frm._expense.qty = {min: flt(ret.min_qty), max: flt(ret.max_qty)};
                }
            },
            function() {
                this.error(
                    frm._expense.err,
                    __('Failed to get the expense data for item "{0}".', [item])
                );
            }
        );
    },
    update_total: function(frm) {
        if (!frm._expense.is_draft) return;
        let cost = flt(frm.doc.cost),
        qty = flt(frm.doc.qty);
        frm.set_value('total', flt(cost * qty));
    },
});


frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        if (!frm._expense.is_draft) return frappe.exp().error(
            frm._expense.err, __('Removing attachments is not allowed.')
        );
        
        let file = cstr(locals[cdt][cdn].file);
        if (file.length) frm._expense.files.add(cstr(cdn), file);
    },
    file: function(frm, cdt, cdn) {
        let file = cstr(locals[cdt][cdn].file);
        if (file.length) frm._expense.files.del(cstr(cdn));
    }
});