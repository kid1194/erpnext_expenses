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
    get_tree_nodes: Expenses.path('get_type_children'),
    add_tree_node: Expenses.path('add_type_node'),
    fields: [
        {
            fieldname: 'main_section',
            fieldtype: 'Section Break',
        },
        {
            fieldname: 'type_name',
            fieldtype: 'Data',
            label: 'Name',
            reqd: 1,
            bold: 1,
        },
        {
            fieldname: 'main_column',
            fieldtype: 'Column Break',
        },
        {
            fieldname: 'is_group',
            fieldtype: 'Check',
            label: __('Is Group'),
            description: __('Type items can only be created under Groups and Expense Items can only belong to type items'),
            'default': 0,
            change: function() {
                let d = cur_dialog;
                if (d && d.get_value && d.set_df_property) {
                    let val = cint(d.get_value('is_group'));
                    d.set_df_property('expense_accounts', 'read_only', val ? 1 : 0);
                    d.set_df_property('expense_accounts', 'reqd', val ? 0 : 1);
                    d.set_df_property('expense_accounts', 'bold', val ? 0 : 1);
                }
            },
        },
        {
            fieldname: 'accounts_section',
            fieldtype: 'Section Break',
        },
        {
            fieldname: 'expense_accounts',
            fieldtype: 'Table',
            label: __('Expense Accounts'),
            options: 'Expense Account',
            reqd: 1,
            bold: 1,
            fields: [
                {
                    fieldname: 'company',
                    fieldtype: 'Link',
                    label: 'Company',
                    options: 'Company',
                    reqd: 1,
                    bold: 1,
                    only_select: 1,
                    ignore_user_permissions: 1,
                    get_query: function() {
                        let d = cur_dialog,
                        filters = {is_group: 0},
                        names = [];
                        if (d && d.get_field) {
                            let table = d.get_field('expense_accounts');
                            if (
                                table && table.grid
                                && Array.isArray(table.grid.grid_rows)
                                && table.grid.grid_rows.length
                            ) {
                                table.grid.grid_rows.forEach(function(row) {
                                    if (row && row.doc && row.doc.company) {
                                        names.push(row.doc.company);
                                    }
                                });
                            }
                        }
                        if (names.length) filters.name = ['not in', names];
                        return {filters};
                    },
                    change: function() {
                        let d = cur_dialog;
                        if (d && d.get_field) {
                            let table = d.get_field('expense_accounts');
                            if (table && table.grid && table.grid.get_row) {
                                let last = table.grid.get_row(-1);
                                if (last && last.doc && last.doc.company != null && last.toggle_editable) {
                                    last.toggle_editable('account', last.doc.company ? 1 : 0);
                                    if (last.get_field) last.get_field('account').set_value('');
                                }
                            }
                        }
                    },
                },
                {
                    fieldname: 'main_column',
                    fieldtype: 'Column Break',
                },
                {
                    fieldname: 'account',
                    fieldtype: 'Link',
                    label: 'Expense Account',
                    options: 'Account',
                    reqd: 1,
                    bold: 1,
                    only_select: 1,
                    ignore_user_permissions: 1,
                    get_query: function(doc, cdt, cdn) {
                        let d = cur_dialog,
                        filters = {
                            is_group: 0,
                            root_type: 'Expense',
                        };
                        if (d && d.get_field) {
                            let table = d.get_field('expense_accounts');
                            if (table && table.grid && table.grid.get_row) {
                                let last = table.grid.get_row(-1);
                                if (last && last.doc && last.doc.company) {
                                    filters.company = last.doc.company;
                                }
                            }
                        }
                        return {filters};
                    },
                },
            ],
        },
    ],
    onload: function(treeview) {
        frappe.treeview_settings['Expense Type'].treeview = {};
        $.extend(frappe.treeview_settings['Expense Type'].treeview, treeview);
    },
    post_render: function(treeview) {
        frappe.treeview_settings['Expense Type'].treeview.tree = treeview.tree;
        treeview.page.set_primary_action(__('New'), function() {
            treeview.new_node();
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
                frappe.views.trees['Expense Type'].new_node();
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};