/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.provide('frappe.listview_settings');
frappe.provide('frappe.datetime');
frappe.provide('frappe.perm');


frappe.listview_settings['Expense'] = {
    onload: function(list) {
        var settings = frappe.listview_settings.Expense;
        settings.QE = E.doc_dialog('Expense', 'Add Expense');
        settings.QE.extend('is_super', !!frappe.perm.has_perm('Expense', 1, 'create'));
        if (!settings.QE.is_super) {
            let today = frappe.datetime.moment_to_date_obj(moment());
            settings.QE.set_df_property('required_by', 'options',
                {startDate: today, minDate: today});
        }
        settings.QE.set_fields_properties({
            company: {
                get_query: {filters: {is_group: 0}},
                change: function() { this._set_account_data(); },
            },
            expense_item: {
                get_query: {query: E.path('search_items')},
                change: function() { this._set_account_data(); },
            },
            required_by: {
                change: function() {
                    if (this.is_super) return;
                    let val = this.get_value('required_by');
                    if (
                        val && cint(moment(val, frappe.defaultDateFormat)
                            .diff(moment(), 'days')) < 0
                    ) {
                        this.set_invalid('required_by', 'The minimum required by date is today');
                        this.set_value('required_by', moment().format(frappe.defaultDateFormat));
                    } else {
                        this.set_valid('required_by');
                    }
                },
            },
            cost: {
                change: function() {
                    let cost = flt(this.get_value('cost')),
                    limit = this._expense_cost;
                    if (cost <= 0) {
                        this.set_value('cost', 1);
                    } else if (limit && limit.min && cost < limit.min) {
                        this.set_value('cost', limit.min);
                    } else if (limit && limit.max && cost > limit.max) {
                        this.set_value('cost', limit.max);
                    } else {
                        this._update_total();
                    }
                },
            },
            qty: {
                change: function() {
                    let qty = flt(this.get_value('qty')),
                    limit = this._expense_qty;
                    if (qty <= 0) {
                        this.set_value('qty', 1);
                    } else if (limit && limit.min && qty < limit.min) {
                        this.set_value('qty', limit.min);
                    } else if (limit && limit.max && qty > limit.max) {
                        this.set_value('qty', limit.max);
                    } else {
                        this._update_total();
                    }
                },
            },
            is_paid: {
                change: function() {
                    let val = cint(this.get_value('is_paid'));
                    this.set_df_properties('paid_by', {
                        reqd: val ? 1 : 0,
                        read_only: val ? 0 : 1,
                    });
                    if (!val) this.set_value('paid_by', '');
                },
            },
            party_type: {
                change: function() {
                    let val = this.get_value('party_type');
                    this.set_df_properties('party', {
                        reqd: val ? 1 : 0,
                        read_only: val ? 0 : 1,
                    });
                    if (!val) this.set_value('party', '');
                },
            },
            project: {
                get_query: function() {
                    return {filters : {company: this.get_value('company')}};
                },
            },
        })
        .add_custom_action('Save & Add', function() {
            var data = this.get_values();
            if (!data) {
                this.show_error('Unable to get the expense inputs.');
                return;
            }
            this.disable_all_fields();
            frappe.dom.freeze(__('Creating {0}', ['Expense']));
            var me = this;
            E.call(
                'add_expense',
                {data},
                function(ret) {
                    if (!ret) {
                        me.show_error('Unable to save the expense.');
                        return;
                    }
                    me.clear();
                    me.enable_all_fields();
                    frappe.show_alert({
                        indicator: 'green',
                        message: __('Expense saved successfully.')
                    });
                },
                function() { frappe.dom.unfreeze(); }
            );
        }, 'start')
        .set_primary_action('Save', function() {
            let data = this.get_values();
            if (!data) {
                this.show_error('Unable to get the expense inputs');
                return;
            }
            this.hide();
            frappe.dom.freeze(__('Creating {0}', ['Expense']));
            E.call(
                'add_expense',
                {data},
                function(ret) {
                    if (!ret) {
                        E.error('Unable to save the expense');
                        return;
                    }
                    frappe.show_alert({
                        indicator: 'green',
                        message: __('Expense saved successfully.')
                    });
                },
                function() { frappe.dom.unfreeze(); }
            );
        })
        .set_secondary_action('Cancel', function() {
            this.hide();
        })
        .on_clear(function() {
            this.unset('_expense_data', '_expense_cost', '_expense_qty');
        })
        .extend('_set_account_data', function() {
            var company = this.get_value('company'),
            item = this.get_value('expense_item');
            if (!company || !item) {
                this.set_value('expense_account', '');
                this.set_value('currency', '');
                this.unset('_expense_cost', '_expense_qty');
                return;
            }
            var ckey = company + '-' + item,
            resolve = E.fn(function(v) {
                this.set_value('expense_account', v.account);
                this.set_value('currency', v.currency);
                if (flt(v.cost) > 0) {
                    this.set_value('cost', v.cost);
                    this.set_df_property('cost', 'read_only', 1);
                } else if (flt(v.min_cost) > 0 || flt(v.max_cost) > 0) {
                    this.extend('_expense_cost', {min: flt(v.min_cost), max: flt(v.max_cost)});
                }
                if (flt(v.qty) > 0) {
                    this.set_value('qty', v.qty);
                    this.set_df_property('qty', 'read_only', 1);
                } else if (flt(v.min_qty) > 0 || flt(v.max_qty) > 0) {
                    this.extend('_expense_qty', {min: flt(v.min_qty), max: flt(v.max_qty)});
                }
            }, this);
            this.extend('_expense_data', {});
            if (this._expense_data[ckey]) {
                resolve(this._expense_data[ckey]);
                return;
            }
            var me = this;
            E.call(
                'get_item_company_account_data',
                {item, company},
                function(ret) {
                    if (
                        !ret || !E.is_obj(ret)
                        || !ret.account || !ret.currency
                    ) {
                        me.show_error('Unable to get the currencies of {0}', [item]);
                        return;
                    }
                    me._expense_data[ckey] = ret;
                    resolve(ret);
                }
            );
        })
        .extend('_update_total', function() {
            let cost = flt(this.get_value('cost')),
            qty = flt(this.get_value('qty'));
            this.set_value('total', flt(cost * qty));
        });
        E.call('has_hrm', function(ret) {
            if (!!ret) {
                settings.QE._has_hrm = 1;
                settings.QE
                    .set_df_property('is_paid', 'hidden', 1)
                    .set_df_property('paid_by', 'hidden', 1)
                    .set_df_property('type_column', 'hidden', 1)
                    .set_df_property('type_adv_column', 'hidden', 0);
            }
        });
        list.page.add_inner_button(
            __('Quick Add'), function() { frappe.listview_settings.Expense.QE.show(); },
            null, 'primary'
        );
        list.page.add_actions_menu_item(
            __('Make Request'),
            function() {
                var selected = list.get_checked_items(),
                company = null,
                expenses = [];
                if (!selected.length) {
                    E.error('Please select at least one expense');
                    return;
                }
                E.each(selected, function(v) {
                    if (cint(v.is_approved) || cint(v.is_requested)) return;
                    if (!company) company = v.company;
                    if (company === v.company) expenses.push(v.name);
                });
                var callback = function() {
                    E.set_cache('make-expenses-request', {company, expenses});
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
        if (doc.docstatus === 2) {
            return ['Cancelled', 'red', 'docstatus,=,2'];
        }
        if (cint(doc.is_approved)) {
            return ['Requested', 'green', 'is_approved,=,1|docstatus,=,0'];
        }
        return cint(doc.is_requested)
            ? ['Requested', 'blue', 'is_requested,=,1|docstatus,=,0']
            : ['Pending', 'gray', 'is_requested,=,0|docstatus,=,0'];
    },
    formatters: {
        name: function(v, df, doc) {
            if (frappe.listview_settings.Expense.QE._has_hrm || !doc.paid_by) return v;
            let html = v;
            html += '<br/>';
            html += '<small>';
            html += __('Paid By') + ': ';
            html += doc.paid_by;
            html += '</small>';
            return html;
        },
        is_advance: function(v) {
            return __(cint(v) ? 'Yes' : 'No');
        },
    },
};