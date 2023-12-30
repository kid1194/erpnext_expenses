/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Request', {
    setup: function(frm) {
        frappe.exp()
            .on('ready change', function() {
                this.setup_form(frm);
            })
            .on('exp_expenses_request_changed', function(ret) {
                if (!ret) return;
                if (
                    cstr(ret.action) === 'change'
                    && cstr(ret.request) === cstr(frm.doc.name)
                ) {
                    let message = __('The expenses request data has changed. Reload to update the form.');
                    if (frm.is_dirty())
                        message = message + '<br/><strong class="text-danger">'
                            + __('Warning: All the unsaved changes will be discarded.')
                        + '</strong>';
                    
                    frappe.warn(
                        __('Expenses Request Changed'),
                        message,
                        function() { frm.reload_doc(); },
                        __('Reload')
                    );
                } else if (
                    cstr(ret.action) === 'trash'
                    && cstr(ret.request) === cstr(frm.doc.name)
                ) {
                    window.setTimeout(function() {
                        frappe.set_route('List', 'Expenses Request');
                    }, 6000);
                    frappe.throw({
                        title: __('Expenses Request Removed'),
                        message: __('The expenses request has been removed. You will be redirected automatically back to the List View.'),
                    });
                }
            });
        frm._request = {
            is_ready: false,
            is_moderator: false,
            is_reviewer: false,
            toolbar_ready: false,
            company: null,
            data: {},
            details_dt: 'Expenses Request Details',
            virtual_fields: [
                'expense_item', 'total', 'is_advance', 'required_by'
            ],
            set_expense_data: function(cdn) {
                let row = locals[frm._request.details_dt][cdn],
                data = frm._request.data[cstr(row.expense)],
                changed = 0;
                frm._request.virtual_fields.forEach(function(k) {
                    if (cstr(row[k]) !== cstr(data[k])) {
                        row[k] = cstr(data[k]);
                        changed = 1;
                    }
                });
                if (data._attachments) {
                    let field = frappe.exp().get_field(frm, 'expenses', cdn, 'attachments');
                    if (!field.$wrapper.html().length) {
                        field.html(data.attachments);
                        changed = 1;
                    }
                }
                frm._request.update_row_button(cdn);
                return changed;
            },
            update_row_button: function(cdn) {
                let row = frappe.exp().get_row(frm, 'expenses', cdn);
                if (row.open_form_button && row.open_form_button.children) {
                    let children = row.open_form_button.children();
                    $(children[0]).html(frappe.utils.icon('solid-info', 'xs'));
                    $(children[1]).html(' ' + __("Info") + ' ');
                }
            },
        };
    },
    onload: function(frm) {
        frappe.exp().request(
            'request_form_setup',
            null,
            function(ret) {
                if (!this.$isDataObj(ret)) return;
                frm._request.is_moderator = !!ret.is_moderator;
                frm._request.is_reviewer = !!ret.is_reviewer;
                if (frm._request.is_moderator) {
                    frm.set_df_property('posting_date', 'bold', 1);
                    frm.toggle_reqd('posting_date', 1);
                    frm.toggle_enable('posting_date', 1);
                } else if (!cstr(frm.doc.posting_date).length) {
                    frm.set_value(
                        'posting_date',
                        moment().format(frappe.defaultDateFormat)
                    );
                }
            }
        );
        frm._request.company = cstr(frm.doc.company);
        if (!!frm.is_new()) {
            let req = frappe.exp().pop_cache('create-expenses-request');
            if (
                frappe.exp().$isDataObj(req)
                && frappe.exp().$isStr(req.company) && req.company.length
                && frappe.exp().$isArr(req.expenses) && req.expenses.length
            ) {
                frm.set_value('company', cstr(req.company));
                req.expenses.forEach(function(v) {
                    if (cstr(v).length) frm.add_child('expenses', {expense: cstr(v)});
                });
                frm.trigger('update_expenses_data');
            }
            req = null;
            
            let status = cstr(frm.doc.status);
            if (!status.length || status === 'Draft')
                frm.set_query('company', {filters: {is_group: 0}});
        }
    },
    refresh: function(frm) {
        frm.trigger('setup_toolbar');
        if (frm._request.is_ready) return;
        frm._request.is_ready = true;
        let status = cstr(frm.doc.status),
        wrapper = frm.get_field('expenses').grid.wrapper;
        
        if (!status.length || status === 'Draft') {
            wrapper.find('.grid-add-multiple-rows').addClass('hide hidden');
            wrapper.find('.grid-download').addClass('hide hidden');
            wrapper.find('.grid-upload').addClass('hide hidden');
            wrapper.find('.grid-add-row')
                .off('click')
                .on('click', function() {
                    frm.trigger('toggle_add_expenses');
                });
        } else {
            frm.trigger('destroy_add_expenses');
            wrapper.find('.grid-add-multiple-rows').removeClass('hide hidden');
            wrapper.find('.grid-download').removeClass('hide hidden');
            wrapper.find('.grid-upload').removeClass('hide hidden');
            wrapper.find('.grid-add-row').off('click');
            wrapper.find('.grid-footer').toggle(false);
            wrapper.find('.grid-row-check').toggle(false);
        }
    },
    company: function(frm) {
        let company = cstr(frm.doc.company);
        if (company !== frm._request.company) {
            frm._request.company = company;
            if ((frm.doc.expenses || []).length) {
                frm.set_value('expenses', []);
                frm.refresh_field('expenses');
            }
        }
    },
    posting_date: function(frm) {
        let val = cstr(frm.doc.posting_date),
        today = moment();
        if (!val.length) val = null;
        else val = moment(val, frappe.defaultDateFormat);
        if (
            !vall || (
                !frm._request.is_moderator
                && cint(val.diff(today, 'days')) < 0
            )
        )
            frm.set_value(
                'posting_date',
                today.format(frappe.defaultDateFormat)
            );
    },
    validate: function(frm) {
        if (!cstr(frm.doc.company).length) {
            frappe.exp()
                .focus(frm, 'company')
                .error('A valid expense request company is required.');
            return false;
        }
        if (!cstr(frm.doc.posting_date).length) {
            frappe.exp()
                .focus(frm, 'posting_date')
                .error('A valid expense request posting date is required.');
            return false;
        }
        if (!(frm.doc.expenses || []).length) {
            frappe.exp()
                .focus(frm, 'expenses')
                .error('At least one valid expense is required.');
            return false;
        }
    },
    after_save: function(frm) {
        frm._request.toolbar_ready = false;
        frm.trigger('setup_toolbar');
    },
    toggle_company_desc: function(frm) {
        let desc;
        if ((frm.doc.expenses || []).length)
            desc = 'Changing the company will clear the expense table.';
        frappe.exp().field_desc(frm, 'company', desc);
    },
    update_expenses_data: function(frm) {
        if (!(frm.doc.expenses || []).length) return;
        let cdns = {},
        names = [],
        is_changed = 0;
        frm.doc.expenses.forEach(function(v) {
            if (cstr(v.total).length) return;
            let nmae = cstr(v.name),
            expense = cstr(v.expense);
            if (frm._request.data[expense]) {
                if (frm._request.set_expense_data(name))
                    is_changed = 1;
            } else {
                cdns[expense] = name;
                names.push(expense);
            }
        });
        if (!names.length) {
            if (is_changed) frm.refresh_field('expenses');
            return;
        }
        frappe.exp().request(
            'get_expenses_data',
            {expenses: names},
            function(ret) {
                ret.forEach(function(v) {
                    v.total = format_currency(flt(v.total), cstr(v.currency));
                    v._is_advance = !!cint(v.is_advance);
                    v.is_advance = __(cint(v.is_advance) ? 'Yes' : 'No');
                    
                    if ((v.attachments || []).length) {
                        v._attachments = v.attachments.slice();
                        var html = [];
                        v.attachments.forEach(function(a, i) {
                            let file = cstr(a.file),
                            name = file.split('/').pop();
                            file = frappe.utils.get_file_link(file);
                            html[i] = '<tr>\
                                <td scope="row" class="fit text-left">' + name + '</td>\
                                <td class="text-justify">' + cstr(a.description) + '</td>\
                                <td class="fit">\
                                    <a class="btn btn-sm btn-info" target="_blank" href="' + file + '">\
                                        <span class="fa fa-link fa-fw"></span>\
                                    </a>\
                                </td>\
                            </tr>';
                        });
                        v.attachments = '\
                            <label class="control-label">' + __('Attachments') + '</label>\
                            <table class="table table-bordered table-condensed expenses-attachments-table">\
                                <thead>\
                                    <tr>\
                                        <th scope="col" class="fit font-weight-bold text-left">' + __('File') + '</th>\
                                        <th scope="col" class="font-weight-bold">' + __('Description') + '</th>\
                                        <th scope="col" class="fit font-weight-bold">' + __('Actions') + '</th>\
                                    </tr>\
                                </thead>\
                                <tbody>\
                                    ' + html.join("\n") + '\
                                </tbody>\
                            </table>\
                        ';
                    }
                    
                    let name = cstr(v.name);
                    frm._request.data[name] = v;
                    frm._request.set_expense_data(cdns[name]);
                });
                frm.refresh_field('expenses');
            }
        );
    },
    toggle_add_expenses: function(frm) {
        if (frm._request.select_dialog) {
            frm._request.select_dialog.dialog.show();
            return;
        }
        frm._request.select_dialog = new frappe.ui.form.MultiSelectDialog({
            doctype: 'Expense',
            target: frm,
            add_filters_group: 0,
            //date_field: 'required_by',
            columns: ['name', 'expense_item', 'description', 'total', 'is_advance', 'required_by'],
            get_query: function() {
                let len = (frm.doc.expenses || []).length,
                existing = [],
                filters = {
                    date: cstr(frm.doc.posting_date),
                    company: cstr(frm.doc.company)
                };
                if (len)
                    frm.doc.expenses.forEach(function(r) {
                        existing.push(cstr(r.expense));
                    });
                if (existing.length) filters.existing = existing;
                return {
                    query: frappe.exp().path('search_company_expenses'),
                    filters: filters,
                };
            },
            primary_action_label: __('Add'),
            action: function(vals) {
                if (frappe.exp().$isArr(vals) && vals.length) {
                    vals.forEach(function(v) {
                        if (v && frappe.exp().$isStr(v))
                            frm.add_child('expenses', {expense: v});
                    });
                    frm.trigger('update_expenses_data');
                    frm.trigger('toggle_company_desc');
                }
            }
        });
        frm._request.select_dialog.dialog.get_secondary_btn().addClass('hide');
    },
    destroy_add_expenses: function(frm) {
        if (!frm._request.select_dialog) return;
        let tmp = frm._request.select_dialog;
        frm._request.select_dialog = null;
        if (tmp.dialog && tmp.dialog.$wrapper) {
            tmp.dialog.$wrapper.modal('destroy');
            tmp.dialog.$wrapper.remove();
        }
    },
    before_workflow_action: function(frm) {
        let action = cstr(frm.selected_workflow_action);
        frm._request.workflow = {action: action};
        if (action !== 'Reject' || cstr(frm.doc.reviewer).length) {
            frm._request.is_ready = false;
            frm._request.toolbar_ready = false;
            return Promise.resolve();
        }
        
        frm.trigger('process_rejection');
        return Promise.reject();
    },
    after_workflow_action: function(frm) {
        if (!frm._request.workflow) return;
        let action = {
            submit: 'submitted',
            cancel: 'cancelled',
            approve: 'approved',
            reject: 'rejected',
        }[frm._request.workflow.action.toLowerCase()];
        delete frm._request.workflow;
        frappe.show_alert({
            indicator: 'green',
            message: __(
                'Expenses request has been {0} successfully.',
                [action]
            )
        });
    },
    process_rejection: function(frm) {
        frappe.prompt(
            [{
                fieldname: 'reason',
                fieldtype: 'Small Text',
                label: 'Reason'
            }],
            function(v) {
                let reason = cstr(v.reason);
                if (!reason.length) frm.trigger('continue_workflow');
                else {
                    frappe.exp().request(
                        'add_request_rejection_reason',
                        {
                            name: cstr(frm.doc.name),
                            reason: reason,
                        },
                        function(ret) {
                            if (!ret)
                                frappe.show_alert({
                                    indicator: 'red',
                                    message: __('Expenses request rejection failed.')
                                });
                            else
                                frm.trigger('continue_workflow');
                        }
                    );
                }
            },
            __('Rejection Reason'),
            __('Submit')
        );
    },
    continue_workflow: function(frm) {
        frappe.xcall(
            'frappe.model.workflow.apply_workflow',
            {doc: frm.doc, action: frm._request.workflow.action}
        ).then(function(doc) {
            frm._request.is_ready = false;
            frm._request.toolbar_ready = false;
            frappe.model.sync(doc);
            frm.refresh();
            frm.selected_workflow_action = null;
            frm.script_manager.trigger('after_workflow_action');
        });
    },
    setup_toolbar: function(frm) {
        if (
            frm._request.toolbar_ready
            || cint(frm.doc.docstatus) < 1
        ) return;
        frm._request.toolbar_ready = true;
        let status = cstr(frm.doc.status);
        if (status === 'Approved')
            frm.trigger('toggle_create_entry_btn');
        else if (status === 'Rejected')
            frm.trigger('toggle_appeal_btn');
    },
    toggle_create_entry_btn: function(frm) {
        if (
            cint(frm.doc.docstatus) !== 1
            || !frm._request.is_reviewer
        ) return;
        
        let btn = __('Create Entry');
        if (frm.custom_buttons[btn]) return;
        
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            frappe.exp().set_cache('create-expenses-entry', {
                request: cstr(frm.doc.name),
            });
            frappe.set_route('Form', 'Expenses Entry');
        });
        frm.change_custom_button_type(btn, null, 'success');
    },
    toggle_appeal_btn: function(frm) {
        if (
            cint(frm.doc.docstatus) !== 2
            || cstr(frm.doc.owner) !== frappe.session.user
        ) return;
        
        let btn = __('Appeal');
        if (frm.custom_buttons[btn]) return;
        
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            let expenses = []
            if ((frm.doc.expenses || []).length)
                frm.doc.expenses.forEach(function(v, i) {
                    expenses[i] = cstr(v.expense);
                });
            frappe.exp().set_cache('create-expenses-request', {
                company: cstr(frm.doc.company),
                expenses: expenses,
            });
            frm.amend_doc();
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
});