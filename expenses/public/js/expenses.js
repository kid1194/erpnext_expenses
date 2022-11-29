/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


class Expenses {
    constructor() {
        this.log('Library is initiated');
        this._path = 'expenses.utils.';
        this._frm = null;
        this._cache = {};
    }
    
    // Helpers
    _objectType(v) {
        if (v == null) return v === undefined ? 'Undefined' : 'Null';
        let t = Object.prototype.toString.call(v).slice(8, -1);
        return t === 'Number' && isNaN(v) ? 'NaN' : t;
    }
    _ofType(v, t) {
        return this._objectType(v) === t;
    }
    _ofAny(v, t) {
        return t.split(' ').indexOf(this._objectType(v)) >= 0;
    }
    _propertyOf(v, k) {
        return Object.prototype.hasOwnProperty.call(v, k);
    }
    
    // Check
    isString(v) {
        return v != null && typeof v === 'string';
    }
    isNumber(v) {
        return this._ofType(v, 'Number') && !isNaN(v);
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
        && !this._ofAny(v, 'String Number Boolean Array RegExp Date URL');
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
        if (this.isPlainObject(v)) return v;
        if (this.isObject(v)) return Object.entries(v);
        let t = {};
        if (v != null) t[v] = v;
        return t;
    }
    
    // Bind
    fn(f, b) {
        var me = this;
        return function() {
            if (this) Array.prototype.push.call(arguments, this);
            return me.fnCall(f, arguments, b);
        };
    }
    fnCall(f, a, b) {
        if (this.isFunction(f)) return f.apply(b || this, this.toArray(a));
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
                if (this._propertyOf(d, k)) {
                    let r = this.fnCall(fn, [d[k], k], b);
                    if (r !== undefined) return r;
                }
            }
        }
    }
    contains(d, v) {
        let a = d;
        if (this.isObject(d)) a = Object.values(d);
        return this.isArray(a) && a.indexOf(v) >= 0;
    }
    containsAny(d, vs) {
        if (!this.isArray(vs)) return false;
        let a = d;
        if (this.isObject(d)) a = Object.values(d);
        if (!this.isArray(a)) return false;
        for (let i = 0, l = vs.length; i < l; i++) {
            if (a.indexOf(vs[i]) >= 0) return true;
        }
        return false;
    }
    containsAll(d, vs) {
        if (!this.isArray(vs)) return false;
        let a = d;
        if (this.isObject(d)) a = Object.values(d);
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
        let a = d;
        if (this.isIteratable(d)) a = Object.keys(d);
        if (!this.isArray(a)) return false;
        for (let i = 0, l = ks.length; i < l; i++) {
            if (a.indexOf(ks[i]) >= 0) return true;
        }
        return false;
    }
    hasAll(d, ks) {
        if (!this.isArray(ks)) return false;
        let a = d;
        if (this.isIteratable(d)) a = Object.keys(d);
        if (!this.isArray(a)) return false;
        for (let i = 0, l = ks.length; i < l; i++) {
            if (a.indexOf(ks[i]) < 0) return false;
        }
        return true;
    }
    merge(d, v) {
        if (this.isArray(d)) {
            Array.prototype.push.call(d, this.toArray(v));
        } else if (this.isObject(d)) {
            $.extend(d, this.toObject(v));
        }
        return d;
    }
    clear(d) {
        if (this.isArray(d)) d.splice(0, d.length);
        else if (this.isObject(d)) {
            for (let k in d) {
                if (this._propertyOf(d, k)) delete d[k];
            }
        }
        return d;
    }
    clone(d) {
        if (!this.isIteratable(d)) return d;
        return this.parseJson(this.toJson(d));
    }
    filter(d, fn) {
        if (fn == null) fn = function(v) { return v != null; };
        if (!this.isIteratable(d) || !this.isFunction(fn)) return d;
        if (this.isArray(d)) return d.filter(fn);
        let r = d.constructor();
        this.each(d, function(v, k) {
            if (this.fnCall(fn, [v, k]) !== false) r[k] = v;
        });
        return r;
    }
    map(d, fn) {
        if (!this.isIteratable(d) || !this.isFunction(fn)) return d;
        if (this.isArray(d)) return d.map(fn);
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
            if (fn) list.push(this.runTask(fn, b));
        });
        return Promise.all(tasks);
    }
    
    extend(key, fn) {
        if (!this[key]) this[key] = this.fn(fn);
        return this;
    }
}

$(document).ready(function() {
    window.E = new Expenses();
});