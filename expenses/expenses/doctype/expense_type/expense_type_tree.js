/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.treeview_settings');


frappe.treeview_settings['Expense Type'] = {
    breadcrumb: 'Expense Types',
    title: __('Chart of Expense Types'),
    get_tree_root: false,
    root_label: 'Expense Types',
    show_expand_all: true,
    get_tree_nodes: E.path('get_type_children'),
    onload: function(treeview) {
        let base = frappe.treeview_settings[treeview.doctype];
        base.treeview = treeview;
        base.ET = {
            qe: E.doc_dialog(treeview.doctype, 'Add New', 'blue'),
            rows: [],
            companies: E.unique_array(),
        };
        base.ET.qe
            .extend({
                'treeview': treeview,
                'doctype': treeview.doctype,
                'ET': base.ET,
            })
            .remove_fields('disabled', 'parent_type')
            .replace_properties({
                'depends_on': ['hidden', 1],
                'read_only_depends_on': ['read_only', 1]
            })
            .remove_properties(
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
                'translatable'
            )
            .set_fields_properties({
                is_group: {
                    hidden: 0,
                },
                company: {
                    get_query: function() {
                        var ET = this.ET;
                        let table = this.get_field('expense_accounts');
                        if (table && (table.grid || '').get_data) {
                            let data = table.grid.get_data();
                            if (E.is_arr(data) && data.length !== ET.rows.length) {
                                let rows = data.filter(function(r) {
                                    return (r.name || r.idx) != null;
                                }).map(function(r) {
                                    return r.name || r.idx;
                                }),
                                diff = E.array_diff(ET.rows, rows);
                                E.each(diff, function(v) { ET.companies.del(null, v); });
                                E.clear(ET.rows);
                                E.merge(ET.rows, rows);
                            }
                        }
                        let filters = {is_group: 0};
                        if (ET.companies.length) {
                            filters.name = ['not in', ET.companies.all()];
                        }
                        return {filters};
                    },
                    change: function() {
                        let company = this.get_child_value('expense_accounts', -1, 'company');
                        if (!company) {
                            let row = this.get_row('expense_accounts', -1);
                            row && row.toggle_editable && row.toggle_editable('account', 0);
                            this.set_child_value('expense_accounts', -1, 'account', '');
                            return;
                        }
                        let ET = this.ET;
                        if (ET.companies.has(company)) {
                            this.set_child_invalid(
                                'expense_accounts', -1, 'company',
                                __('The expense account for {0} already exist', [company])
                            );
                            return;
                        }
                        this.set_child_valid('expense_accounts', -1, 'company');
                        let name = this.get_row_name('expense_accounts', -1);
                        ET.companies.rpush(company, name);
                        if (name) ET.rows.push(name);
                    },
                },
                account: {
                    get_query: function() {
                        let filters = {
                            is_group: 0,
                            root_type: 'Expense',
                        },
                        company = this.get_child_value('expense_accounts', -1, 'company');
                        if (company) filters.company = company;
                        return {filters};
                    },
                    change: function() {
                        let account = this.get_child_value('expense_accounts', -1, 'account'),
                        company = this.get_child_value('expense_accounts', -1, 'company');
                        if (!account && company) {
                            this.set_child_value('expense_accounts', -1, 'account', '');
                            this.set_child_invalid(
                                'expense_accounts', -1, 'account',
                                __('Please select a company first')
                            );
                        } else {
                            this.set_child_valid('expense_accounts', -1, 'account');
                        }
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
                let node = this.selected_node || {};
                data.parent = node.label;
                data.parent_type = node.label;
                data.doctype = this.doctype;
                data.is_root = !node || node.is_root;
                this.hide();
                frappe.dom.freeze(__('Creating {0}', [this.doctype]));
                E.call(
                    'add_type_node',
                    {data},
                    E.fn(function(ret) {
                        if (!ret) {
                            E.error('Unable to create the expense type');
                            return;
                        }
                        if (E.is_obj(ret) && ret.error) {
                            E.error(ret.error);
                            return;
                        }
                        if (this.selected_node) {
                            this.treeview.tree.load_children(this.selected_node);
                        } else {
                            this.treeview.make_tree();
                        }
                        frappe.show_alert({
                            indicator: 'green',
                            message: __(this._doctype + ' created successfully.')
                        });
                    }, this),
                    E.fn(function() {
                        this.unset('selected_node');
                        frappe.dom.unfreeze();
                    }, this)
                );
            })
            .set_secondary_action('Cancel', function() { this.hide(); })
            .build();
    },
    post_render: function(treeview) {
        treeview.page.set_primary_action(__('New'), function() {
            frappe.treeview_settings[treeview.doctype].ET.qe
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
                let base = frappe.treeview_settings['Expense Type'],
                treeview = base.treeview,
                args = $.extend({}, treeview.args);
                args.parent_type = treeview.args.parent;
                base.ET.qe
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