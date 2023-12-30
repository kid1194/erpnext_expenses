/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.exp');


class Expenses {
    constructor(opts) {
        this.set_options(opts);
        
        this.is_ready = false;
        this.is_enabled = true;
        this._events = {
            list: {},
            real: {},
        };
        
        if (this.startup) {
            this.is_ready = true;
            this.emit('ready');
        } else {
            this.request(
                'is_enabled',
                null,
                function(ret) {
                    this.is_ready = true;
                    this.is_enabled = !!ret;
                    this._startup();
                },
                function() {
                    this.fatal('Status check failed.');
                }
            );
        }
    }
    
    set_options(opts) {
        if (this.$isDataObj(opts)) $.extend(this, opts);
        return this;
    }
    _startup() {
        this.on('exp_app_status_changed', function(ret) {
            if (!ret || !this.$isDataObj(ret) || this.$isVoid(ret.is_enabled)) {
                this.fatal('Invalid status change event.');
            } else {
                ret.is_enabled = !!ret.is_enabled;
                let changed = this.is_enabled !== ret.is_enabled;
                this.is_enabled = ret.is_enabled;
                if (changed) this.emit('changed');
            }
        });
        this.emit('ready');
    }
    
    path(method) {
        return 'expenses.libs.' + method;
    }
    request(method, args, callback, error, _freeze) {
        if (method.indexOf('.') < 0) method = this.path(method);
        let opts = {
            method: method,
            freeze: _freeze != null ? _freeze : false,
            callback: $.proxy(function(ret) {
                if (ret && this.$isDataObj(ret)) ret = ret.message || ret;
                if (ret && !ret.error) {
                    callback && callback.call(this, ret);
                    return;
                }
                let message = ret.message || 'The request sent raised an error.';
                if (!error) this.error(message, args);
                else error.call(this, {message: __(message, args)});
            }, this),
            error: $.proxy(function(ret, txt) {
                let message = '';
                if (this.$isStr(ret)) message = ret;
                else if (this.$isStr(txt)) message = txt;
                else message = 'The request sent have failed.';
                if (!error) this.error(message, args);
                else error.call(this, {message: __(message, args)});
            }, this)
        };
        if (args) {
            opts.type = 'POST';
            opts.args = args;
        }
        try {
            frappe.call(opts);
        } catch(e) {
            if (error) error.call(this, e);
            else this._error('Error: ' + e.message, e.stack);
            if (this.has_error) throw e;
        } finally {
            this.has_error = false;
        }
        return this;
    }
    
    on(event, fn, _realtime) {
        return this._event_adder(event, fn, 0, _realtime);
    }
    once(event, fn, _realtime) {
        return this._event_adder(event, fn, 1, _realtime);
    }
    off(event, fn) {
        if (!this.$isStr(event) || !event.length) return this;
        if (!this.$isFunc(fn)) fn = null;
        event.split(' ').forEach($.proxy(function(e) {
            if (this._events.list[e]) this._event_remover(e, fn);
        }, this));
        return this;
    }
    emit(event, args) {
        if (!this.$isStr(event) || !event.length) return this;
        args = this.$isArr(args) ? args : (!this.$isVoid(args) ? [args] : null);
        event.split(' ').forEach($.proxy(function(e) {
            if (!this._events.list[e]) return;
            this._emit_looper(e, args);
            this._events_clear(e);
        }, this));
        return this;
    }
    _event_adder(event, fn, _once, _realtime) {
        if (!this.$isStr(event) || !event.length || !this.$isFunc(fn)) return this;
        event.split(' ').forEach($.proxy(function(e) {
            if (e === 'ready' && this.is_ready) return fn.call(this);
            if (!this._events.list[e]) {
                this._events.list[e] = [];
                if (e.indexOf('exp_') >= 0 || _realtime) {
                    this._events.real[e] = $.proxy(function(ret) {
                        if (ret && this.$isDataObj(ret)) ret = ret.message || ret;
                        this.emit(e, [ret]);
                    }, this);
                    frappe.realtime.on(e, this._events.real[e]);
                }
            }
            this._events.list[e].push({f: fn, fn: $.proxy(fn, this), o: _once});
        }, this));
        return this;
    }
    _event_remover(event, fn) {
        if (fn)
            this._events.list[event] = this._events.list[event].filter(function(e) {
                return e.f !== fn;
            });
        this._events_clear(event, !fn);
    }
    _events_clear(event, all) {
        if (!all && this._events.list[event].length) return;
        delete this._events.list[event];
        if (!this._events.real[event]) return;
        frappe.realtime.off(event, this._events.real[event]);
        delete this._events.real[event];
    }
    _emit_looper(e, args) {
        this._events.list[e] = this._events.list[e].filter(function(ev) {
            if (!args) ev.fn();
            else ev.fn.apply(null, args);
            return !ev.o;
        });
    }
    
