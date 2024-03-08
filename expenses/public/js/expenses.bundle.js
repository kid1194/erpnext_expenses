/*
*  Expenses © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


(function() {
    function onload() {
        window.removeEventListener('load', onload);
        $(document).off('ready', onload);
        function $isFn(v) { return typeof v === 'function'; }
        (function() {
            let id = 'core-polyfill';
            function onload() {
                Promise.wait = function(ms) {
                    return new Promise(function(resolve) {
                        window.setTimeout(resolve, ms);
                    });
                };
                Promise.prototype.timeout = function(ms) {
                    return Promise.race([
                        this,
                        Promise.wait(ms).then(function() { throw new Error('Time out'); })
                    ]);
                };
            }
            if (
                $isFn(String.prototype.trim) && $isFn(String.prototype.includes)
                && $isFn(String.prototype.startsWith) && $isFn(String.prototype.endsWith)
                && $isFn(Array.prototype.includes) && $isFn(Function.prototype.bind)
                && $isFn(window.Promise)
            ) onload();
            else {
                let $el = document.getElementById(id);
                if (!!$el) onload();
                else {
                    $el = document.createElement('script');
                    $el.id = id;
                    $el.src = 'https://polyfill.io/v3/polyfill.min.js?features=String.prototype.trim%2CString.prototype.includes%2CString.prototype.startsWith%2CString.prototype.endsWith%2CArray.prototype.includes%2CFunction.prototype.bind%2CPromise';
                    $el.type = 'text/javascript';
                    $el.async = true;
                    $el.onload = onload;
                    document.getElementsByTagName('head')[0].appendChild($el);
                }
            }
        }());
        (function() {
            /*Array.prototype._remove = function(v) {
                v = this.indexOf(v);
                if (v >= 0) return this.splice(v, 1);
            };*/
            /*Array.prototype._clear = function() {
                if (this.length) this.splice(0, this.length);
                return this;
            };*/
            XMLHttpRequest.prototype._clear = function() {
                this.onload = this.onerror = this.onabort = this.ontimeout = null;
            };
        }());
    }
    window.addEventListener('load', onload, {capture: true, once: true, passive: true});
    $(document).ready(onload);
}());


