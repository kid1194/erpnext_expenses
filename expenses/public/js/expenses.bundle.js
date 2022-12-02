/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


if (window.E && window.E._path) {
    console.info('Expenses library has already been loaded.');
}

class Expenses {
    constructor() {
        this._path = 'expenses.utils.';
        this._frm = null;
        this._cache = {};
    }
    
    // Helpers
    _getObjectType(v) {
        if (v == null) return v === undefined ? 'Undefined' : 'Null';
        let t = Object.prototype.toString.call(v).slice(8, -1);
        return t === 'Number' && isNaN(v) ? 'NaN' : t;
    }
    _isOf(v, t) {
        return this._getObjectType(v) === t;
    }
    _isOfAny(v, t) {
        return t.split(' ').indexOf(this._getObjectType(v)) >= 0;
    }
    _isPropertyOf(v, k) {
        return Object.prototype.hasOwnProperty.call(v, k);
    }
    
    // Check
    isString(v) {
        return v != null && this._isOf(v, 'String');
    }
    isNumber(v) {
        return v != null && this._isOf(v, 'Number') && !isNaN(v);
    }
    isLength(v) {
        return this.isNumber(v) && v >= 0 && v % 1 == 0 && v <= 9007199254740991;
    }
    isInteger(v) {
        return this.isNumber(v) && v === Number(parseInt(v));
    }
    isFunction(v) {
        return v != null && $.isFunction(v);
    }
    isObjectLike(v) {
        return v != null && typeof v === 'object';
    }
    isObject(v) {
        return this.isObjectLike(v)
        && this.isObjectLike(Object.getPrototypeOf(Object(v)) || {})
        && !this._isOfAny(v, 'String Number Boolean Array RegExp Date URL');
    }
    isPlainObject(v) {
        return v != null && $.isPlainObject(v);
    }
    isArrayLike(v) {
        return v != null && !$.isFunction(v) && this.isObjectLike(v)
        && v !== window && !this.isInteger(v.nodeType) && this.isLength(v.length);
    }
    isArray(v) {
        return v != null && $.isArray(v);
    }
    isIteratable(v) {
        return this.isArrayLike(v) || (this.isObject(v) && !this.isInteger(v.nodeType));
    }
    isUrl(v) {
        if (!this.isString(v)) return false;
        try {
            new URL(v);
            return true;
        } catch(e) {
            return false;
        }
    }
    
    // Converter
    toArray(v) {
        if (this.isArray(v)) return v;
        if (this.isArrayLike(v)) return Array.prototype.slice.call(v);
        return this.isObject(v) && !this.isInteger(v.nodeType)
            ? Object.entries(v) : [];
    }
    toObject(v) {
        if (this.isObject(v)) return v;
        let t = {};
        if (v != null) t[0] = v;
        return t;
    }
    
    // Bind
    fnCall(f, a, b) {
        if (this.isFunction(f)) return f.apply(b || this, this.toArray(a));
    }
    fn(f, b) {
        var me = this;
        return function() {
            if (this) Array.prototype.push.call(arguments, this);
            return me.fnCall(f, arguments, b);
        };
    }
    
    // Json
    toJson(v, d) {
        if (d === undefined) d = v;
        if (!this.isObject(v)) return d;
        try {
            return JSON.stringify(v);
        } catch(e) {
            return d;
        }
    }
    parseJson(v, d) {
        if (d === undefined) d = v;
        if (!this.isString(v)) return d;
        try {
            return JSON.parse(v);
        } catch(e) {
            return d;
        }
    }
    
