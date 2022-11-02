/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


// Polyfill
if (!Array.prototype.clear)
    Array.prototype.clear = function() { this.splice(0, this.length); };
if (!Array.prototype.clone)
    Array.prototype.clone = function() { return JSON.parse(JSON.stringify(this)); };
if (!Array.prototype.del)
    Array.prototype.del = function(v) {
        let idx = this.indexOf(v);
        return idx >= 0 ? this.splice(idx, 1) : null;
    };


// Validation
function is_str(v) { return typeof v === 'string'; }
function is_arr(v) { return Array.isArray(v); }
function is_obj(v) { return $.isPlainObject(v); }


class Expenses {
    constructor(frm) {
        this.set_form(frm);
        this._exchange = {};
        this._docs = {};
    }
    set_form(frm) {
        this._frm = frm || null;
    }
    log() {
        var fn = console.error || console.log,
        pre = '[Expenses]: ';
        this.each(arguments, function(v) {
            if (is_str(v)) fn(pre + v);
            else fn(pre, v);
        });
    }
    error(text, args, _throw) {
        if (_throw == null && args === true) {
            _throw = args;
            args = null;
        }
        if (_throw) {
            frappe.throw(__(text, args));
            return;
        }
        frappe.msgprint({
            title: __('Error'),
            indicator: 'Red',
            message: __(text, args),
        });
    }
    path(method) {
        return Expenses.path(method);
    }
    call(method, args, success) {
        var me = this;
        return new Promise(function(resolve, reject) {
            args = args || null;
            if (args && !is_obj(args)) {
                if (typeof args === 'function') {
                    success = args;
                    args = null;
                } else args = {'data': args};
            }
            var data = {
                type: args ? 'POST' : 'GET',
                args: args,
                callback: function(ret) {
                    if (ret && is_obj(ret)) ret = ret.message || ret;
                    success && success.call(me, ret);
                    resolve();
                },
            };
            if (is_str(method)) {
                data.method = this.path(method);
            } else if (is_arr(method)) {
                data.doc = method[0];
                data.method = method[1];
            }
            try {
                frappe.call(data).fail(reject);
            } catch(e) {
                this.log('Call error.', e);
                this.error('Unable to make the call to {0}', [data.method]);
                reject();
            }
        });
    }
    set_cache(key, value) {
        if (!is_str(key)) return;
        if (value != null && !is_str(value)) {
            if (!is_arr(value) && !is_obj(value)) {
                value = {__value: value};
            }
            try {
                value = JSON.stringify(value);
            } catch(e) {
                value = null;
            }
        }
        if (value != null && is_str(value)) {
            localStorage.setItem(key, value);
        }
    }
    get_cache(key) {
        if (!is_str(key)) return;
        let value = localStorage.getItem(key);
        if (value != null && is_str(value)) {
            try {
                value = JSON.parse(value);
            } catch(e) {
                value = null;
            }
        }
        if (is_obj(value) && value.__value) {
            value = value.__value;
        }
        return value;
    }
    pop_cache(key) {
        let value = this.get_cache(key);
        this.del_cache(key);
        return value;
    }
    del_cache(key) {
        if (!is_str(key)) return;
        localStorage.removeItem(key);
    }
    
    // Database
    get_doc(dt, name, callback) {
        var me = this;
        return new Promise(function(resolve, reject) {
            if (me._docs[dt] && me._docs[dt][name]) {
                callback && callback.call(me, me._docs[dt][name]);
                resolve();
                return;
            }
            frappe.call({
                method: 'frappe.client.get',
                type: 'GET',
                args: {doctype: dt, name: name},
                callback: function(ret) {
                    if (ret && is_obj(ret)) ret = ret.message || ret;
                    me._docs[dt] = me._docs[dt] || {};
                    me._docs[dt][name] = ret;
                    callback && callback.call(me, ret);
                }
            }).fail(reject);
        });
    }
    get_list(dt, opts, callback) {
        var me = this;
        frappe.db.get_list(dt, opts).then(function(ret) {
            if (ret && is_obj(ret)) ret = ret.message || ret;
            callback && callback.call(me, ret);
        });
    }
    get_value(dt, name, key, callback) {
        var me = this;
        frappe.db.get_value(dt, name, key).then(function(ret) {
            if (ret && is_obj(ret)) ret = ret.message || ret;
            callback && callback.call(me, ret);
        });
    }
    
