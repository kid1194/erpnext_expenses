/*
*  Expenses © 2023
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
        frappe.Expenses();
        frappe.E.form(frm);
        frm._is_requested = !!cint(frm.doc.is_requested);
        frm._is_approved = !!cint(frm.doc.is_approved);
        frm._is_super = frappe.perm.has_perm(frm.doctype, 1, 'write');
        frm._expense_cost = null;
        frm._expense_qty = null;
        frm._del_files = frappe.E.tableArray();
    },
    onload: function(frm) {
        if (!frm._is_super) {
            let today = frappe.datetime.moment_to_date_obj(moment());
            frappe.E.setFieldProperty('required_by', 'options', {
                startDate: today,
                minDate: today
            });
        }
        
        frappe.E.call('with_expense_claim', function(ret) {
            if (!!ret) {
                frm._with_expense_claim = true;
                frappe.E.setFieldProperties('expense_claim', {
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
        
        if (!frm._is_requested) {
            frm.set_query('company', {filters: {is_group: 0}});
            frm.set_query('expense_item', {query: frappe.E.path('search_items')});
            return;
        }
        
        frm.disable_form();
        frm.set_intro(__('{0} has been requested', [frm.doctype]), 'green');
        
        if (frm._is_approved) return;
        
        frappe.E.setFieldProperty('attachments.file', 'read_only', 1);
        frappe.E.setFieldProperties('attachments', {
            read_only: 0,
            cannot_delete_rows: 1,
            allow_bulk_edit: 0,
        });
        frm.get_field('attachments').grid.df.cannot_delete_rows = 1;
    },
    refresh: function(frm) {
        if (!frm._is_requested && !frm.is_new()) frm.trigger('add_toolbar_button');
    },
    company: function(frm) {
        frm.trigger('set_account_data');
    },
    expense_item: function(frm) {
        frm.trigger('set_account_data');
    },
    set_account_data: function(frm) {
        if (frm._is_requested || !frm.is_dirty()) return;
        var company = cstr(frm.doc.company),
        item = cstr(frm.doc.expense_item);
        if (!company.length || !item.length) {
            frm.set_value('expense_account', '');
            frm.set_value('currency', '');
            frm._expense_cost = frm._expense_qty = null;
            return;
        }
        frappe.E.call(
            'get_item_company_account_data',
            {item, company},
            function(ret) {
                if (
                    !ret || !frappe.E.isPlainObject(ret)
                    || !ret.account || !ret.currency
                ) {
                    frappe.E.error('Unable to get the currencies of {0}', [item]);
                    return;
                }
                frm.set_value('expense_account', ret.account);
                frm.set_value('currency', ret.currency);
                if (flt(ret.cost) > 0) {
                    frm.set_value('cost', ret.cost);
                    frm.toggle_enable('cost', 0);
                } else if (flt(ret.min_cost) > 0 || flt(ret.max_cost) > 0) {
                    frm._expense_cost = {min: flt(ret.min_cost), max: flt(ret.max_cost)};
                }
                if (flt(ret.qty) > 0) {
                    frm.set_value('qty', ret.qty);
                    frm.toggle_enable('qty', 0);
                } else if (flt(ret.min_qty) > 0 || flt(ret.max_qty) > 0) {
                    frm._expense_qty = {min: flt(ret.min_qty), max: flt(ret.max_qty)};
                }
            }
        );
    },
    required_by: function(frm) {
        if (frm._is_super || !cstr(frm.doc.required_by).length) return;
        let date = moment(),
        format = frappe.defaultDateFormat;
        if (cint(moment(frm.doc.required_by, format).diff(date, 'days')) < 0)
            frm.set_value('required_by', date.format(format));
    },
    cost: function(frm) {
        if (frm._is_requested) return;
        let cost = flt(frm.doc.cost),
        limit = frm._expense_cost,
        new_cost = cost <= 0 ? 1 : cost;
        if (limit) {
            if (limit.min && cost < limit.min) new_cost = limit.min;
            else if (limit.max && cost > limit.max) new_cost = limit.max;
        }
        if (new_cost !== cost) frm.set_value('cost', new_cost);
        else frm.trigger('update_total');
    },
    qty: function(frm) {
        if (frm._is_requested) return;
        let qty = flt(frm.doc.qty),
        limit = frm._expense_qty,
        new_qty = qty <= 0 ? 1 : qty;
        if (limit) {
            if (limit.min && qty < limit.min) new_qty = limit.min;
            else if (limit.max && qty > limit.max) new_qty = limit.max;
        }
        if (new_qty !== qty) frm.set_value('qty', new_qty);
        else frm.trigger('update_total');
    },
    update_total: function(frm) {
        if (frm._is_requested) return;
        let cost = flt(frm.doc.cost),
        qty = flt(frm.doc.qty);
        frm.set_value('total', flt(cost * qty));
    },
    is_paid: function(frm) {
        if (!cint(frm.doc.is_paid)) {
            frm.set_value('paid_by', '');
            frm._with_expense_claim && frm.set_value('expense_claim', '');
        }
        if (frm._with_expense_claim) {
            frm.toggle_reqd('expense_claim', !!cint(frm.doc.is_paid));
            frm.toggle_enable('expense_claim', !!cint(frm.doc.is_paid));
        }
    },
    paid_by: function(frm) {
        if (!cstr(frm.doc.paid_by).length && frm._with_expense_claim)
            frm.set_value('expense_claim', '');
    },
    party_type: function(frm) {
        if (!cstr(frm.doc.party_type).length) frm.set_value('party', '');
    },
    validate: function(frm) {
        if (
            !frm._is_super
            && cstr(frm.doc.required_by).length
            && cint(moment(frm.doc.required_by, frappe.defaultDateFormat)
                .diff(moment(), 'days')) < 0
        ) frappe.E.error('{0} required by minimum date is today', [frm.doctype], true);
    },
    after_save: function(frm) {
        if (!frm._is_requested && frm._del_files.length) {
            frappe.E.call(
                'delete_attach_files',
                {
                    doctype: frm.doctype,
                    name: frm.doc.name,
                    files: frm._del_files.col(0),
                },
                function() { frm._del_files.clear(); }
            );
        }
    },
    add_toolbar_button: function(frm) {
        let req_btn = __('Make Request');
        if (!frm.custom_buttons[req_btn]) {
            frm.clear_custom_buttons();
            frm.add_custom_button(req_btn, function () {
                frappe.E.setCache('make-expenses-request', {
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
        if (frm._is_requested) {
            frappe.E.error('Removing attachments is not allowed', true);
            return;
        }
        if (cstr(row.file).length)
            frm._del_files.add(row.name || cdn, row.file, 0);
    },
    file: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (cstr(row.file).length)
            frm._del_files.del(row.name || cdn);
    },
});