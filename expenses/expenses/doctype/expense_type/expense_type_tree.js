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
            dialog: E.formDialog('Add New', 'blue'),
            rows: [],
            companies: E.uniqueArray(),
        };
        base.ET.dialog
            .setDoctype(treeview.doctype)
            .extend({
                'treeview': treeview,
                'ET': base.ET,
            })
            .removeFields('disabled', 'parent_type')
            .replaceProperties({
                'depends_on': ['hidden', 1],
                'read_only_depends_on': ['read_only', 1]
            })
            .removeProperties(
                'in_preview', 'in_list_view', 'in_filter', 'in_standard_filter',
                'depends_on', 'read_only_depends_on', 'mandatory_depends_on',
                'search_index', 'print_hide', 'report_hide', 'allow_in_quick_entry',
                'translatable'
            )
            .setFieldsProperties({
                is_group: {
                    hidden: 0,
                },
                company: {
                    get_query: function() {
                        var ET = this.ET;
                        let table = this.getField('expense_accounts');
                        if (table && (table.grid || '').get_data) {
                            let data = table.grid.get_data();
                            if (E.isArray(data) && data.length !== ET.rows.length) {
                                var rows = data.filter(function(r) {
                                    return (r.name || r.idx) != null;
                                }).map(function(r) {
                                    return r.name || r.idx;
                                });
                                E.each(ET.rows, function(r) {
                                    if (rows.indexOf(r) < 0) {
                                        ET.companies.delRef(r);
                                    }
                                });
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
                        let company = this.getRowFieldValue('expense_accounts', -1, 'company');
                        if (!company) {
                            let row = this.getRow('expense_accounts', -1);
                            row && row.toggle_editable && row.toggle_editable('account', 0);
                            this.setRowFieldValue('expense_accounts', -1, 'account', '');
                            return;
                        }
                        let ET = this.ET;
                        if (ET.companies.has(company)) {
                            this.setRowFieldInvalid(
                                'expense_accounts', -1, 'company',
                                __('The expense account for {0} already exist', [company])
                            );
                            return;
                        }
                        this.setRowFieldValid('expense_accounts', -1, 'company');
                        let name = this.getRowName('expense_accounts', -1);
                        ET.companies.push(company, name);
                        if (name) ET.rows.push(name);
                    },
                },
                account: {
                    get_query: function() {
                        let filters = {
                            is_group: 0,
                            root_type: 'Expense',
                        },
                        company = this.getRowFieldValue('expense_accounts', -1, 'company');
                        if (company) filters.company = company;
                        return {filters};
                    },
                    change: function() {
                        let account = this.getRowFieldValue('expense_accounts', -1, 'account'),
                        company = this.getRowFieldValue('expense_accounts', -1, 'company');
                        if (!account && company) {
                            this.setRowFieldValue('expense_accounts', -1, 'account', '');
                            this.setRowFieldInvalid(
                                'expense_accounts', -1, 'account',
                                __('Please select a company first')
                            );
                        } else {
                            this.setRowFieldValid('expense_accounts', -1, 'account');
                        }
                    },
                },
            })
            .sortFields([
                'main_section', 'type_name', 'main_column', 'is_group',
                'accounts_section', 'expense_accounts'
            ])
            .setPrimaryAction('Create', function() {
                let data = this.getValues();
                if (!data) {
                    this.showError('Unable to get the expense type inputs');
                    return;
                }
                let node = this.selected_node || {};
                data.parent = node.label;
                data.parent_type = node.label;
                data.doctype = this._doctype;
                data.is_root = !node || node.is_root;
                this.hide();
                frappe.dom.freeze(__('Creating {0}', [this._doctype]));
                E.call(
                    'add_type_node',
                    {data},
                    E.fn(function(ret) {
                        if (!ret) {
                            E.error('Unable to create the expense type');
                            return;
                        }
                        if (E.isPlainObject(ret) && ret.error) {
                            E.error(ret.error, ret.args);
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
            .setSecondaryAction('Cancel', function() { this.hide(); })
            .build();
    },
    post_render: function(treeview) {
        treeview.page.set_primary_action(__('New'), function() {
            frappe.treeview_settings[treeview.doctype].ET.dialog
                .setTitle('Add New')
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
                args = E.merge({}, treeview.args);
                args.parent_type = treeview.args.parent;
                base.ET.dialog
                    .setTitle('Add Child')
                    .setValues(args)
                    .extend('selected_node', treeview.tree.get_selected_node())
                    .show();
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};