    // Data
    each(d, fn, b) {
        b = b || this;
        if (this.isArray(d)) {
            for (let i = 0, l = d.length; i < l; i++) {
                let r = this.fnCall(fn, [d[i], i], b);
                if (r !== undefined) return r;
            }
        } else if (this.isObject(d)) {
            for (let k in d) {
                if (this._isPropertyOf(d, k)) {
                    let r = this.fnCall(fn, [d[k], k], b);
                    if (r !== undefined) return r;
                }
            }
        }
    }
    contains(d, v) {
        return this.isIteratable(d) && Object.values(d).indexOf(v) >= 0;
    }
    containsAny(d, vs) {
        if (!this.isArray(vs)) return false;
        let a = this.isObject(d) ? Object.values(d) : d;
        if (!this.isArray(a)) return false;
        for (let i = 0, l = vs.length; i < l; i++) {
            if (a.indexOf(vs[i]) >= 0) return true;
        }
        return false;
    }
    containsAll(d, vs) {
        if (!this.isArray(vs)) return false;
        let a = this.isObject(d) ? Object.values(d) : d;
        if (!this.isArray(a)) return false;
        for (let i = 0, l = vs.length; i < l; i++) {
            if (a.indexOf(vs[i]) < 0) return false;
        }
        return true;
    }
    has(d, k) {
        return this.isIteratable(v) && d[k] != null;
    }
    hasAny(d, ks) {
        if (!this.isArray(ks)) return false;
        let a = this.isIteratable(d) ? Object.keys(d) : d;
        if (!this.isArray(a)) return false;
        for (let i = 0, l = ks.length; i < l; i++) {
            if (a.indexOf(ks[i]) >= 0) return true;
        }
        return false;
    }
    hasAll(d, ks) {
        if (!this.isArray(ks)) return false;
        let a = this.isIteratable(d) ? Object.keys(d) : d;
        if (!this.isArray(a)) return false;
        for (let i = 0, l = ks.length; i < l; i++) {
            if (a.indexOf(ks[i]) < 0) return false;
        }
        return true;
    }
    merge(d, v) {
        if (this.isArray(d)) {
            Array.prototype.push.apply(d, this.toArray(v));
        } else if (this.isObject(d)) {
            $.extend(d, this.toObject(v));
        }
        return d;
    }
    clear(d) {
        if (this.isArray(d)) d.length && d.splice(0, d.length);
        else if (this.isObject(d)) {
            this.each(d, function(v, k) {
                delete d[k];
            });
        }
        return d;
    }
    clone(d) {
        return this.isIteratable(d) ? this.parseJson(this.toJson(d)) : d;
    }
    filter(d, fn) {
        if (fn == null) fn = function(v) { return v != null; };
        if (!this.isIteratable(d) || !this.isFunction(fn)) return d;
        if (this.isArray(d) && this.isFunction(d.filter)) return d.filter(fn);
        let r = d.constructor(),
        p = this.isFunction(d.push);
        this.each(d, function(v, k) {
            if (this.fnCall(fn, [v, k]) !== false)
                ((p && r.push(v)) || (r[k] = v));
        });
        return r;
    }
    map(d, fn) {
        if (!this.isIteratable(d) || !this.isFunction(fn)) return d;
        if (this.isArray(d) && this.isFunction(d.map)) return d.map(fn);
        let r = d.constructor();
        this.each(d, function(v, k) {
            r[k] = this.fnCall(fn, [v, k]);
        });
        return r;
    }
    
    // Console & Error
    log() {
        var pre = '[Expenses]: ';
        this.each(arguments, function(v) {
            if (this.isString(v)) console.log(pre + v);
            else console.log(pre, v);
        });
        return this;
    }
    elog() {
        var pre = '[Expenses]: ';
        this.each(arguments, function(v) {
            if (this.isString(v)) console.error(pre + v);
            else console.error(pre, v);
        });
        return this;
    }
    error(text, args, _throw) {
        if (_throw == null && args === true) {
            _throw = args;
            args = null;
        }
        if (_throw) {
            frappe.throw(__(text, args));
            return this;
        }
        frappe.msgprint({
            title: __('Error'),
            indicator: 'Red',
            message: __(text, args),
        });
        return this;
    }
    
