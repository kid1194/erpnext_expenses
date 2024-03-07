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
    get_tree_nodes: 'expenses.libs.get_type_children',
    onload: function(treeview) {
        frappe.treeview_settings['Expense Type'].treeview = treeview;
        frappe.exp()
            .on('ready', function() {
                if (!this.is_enabled) treeview.page.clear_primary_action();
            })
            .on('change', function() {
                if (!this.is_enabled) treeview.page.clear_primary_action();
                else frappe.treeview_settings['Expense Type'].post_render(treeview);
            });
    },
    post_render: function(treeview) {
        if (!frappe.exp().is_enabled) return;
        treeview.page.clear_primary_action();
        treeview.page.set_primary_action(__('New'), function() {
            frappe.route_options = {from_tree: 1};
            frappe.set_route('Form', 'Expense Type');
        }, 'add');
    },
    toolbar: [
        {
            label: __('Add Child'),
            condition: function(node) {
                return frappe.exp().is_enabled
                    && frappe.boot.user.can_create.includes('Expense Type')
                    && !node.hide_add;
            },
            click: function() {
                if (!frappe.exp().is_enabled) return;
                let dt = 'Expense Type',
                args = frappe.treeview_settings[d].treeview.args;
                frappe.route_options = {
                    from_tree: 1,
                    is_group: cint(args.expandable),
                    parent_type: cstr(args.parent),
                };
                frappe.set_route('Form', dt);
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
                let args = frappe.treeview_settings['Expense Type'].treeview.args;
                frappe.exp().request(
                    'convert_group_to_item',
                    {name: cstr(args.value)},
                    function(ret) {
                        if (!ret) this.error(__('Unable to convert the expense type group to an item.'));
                        else if (ret.error) this.error(ret.error);
                        else {
                            frappe.show_alert({
                                indicator: 'green',
                                message: __('Expense type has been converted successfully.'),
                            });
                            frappe.treeview_settings['Expense Type'].treeview.make_tree();
                        }
                    }
                );
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
                let args = frappe.treeview_settings['Expense Type'].treeview.args;
                frappe.exp().request(
                    'convert_item_to_group',
                    {name: cstr(args.value)},
                    function(ret) {
                        if (!ret) this.error(__('Unable to convert the expense type item to a group.'));
                        else if (ret.error) this.error(ret.error);
                        else {
                            frappe.show_alert({
                                indicator: 'green',
                                message: __('Expense type has been converted successfully.'),
                            });
                            frappe.treeview_settings['Expense Type'].treeview.make_tree();
                        }
                    }
                );
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};