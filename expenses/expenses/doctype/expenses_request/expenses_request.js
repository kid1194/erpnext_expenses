/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.ui.form.on('Expenses Request', {
    setup: function(frm) {
        Expenses.init(frm);
        frm.E = {
            add_expenses: null,
            qe: new Expenses.QuickEntry('Expense', 'Expense Info', 'blue'),
        };
        
        frm.E.qe
            .set_secondary_action('Close', function() { this.hide(); })
            .disable_all_fields();
    },
    onload: function(frm) {
        if (frm.is_new() || frm.doc.status === 'Draft') {
            frm.set_query('company', {filters: {is_group: 0}});
            frm.E.add_expenses = frm.get_field('expenses').grid.add_custom_button(
                __('Add Expenses'),
                function() {
                    frm.trigger('toggle_add_expenses');
                },
                'top'
            );
            frm.E.add_expenses.removeClass('btn-default').addClass('btn-success');
            if (!frm.doc.company) frm.E.add_expenses.prop('disabled', true);
            
            E.each(
                ['expense_item', 'description', 'currency', 'total', 'is_advance'],
                function(f) {
                    frm.add_fetch('expense', f, f, 'Expenses Request Expense');
                }
            );
        }
        if (frm.is_new()) {
            let req = E.pop_cache('make-expenses-request');
            if (
                req && $.isPlainObject(req)
                && req.company && typeof req.company === 'string'
                && Array.isArray(req.expenses) && req.expenses.length
            ) {
                frm.set_value('company', req.company);
                frm.toggle_enable('company', 0);
                E.each(req.expenses, function(v) {
                    if (typeof v === 'string') frm.add_child('expenses', {expense: v});
                });
                E.refresh_field('expenses');
            }
            req = null;
        }
        if (frm.doc.status !== 'Draft') {
            frm.disable_form();
        }
    },
    company: function(frm) {
        if (!frm.doc.company) {
            E.clear_table('expenses');
        }
        if (frm.E.add_expenses) {
            frm.E.add_expenses.prop('disabled', !!frm.doc.company);
        }
    },
    toggle_add_expenses: function(frm) {
        new frappe.ui.form.MultiSelectDialog({
            doctype: 'Expense',
            target: frm,
            add_filters_group: 0,
            date_field: 'required_by',
            columns: ['name', 'expense_item', 'description', 'total', 'is_advance', 'required_by'],
            get_query: function() {
                let existing = [],
                filters = {
                    date: frm.doc.posting_date,
                    company: frm.doc.company
                };
                E.each(frm.doc.expenses, function(r) {
                    existing.push(r.expense);
                });
                if (existing.length) filters.existing = existing;
                return {
                    query: E.path('search_company_expenses'),
                    filters: filters,
                };
            },
            action: function(vals) {
                if (Array.isArray(vals) && vals.length) {
                    E.each(vals, function(v) {
                        if (typeof v === 'string')
                            frm.add_child('expenses', {expense: v});
                    });
                }
            }
        });
    },
    before_workflow_action: function(frm) {
        if (!frm.selected_workflow_action || frm.doc.reviewer) return;
        return new Promise(function(resolve, reject) {
            var action = frm.selected_workflow_action;
            frm.E.workflow = {action};
            if (action !== 'Reject') {
                resolve();
                return;
            }
            frappe.prompt(
                [
                    {
                        fieldname: 'reason',
                        fieldtype: 'Small Text',
                        label: 'Reason'
                    },
                ],
                function(v) {
                    frm.E.workflow.reason = v.reason;
                    resolve();
                },
                __('Reject Expenses Request'),
                __('Submit')
            );
        });
    },
    after_workflow_action: function(frm) {
        if (!frm.E.workflow) return;
        let w = frm.E.workflow;
        frm.E.workflow = null;
        if (w.action === 'Reject' && w.reason) {
            E.call(
                'add_request_reject_reason',
                {
                    name: frm.doc.name,
                    reason: w.reason,
                },
                function(ret) {
                    frm.reload_doc();
                    if (!ret) E.error('Unable to post the rejection reason.');
                    else frappe.show_alert({
                        indicator: 'green',
                        message: __('Expenses request rejected successfully.')
                    });
                }
            );
            return;
        }
        if (w.action === 'Make Entry' && frm.doc.status === 'Approved') {
            E.set_cache('make-expenses-entry', frm.doc.name);
            frappe.set_route('Form', 'Expenses Entry');
            return;
        }
        let action = w.action;
        if (action === 'Submit') action += 'ted';
        else if (action === 'Cancel') action += 'led';
        else if (action === 'Approve') action += 'd';
        else if (action === 'Reject') action += 'ed';
        action = action.toLowerCase();
        frappe.show_alert({
            indicator: 'green',
            message: __('Expenses request {0} successfully.', [action])
        });
        if (w.action === 'Approve' || w.action === 'Reject') {
            E.call(
                'set_request_reviewer',
                {name: frm.doc.name},
                function() {
                    frm.reload_doc();
                }
            );
        }
    },
});

frappe.ui.form.on('Expenses Request Expense', {
    show_info: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.expense) {
            E.get_doc('Expense', row.expense, function(ret) {
                if (!$.isPlainObject(ret)) {
                    E.error('Unable to get the expense data of {0}', [row.expense]);
                    return;
                }
                frm.E.qe.set_values(ret).show();
            });
        }
    },
});