    // Temporary Cache
    _key() {
        return this.toJson(arguments, '');
    }
    _set(key, val) {
        this._cache[key] = val;
        return this;
    }
    _has(key) {
        return this._cache[key] !== undefined;
    }
    _get(key) {
        return this._cache[key];
    }
    _del(key) {
        delete this._cache[key];
        return this;
    }
    _clear() {
        this.clear(this._cache);
        return this;
    }
    
    // localStorage
    setCache(key, val) {
        if (!this.isIteratable(val))
            val = {___: val};
        val = this.toJson(val, '');
        localStorage.setItem(key, val);
        return this;
    }
    getCache(key) {
        let val = localStorage.getItem(key);
        val = this.parseJson(val, null);
        if (this.isPlainObject(val) && val.___ !== undefined)
            val = val.___;
        return val;
    }
    popCache(key) {
        let value = this.getCache(key);
        this.delCache(key);
        return value;
    }
    delCache(key) {
        localStorage.removeItem(key);
        return this;
    }
    clearCache() {
        localStorage.clear();
        return this;
    }
    
    // Call
    path(method) {
        return this._path + method;
    }
    _call(method, args, success, always, resolve, reject) {
        if (args && this.isFunction(args)) {
            if (this.isFunction(success)) always = success;
            success = args;
            args = null;
        }
        let data = {type: args != null ? 'POST' : 'GET'};
        if (args != null) {
            if (!this.isPlainObject(args)) data.args = {'data': args};
            else {
                data.args = args;
                if (args.type && args.args) {
                    data.type = args.type;
                    data.args = args.args;
                }
            }
        }
        if (this.isString(method)) {
            if (!this.isUrl(method) && !method.startsWith('frappe.')) {
                method = this.path(method);
            }
            data.method = method;
        } else if (this.isArray(method)) {
            data.doc = method[0];
            data.method = method[1];
        } else {
            this.elog('The method passed is invalid', arguments);
            return;
        }
        var ckey = this._key(data),
        error = data.error = this.fn(function(e) {
            this.elog('Call error.', e);
            this.error('Unable to make the call to {0}', [data.method]);
            reject && reject();
        });
        data.callback = this.fn(function(ret) {
            if (ret && this.isPlainObject(ret)) ret = ret.message || ret;
            this._set(ckey, ret);
            try {
                let val = this.fnCall(success, ret);
                this.fnCall(resolve, val || ret);
            } catch(e) { error(e); }
        });
        if (this._has(ckey)) {
            try {
                data.callback(this._get(ckey));
            } finally {
                this.fnCall(always);
            }
            return this;
        }
        if (this.isFunction(always)) data.always = this.fn(always);
        try {
            frappe.call(data);
        } catch(e) {
            error(e);
        }
        return this;
    }
    call(method, args, success, always) {
        return this._call(method, args, success, always);
    }
    xcall(method, args, success, always) {
        return new Promise(this.fn(function(resolve, reject) {
            this._call(method, args, success, always, resolve, reject);
        }));
    }
    
    // Database
    getDoc(dt, name, callback, always) {
        return this.xcall(
            'frappe.client.get',
            {type: 'GET', args: {doctype: dt, name: name}},
            callback,
            always
        );
    }
    getList(dt, opts, callback, always) {
        var ckey = this._key(dt, opts);
        if (this._has(ckey)) {
            try {
                this.fnCall(callback, this._get(ckey));
            } finally {
                this.fnCall(always);
            }
            return this;
        }
        frappe.db.get_list(dt, opts).then(this.fn(function(ret) {
            if (this.isPlainObject(ret)) ret = ret.message || ret;
            this._set(ckey, ret);
            this.fnCall(callback, ret);
        })).finally(this.fn(always));
        return this;
    }
    getValue(dt, name, key, callback, always) {
        var ckey = this._key(dt, name, key);
        if (this._has(ckey)) {
            try {
                this.fnCall(callback, this._get(ckey));
            } finally {
                this.fnCall(always);
            }
            return this;
        }
        frappe.db.get_value(dt, name, key).then(this.fn(function(ret) {
            if (this.isPlainObject(ret)) ret = ret.message || ret;
            this._set(ckey, ret);
            this.fnCall(callback, ret);
        })).finally(this.fn(always));
        return this;
    }
    isDocExists(dt, name, callback, always) {
        var ckey = this._key(dt, name);
        if (this._has(ckey)) {
            try {
                this.fnCall(callback, this._get(ckey));
            } finally {
                this.fnCall(always);
            }
            return this;
        }
        frappe.db.exists(dt, name).then(this.fn(function(ret) {
            this._set(ckey, ret);
            this.fnCall(callback, ret);
        })).finally(this.fn(always));
        return this;
    }
    
