/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.ui.form.on('Expense Item', {
    setup: function(frm) {
        Expenses.init(frm);
        frm.E = {
            last_type: '',
            accounts_companies: new Expenses.UniqueArray()
        };
    },
    onload: function(frm) {
        E.each(
            ('expense_section cost min_cost max_cost '
            + 'expense_column qty min_qty max_qty').split(' '),
            function(f, i) {
                let df = frm.get_docfield('expense_accounts', f);
                df.hidden = 0;
                if (i === 1 || i === 5) df.in_list_view = 1;
            }
        );
        frm.set_query('expense_type', function() {
            return {filters: {is_group: 0}};
        });
        frm.set_query('company', 'expense_accounts', function() {
            return {
                query: E.path('search_type_companies'),
                filters: {expense_type: frm.doc.expense_type}
            };
        });
        frm.set_query('account', 'expense_accounts', function(doc, cdt, cdn) {
            return {filters: {
                is_group: 0,
                root_type: 'Expense',
                company: locals[cdt][cdn].company,
            }};
        });
        frm.add_fetch('account', 'account_currency', 'currency', 'Expense Account');
    },
    expense_type: function(frm) {
        var type = frm.doc.expense_type;
        if (type === frm.E.last_type) return;
        (new Promise(function(resolve, reject) {
            if (
                !frm.E.last_type
                || !frm.doc.expense_accounts.length
            ) {
                resolve();
                return;
            }
            frappe.confirm(
                __(
                    'Changing the Expense Type will clear the Expense Accounts table. '
                    + 'Do you want to continue?'
                ),
                function() { resolve(); },
                function() {
                    frm.doc.expense_type = frm.E.last_type;
                    E.refresh_field('expense_type');
                    reject();
                }
            );
        })).then(function() {
            frm.E.last_type = type;
            frm.E.accounts_companies.clear();
            E.clear_table('expense_accounts');
        });
    },
});

frappe.ui.form.on('Expense Account', {
    before_expense_accounts_remove: function(frm, cdt, cdn) {
        frm.E.accounts_companies.del(locals[cdt][cdn].company, cdn);
    },
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.company) {
            frm.E.accounts_companies.del(null, cdn);
            row.account = '';
            E.refresh_row_field('expense_accounts', cdn, 'account');
            return;
        }
        if (frm.E.accounts_companies.has(row.company)) {
            E.error(
                'The expense account for {0} has already been set',
                [row.company]
            );
            row.company = '';
            E.refresh_row_field('expense_accounts', cdn, 'company');
            return;
        }
        frm.E.accounts_companies.rpush(row.company, cdn);
    },
    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.account && !row.company) {
            E.error('Please select a company first');
            row.account = '';
            E.refresh_row_field('expense_accounts', cdn, 'account');
        }
    },
    cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (flt(row.cost) > 0) {
            row.min_cost = 0;
            row.max_cost = 0;
            E.refresh_row_field('expense_accounts', cdn, 'min_cost', 'max_cost');
        }
    },
    min_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (
            (flt(row.cost) > 0 && flt(row.min_cost) > 0)
            || (
                flt(row.min_cost) > 0 && flt(row.max_cost) > 0
                && flt(row.min_cost) >= flt(row.max_cost)
            )
        ) {
            row.min_cost = 0;
            E.refresh_row_field('expense_accounts', cdn, 'min_cost');
        }
    },
    max_cost: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (
            (flt(row.cost) > 0 && flt(row.min_cost) > 0)
            || (
                flt(row.min_cost) > 0 && flt(row.max_cost) > 0
                && flt(row.min_cost) <= flt(row.max_cost)
            )
        ) {
            row.max_cost = 0;
            E.refresh_row_field('expense_accounts', cdn, 'max_cost');
        }
    },
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (flt(row.qty) > 0) {
            row.min_qty = 0;
            row.max_qty = 0;
            E.refresh_row_field('expense_accounts', cdn, 'min_qty', 'max_qty');
        }
    },
    min_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (
            (flt(row.qty) > 0 && flt(row.min_qty) > 0)
            || (
                flt(row.min_qty) > 0 && flt(row.max_qty) > 0
                && flt(row.min_qty) >= flt(row.max_qty)
            )
        ) {
            row.min_qty = 0;
            E.refresh_row_field('expense_accounts', cdn, 'min_qty');
        }
    },
    max_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (
            (flt(row.qty) > 0 && flt(row.max_qty) > 0)
            || (
                flt(row.min_qty) > 0 && flt(row.max_qty) > 0
                && flt(row.max_qty) <= flt(row.min_qty)
            )
        ) {
            row.max_qty = 0;
            E.refresh_row_field('expense_accounts', cdn, 'max_qty');
        }
    },
});