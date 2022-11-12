# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import frappe
from frappe import _
from frappe.utils import cint, flt

from expenses.utils.common import error, get_cached_value
from expenses.utils.entry import _ENTRY


def execute(filters=None):
    if not filters:
        return [], []

    validate_filters(filters)
    currency = currency = get_cached_value(
        "Company",
        filters.get("company"),
        "default_currency"
    )
    columns = get_columns(currency)
    data = get_result(filters, currency)
    totals = get_totals(data)
    chart = get_chart_data(totals, currency)
    summary = get_report_summary(totals, currency)

    return columns, data, None, chart, summary


def validate_filters(filters, account_details):
    if not filters.get("company"):
        error(_("{0} is mandatory").format(_("Company")))

    if not filters.get("from_date") or not filters.get("to_date"):
        error(_("{0} and {1} are mandatory").format(
            frappe.bold(_("From Date")), frappe.bold(_("To Date"))
        ))

    if filters.from_date > filters.to_date:
        error(_("From Date must be before To Date"))


def get_columns(currency):
    return [
        {
            "label": _("Expenses Entry"),
            "fieldname": "expenses_entry",
            "fieldtype": "Link",
            "options": "Expenses Entry",
        },
        {
            "label": _("Mode of Payment"),
            "fieldname": "mode_of_payment",
            "width": 100,
        },
        {
            "label": _("Posting Date"),
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 90,
        },
        {
            "label": _("Total ({0})").format(currency),
            "fieldname": "total",
            "fieldtype": "Float",
            "width": 100,
        },
        {
            "label": _("Payment Reference"),
            "fieldname": "payment_reference",
            "width": 100,
        },
        {
            "label": _("Clearance Date"),
            "fieldname": "clearance_date",
            "fieldtype": "Date",
            "width": 90,
        },
        {
            "label": _("Remarks"),
            "fieldname": "remarks",
            "width": 400,
        },
    ]


def get_result(filters, currency):
    doc = frappe.qb.DocType(_ENTRY)
    qry = (
        frappe.qb.from_(doc)
        .select(
            doc.name.as_("expenses_entry"),
            doc.mode_of_payment,
            doc.posting_date,
            doc.total,
            doc.payment_reference,
            doc.clearance_date,
            doc.remarks
        )
        .where(doc.company == filters.get("company"))
        .where(doc.posting_date.between([
            filters.get("from_date"),
            filters.get("to_date")
        ]))
        .orderby(doc.posting_date, doc.creation)
    )
    
    if (mode_of_payment := filters.get("mode_of_payment")):
        qry = qry.where(doc.mode_of_payment == mode_of_payment)
    
    if cint(filters.get("show_cancelled_entries")):
        qry = qry.where(doc.docstatus > 0)
    else:
        qry = qry.where(doc.docstatus == 1)
        
    data = qry.run(as_dict=True)
    
    for i in range(len(data)):
        data[i]["currency"] = currency
    
    return data


def get_totals(data):
    totals = {"*": 0}
    
    for v in get_mode_of_payments():
        totals[v] = 0
    
    for v in data:
        totals["*"] += flt(v["total"])
        if v["mode_of_payment"] in totals:
            totals[v["mode_of_payment"]] += flt(v["total"])
    
    return totals


def get_chart_data(totals, currency):
    labels = []
    datasets = []
    
    for k, v in totals.items():
        if k != "*":
            labels.append(k)
            datasets.append({
                "name": k,
                "values": [v],
            })
    
    return {
        "data": {
            "labels": labels,
            "datasets": datasets
        },
        "type": "bar",
        "fieldtype": "Currency",
        "currency": currency,
    }


def get_report_summary(totals, currency):
    summary = []
    
    for k, v in totals.items():
        label = "Total Expenses"
        if k != "*":
            label += f" ({k})"
        
        summary.append({
            "value": v,
            "label": _(label),
            "datatype": "Currency",
            "currency": currency,
        })
    
    return summary


def get_mode_of_payments():
    return frappe.list_all(
        "Mode of Payment",
        fields=["name"],
        filters={
            "type": ["in", ["Bank", "Cash"]]
        },
        pluck="name"
    )