/*
*  Expenses © 2023
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
        frappe.exp().disable_table(frm, 'expense_accounts', 1);
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
                .error(__('A valid expense item name is required.'));
            return false;
        }
        if (!cstr(frm.doc.expense_type).length) {
            frappe.exp()
                .focus(frm, 'expense_type')
                .error(__('A valid expense type is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.expense_accounts)) {
            frappe.exp()
                .focus(frm, 'expense_accounts')
                .error(__('The expense accounts table is empty.'));
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
                if (!this.$isArrVal(ret))
                    return this.error(__('The expense type has no expense accounts.'));
                
                !up && frm.clear_table('expense_accounts');
                for (let i = 0, l = ret.length, v; i < l; i++) {
                    if (up && frm._item.table.has(cstr(ret[i].company), 1)) continue;
                    v = frm.add_child('expense_accounts', ret[i]);
                    frm._item.table.add(cstr(v.name), cstr(v.company), cstr(v.account));
                }
            },
            function(e) {
                this.error(__('Failed to import the expense accounts.'));
            }
        );
    },
    update_expense_accounts: function(frm) {
        frm._item.table.clear();
        if (!frappe.exp().$isArrVal(frm.doc.expense_accounts)) return;
        let keep = [];
        for (let i = 0, l = frm.doc.expense_accounts.length, v, n, c, a; i < l; i++) {
            v = frm.doc.expense_accounts[i];
            if (
                !frappe.exp().$isStrVal(v.company)
                || !frappe.exp().$isStrVal(v.account)
                || frm._item.table.has(cstr(v.company), 1)
            ) continue;
            keep.push(v);
            frm._item.table.add(cstr(v.name), v.company, v.account);
        }
        if (keep.length && keep.length !== frm.doc.expense_accounts.length) {
            frm.set_value('expense_accounts', keep);
            frm.refresh_field('expense_accounts');
        }
    }
});

frappe.ui.form.on('Expense Item Account', {
    cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!flt(row.cost)) return;
        if (flt(row.cost) < 0) {
            frappe.model.set_value(cdt, cdn, 'cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'cost');
            return;
        }
        let min = flt(row.min_cost),
        max = flt(row.max_cost);
        if (min !== 0) {
            frappe.model.set_value(cdt, cdn, 'min_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_cost');
        }
        if (max !== 0) {
            frappe.model.set_value(cdt, cdn, 'max_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_cost');
        }
    },
    min_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_cost),
        max = flt(row.max_cost);
        if (min === 0) return;
        if (min < 0 || flt(row.cost) > 0 || (max > 0 && min >= max)) {
            frappe.model.set_value(cdt, cdn, 'min_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_cost');
        }
    },
    max_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_cost),
        max = flt(row.max_cost);
        if (max === 0) return;
        if (max < 0 || flt(row.cost) > 0 || (min > 0 && min >= max)) {
            frappe.model.set_value(cdt, cdn, 'max_cost', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_cost');
        }
    },
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.qty);
        if (val === 0) return;
        if (val < 0) {
            frappe.model.set_value(cdt, cdn, 'qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'qty');
            return;
        }
        let min = flt(row.min_qty),
        max = flt(row.max_qty);
        if (min !== 0) {
            frappe.model.set_value(cdt, cdn, 'min_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_qty');
        }
        if (max !== 0) {
            frappe.model.set_value(cdt, cdn, 'max_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_qty');
        }
    },
    min_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_qty),
        max = flt(row.max_qty);
        if (min === 0) return;
        if (min < 0 || flt(row.qty) > 0 || (max > 0 && min >= max)) {
            frappe.model.set_value(cdt, cdn, 'min_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'min_qty');
        }
    },
    max_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        min = flt(row.min_qty),
        max = flt(row.max_qty);
        if (max === 0) return;
        if (max < 0 || flt(row.qty) > 0 || (min > 0 && min >= max)) {
            frappe.model.set_value(cdt, cdn, 'max_qty', 0);
            frm.refresh_field('expense_accounts', cdn, 'max_qty');
        }
    },
});