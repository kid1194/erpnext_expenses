/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.provide('frappe.treeview_settings');


frappe.treeview_settings['Expense Type'] = {
    breadcrumb: 'Expense Types',
    title: __('Chart of Expense Types'),
    get_tree_root: false,
    root_label: 'Expense Types',
    show_expand_all: true,
    get_tree_nodes: Expenses.path('get_type_children'),
    add_tree_node: Expenses.path('add_type_node'),
    onload: function(tree) {
        Expenses.init();
        frappe.treeview_settings['Expense Type'].E = {
            qe: new Expenses.QuickEntry('Expense Type', 'Add New', 'blue'),
            rows: [],
            companies: new Expenses.UniqueArray(),
        };
        frappe.treeview_settings['Expense Type'].E.qe
            .remove_fields(['disabled', 'parent_type'])
            .remove_properties([
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
            ])
            .set_fields_properties({
                is_group: {
                    change: function() {
                        if (!this || !this.get_value || !this.set_df_property) return;
                        let val = cint(this.get_value('is_group'));
                        this.set_df_property('expense_accounts', 'read_only', val ? 1 : 0);
                        this.set_df_property('expense_accounts', 'reqd', val ? 0 : 1);
                        this.set_df_property('expense_accounts', 'bold', val ? 0 : 1);
                    },
                },
                company: {
                    get_query: function() {
                        var E = frappe.treeview_settings['Expense Type'].E;
                        if (this && this.get_field) {
                            let table = this.get_field('expense_accounts');
                            if (table && table.grid && table.grid.get_data) {
                                let data = table.grid.get_data();
                                if (E.is_arr(data) && data.length !== E.rows.length) {
                                    var rows = [];
                                    E.each(data, function(r) {
                                        if (r.name) rows.push(r.name);
                                        else if (r.idx) rows.push(r.idx);
                                    });
                                    let diff = E.array_diff(E.rows, rows);
                                    if (E.is_arr(diff)) {
                                        E.each(diff, function(v) {
                                            E.companies.del(null, v);
                                        });
                                        E.rows = rows;
                                    }
                                }
                            }
                        }
                        let filters = {is_group: 0};
                        if (E.companies.length()) {
                            filters.name = ['not in', E.companies.all()];
                        }
                        return {filters};
                    },
                    change: function() {
                        if (!this || !this.get_field) return;
                        let table = this.get_field('expense_accounts');
                        if (!table || !table.grid || !table.grid.get_row) return;
                        let last = table.grid.get_row(-1);
                        if (!last || !last.get_field) return;
                        let field = last.get_field('company');
                        if (!field || !field.get_value) return;
                        let name = last.doc && last.doc.name || (last.doc && last.doc.idx || null),
                        company = field.get_value();
                        if (company == null) return;
                        var E = frappe.treeview_settings['Expense Type'].E;
                        if (E.companies.has(company)) {
                            if (field.df) field.df.invalid = 1;
                            field.set_value('');
                            field.set_invalid();
                            field.refresh && field.refresh();
                            field.refresh_input && field.refresh_input();
                            company = '';
                        }
                        if (!company) {
                            last.toggle_editable && last.toggle_editable('account', 0);
                            last.get_field('account').set_value('');
                            return;
                        }
                        E.companies.rpush(company, name);
                        if (name) E.rows.push(name);
                    },
                },
                account: {
                    get_query: function(doc, cdt, cdn) {
                        var filters = {
                            is_group: 0,
                            root_type: 'Expense',
                        };
                        if (this && this.get_field) {
                            let table = this.get_field('expense_accounts');
                            if (table && table.grid && table.grid.get_row) {
                                let last = table.grid.get_row(-1);
                                if (last && last.get_field) {
                                    let field = last.get_field('company');
                                    if (field && field.get_value) {
                                        filters.company = field.get_value();
                                    }
                                }
                            }
                        }
                        return {filters};
                    },
                },
            })
            .sort_fields([
                'main_section', 'type_name', 'main_column', 'is_group',
                'accounts_section', 'expense_accounts'
            ]);
    },
    post_render: function(treeview) {
        treeview.page.set_primary_action(__('New'), function() {
            frappe.treeview_settings['Expense Type'].E.qe
                .set_title('Add New')
                .show();
        }, 'add');
    },
    toolbar: [
        {
            label: __('Add Child'),
            condition: function(node) {
                return frappe.boot.user.can_create.indexOf('Expense Type') >= 0
                    && node.expandable && !node.hide_add;
            },
            click: function() {
                frappe.treeview_settings['Expense Type'].E.qe
                    .set_title('Add Child')
                    .show();
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};