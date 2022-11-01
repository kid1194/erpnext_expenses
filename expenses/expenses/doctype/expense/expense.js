/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.provide('frappe.session');


frappe.ui.form.on('Expense', {
    setup: function(frm) {
        Expenses.init(frm);
        frm.E = {
            is_requested: false,
            expense_data: {},
            expense_cost: null,
            expense_qty: null,
            ckey: function(c, i) { return c + '-' + i; },
            del_files: [],
        };
        E.call('has_hrm', function(ret) {
            if (!!ret) {
                E.set_dfs_property(
                    ['is_paid', 'paid_by', 'type_column'], 'hidden', 1
                );
                E.set_df_property('type_adv_column', 'hidden', 0);
            }
        });
    },
    onload: function(frm) {
        if (cint(frm.doc.is_requested)) return;
        frm.set_query('company', {filters: {is_group: 0}});
        frm.set_query('expense_item', {query: E.path('search_items')});
    },
    refresh: function(frm) {
        if (cint(frm.doc.is_requested) && !frm.E.is_requested) {
            frm.E.is_requested = true;
            frm.disable_form();
            frm.set_intro(
                __(
                    frm.doctype
                    + ' cannot be modified after being included in '
                    + 'an Expenses Request'
                ),
                'red'
            );
            if (
                !frappe.model.can_create(frm.doctype)
                || !frappe.model.can_write(frm.doctype)
                || (frm.doc.owner && frm.doc.owner !== frappe.session.user)
            ) return;
            frm.E.attach_row = new Expenses.QuickEntry(
                'Expense Attachment',
                'Attach Row',
                'blue'
            );
            frm.E.attach_row
                .add_custom_action(
                    'Save & Add',
                    function() {
                        let row = this.get_values();
                        if (row && row.file) frm.add_child('attachments', row);
                        this.clear();
                    },
                    'start'
                )
                .set_primary_action(
                    'Save',
                    function() {
                        let row = this.get_values();
                        if (row && row.file) frm.add_child('attachments', row);
                        this.hide();
                    }
                )
                .set_secondary_action('Cancel', function() { this.hide(); });
            frm.get_field('attachments').grid.add_custom_button(
                __('Attach Row'),
                function() { frm.E.attach_row.show(); }
            ).removeClass('hidden btn-default').addClass('btn-secondary');
            return;
		}
		if (cint(frm.doc.is_requested)) return;
		if (frm.is_new()) frm.trigger('add_save_button');
	    else frm.trigger('add_toolbar_button');
    },
    company: function(frm) {
        frm.trigger('set_account_data');
    },
    expense_item: function(frm) {
        frm.trigger('set_account_data');
    },
    set_account_data: function(frm) {
        if (!frm.is_dirty()) return;
        var company = frm.doc.company,
        item = frm.doc.expense_item;
        if (!company || !item) {
            frm.set_value('expense_account', '');
            frm.set_value('currency', '');
            frm.E.expense_cost = frm.E.expense_qty = null;
            return;
        }
        var ckey = frm.E.ckey(company, item);
        (new Promise(function(resolve, reject) {
            if (frm.E.expense_data[ckey]) {
                resolve(frm.E.expense_data[ckey]);
                return;
            }
            E.call(
                'get_item_company_account_data',
                {item, company},
                function(ret) {
                    if (
                        !ret || !$.isPlainObject(ret)
                        || !ret.account || !ret.currency
                    ) {
                        E.error('Unable to get the currencies of {0}', [item]);
                        reject();
                        return;
                    }
                    frm.E.expense_data[ckey] = ret;
                    resolve(ret);
                }
            );
        })).then(function(v) {
            frm.set_value('expense_account', v.account);
            frm.set_value('currency', v.currency);
            if (flt(v.cost) > 0) {
                frm.set_value('cost', v.cost);
                frm.toggle_enable('cost', 0);
            } else if (flt(v.min_cost) > 0 || flt(v.max_cost) > 0) {
                frm.E.expense_cost = {min: flt(v.min_cost), max: flt(v.max_cost)};
            }
            if (flt(v.qty) > 0) {
                frm.set_value('qty', v.qty);
                frm.toggle_enable('qty', 0);
            } else if (flt(v.min_qty) > 0 || flt(v.max_qty) > 0) {
                frm.E.expense_qty = {min: flt(v.min_qty), max: flt(v.max_qty)};
            }
        });
    },
    required_by: function(frm) {
        if (
            frm.doc.required_by
            && cint(moment(frm.doc.required_by, frappe.defaultDateFormat)
                .diff(moment(), 'days')) < 0
        ) {
            E.error('The required by date must not be a previous date');
            frm.set_value('required_by', moment().format(frappe.defaultDateFormat));
        }
    },
    cost: function(frm) {
        let cost = flt(frm.doc.cost),
        limit = frm.E.expense_cost;
        if (cost <= 0) {
            frm.set_value('cost', 1);
        } else if (limit && limit.min && cost < limit.min) {
            frm.set_value('cost', limit.min);
        } else if (limit && limit.max && cost > limit.max) {
            frm.set_value('cost', limit.max);
        } else {
            frm.trigger('update_total');
        }
    },
    qty: function(frm) {
        let qty = flt(frm.doc.qty),
        limit = frm.E.expense_qty;
        if (qty <= 0) {
            frm.set_value('qty', 1);
        } else if (limit && limit.min && qty < limit.min) {
            frm.set_value('qty', limit.min);
        } else if (limit && limit.max && qty > limit.max) {
            frm.set_value('qty', limit.max);
        } else {
            frm.trigger('update_total');
        }
    },
    update_total: function(frm) {
        let cost = flt(frm.doc.cost),
        qty = flt(frm.doc.qty);
        frm.set_value('total', flt(cost * qty));
    },
    after_save: function(frm) {
        if (!cint(frm.doc.is_requested) && frm.E.del_files.length) {
            E.call(
                'delete_attach_files',
                {files: frm.E.del_files},
                function(ret) {
                    frm.E.del_files.clear();
                }
            );
        }
    },
    add_save_button: function(frm) {
        let add_btn = __('Save & Add');
        if (!frm.custom_buttons[add_btn]) {
            frm.clear_custom_buttons();
            frm.add_custom_button(add_btn, function () {
                frm.save().then(function() {
                    frappe.set_route('Form', frm.doctype);
                });
            });
            frm.change_custom_button_type(add_btn, null, 'primary');
        }
    },
    add_toolbar_button: function(frm) {
        let add_btn = __('Add');
        if (!frm.custom_buttons[add_btn]) {
            frm.clear_custom_buttons();
            frm.add_custom_button(add_btn, function () {
                frappe.set_route('Form', frm.doctype);
            });
            frm.change_custom_button_type(add_btn, null, 'primary');
        }
        let req_btn = __('Make Request');
        if (!frm.custom_buttons[req_btn]) {
            frm.add_custom_button(req_btn, function () {
                E.set_cache('make-expenses-request', {
                    company: frm.doc.company,
                    expenses: [frm.doc.name],
                });
                frappe.set_route('Form', 'Expenses Request');
            });
            frm.change_custom_button_type(req_btn, null, 'success');
        }
    }
});

frappe.ui.form.on('Expense Attachment', {
    before_attachments_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (cint(frm.doc.is_requested)) {
            E.error('Removing attachments is not allowed', true);
            return;
        }
        if (row.file) frm.E.del_files.push(row.file);
    },
});