class LevelUpCore {
    destroy() {
        for (let k in this) { if (this.$hasProp(k)) delete this[k]; }
    }
    $type(v) {
        if (v == null) return v === null ? 'Null' : 'Undefined';
        let t = Object.prototype.toString.call(v).slice(8, -1);
        return t === 'Number' && isNaN(v) ? 'NaN' : t;
    }
    $hasProp(k, o) { return Object.prototype.hasOwnProperty.call(o || this, k); }
    $isof(v, t) { return v != null && this.$type(v) === t; }
    $isObjLike(v) { return v != null && typeof v === 'object'; }
    $isStr(v) { return this.$isof(v, 'String'); }
    $isStrVal(v) { return this.$isStr(v) && v.length; }
    $isNum(v) { return this.$isof(v, 'Number') && isFinite(v); }
    $isBool(v) { return v === true || v === false; }
    $isBoolLike(v) { return this.$isBool(v) || v === 0 || v === 1; }
    $isFunc(v) { return typeof v === 'function' || /(Function|^Proxy)$/.test(this.$type(v)); }
    $isArr(v) { return this.$isof(v, 'Array'); }
    $isArrVal(v) { return this.$isArr(v) && v.length; }
    $isArgs(v) { return this.$isof(v, 'Arguments'); }
    $isArgsVal(v) { return this.$isArgs(v) && v.length; }
    $isArrLike(v) {
        return this.$isObjLike(v) && !this.$isStr(v) && this.$isNum(v.length)
            && (v.length === 0 || v[v.length - 1] != null);
    }
    $isBaseObj(v) { return this.$isof(v, 'Object'); }
    $isObj(v, d) {
        return this.$isObjLike(v) && (!(v = Object.getPrototypeOf(v))
            || (this.$hasProp('constructor', v) && this.$isFunc(v.constructor)
                && (!d || this.$fnStr(v.constructor) === this.$fnStr(Object))));
    }
    $fnStr(v) { return Function.prototype.toString.call(v); }
    $isEmptyObj(v) {
        if (this.$isObjLike(v)) for (let k in v) { if (this.$hasProp(k, v)) return false; }
        return true;
    }
    $isDataObj(v) { return this.$isObj(v, 1); }
    $isDataObjVal(v) { return this.$isDataObj(v) && !this.$isEmptyObj(v); }
    $isEmpty(v) {
        return v == null || v === '' || v === 0 || v === false
        || (this.$isArrLike(v) && v.length ==+ 0) || this.$isEmptyObj(v);
    }
    $ext(v, o, s, e) {
        if (this.$isDataObj(v)) for (let k in v) this.$getter(k, v[k], s, e, o);
        return this;
    }
    $def(v, o) { return this.$ext(v, o, 0); }
    $xdef(v, o) { return this.$ext(v, o, 0, 1); }
    $static(v, o) { return this.$ext(v, o, 1); }
    $getter(k, v, s, e, o) {
        o = o || this;
        if (!s) o['_' + k] = v;
        if ((s || e) && o[k] == null)
            Object.defineProperty(o, k, s ? {value: v} : {get() { return this['_' + k]; }});
        return this;
    }
    $extend() {
        let a = this.$toArr(arguments),
        d = this.$isBool(a[0]) && a.shift(),
        v = this.$isBaseObj(a[0]) ? a.shift() : {};
        for (let i = 0, l = a.length; i < l; i++) {
            if (!this.$isBaseObj(a[i])) continue;
            for (let k in a[i]) {
                if (!this.$hasProp(k, a[i]) || a[i][k] == null) continue;
                if (!d || !this.$isBaseObj(v[k]) || !this.$isBaseObj(a[i][k])) v[k] = a[i][k];
                else this.$extend(d, v[k], a[i][k]);
            }
        }
        return v;
    }
    $toArr(v, s, e) { try { return Array.prototype.slice.call(v, s, e); } catch(_) { return []; } }
    $toJson(v, d) { try { return JSON.stringify(v); } catch(_) { return d; } }
    $parseJson(v, d) { try { return JSON.parse(v); } catch(_) { return d; } }
    $fn(fn, o) { return fn.bind(o || this); }
    $afn(fn, a, o) {
        if (a == null) return this.$fn(fn, o);
        a = !this.$isArr(a) ? [a] : a.slice();
        a.unshift(o || this);
        return fn.bind.apply(fn, a);
    }
    $call(fn, a, o) {
        if (a != null && !this.$isArrLike(a)) a = [a];
        o = o || this;
        switch ((a || '').length) {
            case 0: return fn.call(o);
            case 1: return fn.call(o, a[0]);
            case 2: return fn.call(o, a[0], a[1]);
            case 3: return fn.call(o, a[0], a[1], a[2]);
            case 4: return fn.call(o, a[0], a[1], a[2], a[3]);
            case 5: return fn.call(o, a[0], a[1], a[2], a[3], a[4]);
            default: return fn.apply(o, a);
        }
    }
    $timeout(fn, tm, a) {
        if (tm == null) return (fn && window.clearTimeout(fn)) || this;
        return window.setTimeout(this.$afn(fn, a), tm || 0);
    }
    $proxy(fn, tm) {
        fn = this.$fn(fn);
        return {
            _r: null,
            _fn: function(a, d) {
                this.cancel();
                let f = function() { a.length ? fn.apply(null, a) : fn(); };
                this._r = d ? window.setTimeout(f, tm) : f();
            },
            call: function() { this._fn(arguments); },
            delay: function() { this._fn(arguments, 1); },
            cancel: function() { this._r && (this._r = window.clearTimeout(this._r)); },
        };
    }
}


