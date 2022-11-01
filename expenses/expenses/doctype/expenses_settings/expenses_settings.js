/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.ui.form.on('Expenses Settings', {
    setup: function(frm) {
        Expenses.init(frm);
    },
    refresh: function(frm) {
        frm.get_field('update_note').$wrapper.html(
            cint(frm.doc.has_update)
            ? '<strong class="text-danger">A new version is available</strong>'
            : '<span class="text-muted">No new version is found</span>'
        );
    },
    check_for_update: function(frm) {
        E.call(
            'check_for_update',
            function(ret) {
                frm.reload_doc();
                E.refresh_field('latest_version', 'latest_check');
            }
        );
    },
});