/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.datetime');
frappe.provide('frappe.perm');


frappe.ui.form.on('Expense', {
    setup: function(frm) {
        frappe.exp()
            .on('ready change', function() {
                this.setup_form(frm);
            })
            .on('exp_expense_changed', function(ret) {
                if (!ret) return;
                if (
                    cstr(ret.action) === 'change'
                    && cstr(ret.expense) === cstr(frm.doc.name)
                ) {
                    let message = __('The expense data has changed. Reload to update the form.');
                    if (frm.is_dirty())
                        message = message + '<br/><strong class="text-danger">'
                            + __('Warning: All the unsaved changes will be discarded.')
                        + '</strong>';
                    
                    frappe.warn(
                        __('Expense Changed'),
                        message,
                        function() { frm.reload_doc(); },
                        __('Reload')
                    );
                } else if (
                    cstr(ret.action) === 'trash'
                    && cstr(ret.expense) === cstr(frm.doc.name)
                ) {
                    window.setTimeout(function() {
                        frappe.set_route('List', 'Expense');
                    }, 6000);
                    frappe.throw({
                        title: __('Expense Removed'),
                        message: __('The expense has been removed. You will be redirected automatically back to the List View.'),
                    });
                }
            });
        frm._expense = {
            status: {
                pending: ['is_submitted', 'Pending', 'orange'],
                requested: ['is_submitted', 'Requested', 'blue'],
                approved: ['is_submitted', 'Approved', 'green'],
                rejected: ['is_cancelled', 'Rejected', 'red'],
                cancelled: ['is_cancelled', 'Cancelled', 'red'],
            },
            is_draft: false,
            is_submitted: false,
            is_cancelled: false,
            doc_status: null,
            doc_status_color: null,
            is_pending: false,
            is_requested: false,
            is_approved: false,
            is_rejected: false,
            is_moderator: true,
            has_expense_claim: false,
            today: moment(),
            today_dt: null,
            is_toolbar_ready: false,
            cost: null,
            qty: null,
            del_files: frappe.exp().table(1),
        };
        frm._expense.today_dt = frappe.datetime.moment_to_date_obj(frm._expense.today);
    },
    onload: function(frm) {
        frm._expense.is_draft = !!frm.is_new() || cint(frm.doc.docstatus) === 0;
        frm._expense.is_submitted = !frm.is_new() && cint(frm.doc.docstatus) === 1;
        frm._expense.is_cancelled = !frm.is_new() && cint(frm.doc.docstatus) === 2;
        frm._expense.doc_status = cstr(frm.doc.status);
        for (let k in frm._expense.status) {
            let v = frm._expense.status[k];
            frm._expense['is_' + k] = frm._expense[v[0]] && frm._expense.doc_status === v[1];
            frm._expense.status[k] = v[1];
            if (frm._expense['is_' + k]) frm._expense.doc_status_color = v[2];
        }
        
        frappe.exp().request(
            'expense_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObj(ret)) return;
                frm._expense.is_moderator = !!ret.is_moderator;
                if (!frm._expense.is_moderator) {
                    frm.set_df_property('required_by', 'options', {
                        startDate: frm._expense.today_dt,
                        minDate: frm._expense.today_dt
                    });
                    let reqdby = frm.get_field('required_by');
                    if (reqdby.datepicker && reqdby.datepicker.opts) {
                        reqdby.datepicker.opts.startDate = frm._expense.today_dt;
                        reqdby.datepicker.opts.minDate = frm._expense.today_dt;
                    }
                    frm.refresh_field('required_by');
                }
                
                frm._expense.has_expense_claim = !!ret.has_expense_claim;
                if (frm._expense.has_expense_claim) {
                    frm.set_df_property('expense_claim', {
                        options: 'Expense Claim',
                        hidden: 0,
                    });
                    frm.set_query('expense_claim', function() {
                        return {
                            filters: {
                                employee: cstr(frm.doc.paid_by),
                                company: cstr(frm.doc.company),
                                is_paid: 1,
                                status: 'Paid',
                                docstatus: 1,
                            }
                        };
                    });
                }
            }
        );
        
        if (frm._expense.is_draft) {
            frm.set_query('company', {filters: {is_group: 0}});
            frm.set_query('expense_item', {query: frappe.exp().path('search_items')});
            return;
        }
        
        frm.set_intro(
            __('The expense has been {0}.', [__(frm._expense.doc_status)]),
            frm._expense.status[frm._expense.doc_status_color]
        );
        
        if (!frm._expense.is_pending && !frm._expense.is_requested) return;
        
        let attachments = frm.get_field('attachments');
        attachments.grid.update_docfield_property('file', 'read_only', 1);
        frm.set_df_property('attachments', 'cannot_delete_rows', 1);
        frm.set_df_property('attachments', 'allow_bulk_edit', 0);
        attachments.grid.df.cannot_delete_rows = 1;
    },
    refresh: function(frm) {
        if (!frm._expense.is_toolbar_ready && frm._expense.is_pending)
            frm.trigger('add_toolbar_button');
    },
    company: function(frm) {
        frm.trigger('set_account_data');
    },
    expense_item: function(frm) {
        frm.trigger('set_account_data');
    },
    set_account_data: function(frm) {
        if (!frm._expense.is_draft || !frm.is_dirty()) return;
        var company = cstr(frm.doc.company),
        item = cstr(frm.doc.expense_item);
        if (!company.length || !item.length) {
            frm.set_value('expense_account', '');
            frm.set_value('currency', '');
            frm._expense.cost = frm._expense.qty = null;
            return;
        }
        frappe.exp().request(
            'item_expense_data',
            {
                item: item,
                company: company,
            },
            function(ret) {
                if (
                    !ret || !this.$isDataObj(ret)
                    || !ret.account || !ret.currency
                ) {
                    frappe.exp().error(
                        'Expense Error',
                        'Unable to get the expense data for the item "{0}".',
                        [item]
                    );
                    return;
                }
                frm.set_value('expense_account', cstr(ret.account));
                frm.set_value('currency', cstr(ret.currency));
                if (flt(ret.cost) > 0) {
                    frm.set_value('cost', flt(ret.cost));
                    frm.toggle_enable('cost', 0);
                } else if (flt(ret.min_cost) > 0 || flt(ret.max_cost) > 0) {
                    frm._expense.cost = {
                        min: flt(ret.min_cost),
                        max: flt(ret.max_cost)
                    };
                }
                if (flt(ret.qty) > 0) {
                    frm.set_value('qty', flt(ret.qty));
                    frm.toggle_enable('qty', 0);
                } else if (flt(ret.min_qty) > 0 || flt(ret.max_qty) > 0) {
                    frm._expense.qty = {
                        min: flt(ret.min_qty),
                        max: flt(ret.max_qty)
                    };
                }
            }
        );
    },
    required_by: function(frm) {
        if (frm._expense.is_moderator) return;
        let val = cstr(frm.doc.required_by);
        if (!val.length) return;
        val = moment(val, frappe.defaultDateFormat);
        if (cint(val.diff(frm._expense.today, 'days')) < 0)
            frm.set_value('required_by', frm._expense.today.format(frappe.defaultDateFormat));
    },
    cost: function(frm) {
        if (!frm._expense.is_draft || !frm._expense.cost) return;
        let cost = flt(frm.doc.cost),
        new_cost = cost <= 0 ? 1 : cost;
        if (frm._expense.cost.min && cost < frm._expense.cost.min)
            new_cost = frm._expense.cost.min;
        else if (frm._expense.cost.max && cost > frm._expense.cost.max)
            new_cost = frm._expense.cost.max;
        if (new_cost !== cost) frm.set_value('cost', new_cost);
        frm.trigger('update_total');
    },
    qty: function(frm) {
        if (!frm._expense.is_draft || !frm._expense.qty) return;
        let qty = flt(frm.doc.qty),
        new_qty = qty <= 0 ? 1 : qty;
        if (frm._expense.qty.min && qty < frm._expense.qty.min)
            new_qty = frm._expense.qty.min;
        else if (frm._expense.qty.max && qty > frm._expense.qty.max)
            new_qty = frm._expense.qty.max;
        if (new_qty !== qty) frm.set_value('qty', new_qty);
        frm.trigger('update_total');
    },
    update_total: function(frm) {
        if (!frm._expense.is_draft) return;
        let cost = flt(frm.doc.cost),
        qty = flt(frm.doc.qty);
        frm.set_value('total', flt(cost * qty));
    },
    is_paid: function(frm) {
        let val = cint(frm.doc.is_paid);
        if (!val) {
            if (cstr(frm.doc.paid_by).length)
                frm.set_value('paid_by', '');
            if (cstr(frm.doc.expense_claim).length)
                frm.set_value('expense_claim', '');
        }
        if (frm._expense.has_expense_claim) {
            frm.toggle_reqd('expense_claim', !!val);
            frm.toggle_enable('expense_claim', !!val);
        }
    },
    paid_by: function(frm) {
        if (!cstr(frm.doc.paid_by).length && frm._expense.has_expense_claim)
            frm.set_value('expense_claim', '');
    },
    expense_claim: function(frm) {
        if (cstr(frm.doc.expense_claim).length && !frm._expense.has_expense_claim)
            frm.set_value('expense_claim', '');
    },
    party_type: function(frm) {
        if (!cstr(frm.doc.party_type).length)
            frm.set_value('party', '');
    },
    validate: function(frm) {
        if (!cstr(frm.doc.company).length) {
            frappe.exp()
                .focus(frm, 'company')
                .error('A valid expense company is required.');
            return false;
        }
        if (!cstr(frm.doc.expense_item).length) {
            frappe.exp()
                .focus(frm, 'expense_item')
                .error('A valid expense item is required.');
            return false;
        }
        let required_by = cstr(frm.doc.required_by);
        if (!required_by.length) {
            frappe.exp()
                .focus(frm, 'required_by')
                .error('A valid expense required by date is required.');
            return false;
        }
        if (
            !frm._expense.is_moderator
            && cint(moment(required_by, frappe.defaultDateFormat).diff(frm._expense.today, 'days')) < 0
        ) {
            frappe.exp()
                .focus(frm, 'required_by')
                .error('The expense required by date must be of today or later.');
            return false;
        }
        if (cint(frm.doc.cost) < 1) {
            frappe.exp()
                .focus(frm, 'cost')
                .error('A positive expense cost is required.');
            return false;
        }
        if (cint(frm.doc.qty) < 1) {
            frappe.exp()
                .focus(frm, 'qty')
                .error('A positive expense quantity is required.');
            return false;
        }
        if (cint(frm.doc.is_paid)) {
            if (!cstr(frm.doc.paid_by).length) {
                frappe.exp()
                    .focus(frm, 'paid_by')
                    .error('A valid paid by employee is required.');
                return false;
            }
            if (frm._expense.has_expense_claim && !cstr(frm.doc.expense_claim).length) {
                frappe.exp()
                    .focus(frm, 'expense_claim')
                    .error('A valid expense claim reference is required.');
                return false;
            }
        }
        if (cstr(frm.doc.party_type).length && !cstr(frm.doc.party).length) {
            frappe.exp()
                .focus(frm, 'party')
                .error('A valid expense party reference is required.');
            return false;
        }
    },
    after_save: function(frm) {
        if (frm._expense.is_draft && frm._expense.del_files.length) {
            frappe.exp().request(
                'delete_attach_files',
                {
                    doctype: cstr(frm.doctype),
                    name: cstr(frm.doc.name),
                    files: frm._expense.del_files.col(1),
                },
                function() { frm._expense.del_files.clear(); }
            );
    },
    add_toolbar_button: function(frm) {
        frm._expense.is_toolbar_ready = true;
        let btn = __('Create Request');
        if (frm.custom_buttons[btn]) return;
        frm.add_custom_button(btn, function () {
            frappe.exp().set_cache('create-expenses-request', {
                company: cstr(frm.doc.company),
                expenses: [cstr(frm.doc.name)],
            });
            frappe.set_route('Form', 'Expenses Request');
        });
        frm.change_custom_button_type(btn, null, 'success');
    }
});

frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!frm._expense.is_draft) {
            frappe.exp().error(
                'Expense Error',
                'Removing attachments is not allowed.'
            );
            return;
        }
        let file = cstr(row.file);
        if (file.length)
            frm._expense.del_files.add(cstr(row.name || cdn), file);
    },
    file: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        file = cstr(row.file);
        if (file.length) {
            frm._expense.del_files.del(cstr(row.name || cdn));
            frm._expense.del_files.del(file, 1);
        }
    },
});