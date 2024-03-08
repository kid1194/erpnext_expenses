/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Item', {
    onload: function(frm) {
        frappe.exp().on('ready change', function() { this.setup_form(frm); });
        frm._item = {
            table: frappe.exp().table(2),
            old_type: null,
            sync_timeout: null,
        };
        frm.set_query('expense_type', function(doc) {
            return {query: frappe.exp().get_method('search_item_types')};
        });
        frappe.exp().disable_table(frm, 'expense_accounts', {editable: 1});
        if (!!frm.is_new()) return;
        frm._item.old_type = cstr(frm.doc.expense_type);
        frm.events.update_expense_accounts(frm);
        frm.events.accounts_sync(frm, 1);
    },
    expense_type: function(frm) {
        let type = cstr(frm.doc.expense_type);
        if (!type.length) return frm.events.enqueue_accounts_sync(frm, 1);
        if (frm._item.old_type === type) return;
        frm._item.old_type = type;
        frm.events.enqueue_accounts_sync(frm);
    },
    validate: function(frm) {
        frm.events.update_expense_accounts(frm);
        if (!cstr(frm.doc.name).length) {
            frappe.exp()
                .focus(frm, 'name')
                .error(__(frm.doctype), __('A valid expense item name is required.'));
            return false;
        }
        if (!cstr(frm.doc.expense_type).length) {
            frappe.exp()
                .focus(frm, 'expense_type')
                .error(__(frm.doctype), __('A valid expense type is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expense_accounts)) {
            frappe.exp()
                .focus(frm, 'expense_accounts')
                .error(__(frm.doctype), __('The expense accounts table is empty.'));
            return false;
        }
    },
    enqueue_accounts_sync: function(frm, clear) {
        frappe.exp().$timeout(frm._item.sync_timeout);
        frm._item.sync_timeout = null;
        !clear && (frm._item.sync_timeout = frappe.exp().$timeout(function() {
            frm._item.sync_timeout = null;
            frm.events.accounts_sync(frm);
        }, 1000));
    },
    accounts_sync: function(frm, up) {
        frappe.exp().request(
            'get_type_accounts_list',
            {type_name: cstr(frm.doc.expense_type)},
            function(ret) {
                if (!this.$isArrVal(ret)) return this.error(
                    __(frm.doctype),
                    __('The expense type "{0}" has no self or inherited expense accounts.', [cstr(frm.doc.expense_type)])
                );
                !up && frm.clear_table('expense_accounts');
                !up && frm._item.table.clear();
                for (let i = 0, l = ret.length, v; i < l; i++) {
                    if (up && frm._item.table.has(cstr(ret[i].company), 1)) continue;
                    v = frm.add_child('expense_accounts', ret[i]);
                    frm._item.table.add(cstr(v.name), cstr(v.company), cstr(v.account));
                }
            },
            function(e) {
                this.error(
                    __(frm.doctype),
                    __('Failed to import the expense accounts from expense type "{0}".', [cstr(frm.doc.expense_type)])
                );
            }
        );
    },
    update_expense_accounts: function(frm) {
        frm._item.table.clear();
        if (!frappe.exp().$isArrVal(frm.doc.expense_accounts)) return;
        let keep = [],
        len = frm.doc.expense_accounts.length;
        for (let i = 0, v, n, c, a; i < len; i++) {
            v = frm.doc.expense_accounts[i];
            if (
                !frappe.exp().$isStrVal(v.company)
                || !frappe.exp().$isStrVal(v.account)
                || frm._item.table.has(v.company, 1)
                || frm._item.table.has(v.account, 2)
            ) continue;
            keep.push(v);
            frm._item.table.add(cstr(v.name), v.company, v.account);
        }
        if (keep.length && keep.length !== len) {
            frm.set_value('expense_accounts', keep);
            frappe.exp().disable_table(frm, 'expense_accounts', {editable: 1});
        }
    }
});


frappe.ui.form.on('Expense Item Account', {
    cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        key = 'cost',
        val = flt(row[key]);
        if (!val) return;
        if (val < 0) {
            frappe.model.set_value(cdt, cdn, key, 0);
            return;
        }
        let min = flt(row['min_' + key]),
        max = flt(row['max_' + key]);
        if (min !== 0) frappe.model.set_value(cdt, cdn, 'min_' + key, 0);
        if (max !== 0) frappe.model.set_value(cdt, cdn, 'max_' + key, 0);
    },
    min_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        key = 'cost',
        val = flt(row['min_' + key]);
        if (!val) return;
        let max = flt(row['max_' + key]);
        if (val < 0 || flt(row[key]) > 0 || (max > 0 && val >= max))
            frappe.model.set_value(cdt, cdn, 'min_' + key, 0);
    },
    max_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        key = 'cost',
        val = flt(row['max_' + key]);
        if (!val) return;
        let min = flt(row['min_' + key]);
        if (val < 0 || flt(row[key]) > 0 || (min > 0 && val <= min))
            frappe.model.set_value(cdt, cdn, 'max_' + key, 0);
    },
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        key = 'qty',
        val = flt(row[key]);
        if (!val) return;
        if (val < 0) {
            frappe.model.set_value(cdt, cdn, key, 0);
            return;
        }
        let min = flt(row['min_' + key]),
        max = flt(row['max_' + key]);
        if (min !== 0) frappe.model.set_value(cdt, cdn, 'min_' + key, 0);
        if (max !== 0) frappe.model.set_value(cdt, cdn, 'max_' + key, 0);
    },
    min_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        key = 'qty',
        val = flt(row['min_' + key]);
        if (!val) return;
        let max = flt(row['max_' + key]);
        if (val < 0 || flt(row[key]) > 0 || (max > 0 && val >= max))
            frappe.model.set_value(cdt, cdn, 'min_' + key, 0);
    },
    max_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        key = 'qty',
        val = flt(row['max_' + key]);
        if (!val) return;
        let min = flt(row['min_' + key]);
        if (val < 0 || flt(row[key]) > 0 || (min > 0 && val <= min))
            frappe.model.set_value(cdt, cdn, 'max_' + key, 0);
    }
});