    // Form
    form(v) {
        if (this.isObject(v)) this._frm = v;
        return this;
    }
    setDocValue(doc, field, val) {
        frappe.model.set_value(doc, field, val);
        return this;
    }
    refreshField() {
        this.each(arguments, function(f) {
            if (this.isArray(f)) this._frm.refresh_field.apply(this._frm, f);
            else this._frm.refresh_field(f);
        });
        return this;
    }
    refreshRowField() {
        let a = this.toArray(arguments),
        t = a.shift(),
        r = a.shift();
        if (this.isArray(a[0])) a = a.shift();
        this.each(a, function(f) {
            this._frm.refresh_field(t, r, f);
        });
        return this;
    }
    getField(name) {
        return this._frm.get_field(name);
    }
    getRow(table, cdn) {
        return this.getField(table).grid.get_row(cdn);
    }
    removeRow(table, cdn) {
        this.getRow(table, cdn).remove();
        return this.refreshField(table);
    }
    getRowField(table, cdn, name) {
        return this.getRow(table, cdn).get_field(name);
    }
    clearTable(table) {
        this._frm.set_value(table, []);
        return this.refreshField(table);
    }
    getFieldPrecision(field) {
        let k = field.split('.'),
        f = this.getField(k[0]);
        if (k[1]) f = f.grid.get_field(k[1]);
        return f.get_precision();
    }
    setFieldProperty(field, key, val, table, cdn) {
        if (!table && field.includes('.', 1)) {
            let parts = field.split('.');
            field = parts[1];
            table = parts[0];
        }
        if (table && !cdn) {
            this.getField(table).grid.update_docfield_property(field, key, val);
        } else if (table && cdn) {
            this.getRow(table, cdn).set_field_property(field, key, val);
        } else {
            this._frm.set_df_property(field, key, val);
        }
        return this;
    }
    setFieldProperties(field, props, table, cdn) {
        for (var k in props)
            this.setFieldProperty(field, k, props[k], table, cdn);
        return this;
    }
    setFieldsProperty(fields, key, val, table, cdn) {
        if (this.isString(fields)) fields = fields.split(' ');
        this.each(fields, function(f) {
            this.setFieldProperty(f, key, val, table, cdn);
        });
        return this;
    }
    setFieldsProperties(fields, props, table, cdn) {
        for (var k in props)
            this.setFieldsProperty(fields, k, props[k], table, cdn);
        return this;
    }
    setRowFieldProperty(table, cdn, field, key, val) {
        this.setFieldProperty(field, key, val, table, cdn);
        return this;
    }
    setRowFieldProperties(table, cdn, field, props) {
        for (var k in props)
            this.setRowFieldProperty(table, cdn, field, k, props[k]);
        return this;
    }
    setRowFieldsProperty(table, cdn, fields, key, val) {
        this.each(fields, function(f) {
            this.setRowFieldProperty(table, cdn, f, key, val);
        });
        return this;
    }
    setRowFieldsProperties(table, cdn, fields, props) {
        for (var k in props)
            this.setRowFieldsProperty(table, cdn, fields, k, props[k]);
        return this;
    }
    setFieldError(field, error, args, _throw) {
        this.fnCall(this.getField(field).set_invalid);
        this.error(error, args, _throw);
        return this;
    }
    
