/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Request', {
    setup: function(frm) {
        frappe.E();
        E.form(frm);
        frm.E = {
            company: frm.doc.company,
            expenses_ready: 0,
            data: {},
            expenses_virtual_fields: [
                'expense_item', 'total', 'is_advance', 'required_by'
            ],
            set_expense_data: function(cdn) {
                let row = locals['Expenses Request Details'][cdn],
                data = frm.E.data[row.expense];
                E.each(
                    frm.E.expenses_virtual_fields,
                    function(k) { row[k] = data[k]; }
                );
                if (data._attachments) {
                    E.getRowField('expenses', cdn, 'attachments').html(data.attachments);
                }
                frm.E.update_row_button(cdn);
            },
            update_expenses_data: function() {
                var cdns = {};
                let names = [],
                is_changed = 0;
                E.each(frm.doc.expenses, function(v) {
                    if (v.total.length) return;
                    is_changed = 1;
                    if (frm.E.data[v.expense]) {
                        frm.E.set_expense_data(v.name);
                        return;
                    }
                    cdns[v.expense] = v.name;
                    names.push(v.expense);
                });
                if (!names.length) {
                    if (is_changed) E.refreshField('expenses');
                    return;
                }
                E.call(
                    'get_expenses_data',
                    {expenses: names},
                    function(ret) {
                        E.each(ret, function(v) {
                            v.total = format_currency(v.total, v.currency);
                            v._is_advance = v.is_advance;
                            v.is_advance = __(cint(v.is_advance) ? 'Yes' : 'No');
                            
                            if (v.attachments.length) {
                                v._attachments = E.clone(v.attachments);
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
                                v.attachments = `
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
                            
                            frm.E.data[v.name] = v;
                            frm.E.set_expense_data(cdns[v.name]);
                        });
                        E.refreshField('expenses');
                    }
                );
            },
            update_row_button: function(cdn) {
                let row = E.getRow('expenses', cdn);
                if (
                    row.open_form_button
                    && row.open_form_button.children
                ) {
                    let children = row.open_form_button.children();
                    $(children[0]).html(frappe.utils.icon('solid-info', 'xs'));
                    $(children[1]).html(' ' + __("Info") + ' ');
                }
            },
        };
    },
    onload: function(frm) {
        if (frm.is_new()) {
            let req = E.popCache('make-expenses-request');
            if (
                req && E.isPlainObject(req)
                && req.company && E.isString(req.company)
                && E.isArray(req.expenses) && req.expenses.length
            ) {
                frm.set_value('company', req.company);
                E.each(req.expenses, function(v) {
                    if (v && E.isString(v)) frm.add_child('expenses', {expense: v});
                });
                frm.E.update_expenses_data();
            }
            req = null;
        }
        if (frm.is_new() || frm.doc.status === 'Draft') {
            frm.set_query('company', {filters: {is_group: 0}});
        }
    },
    refresh: function(frm) {
        if (!frm.E.expenses_ready) {
            frm.E.expenses_ready = 1;
            let wrapper = frm.get_field('expenses').grid.wrapper;
            if (frm.doc.status === 'Draft') {
                wrapper.find('.grid-add-multiple-rows').addClass('hidden');
                wrapper.find('.grid-download').addClass('hidden');
                wrapper.find('.grid-upload').addClass('hidden');
                wrapper
                    .find('.grid-add-row')
                    .off('click')
                    .on('click', function() {
                        frm.trigger('toggle_add_expenses');
                    });
            } else {
                wrapper.find('.grid-footer').toggle(false);
                wrapper.find('.grid-row-check').toggle(false);
            }
        }
        
        frm.trigger('toggle_make_entry_button');
        frm.trigger('toggle_appeal_button');
    },
    company: function(frm) {
        let company = frm.doc.company;
        if (company !== frm.E.company) {
            frm.E.company = company;
            if (frm.doc.expenses.length) E.clearTable('expenses');
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
            primary_action_label: __('Add'),
            action: function(vals) {
                if (E.isArray(vals) && vals.length) {
                    E.each(vals, function(v) {
                        if (v && E.isString(v)) frm.add_child('expenses', {expense: v});
                    });
                    frm.E.update_expenses_data();
                    frm.trigger('toggle_company_desc');
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
                        message: __('{0} rejected successfully.', [frm.doctype])
                    });
                }
            );
            return;
        }
        frappe.show_alert({
            indicator: 'green',
            message: __(
                '{0} {1} successfully.',
                [{
                    submit: 'submitted',
                    cancel: 'cancelled',
                    approve: 'approved',
                    reject: 'rejected',
                }[frm.doctype, action.toLowerCase()]]
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
            cint(frm.doc.docstatus) !== 1
            || frm.doc.status !== 'Approved'
            || (
                frm.doc.owner !== frappe.session.user
                && !frappe.perm.has_perm(frm.doctype, 1, 'write')
            )
        ) return;
        
        let btn = __('Make Entry');
        if (frm.custom_buttons[btn]) return;
        
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            E.setCache('make-expenses-entry', frm.doc.name);
            frappe.set_route('Form', 'Expenses Entry');
        });
        frm.change_custom_button_type(btn, null, 'success');
    },
    toggle_appeal_button: function(frm) {
        if (
            cint(frm.doc.docstatus) !== 2
            || frm.doc.status !== 'Rejected'
            || frm.doc.owner !== frappe.session.user
        ) return;
        
        let btn = __('Appeal');
        if (frm.custom_buttons[btn]) return;
        
        if (!frm.E.appeal) {
            frm.E.appeal = E.formDialog(__('Appeal Request'), 'blue');
            frm.E.appeal
                .addField({
                    fieldname: 'appeal_expenses',
                    fieldtype: 'Table',
                    label: __('Expenses'),
                    read_only: 1,
                    fields: [
                        {
                            fieldname: 'expense',
                            fieldtype: 'Data',
                            label: 'Expense',
                            read_only: 1,
                        },
                        {
                            fieldname: 'expense_item',
                            fieldtype: 'Data',
                            label: 'Expense Item',
                            read_only: 1,
                        },
                        {
                            fieldname: 'total',
                            fieldtype: 'Data',
                            label: 'Total',
                            read_only: 1,
                        }
                    ],
                })
                .setPrimaryAction(
                    __('Submit'),
                    function() {
                        this.hide();
                        let args = this.getField('appeal_expenses').grid.get_selected_children();
                        if (args && args.length) {
                            let expenses = args.map(function(v) { return v.expense; });
                            E.setCache('make-expenses-request', {
                                company: frm.doc.company,
                                expenses: expenses,
                            });
                        }
                        frm.amend_doc();
                    }
                )
                .setSecondaryAction(
                    __('Cancel'),
                    function() { this.hide(); }
                )
                .build();
        
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            frm.E.appeal
                .setValue(
                    'appeal_expenses',
                    frm.doc.expenses.map(function(v) {
                        return {
                            expense: v.expense,
                            expense_item: v.expense_item,
                            total: v.total,
                        };
                    })
                )
                .show();
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
});