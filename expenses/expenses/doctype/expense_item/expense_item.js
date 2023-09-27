/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Item', {
    setup: function(frm) {
        frappe.Expenses();
        frappe.E.form(frm);
        frm._companies = frappe.E.tableArray();
    },
    onload: function(frm) {
        frappe.E.setFieldProperties('expense_accounts.account', {reqd: 0, bold: 0});
        frappe.E.setFieldsProperty(
            'expense_section cost min_cost max_cost expense_column qty min_qty max_qty',
            'hidden', 0, 'expense_accounts'
        );
        frappe.E.setFieldsProperty('cost qty', 'in_list_view', 1, 'expense_accounts');
        
        frm.set_query('expense_type', {query: frappe.E.path('search_types')});
        frm.set_query('company', 'expense_accounts', function(doc, cdt, cdn) {
            let filters = {is_group: 0};
            if (frm._companies.length)
                filters.name = ['not in', frm._companies.col(0)];
            return {filters};
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            return {filters: {
                is_group: 0,
                root_type: 'Expense',
                company: locals[cdt][cdn].company,
            }};
        });
        
        frm.add_fetch('account', 'account_currency', 'currency', 'Expense Account');
        
        if (!frm.is_new()) {
            frappe.E.each(frm.doc.expense_accounts, function(v) {
                frm._companies
                    .add(v.name, v.company, 0)
                    .add(v.name, v.account, 1);
            });
        }
    },
});

frappe.ui.form.on('Expense Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frm._companies.del(row.name || cdn);
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!cstr(row.company).length) {
            frm._companies.del(row.name || cdn);
            if (cstr(row.account).length)
                frappe.E.setDocValue(row, 'account', '');
        } else frm._companies.add(row.name || cdn, row.company, 0);
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!cstr(row.company).length) {
            frappe.E.error('Please select a company first');
            if (cstr(row.account).length)
                frappe.E.setDocValue(row, 'account', '');
            return;
        }
        if (!cstr(row.account).length && !cstr(row.company).length) return;
        let ckey = frm._companies.eqKey(row.account, 1),
        crow = frm._companies.eqRow(row.account, 1);
        if (
            ckey && crow && ckey !== (row.name || cdn)
            && crow[0] === row.company
        ) {
            frappe.E.error(
                'The expense account "{0}" for "{1}" already exist',
                [row.account, row.company]
            );
            frappe.E.setDocValue(row, 'account', '');
            return;
        }
        frm._companies.add(row.name || cdn, row.account, 1);
    },
    cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!flt(row.cost)) return;
        if (flt(row.cost) < 0) {
            frappe.E.setDocValue(row, 'cost', 0);
            return;
        }
        frappe.E.refreshRowField('expense_accounts', cdn, 'min_cost', 'max_cost');
    },
    min_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.min_cost);
        if (!val) return;
        let max = flt(row.max_cost);
        if (val < 0 || flt(row.cost) > 0 || (max > 0 && val >= max)) {
            frappe.E.setDocValue(row, 'min_cost', 0);
        }
    },
    max_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.max_cost);
        if (!val) return;
        let min = flt(row.min_cost);
        if (val < 0 || flt(row.cost) > 0 || (min > 0 && val <= min)) {
            frappe.E.setDocValue(row, 'max_cost', 0);
        }
    },
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!flt(row.qty)) return;
        if (flt(row.qty) < 0) {
            frappe.E.setDocValue(row, 'qty', 0);
            return;
        }
        frappe.E.refreshRowField('expense_accounts', cdn, 'min_qty', 'max_qty');
    },
    min_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.min_qty);
        if (!val) return;
        let max = flt(row.max_qty);
        if (val < 0 || flt(row.qty) > 0 || (max > 0 && val >= max)) {
            frappe.E.setDocValue(row, 'min_qty', 0);
        }
    },
    max_qty: function(frm, cdt, cdn) {
       let row = locals[cdt][cdn],
        val = flt(row.max_qty);
        if (!val) return;
        let min = flt(row.min_qty);
        if (val < 0 || flt(row.qty) > 0 || (min > 0 && val <= min)) {
            frappe.E.setDocValue(row, 'max_qty', 0);
        }
    },
});