    // form
    setup_form(frm, workflow) {
        try {
            if (!this.is_enabled) {
                frm._app_disabled = true;
                if (!frm._form_disabled) {
                    this.disable_form(frm, workflow);
                    frm.set_intro(__('Expenses app is disabled.'), 'red');
                }
                frm._form_disabled = true;
            } else {
                frm._app_disabled = false;
                if (frm._form_disabled) {
                    this.enable_form(frm, workflow);
                    frm.set_intro();
                }
                frm._form_disabled = false;
            }
        } catch(e) {
            this._error('Setup form', e.message, e.stack);
        } finally {
            this.has_error = false;
        }
        return this;
    }
    enable_form(frm, workflow) {
        try {
            var fields = null;
            if (this.$isArr(frm._disabled_fields) && frm._disabled_fields.length)
                fields = frm._disabled_fields.splice(0, frm._disabled_fields.length);
            frm.fields.forEach(function(field) {
                if (!fields || fields.indexOf(field.df.fieldname) >= 0)
                    frm.set_df_property(field.df.fieldname, 'read_only', '0');
            });
            if (
                !workflow || frm.doc.__islocal
                || (workflow && !frm.states.get_state())
            ) frm.enable_save();
            else frm.page.show_actions_menu();
        } catch(e) {
            this._error('Enable form', e.message, e.stack);
        } finally {
            this.has_error = false;
        }
        return this;
    }
    disable_form(frm, workflow) {
        try {
            if (!this.$isArr(frm._disabled_fields))
                frm._disabled_fields = [];
            frm.fields.forEach(function(field) {
                if (!cint(field.df.read_only)) {
                    frm._disabled_fields.push(field.df.fieldname);
                    frm.set_df_property(field.df.fieldname, 'read_only', 1);
                }
            });
            if (
                !workflow || frm.doc.__islocal
                || (workflow && !frm.states.get_state())
            ) frm.disable_save();
            else frm.page.hide_actions_menu();
        } catch(e) {
            this._error('Disable form', e.message, e.stack);
        } finally {
            this.has_error = false;
        }
        return this;
    }
    
    get_field(frm, key, cdn, fkey, form) {
        let field = frm.get_field(key);
        if (field && field.grid && cdn && fkey) {
            let row = field.grid.get_row(cdn);
            if (!row) return;
            field = row.get_field(fkey);
            if (
                form && row.grid_form
                && row.grid_form.fields_dict
            ) field = row.grid_form.fields_dict[fkey] || field;
        }
        return field;
    }
    get_grid(frm, key) {
        let field = frm.get_field(key);
        if (field) return field.grid;
    }
    get_row(frm, key, cdn) {
        let grid = this.get_grid(frm, key);
        if (grid) return grid.get_row(cdn);
    }
    focus(frm, key, cdn, fkey, form) {
        let field = this.get_field(frm, key, cdn, fkey, form);
        if (field && field.$input) field.$input.focus();
        if (!field || !cdn) return this;
        let row = this.get_row(frm, key, cdn);
        if (row && row.row && form) {
            field = row.row.find('[data-fieldname="' + fkey +'"]');
            if (field.length) field.first().focus();
            else {
                row.row.find('input[type="Text"],textarea,select')
                    .filter(':visible:first').focus();
            }
        } else {
            field = frm.get_field(key);
            if (field.grid.wrapper)
                field.grid.wrapper.focus();
        }
        return this;
    }
    field_desc(frm, key, desc, cdn, fkey, form) {
        let field = this.get_field(frm, key, cdn, fkey, form);
        if (field && field.set_new_description) {
            if (desc) field.set_new_description(__(desc));
            if (field.toggle_description)
                field.toggle_description(!!desc);
        }
        return this;
    }
    invalid_field(frm, key, err, cdn, fkey, form) {
        let field = this.get_field(frm, key, cdn, fkey, form);
        if (!field) return this;
        let change = 0;
        if (field.df && field.set_invalid) {
            field.df.invalid = 1;
            field.set_invalid();
            change++;
        }
        if (err && field.set_new_description) {
            field.set_new_description(__(err));
            if (field.toggle_description)
                field.toggle_description(true);
            change++;
        }
        if (change) frm.refresh_field(key);
        return this;
    }
    valid_field(frm, key, cdn, fkey, form) {
        let field = this.get_field(frm, key, cdn, fkey, form);
        if (!field) return this;
        let change = 0;
        if (field.df && field.set_invalid) {
            field.df.invalid = 0;
            field.set_invalid();
            change++;
        }
        if (field.set_description) {
            field.set_description();
            if (
                field.toggle_description
                && (!field.df || !cstr(field.df.description).length)
            ) field.toggle_description(false);
            change++;
        }
        if (change) frm.refresh_field(key);
        return this;
    }
    
