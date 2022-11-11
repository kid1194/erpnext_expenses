/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


class ExpensesDataTable {
    constructor(parent) {
        this.$parent = $(parent);
        this._label = '';
        this._opt = {
            columns: [],
            data: [],
            serialNoColumn: false,
            clusterize: false,
            layout: 'fluid',
            checkedRowStatus: false,
            disableReorderColumn: true,
            events: {},
        };
        this._checkbox_callback = null;
        this._read_only = false;
        this._on_remove = null;
        this._on_remove_all = null;
        this._on_add = null;
        this._buttons = [];
        this._rowsKeys = [];
        this._rows = [];
        this._rowsIdx = 0;
        this._selected = [];
    }
    label(text) {
        this._label = __(text);
        return this;
    }
    column(id, label, format) {
        let col = {
            id: id, name: __(label),
            editable: false, resizable: false,
            sortable: false, focusable: false,
            dropdown: false,
        };
        if (E.is_func(format)) col.format = E.fn(format, this);
        this._opt.columns.push(col);
        return this;
    }
    action(key, icon, type, callback) {
        if (!key) key = '_' + Math.random().toString(36).substr(2);
        if (!icon) icon = 'pen';
        if (!type) type = 'default';
        this._buttons.push({
            key: key,
            html: `<button type="button" class="btn btn-sm btn-${type}" data-action="${key}" data-row-idx="{idx}">
                <span class="fa fa-${icon} fa-fw"></span>
            </button>`,
            callback: callback,
        });
        return this;
    }
    layout(value) {
        this._opt.layout = value;
        return this;
    }
    column_number() {
        this._opt.serialNoColumn = true;
        return this;
    }
    column_checkbox(callback) {
        this._opt.checkboxColumn = true;
        this._checkbox_callback = callback;
        if (!this._opt.events.onCheckRow) {
            var me = this;
            this._opt.events.onCheckRow = function(row) {
                if (!row) {
                    let rows = this.rowmanager.getCheckedRows();
                    if (rows.length) {
                        me._selected.splice(0, me._selected.length);
                        Array.prototype.push.apply(me._selected, rows);
                    } else {
                        me._selected.splice(0, me._selected.length);
                    }
                } else {
                    let idx = row.meta ? row.meta.rowIndex : null;
                    if (idx != null && me._selected.indexOf(idx) < 0) {
                        me._selected.push(idx);
                    }
                }
                E.is_func(me._checkbox_callback) && me._checkbox_callback.call(me);
            };
        }
        return this;
    }
    clusterize() {
        this._opt.clusterize = true;
        return this;
    }
    no_data_message(text) {
        this._opt.noDataMessage = __(text);
        return this;
    }
    dynamic_row_height() {
        this._opt.dynamicRowHeight = true;
        return this;
    }
    cell_height(int) {
        int = cint(int);
        if (int) this._opt.cellHeight = int;
        return this;
    }
    inline_filters() {
        this._opt.inlineFilters = true;
        return this;
    }
    checked_row_status() {
        this._opt.checkedRowStatus = true;
        return this;
    }
    read_only() {
        this._read_only = true;
        return this;
    }
    on_remove(callback) {
        this._on_remove = E.is_func(callback) ? callback : null;
        return this;
    }
    on_remove_all(callback) {
        this._on_remove_all = E.is_func(callback) ? callback : null;
        return this;
    }
    on_add(callback) {
        this._on_add = E.is_func(callback) ? callback : null;
        return this;
    }
    render() {
        this.$parent.addClass('my-3');
        let template = `
            <label class="control-label">${this._label}</label>
            <p class="text-muted small expense-datatable-description hidden"></p>
            <div class="expense-datatable px-md-2 px-1"></div>
            <div class="row m-0 p-0 small">
                <div class="col-12 m-0 p-0 small expense-datatable-actions hidden">
    				<button class="btn btn-xs btn-danger expense-datatable-remove-row" style="margin-right: 4px;">
    					${__("Delete")}
    				</button>
    				<button class="btn btn-xs btn-danger expense-datatable-remove-all-rows" style="margin-right: 4px;">
    					${__("Delete All")}
    				</button>
    				<button class="btn btn-xs btn-secondary expense-datatable-add-row">
    					${__("Add Row")}
    				</button>
    			</div>
			</div>
        `;
        this.$wrapper = $(template).appendTo(this.$parent);
        this.$table = this.$wrapper.find('.expense-datatable');
        this.$actions = this.$wrapper.find('.expense-datatable-actions');
        this.$remove_row = this.$actions.find('.expense-datatable-remove-row');
        this.$remove_all_rows = this.$actions.find('.expense-datatable-remove-all-rows');
        this.$add_row = this.$actions.find('.expense-datatable-add-row');
        
        var me = this;
        
        if (!this._read_only) {
            this.$actions.parent().removeClass('hidden');
            this.$remove_row.on('click', function(e) {
                e.preventDefault();
                if (!me._selected.length) return;
                let ret = me._on_remove && me._on_remove.call(me, me.get_selected_rows());
                if (ret === false) return;
                E.each(me._selected, function(i) {
                    me.remove_row(i, 1);
                });
                me._selected.splice(0, me._selected.length);
                me.refresh();
            });
            this.$remove_all_rows.on('click', function(e) {
                e.preventDefault();
                if (!me._rows.length) return;
                let ret = me._on_remove_all && me._on_remove_all.call(me);
                if (ret === false) return;
                me.clear();
            });
            this.$add_row.on('click', function(e) {
                e.preventDefault();
                me._on_add && me._on_add.call(me);
            });
        }
        
        if (this._buttons.length) {
            var html = [];
            html.push('<div class="btn-group" role="group">');
            E.each(this._buttons, function(b) {
                html.push(b.html);
                var callback = b.callback;
                this.$table.on('click', 'button[data-action="' + d.key + '"]', function(e) {
                    e.preventDefault();
                    let idx = cint($(this).attr('data-row-idx'));
                    if (!idx) return;
                    let row = me.get_row(idx);
                    if (!row) return;
                    E.is_func(callback) && callback.apply(me, [row, idx]);
                });
            }, this);
            html.push('</div>');
            html = html.join('');
            this.column('_actions', 'Actions', function(v, row, col, data) {
                let idx = row.rowIndex || (row.meta ? row.meta.rowIndex : -1);
                return html.replace(/\{idx\}/g, idx);
            });
        }
        
        this._table = new frappe.DataTable(this.$table.get(0), this._opt);
    }
    add_row(data, bulk) {
        this._rows.push(data);
        if (!bulk) this.refresh();
        return this;
    }
    remove_row(idx, bulk) {
        idx = cint(idx);
        if (this._rows.length > idx) {
            this._rows.splice(idx, 1);
            if (!bulk) this.refresh();
        }
        return this;
    }
    refresh() {
        this._table.refresh(this._rows);
        return this;
    }
    get_selected_rows() {
        let out = [];
        E.each(this._selected, function(i) {
            let row = this.get_row(i);
            if (row) out.push(row);
        }, this);
        return out;
    }
    get_row(idx) {
        idx = cint(idx);
        return this._rows.length > idx ? this._rows[idx] : null;
    }
    clear() {
        this._rows.splice(0, this._rows.length);
        this.refresh();
        return this;
    }
}