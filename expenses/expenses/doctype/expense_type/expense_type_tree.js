/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.treeview_settings');


frappe.treeview_settings['Expense Type'] = {
    breadcrumb: 'Expense Types',
    title: __('Chart of Expense Types'),
    get_tree_root: false,
    disable_add_node: true,
    root_label: 'Expense Types',
    show_expand_all: true,
    get_tree_nodes: 'expenses.libs.get_type_children',
    onload: function(treeview) {
        frappe.treeview_settings[treeview.doctype].treeview = treeview;
        frappe.treeview_settings[treeview.doctype].exp_enabled = true;
        frappe.exp()
            .on('ready', function() {
                frappe.treeview_settings['Expense Type'].exp_enabled = this.is_enabled;
                if (!this.is_enabled)
                    frappe.dom.freeze(
                        '<strong class="text-danger">'
                        + __('The Expenses app has been disabled.')
                        + '</strong>'
                    );
            })
            .on('change', function() {
                frappe.dom.unfreeze();
                frappe.treeview_settings['Expense Type'].exp_enabled = this.is_enabled;
                frappe.treeview_settings['Expense Type'].treeview.make_tree();
                if (!this.is_enabled)
                    frappe.dom.freeze(
                        '<strong class="text-danger">'
                        + __('The Expenses app has been disabled.')
                        + '</strong>'
                    );
            });
    },
    post_render: function(treeview) {
        treeview.page.clear_primary_action();
        if (frappe.treeview_settings[treeview.doctype].exp_enabled)
            treeview.page.set_primary_action(__('New'), function() {
                frappe.exp().set_cache('create-expense-type', {});
                frappe.set_route('Form', 'Expense Type');
            }, 'add');
    },
    toolbar: [
        {
            label: __('Add Child'),
            condition: function(node) {
                let dt = 'Expense Type';
                return frappe.treeview_settings[dt].exp_enabled
                    && frappe.boot.user.can_create.indexOf(dt) >= 0
                    && !node.hide_add;
            },
            click: function() {
                let dt = 'Expense Type',
                treeview = frappe.treeview_settings[dt].treeview;
                frappe.exp().set_cache('create-expense-type', {
                    is_group: cint(treeview.args.expandable),
                    parent_type: cstr(treeview.args.parent),
                });
                frappe.set_route('Form', dt);
            },
            btnClass: 'hidden-xs'
        },
        {
            label: __('Convert To Item'),
            condition: function(node) {
                let dt = 'Expense Type';
                return frappe.treeview_settings[dt].exp_enabled
                    && frappe.boot.user.can_write.indexOf(dt) >= 0
                    && node.expandable;
            },
            click: function() {
                let dt = 'Expense Type';
                var treeview = frappe.treeview_settings[dt].treeview;
                frappe.exp().request(
                    'convert_group_to_item',
                    {name: cstr(treeview.args.value)},
                    function(ret) {
                        if (!ret)
                            frappe.exp().error('Unable to convert the expense type group to an item.');
                        else if (ret.error)
                            frappe.exp().error(ret.error);
                        else {
                            frappe.show_alert({
                                indicator: 'green',
                                message: __('The expense type group has been converted to an item successfully.'),
                            });
                            treeview.make_tree();
                        }
                    }
                );
            },
            btnClass: 'hidden-xs'
        },
        {
            label: __('Convert To Group'),
            condition: function(node) {
                let dt = 'Expense Type';
                return frappe.treeview_settings[dt].exp_enabled
                    && frappe.boot.user.can_write.indexOf(dt) >= 0
                    && !node.expandable;
            },
            click: function() {
                let dt = 'Expense Type';
                var treeview = frappe.treeview_settings[dt].treeview;
                frappe.exp().request(
                    'convert_item_to_group',
                    {name: treeview.args.value},
                    function(ret) {
                        if (!ret)
                            frappe.exp().error('Unable to convert the expense type item to a group.');
                        else if (ret.error)
                            frappe.exp().error(ret.error);
                        else {
                            frappe.show_alert({
                                indicator: 'green',
                                message: __('The expense type item has been converted to a group successfully.'),
                            });
                            treeview.make_tree();
                        }
                    }
                );
            },
            btnClass: 'hidden-xs'
        },
    ],
    extend_toolbar: true
};