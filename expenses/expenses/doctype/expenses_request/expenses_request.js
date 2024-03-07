/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Request', {
    onload: function(frm) {
        frappe.exp().on('ready change', function() { this.setup_form(frm); });
        frm._request = {
            err: __("Expenses Request Error"),
            is_ready: 0,
            is_moderator: 0,
            is_reviewer: 0,
            toolbar_ready: 0,
            company: null,
            data: {},
            virtual_fields: ['expense_item', 'total', 'is_advance', 'required_by'],
            set_expense_data: function(cdn) {
                let row = locals['Expenses Request Details'][cdn],
                data = frm._request.data[cstr(row.expense)],
                changed = 0;
                for (let i = 0, l = frm._request.virtual_fields.length, k; i < l; i++) {
                    k = frm._request.virtual_fields[i];
                    if (cstr(row[k]) !== cstr(data[k])) {
                        row[k] = cstr(data[k]);
                        changed++;
                    }
                }
                if (data._attachments) {
                    let field = frappe.exp().get_field(frm, 'expenses', cdn, 'attachments');
                    if (!field.$wrapper.html().length) {
                        field.html(data.attachments);
                        changed++;
                    }
                }
                frm._request.update_row_button(cdn);
                return changed;
            },
            update_row_button: function(cdn) {
                let row = frappe.exp().get_field(frm, 'expenses', cdn);
                if (row && row.open_form_button && row.open_form_button.children) {
                    let children = row.open_form_button.children();
                    $(children[0]).html(frappe.utils.icon('solid-info', 'xs'));
                    $(children[1]).html(' ' + __("Info") + ' ');
                }
            },
        };
        frappe.exp().request(
            'request_form_setup', null,
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
        if (!frm.is_new()) frm._request.company = cstr(frm.doc.company);
        else {
            let req = frappe.route_options || {};
            if (frappe.exp().$isDataObj(req) && frappe.exp().$isStrVal(req.expense)) {
                frm.add_child('expenses', {expense: cstr(req.expense)});
                frm.events.update_expenses_data(frm);
            }
            req = frappe.exp().get_cache('expenses-to-request');
            if (frappe.exp().$isArrVal(req)) {
                for (let i = 0, l = req.length; i < l; i++)
                    frm.add_child('expenses', {expense: cstr(req[i])});
                frm.events.update_expenses_data(frm);
            }
            let status = cstr(frm.doc.status);
            if (!status.length || status === 'Draft')
                frm.set_query('company', {filters: {is_group: 0}});
        }
    },
    refresh: function(frm) {
        frm.events.setup_toolbar(frm);
        if (frm._request.is_ready) return;
        frm._request.is_ready = 1;
        let status = cstr(frm.doc.status),
        wrapper = frm.get_field('expenses').grid.wrapper;
        if (!status.length || status === 'Draft') {
            wrapper.find('.grid-add-multiple-rows, .grid-download, .grid-upload').hide();
            wrapper.find('.grid-add-row')
                .off('click')
                .on('click', function() { frm.events.toggle_add_expenses(frm); });
        } else {
            frm.events.destroy_add_expenses(frm);
            wrapper.find('.grid-add-multiple-rows, .grid-download, .grid-upload').show();
            wrapper.find('.grid-add-row').off('click');
            wrapper.find('.grid-footer').toggle(false);
            wrapper.find('.grid-row-check').toggle(false);
        }
    },
    company: function(frm) {
        let val = cstr(frm.doc.company);
        if (val !== frm._request.company) {
            frm._request.company = val;
            frappe.exp().$isArrVal(frm.doc.expenses) && frm.clear_table('expenses');
        }
    },
    posting_date: function(frm) {
        let val = cstr(frm.doc.posting_date),
        today = moment();
        if (!val.length) val = null;
        else val = moment(val, frappe.defaultDateFormat);
        if (
            !val || (
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
                .error(frm._request.err, __('A valid company is required.'));
            return false;
        }
        if (!cstr(frm.doc.posting_date).length) {
            frappe.exp()
                .focus(frm, 'posting_date')
                .error(frm._request.err, __('A valid posting date is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expenses)) {
            frappe.exp()
                .focus(frm, 'expenses')
                .error(frm._request.err, __('At least one valid expense is required.'));
            return false;
        }
    },
    after_save: function(frm) {
        frm._request.toolbar_ready = 0;
        frm.events.setup_toolbar(frm);
    },
    toggle_company_desc: function(frm) {
        let desc;
        if (frappe.exp().$isArrVal(frm.doc.expenses))
            desc = __('Changing the company will clear the expenses table.');
        frappe.exp().field_desc(frm, 'company', desc);
    },
    update_expenses_data: function(frm) {
        if (!frappe.exp().$isArrVal(frm.doc.expenses)) return;
        var cdns = {};
        let names = [],
        change = 0;
        for (let i = 0, l = frm.doc.expenses.length, v; i < l; i++) {
            v = frm.doc.expenses[i];
            if (cstr(v.total).length) continue;
            let nmae = cstr(v.name),
            expense = cstr(v.expense);
            if (frm._request.data[expense]) {
                if (frm._request.set_expense_data(name)) change++;
            } else {
                cdns[expense] = name;
                names.push(expense);
            }
        }
        if (!names.length) {
            if (change) frm.refresh_field('expenses');
            return;
        }
        frappe.exp().request(
            'get_expenses_data',
            {expenses: names},
            function(ret) {
                for (let i = 0, l = ret.length, v; i < l; i++) {
                    v = ret[i];
                    v.total = format_currency(flt(v.total), cstr(v.currency));
                    v.is_advance = cint(v.is_advance) ? __('Yes') : __('No');
                    if (this.$isArrVal(v.attachments)) {
                        v._attachments = v.attachments.slice();
                        let html = [];
                        for (let x = 0, y = v.attachments.length, a; x < y; x++) {
                            a = v.attachments[x];
                            let file = cstr(a.file),
                            name = file.split('/').pop();
                            file = frappe.utils.get_file_link(file);
                            html[x] = '<tr>\
                                <td scope="row" class="fit text-left">' + name + '</td>\
                                <td class="text-justify">' + cstr(a.description) + '</td>\
                                <td class="fit">\
                                    <a class="btn btn-sm btn-info" target="_blank" href="' + file + '">\
                                        <span class="fa fa-link fa-fw"></span>\
                                    </a>\
                                </td>\
                            </tr>';
                        }
                        v.attachments = '\
                            <label class="control-label">' + __('Attachments') + '</label>\
                            <table class="table table-bordered table-condensed expenses-attachments-table">\
                                <thead>\
                                    <tr>\
                                        <th scope="col" class="fit font-weight-bold text-left">' + __('File') + '</th>\
                                        <th class="font-weight-bold">' + __('Description') + '</th>\
                                        <th class="fit font-weight-bold">' + __('Actions') + '</th>\
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
                }
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
                exist = [],
                filters = {
                    date: cstr(frm.doc.posting_date),
                    company: cstr(frm.doc.company)
                };
                if (len) for (let i = 0, r; i < len; i++) {
                    r = frm.doc.expenses[i];
                    exist.push(cstr(r.expense));
                }
                if (exist.length) filters.existing = exist;
                return {
                    query: frappe.exp().get_method('search_company_expenses'),
                    filters: filters,
                };
            },
            primary_action_label: __('Add'),
            action: function(vals) {
                if (frappe.exp().$isArrVal(vals)) {
                    for (let i = 0, l = vals.length; i < l; i++) {
                        if (frappe.exp().$isStrVal(vals[i]))
                            frm.add_child('expenses', {expense: vals[i]});
                    }
                    frm.events.update_expenses_data(frm);
                    frm.events.toggle_company_desc(frm);
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
            try { tmp.dialog.$wrapper.modal('destroy'); } catch(_) {}
            tmp.dialog.$wrapper.remove();
        }
    },
    before_workflow_action: function(frm) {
        let action = cstr(frm.selected_workflow_action);
        frm._request.workflow = {action: action};
        if (action !== 'Reject' || cstr(frm.doc.reviewer).length) {
            frm._request.is_ready = 0;
            frm._request.toolbar_ready = 0;
            return Promise.resolve();
        }
        
        frm.events.process_rejection(frm);
        return Promise.reject();
    },
    after_workflow_action: function(frm) {
        if (!frm._request.workflow) return;
        let action = {
            submit: __('submitted'),
            cancel: __('cancelled'),
            approve: __('approved'),
            reject: __('rejected'),
        }[frm._request.workflow.action.toLowerCase()];
        delete frm._request.workflow;
        frappe.show_alert({
            indicator: 'green',
            message: __('Expenses request has been {0} successfully.', [action])
        });
    },
    process_rejection: function(frm) {
        frappe.prompt(
            [{
                fieldname: 'reason',
                fieldtype: 'Small Text',
                label: __('Reason')
            }],
            function(v) {
                let reason = cstr(v.reason);
                if (!reason.length) frm.events.continue_workflow(frm);
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
                                frm.events.continue_workflow(frm);
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
            frm._request.is_ready = 0;
            frm._request.toolbar_ready = 0;
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
        frm._request.toolbar_ready = 1;
        let status = cstr(frm.doc.status);
        if (status === 'Approved')
            frm.events.toggle_create_entry_btn(frm);
        else if (status === 'Rejected')
            frm.events.toggle_appeal_btn(frm);
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