/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


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
        if (v != null && !this.has(v)) {
            this._d.push(v);
            this._r.push(r);
        }
        return this;
    }
    del(v) {
        if (v != null) {
            let idx = this._d.indexOf(v);
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
    all() {
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

if (window.E) {
    window.E.extend('uniqueArray', function() {
        return new UniqueArray();
    });
}