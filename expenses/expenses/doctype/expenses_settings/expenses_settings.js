/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Settings', {
    refresh: function(frm) {
        frm.get_field('update_note').$wrapper.html(
            cint(frm.doc.has_update)
            ? '<span class="font-weight-bold text-danger">A new version is available</span>'
            : '<span class="text-muted">No new version is found</span>'
        );
    },
    check_for_update: function(frm) {
        E.call(
            'check_for_update',
            function(ret) {
                frm.reload_doc();
            }
        );
    },
});