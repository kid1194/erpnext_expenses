/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


frappe.provide("frappe.listview_settings");


frappe.listview_settings['Expenses Request'] = {
    get_indicator: function(doc) {
        let status = {
            'Draft': 'gray',
            'Pending': 'orange',
            'Cancelled': 'red',
            'Approved': 'blue',
            'Rejected': 'red',
            'Processed': 'green',
        };
        for (var k in status) {
            if (doc.status === k) return [__(k), status[k], 'status,=,' + k];
        }
        return [__(doc.status), 'gray', 'status,=,' + doc.status];
    },
};