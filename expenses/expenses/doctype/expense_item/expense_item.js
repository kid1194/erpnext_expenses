/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expense Item', {
    setup: function(frm) {
        E.frm(frm);
        frm.E = {
            companies: E.unique_array(),
        };
    },
    onload: function(frm) {
        E.df_properties('account', {reqd: 0, bold: 0}, 'expense_accounts');
        E.dfs_property(
            'expense_section cost min_cost max_cost expense_column qty min_qty max_qty',
            'hidden', 0, 'expense_accounts'
        );
        E.dfs_property('cost qty', 'in_list_view', 1, 'expense_accounts');
        
        frm.set_query('expense_type', {query: E.path('search_types')});
        frm.set_query('company', 'expense_accounts', {filters: {is_group: 0}});
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            return {filters: {
                is_group: 0,
                root_type: 'Expense',
                company: locals[cdt][cdn].company,
            }};
        });
        
        frm.add_fetch('account', 'account_currency', 'currency', 'Expense Account');
    },
});

frappe.ui.form.on('Expense Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        frm.E.companies.del(locals[cdt][cdn].company, cdn);
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.company) {
            frm.E.companies.del(null, cdn);
            row.account = '';
            E.refresh_row_df('expense_accounts', cdn, 'account');
            return;
        }
        if (!frm.E.companies.has(row.company)) {
            frm.E.companies.rpush(row.company, cdn);
            return;
        }
        E.error(
            'The expense account for {0} has already been set',
            [row.company]
        );
        row.company = '';
        E.refresh_row_df('expense_accounts', cdn, 'company');
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.account || row.company) return;
        E.error('Please select a company first');
        row.account = '';
        E.refresh_row_df('expense_accounts', cdn, 'account');
    },
    cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!flt(row.cost)) return;
        if (flt(row.cost) < 0) {
            row.cost = 0;
            E.refresh_row_df('expense_accounts', cdn, 'cost');
            return;
        }
        E.refresh_row_df('expense_accounts', cdn, 'min_cost', 'max_cost');
    },
    min_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.min_cost);
        if (!val) return;
        let max = flt(row.max_cost);
        if (val < 0 || flt(row.cost) > 0 || (max > 0 && val >= max)) {
            row.min_cost = 0;
            E.refresh_row_df('expense_accounts', cdn, 'min_cost');
        }
    },
    max_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.max_cost);
        if (!val) return;
        let min = flt(row.min_cost);
        if (val < 0 || flt(row.cost) > 0 || (min > 0 && val <= min)) {
            row.max_cost = 0;
            E.refresh_row_df('expense_accounts', cdn, 'max_cost');
        }
    },
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!flt(row.qty)) return;
        if (flt(row.qty) < 0) {
            row.qty = 0;
            E.refresh_row_df('expense_accounts', cdn, 'qty');
            return;
        }
        E.refresh_row_df('expense_accounts', cdn, 'min_qty', 'max_qty');
    },
    min_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn],
        val = flt(row.min_qty);
        if (!val) return;
        let max = flt(row.max_qty);
        if (val < 0 || flt(row.qty) > 0 || (max > 0 && val >= max)) {
            row.min_qty = 0;
            E.refresh_row_df('expense_accounts', cdn, 'min_qty');
        }
    },
    max_qty: function(frm, cdt, cdn) {
       let row = locals[cdt][cdn],
        val = flt(row.max_qty);
        if (!val) return;
        let min = flt(row.min_qty);
        if (val < 0 || flt(row.qty) > 0 || (min > 0 && val <= min)) {
            row.max_qty = 0;
            E.refresh_row_df('expense_accounts', cdn, 'max_qty');
        }
    },
});