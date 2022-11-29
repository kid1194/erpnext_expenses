/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


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
        if (this._dialog) this._dialog.set_title(__(text));
        else this._title = value;
        return this;
    }
    setIndicator(color) {
        if (this._dialog) {
            this._dialog.indicator = color;
            this._dialog.set_indicator();
        } else this._indicator = color;
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
            E.fnCall(this[this._on_setup]);
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
            this._fields = this._fields.filter(E.fn(function(f) {
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
                        if (v && E.isFunction(v)) v = E.fn(v, this);
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
                key = key.replace(/\&/g, '_');
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
        if (f && f.df) f.df.invalid = 1;
        if (f && f.set_invalid) f.set_invalid();
        if (E.isString(error) && f && f.set_new_description) f.set_new_description(error);
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
        if (f && f.df) f.df.invalid = 0;
        if (f && f.set_invalid) f.set_invalid();
        if (f && f.set_description) f.set_description();
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
    if (!E) throw new Error('Expenses library is not loaded.');
    E.extend('formDialog', function(title, indicator) {
        return new FormDialog(title, indicator);
    });
});