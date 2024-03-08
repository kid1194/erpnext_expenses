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
            is_ready: 0,
            is_moderator: 0,
            is_reviewer: 0,
            toolbar_ready: 0,
            today: moment().format(frappe.defaultDateFormat),
            company: null,
            data: {},
            virtual_fields: ['expense_item', 'total', 'is_advance', 'required_by'],
            toMoment: function(v) {
                return moment(cstr(v), t ? frappe.defaultDatetimeFormat : frappe.defaultDateFormat);
            },
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
                    if (field && !field.$wrapper.children().length) {
                        field.$wrapper.removeClass('form-group').append(data.attachments);
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
                } else if (!this.$isStrVal(frm.doc.posting_date)) {
                    frm.set_value('posting_date', frm._request.today);
                }
            }
        );
        if (!frm.is_new()) frm._request.company = cstr(frm.doc.company);
        else {
            let req = frappe.route_options;
            if (frappe.exp().$isDataObj(req)) {
                if (frappe.exp().$isStrVal(req.company))
                    frm.set_value('company', req.company);
                if (frappe.exp().$isStrVal(req.expense)) {
                    frm.add_child('expenses', {expense: req.expense});
                    frm.events.update_expenses_data(frm);
                }
            }
            req = frappe.exp().get_cache('expenses-request');
            if (frappe.exp().$isArrVal(req)) {
                for (let i = 0, l = req.length; i < l; i++) {
                    if (frappe.exp().$isStrVal(req[i]))
                        frm.add_child('expenses', {expense: req[i]});
                }
                frm.events.update_expenses_data(frm);
            }
            let status = cstr(frm.doc.status);
            if (!status.length || status === 'Draft')
                frm.set_query('company', function(doc) { return {filters: {is_group: 0}}; });
        }
    },
    refresh: function(frm) {
        frm.events.setup_toolbar(frm);
        if (frm._request.is_ready) return;
        frm._request.is_ready = 1;
        let status = cstr(frm.doc.status),
        wrapper = frm.get_field('expenses').grid.wrapper,
        val = !status.length || status === 'Draft';
        frappe.exp().toggle_table_buttons(frm, 'expenses', val ? 0 : 1, ['multi_add', 'download', 'upload']);
        if (val) {
            wrapper.find('.grid-add-row').off('click')
                .on('click', function() { frm.events.toggle_add_expenses(frm); });
        } else {
            frm.events.destroy_add_expenses(frm);
            wrapper.find('.grid-add-row').off('click');
            wrapper.find('.grid-footer').toggle(false);
            wrapper.find('.grid-row-check').toggle(false);
        }
    },
    company: function(frm) {
        let val = cstr(frm.doc.company);
        if (val !== frm._request.company) {
            frm._request.company = val;
            if (frappe.exp().$isArrVal(frm.doc.expenses)) {
                frm.clear_table('expenses');
                frm.refresh_field('expenses');
            }
        }
    },
    posting_date: function(frm) {
        let val = cstr(frm.doc.posting_date);
        if (!val.length) val = null;
        else val = frm._request.toMoment(val);
        if (
            !val || (
                !frm._request.is_moderator
                && cint(val.diff(frm._request.toMoment(frm._request.today), 'days')) < 0
            )
        ) frm.set_value('posting_date', frm._request.today);
    },
    validate: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.company)) {
            frappe.exp()
                .focus(frm, 'company')
                .error(__(frm.doctype), __('A valid company is required.'));
            return false;
        }
        if (!frappe.exp().$isStrVal(frm.doc.posting_date)) {
            frappe.exp()
                .focus(frm, 'posting_date')
                .error(__(frm.doctype), __('A valid posting date is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expenses)) {
            frappe.exp()
                .focus(frm, 'expenses')
                .error(__(frm.doctype), __('At least one valid expense is required.'));
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
                            html[x] = '\
                            <tr>\
                                <td scope="row" class="fit text-left">' + name + '</td>\
                                <td class="text-justify">' + cstr(a.description) + '</td>\
                                <td class="fit">\
                                    <a class="btn btn-sm btn-info" target="_blank" href="' + file + '">\
                                        <span class="fa fa-link fa-fw"></span>\
                                    </a>\
                                </td>\
                            </tr>\
                            ';
                        }
                        v.attachments = '\
                        <div class="form-group">\
                            <div class="clearfix">\
                                <label class="control-label" style="padding-right: 0px;">\
                                    ' + __('Attachments') + '\
                                </label>\
                            </div>\
                            <div class="control-input-wrapper">\
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
                            </div>\
                        </div>\
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
        if (frm._request.select_dialog) return frm._request.select_dialog.dialog.show();
        frm._request.select_dialog = new frappe.ui.form.MultiSelectDialog({
            doctype: 'Expense',
            target: frm,
            add_filters_group: 0,
            date_field: 'required_by',
            columns: ['name', 'expense_item', 'description', 'total', 'is_advance', 'required_by'],
            get_query: function() {
                let qry = {
                    query: frappe.exp().get_method('search_company_expenses'),
                    filters: {company: cstr(frm.doc.company)}
                };
                if (!frm._request.is_moderator) {
                    qry.filters.max_date = cstr(frm.doc.posting_date);
                    qry.filters.owner = cstr(frappe.session.user);
                }
                if (frappe.exp().$isArrVal(frm.doc.expenses)) {
                    qry.filters.ignored = [];
                    for (let i = 0, l = frm.doc.expenses.length; i < l; i++)
                        qry.filters.ignored.push(cstr(frm.doc.expenses[i].expense));
                }
                return qry;
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
        frm._request.select_dialog.dialog.get_secondary_btn().toggleClass('hidden', 1);
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
        if (action !== 'Reject' || frappe.exp().$isStrVal(frm.doc.reviewer)) {
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
                if (!frappe.exp().$isStrVal(v.reason)) frm.events.continue_workflow(frm);
                else {
                    frappe.exp().request(
                        'reject_request',
                        {name: cstr(frm.docname), reason: v.reason},
                        function(ret) {
                            if (!!ret) frm.events.continue_workflow(frm);
                            else frappe.show_alert({
                                indicator: 'red',
                                message: __('Expenses request rejection failed.')
                            });
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
        if (frm._request.toolbar_ready || cint(frm.doc.docstatus) < 1) return;
        frm._request.toolbar_ready = 1;
        let status = cstr(frm.doc.status);
        if (status === 'Approved') frm.events.toggle_create_entry_btn(frm);
        else if (status === 'Rejected') frm.events.toggle_appeal_btn(frm);
    },
    toggle_create_entry_btn: function(frm) {
        if (cint(frm.doc.docstatus) !== 1 || !frm._request.is_reviewer) return;
        let btn = __('Create Entry');
        if (frm.custom_buttons[btn]) return;
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            frappe.route_options = {expenses_request_ref: cstr(frm.docname)};
            frappe.set_route('Form', 'Expenses Entry');
        });
        frm.change_custom_button_type(btn, null, 'success');
    },
    toggle_appeal_btn: function(frm) {
        if (cint(frm.doc.docstatus) !== 2 || cstr(frm.doc.owner) !== frappe.session.user) return;
        let btn = __('Appeal');
        if (frm.custom_buttons[btn]) return;
        frm.clear_custom_buttons();
        frm.add_custom_button(btn, function() {
            frappe.route_options = {company: cstr(frm.doc.company)};
            if (frappe.exp().$isArrVal(frm.doc.expenses)) {
                let expenses = [];
                for (let i = 0, l = frm.doc.expenses.length; i < l; i++)
                    expenses[i] = cstr(frm.doc.expenses[i].expense);
                if (expenses.length === 1) frappe.route_options.expense = expenses[0];
                else frappe.exp().set_cache('expenses-request', expenses, 1, 'minute');
            }
            frm.amend_doc();
        });
        frm.change_custom_button_type(btn, null, 'info');
    },
});