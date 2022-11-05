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
    get_tree_nodes: E.path('get_type_children'),
    add_tree_node: E.path('add_type_node'),
    onload: function(treeview) {
        var settings = frappe.treeview_settings['Expense Type'];
        settings.treeview = treeview;
        settings.ET = {
            qe: E.doc_dialog('Expense Type', 'Add New', 'blue'),
            rows: [],
            companies: E.unique_array(),
        };
        settings.ET.qe
            .extend('treeview', treeview)
            .extend('doctype', treeview.doctype)
            .extend('ET', settings.ET)
            .remove_fields(['disabled', 'parent_type'])
            .remove_properties([
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
                'translatable',
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
                        var ET = this && this.ET;
                        if (this && this.get_field && ET) {
                            let table = this.get_field('expense_accounts');
                            if (table && table.grid && table.grid.get_data) {
                                let data = table.grid.get_data();
                                if (E.is_arr(data) && data.length !== ET.rows.length) {
                                    var rows = [];
                                    E.each(data, function(r) {
                                        if (r.name) rows.push(r.name);
                                        else if (r.idx) rows.push(r.idx);
                                    });
                                    let diff = E.array_diff(ET.rows, rows);
                                    if (E.is_arr(diff)) {
                                        E.each(diff, function(v) {
                                            ET.companies.del(null, v);
                                        });
                                        ET.rows = rows;
                                    }
                                }
                            }
                        }
                        let filters = {is_group: 0};
                        if (ET && ET.companies.length()) {
                            filters.name = ['not in', ET.companies.all()];
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
                        var ET = this.ET;
                        if (ET && ET.companies.has(company)) {
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
                        ET && ET.companies.rpush(company, name);
                        if (name && ET) ET.rows.push(name);
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
            ])
            .set_primary_action('Create', function() {
                let data = this.get_values();
                if (!data) {
                    this.show_error('Unable to get the expense type inputs');
                    return;
                }
                var me = this,
                node = this.selected_node;
                data.parent = node.label;
                data.parent_type = node.label;
                data.doctype = this.doctype;
                if (node.is_root) data.is_root = node.is_root;
                else data.is_root = false;
                this.unset('selected_node');
                this.hide();
                frappe.dom.freeze(__('Creating {0}', [this.doctype]));
                E.call(
                    'add_type_node',
                    {data},
                    function(ret) {
                        if (!ret) {
                            E.error('Unable to create the expense type');
                            return;
                        }
                        if (!ret.exc) me.treeview.tree.load_children(node);
                        frappe.show_alert({
                            indicator: 'green',
                            message: __('Expense type created successfully.')
                        });
                    },
                    function() { frappe.dom.unfreeze(); }
                );
            })
            .set_secondary_action('Cancel', function() { this.hide(); });
    },
    post_render: function(treeview) {
        treeview.page.set_primary_action(__('New'), function() {
            frappe.treeview_settings['Expense Type'].ET.qe
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
                var settings = frappe.treeview_settings['Expense Type'],
                treeview = settings.treeview,
                args = $.extend({}, treeview.args),
                parent_key = 'parent_' + treeview.doctype.toLowerCase().replace(/ /g,'_');
                args[parent_key] = treeview.args.parent;
                settings.ET.qe
                    .set_title('Add Child')
                    .set_values(args)
                    .extend('selected_node', treeview.tree.get_selected_node())
                    .show();
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};