    // cache
    set_cache(key, val) {
        try {
            sessionStorage.setItem('exp_' + key, JSON.stringify({___: val}));
        } catch(_) {}
        return this;
    }
    get_cache(key) {
        try {
            let val = sessionStorage.getItem('exp_' + key);
            val = JSON.parse(val);
            if (val.___ != null) val = val.___;
            return val;
        } catch(_) {}
        return;
    }
    pop_cache(key) {
        let val = this.get_cache(key);
        this.del_cache(key);
        return val;
    }
    del_cache(key) {
        try {
            sessionStorage.removeItem('exp_' + key);
        } catch(_) {}
        return this;
    }
    
    table(cols) {
        return new ExpensesTable(cols);
    }
    
    // utility
    $type(v) {
        let t = v == null ? (v === void 0 ? 'Undefined' : 'Null')
            : Object.prototype.toString.call(v).slice(8, -1);
        return t === 'Number' && isNaN(v) ? 'NaN' : t;
    }
    $isStr(v) { return this.$type(v) === 'String'; }
    $isVoid(v) { return this.$type(v) === 'Undefined'; }
    $isFunc(v) { return typeof v === 'function' || /(Function|^Proxy)$/.test(this.$type(v)); }
    $isArr(v) { return $.isArray(v); }
    $isDataObj(v) { return $.isPlainObject(v); }
    $isEmptyObj(v) { return $.isEmptyObject(v); }
    $toArr(v, s, e) { return Array.prototype.slice.call(v, s, e); }
    
    
    _alert(title, msg, args, def_title, indicator, fatal) {
        if (this.$isArr(msg)) {
            args = msg;
            msg = null;
        }
        if (!msg) {
            msg = title;
            title = null;
        }
        if (msg && !this.$isStr(msg)) {
            if (this.$isArr(msg))
                try { msg = JSON.stringify(msg); } catch(_) { msg = null; }
            else if (typeof msg === 'object')
                try { msg = msg.message; } catch(_) { msg = null; }
            else
                try { msg = String(msg); } catch(_) { msg = null; }
        }
        if (!msg || !this.$isStr(msg)) msg = __('Invalid message');
        else if (args) msg = __(msg, args);
        else msg = __(msg);
        if (!title || !this.$isStr(title)) title = def_title;
        let data = {
            title: '[Expenses]: ' + __(title),
            indicator: indicator,
            message: msg,
        };
        if (!fatal) frappe.msgprint(data);
        else {
            this.has_error = true;
            frappe.throw(data);
        }
        return this;
    }
    error(title, msg, args) {
        return this._alert(title, msg, args, 'Error', 'red');
    }
    info(title, msg, args) {
        return this._alert(title, msg, args, 'Info', 'blue');
    }
    fatal(title, msg, args) {
        return this._alert(title, msg, args, 'Error', 'red', true);
    }
    
    _console(fn, args) {
        args = this.$toArr(args);
        let prefix = '[Expenses]';
        if (!this.$isStr(args[0])) args.unshift(prefix);
        else args[0] = prefix + ' ' + args[0];
        console[fn].apply(null, args);
        return this;
    }
    _log() {
        return this._console('log', arguments);
    }
    _error() {
        return this._console('error', arguments);
    }
}


class ExpensesTable {
    constructor(n) {
        this._c = {0: []};
        
        n = n || 1;
        for (let i = 0; i < n; i++) this._c[i + 1] = [];
    }
    get length() { return this._c[0].length; }
    idx(v, i) {
        return this._c[i || 0].indexOf(v);
    }
    has(v, i) {
        return this.idx(v, i) >= 0;
    }
    add() {
        let i = this.idx(arguments[0]);
        if (i >= 0) {
            for (let k in this._c) {
                if (k !== 0) this._c[k][i] = arguments[k];
            }
        } else {
            for (let i = 0, l = arguments.length; i < l; i++) {
                if (arguments[i] != null) this._c[i].push(arguments[i]);
            }
        }
        return this;
    }
    del(v, i) {
        i = this.idx(v, i);
        if (i >= 0) {
            for (let k in this._c) this._c[k].splice(i, 1);
        }
        return this;
    }
    col(i) {
        return this._c[i];
    }
    row(v, i) {
        i = this.idx(v, i);
        if (i < 0) return null;
        let r = [];
        for (let k in this._c) r[k] = this._c[k][i];
        return r;
    }
    clear() {
        for (let k in this._c)
            this._c[k].splice(0, this._c[k].length);
    }
}


frappe.exp = function(opts) {
    if (!frappe.exp._init) frappe.exp._init = new Expenses(opts);
    else frappe.exp._init.set_options(opts);
    return frappe.exp._init;
};