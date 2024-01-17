/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Item', {
    setup: function(frm) {
        frappe.exp()
            .on('ready change', function() {
                this.setup_form(frm);
            })
            .on('exp_item_changed', function(ret) {
                if (!ret) return;
                if (cstr(ret.action) === 'change' && (
                    cstr(ret.item) === cstr(frm.doc.name)
                    || cstr(ret.old_item) === cstr(frm.doc.name)
                )) {
                    let message = __('The expense item data has changed. Reload to update the form.');
                    if (frm.is_dirty())
                        message = message + '<br/><strong class="text-danger">'
                            + __('Warning: All the unsaved changes will be discarded.')
                        + '</strong>';
                    
                    frappe.warn(
                        __('Expense Item Changed'),
                        message,
                        function() { frm.reload_doc(); },
                        __('Reload')
                    );
                } else if (
                    cstr(ret.action) === 'trash'
                    && cstr(ret.item) === cstr(frm.doc.name)
                ) {
                    window.setTimeout(function() {
                        frappe.set_route('List', 'Expense Item');
                    }, 6000);
                    frappe.throw({
                        title: __('Expense Item Removed'),
                        message: __('The expense item has been removed. You will be redirected automatically back to the List View.'),
                    });
                }
            });
        frm._item = {
            table: frappe.exp().table(2),
            old_type: null,
            existing: null,
            selector: null,
            add_table: false,
        };
    },
    onload: function(frm) {
        frm.set_query('expense_type', {
            query: frappe.exp().path('search_types'),
            filters: {is_group: 0},
        });
        
        //frm.add_fetch('account', 'account_currency', 'currency', 'Expense Account');
        
        if (!!frm.is_new()) return;
        
        frm._item.old_type = cstr(frm.doc.expense_type);
        frm.trigger('setup_type');
        
        frm._item.add_table = true;
        frm.trigger('update_expense_accounts');
    },
    expense_type: function(frm) {
        let type = cstr(frm.doc.expense_type);
        if (type.length && frm._item.old_type !== type) {
            frm._item.old_type = type;
            frm.trigger('setup_type');
        }
    },
    validate: function(frm) {
        if (!cstr(frm.doc.name).length) {
            frappe.exp()
                .focus(frm, 'name')
                .error('A valid expense item name is required.');
            return false;
        }
        if (!cstr(frm.doc.expense_type).length) {
            frappe.exp()
                .focus(frm, 'expense_type')
                .error('A valid expense type is required.');
            return false;
        }
        frm.trigger('update_expense_accounts');
    },
    setup_type: function(frm) {
        frappe.exp().request(
            'get_type_accounts',
            {type_name: frm._item.old_type},
            function(ret) {
                if (ret) {
                    frm._item.existing = ret;
                    frm._item.selector = [''];
                    Array.prototype.push.apply(frm._item.selector, Object.keys(ret));
                    frm.get_field('expense_accounts').grid.update_docfield_property(
                        'company', 'options', frm._item.selector
                    );
                } else {
                    frappe.exp().error(
                        'Expense Item Error',
                        'Unable to get the list of expense accounts for the expense type "{0}.',
                        [frm._item.old_type]
                    );
                }
            },
            function(e) {
                frappe.exp()._error(e.message, e.trace);
                frappe.exp().error(
                    'Expense Item Error',
                    'Unable to get the list of expense accounts for the expense type "{0}.',
                    [frm._item.old_type]
                );
                frm._item.old_type = null;
            }
        );
    },
    update_expense_accounts: function(frm) {
        if (!(frm.doc.expense_accounts || []).length) {
            frm._item.add_table = false;
            return;
        }
        var add = frm._item.add_table,
        del = [];
        frm._item.add_table = false;
        frm.doc.expense_accounts.forEach(function(v, i) {
            let company = cstr(v.company),
            account = cstr(v.account);
            if (!add) {
                if (!company.length || !account.length)
                    del.push(i);
            } else {
                let name = cstr(v.name);
                if (!frm._item.table.has(name) && !frm._item.table.has(company, 1))
                    frm._item.table.add(name, company, account);
                else del.push(i);
            }
        });
        if (del.length) {
            var table = frm.doc.expense_accounts.slice();
            del.reverse().forEach(function(i) { table.splice(i, 1); });
            frm.set_value('expense_accounts', table);
            frm.refresh_field('expense_accounts');
        }
    }
});

frappe.ui.form.on('Expense Item Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frm._item.table.del(cstr(row.name || cdn));
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        name = cstr(row.name || cdn),
        company = cstr(row.company),
        account = cstr(row.account),
        currency = cstr(row.account_currency),
        err = 0;
        if (!company.length) err = 1;
        else if (!frm._item.existing[company]) err = 2;
        else if (frm._item.table.has(company, 1)) err = 3;
        if (err) {
            if (err < 3) frm._item.table.del(name);
            if (company.length) frappe.model.set_value(row, 'company', '');
            if (account.length) frappe.model.set_value(row, 'account', '');
            if (currency.length) frappe.model.set_value(row, 'account_currency', '');
            if (err > 1) {
                if (err === 2)
                    err = __(
                        'The expense account company "{0}" has not been added to the expense type "{1}".',
                        [company, frm._item.old_type]
                    );
                else
                    err = __(
                        'The expense account company "{0}" already exist.',
                        [company]
                    );
                
                frappe.exp()
                    .focus(frm, 'expense_accounts', cdn, 'company', 1)
                    .invalid_field(frm, 'expense_accounts', err, cdn, 'company', 1);
            }
        } else {
            account = frm._item.existing[company].account;
            currency = frm._item.existing[company].currency;
            frappe.model.set_value(row, 'account', account);
            frappe.model.set_value(row, 'account_currency', currency);
            frm._item.table.add(name, company, account);
        }
    },
    cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!flt(row.cost)) return;
        if (flt(row.cost) < 0) {
            frappe.model.set_value(row, 'cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'cost');
            return;
        }
        let min = flt(row.min_cost),
        max = flt(row.max_cost);
        if (min !== 0) {
            frappe.model.set_value(row, 'min_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_cost');
        }
        if (max !== 0) {
            frappe.model.set_value(row, 'max_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_cost');
        }
    },
    min_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_cost),
        max = flt(row.max_cost);
        if (min === 0) return;
        if (min < 0 || flt(row.cost) > 0 || (max > 0 && min >= max)) {
            frappe.model.set_value(row, 'min_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_cost');
        }
    },
    max_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_cost),
        max = flt(row.max_cost);
        if (max === 0) return;
        if (max < 0 || flt(row.cost) > 0 || (min > 0 && min >= max)) {
            frappe.model.set_value(row, 'max_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_cost');
        }
    },
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.qty);
        if (val === 0) return;
        if (val < 0) {
            frappe.model.set_value(row, 'qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'qty');
            return;
        }
        let min = flt(row.min_qty),
        max = flt(row.max_qty);
        if (min !== 0) {
            frappe.model.set_value(row, 'min_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_qty');
        }
        if (max !== 0) {
            frappe.model.set_value(row, 'max_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_qty');
        }
    },
    min_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_qty),
        max = flt(row.max_qty);
        if (min === 0) return;
        if (min < 0 || flt(row.qty) > 0 || (max > 0 && min >= max)) {
            frappe.model.set_value(row, 'min_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_qty');
        }
    },
    max_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_qty),
        max = flt(row.max_qty);
        if (max === 0) return;
        if (max < 0 || flt(row.qty) > 0 || (min > 0 && min >= max)) {
            frappe.model.set_value(row, 'max_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_qty');
        }
    },
});