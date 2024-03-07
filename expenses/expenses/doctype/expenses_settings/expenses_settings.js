/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Settings', {
    setup: function(frm) {
        frappe.exp();
        frm._settings = {ready: false};
    },
    refresh: function(frm) {
        if (!frm._settings.ready) frm.trigger('setup_update_note');
    },
    update_notification_receivers: function(frm) {
        let key = 'update_notification_receivers',
        field = frm.get_field(key);
        if (
            !field
            || !frappe.exp().$isArr(field._rows_list)
            || !field._rows_list.length
        ) return;
        let rows = field._rows_list.slice(),
        exist = [],
        del = [];
        for (let i = 0, l = rows.length; i < l; i++) {
            if (exist.indexOf(rows[i]) >= 0) del.push(i);
            else exist.push(rows[i]);
        }
        if (!del.length) frappe.exp().valid_field(frm, key);
        else {
            det = del.reverse();
            for (let i = 0, l = del.length; i < l; i++) {
                field.rows.splice(del[i], 1);
                field._rows_list.splice(del[i], 1);
            }
            frappe.exp().invalid_field(
                frm, key,
                'The update notification receiver has already been selected.'
            );
        }
        frm.refresh_field(key);
    },
    check_for_update: function(frm) {
        frappe.exp().request(
            'check_for_update',
            null,
            function(ret) {
                if (ret) {
                    frm._settings.ready = false;
                    frm.reload_doc();
                }
            }
        );
    },
    validate: function(frm) {
        if (cint(frm.doc.send_update_notification)) {
            if (!cstr(frm.doc.update_notification_sender).length) {
                frappe.throw(__('A valid update notification sender is required.'));
                return false;
            }
            if (!(frm.doc.update_notification_receivers || []).length) {
                frappe.throw(__('At least one valid update notification receiver is required.'));
                return false;
            }
        }
    },
    setup_update_note: function(frm) {
        frm._settings.ready = true;
        let status;
        if (cint(frm.doc.has_update) > 0)
            status = '<dd class="col-9 col-sm-7 text-danger">\
                ' + __('A new version is available') + '\
            </dd>\
            <dt class="col-3 col-sm-5">' + __('Latest Version') + ':</dt>\
            <dd class="col-9 col-sm-7 text-danger">' + frm.doc.latest_version + '</dd>';
        else
            status = '<dd class="col-9 col-sm-7">\
                ' + __('App is up to date') + '\
            </dd>';
        
        frm.get_field('update_note').$wrapper.empty().append('\
        <dl class="row">\
            <dt class="col-sm-4">' + __('Status') + ':</dt>\
            ' + status + '\
            <dt class="col-sm-4">' + __('Current Version') + ':</dt>\
            <dd class="col-sm-8">' + frm.doc.current_version + '</dd>\
            <dt class="col-sm-4">' + __('Latest Check') + ':</dt>\
            <dd class="col-sm-8">\
                ' + frappe.datetime.user_to_str(frm.doc.latest_check) + '\
            </dd>\
        </dl>\
        ');
    },
});