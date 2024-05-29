/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Request', {
    onload: function(frm) {
        frappe.exp()
            .on('ready change', function() { this.setup_form(frm); })
            .on('on_alert', function(d, t) {
                frm._req.errs.includes(t) && (d.title = __(frm.doctype));
            });
        frm._req = {
            errs: ['fatal', 'error'],
            details_dt: 'Expenses Request Details',
            ignore: 0,
            is_draft: 0,
            is_submitted: 0,
            is_cancelled: 0,
            is_owner: 0,
            is_moderator: 0,
            is_reviewer: 0,
            toolbar: 0,
            table: {ready: 0, enabled: 1, data: frappe.exp().table(1)},
            date: {obj: moment(), str: null},
            company: '',
            cache: {},
            moment: function(v, t) {
                t = t ? frappe.defaultDatetimeFormat : frappe.defaultDateFormat;
                return moment(cstr(v), t);
            },
        };
        frm.events.update_doc_status(frm);
        if (!frm._req.is_draft) return;
        frm._req.date.str = frm._req.date.obj.format(frappe.defaultDateFormat);
        frappe.exp().request(
            'request_form_setup', null,
            function(ret) {
                if (!this.$isDataObj(ret)) return;
                frm._req.is_moderator = !!ret.is_moderator;
                frm._req.is_reviewer = !!ret.is_reviewer;
                let key = 'posting_date';
                if (frm._req.is_moderator)
                    frm.set_df_property(key, {reqd: 1, bold: 1, read_only: 0});
                else if (frm.is_new() || !this.$isStrVal(frm.doc[key])) {
                    frm._req.ignored++;
                    frm.set_value(key, frm._req.date.str);
                    frm._req.ignore--;
                }
            }
        );
        frm.set_query('company', function(doc) { return {filters: {is_group: 0}}; });
        frm.set_query('expense', 'expenses', function(doc, cdt, cdn) {
            let filters = {company: cstr(frm.doc.company)};
            if (!frm._req.is_moderator) {
                let date = cstr(frm.doc.posting_date),
                owner = cstr(frm.doc.owner);
                filters.max_date = date.length ? date : frm._req.date.str;
                filters.owner = owner.length ? owner : cstr(frappe.session.user);
            }
            if (frm._req.table.data.length)
                filters.ignored = frm._req.table.data.col(1);
            return {
                query: frappe.exp().get_method('search_company_expenses'),
                filters: filters
            };
        });
        frm.add_fetch('expense', 'expense_item', 'expense_item', frm._req.details_dt);
        frm.add_fetch('expense', 'uom', 'uom', frm._req.details_dt);
        frm.add_fetch('expense', 'total', 'total', frm._req.details_dt);
        frm.add_fetch('expense', 'is_advance', 'is_advance', frm._req.details_dt);
        frm.add_fetch('expense', 'required_by', 'required_by', frm._req.details_dt);
        if (!frm.is_new()) {
            frm._req.company = cstr(frm.doc.company);
            let tkey = 'expenses';
            if (frappe.exp().$isArrVal(frm.doc[tkey]))
                for (let i = 0, x = 0, l = frm.doc[tkey].length, v; i < l; i++) {
                    v = frm.doc[tkey][i];
                    frm._req.table.data.add(cstr(v.name), cstr(v.expense));
                }
        } else {
            let req = frappe.exp().cache().get('expenses-request');
            if (frappe.exp().$isArrVal(req)) {
                req = frappe.exp().$filter(req, frappe.exp().$isStrVal);
                if (!req.length) return;
                for (let i = 0, l = req.length, r; i < l; i++) {
                    r = frm.add_child('expenses', {expense: req[i]});
                    frm._req.table.data.add(cstr(r.name), cstr(r.expense));
                }
                frm.events.update_expenses(frm);
            }
        }
    },
    refresh: function(frm) {
        if (frm.is_new()) return;
        !frm._req.toolbar && frm.events.setup_toolbar(frm);
        !frm._req.table.ready && frm.events.toggle_expenses(frm);
    },
    company: function(frm) {
        let val = cstr(frm.doc.company);
        if (val === frm._req.company) return;
        frm._req.company = val;
        frm.events.toggle_company_desc(frm);
        frm.events.toggle_expenses(frm);
        frm.events.filter_expenses(frm);
    },
    posting_date: function(frm) {
        if (frm._req.ignore) return;
        let key = 'posting_date',
        val = cstr(frm.doc[key]);
        if (!val.length || !frm._req.is_moderator) {
            frm._req.ignore++;
            frm.set_value(key, frm._req.date.str);
            frm._req.ignore--;
        }
    },
    validate: function(frm) {
        if (!frappe.exp().$isStrVal(frm.doc.company)) {
            frappe.exp().fatal(__('A valid company is required.'));
            return false;
        }
        if (!frm._req.is_moderator && (
            !frappe.exp().$isStrVal(frm.doc.posting_date)
            || frm.doc.posting_date !== frm._req.date.str
        )) {
            frm._req.ignored++;
            frm.set_value('posting_date', frm._req.date.str);
            frm._req.ignore--;
        }
        if (!frappe.exp().$isStrVal(frm.doc.posting_date)) {
            frappe.exp().fatal(__('A valid posting date is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expenses)) {
            frappe.exp().fatal(__('At least one valid expense is required.'));
            return false;
        }
    },
    after_save: function(frm) {
        frm.events.update_doc_status(frm);
        frm.events.setup_toolbar(frm);
    },
    on_submit: function(frm) {
        frm.events.update_doc_status(frm);
        frm.events.setup_toolbar(frm);
    },
    after_cancel: function(frm) {
        frm.events.update_doc_status(frm);
        frm.events.setup_toolbar(frm);
    },
    update_doc_status: function(frm) {
        let is_new = !!frm.is_new(),
        docstatus = cint(frm.doc.docstatus);
        frm._req.is_draft = is_new || docstatus === 0;
        frm._req.is_submitted = !is_new && docstatus === 1;
        frm._req.is_cancelled = !is_new && docstatus === 2;
        frm._req.is_owner = is_new || cstr(frm.doc.owner) === cstr(frappe.session.user);
    },
    toggle_company_desc: function(frm) {
        let desc;
        if (frappe.exp().$isArrVal(frm.doc.expenses))
            desc = __('Changing the company will immediately clear the expenses table.');
        frappe.exp().field_desc(frm, 'company', desc);
    },
    toggle_expenses: function(frm) {
        if (!frm._req.table.ready) {
            frm._req.table.ready++;
            frm.events.toggle_company_desc(frm);
        }
        let val = frm._req.company.length ? 1 : 0;
        if (frm._req.table.enabled === val) return;
        frm._req.table.enabled = val;
        frappe.exp().toggle_table(frm, 'expenses', frm._req.table.enabled);
    },
    filter_expenses: function(frm) {
        frm._req.table.data.length && frm._req.table.data.clear();
        var tkey = 'expenses';
        if (!frm._req.company.length || !frappe.exp().$isArrVal(frm.doc[tkey])) return;
        let expenses = [];
        for (let i = 0, x = 0, l = frm.doc[tkey].length, v; i < l; i++) {
            v = frm.doc[tkey][i];
            if (frappe.exp().$isStrVal(v.expense)) expenses[x++] = v.expense;
        }
        if (!expenses.length) return frm.clear_table(tkey);
        frappe.exp().request(
            'filter_company_expenses',
            {
                company: frm._req.company,
                expenses: expenses
            },
            function(ret) {
                if (!this.$isArrVal(ret)) return frm.clear_table(tkey);
                let keep = [];
                for (let i = 0, x = 0, l = frm.doc[tkey].length, v; i < l; i++) {
                    v = frm.doc[tkey][i];
                    if (frappe.exp().$isStrVal(v.expense) && ret.includes(v.expense)) {
                        keep[x++] = v;
                        frm._req.table.data.add(cstr(v.name), v.expense);
                    }
                }
                if (keep.length === frm.doc[tkey].length) return;
                frm._req.ignore++;
                frm.set_value(tkey, keep);
                frm._req.ignore--;
                frm.refresh_field(tkey);
            }
        );
    },
    update_expenses: function(frm) {
        var tkey = 'expenses';
        if (!frappe.exp().$isArrVal(frm.doc[tkey])) return;
        var cdns = {};
        let names = [];
        for (let i = 0, l = frm.doc[tkey].length, v; i < l; i++) {
            v = frm.doc[tkey][i];
            if (!frappe.exp().$isStrVal(v.expense)) continue;
            if (frm._req.cache[v.expense]) {
                frm.events.refresh_expense(frm, v);
            } else {
                cdns[v.expense] = v;
                names.push(v.expense);
            }
        }
        if (!names.length) return frm.refresh_field(tkey);
        frappe.exp().request(
            'get_expenses_data',
            {expenses: names},
            function(ret) {
                if (!this.$isArrVal(ret)) return;
                for (let i = 0, l = ret.length, v, h, n; i < l; i++) {
                    v = ret[i];
                    v.total = format_currency(flt(v.total), cstr(v.currency));
                    v.is_advance = cint(v.is_advance) ? __('Yes') : __('No');
                    h = this.$isArrVal(v.attachments) ? frappe.gc_attach.render(v.attachments) : null;
                    v.html_table = frappe.gc_attach.build(h);
                    n = cstr(v.name);
                    frm._req.cache[n] = v;
                    frm.events.refresh_expense(frm, cdns[n]);
                }
                frm.refresh_field(tkey);
            }
        );
    },
    refresh_expense: function(frm, row) {
        let key = cstr(row.expense);
        if (!key.length || !frm._req.cache[key]) return;
        let tkey = 'expenses',
        data = frm._req.cache[key],
        virts = ['expense_item', 'total', 'is_advance', 'required_by'];
        for (let i = 0, l = virts.length, k; i < l; i++) {
            k = virts[i];
            row[k] = cstr(data[k]);
        }
        key = cstr(row.name);
        if (data.html_table) {
            let field = frappe.exp().get_rfield(frm, tkey, key, 'attachments');
            field && field.$wrapper && field.$wrapper.empty()
                .removeClass('form-group').append(data.html_table);
        }
        row = frappe.exp().get_row(frm, tkey, key);
        if (row && row.open_form_button && row.open_form_button.children) {
            row = row.open_form_button.children();
            $(row[0]).html(frappe.utils.icon('solid-info', 'xs'));
            $(row[1]).html(' ' + __("Info") + ' ');
        }
    },
    before_workflow_action: function(frm) {
        frm._req.workflow = cstr(frm.selected_workflow_action);
        if (frm._req.workflow !== 'Reject' || frappe.exp().$isStrVal(frm.doc.reviewer)) {
            frm._req.toolbar = 0;
            return Promise.resolve();
        }
        frm.events.process_rejection(frm);
        return Promise.reject();
    },
    after_workflow_action: function(frm) {
        if (!frm._req.workflow) return;
        let action = {
            submit: __('submitted'),
            cancel: __('cancelled'),
            approve: __('approved'),
            reject: __('rejected'),
        }[frm._req.workflow.toLowerCase()];
        delete frm._req.workflow;
        frappe.exp().success_(__('Expenses request has been {0} successfully.', [action]));
    },
    process_rejection: function(frm) {
        frappe.prompt(
            [{
                fieldname: 'reason',
                fieldtype: 'Small Text',
                label: __('Reason')
            }],
            function(v) {
                if (!v || !frappe.exp().$isStrVal(v.reason))
                    return frm.events.continue_workflow(frm);
                frappe.exp().request(
                    'reject_request_reason',
                    {
                        name: cstr(frm.docname),
                        reason: v.reason
                    },
                    function(ret) {
                        if (!!ret) frm.events.continue_workflow(frm);
                        else frappe.exp().error_(__('Expenses request rejection failed.'));
                    }
                );
            },
            __('Rejection Reason'),
            __('Submit')
        );
    },
    continue_workflow: function(frm) {
        frappe.xcall(
            'frappe.model.workflow.apply_workflow',
            {doc: frm.doc, action: frm._req.workflow}
        ).then(function(doc) {
            frm._req.toolbar = 0;
            frappe.model.sync(doc);
            frm.refresh();
            frm.selected_workflow_action = null;
            frm.script_manager.trigger('after_workflow_action');
        });
    },
    setup_toolbar: function(frm) {
        if (frm._req.is_draft) return;
        let status = cstr(frm.doc.status);
        if (frm._req.is_submitted && status === 'Approved' && frm._req.is_reviewer)
            frm.events.toggle_create_entry_btn(frm);
        else if (frm._req.is_cancelled && status === 'Rejected' && frm._req.is_owner)
            frm.events.toggle_appeal_btn(frm);
        else if (frm._req.toolbar) {
            frm._req.toolbar = 0;
            frm.clear_custom_buttons();
        }
    },
    toggle_create_entry_btn: function(frm) {
        let label = __('Create Entry');
        if (frm.custom_buttons[label]) return;
        frm._req.toolbar = 1;
        frm.clear_custom_buttons();
        frm.add_custom_button(label, function() {
            frappe.new_doc('Expenses Entry', {expenses_request_ref: cstr(frm.docname)});
        });
        frm.change_custom_button_type(label, null, 'success');
    },
    toggle_appeal_btn: function(frm) {
        let label = __('Appeal');
        if (frm.custom_buttons[label]) return;
        frm._req.toolbar = 1;
        frm.clear_custom_buttons();
        frm.add_custom_button(label, function() {
            frappe.route_options = {company: cstr(frm.doc.company)};
            if (frappe.exp().$isArrVal(frm.doc.expenses)) {
                let expenses = frappe.exp().$map(frm.doc.expenses, function(v) { return cstr(v.expense); });
                frappe.exp().cache().set('expenses-request', expenses, 60);
            }
            frm.amend_doc();
        });
        frm.change_custom_button_type(label, null, 'info');
    },
});