    // Background
    runTask(fn, b) {
        return Promise.resolve().then(this.fn(fn, b));
    }
    runTasks(d, b) {
        let tasks = [];
        this.each(d, function(fn) {
            if (fn) list.push(this._isOf(fn, 'Promise')
                ? fn : this.runTask(fn, b)
            );
        });
        return tasks.length ? Promise.all(tasks) : Promise.reject();
    }
    
    extend(key, fn) {
        if (!this[key]) this[key] = this.fn(fn);
        return this;
    }
}

class UniqueArray {
    constructor() {
        this._d = [];
        this._r = [];
    }
    get length() {
        return this._d.length;
    }
    has(v) {
        return v != null && this._d.indexOf(v) >= 0;
    }
    hasRef(r) {
        return r != null && this._r.indexOf(r) >= 0;
    }
    push(v, r) {
        this.del(v);
        this.del(r, 1);
        if (v != null && !this.has(v)) {
            this._d.push(v);
            this._r.push(r || null);
        }
        return this;
    }
    del(v, r) {
        if (v != null) {
            let idx = !r ? this._d.indexOf(v) : this._r.indexOf(v);
            if (idx >= 0) {
                this._d.splice(idx, 1);
                this._r.splice(idx, 1);
            }
        }
        return this;
    }
    delRef(r) {
        if (r != null) {
            let idx = this._r.indexOf(r);
            if (idx >= 0) {
                this._d.splice(idx, 1);
                this._r.splice(idx, 1);
            }
        }
        return this;
    }
    get all() {
        return this._d;
    }
    copy() {
        let list = new UniqueArray();
        E.merge(list._d, this._d);
        E.merge(list._r, this._r);
        return list;
    }
    clear() {
        E.clear(this._d);
        E.clear(this._r);
        return this;
    }
}