class LevelUpBase extends LevelUpCore {
    constructor(mod, key, doc, ns, prod) {
        super();
        this._mod = mod;
        this._key = key;
        this._tmp = '_' + this._key;
        this._doc = new RegExp('^' + doc);
        this._real = this._key + '_';
        this._pfx = '[' + this._key.toUpperCase() + ']';
        this._ns = ns + (ns.slice(-1) !== '.' ? '.' : '');
        this._prod = !!prod;
        this._events = {
            sock: !!frappe.socketio.socket,
            list: {},
            real: {},
            once: 'ready destroy after_destroy'.split(' ')
        };
    }
    $alert(t, m, d, i, f) {
        m == null && (m = t) && (t = null);
        if (f) this._err = 1;
        t = {title: this.$isStrVal(t) ? t : this._mod + ' ' + d, indicator: i};
        this.$isDataObj(m) ? (t = this.$extend(m, t)) : (t.message = '' + m);
        (f ? frappe.throw : frappe.msgprint)(t);
        return this;
    }
    debug(t, m, a) { return this._prod ? this : this.$alert(t, m, a, __('Debug'), 'gray'); }
    log(t, m, a) { return this._prod ? this : this.$alert(t, m, a, __('Log'), 'cyan'); }
    info(t, m, a) { return this.$alert(t, m, a, __('Info'), 'light-blue'); }
    warn(t, m, a) { return this.$alert(t, m, a, __('Warning'), 'orange'); }
    error(t, m, a) { return this.$alert(t, m, a, __('Error'), 'red'); }
    fatal(t, m, a) { return this.$alert(t, m, a, __('Error'), 'red', 1); }
    $console(fn, a) {
        if (this._prod) return this;
        if (!this.$isStr(a[0])) Array.prototype.unshift.call(a, this._pfx);
        else a[0] = (this._pfx + ' ' + a[0]).trim();
        (console[fn] || console.log).apply(null, a);
        return this;
    }
    _debug() { return this.$console('debug', arguments); }
    _log() { return this.$console('log', arguments); }
    _info() { return this.$console('info', arguments); }
    _warn() { return this.$console('warn', arguments); }
    _error() { return this.$console('error', arguments); }
    ajax(url, opts, success, error) {
        opts = this.$extend({type: 'GET', headers: {}}, this.$isBaseObj(opts) && opts);
        success = this.$isFunc(success) ? this.$fn(success) : null;
        error = this.$isFunc(error) ? this.$fn(error) : null;
        let obj = opts.type != 'get' && opts.type != 'head';
        var xhr = new XMLHttpRequest();
        xhr.open(opts.type.toUpperCase(), url, true, opts.username, opts.password);
        xhr.responseType = opts.responseType || 'text';
        opts.timeout && (xhr.timeout = opts.timeout);
        opts.withCredentials && (xhr.withCredentials = t);
        opts.mimeType && xhr.overrideMimeType(opts.mimeType);
        xhr.setRequestHeader('Content-type', 'application/' + (obj ? 'json': 'x-www-form-urlencoded'));
        !opts.crossDomain && xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        for (let k in opts.headers) this.$hasProp(k, opts.headers) && xhr.setRequestHeader(k, opts.headers[k]);
        xhr.onload = this.$fn(function() {
            xhr._clear();
            let c = xhr.status === 0 ? 200 : xhr.status;
            if (c < 200 || c >= 300) return xhr.throw();
            success && success(this.$parseJson(xhr.responseText, xhr.responseText), c);
        });
        xhr.throw = this.$fn(function() {
            let m = this.$isStrVal(xhr.statusText) ? __(xhr.statusText) : __('The ajax request sent failed.');
            error ? error({message: m, code: xhr.status === 0 ? 200 : xhr.status}) : this.error(m);
        });
        xhr.onabort = xhr.onerror = xhr.ontimeout = function() { xhr._clear(); xhr.abort(); xhr.throw(); };
        try { xhr.send(this._ajax_data(opts.data, obj)); } catch(e) {
            error ? error(e) : this.error(e.message);
            if (this._err) throw e;
        } finally { this._err = 0; }
        return this;
    }
    _ajax_data(d, o) {
        if (this.$isStr(d) || this.$isOf(d, 'FormData')) return d;
        if (this.$isOf(d, 'HTMLFormElement')) return new FormData(d);
        if (o || this.$isArr(d) || !this.$isBaseObj(d)) return this.$toJson(d);
        let q = '', e = window.encodeURIComponent;
        for (let k in d) {
            if (!this.$hasProp(k, d)) continue;
            if (!this.$isArr(d[k])) q = q + e(k) + '=' + e(d[k]) + '&';
            else { for (let i = 0, l = d[k].length; i < l; i++) q = q + e(k) + (l > 1 ? '[' + i + ']=' : '=') + e(d[k][i]) + '&'; }
        }
        return q.substring(0, q.length - 1) || null;
    }
    get_method(v) { return this._ns + v; }
    request(m, a, s, f) {
        s = this.$isFunc(s) && this.$fn(s);
        f = this.$isFunc(f) && this.$fn(f);
        let d = {
            method: m.includes('.') ? m : this.get_method(m),
            callback: this.$fn(function(r) {
                r = (this.$isObjLike(r) && r.message) || r;
                if (!this.$isDataObj(r) || !r.error) return s && s(r);
                r = this.$isDataObjVal(r) && ((this.$isStrVal(r.message) && __(r.message))
                    || (this.$isStrVal(r.error) && __(r.error)))
                    || __('The request sent returned an invalid response.');
                f ? f({message: r}) : this.error(r, a);
            }),
            error: this.$fn(function(r, t) {
                r = (this.$isStrVal(r) && __(r)) || (this.$isStrVal(t) && __(t))
                    || __('The request sent raised an error.');
                f ? f({message: r}) : this.error(r);
            })
        };
        if (this.$isDataObjVal(a)) this.$extend(d, {type: 'POST', args: a});
        try { frappe.call(d); } catch(e) {
            f ? f(e) : this.error(e.message);
            if (this._err) throw e;
        } finally { this._err = 0; }
        return this;
    }
    on(e, fn)  { return this._on(e, fn); }
    xon(e, fn)  { return this._on(e, fn, 0, 1); }
    once(e, fn) { return this._on(e, fn, 1); }
    xonce(e, fn) { return this._on(e, fn, 1, 1); }
    real(e, fn, n) { return this._on(e, fn, n, 0, 1); }
    xreal(e, fn, n) { return this._on(e, fn, n, 1, 1); }
    off(e, fn, rl) {
        if (e == null) return this._off();
        if (this.$isBoolLike(e)) return this._off(0, 1);
        if (!this.$isStrVal(e)) return this;
        fn = this.$isFunc(fn) && fn;
        e = e.split(' ');
        for (let i = 0, l = e.length, ev; i < l; i++) {
            ev = (rl ? this._real : '') + e[i];
            this._events.list[ev] && this._off(ev, fn);
        }
        return this;
    }
    emit(e) {
        let a = this.$toArr(arguments, 1);
        e = e.split(' ');
        for (let i = 0, l = e.length; i < l; i++)
            this._events.list[e[i]] && this._emit(e[i], a);
        return this;
    }
    _on(ev, fn, nc, st, rl) {
        ev = ev.split(' ');
        fn = this.$fn(fn);
        for (let es = this._events, i = 0, l = ev.length, e; i < l; i++) {
            e = (rl ? this._real : '') + ev[i];
            if (e === es.once[0] && this.is_ready) {
                fn();
                continue;
            }
            if (es.once.includes(e)) nc = 1;
            if (!es.list[e]) {
                es.list[e] = [];
                if (rl && es.sock) frappe.realtime.on(e, (es.real[e] = this._rfn(e)));
            }
            es.list[e].push({f: fn, o: nc, s: st});
        }
        return this;
    }
    _rfn(e) {
        return this.$fn(function(ret) {
            ret = (this.$isObjLike(ret) && ret.message) || ret;
            this._emit(e, ret != null ? [ret] : ret, 1);
        });
    }
    _off(e, fn) {
        if (e && fn) this._del(e, fn);
        else if (!e) {
            for (let ev in this._events.list) fn ? this._off(ev, fn) : this._del(ev);
        } else {
            let es = this._events;
            es.real[e] && frappe.realtime.off(e, es.real[e]);
            delete es.list[e];
            delete es.real[e];
        }
        return this;
    }
    _del(e, fn) {
        let ev = this._events.list[e].slice(), ret = [];
        for (let x = 0, i = 0, l = ev.length; i < l; i++)
            (fn ? ev[i].f !== fn : ev[i].s) && (ret[x++] = ev[i]);
        !ret.length ? this._off(e) : (this._events.list[e] = ret);
    }
    _emit(e, a, d) {
        let ev = this._events.list[e].slice(), ret = [],
        pms = d ? Promise.wait(300) : Promise.resolve();
        pms.catch(this.$fn(function(e) { this._error('Events emit', e, a, e.message, e.stack); }));
        for (let x = 0, i = 0, l = ev.length; i < l; i++) {
            pms.then(this.$afn(ev[i].f, a));
            !ev[i].o && (ret[x++] = ev[i]);
        }
        !ret.length ? this._off(e) : (this._events.list[e] = ret);
    }
}


