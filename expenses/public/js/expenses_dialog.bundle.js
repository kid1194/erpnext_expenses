/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


frappe.provide('frappe.exp');


class ExpensesDialog extends ExpensesUtils {
    constructor(title, indicator) {
        this._exp = frappe.exp();
        
        this.dialog = null;
        this.$alert = null;
        this.$error = null;
        
        this._opt = {
            title: title,
            indicator: indicator,
        };
        
        this._setup = false;
        this._ready = false;
        this._doctype = null;
        this._fields = {
            all: null,
            by_ref: [],
            by_name: {},
            add: [],
            del: [],
            sort: null,
        };
        this._props = {
            add: {},
            rep: {},
            del: [],
        };
        this._actions = {
            primary: null,
            secondary: null,
            custom: [],
            btns: {},
        };
        this._extends = [];
    }
    load(dt) {
        this._doctype = dt;
        let meta = frappe.get_meta(this._doctype);
        if (meta && this.$isArr(meta.fields)) {
            let fields = [],
            invalid = false,
            f;
            for (let i = 0, l = meta.fields.length; i < l; i++) {
                f = $.extend(true, {}, meta.fields[i]);
                fields[i] = f;
                if (f.fieldtype.indexOf('Table') >= 0 && !this.$isArr(f.fields)) {
                    let tmeta = frappe.get_meta(f.options);
                    if (tmeta && this.$isArr(tmeta.fields)) {
                        f.fields = tmeta.fields.slice();
                    } else {
                        invalid = true;
                        break;
                    }
                }
            }
            if (!invalid) {
                this._set_fields(fields);
                return;
            }
        }
        this._exp.request(
            'get_docfields',
            {doctype: this._doctype},
            $.proxy(function(ret) {
                if (!ret || !this.$isArr(ret))
                    this.error('Unable to get the fields of {0}.', [this._doctype]);
                else this._set_fields(ret);
            }, this)
        );
        return this;
    }
    set_title(value) {
        if (!this.dialog) this._opt.title = value;
        else this.dialog.set_title(__(value));
        return this;
    }
    set_indicator(color) {
        if (!this.dialog) this._opt.indicator = color;
        else {
            this.dialog.indicator = color;
            this.dialog.set_indicator();
        }
        return this;
    }
    add_field(field, position) {
        this._fields.add.push([field, position]);
        return this;
    }
    del_field(name) {
        this._fields.del.push(name);
        return this;
    }
    del_fields() {
        Array.prototype.push.apply(this._fields.del, arguments);
        return this;
    }
    sort_fields(fields) {
        this._fields.sort = fields;
        return this;
    }
    set_field_prop(name, key, value) {
        if (this.dialog) this.dialog.set_df_property(name, key, value);
        else {
            this._props.add[name] = this._props.add[name] || {};
            this._props.add[name][key] = value;
        }
        return this;
    }
    set_field_props(name, props) {
        for (let k in props) this.set_field_prop(name, k, props[k]);
        return this;
    }
    set_fields_props(data) {
        for (let k in data) this.set_field_props(k, data[k]);
        return this;
    }
    replace_props(data) {
        for (let k in data) this._props.rep[k] = data[k];
        return this;
    }
    del_props() {
        Array.prototype.push.apply(this._props.del, arguments);
        return this;
    }
    primary_action(label, fn) {
        if (!this.dialog) this._actions.primary = [label, fn];
        return this;
    }
    secondary_action(label, fn) {
        if (!this.dialog) this._actions.secondary = [label, fn];
        return this;
    }
    custom_action(label, fn, type, position) {
        if (!this.dialog) this._actions.custom.push([label, fn, type, position]);
        return this;
    }
    _set_fields(fields) {
        this._fields.all = fields;
        this._fields.all.unshift({
            fieldname: 'error_message',
            fieldtype: 'HTML',
            read_only: 1,
            hidden: 1
        });
        this._setup = true;
        this._exp.emit('setup');
    }
    _setup_fields() {
        if (!this._fields.all) this._set_fields([]);
        
        $.each(this._fields.add, $.proxy(function(i, f) {
            if (f[1]) this._fields.all.splice(f[1], 0, f[0]);
            else this._fields.all.push(f[0]);
        }, this));
        delete this._fields.add;
        
        $.each(this._fields.all, $.proxy(function(i, f) {
            if (this._fields.del.indexOf(f.fieldname) >= 0)
                this._fields.all.splice(i, 1);
        }, this));
        delete this._fields.del;
        
        this._prepare_fields(this._fields.all);
        
        $.each(this._props.add, $.proxy(function(k, v) {
            let f = this.get_field_by_name(k);
            if (f && this.$isDataObj(v))
                for (let x in v) {
                    if (this.$isFunc(v[x])) v[x] = $.proxy(v[x], this);
                    f[x] = v[x];
                }
        }, this));
        delete this._props.add;
        
        $.each(this._props.rep, $.proxy(function(k, v) {
            if (this.$isArr(v)) {
                $.each(this._fields.by_ref, function(i, f) {
                    if (f[k] != null) {
                        delete f[k];
                        f[v[0]] = v[1];
                    }
                });
                return;
            }
            var f = this.get_field_by_name(k);
            if (!f) return;
            $.each(v, function(x, y) {
                delete f[x];
                f[y[0]] = y[1];
            });
        }, this));
        delete this._props.rep;
        
        $.each(this._fields.by_ref, $.proxy(function(i, f) {
            $.each(this._props.del, function(x, k) {
                delete f[k];
            });
        }, this));
        delete this._props.del;
        
        if (this._fields.sort)
            this._fields.all.sort($.proxy(function(a, b) {
                return this._fields.sort.indexOf(a.fieldname) - this._fields.sort.indexOf(b.fieldname);
            }, this));
        delete this._fields.sort;
    }
    _prepare_fields(fields, parent_name) {
        $.each(fields, $.proxy(function(i, f) {
            let n = (parent_name ? parent_name + '.' : '') + f.fieldname;
            this._fields.by_name[n] = this._fields.by_ref.length;
            this._fields.by_ref.push(f);
            if (f.fields) {
                delete f.options;
                f.editable_grid = 1;
                this._prepare_fields(f.fields, n);
            }
        }, this));
    }
    get_field_by_name(name) {
        let idx = this._fields.by_name[name];
        return idx != null ? this._fields.by_ref[idx] : null;
    }
    build() {
        if (!this._setup) {
            this._exp.on('setup', $.proxy(this.build, this));
            return this;
        }
        if (this._ready) return this;
        
        this._setup_fields();
        this.dialog = new frappe.ui.Dialog({
            title: __(this._opt.title),
            indicator: this._opt.indicator || 'green',
            fields: this._fields.all,
        });
        
        let f = this.get_field('error_message');
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
        
        if (this._actions.primary) {
            this.dialog.set_primary_action(
                __(this._actions.primary[0]),
                $.proxy(this._actions.primary[1], this)
            );
            delete this._actions.primary;
        }
        
        if (this._actions.secondary) {
            this.dialog.set_secondary_action_label(__(this._actions.secondary[0]));
            this.dialog.set_secondary_action($.proxy(this._actions.secondary[1], this));
            delete this._actions.secondary;
        }
        
        if (this._actions.custom.length) {
            var allpos = ['end', 'start', 'center'];
            $.each(this._actions.custom, function(i, v) {
                let label = v[0],
                fn = v[1],
                type = v[2],
                pos = v[3];
                if (type && allpos.indexOf(type) >= 0) {
                    pos = type;
                    type = null;
                }
                type = type || 'primary';
                pos = pos || allpos[0];
                let idx = allpos.indexOf(pos),
                btn = $(`<button type='button' class='btn btn-${type} btn-sm'>
                    ${__(label)}
                </button>`),
                primary = this.dialog.get_primary_btn(),
                key = frappe.scrub(label);
                key = key.replace(/\&/g, '_');
                this._actions.btns[key] = btn;
                if (idx < 1) primary.parent().append(btn);
                else if (idx > 1) primary.after(btn);
                else if (idx > 0) primary.parent().prepend(btn);
                btn.on('click', $.proxy(fn, this));
            }, this);
        }
        delete this._actions.custom;
        
        this._ready = true;
        this._exp.emit('ready');
        return this;
    }
    show() {
        if (!this._ready) this._exp.on('ready', $.proxy(this.show, this));
        else this.dialog.show();
        return this;
    }
    hide() {
        if (!this._ready) this._exp.on('ready', $.proxy(this.hide, this));
        else {
            this.dialog.hide();
            this.clear();
        }
        return this;
    }
    get_field(name) {
        return this.dialog ? this.dialog.get_field(name) : null;
    }
    get_values() {
        return this.dialog ? this.dialog.get_values() : null;
    }
    get_value(name) {
        return this.dialog ? this.dialog.get_value(name) : null;
    }
    set_value(name, value) {
        if (!this._ready)
            this._exp.on('ready', $.proxy(function() {
                this.set_value(name, value);
            }, this));
        else this.dialog.set_value(name, value);
        return this;
    }
    set_values(values) {
        if (!this._ready)
            this._exp.on('ready', $.proxy(function() {
                this.set_values(values);
            }, this));
        else this.dialog.set_values(values);
        return this;
    }
    get_row(table, idx) {
        let t = this.get_field(table);
        return t && t.grid && t.grid.get_row ? t.get_row(idx) : null;
    }
    get_row_name(table, idx) {
        let f = this.get_row(table, idx);
        return f && f.doc ? f.doc.name || f.doc.idx : null;
    }
    get_row_field(table, idx, name) {
        let f = this.get_row(table, idx);
        return f && f.get_field ? f.get_field(name) : null;
    }
    get_row_field_value(table, idx, name) {
        let f = this.get_row_field(table, idx, name);
        return f && f.get_value ? f.get_value() : null;
    }
    set_row_field_value(table, idx, name, val) {
        let f = this.get_row_field(table, idx, name);
        if (f && f.set_value) f.set_value(val);
        return this;
    }
    set_invalid(name, error) {
        this.set_field_prop(name, 'invalid', 1);
        let f = this.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (this.$isStr(error) && f && f.set_new_description)
            f.set_new_description(error);
        return this;
    }
    set_row_field_invalid(table, idx, name, error) {
        let f = this.get_row_field(table, idx, name);
        if (f && f.df && !f.df.invalid) {
            f.df.invalid = 1;
            if (f.set_invalid) f.set_invalid();
            if (this.$isStr(error) && f.set_new_description) f.set_new_description(error);
        }
        return this;
    }
    set_valid(name) {
        this.set_field_prop(name, 'invalid', 0);
        let f = this.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (f && f.set_description) f.set_description();
        return this;
    }
    set_row_field_valid(table, idx, name) {
        let f = this.get_row_field(table, idx, name);
        if (f && f.df && f.df.invalid) {
            f.df.invalid = 0;
            if (f.set_invalid) f.set_invalid();
            if (f.set_description) f.set_description();
        }
        return this;
    }
    get_all_fields() {
        return this.dialog ? this.dialog.fields_dict : {};
    }
    enable_all_fields() {
        if (!this._ready) this._exp.on('ready', $.proxy(this.enable_all_fields, this));
        else $.each(this.get_all_fields(), $.proxy(function(k, f) {
            this.set_field_prop(f.df.fieldname, 'read_only', 0);
        }, this));
        return this;
    }
    disable_all_fields() {
        if (!this._ready) this._exp.on('ready', $.proxy(this.disable_all_fields, this));
        else $.each(this.get_all_fields(), $.proxy(function(k, f) {
            this.set_field_prop(f.df.fieldname, 'read_only', 1);
        }, this));
        return this;
    }
    show_error(txt) {
        if (this.$alert && this.$error) {
            this.$error.html(txt);
            this.$alert.alert('show');
            frappe.ui.scroll(this.$alert);
        }
        this.set_field_prop('error_message', 'hidden', 0);
        window.setTimeout($.proxy(function() { this.hide_error(); }, this), 3000);
    }
    hide_error() {
        if (this.$alert && this.$error) {
            this.$alert.alert('close');
            this.$error.html('');
        }
        this.set_field_prop('error_message', 'hidden', 1);
    }
    onClear(fn) {
        this._exp.on('clear', $.proxy(fn, this));
        return this;
    }
    clear() {
        if (!this._ready) this._exp.on('ready', $.proxy(this.clear, this));
        else this._exp.emit('clear');
        return this;
    }
    extend(key, val) {
        if (this.$isDataObj(key)) {
            $.each(key, $.proxy(this.extend, this));
            return this;
        }
        if (this.$isStr(key) && this._extends.indexOf(key) < 0) {
            this[key] = this.$isFunc(val) ? $.proxy(val, this) : val;
            this._extends.push(key);
        }
        return this;
    }
    unset() {
        $.each(arguments, $.proxy(function(i, k) {
            delete this[k];
            i = this._extends.indexOf(k);
            if (i >= 0) this._extends.splice(i, 1);
        }, this));
        return this;
    }
    reset() {
        this.clear();
        $.each(this._extends, $.proxy(function(i, k) {
            delete this[k];
        }, this));
        delete this._extends;
        this._extends = [];
        return this;
    }
}