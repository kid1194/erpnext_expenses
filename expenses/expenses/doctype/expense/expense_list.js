/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');
frappe.provide('frappe.model');


frappe.listview_settings['Expense'] = {
    add_fields: ['party_type', 'party', 'paid_by'],
    onload: function(list) {
        frappe.listview_settings.Expense.list = list;
        frappe.exp()
            .on('ready change', function() { this.setup_list(list); })
            .on('ready', function() {
                if (!this.is_enabled) return list.page.clear_actions_menu();
                frappe.listview_settings.Expense.action_btn = list.page.add_actions_menu_item(
                    __('Create Request'), function() {
                        let selected = frappe.listview_settings.Expense.list.get_checked_items(),
                        company = null,
                        expenses = [];
                        if (!selected.length) return frappe.exp().error(
                            __('Expense List Error'),
                            __('At least one company expense must be selected in order to create an expense request.')
                        );
                        for (let i = 0, l = selected.length, v; i < l; i++) {
                            v = selected[i];
                            if (cint(v.docstatus) !== 1) return;
                            let comp = cstr(v.company);
                            if (!company || company === comp) expenses.push(cstr(v.name));
                            if (!company) company = comp;
                        }
                        function callback() {
                            frappe.listview_settings.Expense.list.clear_checked_items();
                            frappe.exp().set_cache('expenses-to-request', expenses, 1, 'minute');
                            frappe.route_options = {company: company};
                            frappe.router.set_route('Form', 'Expenses Request');
                        }
                        if (expenses.length === selected.length) callback();
                        else frappe.confirm(
                            __('The selected entries can only belong to one company, therefore, only entries for "{0}" will be included in the request.', [company])
                            + '<p>' + __('Do you want to continue?') + '</p>',
                            callback, function() { frappe.listview_settings.Expense.list.clear_checked_items(); }
                        );
                    },
                    true
                );
            });
    },
    get_indicator: function(doc) {
        var opts = {
            Draft: ['gray', 0],
            Pending: ['orange', 1],
            Requested: ['blue', 1],
            Approved: ['green', 1],
            Rejected: ['red', 2],
            Cancelled: ['red', 2],
        },
        status = cstr(doc.status);
        return [
            status,
            opts[status][0],
            'status,=,\'' + status + '\'|docstatus,=,' + opts[status][1]
        ];
    },
    formatters: {
        name: function(v, df, doc) {
            let html = [],
            party_type = cstr(doc.party_type),
            party = cstr(doc.party),
            paid_by = cstr(doc.paid_by);
            if (party_type.length && party.length)
                html.push('<strong>' + __(party_type) + ':</strong> ' + party);
            if (paid_by.length)
                html.push('<strong>' + __('Paid By') + ':</strong> ' + paid_by);
            return v + (html.length ? '<br/><small class="text-muted">' + html.join(' | ') + '</small>' : '');
        },
        is_advance: function(v) { return __(cint(v) ? 'Yes' : 'No'); },
    },
};