class LevelUp extends LevelUpBase {
    constructor(mod, key, doc, ns, prod) {
        super(mod, key, doc, ns, prod);
        this._router = {obj: null, old: 0, val: ['app']};
        this._win = {
            e: {
                unload: this.$fn(this.destroy),
                popstate: this.$fn(function() { this._win.fn.delay(); }),
                change: this.$fn(function() { this._win.fn.call(1); }),
            },
            fn: this.$proxy(function(n) {
                (this.is_self_list() && this.clean_list()) || (this.is_self_form() && this.clean_form());
                this._routes();
                this.emit(n ? 'page_change' : 'page_pop');
            }, 200),
        };
        window.addEventListener('beforeunload', this._win.e.unload);
        window.addEventListener('popstate', this._win.e.popstate);
        this._route_change('on');
    }
    options(opts) { return this.$static(opts); }
    destroy() {
        this._win.fn.cancel();
        window.removeEventListener('beforeunload', this._on_unload);
        window.removeEventListener('popstate', this._state_popped);
        this._route_change('off');
        this.emit('destroy').emit('after_destroy').off(1);
        super.destroy();
    }
    _route_change(fn) {
        if (!this._router.obj)
            for (let ks = ['router', 'route'], i = 0, l = ks.length; i < l; i++) {
                if (!frappe[ks[i]]) continue;
                this._router.obj = frappe[ks[i]];
                this._router.old = i < 1;
                break;
            }
        if (this._router.obj && this._router.obj[fn])
            this._router.obj[fn]('change', this._win.e.change);
    }
    _routes() {
        let v;
        try { this._router.obj && (v = (!this._router.old ? frappe.get_route() : v) || this._router.obj.parse()); } catch(_) {}
        if (this.$isArrVal(v)) this._router.val = v;
    }
    route(i) { return this._router.val[i] || this._router.val[0]; }
    get is_list() { return this.route(0).toLowerCase() === 'list'; }
    get is_form() { return this.route(0).toLowerCase() === 'form'; }
    get is_self() { return this._doc.test(this.route(1).toLowerCase()); }
    is_doctype(v) { return this.route(1) === v; }
    _is_self_view(o, f) {
        return ((this.is_form && (o = this.get_form(o))) || (this.is_list && (o = this.get_list(o))))
            && this._doc.test(((o && o.doctype) || this.route(1)).toLowerCase());
    }
    get_list(o) { return (o = o || window.cur_list) && this.$isObjLike(o) ? o : null; }
    get_form(o) { return (o = o || window.cur_frm) && this.$isObjLike(o) ? o : null; }
    is_self_list(o) { return this._is_self_view(o); }
    setup_list(o) {
        if (!(o = this.get_list(o)) || !this.is_self_list(o)) return this;
        o[this._tmp] = {disabled: 0};
        let k = 'toggle_actions_menu_button';
        if (this.is_enabled) {
            o[this._tmp].disabled = 0;
            o['_' + k] && (o[k] = o['_' + k]);
            delete o['_' + k];
            o.page.clear_inner_toolbar();
            o.set_primary_action();
        } else if (!o[this._tmp].disabled) {
            o[this._tmp].disabled = 1;
            o.page.hide_actions_menu();
            o.page.clear_primary_action();
            o.page.add_inner_message(__('{0} app is disabled.', [this._mod]))
                .removeClass('text-muted').addClass('text-danger');
            o['_' + k] = o[k];
            o[k] = function() {};
        }
        return this;
    }
    clean_list(o) {
        if (!(o = this.get_list(o))) return this;
        delete o[this._tmp];
        let k = 'toggle_actions_menu_button';
        o['_' + k] && (o[k] = o['_' + k]);
        delete o['_' + k];
        return this;
    }
    is_self_form(o) { return this._is_self_view(o, 1); }
    clean_form(frm) {
        if ((frm = this.get_form(frm))) delete frm[this._tmp];
        return this;
    }
    setup_form(frm, wf) {
        if (!(frm = this.get_form(frm)) || !this.is_self_form(frm)) return this;
        frm[this._tmp] = {disabled: 0, intro: 0, fields: []};
        try {
            if (this.is_enabled) this.enable_form(frm, wf);
            else this.disable_form(frm, __('{0} app is disabled.', [this._mod]), wf);
        } catch(e) { this._error('Setup form error', e.message, e.stack); }
        return this;
    }
    enable_form(frm, wf) {
        if (!(frm = this.get_form(frm))) return this;
        let obj;
        try {
            obj = this.is_self_form(frm) && frm[this._tmp];
            let dfs = obj && obj.disabled ? obj.fields : null;
            if ((obj && !obj.disabled) || (dfs && !dfs.length)) return this;
            for (let i = 0, l = frm.fields.length, f; i < l; i++) {
                f = frm.fields[i];
                if (dfs && !dfs.includes(f.df.fieldname)) continue;
                if (f.df.fieldtype === 'Table') this._enable_table(frm, f.df.fieldname);
                else this._enable_field(frm, f.df.fieldname);
            }
            if (!!frm.is_new() || !this._has_flow(frm, wf)) frm.enable_save();
            else frm.page.show_actions_menu();
            if (obj && obj.intro) {
                obj.intro = 0;
                frm.set_intro();
            }
        } catch(e) { this._error('Enable form', e.message, e.stack); }
        finally {
            try { if (obj) this.$extend(obj, {disabled: 0, fields: []}); } catch(_) {}
            this.emit('form_enabled', frm);
        }
        return this;
    }
    disable_form(frm, msg, wf, color) {
        if (!(frm = this.get_form(frm))) return this;
        if (color == null && this.$isStr(wf)) {
            color = wf;
            wf = 0;
        }
        let obj;
        try {
            obj = this.is_self_form(frm) && frm[this._tmp];
            if (obj && obj.disabled) return this;
            for (let i = 0, l = frm.fields.length, f; i < l; i++) {
                f = frm.fields[i].df;
                if (f.fieldtype === 'Table') this._disable_table(frm, f.fieldname);
                else this._disable_field(frm, f.fieldname);
            }
            if (!!frm.is_new() || !this._has_flow(frm, wf)) frm.disable_save();
            else frm.page.hide_actions_menu();
        } catch(e) { this._error('Disable form', e.message, e.stack); }
        finally {
            try {
                if (this.$isStrVal(msg)) {
                    obj && (obj.intro = 1);
                    frm.set_intro(msg, color || 'red');
                }
            } catch(_) {}
            try { obj && (obj.disabled = 1); } catch(_) {}
            this.emit('form_disabled', frm);
        }
        return this;
    }
    _has_flow(frm, wf) {
        try { return frm && wf && frm.states && frm.states.get_state(); } catch(_) {}
    }
    get_field(frm, k, n, ck, g) {
        return (frm = this.get_form(frm)) ? this._get_field(frm, k, n, ck, g) : null;
    }
    _get_field(frm, k, n, ck, g) {
        let f = frm.get_field(k);
        f && n != null && (f = f.grid && f.grid.get_row(n));
        f && ck != null && (f = !g ? f.get_field(ck) : f.grid_form && (f.grid_form.fields_dict || {})[ck]);
        if (f) return f;
    }
    _reload_field(frm, k, n, ck) {
        n != null && (frm = this._get_field(frm, k, n));
        frm && frm.refresh_field && frm.refresh_field(n == null ? k : ck);
    }
    _toggle_translatable(f, s) {
        if (!cint(f.df.translatable) || !f.$wrapper) return;
        f = f.$wrapper.find('.clearfix .btn-translation');
        if (f.length) s ? f.show() : f.hide();
    }
    enable_field(frm, key, cdn, ckey) {
        (frm = this.get_form(frm)) && this._enable_field(frm, key, cdn, ckey);
        return this;
    }
    _enable_field(frm, k, n, ck) {
        try {
            let o = this.is_self_form(frm) && frm[this._tmp],
            fk = n == null ? k : [k, n, ck].join('-');
            if (o && !o.fields.includes(fk)) return;
            let f = this._get_field(frm, k, n, ck);
            if (!f || !f.df || !!cint(f.df.hidden) || !this._is_field(f.df.fieldtype)) return;
            o && o.fields._remove(fk);
            n == null && frm.set_df_property(k, 'read_only', 0);
            if (n == null) return this._toggle_translatable(f, 1);
            f = this._get_field(frm, k, n);
            f && f.set_field_property(ck, 'read_only', 0);
            f = this._get_field(frm, k, n, ck, 1);
            f && f.df && this._toggle_translatable(f, 1);
        } catch(_) {}
    }
    disable_field(frm, k, n, ck) {
        (frm = this.get_form(frm)) && this._disable_field(frm, k, n, ck);
        return this;
    }
    _disable_field(frm, k, n, ck) {
        try {
            let fs = this.is_self_form(frm) && frm[this._tmp].fields,
            fk = n == null ? k : [k, n, ck].join('-');
            if (fs && fs.includes(fk)) return;
            let f = this._get_field(frm, k, n, ck);
            if (!f || !f.df || !!cint(f.df.hidden) || !this._is_field(f.df.fieldtype)) return;
            fs && fs.push(fk);
            n == null && frm.set_df_property(k, 'read_only', 1);
            if (n == null) return this._toggle_translatable(f, 0);
            f = this._get_field(frm, k, n);
            f && f.set_field_property(ck, 'read_only', 1);
            f = this._get_field(frm, k, n, ck, 1);
            f && f.df && this._toggle_translatable(f, 0);
        } catch(_) {}
    }
    _is_field(v) { return v && !/^((Tab|Section|Column) Break|Table)$/.test(v); }
    enable_table(frm, key) {
        (frm = this.get_form(frm)) && this._enable_table(frm, key);
        return this;
    }
    _enable_table(frm, k) {
        try {
            let fs = this.is_self_form(frm) && (frm[this._tmp] || {}).fields;
            if (fs && !fs.includes(k)) return;
            fs && fs._remove(k);
            let f = frm.get_field(k);
            if (!f || !f.df || !!cint(f.df.hidden) || f.df.fieldtype !== 'Table' || !f.grid) return;
            f.df.__in_place_edit != null && (f.df.in_place_edit = f.df.__in_place_edit);
            delete f.df.__in_place_edit;
            f = f.grid;
            f.meta && f.__editable_grid != null && (f.meta.editable_grid = f.__editable_grid);
            delete f.__editable_grid;
            f.__static_rows != null && (f.static_rows = f.__static_rows);
            delete f.__static_rows;
            f.__sortable_status != null && (f.sortable_status = f.__sortable_status);
            delete f.__sortable_status;
            this._reload_field(frm, k);
            f.__header_row != null && f.header_row.configure_columns_button.toggleClass('hidden', 0).children().toggleClass('hidden', 0);
            delete f.__header_row;
            f.__header_search != null && f.header_search.wrapper.toggleClass('hidden', 0);
            delete f.__header_search;
            if (f.__editable && f.grid_rows && f.grid_rows.length)
                for (let i = 0, l = f.grid_rows.length; i < l; i++) {
                    f.grid_rows[i].open_form_button.toggleClass('hidden', 0).children().toggleClass('hidden', 0);
                    f.grid_rows[i].refresh();
                }
            delete f.__header_search;
            f.wrapper && this._toggle_buttons(f, 1, !!fs);
        } catch(_) {}
    }
    disable_table(frm, key, opts) {
        !this.$isDataObj(opts) && (opts = null);
        (frm = this.get_form(frm)) && this._disable_table(frm, key, opts);
        return this;
    }
    _disable_table(frm, k, o) {
        try {
            let fs = this.is_self_form(frm) && (frm[this._tmp] || {}).fields,
            f = frm.get_field(k);
            if (!f || !f.df || !!cint(f.df.hidden) || f.df.fieldtype !== 'Table' || !f.grid) return;
            fs && !fs.includes(k) && fs.push(k);
            f.df.__in_place_edit !== f.df.in_place_edit && (f.df.__in_place_edit = f.df.in_place_edit);
            f.df.in_place_edit = false;
            f = f.grid;
            if (f.meta) {
                f.__editable_grid !== f.meta.editable_grid && (f.__editable_grid = f.meta.editable_grid);
                f.meta.editable_grid = true;
            }
            f.__static_rows !== f.static_rows && (f.__static_rows = f.static_rows);
            f.static_rows = true;
            if (!o || !o.sortable) {
                f.__sortable_status !== f.sortable_status && (f.__sortable_status = f.sortable_status);
                f.sortable_status = false;
            }
            this._reload_field(frm, k);
            if (
                (!o || !o.configurable)
                && f.header_row && f.header_row.configure_columns_button
                && !f.header_row.configure_columns_button.hasClass('hidden')
            ) {
                f.__header_row = 1;
                f.header_row.configure_columns_button.toggleClass('hidden', 1).children().toggleClass('hidden', 1);
                f.header_row.configure_columns_button.off('click');
            }
            if (
                f.header_search && f.header_search.wrapper
                && !f.header_search.wrapper.hasClass('hidden')
            ) {
                f.__header_search = 1;
                f.header_search.wrapper.toggleClass('hidden', 1);
            }
            if ((!o || !o.editable) && f.grid_rows && f.grid_rows.length) {
                f.__editable = 1;
                for (let i = 0, l = f.grid_rows.length, r; i < l; i++) {
                    r = f.grid_rows[i];
                    r.open_form_button.toggleClass('hidden', 1).children().toggleClass('hidden', 1);
                    r.row.off('click') && r.row_index.off('click') && r.open_form_button.off('click') && r.hide_form();
                }
            }
            f.wrapper && this._toggle_buttons(f, 0, !!fs, o && o.buttons);
        } catch(_) {}
    }
    toggle_table_buttons(frm, key, show, btns) {
        if (!(frm = this.get_form(frm))) return this;
        !this.$isArrVal(btns) && (btns = null);
        try {
            let f = frm.get_field(key);
            if (!f || !f.df || f.df.fieldtype !== 'Table' || !f.grid) return this;
            f.wrapper && this._toggle_buttons(f.grid, show, 0, btns);
        } catch(_) {}
        return this;
    }
    _toggle_buttons(g, s, m, o) {
        let d = {
            add: '.grid-add-row', multi_add: '.grid-add-multiple-rows',
            download: '.grid-download', upload: '.grid-upload',
        }, x, b;
        for (let k in d) {
            if (o && !o.includes(k)) continue;
            x = '__' + k;
            b = g.wrapper.find(d[k]);
            if (!b.length || b.hasClass('hidden') === (m && g[x] == s)) continue;
            s ? delete g[x] : (g[x] = 1);
            b.toggleClass('hidden', !s);
        }
    }
    _set_field_desc(f, m) {
        let c = 0;
        if (m && f.set_new_description) c++ && f.set_new_description(m);
        else if (f.set_description) {
            if (f.df && m) f.df.__description = f.df.description;
            if (f.df && !m) {
                m = f.df.__description;
                delete f.df.__description;
            }
            c++ && f.set_description(m);
        }
        c && f.toggle_description && f.toggle_description(f, !!m);
        return c;
    }
    set_field_desc(frm, key, cdn, ckey, msg) {
        if (!(frm = this.get_form(frm))) return this;
        if (msg == null && cstr(cdn).length && ckey == null) {
            msg = cdn;
            cdn = null;
        }
        try {
            let f = this._get_field(frm, key, cdn, ckey, 1);
            f && this._set_field_desc(f, msg);
        } catch(_) {}
        return this;
    }
    valid_field(frm, key, cdn, ckey) {
        if (!(frm = this.get_form(frm))) return this;
        try {
            let f = this._get_field(frm, key, cdn, ckey, 1);
            if (!f) return this;
            let c = 0;
            if (f.df && f.df.invalid) {
                f.df.invalid = 0;
                if (f.set_invalid) f.set_invalid();
                c++;
            }
            if (this._set_field_desc(f)) c++;
            c && this._reload_field(frm, key, cdn, ckey);
        } catch(_) {}
        return this;
    }
    invalid_field(frm, key, cdn, ckey, msg) {
        if (!(frm = this.get_form(frm))) return this;
        if (msg == null && cstr(cdn).length && ckey == null) {
            msg = cdn;
            cdn = null;
        }
        try {
            let f = this._get_field(frm, key, cdn, ckey, 1);
            if (!f) return this;
            let c = 0;
            if (f.df && !f.df.invalid) {
                f.df.invalid = 1;
                if (f.set_invalid) f.set_invalid();
                c++;
            }
            if (this.$isStrVal(msg) && this._set_field_desc(f, msg)) c++;
            c && this._reload_field(frm, key, cdn, ckey);
        } catch(_) {}
        return this;
    }
}