    // Expenses Entry
    get_exchange_rate(from, to, callback) {
        var key = from + '.' + to,
        rkey = to + '.' + from;
        if (this._exchange[rkey]) {
            this._exchange[key] = flt(1 / this._exchange[rkey]);
        }
        if (this._exchange[key]) {
            var me = this;
            return new Promise(function(resolve, reject) {
                callback && callback.call(me, me._exchange[key]);
                resolve();
            });
        }
        return this.call(
            'get_current_exchange_rate',
            {from, to},
            function(v) {
                v = flt(v);
                if (v <= 0) v = 1.0;
                this._exchange[key] = v;
                callback && callback.call(this, v);
            }
        );
    }
    
    // Form
    refresh_field() {
        this.each(arguments, function(f) {
            this._frm.refresh_field(f);
        });
    }
    refresh_row_field() {
        let args = Array.prototype.slice.call(arguments),
        table = args.shift(),
        row = args.shift();
        if (is_arr(args[0])) args = args.shift();
        this.each(args, function(f) {
            this._frm.refresh_field(table, row, f);
        });
    }
    remove_row(table, cdn) {
        this._frm.get_field(table).grid.grid_rows_by_docname[cdn].remove();
        this.refresh_field(table);
    }
    get_row_field(table, cdn, name) {
        return this._frm.get_field(table).grid.get_row(cdn).get_field(name);
    }
    clear_table(table) {
        this._frm.set_value(table, []);
        this.refresh_field(table);
    }
    get_precision(field) {
        let k = field.split('.'),
        f = this._frm.get_field(k[0]);
        if (k[1]) f = f.grid.get_field(k[1]);
        return f.get_precision();
    }
    set_df_property(field, key, val, table, cdn) {
        if (table && !cdn) {
            this._frm.get_field(table).grid
                .update_docfield_property(field, key, val);
        } else this._frm.set_df_property(field, key, val, null, table, cdn);
    }
    set_df_properties(field, props, table, cdn) {
        for (var k in props)
            this.set_df_property(field, k, props[k], table, cdn);
    }
    set_dfs_property(fields, key, val, table, cdn) {
        this.each(fields, function(f) {
            this.set_df_property(f, key, val, table, cdn);
        });
    }
    set_dfs_properties(fields, props, table, cdn) {
        for (var k in props)
            this.set_dfs_property(fields, k, props[k], table, cdn);
    }
    set_row_df_property(table, cdn, field, key, val) {
        this._frm.get_field(table).grid.get_row(cdn)
            .set_field_property(field, key, val);
    }
    set_row_df_properties(table, cdn, field, props) {
        for (var k in props)
            this.set_row_df_property(table, cdn, field, k, props[k]);
    }
    set_row_dfs_property(table, cdn, fields, key, val) {
        this.each(fields, function(f) {
            this.set_row_df_property(table, cdn, f, key, val);
        });
    }
    set_row_dfs_properties(table, cdn, fields, props) {
        for (var k in props)
            this.set_row_dfs_property(table, cdn, fields, k, props[k]);
    }
    
    // JS Helpers
    is_str(v) { return is_str(v); }
    is_arr(v) { return is_arr(v); }
    is_obj(v) { return is_obj(v); }
    each(data, fn) {
        Expenses.each(data, fn, this);
    }
    clone(data) {
        return Expenses.clone(data);
    }
    array_diff(a, b) {
        return Expenses.array_diff(a, b);
    }
}


Expenses.path = function(method) { return 'expenses.utils.' + method; };
Expenses.each = function(data, fn, bind) {
    bind = bind || null;
    if (is_arr(data)) {
        for (var i = 0, l = data.length; i < l; i++) {
            if (fn.apply(bind, [data[i], i]) === false) return;
        }
        return;
    }
    for (var k in data) {
        if (fn.apply(bind, [data[k], k]) === false) return;
    }
};
Expenses.clone = function(data) {
    if (!is_arr(data) && !is_obj(data)) return data;
    return JSON.parse(JSON.stringify(data));
};
Expenses.array_diff = function(a, b) {
    if (!is_arr(a) || !a.length) return is_arr(b) ? b : [];
    if (!is_arr(b) || !b.length) return is_arr(a) ? a : [];
    let ret = [];
    Expenses.each(a, function(v) {
        if (b.indexOf(v) < 0 && ret.indexOf(v) < 0) ret.push(v);
    });
    Expenses.each(b, function(v) {
        if (a.indexOf(v) < 0 && ret.indexOf(v) < 0) ret.push(v);
    });
    return ret;
};
Expenses.init = function(frm) {
    if (!Expenses.E) Expenses.E = new Expenses(frm);
    else Expenses.E.set_form(frm);
    window.E = Expenses.E;
    return Expenses.E;
};


