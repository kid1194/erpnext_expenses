/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


class ExpensesDocDialog {
    constructor(doctype, title, indicator) {
        this._doctype = doctype;
        this._title = title;
        this._indicator = indicator;
        
        this._add_fields = [];
        this._remove_fields = [];
        this._properties = {};
        this._replace_properties = {};
        this._remove_properties = {};
        this._sort_fields = null;
        this._primary_action = null;
        this._secondary_action = null;
        this._custom_actions = [];
        
        this._setup = false;
        this._fields = null;
        this._fields_by_ref = [];
        this._fields_by_name = {};
        
        this._ready = false;
        this.__on_ready = [];
        this.__on_clear = [];
        this._to_remove = [];
        this._dialog = null;
        this._custom_btns = {};
        this._extends = [];
        
        this._setup();
    }
    add_field(field, start) {
        this._add_fields.push([field, start]);
        return this;
    }
    remove_field(name) {
        this._remove_fields.push(name);
        return this;
    }
    remove_fields() {
        E.merge(this._remove_fields, arguments);
        return this;
    }
    set_field_property(name, key, value) {
        this._properties[name] = this._properties[name] || {};
        this._properties[name][key] = value;
        return this;
    }
    set_field_properties(name, props) {
        this._properties[name] = this._properties[name] || {};
        E.merge(this._properties[name], props);
        return this;
    }
    set_fields_properties(data) {
        E.each(data, function(props, name) {
            this.set_field_properties(name, props);
        }, this);
        return this;
    }
    replace_properties(data) {
        E.merge(this._replace_properties, data);
        return this;
    }
    remove_properties() {
        E.merge(this._remove_properties, arguments);
        return this;
    }
    sort_fields(fields) {
        this._sort_fields = fields;
        return this;
    }
    set_primary_action(label, callback) {
        this._primary_action = [label, callback];
        return this;
    }
    set_secondary_action(label, callback) {
        this._secondary_action = [label, callback];
        return this;
    }
    add_custom_action(label, callback, type, position) {
        this._custom_actions.push([label, callback, type, position]);
        return this;
    }
    _setup() {
        let meta = frappe.get_meta(this._doctype);
        if (meta && E.is_arr(meta.fields)) {
            var fields = E.clone(meta.fields),
            invalid = false;
            E.each(fields, function(f) {
                if (f.fieldtype.includes('Table') && !E.is_arr(f.fields)) {
                    let table_meta = frappe.get_meta(f.options);
                    if (table_meta && E.is_arr(table_meta.fields)) {
                        f.fields = table_meta.fields;
                    } else {
                        invalid = true;
                        return false;
                    }
                }
            });
            if (!invalid) {
                this._set_fields(fields);
                return;
            }
        }
        E.call(
            'get_docfields',
            {doctype: this._doctype},
            E.fn(function(fields) {
                if (!E.is_arr(fields)) {
                    E.error('Unable to get the fields of {0}.', [this._doctype]);
                    return;
                }
                this._set_fields(fields);
            }, this)
        );
    }
    _set_fields(fields) {
        this._fields = fields;
        this._fields.unshift({
            fieldname: 'error_message',
            fieldtype: 'HTML',
            read_only: 1,
            hidden: 1
        });
        this._prepare_fields(this._fields);
        if (this._add_fields.length) {
            E.each(this._add_fields, function(d) {
                let field = d[0];
                if (d[1]) this._fields.splice(1, 0, field);
                else this._fields.push(field);
                let name = field.fieldname;
                if (this._fields_by_name[name] == null) {
                    this._fields_by_name[name] = this._fields_by_ref.length;
                    this._fields_by_ref.push(field);
                }
            }, this);
            E.clear(this._add_fields);
        }
        if (this._remove_fields.length) {
            this._fields = this._fields.filter(E.fn(function(f) {
                return !E.contains(this._remove_fields, f.fieldname);
            }, this));
            E.each(this._remove_fields, function(name) {
                if (this._fields_by_name[name] != null) {
                    this._fields_by_ref.splice(this._fields_by_name[name], 1);
                    delete this._fields_by_name[name];
                }
            }, this);
            E.clear(this._remove_fields);
        }
        if (Object.keys(this._properties).length) {
            E.each(this._properties, function(prop, name) {
                var field = this.get_df_by_name(name);
                if (field && E.is_obj(prop)) {
                    E.each(prop, function(v, k) {
                        if (v && E.is_func(v)) v = E.fn(v, this);
                        field[k] = v;
                    }, this);
                }
            }, this);
            E.clear(this._properties);
        }
        if (Object.keys(this._replace_properties).length) {
            E.each(this._replace_properties, function(v, k) {
                if (E.is_arr(v)) {
                    E.each(this._fields_by_ref, function(f) {
                        if (f[k] != null) {
                            delete f[k];
                            f[v[0]] = v[1];
                        }
                    });
                    return;
                }
                var f = this.get_df_by_name(k);
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
        this._setup = true;
    }
    _prepare_fields(fields, parent_name) {
        E.each(fields, function(f) {
            let name = (parent_name ? parent_name + '.' : '') + f.fieldname;
            this._fields_by_name[name] = this._fields_by_ref.length;
            this._fields_by_ref.push(f);
            if (f.fields) {
                delete f.options;
                f.editable_grid = 1;
                this._prepare_fields(f.fields, name);
            }
        }, this);
    }
    get_df_by_name(name) {
        let idx = this._fields_by_name[name];
        return (idx != null && this._fields_by_ref[idx]) || null;
    }
    build() {
        if (!this._setup) {
            return this;
        }
        if (this._ready) return this;
        this._dialog = new frappe.ui.Dialog({
            title: __(this._title),
            indicator: this._indicator || 'green',
            fields: this._fields,
        });
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
            var pos = ['start', 'center', 'end'];
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
                btn.on('click', E.fn(callback, this));
            }, this);
            E.clear(this._custom_actions);
        }
        this._ready = true;
        if (this.__on_ready.length) {
            frappe.run_serially(this.__on_ready)
            .finally(E.fn(function() { E.clear(this.__on_ready); }, this));
        }
        return this;
    }
    _on_ready(fn, args) {
        this.__on_ready.push(E.fn(function() {
            if (args) this[fn].apply(this, args);
            else this[fn].call(this);
        }, this));
        return this;
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
        return (this._dialog && this._dialog.get_field(name)) || null;
    }
    get_values() {
        return (this._dialog && this._dialog.get_values()) || null;
    }
    get_value(name) {
        return (this._dialog && this._dialog.get_value(name)) || null;
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
    get_row(table, idx) {
        let t = this.get_field(table);
        return t && t.grid && t.grid.get_row ? t.get_row(idx) : null;
    }
    get_row_name(table, idx) {
        let f = this.get_row(table, idx);
        return (f && f.doc && (f.doc.name || f.doc.idx)) || null;
    }
    get_child_value(table, idx, name) {
        let f = this.get_row(table, idx);
        if (f && f.get_field) f = f.get_field(name);
        return f && f.get_value && f.get_value();
    }
    set_child_value(table, idx, name, val) {
        let f = this.get_row(table, idx);
        if (f && f.get_field) f = f.get_field(name);
        if (f && f.set_value) f.set_value(val);
        return this;
    }
    set_invalid(name, error) {
        this.set_df_property(name, 'invalid', 1);
        let f = this.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (E.is_str(error) && f && f.set_new_description) f.set_new_description(error);
        return this;
    }
    set_child_invalid(table, idx, name, error) {
        let f = this.get_row(table, idx);
        if (f && f.get_field) f = f.get_field(name);
        if (f && f.df) f.df.invalid = 1;
        if (f && f.set_invalid) f.set_invalid();
        if (E.is_str(error) && f && f.set_new_description) f.set_new_description(error);
        return this;
    }
    set_valid(name) {
        this.set_df_property(name, 'invalid', false);
        let f = this.get_field(name);
        if (f && f.set_invalid) f.set_invalid();
        if (f && f.set_description) f.set_description();
        return this;
    }
    set_child_valid(table, idx, name) {
        let f = this.get_row(table, idx);
        if (f && f.get_field) f = f.get_field(name);
        if (f && f.df) f.df.invalid = 0;
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
        window.setTimeout(E.fn(function() { this.hide_error(); }, this), 3000);
    }
    hide_error() {
        if (this.$alert && this.$error) {
            this.$alert.alert('close');
            this.$error.html('');
        }
        this.set_df_property('error_message', 'hidden', 1);
    }
    on_clear(fn) {
        this.__on_clear.push(E.fn(fn, this));
        return this;
    }
    clear() {
        if (!this._ready) return this._on_ready('clear');
        this._dialog.clear();
        frappe.run_serially(this.__on_clear)
        .then(E.fn(function() { E.clear(this.__on_clear); }, this));
        return this;
    }
    extend(key, val) {
        if (E.is_obj(key)) {
            E.each(key, function(v, k) {
                this.extend(k, v);
            }, this);
            return this;
        }
        if (E.is_str(key) && !E.has(this._extends, key)) {
            this[key] = E.is_func(val) ? E.fn(val, this) : val;
            this._extends.push(key);
        }
        return this;
    }
    unset() {
        E.each(arguments, function(k) {
            if (!E.has(this._extends, key)) return;
            delete this[key];
            let idx = this._extends.indexOf(key);
            if (idx >= 0) this._extends.splice(idx, 1);
        }, this);
        return this;
    }
}

if (window.E) {
    window.E.extend('doc_dialog', function(doctype, title, indicator) {
        return new ExpensesDocDialog(doctype, title, indicator);
    });
}