class ExpenseTable {
    constructor(n) {
        this._c = [];
        this._n = (n || 0) + 1;
        for (let x = 0; x < this._n; x++) this._c[x] = [];
    }
    get length() { return this._c[0].length; }
    col(i) { return this._c[i || 0]; }
    idx(v, i) { return this.col(i).indexOf(v); }
    has(v, i) { return (v = this.idx(v, i)) >= 0 && this.col(i)[v] != null; }
    add() {
        let a = arguments,
        i = this.idx(a[0]);
        if (i >= 0) for (let x = 1; x < this._n; x++) {
            (a[x] != null || this._c[x][i] == null) && (this._c[x][i] = a[x]);
        } else for (let x = 0; x < this._n; x++) { this._c[x].push(a[x]); }
        return this;
    }
    del(v, i) {
        if ((i = this.idx(v, i)) >= 0) for (let x = 0; x < this._n; x++) { this._c[x].splice(i, 1); }
        return this;
    }
    row(v, i) {
        if ((i = this.idx(v, i)) < 0) return null;
        let r = [];
        for (let x = 0; x < this._n; x++) r[x] = this._c[x][i];
        return r;
    }
    clear() {
        for (let x = 0; x < this._n; x++) this._c[x] && this._c[x]._clear();
        return this;
    }
}