Expenses.UniqueArray = class UniqueArray {
    constructor(data) {
        this._d = is_arr(data) ? data.clone() : [];
        this._r = {};
    }
    length() {
        return this._d.length;
    }
    index(v) {
        return this._d.indexOf(v);
    }
    has(v, r) {
        return (v != null && this.index(v) >= 0) || (r != null && this._r[r] != null);
    }
    push(v, r) {
        if (!this.has(v, r)) {
            this._d.push(v);
            if (r != null) this._r[r] = v;
        }
        return this;
    }
    rpush(v, r) {
        if (this.has(v, r)) this.del(v, r);
        return this.push(v, r);
    }
    del(v, r) {
        if (v != null) {
            if (r == null) {
                for (var k in this._r) {
                    if (this._r[k] === v) return this.del(v, k);
                }
            }
            if (this.has(v)) this._d.del(v);
        }
        if (r != null) {
            if (v == null && this._r[r] != null) {
                return this.del(this._r[r], r);
            }
            delete this._r[r];
        }
        return this;
    }
    all() {
        return this._d.clone();
    }
    copy() {
        let list = new Expenses.UniqueArray(this._d);
        list._r = Object.assign({}, this._r);
        return list;
    }
    clear() {
        this._d = [];
        this._r = {};
        return this;
    }
};

