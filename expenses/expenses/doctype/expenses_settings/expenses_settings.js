/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Settings', {
    onload: function(frm) {
        frappe.exp().on('on_alert', function(d, t) {
            frm._sets.errs.includes(t) && (d.title = __(frm.doctype));
        });
        frm._sets = {
            errs: ['fatal', 'error'],
            ready: 0,
        };
    },
    refresh: function(frm) {
        if (frm._sets.ready) return;
        frm.events.setup_general_note(frm);
        frm.events.setup_update_note(frm);
        frm._sets.ready++;
    },
    check_for_update: function(frm) {
        frappe.exp().request('check_for_update', null, function(v) { v && frm.reload_doc(); });
    },
    validate: function(frm) {
        if (!cint(frm.doc.send_update_notification)) return;
        if (!frappe.exp().$isStrVal(frm.doc.update_notification_sender)) {
            frappe.exp().fatal(__('A valid update notification sender is required.'));
            return false;
        }
        if (!frappe.exp().$isArrVal(frm.doc.update_notification_receivers)) {
            frappe.exp().fatal(__('At least one valid update notification receiver is required.'));
            return false;
        }
    },
    setup_general_note: function(frm) {
        frm.get_field('general_note').$wrapper.empty().append('\
<strong class="text-danger">' + __('Important') + ':</strong>\
<p>' + __('Disabling the module will prevent the creation and modification of entries in all the module doctypes.') + '</p>\
        ');
    },
    setup_update_note: function(frm) {
        frm.get_field('update_note').$wrapper.empty().append('\
<ul class="list-unstyled">\
    ' + (cint(frm.doc.has_update) > 0
        ? '\
    <li>\
        <strong>' + __('Status') + ':</strong> \
        <span class="text-danger">' + __('New version available') + '</span>\
    </li>\
    <li>\
        <strong>' + __('Latest Version') + ':</strong> \
        <span class="text-danger">' + frm.doc.latest_version + '</span>\
    </li>\
            '
        : '\
    <li>\
        <strong>' + __('Status') + ':</strong> \
        ' + __('App is up to date') + '\
    </li>\
    ') + '\
    <li>\
        <strong>' + __('Current Version') + ':</strong> \
        ' + frm.doc.current_version + '\
    </li>\
    <li>\
        <strong>' + __('Latest Check') + ':</strong> \
        ' + frappe.datetime.user_to_str(frm.doc.latest_check) + '\
    </li>\
</ul>\
        ');
    },
});