frappe.provide('frappe.exp');


class Expenses extends LevelUp {
    constructor(opts) {
        super(__('Expenses'), 'exp', 'Expense', 'expenses.libs', 0);
        this.options(opts);
        this.$xdef({is_ready: false, is_enabled: false});
        this._is_settings ? this._init() : this.request(
            'is_enabled', null, this._init, function() { this.fatal(__('Status check failed.')); }
        );
    }
    get _is_settings() { return this.is_doctype('Expenses Settings'); }
    _init(ret) {
        this._is_ready = true;
        this._is_enabled = !!ret;
        !this._is_settings && this.xreal('app_status_changed', function(ret) {
            if (!this.$isDataObj(ret) || ret.is_enabled == null)
                this.fatal('Invalid status change event.');
            else {
                ret.is_enabled = !!ret.is_enabled;
                let changed = this._is_enabled !== ret.is_enabled;
                this._is_enabled = ret.is_enabled;
                changed && this.emit('changed');
            }
        });
        this.emit('ready');
    }
    focus(frm, k, n, ck) {
        if (!(frm = this.get_form(frm))) return this;
        let f = this._get_field(frm, k, n, ck, 1);
        if (f && f.$input) f.$input.focus();
        else if (!n && f && f.grid && f.grid.wrapper) f.grid.wrapper.focus();
        if (!f || !n) return this;
        let r = this._get_field(frm, k, n);
        if (r && r.row) {
            f = r.row.find('[data-fieldname="' + ck +'"]');
            if (f.length) f.first().focus();
            else r.row.find('input[type="Text"],textarea,select').filter(':visible:first').focus();
        }
        return this;
    }
    set_cache(key, val, timeout, period) {
        val = {___: val};
        if (cint(timeout) > 0 && this.$isStrVal(period))
            val.e = moment().add(timeout, period).format(frappe.defaultDatetimeFormat);
        try { sessionStorage.setItem(this._real + key, this.$toJson(val)); } catch(_) {}
        return this;
    }
    get_cache(key) {
        let val;
        try { val = this.$parseJson(sessionStorage.getItem(this._real + key)); } catch(_) { return;}
        if (val && val.___ != null) {
            if (val.e != null) {
                let t = moment(val.e, frappe.defaultDatetimeFormat);
                if (cint(t.diff(moment(), 'seconds')) > 0) return;
            }
            val = val.___;
        }
        return val;
    }
    pop_cache(key) {
        let val = this.get_cache(key);
        this.del_cache(key);
        return val;
    }
    del_cache(key) {
        try { sessionStorage.removeItem(this._real + key); } catch(_) {}
        return this;
    }
    table(cols) { return new ExpenseTable(cols); }
}


frappe.exp = function(opts) {
    if (!frappe.exp._init) frappe.exp._init = new Expenses(opts);
    else frappe.exp._init.options(opts);
    return frappe.exp._init;
};