frappe.ui.form.on('Expenses Request Details', {
    before_expenses_remove: function(frm, cdt, cdn) {
        frm._req.table.data.del(cdn);
    },
    expense: function(frm, cdt, cdn) {
        if (frm._req.ignore) return;
        let row = locals[cdt][cdn],
        key = 'expense',
        val = cstr(row[key]),
        err;
        if (!val.length) {
            frm._req.table.data.del(cdn);
            err = __('A valid expense is required.');
        } else if (
            frm._req.table.data.has(val, 1)
            && frm._req.table.data.val(val, 1) !== cdn
        ) {
            frm._req.table.data.del(cdn);
            frm._req.ignore++;
            frappe.model.set_value(cdt, cdn, key, '');
            frm._req.ignore--;
            err = __('Expense has already been added.');
        } else {
            frm._req.table.data.add(cdn, val);
        }
        frappe.exp().rfield_status(frm, 'expenses', cdn, key, err);
    }
});


frappe.gc_attach = {
    render: function(val) {
        let html = [];
        for (let i = 0, l = val.length, f, n; i < l; i++) {
            f = cstr(val[i].file);
            n = f.split('/').pop();
            f = frappe.utils.get_file_link(f);
            html[i] = '\
            <tr>\
                <td scope="row" class="fit text-left">' + n + '</td>\
                <td class="text-justify">' + cstr(val[i].description) + '</td>\
                <td class="fit">\
                    <a href="' + f + '" class="btn btn-sm btn-info" target="_blank">\
                        <span class="fa fa-link fa-fw"></span>\
                    </a>\
                </td>\
            </tr>\
            ';
        }
        return html;
    },
    build: function(html) {
        return '\
<div class="form-group">\
    <div class="clearfix">\
        <label class="control-label pr-0">\
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
                ' + (html && html.length
                ? html.join("\n")
                : '\
                <tr>\
                    <td scope="row" colspan="3" class="text-center text-mute">\
                        ' + __('No files attached.') + '\
                    </td>\
                </tr>\
                '
                ) + '\
            </tbody>\
        </table>\
    </div>\
</div>\
        ';
    },
};