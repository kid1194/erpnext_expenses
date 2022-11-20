/*
*  ERPNext Expenses © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


class UniqueArray {
    constructor(data) {
        this._d = E.is_arr(data) ? E.clone(data) : [];
        this._r = {};
    }
    get length() {
        return this._d.length;
    }
    index(v) {
        return this._d.indexOf(v);
    }
    has(v, r) {
        return (v != null && this.index(v) >= 0) || (r != null && this._r[r] != null);
    }
    push(v, r) {
        if (v != null && !this.has(v, r)) {
            this._d.push(v);
            if (r != null) this._r[r] = v;
        }
        return this;
    }
    rpush(v, r) {
        if (this.has(v, r)) this.del(v, r);
        return this.push(v, r);
    }
    del(v, r) {
        if (v != null) {
            if (r == null) {
                for (var k in this._r) {
                    if (this._r[k] === v) return this.del(v, k);
                }
            }
            let idx = this.index(v);
            if (idx >= 0) this._d.splice(idx, 1);
        }
        if (r != null) {
            if (v == null && this._r[r] != null) {
                return this.del(this._r[r], r);
            }
            delete this._r[r];
        }
        return this;
    }
    all() {
        return E.clone(this._d);
    }
    copy() {
        let list = new UniqueArray(this._d);
        list._r = E.clone(this._r);
        return list;
    }
    clear() {
        E.clear(this._d);
        E.clear(this._r);
        return this;
    }
}

if (window.E) {
    window.E.extend('unique_array', function(data) {
        return new UniqueArray(data);
    });
}