class FormDialog {
    constructor(title, indicator) {
        this._title = title;
        this._indicator = indicator;
        
        this._doctype = null;
        
        this._add_fields = [];
        this._remove_fields = [];
        this._add_properties = {};
        this._replace_properties = {};
        this._remove_properties = {};
        this._sort_fields = null;
        this._primary_action = null;
        this._secondary_action = null;
        this._custom_actions = [];
        
        this._setup = false;
        this._on_setup = null;
        
        this._fields = null;
        this._fields_by_ref = [];
        this._fields_by_name = {};
        
        this._ready = false;
        this.__on_ready = [];
        this.__on_clear = [];
        this._dialog = null;
        this._custom_btns = {};
        this._extends = [];
    }
    loadDoctype(dt) {
        this._doctype = dt;
        E.runTask(function() {
            let meta = frappe.get_meta(this._doctype);
            if (meta && E.isArray(meta.fields)) {
                var fields = E.clone(meta.fields),
                invalid = false;
                E.each(fields, function(f) {
                    if (f.fieldtype.includes('Table') && !E.isArray(f.fields)) {
                        let table_meta = frappe.get_meta(f.options);
                        if (table_meta && E.isArray(table_meta.fields)) {
                            f.fields = table_meta.fields;
                        } else {
                            invalid = true;
                            return false;
                        }
                    }
                });
                if (!invalid) {
                    this._setFields(fields);
                    return;
                }
            }
            E.call(
                'get_docfields',
                {doctype: this._doctype},
                E.fn(function(fields) {
                    if (!E.isArray(fields)) {
                        E.error('Unable to get the fields of {0}.', [this._doctype]);
                        return;
                    }
                    this._setFields(fields);
                }, this)
            );
        }, this);
        return this;
    }
    setTitle(value) {
        if (!this._dialog) this._title = value;
        else this._dialog.set_title(__(text));
        return this;
    }
    setIndicator(color) {
        if (!this._dialog) this._indicator = color;
        else {
            this._dialog.indicator = color;
            this._dialog.set_indicator();
        }
        return this;
    }
    addField(field, position) {
        this._add_fields.push([field, position]);
        return this;
    }
    removeField(name) {
        this._remove_fields.push(name);
        return this;
    }
    removeFields() {
        E.merge(this._remove_fields, arguments);
        return this;
    }
    setFieldProperty(name, key, value) {
        if (this._dialog) this._dialog.set_df_property(name, key, value);
        else {
            this._add_properties[name] = this._add_properties[name] || {};
            this._add_properties[name][key] = value;
        }
        return this;
    }
    setFieldProperties(name, props) {
        E.each(props, function(v, k) {
            this.setFieldProperty(name, k, v);
        }, this);
        return this;
    }
    setFieldsProperties(data) {
        E.each(data, function(props, name) {
            this.setFieldProperties(name, props);
        }, this);
        return this;
    }
    replaceProperties(data) {
        E.merge(this._replace_properties, data);
        return this;
    }
    removeProperties() {
        E.merge(this._remove_properties, arguments);
        return this;
    }
    sortFields(fields) {
        this._sort_fields = fields;
        return this;
    }
    setPrimaryAction(label, callback) {
        this._primary_action = [label, callback];
        return this;
    }
    setSecondaryAction(label, callback) {
        this._secondary_action = [label, callback];
        return this;
    }
    addCustomAction(label, callback, type, position) {
        this._custom_actions.push([label, callback, type, position]);
        return this;
    }
    _setFields(fields) {
        this._fields = fields;
        this._fields.unshift({
            fieldname: 'error_message',
            fieldtype: 'HTML',
            read_only: 1,
            hidden: 1
        });
        this._setup = true;
        if (this._on_setup) {
            this[this._on_setup]();
            this._on_setup = null;
        }
    }
    _setupFields() {
        if (!this.fields) this._setFields([]);
        if (this._add_fields.length) {
            E.each(this._add_fields, function(d) {
                let field = d[0];
                if (d[1]) this._fields.splice(1, 0, field);
                else this._fields.push(field);
            }, this);
            E.clear(this._add_fields);
        }
        if (this._remove_fields.length) {
            this._fields = E.filter(this._fields, E.fn(function(f) {
                return !E.contains(this._remove_fields, f.fieldname);
            }, this));
            E.clear(this._remove_fields);
        }
        this._prepareFields(this._fields);
        if (Object.keys(this._add_properties).length) {
            E.each(this._add_properties, function(prop, name) {
                var field = this.getFieldByName(name);
                if (field && E.isPlainObject(prop)) {
                    E.each(prop, function(v, k) {
                        if (E.isFunction(v)) v = E.fn(v, this);
                        field[k] = v;
                    }, this);
                }
            }, this);
            E.clear(this._add_properties);
        }
        if (Object.keys(this._replace_properties).length) {
            E.each(this._replace_properties, function(v, k) {
                if (E.isArray(v)) {
                    E.each(this._fields_by_ref, function(f) {
                        if (f[k] != null) {
                            delete f[k];
                            f[v[0]] = v[1];
                        }
                    });
                    return;
                }
                var f = this.getFieldByName(k);
                if (!f) return;
                E.each(v, function(y, x) {
                    delete f[x];
                    f[y[0]] = y[1];
                });
            }, this);
            E.clear(this._replace_properties);
        }
        if (this._remove_properties.length) {
            E.each(this._fields_by_ref, function(f) {
                E.each(this._remove_properties, function(k) { delete f[k]; });
            }, this);
            E.clear(this._remove_properties);
        }
        if (this._sort_fields) {
            this._fields.sort(E.fn(function(a, b) {
                return this._sort_fields.indexOf(a.fieldname) - this._sort_fields.indexOf(b.fieldname);
            }, this));
            E.clear(this._sort_fields);
        }
    }
    _prepareFields(fields, parent_name) {
        E.each(fields, function(f) {
            let name = (parent_name ? parent_name + '.' : '') + f.fieldname;
            this._fields_by_name[name] = this._fields_by_ref.length;
            this._fields_by_ref.push(f);
            if (f.fields) {
                delete f.options;
                f.editable_grid = 1;
                this._prepareFields(f.fields, name);
            }
        }, this);
    }
    getFieldByName(name) {
        let idx = this._fields_by_name[name];
        return (idx != null && this._fields_by_ref[idx]) || null;
    }
    build() {
        if (!this._setup) {
            this._on_setup = 'build';
            return this;
        }
        if (this._ready) return this;
        this._setupFields();
        this._dialog = new frappe.ui.Dialog({
            title: __(this._title),
            indicator: this._indicator || 'green',
            fields: this._fields,
        });
        let f = this.getField('error_message');
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
        if (this._primary_action) {
            this._dialog.set_primary_action(
                __(this._primary_action[0]),
                E.fn(this._primary_action[1], this)
            );
            this._primary_action = null;
        }
        if (this._secondary_action) {
            this._dialog.set_secondary_action_label(__(this._secondary_action[0]));
            this._dialog.set_secondary_action(E.fn(this._secondary_action[1], this));
            this._secondary_action = null;
        }
        if (this._custom_actions.length) {
            var pos = ['end', 'start', 'center'];
            E.each(this._custom_actions, function(v) {
                let label = v[0],
                callback = v[1],
                type = v[2],
                position = v[3];
                if (type && E.contains(pos, type)) {
                    position = type;
                    type = null;
                }
                type = type || 'primary';
                position = position || pos[0];
                let pidx = pos.indexOf(position),
                btn = $(`<button type='button' class='btn btn-${type} btn-sm'>
                    ${__(label)}
                </button>`),
                primary = this._dialog.get_primary_btn(),
                key = frappe.scrub(label);
                key = key.replace(/\&/g, '_');
                this._custom_btns[key] = btn;
                if (pidx < 1) primary.parent().append(btn);
                else if (pidx > 1) primary.after(btn);
                else if (pidx > 0) primary.parent().prepend(btn);
                btn.on('click', E.fn(callback, this));
            }, this);
            E.clear(this._custom_actions);
        }
        this._ready = true;
        if (this.__on_ready.length) {
            E.runTasks(this.__on_ready)
            .finally(E.fn(function() { E.clear(this.__on_ready); }, this));
        }
        return this;
    }
    _onReady(fn, args) {
        this.__on_ready.push(E.fn(function() {
            E.fnCall(this[fn], args, this);
        }, this));
        return this;
    }
    show() {
        if (!this._ready) return this._onReady('show');
        this._dialog.show();
        return this;
    }
    hide() {
        if (!this._ready) return this._onReady('hide');
        this._dialog.hide();
        this.clear();
        return this;
    }
    getField(name) {
        return (this._dialog && this._dialog.get_field(name)) || null;
    }
    getValues() {
        return (this._dialog && this._dialog.getValues()) || null;
    }
    getValue(name) {
        return (this._dialog && this._dialog.get_value(name)) || null;
    }
    setValue(name, value) {
        if (!this._ready) return this._onReady('setValue', arguments);
        this._dialog.set_value(name, value);
        return this;
    }
    setValues(values) {
        if (!this._ready) return this._onReady('setValues', arguments);
        this._dialog.set_values(values);
        return this;
    }
    getRow(table, idx) {
        let t = this.getField(table);
        return t && t.grid && t.grid.get_row ? t.get_row(idx) : null;
    }
    getRowName(table, idx) {
        let f = this.getRow(table, idx);
        return (f && f.doc && (f.doc.name || f.doc.idx)) || null;
    }
    getRowField(table, idx, name) {
        let f = this.getRow(table, idx);
        return f && f.get_field ? f.get_field(name) : null;
    }
    getRowFieldValue(table, idx, name) {
        let f = this.getRowField(table, idx, name);
        return f && f.get_value && f.get_value();
    }
    setRowFieldValue(table, idx, name, val) {
        let f = this.getRowField(table, idx, name);
        if (f && f.set_value) f.set_value(val);
        return this;
    }
    setInvalid(name, error) {
        this.setFieldProperty(name, 'invalid', 1);
        let f = this.getField(name);
        if (f && f.set_invalid) f.set_invalid();
        if (E.isString(error) && f && f.set_new_description) f.set_new_description(error);
        return this;
    }
    setRowFieldInvalid(table, idx, name, error) {
        let f = this.getRowField(table, idx, name);
        if (f && f.df && !f.df.invalid) {
            f.df.invalid = 1;
            if (f.set_invalid) f.set_invalid();
            if (E.isString(error) && f.set_new_description) f.set_new_description(error);
        }
        return this;
    }
    setValid(name) {
        this.setFieldProperty(name, 'invalid', 0);
        let f = this.getField(name);
        if (f && f.set_invalid) f.set_invalid();
        if (f && f.set_description) f.set_description();
        return this;
    }
    setRowFieldValid(table, idx, name) {
        let f = this.getRowField(table, idx, name);
        if (f && f.df && f.df.invalid) {
            f.df.invalid = 0;
            if (f.set_invalid) f.set_invalid();
            if (f.set_description) f.set_description();
        }
        return this;
    }
    getAllFields() {
        return this._dialog ? this._dialog.fields_dict : {};
    }
    enableAllFields() {
        if (!this._ready) return this._onReady('enableAllFields');
        E.each(this.getAllFields(), function(f) {
            this.setFieldProperty(f.df.fieldname, 'read_only', 0);
        }, this);
        return this;
    }
    disableAllFields() {
        if (!this._ready) return this._onReady('disableAllFields');
        E.each(this.getAllFields(), function(f) {
            this.setFieldProperty(f.df.fieldname, 'read_only', 1);
        }, this);
        return this;
    }
    showError(txt) {
        if (this.$alert && this.$error) {
            this.$error.html(txt);
            this.$alert.alert('show');
            frappe.ui.scroll(this.$alert);
        }
        this.setFieldProperty('error_message', 'hidden', 0);
        window.setTimeout(E.fn(function() { this.hide_error(); }, this), 3000);
    }
    hideError() {
        if (this.$alert && this.$error) {
            this.$alert.alert('close');
            this.$error.html('');
        }
        this.setFieldProperty('error_message', 'hidden', 1);
    }
    onClear(fn) {
        this.__on_clear.push(E.fn(fn, this));
        return this;
    }
    clear() {
        if (!this._ready) return this._onReady('clear');
        this._dialog.clear();
        E.runTasks(this.__on_clear)
        .finally(E.fn(function() { E.clear(this.__on_clear); }, this));
        return this;
    }
    extend(key, val) {
        if (E.isPlainObject(key)) {
            E.each(key, function(v, k) {
                this.extend(k, v);
            }, this);
            return this;
        }
        if (E.isString(key) && !E.has(this._extends, key)) {
            this[key] = E.isFunction(val) ? E.fn(val, this) : val;
            this._extends.push(key);
        }
        return this;
    }
    unset() {
        E.each(arguments, function(key) {
            if (!E.has(this._extends, key)) return;
            delete this[key];
            let idx = this._extends.indexOf(key);
            if (idx >= 0) this._extends.splice(idx, 1);
        }, this);
        return this;
    }
    reset() {
        this.clear();
        E.each(this._extends, function(key) {
            delete this[key];
        }, this);
        E.clear(this._extends);
        return this;
    }
}

$(document).ready(function() {
    window.E = new Expenses();
    window.E.extend('formDialog', function(title, indicator) {
        return new FormDialog(title, indicator);
    });
    window.E.extend('uniqueArray', function() {
        return new UniqueArray();
    });
});