/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.model');
frappe.provide('frappe.datetime');
frappe.provide('frappe.perm');
frappe.provide('frappe.session');


frappe.ui.form.on('Expense', {
    setup: function(frm) {
        E.frm(frm);
        frm.E = {
            is_requested: !!cint(frm.doc.is_requested),
            is_approved: !!cint(frm.doc.is_approved),
            is_super: frappe.perm.has_perm(frm.doctype, 1, 'create'),
            expense_data: {},
            expense_cost: null,
            expense_qty: null,
            del_files: [],
        };
        
        if (!frm.E.is_super) {
            let today = frappe.datetime.moment_to_date_obj(moment());
            E.df_property('required_by', 'options', {
                startDate: today,
                minDate: today
            });
        }
        
        E.call('with_expense_claim', function(ret) {
            if (!!ret) {
                frm.E.with_expense_claim = true;
                E.df_properties('expense_claim', {
                    options: 'Expense Claim',
                    hidden: 0,
                });
            }
        });
    },
    onload: function(frm) {
        if (!frm.E.is_requested) {
            frm.set_query('company', {filters: {is_group: 0}});
            frm.set_query('expense_item', {query: E.path('search_items')});
            if (frm.E.with_expense_claim) {
                frm.set_query('expense_claim', function() {
                    return {
                        filters: {
                            employee: frm.doc.paid_by,
                            company: frm.doc.company,
                            is_paid: 1,
                            status: 'Paid',
                            docstatus: 1,
                        }
                    };
                });
            }
            return;
        }
        
        frm.disable_form();
        frm.set_intro(
            __('Expense cannot be modified after being requested'),
            'red'
        );
        
        if (frm.E.is_approved) return;
        
        E.df_properties('attachments', {
            read_only: 0,
            cannot_delete_rows: 1,
            allow_bulk_edit: 0,
        });
        frm.get_field('attachments').grid.df.cannot_delete_rows = 1;
    },
    refresh: function(frm) {
        if (!frm.E.is_requested && !frm.is_new()) frm.trigger('add_toolbar_button');
    },
    company: function(frm) {
        frm.trigger('set_account_data');
    },
    expense_item: function(frm) {
        frm.trigger('set_account_data');
    },
    set_account_data: function(frm) {
        if (frm.E.is_requested || !frm.is_dirty()) return;
        var company = frm.doc.company,
        item = frm.doc.expense_item;
        if (!company || !item) {
            frm.set_value('expense_account', '');
            frm.set_value('currency', '');
            frm.E.expense_cost = frm.E.expense_qty = null;
            return;
        }
        function resolve(v) {
            frm.set_value('expense_account', v.account);
            frm.set_value('currency', v.currency);
            if (flt(v.cost) > 0) {
                frm.set_value('cost', v.cost);
                frm.toggle_enable('cost', 0);
            } else if (flt(v.min_cost) > 0 || flt(v.max_cost) > 0) {
                frm.E.expense_cost = {min: flt(v.min_cost), max: flt(v.max_cost)};
            }
            if (flt(v.qty) > 0) {
                frm.set_value('qty', v.qty);
                frm.toggle_enable('qty', 0);
            } else if (flt(v.min_qty) > 0 || flt(v.max_qty) > 0) {
                frm.E.expense_qty = {min: flt(v.min_qty), max: flt(v.max_qty)};
            }
        }
        var ckey = [company, item].join('-');
        if (frm.E.expense_data[ckey]) {
            resolve(frm.E.expense_data[ckey]);
            return;
        }
        E.call(
            'get_item_company_account_data',
            {item, company},
            function(ret) {
                if (
                    !ret || !E.is_obj(ret)
                    || !ret.account || !ret.currency
                ) {
                    E.error('Unable to get the currencies of {0}', [item]);
                    return;
                }
                frm.E.expense_data[ckey] = ret;
                resolve(ret);
            }
        );
    },
    required_by: function(frm) {
        if (frm.E.is_super || !frm.doc.required_by) return;
        let date = moment(),
        format = frappe.defaultDateFormat;
        if (cint(moment(frm.doc.required_by, format).diff(date, 'days')) < 0)
            frm.set_value('required_by', date.format(format));
    },
    cost: function(frm) {
        if (frm.E.is_requested) return;
        let cost = flt(frm.doc.cost),
        limit = frm.E.expense_cost;
        if (cost <= 0) {
            frm.set_value('cost', 1);
        } else if (limit && limit.min && cost < limit.min) {
            frm.set_value('cost', limit.min);
        } else if (limit && limit.max && cost > limit.max) {
            frm.set_value('cost', limit.max);
        } else {
            frm.trigger('update_total');
        }
    },
    qty: function(frm) {
        if (frm.E.is_requested) return;
        let qty = flt(frm.doc.qty),
        limit = frm.E.expense_qty;
        if (qty <= 0) {
            frm.set_value('qty', 1);
        } else if (limit && limit.min && qty < limit.min) {
            frm.set_value('qty', limit.min);
        } else if (limit && limit.max && qty > limit.max) {
            frm.set_value('qty', limit.max);
        } else {
            frm.trigger('update_total');
        }
    },
    update_total: function(frm) {
        if (frm.E.is_requested) return;
        let cost = flt(frm.doc.cost),
        qty = flt(frm.doc.qty);
        frm.set_value('total', flt(cost * qty));
    },
    is_paid: function(frm) {
        if (!cint(frm.doc.is_paid)) {
            frm.set_value('paid_by', '');
            frm.set_value('expense_claim', '');
        }
    },
    paid_by: function(frm) {
        if (!frm.doc.paid_by) frm.set_value('expense_claim', '');
    },
    party_type: function(frm) {
        if (!frm.doc.party_type) frm.set_value('party', '');
    },
    validate: function(frm) {
        if (!frm.E.is_super) {
            if (cint(moment(frm.doc.required_by, frappe.defaultDateFormat)
                .diff(moment(), 'days')) < 0) {
                E.error('The minimum date for expense required by is today', true);
            }
        }
    },
    after_save: function(frm) {
        if (!frm.E.is_requested && frm.E.del_files.length) {
            E.call(
                'delete_attach_files',
                {files: frm.E.del_files},
                function(ret) {
                    frm.E.del_files.clear();
                }
            );
        }
    },
    add_toolbar_button: function(frm) {
        let req_btn = __('Make Request');
        if (!frm.custom_buttons[req_btn]) {
            frm.clear_custom_buttons();
            frm.add_custom_button(req_btn, function () {
                E.set_cache('make-expenses-request', {
                    company: frm.doc.company,
                    expenses: [frm.doc.name],
                });
                frappe.set_route('Form', 'Expenses Request');
            });
            frm.change_custom_button_type(req_btn, null, 'success');
        }
    }
});

frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (frm.E.is_requested) {
            E.error('Removing attachments is not allowed', true);
            return;
        }
        if (row.file && frm.E.del_files.indexOf(row.file) < 0)
            frm.E.del_files.push(row.file);
    },
    file: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.file) {
            let idx = frm.E.del_files.indexOf(row.file);
            if (idx >= 0) frm.E.del_files.splice(idx, 1);
        }
    },
});