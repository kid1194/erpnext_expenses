/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.treeview_settings');


frappe.treeview_settings['Expense Type'] = {
    breadcrumb: __('Expense Types'),
    title: __('Chart of Expense Types'),
    get_tree_root: true,
    disable_add_node: true,
    root_label: __('Expense Types'),
    show_expand_all: true,
    get_tree_nodes: frappe.exp().get_method('get_type_children'),
    onload: function(treeview) {
        frappe.exp().on('ready change', function() { this.setup_tree(treeview); });
    },
    post_render: function(treeview) {
        treeview.page.clear_primary_action();
        if (!frappe.exp().is_enabled) return;
        treeview.page.set_primary_action(__('New'), function() {
            frappe.new_doc(frappe.exp().tree.doctype, {from_tree: 1});
        }, 'add');
    },
    toolbar: [
        {
            label: __('Add Child'),
            condition: function(node) {
                return frappe.exp().is_enabled
                    && frappe.boot.user.can_create.includes('Expense Type')
                    && !node.hide_add
                    && node.expandable;
            },
            click: function() {
                if (!frappe.exp().is_enabled) return;
                frappe.new_doc(frappe.exp().tree.doctype, {
                    from_tree: 1,
                    is_group: cint(frappe.exp().tree.args.expandable),
                    parent_type: cstr(frappe.exp().tree.args.parent),
                });
            },
            btnClass: 'hidden-xs'
        },
        {
            label: __('Convert To Group'),
            condition: function(node) {
                return frappe.exp().is_enabled
                    && frappe.boot.user.can_write.includes('Expense Type')
                    && !node.expandable;
            },
            click: function() {
                if (!frappe.exp().is_enabled) return;
                frappe.exp().request(
                    'convert_item_to_group',
                    {name: cstr(frappe.exp().tree.args.value)},
                    function(ret) {
                        if (!ret) this.error_(__('Unable to convert expense type item to a group.'));
                        else if (ret.error) this.error_(ret.error);
                        else {
                            this.success_(__('Expense type converted successfully.'));
                            this.tree.make_tree();
                        }
                    },
                    function(e) {
                        this.error_(e.self ? e.message : __('Unable to convert expense type item to a group.'));
                    }
                );
            },
            btnClass: 'hidden-xs'
        },
        {
            label: __('Convert To Item'),
            condition: function(node) {
                return frappe.exp().is_enabled
                    && frappe.boot.user.can_write.includes('Expense Type')
                    && node.expandable;
            },
            click: function() {
                if (!frappe.exp().is_enabled) return;
                frappe.exp().request(
                    'convert_group_to_item',
                    {name: cstr(frappe.exp().tree.args.value)},
                    function(ret) {
                        if (!ret) this.error_(__('Unable to convert expense type group to an item.'));
                        else if (ret.error) this.error_(ret.error);
                        else {
                            this.success_(__('Expense type converted successfully.'));
                            this.tree.make_tree();
                        }
                    },
                    function(e) {
                        this.error_(e.self ? e.message : __('Unable to convert expense type item to a group.'));
                    }
                );
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};