Expenses.QuickEntry = class ExpensesQuickEntry {
    constructor(doctype, title, indicator) {
        Expenses.init();
        this._doctype = doctype;
        this._title = title;
        this._indicator = indicator;
        this._fields = [];
        this._fields_by_ref = [];
        this._fields_by_name = {};
        this._ready = false;
        this._on_make = [];
        this._on_ready = [];
        this._on_clear = [];
        this._to_remove = [];
        this._properties = {};
        this._dialog = null;
        this._custom_btns = {};
        
        this._setup_fields();
    }
    _setup_fields() {
        var me = this;
        me._load_fields(me._doctype)
        .then(function(fields) {
            me._fields = fields;
            me._fields.unshift({
                fieldname: 'error_message',
                fieldtype: 'HTML',
                read_only: 1,
                hidden: 1
            });
            var tasks = [];
            E.each(me._fields, function(f, i) {
                let name = f.fieldname;
                me._fields_by_name[name] = me._fields_by_ref.length;
                me._fields_by_ref.push(f);
                me._apply_field_properties(name);
                if (f.fieldtype === 'Table') {
                    tasks.push(me._setup_table_fields(f, name));
                }
            });
            var callback = function() {
                tasks.clear();
                me._make();
            };
            if (tasks.length) {
                Promise.all(tasks).then(callback);
            } else {
                callback();
            }
        });
    }
    _setup_table_fields(field, parent_name) {
        var me = this;
        return me._load_fields(field.options)
        .then(function(fields) {
            field.fields = fields;
            E.each(field.fields, function(f) {
                let name = parent_name + '.' + f.fieldname;
                me._fields_by_name[name] = me._fields_by_ref.length;
                me._fields_by_ref.push(f);
                me._apply_field_properties(name);
            });
        });
    }
    _load_fields(dt) {
        return new Promise(function(resolve, reject) {
            E.get_doc('DocType', dt, function(ret) {
                if (!ret || !ret.fields || !is_arr(ret.fields) || !ret.fields.length) {
                    E.error('Unable to get the quick entry fields for ' + dt);
                    reject();
                    return;
                }
                resolve(ret.fields);
            });
        });
    }
    _add_on_make(fn, args) {
        var me = this;
        me._on_make.push(function() {
            if (args) me[fn].apply(me, args);
            else me[fn].call(me);
        });
        return me;
    }
    remove_field(name) {
        if (!this._ready) {
            return this._add_on_make('remove_field', arguments);
        }
        this._fields = this._fields.filter(function(f) { return f.fieldname !== name; });
        if (this._fields_by_name[name]) {
            this._fields_by_ref.splice(this._fields_by_name[name], 1);
            delete this._fields_by_name[name];
        }
        return this;
    }
    remove_fields(names) {
        if (!this._ready) {
            return this._add_on_make('remove_fields', arguments);
        }
        this._fields = this._fields.filter(function(f) { return names.indexOf(f.fieldname) < 0; });
        var me = this;
        E.each(names, function(n) {
            if (me._fields_by_name[n]) {
                me._fields_by_ref.splice(me._fields_by_name[n], 1);
                delete me._fields_by_name[n];
            }
        });
        return this;
    }
    set_field_property(name, key, value) {
        if (!this._ready) {
            return this._add_on_make('set_field_property', arguments);
        }
        this._properties[name] = this._properties[name] || {};
        this._properties[name][key] = value;
        this._apply_field_properties(name);
        return this;
    }
    set_field_properties(name, props) {
        if (!this._ready) {
            return this._add_on_make('set_field_properties', arguments);
        }
        var me = this;
        me._properties[name] = me._properties[name] || {};
        E.each(props, function(k, v) { me._properties[name][k] = v; });
        me._apply_field_properties(name);
        return me;
    }
    set_fields_properties(data) {
        var me = this;
        E.each(data, function(name, props) {
            me.set_field_properties(name, props);
        });
        return me;
    }
    remove_properties(data) {
        if (!this._ready) {
            return this._add_on_make('remove_properties', arguments);
        }
        E.each(this._fields_by_ref, function(f) {
            E.each(data, function(k) { delete f[k]; });
        });
        return this;
    }
    sort_fields(fields) {
        if (!this._ready) return this._add_on_make('sort_fields', arguments);
        var new_fields = {};
        E.each(this._fields, function(f, i) {
            let idx = fields.indexOf(f.fieldname);
            if (idx >= 0) new_fields[idx] = f;
        });
        this._fields = Object.values(new_fields);
        return this;
    }
    _add_on_ready(fn, args) {
        var me = this;
        me._on_ready.push(function() {
            if (args) me[fn].apply(me, args);
            else me[fn].call(me);
        });
        return me;
    }
    set_primary_action(label, callback) {
        if (!this._ready) {
            return this._add_on_ready('set_primary_action', arguments);
        }
        callback = callback.bind(this);
        this._dialog.set_primary_action(__(label), callback);
        return this;
    }
    set_secondary_action(label, callback) {
        if (!this._ready) {
            return this._add_on_ready('set_secondary_action', arguments);
        }
        this._dialog.set_secondary_action_label(__(label));
        callback = callback.bind(this);
        this._dialog.set_secondary_action(callback);
        return this;
    }
    add_custom_action(label, callback, type, position) {
        if (!this._ready) {
            return this._add_on_ready('add_custom_action', arguments);
        }
        let pos = ['start', 'center', 'end'];
        if (type && pos.indexOf(type) >= 0) {
            position = type;
            type = null;
        }
        type = type || 'primary';
        position = position || pos[2];
        let btn = $(`<button type='button' class='btn btn-${type} btn-sm'>
            ${__(label)}
        </button>`),
        primary = this._dialog.get_primary_btn();
        let key = frappe.scrub(label);
        key = key.replace('&', '_');
        this._custom_btns[key] = btn;
        if (position === pos[0]) primary.parent().prepend(btn);
        else if (position === pos[2]) primary.parent().append(btn);
        else if (position === pos[1]) primary.after(btn);
        callback = callback.bind(this);
        btn.on('click', callback);
        return this;
    }
    _apply_field_properties(name) {
        var field = this.get_field_by_name(name);
        if (field && is_obj(this._properties[name])) {
            var me = this;
            E.each(me._properties[name], function(v, k) {
                if (v && typeof v === 'function') v = v.bind(me);
                field[k] = v;
            });
            delete me._properties[name];
        }
    }
    get_field_by_name(name) {
        let idx = this._fields_by_name[name];
        return idx != null ? this._fields_by_ref[idx] || null : null;
    }
    _make() {
        if (this._ready) return;
        this._ready = true;
        var me = this;
        if (this._on_make.length) {
            frappe.run_serially(this._on_make)
            .then(function() { me._on_make.clear(); });
        }
        this._dialog = new frappe.ui.Dialog({
            title: __(this._title),
            indicator: this._indicator || 'green',
            fields: this._fields,
        });
        if (this._on_ready.length) {
            frappe.run_serially(this._on_ready)
            .then(function() { me._on_ready.clear(); });
        }
        let f = this._dialog.get_field('error_message');
        if (f && f.$wrapper) {
            f.$wrapper.append(`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong class="error-message"></strong>
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>`);
            this.$alert = f.$wrapper.find('.alert');
            this.$error = this.$alert.find('.error-message');
            this.$alert.alert();
        }
    }
    set_title(text) {
        if (!this._ready) return this._add_on_ready('set_title', arguments);
        this._dialog.set_title(__(text));
        return this;
    }
    show() {
        if (!this._ready) return this._add_on_ready('show');
        this._dialog.show();
        return this;
    }
    hide() {
        if (!this._ready) return this._add_on_ready('hide');
        this._dialog.hide();
        this.clear();
        return this;
    }
    get_field(name) {
        return this._dialog && this._dialog.get_field(name);
    }
    get_values() {
        return this._dialog && this._dialog.get_values();
    }
    get_value(name) {
        return this._dialog && this._dialog.get_value(name);
    }
    set_value(name, value) {
        if (!this._ready) return this._add_on_ready('set_value', arguments);
        this._dialog.set_value(name, value);
        return this;
    }
    set_values(values) {
        if (!this._ready) return this._add_on_ready('set_values', arguments);
        this._dialog.set_values(values);
        return this;
    }
    set_invalid(name, error) {
        this.set_df_property(name, 'invalid', true);
        let f = this._dialog && this._dialog.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (is_str(error) && f && f.set_new_description) f.set_new_description(error);
        return this;
    }
    set_valid(name) {
        this.set_df_property(name, 'invalid', false);
        let f = this._dialog && this._dialog.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (f && f.set_description) f.set_description();
        return this;
    }
    get_all_fields() {
        return (this._dialog && this._dialog.fields_dict) || {};
    }
    set_df_property(name, prop, value) {
        if (!this._ready) return this._add_on_ready('set_df_property', arguments);
        this._dialog.set_df_property(name, prop, value);
        return this;
    }
    set_df_properties(name, props) {
        if (!this._ready) return this._add_on_ready('set_df_properties', arguments);
        var me = this;
        E.each(props, function(v, k) {
            me._dialog.set_df_property(name, k, v);
        });
        return me;
    }
    enable_all_fields() {
        if (!this._ready) return this._add_on_ready('enable_all_fields');
        var me = this;
        E.each(me.get_all_fields(), function(f) {
            me.set_df_property(f.df.fieldname, 'read_only', 0);
        });
        return me;
    }
    disable_all_fields() {
        if (!this._ready) return this._add_on_ready('disable_all_fields');
        var me = this;
        E.each(me.get_all_fields(), function(f) {
            me.set_df_property(f.df.fieldname, 'read_only', 1);
        });
        return me;
    }
    show_error(txt) {
        if (this.$alert && this.$error) {
            this.$error.html(txt);
            this.$alert.alert('show');
            frappe.ui.scroll(this.$alert);
        }
        this.set_df_property('error_message', 'hidden', 0);
        var me = this;
        window.setTimeout(function() { me.hide_error(); }, 3000);
    }
    hide_error() {
        if (this.$alert && this.$error) {
            this.$alert.alert('close');
            this.$error.html('');
        }
        this.set_df_property('error_message', 'hidden', 1);
    }
    on_clear(fn) {
        this._on_clear.push(fn.bind(this));
        return this;
    }
    clear() {
        if (!this._ready) return this._add_on_ready('clear');
        this._dialog.clear();
        var me = this;
        frappe.run_serially(this._on_clear)
        .then(function() { me._on_clear.clear(); });
        return this;
    }
    extend(key, fn) {
        this[key] = fn.bind(this);
        return this;
    }
};