/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings['Expense'] = {
    add_fields: ['party_type', 'party', 'is_paid', 'paid_by'],
    onload: function(list) {
        frappe.listview_settings.Expense.list = list;
        frappe.exp()
            .on('ready change', function() { this.setup_list(list); })
            .on('ready', function() {
                if (!this.is_enabled) return list.page.clear_actions_menu();
                frappe.listview_settings.Expense.action_btn = list.page.add_actions_menu_item(
                    __('Create Request'), function() {
                        let data = list.get_checked_items();
                        if (!data.length) return frappe.exp().error(
                            __(list.doctype),
                            __('At least one company expense must be selected to create an expenses request.')
                        );
                        var company = null, expenses = [];
                        for (let i = 0, l = data.length, v; i < l; i++) {
                            v = data[i];
                            if (cint(v.docstatus) !== 1) return;
                            let comp = cstr(v.company);
                            if (!company) company = comp;
                            if (company === comp) expenses.push(cstr(v.name));
                        }
                        function callback() {
                            list.clear_checked_items();
                            frappe.exp().set_cache('expenses-request', expenses, 1, 'minute');
                            frappe.route_options = {company: company};
                            frappe.router.set_route('Form', 'Expenses Request');
                        }
                        if (expenses.length === selected.length) callback();
                        else frappe.confirm(
                            __('An expenses request cannot include expenses of multiple companies so, only expenses of "{0}" will be included.', [__(company)])
                            + '<br/>' + __('Do you wish to continue?'),
                            callback, function() { list.clear_checked_items(); }
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
            __(status), opts[status][0],
            'status,=,\'' + status + '\'|docstatus,=,' + opts[status][1]
        ];
    },
    formatters: {
        name: function(v, df, doc) {
            let html = [];
            if (frappe.exp().$isStrVal(doc.party_type) && frappe.exp().$isStrVal(doc.party))
                html.push('<strong>' + __(doc.party_type) + ':</strong> ' + doc.party);
            if (frappe.exp().$isStrVal(doc.paid_by))
                html.push('<strong>' + __('Paid By') + ':</strong> ' + doc.paid_by);
            return v + (html.length ? '<br/><small class="text-muted">' + html.join(' | ') + '</small>' : '');
        },
        is_advance: function(v) { return cint(v) ? __('Yes') : __('No'); },
    },
};