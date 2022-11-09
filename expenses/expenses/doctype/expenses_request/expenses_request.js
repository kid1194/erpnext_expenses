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
            et: {},
            add_expenses: null,
        };
    },
    onload: function(frm) {
        if (frm.is_new() || frm.doc.status === 'Draft') {
            frm.set_query('company', {filters: {is_group: 0}});
        }
        if (frm.is_new()) {
            let req = E.pop_cache('make-expenses-request');
            if (
                req && E.is_obj(req)
                && req.company && E.is_str(req.company)
                && E.is_arr(req.expenses) && req.expenses.length
            ) {
                frm.set_value('company', req.company);
                E.each(req.expenses, function(v) {
                    if (v && E.is_str(v)) frm.add_child('expenses', {expense: v});
                });
            }
            req = null;
        }
    },
    refresh: function(frm) {
        if (!frm.E.et.table) frm.trigger('build_expenses_table');
    },
    company: function(frm) {
        if (!frm.doc.company) {
            E.clear_table('expenses');
            frm.E.et.table && frm.E.et.table.clear();
        }
    },
    validate: function(frm) {
        if (!frm.doc.expenses.length) {
            E.error('The expenses table must have at least one expense', true);
        }
    },
    build_expenses_table: function(frm) {
        frm.E.et.dialog = E.doc_dialog('Expense', 'Expense Information', 'blue');
        frm.E.et.dialog
            .prepend_field({
                fieldname: 'expense',
                fieldtype: 'Data',
                label: 'Expense',
            })
            .remove_fields(['company', 'attachments'])
            .remove_properties([
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
                'translatable', 'reqd', 'bold',
            ])
            .disable_all_fields()
            .set_secondary_action('Close', function() {
                this.hide();
            });
        
        frm.E.et.table = E.datatable(frm.get_field('expenses_html').$wrapper);
        frm.E.et.table
            .label('Expenses')
            .column('expense', 'Expense')
            .column('expense_item', 'Expense Item')
            .column('total', 'Total')
            .column('is_advance', 'Is Advance')
            .column('required_by', 'Required By')
            .action('info', 'info-circle', 'info', function(row, idx) {
                frm.E.et.dialog
                    .set_values(row)
                    .show();
            })
            .layout('fluid')
            .no_data_message('No Expenses')
            .dynamic_row_height();
            
        if (frm.doc.status === 'Draft') {
            frm.E.et.table
                .action('remove', 'trash-o', 'danger', function(row, idx) {
                    E.remove_row('expenses', row.cdn);
                })
                .column_checkbox()
                .checked_row_status()
                .on_remove(function(rows) {
                    E.each(rows, function(v) {
                        E.remove_row('expenses', v.cdn);
                    });
                })
                .on_remove_all(function() {
                    E.clear_table('expenses');
                })
                .on_add(function() {
                    frm.trigger('toggle_add_expenses');
                });
        } else {
            frm.E.et.table
                .column_number()
                .read_only();
        }
        frm.E.et.table.render();
        frm.E.et.rows = {};
        if (!frm.is_new()) frm.trigger('update_expenses_table');
    },
    update_expenses_table: function(frm) {
        var expenses = {};
        let names = [];
        E.each(frm.doc.expenses, function(v) {
            if (!frm.E.et.rows[v.expense]) {
                expenses[v.expense] = v.name;
                names.push(v.expense);
            }
        });
        if (!names.length) return;
        E.call(
            'get_expenses_data',
            {
                expenses: names,
            },
            function(ret) {
                E.each(ret, function(v) {
                    let row = E.clone(v);
                    row.cdn = expenses[v.name];
                    row.expense = v.name;
                    frm.E.et.table.add_row(row, 1);
                    frm.E.et.rows[v.name] = 1;
                });
                frm.E.et.table.refresh();
            }
        );
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
                    frm.trigger('update_expenses_table');
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
        if (w.action === 'Make Entry') {
            if (frm.doc.status === 'Approved') {
                E.set_cache('make-expenses-entry', frm.doc.name);
                frappe.set_route('Form', 'Expenses Entry');
            }
            return;
        }
        let action = {
            submit: ['submitted'],
            cancel: ['cancelled'],
            approve: ['approved', 1],
            reject: ['rejected', 1],
        }[w.action.toLowerCase()];
        frappe.show_alert({
            indicator: 'green',
            message: __('Expenses request {0} successfully.', [action[0]])
        });
        if (action[1]) {
            E.call(
                'set_request_reviewer',
                {name: frm.doc.name},
                function() { frm.reload_doc(); }
            );
        }
    },
});