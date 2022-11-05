/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to license.txt
*/


class ExpensesDocDialog {
    constructor(doctype, title, indicator) {
        this._doctype = doctype;
        this._title = title;
        this._indicator = indicator;
        
        this._fields = [];
        this._fields_by_ref = [];
        this._fields_by_name = {};
        this._ready = false;
        this.__on_make = [];
        this.__on_ready = [];
        this.__on_clear = [];
        this._to_remove = [];
        this._properties = {};
        this._dialog = null;
        this._custom_btns = {};
        this._extends = [];
        
        this._setup();
    }
    _setup() {
        this._get_fields(this._doctype)
        .then(E.fn(function(fields) {
            this._fields = fields;
            this._fields.unshift({
                fieldname: 'error_message',
                fieldtype: 'HTML',
                read_only: 1,
                hidden: 1
            });
            var tasks = [];
            E.each(this._fields, function(f, i) {
                let name = f.fieldname;
                this._fields_by_name[name] = this._fields_by_ref.length;
                this._fields_by_ref.push(f);
                this._apply_field_properties(name);
                if (f.fieldtype === 'Table') {
                    tasks.push(this._get_table_fields(f, name));
                }
            }, this);
            var callback = E.fn(function() {
                tasks.clear();
                this._make();
            }, this);
            if (tasks.length) {
                Promise.all(tasks).finally(callback);
            } else {
                callback();
            }
        }, this));
    }
    _get_table_fields(field, parent_name) {
        return this._get_fields(field.options)
        .then(E.fn(function(fields) {
            field.fields = fields;
            E.each(field.fields, function(f) {
                let name = parent_name + '.' + f.fieldname;
                this._fields_by_name[name] = this._fields_by_ref.length;
                this._fields_by_ref.push(f);
                this._apply_field_properties(name);
            }, this);
        }, this));
    }
    _get_fields(dt) {
        return E.get_doc('DocType', dt, function(ret) {
            if (!ret || !ret.fields || !E.is_arr(ret.fields) || !ret.fields.length) {
                E.error('Unable to get the quick entry fields for ' + dt, true);
                return;
            }
            return ret.fields;
        });
    }
    _on_make(fn, args) {
        this.__on_make.push(E.fn(function() {
            if (args) this[fn].apply(this, args);
            else this[fn].call(this);
        }, this));
        return this;
    }
    remove_field(name) {
        if (!this._ready) return this._on_make('remove_field', arguments);
        this._fields = this._fields.filter(function(f) { return f.fieldname !== name; });
        if (this._fields_by_name[name]) {
            this._fields_by_ref.splice(this._fields_by_name[name], 1);
            delete this._fields_by_name[name];
        }
        return this;
    }
    remove_fields(names) {
        if (!this._ready) return this._on_make('remove_fields', arguments);
        this._fields = this._fields.filter(function(f) { return names.indexOf(f.fieldname) < 0; });
        E.each(names, function(n) {
            if (this._fields_by_name[n]) {
                this._fields_by_ref.splice(this._fields_by_name[n], 1);
                delete this._fields_by_name[n];
            }
        }, this);
        return this;
    }
    set_field_property(name, key, value) {
        if (!this._ready) return this._on_make('set_field_property', arguments);
        this._properties[name] = this._properties[name] || {};
        this._properties[name][key] = value;
        this._apply_field_properties(name);
        return this;
    }
    set_field_properties(name, props) {
        if (!this._ready) return this._on_make('set_field_properties', arguments);
        this._properties[name] = this._properties[name] || {};
        E.each(props, function(k, v) { this._properties[name][k] = v; }, this);
        this._apply_field_properties(name);
        return this;
    }
    set_fields_properties(data) {
        E.each(data, function(name, props) {
            this.set_field_properties(name, props);
        }, this);
        return this;
    }
    remove_properties(data) {
        if (!this._ready) return this._on_make('remove_properties', arguments);
        E.each(this._fields_by_ref, function(f) {
            E.each(data, function(k) { delete f[k]; });
        });
        return this;
    }
    sort_fields(fields) {
        if (!this._ready) return this._on_make('sort_fields', arguments);
        var new_fields = {};
        E.each(this._fields, function(f, i) {
            let idx = fields.indexOf(f.fieldname);
            if (idx >= 0) new_fields[idx] = f;
        });
        this._fields = Object.values(new_fields);
        return this;
    }
    _on_ready(fn, args) {
        this.__on_ready.push((function() {
            if (args) this[fn].apply(this, args);
            else this[fn].call(this);
        }).bind(this));
        return this;
    }
    set_primary_action(label, callback) {
        if (!this._ready) return this._on_ready('set_primary_action', arguments);
        callback = callback.bind(this);
        this._dialog.set_primary_action(__(label), callback);
        return this;
    }
    set_secondary_action(label, callback) {
        if (!this._ready) return this._on_ready('set_secondary_action', arguments);
        this._dialog.set_secondary_action_label(__(label));
        callback = callback.bind(this);
        this._dialog.set_secondary_action(callback);
        return this;
    }
    add_custom_action(label, callback, type, position) {
        if (!this._ready) return this._on_ready('add_custom_action', arguments);
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
        if (field && E.is_obj(this._properties[name])) {
            E.each(this._properties[name], function(v, k) {
                if (v && E.is_func(v)) v = E.fn(v, this);
                field[k] = v;
            }, this);
            delete this._properties[name];
        }
    }
    get_field_by_name(name) {
        let idx = this._fields_by_name[name];
        return idx != null ? this._fields_by_ref[idx] || null : null;
    }
    _make() {
        if (this._ready) return;
        this._ready = true;
        if (this.__on_make.length) {
            frappe.run_serially(this.__on_make)
            .finally((function() { this.__on_make.clear(); }).bind(this));
        }
        this._dialog = new frappe.ui.Dialog({
            title: __(this._title),
            indicator: this._indicator || 'green',
            fields: this._fields,
        });
        if (this.__on_ready.length) {
            frappe.run_serially(this.__on_ready)
            .finally((function() { this.__on_ready.clear(); }).bind(this));
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
        if (!this._ready) return this._on_ready('set_title', arguments);
        this._dialog.set_title(__(text));
        return this;
    }
    show() {
        if (!this._ready) return this._on_ready('show');
        this._dialog.show();
        return this;
    }
    hide() {
        if (!this._ready) return this._on_ready('hide');
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
        if (!this._ready) return this._on_ready('set_value', arguments);
        this._dialog.set_value(name, value);
        return this;
    }
    set_values(values) {
        if (!this._ready) return this._on_ready('set_values', arguments);
        this._dialog.set_values(values);
        return this;
    }
    set_invalid(name, error) {
        this.set_df_property(name, 'invalid', true);
        let f = this._dialog && this._dialog.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (E.is_str(error) && f && f.set_new_description) f.set_new_description(error);
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
        return this._dialog ? this._dialog.fields_dict : {};
    }
    set_df_property(name, prop, value) {
        if (!this._ready) return this._on_ready('set_df_property', arguments);
        this._dialog.set_df_property(name, prop, value);
        return this;
    }
    set_df_properties(name, props) {
        if (!this._ready) return this._on_ready('set_df_properties', arguments);
        E.each(props, function(v, k) {
            this._dialog.set_df_property(name, k, v);
        }, this);
        return this;
    }
    enable_all_fields() {
        if (!this._ready) return this._on_ready('enable_all_fields');
        E.each(this.get_all_fields(), function(f) {
            this.set_df_property(f.df.fieldname, 'read_only', 0);
        }, this);
        return this;
    }
    disable_all_fields() {
        if (!this._ready) return this._on_ready('disable_all_fields');
        E.each(this.get_all_fields(), function(f) {
            this.set_df_property(f.df.fieldname, 'read_only', 1);
        }, this);
        return this;
    }
    show_error(txt) {
        if (this.$alert && this.$error) {
            this.$error.html(txt);
            this.$alert.alert('show');
            frappe.ui.scroll(this.$alert);
        }
        this.set_df_property('error_message', 'hidden', 0);
        window.setTimeout((function() { this.hide_error(); }).bind(this), 3000);
    }
    hide_error() {
        if (this.$alert && this.$error) {
            this.$alert.alert('close');
            this.$error.html('');
        }
        this.set_df_property('error_message', 'hidden', 1);
    }
    on_clear(fn) {
        this.__on_clear.push(fn.bind(this));
        return this;
    }
    clear() {
        if (!this._ready) return this._on_ready('clear');
        this._dialog.clear();
        frappe.run_serially(this.__on_clear)
        .then((function() { this.__on_clear.clear(); }).bind(this));
        return this;
    }
    extend(key, val) {
        if (E.is_obj(key)) {
            E.each(arguments, function(v, k) {
                this.extend(k, v);
            }, this);
            return this;
        }
        if (E.is_str(key) && !this._extends.has(key)) {
            this[key] = E.is_func(val) ? E.fn(val, this) : val;
            this._extends.push(key);
        }
        return this;
    }
    unset() {
        E.each(arguments, function(k) {
            if (!this._extends.has(key)) return;
            delete this[key];
            this._extends.del(key);
        }, this);
        return this;
    }
}