/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');
frappe.provide('frappe.model');
frappe.provide('frappe.datetime');
frappe.provide('frappe.perm');


frappe.listview_settings['Expense'] = {
    onload: function(list) {
        frappe.Expenses();
        
        list._get_args = list.get_args;
        list.get_args = function() {
            var args = this._get_args(),
            dt = this.doctype;
            if (!args.fields) args.fields = [];
            if (dt === 'Expense') {
                frappe.E.merge(args.fields, frappe.E.map(
                    ['party_type', 'party', 'paid_by', 'is_requested', 'is_approved'],
                    function(f) { return frappe.model.get_full_column_name(f, dt); }
                ));
            }
            return args;
        };
        list.setup_columns();
        list.refresh(true);
        
        var base = frappe.listview_settings[list.doctype];
        base.dialog = frappe.E.formDialog('Add Expense', 'blue');
        base.dialog
            .loadDoctype(list.doctype)
            .extend('is_super', !!frappe.perm.has_perm(list.doctype, 1, 'create'));
        if (!base.dialog.is_super) {
            let today = frappe.datetime.moment_to_date_obj(moment());
            base.dialog.setFieldProperty('required_by', 'options', {
                startDate: today,
                minDate: today
            });
        }
        base.dialog
            .replaceProperties({
                'depends_on': ['hidden', 1],
                'read_only_depends_on': ['read_only', 1]
            })
            .removeProperties(
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
                'translatable'
            )
            .setFieldsProperties({
                company: {
                    get_query: {filters: {is_group: 0}},
                    change: function() { this._setAccountData(); },
                },
                expense_item: {
                    get_query: {query: frappe.E.path('search_items')},
                    change: function() { this._setAccountData(); },
                },
                required_by: {
                    change: function() {
                        if (this.is_super) return;
                        let val = this.getValue('required_by');
                        if (
                            val && cint(moment(val, frappe.defaultDateFormat)
                                .diff(moment(), 'days')) < 0
                        ) {
                            this.setInvalid('required_by', 'The minimum required by date is today');
                            this.setValue('required_by', moment().format(frappe.defaultDateFormat));
                        } else {
                            this.setValid('required_by');
                        }
                    },
                },
                cost: {
                    change: function() {
                        let cost = flt(this.getValue('cost')),
                        limit = this._expense_cost,
                        new_cost = cost <= 0 ? 1 : cost;
                        if (limit) {
                            if (limit.min && cost < limit.min) new_cost = limit.min;
                            else if (limit.max && cost < limit.max) new_cost = limit.max;
                        }
                        if (new_cost !== cost) this.setValue('cost', new_cost);
                        else this._updateTotal();
                    },
                },
                qty: {
                    change: function() {
                        let qty = flt(this.getValue('qty')),
                        limit = this._expense_qty,
                        new_qty = qty <= 0 ? 1 : qty;
                        if (limit) {
                            if (limit.min && qty < limit.min) new_qty = limit.min;
                            else if (limit.max && qty < limit.max) new_qty = limit.max;
                        }
                        if (new_qty !== qty) this.setValue('qty', new_qty);
                        else this._updateTotal();
                    },
                },
                is_paid: {
                    change: function() {
                        let val = cint(this.getValue('is_paid'));
                        this.setFieldProperties('paid_by', {
                            reqd: val ? 1 : 0,
                            read_only: val ? 0 : 1,
                        });
                        if (this.with_expense_claim) {
                            this.setFieldProperties('expense_claim', {
                                reqd: val ? 1 : 0,
                                read_only: val ? 0 : 1,
                            });
                        }
                        if (!val) {
                            this.setValue('paid_by', '');
                            this.setValue('expense_claim', '');
                        }
                    },
                },
                paid_by: {
                    change: function() {
                        if (!this.getValue('paid_by'))
                            this.setValue('expense_claim', '');
                    },
                },
                party_type: {
                    change: function() {
                        let val = this.getValue('party_type');
                        this.setFieldProperties('party', {
                            reqd: val ? 1 : 0,
                            read_only: val ? 0 : 1,
                        });
                        if (!val) this.setValue('party', '');
                    },
                },
                project: {
                    get_query: function() {
                        return {filters : {company: this.getValue('company')}};
                    },
                },
            })
            .addCustomAction('Save & Add', function() {
                var data = this.getValues();
                if (!data) {
                    this.showError('Unable to get the expense inputs.');
                    return;
                }
                this.disableAllFields();
                frappe.dom.freeze(__('Creating {0}', [this._doctype]));
                frappe.E.call(
                    'add_expense',
                    {data},
                    frappe.E.fn(function(ret) {
                        if (!ret) {
                            this.showError('Unable to save the expense.');
                            return;
                        }
                        this.clear();
                        this.enableAllFields();
                        frappe.show_alert({
                            indicator: 'green',
                            message: __(this._doctype + ' saved successfully.')
                        });
                    }, this),
                    function() { frappe.dom.unfreeze(); }
                );
            }, 'start')
            .setPrimaryAction('Save', function() {
                let data = this.getValues();
                if (!data) {
                    this.showError('Unable to get the expense inputs');
                    return;
                }
                this.hide();
                frappe.dom.freeze(__('Creating {0}', [this._doctype]));
                frappe.E.call(
                    'add_expense',
                    {data},
                    frappe.E.fn(function(ret) {
                        if (!ret) {
                            frappe.E.error('Unable to save the expense');
                            return;
                        }
                        frappe.show_alert({
                            indicator: 'green',
                            message: __(this._doctype +' saved successfully.')
                        });
                    }, this),
                    function() { frappe.dom.unfreeze(); }
                );
            })
            .setSecondaryAction('Cancel', function() {
                this.hide();
            })
            .onClear(function() {
                this.unset('_expense_data', '_expense_cost', '_expense_qty');
            })
            .extend('_setAccountData', function() {
                var company = this.getValue('company'),
                item = this.getValue('expense_item');
                if (!company || !item) {
                    this.setValue('expense_account', '');
                    this.setValue('currency', '');
                    this.unset('_expense_cost', '_expense_qty');
                    return;
                }
                var ckey = company + '-' + item,
                resolve = frappe.E.fn(function(v) {
                    this.setValue('expense_account', v.account);
                    this.setValue('currency', v.currency);
                    if (flt(v.cost) > 0) {
                        this.setValue('cost', v.cost);
                        this.setFieldProperty('cost', 'read_only', 1);
                    } else if (flt(v.min_cost) > 0 || flt(v.max_cost) > 0) {
                        this.extend('_expense_cost', {min: flt(v.min_cost), max: flt(v.max_cost)});
                    }
                    if (flt(v.qty) > 0) {
                        this.setValue('qty', v.qty);
                        this.setFieldProperty('qty', 'read_only', 1);
                    } else if (flt(v.min_qty) > 0 || flt(v.max_qty) > 0) {
                        this.extend('_expense_qty', {min: flt(v.min_qty), max: flt(v.max_qty)});
                    }
                }, this);
                this.extend('_expense_data', {});
                if (this._expense_data[ckey]) {
                    resolve(this._expense_data[ckey]);
                    return;
                }
                frappe.E.call(
                    'get_item_company_account_data',
                    {item, company},
                    frappe.E.fn(function(ret) {
                        if (
                            !ret || !frappe.E.isPlainObject(ret)
                            || !ret.account || !ret.currency
                        ) {
                            this.showError('Unable to get the currencies of {0}', [item]);
                            return;
                        }
                        this._expense_data[ckey] = ret;
                        resolve(ret);
                    }, this)
                );
            })
            .extend('_updateTotal', function() {
                let cost = flt(this.getValue('cost')),
                qty = flt(this.getValue('qty'));
                this.setValue('total', flt(cost * qty));
            });
        
        frappe.E.call('with_expense_claim', function(ret) {
            if (!!ret) {
                base.dialog.setFieldProperties('expense_claim', {
                    options: 'Expense Claim',
                    hidden: 0,
                    get_query: function() {
                        return {
                            filters: {
                                employee: this.getValue('paid_by'),
                                company: this.getValue('company'),
                                is_paid: 1,
                                status: 'Paid',
                                docstatus: 1,
                            }
                        };
                    },
                })
                .extend('with_expense_claim', true);
            }
        }, function() { base.dialog.build(); });
        
        list.page.add_inner_button(
            __('Quick Add'), function() { frappe.listview_settings.Expense.dialog.show(); },
            null, 'primary'
        );
        list.page.add_actions_menu_item(
            __('Make Request'),
            function() {
                var selected = list.get_checked_items(),
                company = null,
                expenses = [];
                if (!selected.length) {
                    frappe.E.error('Please select at least one expense');
                    return;
                }
                frappe.E.each(selected, function(v) {
                    if (cint(v.is_approved) || cint(v.is_requested)) return;
                    if (!company) company = v.company;
                    if (company === v.company) expenses.push(v.name);
                });
                var callback = function() {
                    list.clear_checked_items();
                    frappe.E.setCache('make-expenses-request', {company, expenses});
                    frappe.router.set_route('Form', 'Expenses Request');
                };
                if (expenses.length !== selected.length) {
                    frappe.warn(
                        __('Warning'),
                        __(
                            'Out of the selected expenses, only {0} are valid and can be included in the same expenses request',
                            [expenses.length]
                        ),
                        callback,
                        __('Proceed'),
                        false
                    );
                } else callback();
            },
            true
        );
    },
    hide_name_column: true,
    get_indicator: function(doc) {
        if (cint(doc.docstatus) === 2) {
            return ['Cancelled', 'red', 'docstatus,=,2'];
        }
        if (cint(doc.is_approved)) {
            return ['Approved', 'green', 'is_approved,=,1|is_requested,=,1|docstatus,=,0'];
        }
        if (cint(doc.is_requested)) {
            return ['Requested', 'blue', 'is_approved,=,0|is_requested,=,1|docstatus,=,0'];
        }
        return ['Pending', 'gray', 'is_approved,=,0|is_requested,=,0|docstatus,=,0'];
    },
    formatters: {
        name: function(v, df, doc) {
            let html = [];
            if (doc.party_type && doc.party) {
                html.push('<small class="text-muted mr-4">' + __(doc.party_type) + ': ' + doc.party + '</small>');
            }
            if (frappe.listview_settings.Expense.dialog._has_hrm && doc.paid_by) {
                html.push('<small class="text-muted mr-4">' + __('Paid By') + ': ' + doc.paid_by + '</small>');
            }
            html = v + (html.length ? '<br/>' + html.join('') : '');
            return html;
        },
        is_advance: function(v) {
            return __(cint(v) ? 'Yes' : 'No');
        },
    },
};