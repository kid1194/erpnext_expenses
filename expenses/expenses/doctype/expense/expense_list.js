/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.listview_settings');


frappe.listview_settings.Expense = {
    add_fields: ['party_type', 'party', 'is_paid', 'paid_by'],
    onload: function(list) {
        frappe.exp()
            .on('ready change', function() { this.setup_list(list); })
            .on('on_alert', function(d, t) {
                ['fatal', 'error'].includes(t) && (d.title = __(list.doctype));
            });
        list.page.add_actions_menu_item(
            __('Create Request'), frappe.exp().$fn(function() {
                if (!this.is_enabled) return this.error(this.app_disabled_note);
                
                let data = list.get_checked_items();
                if (!this.$isArrVal(data))
                    return this.error(__('Select at least one pending expense.'));
                
                let company = null,
                expenses = [];
                for (let i = 0, l = data.length, v, c; i < l; i++) {
                    v = data[i];
                    if (cint(v.docstatus) !== 1 || cstr(v.status) !== 'pending') continue;
                    c = cstr(v.company);
                    if (!company) company = c;
                    if (company === c) expenses.push(cstr(v.name));
                }
                if (!company || !expenses.length)
                    return this.error(__('Selected expenses must be pending and linked to one single company only.'));
                
                list.clear_checked_items();
                this.cache().set('expenses-request', expenses, 60);
                frappe.new_doc('Expenses Request', {company: company});
            }),
            true
        );
    },
    get_indicator: function(doc) {
        let opts = {
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
            if (html.length) v = cstr(v) + '<br/><small class="text-muted">' + html.join(' | ') + '</small>';
            return v;
        },
        is_advance: function(v) { return cint(v) ? __('Yes') : __('No'); },
    },
};