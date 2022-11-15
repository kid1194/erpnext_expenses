/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Request', {
    setup: function(frm) {
        E.frm(frm);
        frm.E = {};
    },
    onload: function(frm) {
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
        if (frm.is_new() || frm.doc.status === 'Draft') {
            frm.set_query('company', {filters: {is_group: 0}});
        }
        if (!frm.E.table) frm.trigger('build_expenses_table');
    },
    refresh: function(frm) {
        frm.trigger('toggle_make_entry_button');
        frm.trigger('toggle_appeal_button');
    },
    company: function(frm) {
        if (frm.doc.expenses.length) {
            E.clear_table('expenses');
            frm.E.table && frm.E.table.clear();
        }
    },
    toggle_company_desc: function(frm) {
        let desc = frm.doc.expenses.length
            ? 'Changing the company will clear the expense table'
            : '',
        field = frm.get_field('company');
        field.set_new_description(__(desc));
        field.toggle_description(!!frm.doc.expenses.length);
    },
    validate: function(frm) {
        if (!frm.doc.expenses.length) {
            E.error('The expenses table must have at least one expense', true);
        }
    },
    build_expenses_table: function(frm) {
        frappe.dom.set_style('.expenses-attachments-table{table-layout:auto;margin-bottom:0}.expenses-attachments-table th,.expenses-attachments-table td{vertical-align:middle;white-space:nowrap;text-align:center;width:auto}.expenses-attachments-table th.fit,.expenses-attachments-table td.fit{width:1%}');
        frm.E.dialog = E.doc_dialog('Expense', 'Expense Information', 'blue');
        frm.E.dialog
            .remove_fields(['company', 'attachments'])
            .remove_properties([
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
                'translatable', 'reqd', 'bold',
            ])
            .add_field({
                fieldname: 'expense',
                fieldtype: 'Data',
                label: 'Expense',
            }, true)
            .add_field({
                fieldname: 'attachments',
                fieldtype: 'HTML',
                label: 'Attachments',
                read_only: 1,
            })
            .disable_all_fields()
            .set_secondary_action('Close', function() {
                this.hide();
            })
            .build();
        
        frm.E.table = E.datatable(frm.get_field('expenses_html').$wrapper);
        frm.E.table
            .label('Expenses')
            .column('expense', 'Expense')
            .column('expense_item', 'Expense Item')
            .column('total', 'Total')
            .column('is_advance', 'Is Advance')
            .column('required_by', 'Required By')
            .action('info', 'info-circle', 'info', function(row, idx) {
                frm.E.dialog
                    .set_values(row)
                    .show();
            })
            .layout('fluid')
            .no_data_message('No Expenses')
            .dynamic_row_height();
            
        if (frm.doc.status === 'Draft') {
            frm.E.table
                .action('remove', 'trash-o', 'danger', function(row, idx) {
                    E.remove_row('expenses', row.cdn);
                    frm.trigger('toggle_company_desc');
                })
                .column_checkbox()
                .checked_row_status()
                .on_remove(function(rows) {
                    E.each(rows, function(v) {
                        E.remove_row('expenses', v.cdn);
                    });
                    frm.trigger('toggle_company_desc');
                })
                .on_remove_all(function() {
                    E.clear_table('expenses');
                    frm.trigger('toggle_company_desc');
                })
                .on_add(function() {
                    frm.trigger('toggle_add_expenses');
                });
        } else {
            frm.E.table
                .column_number()
                .read_only();
        }
        frm.E.table.render();
        frm.E.rows = {};
        frm.E.data = {};
        if (frm.doc.expenses.length) frm.trigger('update_expenses_table');
    },
    update_expenses_table: function(frm) {
        var cdns = {};
        let names = [];
        E.each(frm.doc.expenses, function(v) {
            if (!frm.E.rows[v.expense]) {
                cdns[v.expense] = v.name;
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
                    v.expense = v.name;
                    frm.E.data[v.name] = v;
                    let row = E.clone(v);
                    row.cdn = cdns[v.name];
                    row.expense = v.name;
                    if (v.attachments.length) {
                        let attachments = [];
                        E.each(v.attachments, function(a) {
                            let name = a.file.split('/').pop();
                            attachments.push(`<tr>
                                <td scope="row" class="fit text-left">${name}</td>
                                <td class="text-justify">${a.description}</td>
                                <td class="fit">
                                    <a class="btn btn-sm btn-info" target="_blank" href="${a.file}">
                                        <span class="fa fa-link fa-fw"></span>
                                    </a>
                                </td>
                            </tr>`);
                        });
                        row.attachments = `
                            <label class="control-label">${__('Attachments')}</label>
                            <table class="table table-bordered table-condensed expenses-attachments-table">
                                <thead>
                                    <tr>
                                        <th scope="col" class="fit font-weight-bold text-left">${__('File')}</th>
                                        <th scope="col" class="font-weight-bold">${__('Description')}</th>
                                        <th scope="col" class="fit font-weight-bold">${__('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${attachments.join("\n")}
                                </tbody>
                            </table>
                        `;
                    }
                    frm.E.table.add_row(row, 1);
                    frm.E.rows[v.name] = 1;
                });
                frm.E.table.refresh();
            }
        );
    },
    toggle_add_expenses: function(frm) {
        if (frm.E.select_dialog) {
            frm.E.select_dialog.dialog.show();
            return;
        }
        frm.E.select_dialog = new frappe.ui.form.MultiSelectDialog({
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
            primary_action_label: 'Add',
            action: function(vals) {
                if (E.is_arr(vals) && vals.length) {
                    E.each(vals, function(v) {
                        if (v && E.is_str(v)) frm.add_child('expenses', {expense: v});
                    });
                    frm.trigger('toggle_company_desc');
                    frm.trigger('update_expenses_table');
                }
            }
        });
        frm.E.select_dialog.dialog.get_secondary_btn().addClass('hide');
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
                        fieldname: 'comment',
                        fieldtype: 'Small Text',
                        label: 'Comment'
                    },
                ],
                function(v) {
                    frm.E.workflow.comment = v.comment;
                    resolve();
                },
                __('Reject Request'),
                __('Submit')
            );
        });
    },
    after_workflow_action: function(frm) {
        if (!frm.E.workflow) return;
        let action = frm.E.workflow.action,
        comment = frm.E.workflow.comment;
        frm.E.workflow = null;
        if (action === 'Reject' && comment) {
            E.call(
                'add_request_rejection_comment',
                {
                    name: frm.doc.name,
                    comment: comment,
                },
                function(ret) {
                    frm.reload_doc();
                    if (!ret) {
                        E.error('Unable to post the rejection comment.');
                        return;
                    }
                    frappe.show_alert({
                        indicator: 'green',
                        message: __('Expenses request rejected successfully.')
                    });
                }
            );
            return;
        }
        frappe.show_alert({
            indicator: 'green',
            message: __(
                'Expenses request {0} successfully.',
                [{
                    submit: 'submitted',
                    cancel: 'cancelled',
                    approve: 'approved',
                    reject: 'rejected',
                }[action.toLowerCase()]]
            )
        });
        if (action === 'Approve') {
            frm.trigger('toggle_make_entry_button');
            return;
        }
        if (action === 'Reject') {
            frm.trigger('toggle_appeal_button');
            return;
        }
    },
    toggle_make_entry_button: function(frm) {
        if (
            frm.doc.docstatus !== 1
            || frm.doc.status !== 'Approved'
            || (
                frm.doc.owner !== frappe.session.user
                && !frappe.user_roles.includes('Expenses Reviewer')
                && !frappe.user_roles.includes('Accounts Manager')
            )
        ) return;
        
        let btn = __('Make Entry');
        if (frm.custom_buttons[btn]) return;
        
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            E.set_cache('make-expenses-entry', frm.doc.name);
            frappe.set_route('Form', 'Expenses Entry');
        });
        frm.change_custom_button_type(btn, null, 'success');
    },
    toggle_appeal_button: function(frm) {
        if (
            frm.doc.docstatus !== 2
            || frm.doc.status !== 'Rejected'
            || frm.doc.owner !== frappe.session.user
        ) return;
        
        let btn = __('Appeal');
        if (frm.custom_buttons[btn]) return;
        
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            if (frm.E.appeal) {
                frm.E.appeal.show();
                return;
            }
            frm.E.appeal = new frappe.ui.Dialog({
                title: __('Appeal Request'),
                indicator: 'green',
                fields: [
                    {
                        fieldname: 'expenses_html',
                        fieldtype: 'HTML',
                        label: __('Expenses'),
                        read_only: 1,
                    },
                ],
            }),
            frm.E.appeal_table = E.datatable(frm.E.appeal.get_field('expenses_html').$wrapper);
            frm.E.appeal_table
                .label('Expenses')
                .column('expense', 'Expense')
                .column('expense_item', 'Expense Item')
                .column('total', 'Total')
                .layout('fluid')
                .no_data_message('No Expenses')
                .dynamic_row_height()
                .column_checkbox()
                .checked_row_status()
                .read_only()
                .render();
            E.each(frm.doc.expenses, function(v) {
                frm.E.appeal_table.add_row(frm.E.data[v.expense], 1);
            });
            frm.E.appeal_table.refresh();
            frm.E.appeal.set_primary_action(
                __('Submit'),
                function() {
                    frm.E.appeal.hide();
                    let args = frm.E.appeal_table.get_selected_rows();
                    if (args && args.length) {
                        let expenses = [];
                        E.each(args, function(v) {
                            expenses.push(v.name);
                        });
                        E.set_cache('make-expenses-request', {
                            company: frm.doc.company,
                            expenses: expenses,
                        });
                    }
                    frm.amend_doc();
                }
            );
            frm.E.appeal.set_secondary_action_label(__('Cancel'));
            frm.E.appeal.set_secondary_action(function() {
                frm.E.appeal.hide();
            });
            frm.E.appeal.show();
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
});