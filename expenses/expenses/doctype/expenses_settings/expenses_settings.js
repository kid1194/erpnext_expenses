/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.ui.form.on('Expenses Settings', {
    setup: function(frm) {
        frappe.Expenses();
        frm._update_ready = false;
        frm._update = {
            messages: [
                __('App is up to date'),
                __('A new version is available'),
            ],
            tags: ['span', 'strong'],
            classes: ['text-muted', 'text-danger'],
        };
    },
    refresh: function(frm) {
        if (!frm._update_ready) frm.trigger('setup_note');
    },
    check_for_update: function(frm) {
        frappe.E.call(
            'check_for_update',
            function(ret) {
                if (ret) frm.reload_doc();
            }
        );
    },
    setup_note: function(frm) {
        frm._update_ready = true;
        let idx = cint(frm.doc.has_update);
        frm.get_field('update_note').$wrapper.html(
            '<' + frm._update.tags[idx]
            + 'class="' + frm._update.classes[idx] + ' mb-4">'
            + frm._update.messages[idx]
            + '</' + frm._update.tags[idx] + '>'
        );
    },
});