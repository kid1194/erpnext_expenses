/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.ui.form.on('Expenses Request', {
    setup: function(frm) {
        E.frm(frm);
        frm.E = {
            add_expenses: null,
        };
    },
    onload: function(frm) {
        if (frm.is_new() || frm.doc.status === 'Draft') {
            frm.set_query('company', {filters: {is_group: 0}});
        }
        E.each(
            'expense_item currency total paid_by is_advance party required_by'.split(' '),
            function(f) { frm.add_fetch('expense', f, f, 'Expenses Request Expense'); }
        );
        if (frm.doc.status !== 'Draft') {
            frm.disable_form();
            E.set_df_props('expenses', {
                read_only: 1,
                in_place_edit: 1,
                cannot_add_rows: 1,
                cannot_delete_rows: 1,
            });
        } else {
            E.set_df_props('expenses', {
                in_place_edit: 1,
                cannot_add_rows: 1,
            });
        }
        if (frm.is_new()) {
            let req = E.pop_cache('make-expenses-request');
            if (
                req && E.is_obj(req)
                && req.company && E.is_str(req.company)
                && E.is_arr(req.expenses) && req.expenses.length
            ) {
                frm.set_value('company', req.company);
                frm.toggle_enable('company', 0);
                frm.toggle_enable('expenses', 0);
                E.each(req.expenses, function(v) {
                    if (v && E.is_str(v)) frm.add_child('expenses', {expense: v});
                });
                E.refresh_df('expenses');
            }
            req = null;
        }
    },
    refresh: function(frm) {
        if (frm.doc.status !== 'Draft') return;
        if (!frm.E.add_expenses) {
            let grid = frm.get_field('expenses').grid;
            grid.wrapper.find('.grid-add-row, .grid-add-multiple-rows')
                .addClass('hidden').prop('disabled', true).toggle(false);
            grid.wrapper.find('.grid-footer').toggle(true);
            frm.E.add_expenses = grid.add_custom_button(
                __('Add Expenses'),
                function() { frm.trigger('toggle_add_expenses'); }
            );
            if (!frm.doc.company) frm.E.add_expenses.prop('disabled', true);
        }
    },
    company: function(frm) {
        if (!frm.doc.company) E.clear_table('expenses');
        frm.E.add_expenses && frm.E.add_expenses.prop('disabled', !!frm.doc.company);
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
                if (E.is_arr(vals) && vals.length) {
                    E.each(vals, function(v) {
                        if (v && E.is_str(v)) frm.add_child('expenses', {expense: v});
                    });
                    E.refresh_df('expenses');
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
                __('Reject Request'),
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
                function() { frm.reload_doc(); }
            );
        }
    },
});