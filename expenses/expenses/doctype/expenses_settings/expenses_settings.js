/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Settings', {
    setup: function(frm) {
        frm.E = {
            update_messages: [
                __('No new version is found'),
                __('A new version is available'),
            ],
            update_tags: ['span', 'strong'],
            update_classes: ['text-muted', 'text-danger'],
        };
    },
    refresh: function(frm) {
        let idx = cint(frm.doc.has_update);
        frm.get_field('update_note').$wrapper.html(
            '<' + frm.E.update_tags[idx]
            + 'class="' + frm.E.update_classes[idx] + '">'
            + frm.E.update_messages[idx]
            + '</' + frm.E.update_tags[idx] + '>'
        );
    },
    check_for_update: function(frm) {
        E.call(
            'check_for_update',
            function() { frm.reload_doc(); }
        );
    },
});