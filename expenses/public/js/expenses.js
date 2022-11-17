/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


// Expenses
window.E = (function() {
    'use strict';
    
    class Expenses {
        constructor(frm) {
            this._frm = null;
            this._cache = {};
        }
        
        // Helpers
        fn(f, b) {
            if (!this.is_func(f)) f = null;
            b = b || this;
            return function() {
                if (this) Array.prototype.push.call(arguments, this);
                return f && f.apply(b, arguments);
            };
        }
        is_func(v) { return typeof v === 'function'; }
        is_str(v) { return typeof v === 'string'; }
        is_num(v) { return typeof v === 'number'; }
        is_arr(v) { return v && Array.isArray(v); }
        is_cls(v) { return typeof v === 'object' && !this.is_arr(v); }
        is_obj(v) { return v && $.isPlainObject(v); }
        is_url(v) { try { new URL(v); return true; } catch(e) { return false; } }
        to_arr(v) {
            if (v == null) return [];
            if (this.is_arr(v)) return v;
            return !this.is_str(v) && v.length != null ? Array.prototype.slice.call(v) : [v];
        }
        to_obj(v) {
            if (v == null) return {};
            if (this.is_obj(v)) return v;
            let t = {};
            t[v] = v;
            return t;
        }
        to_json(v, d) {
            if (d === undefined) d = v;
            try {
                return JSON.stringify(v);
            } catch(e) { return d; }
        }
        parse_json(v, d) {
            if (d === undefined) d = v;
            try {
                return JSON.parse(v);
            } catch(e) { return d; }
        }
        contains(d, v) {
            let a = d;
            if (this.is_cls(d)) a = Object.values(d);
            return this.is_arr(a) && a.indexOf(v) >= 0;
        }
        contains_any(d, vs) {
            let a = d;
            if (this.is_cls(d)) a = Object.values(d);
            if (!this.is_arr(a)) return false;
            for (let i = 0, l = vs.length; i < l; i++) {
                if (a.indexOf(vs[i]) >= 0) return true;
            }
            return false;
        }
        contains_all(d, vs) {
            let a = d;
            if (this.is_cls(d)) a = Object.values(d);
            if (!this.is_arr(a)) return false;
            for (let i = 0, l = vs.length; i < l; i++) {
                if (a.indexOf(vs[i]) < 0) return false;
            }
            return true;
        }
        has(v, k) {
            return (this.is_arr(v) || this.is_cls(v)) && v[k] != null;
        }
        has_any(v, ks) {
            if (!this.is_arr(ks)) return false;
            let a = v;
            if (this.is_arr(v) || this.is_cls(v)) a = Object.keys(v);
            if (!this.is_arr(a)) return false;
            return this.contains_any(a, ks);
        }
        has_all(v, ks) {
            if (!this.is_arr(ks)) return false;
            let a = v;
            if (this.is_arr(v) || this.is_cls(v)) a = Object.keys(v);
            if (!this.is_arr(a)) return false;
            return this.contains_all(a, ks);
        }
        merge(d, v) {
            if (this.is_arr(d)) {
                Array.prototype.push(d, this.to_arr(v));
            } else if (this.is_obj(d)) {
                Object.assign(d, this.to_obj(v));
            }
            return d;
        }
        clear(v) {
            if (this.is_arr(v)) v.splice(0, v.length);
            else if (this.is_obj(v)) {
                for (let k in v)
                    delete v[k];
            }
            return v;
        }
        each(data, fn, bind) {
            bind = bind || this;
            if (this.is_arr(data)) {
                for (let i = 0, l = data.length; i < l; i++) {
                    if (fn.apply(bind, [data[i], i]) === false) return this;
                }
            } else if (this.is_cls(data)) {
                for (let k in data) {
                    if (
                        data.hasOwnProperty(k)
                        && fn.apply(bind, [data[k], k]) === false
                    ) return this;
                }
            }
            return this;
        }
        clone(data) {
            if (!this.is_arr(data) && !this.is_obj(data)) return data;
            return this.parse_json(this.to_json(data), null);
        }
        array_diff(a, b, f) {
            if (!this.is_arr(a) || !a.length) return this.is_arr(b) ? b : [];
            if (!this.is_arr(b) || !b.length) return f & this.is_arr(a) ? a : [];
            let r = b.filter(function(v) { return a.indexOf(v) < 0; });
            if (!f) return r;
            let t = a.filter(function(v) {
                return b.indexOf(v) < 0 && r.indexOf(v) < 0;
            });
            Array.prototype.push(r, t);
            return r;
        }
        
        // Console & Error
        log() {
            var fn = console.error || console.log,
            pre = '[Expenses]: ';
            return this.each(arguments, function(v) {
                if (this.is_str(v)) fn(pre + v);
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
                return this;
            }
            frappe.msgprint({
                title: __('Error'),
                indicator: 'Red',
                message: __(text, args),
            });
            return this;
        }
        
        // Call
        path(method) {
            return 'expenses.utils.' + method;
        }
        _call(method, args, success, always, resolve, reject) {
            if (args && this.is_func(args)) {
                if (this.is_func(success)) always = success;
                success = args;
                args = null;
            }
            let data = {type: 'GET'};
            if (args) {
                data.type = 'POST';
                if (!this.is_obj(args)) data.args = {'data': args};
                else {
                    data.args = args;
                    if (args.type && args.args) {
                        data.type = args.type;
                        data.args = args.args;
                    }
                }
            }
            if (this.is_str(method)) {
                if (!this.is_url(method)) method = this.path(method);
                data.method = method;
            } else if (this.is_arr(method)) {
                data.doc = method[0];
                data.method = method[1];
            } else {
                this.log('The method passed is invalid', arguments);
                return;
            }
            var ckey = this.to_json(data, ''),
            error = data.error = this.fn(function(e) {
                this.log('Call error.', e);
                this.error('Unable to make the call to {0}', [data.method]);
                reject && reject();
            });
            data.callback = this.fn(function(ret) {
                if (ret && this.is_obj(ret)) ret = ret.message || ret;
                this._cache[ckey] = ret;
                try {
                    let val = this.is_func(success) ? success.call(this, ret) : null;
                    resolve && resolve(val || ret);
                } catch(e) { error(e); }
            });
            if (this._cache[ckey]) {
                data.callback(this._cache[ckey]);
                return this;
            }
            if (this.is_func(always)) data.always = this.fn(always);
            try {
                frappe.call(data);
            } catch(e) { error(e); }
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
        
        // localStorage
        set_cache(key, val) {
            if (!this.is_str(key)) return this;
            if (val != null && !this.is_str(val)) {
                if (!this.is_arr(val) && !this.is_obj(val))
                    val = {__value: val};
                val = this.to_json(val, null);
            }
            if (this.is_str(val)) localStorage.setItem(key, val);
            return this;
        }
        get_cache(key) {
            if (!this.is_str(key)) return;
            let val = localStorage.getItem(key);
            val = this.parse_json(val, null);
            if (val && this.is_obj(val))
                val = val.__value || val;
            return val;
        }
        pop_cache(key) {
            let value = this.get_cache(key);
            this.del_cache(key);
            return value;
        }
        del_cache(key) {
            if (this.is_str(key)) localStorage.removeItem(key);
            return this;
        }
        
        // Database
        get_doc(dt, name, callback) {
            return this.xcall(
                'frappe.client.get',
                {type: 'GET', args: {doctype: dt, name: name}},
                callback
            );
        }
        get_list(dt, opts, callback) {
            frappe.db.get_list(dt, opts).then(this.fn(function(ret) {
                if (ret && this.is_obj(ret)) ret = ret.message || ret;
                this.is_func(callback) && callback.call(this, ret);
            }));
            return this;
        }
        get_value(dt, name, key, callback) {
            frappe.db.get_value(dt, name, key).then(this.fn(function(ret) {
                if (ret && this.is_obj(ret)) ret = ret.message || ret;
                this.is_func(callback) && callback.call(this, ret);
            }));
            return this;
        }
        
        // Form
        frm(v) {
            if (this.is_cls(v)) this._frm = v;
            return this;
        }
        refresh_df() {
            return this.each(arguments, function(f) {
                if (this.is_arr(f)) this._frm.refresh_field.apply(this._frm, f);
                else this._frm.refresh_field(f);
            });
        }
        refresh_row_df() {
            let a = this.to_arr(arguments),
            t = a.shift(),
            r = a.shift();
            if (this.is_arr(a[0])) a = a.shift();
            return this.each(a, function(f) {
                this._frm.refresh_field(t, r, f);
            });
        }
        remove_row(table, cdn) {
            this._frm.get_field(table).grid.grid_rows_by_docname[cdn].remove();
            return this.refresh_df(table);
        }
        row(table, cdn) {
            return this._frm.get_field(table).grid.get_row(cdn);
        }
        row_df(table, cdn, name) {
            return this.get_row(table, cdn).get_field(name);
        }
        clear_table(table) {
            this._frm.set_value(table, []);
            return this.refresh_df(table);
        }
        df_precision(field) {
            let k = field.split('.'),
            f = this._frm.get_field(k[0]);
            if (k[1]) f = f.grid.get_field(k[1]);
            return f.get_precision();
        }
        df_property(field, key, val, table, cdn) {
            if (!table && field.includes('.', 1)) {
                let parts = field.split('.');
                field = parts.pop();
                if (parts.length === 2) cdn = parts.pop();
                table = parts.pop();
            }
            if (table && !cdn) {
                this._frm.get_field(table).grid
                    .update_docfield_property(field, key, val);
            } else if (table && cdn) {
                this._frm.get_field(table).grid.get_row(cdn)
                    .set_field_property(field, key, val);
            } else {
                this._frm.set_df_property(field, key, val);
            }
            return this;
        }
        df_properties(field, props, table, cdn) {
            for (var k in props)
                this.df_property(field, k, props[k], table, cdn);
            return this;
        }
        dfs_property(fields, key, val, table, cdn) {
            if (this.is_str(fields)) fields = fields.split(' ');
            return this.each(fields, function(f) {
                this.df_property(f, key, val, table, cdn);
            });
        }
        dfs_properties(fields, props, table, cdn) {
            for (var k in props)
                this.dfs_property(fields, k, props[k], table, cdn);
            return this;
        }
        row_df_property(table, cdn, field, key, val) {
            this.df_property(field, key, val, table, cdn);
            return this;
        }
        row_df_properties(table, cdn, field, props) {
            for (var k in props)
                this.row_df_property(table, cdn, field, k, props[k]);
            return this;
        }
        row_dfs_property(table, cdn, fields, key, val) {
            return this.each(fields, function(f) {
                this.row_df_property(table, cdn, f, key, val);
            });
        }
        row_dfs_properties(table, cdn, fields, props) {
            for (var k in props)
                this.row_dfs_property(table, cdn, fields, k, props[k]);
            return this;
        }
        
        // Expenses Entry
        get_exchange_rate(from, to, callback) {
            return this.xcall(
                'get_current_exchange_rate',
                {from, to},
                function(v) {
                    v = flt(v);
                    if (v <= 0) v = 1.0;
                    this.is_func(callback) && callback.call(this, v);
                }
            );
        }
        
        // Doc Dialog
        doc_dialog(doctype, title, indicator) {
            return ExpensesDocDialog ? new ExpensesDocDialog(doctype, title, indicator) : null;
        }
        
        // Unique Array
        unique_array(data) {
            return UniqueArray ? new UniqueArray(data) : null;
        }
        // DataTable
        datatable(wrapper) {
            return ExpensesDataTable ? new ExpensesDataTable(wrapper) : null;
        }
    }
    return new Expenses();
}());