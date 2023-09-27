/*
*  Expenses © 2023
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.query_reports['Expenses Entry'] = {
    'filters': [
        {
            'fieldname': 'company',
            'label': __('Company'),
            'fieldtype': 'Link',
            'options': 'Company',
            'default': frappe.defaults.get_user_default('Company'),
            'reqd': 1
        },
        {
            'fieldname': 'from_date',
            'label': __('From Date'),
            'fieldtype': 'Date',
            'default': frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            'reqd': 1,
            'width': '60px'
        },
        {
            'fieldname': 'to_date',
            'label': __('To Date'),
            'fieldtype': 'Date',
            'default': frappe.datetime.get_today(),
            'reqd': 1,
            'width': '60px'
        },
        {
            'fieldtype': 'Break',
        },
        {
            'fieldname': 'mode_of_payment',
            'label': __('Mode of Payment'),
            'fieldtype': 'Link',
            'options': 'Mode of Payment'
        },
        {
            'fieldname': 'show_cancelled_entries',
            'label': __('Show Cancelled Entries'),
            'fieldtype': 'Check'
        },
    ]
};