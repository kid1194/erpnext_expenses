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
        frappe.E();
        E.form(frm);
        frm.E = {
            is_requested: !!cint(frm.doc.is_requested),
            is_approved: !!cint(frm.doc.is_approved),
            is_super: frappe.perm.has_perm(frm.doctype, 1, 'write'),
            expense_cost: null,
            expense_qty: null,
            del_files: E.uniqueArray(),
        };
    },
    onload: function(frm) {
        if (!frm.E.is_super) {
            let today = frappe.datetime.moment_to_date_obj(moment());
            E.setFieldProperty('required_by', 'options', {
                startDate: today,
                minDate: today
            });
        }
        
        E.call('with_expense_claim', function(ret) {
            if (!!ret) {
                frm.E.with_expense_claim = true;
                E.setFieldProperties('expense_claim', {
                    options: 'Expense Claim',
                    hidden: 0,
                });
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
        });
        
        if (!frm.E.is_requested) {
            frm.set_query('company', {filters: {is_group: 0}});
            frm.set_query('expense_item', {query: E.path('search_items')});
            return;
        }
        
        frm.disable_form();
        frm.set_intro(__('{0} has been requested', [frm.doctype]), 'green');
        
        if (frm.E.is_approved) return;
        
        E.setFieldProperty('attachments.file', 'read_only', 1);
        E.setFieldProperties('attachments', {
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
        E.call(
            'get_item_company_account_data',
            {item, company},
            function(ret) {
                if (
                    !ret || !E.isPlainObject(ret)
                    || !ret.account || !ret.currency
                ) {
                    E.error('Unable to get the currencies of {0}', [item]);
                    return;
                }
                frm.set_value('expense_account', ret.account);
                frm.set_value('currency', ret.currency);
                if (flt(ret.cost) > 0) {
                    frm.set_value('cost', ret.cost);
                    frm.toggle_enable('cost', 0);
                } else if (flt(ret.min_cost) > 0 || flt(ret.max_cost) > 0) {
                    frm.E.expense_cost = {min: flt(ret.min_cost), max: flt(ret.max_cost)};
                }
                if (flt(ret.qty) > 0) {
                    frm.set_value('qty', ret.qty);
                    frm.toggle_enable('qty', 0);
                } else if (flt(ret.min_qty) > 0 || flt(ret.max_qty) > 0) {
                    frm.E.expense_qty = {min: flt(ret.min_qty), max: flt(ret.max_qty)};
                }
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
        limit = frm.E.expense_cost,
        new_cost = cost <= 0 ? 1 : cost;
        if (limit) {
            if (limit.min && cost < limit.min) new_cost = limit.min;
            else if (limit.max && cost > limit.max) new_cost = limit.max;
        }
        if (new_cost !== cost) frm.set_value('cost', new_cost);
        else frm.trigger('update_total');
    },
    qty: function(frm) {
        if (frm.E.is_requested) return;
        let qty = flt(frm.doc.qty),
        limit = frm.E.expense_qty,
        new_qty = qty <= 0 ? 1 : qty;
        if (limit) {
            if (limit.min && qty < limit.min) new_qty = limit.min;
            else if (limit.max && qty > limit.max) new_qty = limit.max;
        }
        if (new_qty !== qty) frm.set_value('qty', new_qty);
        else frm.trigger('update_total');
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
            frm.E.with_expense_claim && frm.set_value('expense_claim', '');
        }
        if (frm.E.with_expense_claim) {
            frm.toggle_reqd('expense_claim', !!cint(frm.doc.is_paid));
            frm.toggle_enable('expense_claim', !!cint(frm.doc.is_paid));
        }
    },
    paid_by: function(frm) {
        if (!frm.doc.paid_by && frm.E.with_expense_claim) {
            frm.set_value('expense_claim', '');
        }
    },
    party_type: function(frm) {
        if (!frm.doc.party_type) frm.set_value('party', '');
    },
    validate: function(frm) {
        if (!frm.E.is_super) {
            if (cint(moment(frm.doc.required_by, frappe.defaultDateFormat)
                .diff(moment(), 'days')) < 0) {
                E.error('{0} required by minimum date is today', [frm.doctype], true);
            }
        }
    },
    after_save: function(frm) {
        if (!frm.E.is_requested && frm.E.del_files.length) {
            E.call(
                'delete_attach_files',
                {
                    doctype: frm.doctype,
                    name: frm.doc.name,
                    files: frm.E.del_files.all,
                },
                function() { frm.E.del_files.clear(); }
            );
        }
    },
    add_toolbar_button: function(frm) {
        let req_btn = __('Make Request');
        if (!frm.custom_buttons[req_btn]) {
            frm.clear_custom_buttons();
            frm.add_custom_button(req_btn, function () {
                E.setCache('make-expenses-request', {
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
        if (row.file) frm.E.del_files.push(row.file);
    },
    file: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.file) frm.E.del_files.del(row.file);
    },
});