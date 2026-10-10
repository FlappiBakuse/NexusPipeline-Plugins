//#region ../../../../node_modules/@vue/shared/dist/shared.esm-bundler.js
// @__NO_SIDE_EFFECTS__
function e(e) {
	let t = /* @__PURE__ */ Object.create(null);
	for (let n of e.split(",")) t[n] = 1;
	return (e) => e in t;
}
var t = {}, n = [], r = () => {}, i = () => !1, a = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), o = (e) => e.startsWith("onUpdate:"), s = Object.assign, c = (e, t) => {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, T = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), ee = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, te = /-\w/g, E = ee((e) => e.replace(te, (e) => e.slice(1).toUpperCase())), ne = /\B([A-Z])/g, D = ee((e) => e.replace(ne, "-$1").toLowerCase()), re = ee((e) => e.charAt(0).toUpperCase() + e.slice(1)), ie = ee((e) => e ? `on${re(e)}` : ""), O = (e, t) => !Object.is(e, t), ae = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, k = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, oe = (e) => {
	let t = parseFloat(e);
	return isNaN(t) ? e : t;
}, se, ce = () => se ||= typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
function le(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = g(r) ? pe(r) : le(r);
			if (i) for (let e in i) t[e] = i[e];
		}
		return t;
	}
	if (g(e) || v(e)) return e;
}
var ue = /;(?![^(]*\))/g, de = /:([^]+)/, fe = /\/\*[^]*?\*\//g;
function pe(e) {
	let t = {};
	return e.replace(fe, "").split(ue).forEach((e) => {
		if (e) {
			let n = e.split(de);
			n.length > 1 && (t[n[0].trim()] = n[1].trim());
		}
	}), t;
}
function A(e) {
	let t = "";
	if (g(e)) t = e;
	else if (d(e)) for (let n = 0; n < e.length; n++) {
		let r = A(e[n]);
		r && (t += r + " ");
	}
	else if (v(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
var me = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", he = /* @__PURE__ */ e(me);
me + "";
function ge(e) {
	return !!e || e === "";
}
function _e(e, t) {
	if (e.length !== t.length) return !1;
	let n = !0;
	for (let r = 0; n && r < e.length; r++) n = ye(e[r], t[r]);
	return n;
}
function ve(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && ye(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function ye(e, t) {
	if (e === t) return !0;
	let n = m(e), r = m(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = _(e), r = _(t), n || r) return e === t;
	if (n = d(e), r = d(t), n || r) return n && r ? _e(e, t) : !1;
	if (n = v(e), r = v(t), n || r) {
		if (!n || !r) return !1;
		if (n = f(e), r = f(t), n || r || (n = p(e), r = p(t), n || r)) return n && r ? ve(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !ye(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
function be(e, t) {
	return e.findIndex((e) => ye(e, t));
}
var xe = (e) => !!(e && e.__v_isRef === !0), j = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? xe(e) ? j(e.value) : JSON.stringify(e, Se, 2) : String(e), Se = (e, t) => xe(t) ? Se(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[Ce(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => Ce(e)) } : _(t) ? Ce(t) : v(t) && !d(t) && !C(t) ? String(t) : t, Ce = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e, M, we = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !e && M && (M.active ? (this.parent = M, this.index = (M.scopes || (M.scopes = [])).push(this) - 1) : (this._active = !1, this._warnOnRun = !1));
	}
	get active() {
		return this._active;
	}
	pause() {
		if (this._active) {
			this._isPaused = !0;
			let e, t;
			if (this.scopes) {
				let n = this.scopes.slice();
				for (e = 0, t = n.length; e < t; e++) n[e].pause();
			}
			for (e = 0, t = this.effects.length; e < t; e++) this.effects[e].pause();
		}
	}
	resume() {
		if (this._active && this._isPaused) {
			this._isPaused = !1;
			let e, t;
			if (this.scopes) {
				let n = this.scopes.slice();
				for (e = 0, t = n.length; e < t; e++) n[e].resume();
			}
			let n = this.effects.slice();
			for (e = 0, t = n.length; e < t; e++) n[e].resume();
		}
	}
	run(e) {
		if (this._active) {
			let t = M;
			try {
				return M = this, e();
			} finally {
				M = t;
			}
		}
	}
	on() {
		++this._on === 1 && (this.prevScope = M, M = this);
	}
	off() {
		if (this._on > 0 && --this._on === 0) {
			if (M === this) M = this.prevScope;
			else {
				let e = M;
				for (; e;) {
					if (e.prevScope === this) {
						e.prevScope = this.prevScope;
						break;
					}
					e = e.prevScope;
				}
			}
			this.prevScope = void 0;
		}
	}
	stop(e) {
		if (this._active) {
			this._active = !1;
			let t, n;
			for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].stop();
			for (this.effects.length = 0, t = 0, n = this.cleanups.length; t < n; t++) this.cleanups[t]();
			if (this.cleanups.length = 0, this.scopes) {
				let e = this.scopes.slice();
				for (t = 0, n = e.length; t < n; t++) e[t].stop(!0);
				this.scopes.length = 0;
			}
			if (!this.detached && this.parent && !e) {
				let e = this.parent.scopes.pop();
				e && e !== this && (this.parent.scopes[this.index] = e, e.index = this.index);
			}
			this.parent = void 0;
		}
	}
};
function Te() {
	return M;
}
var N, Ee = /* @__PURE__ */ new WeakSet(), De = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, M && (M.active ? M.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, Ee.has(this) && (Ee.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || je(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, We(this), Pe(this);
		let e = N, t = Be;
		N = this, Be = !0;
		try {
			return this.fn();
		} finally {
			Fe(this), N = e, Be = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Re(e);
			this.deps = this.depsTail = void 0, We(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? Ee.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		Ie(this) && this.run();
	}
	get dirty() {
		return Ie(this);
	}
}, Oe = 0, ke, Ae;
function je(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = Ae, Ae = e;
		return;
	}
	e.next = ke, ke = e;
}
function Me() {
	Oe++;
}
function Ne() {
	if (--Oe > 0) return;
	if (Ae) {
		let e = Ae;
		for (Ae = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; ke;) {
		let t = ke;
		for (ke = void 0; t;) {
			let n = t.next;
			if (t.next = void 0, t.flags &= -9, t.flags & 1) try {
				t.trigger();
			} catch (t) {
				e ||= t;
			}
			t = n;
		}
	}
	if (e) throw e;
}
function Pe(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Fe(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), Re(r), ze(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function Ie(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (Le(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function Le(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ge) || (e.globalVersion = Ge, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Ie(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = N, r = Be;
	N = e, Be = !0;
	try {
		Pe(e);
		let n = e.fn(e._value);
		(t.version === 0 || O(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		N = n, Be = r, Fe(e), e.flags &= -3;
	}
}
function Re(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) Re(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function ze(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var Be = !0, Ve = [];
function He() {
	Ve.push(Be), Be = !1;
}
function Ue() {
	let e = Ve.pop();
	Be = e === void 0 || e;
}
function We(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = N;
		N = void 0;
		try {
			t();
		} finally {
			N = e;
		}
	}
}
var Ge = 0, Ke = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, qe = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!N || !Be || N === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== N) t = this.activeLink = new Ke(N, this), N.deps ? (t.prevDep = N.depsTail, N.depsTail.nextDep = t, N.depsTail = t) : N.deps = N.depsTail = t, Je(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = N.depsTail, t.nextDep = void 0, N.depsTail.nextDep = t, N.depsTail = t, N.deps === t && (N.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, Ge++, this.notify(e);
	}
	notify(e) {
		Me();
		try {
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			Ne();
		}
	}
};
function Je(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) Je(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var Ye = /* @__PURE__ */ new WeakMap(), Xe = /* @__PURE__ */ Symbol(""), Ze = /* @__PURE__ */ Symbol(""), Qe = /* @__PURE__ */ Symbol("");
function P(e, t, n) {
	if (Be && N) {
		let t = Ye.get(e);
		t || Ye.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new qe()), r.map = t, r.key = n), r.track();
	}
}
function $e(e, t, n, r, i, a) {
	let o = Ye.get(e);
	if (!o) {
		Ge++;
		return;
	}
	let s = (e) => {
		e && e.trigger();
	};
	if (Me(), t === "clear") o.forEach(s);
	else {
		let i = d(e), a = i && w(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === Qe || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(Qe)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(Xe)), f(e) && s(o.get(Ze)));
				break;
			case "delete":
				i || (s(o.get(Xe)), f(e) && s(o.get(Ze)));
				break;
			case "set": f(e) && s(o.get(Xe));
		}
	}
	Ne();
}
function et(e) {
	let t = /* @__PURE__ */ I(e);
	return t === e ? t : (P(t, "iterate", Qe), /* @__PURE__ */ F(e) ? t : t.map(Vt));
}
function tt(e) {
	return P(e = /* @__PURE__ */ I(e), "iterate", Qe), e;
}
function nt(e, t) {
	return /* @__PURE__ */ Rt(e) ? Ht(/* @__PURE__ */ Lt(e) ? Vt(t) : t) : Vt(t);
}
var rt = {
	__proto__: null,
	[Symbol.iterator]() {
		return it(this, Symbol.iterator, (e) => nt(this, e));
	},
	concat(...e) {
		return et(this).concat(...e.map((e) => d(e) ? et(e) : e));
	},
	entries() {
		return it(this, "entries", (e) => (e[1] = nt(this, e[1]), e));
	},
	every(e, t) {
		return ot(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return ot(this, "filter", e, t, (e) => e.map((e) => nt(this, e)), arguments);
	},
	find(e, t) {
		return ot(this, "find", e, t, (e) => nt(this, e), arguments);
	},
	findIndex(e, t) {
		return ot(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return ot(this, "findLast", e, t, (e) => nt(this, e), arguments);
	},
	findLastIndex(e, t) {
		return ot(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return ot(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return ct(this, "includes", e);
	},
	indexOf(...e) {
		return ct(this, "indexOf", e);
	},
	join(e) {
		return et(this).join(e);
	},
	lastIndexOf(...e) {
		return ct(this, "lastIndexOf", e);
	},
	map(e, t) {
		return ot(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return lt(this, "pop");
	},
	push(...e) {
		return lt(this, "push", e);
	},
	reduce(e, ...t) {
		return st(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return st(this, "reduceRight", e, t);
	},
	shift() {
		return lt(this, "shift");
	},
	some(e, t) {
		return ot(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return lt(this, "splice", e);
	},
	toReversed() {
		return et(this).toReversed();
	},
	toSorted(e) {
		return et(this).toSorted(e);
	},
	toSpliced(...e) {
		return et(this).toSpliced(...e);
	},
	unshift(...e) {
		return lt(this, "unshift", e);
	},
	values() {
		return it(this, "values", (e) => nt(this, e));
	}
};
function it(e, t, n) {
	let r = tt(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ F(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var at = Array.prototype;
function ot(e, t, n, r, i, a) {
	let o = tt(e), s = o !== e && !/* @__PURE__ */ F(e), c = o[t];
	if (c !== at[t]) {
		let t = c.apply(e, a);
		return s ? Vt(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, nt(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function st(e, t, n, r) {
	let i = tt(e), a = i !== e && !/* @__PURE__ */ F(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = nt(e, t)), n.call(this, t, nt(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? nt(e, c) : c;
}
function ct(e, t, n) {
	let r = /* @__PURE__ */ I(e);
	P(r, "iterate", Qe);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ zt(n[0]) ? (n[0] = /* @__PURE__ */ I(n[0]), r[t](...n)) : i;
}
function lt(e, t, n = []) {
	He(), Me();
	let r = (/* @__PURE__ */ I(e))[t].apply(e, n);
	return Ne(), Ue(), r;
}
var ut = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), dt = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function ft(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ I(this);
	return P(t, "has", e), t.hasOwnProperty(e);
}
var pt = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? jt : At : i ? kt : Ot).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = rt[t])) return e;
			if (t === "hasOwnProperty") return ft;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ L(e) ? e : n);
		if ((_(t) ? dt.has(t) : ut(t)) || (r || P(e, "get", t), i)) return o;
		if (/* @__PURE__ */ L(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ Ft(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ Ft(o) : /* @__PURE__ */ Nt(o) : o;
	}
}, mt = class extends pt {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ Rt(i);
			if (!/* @__PURE__ */ F(n) && !/* @__PURE__ */ Rt(n) && (i = /* @__PURE__ */ I(i), n = /* @__PURE__ */ I(n)), !a && /* @__PURE__ */ L(i) && !/* @__PURE__ */ L(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ L(e) ? e : r);
		return e === /* @__PURE__ */ I(r) && s && (o ? O(n, i) && $e(e, "set", t, n, i) : $e(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && $e(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !dt.has(t)) && P(e, "has", t), n;
	}
	ownKeys(e) {
		return P(e, "iterate", d(e) ? "length" : Xe), Reflect.ownKeys(e);
	}
}, ht = class extends pt {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, gt = /* @__PURE__ */ new mt(), _t = /* @__PURE__ */ new ht(), vt = /* @__PURE__ */ new mt(!0), yt = (e) => e, bt = (e) => Reflect.getPrototypeOf(e);
function xt(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ I(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? yt : t ? Ht : Vt;
		return !t && P(a, "iterate", l ? Ze : Xe), s(Object.create(u), { next() {
			let { value: e, done: t } = u.next();
			return t ? {
				value: e,
				done: t
			} : {
				value: c ? [d(e[0]), d(e[1])] : d(e),
				done: t
			};
		} });
	};
}
function St(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function Ct(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ I(r), a = /* @__PURE__ */ I(n);
			e || (O(n, a) && P(i, "get", n), P(i, "get", a));
			let { has: o } = bt(i), s = t ? yt : e ? Ht : Vt;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && P(/* @__PURE__ */ I(t), "iterate", Xe), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ I(n), i = /* @__PURE__ */ I(t);
			return e || (O(t, i) && P(r, "has", t), P(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ I(a), s = t ? yt : e ? Ht : Vt;
			return !e && P(o, "iterate", Xe), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: St("add"),
		set: St("set"),
		delete: St("delete"),
		clear: St("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ I(this), r = bt(n), i = /* @__PURE__ */ I(e), a = !t && !/* @__PURE__ */ F(e) && !/* @__PURE__ */ Rt(e) ? i : e;
			return r.has.call(n, a) || O(e, a) && r.has.call(n, e) || O(i, a) && r.has.call(n, i) || (n.add(a), $e(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ F(n) && !/* @__PURE__ */ Rt(n) && (n = /* @__PURE__ */ I(n));
			let r = /* @__PURE__ */ I(this), { has: i, get: a } = bt(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ I(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? O(n, s) && $e(r, "set", e, n, s) : $e(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ I(this), { has: n, get: r } = bt(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ I(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && $e(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ I(this), t = e.size !== 0, n = e.clear();
			return t && $e(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = xt(r, e, t);
	}), n;
}
function wt(e, t) {
	let n = Ct(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var Tt = { get: /* @__PURE__ */ wt(!1, !1) }, Et = { get: /* @__PURE__ */ wt(!1, !0) }, Dt = { get: /* @__PURE__ */ wt(!0, !1) }, Ot = /* @__PURE__ */ new WeakMap(), kt = /* @__PURE__ */ new WeakMap(), At = /* @__PURE__ */ new WeakMap(), jt = /* @__PURE__ */ new WeakMap();
function Mt(e) {
	switch (e) {
		case "Object":
		case "Array": return 1;
		case "Map":
		case "Set":
		case "WeakMap":
		case "WeakSet": return 2;
		default: return 0;
	}
}
// @__NO_SIDE_EFFECTS__
function Nt(e) {
	return /* @__PURE__ */ Rt(e) ? e : It(e, !1, gt, Tt, Ot);
}
// @__NO_SIDE_EFFECTS__
function Pt(e) {
	return It(e, !1, vt, Et, kt);
}
// @__NO_SIDE_EFFECTS__
function Ft(e) {
	return It(e, !0, _t, Dt, At);
}
function It(e, t, n, r, i) {
	if (!v(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = Mt(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function Lt(e) {
	return /* @__PURE__ */ Rt(e) ? /* @__PURE__ */ Lt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Rt(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function F(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function zt(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function I(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ I(t) : e;
}
function Bt(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && k(e, "__v_skip", !0), e;
}
var Vt = (e) => v(e) ? /* @__PURE__ */ Nt(e) : e, Ht = (e) => v(e) ? /* @__PURE__ */ Ft(e) : e;
// @__NO_SIDE_EFFECTS__
function L(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function R(e) {
	return Wt(e, !1);
}
// @__NO_SIDE_EFFECTS__
function Ut(e) {
	return Wt(e, !0);
}
function Wt(e, t) {
	return /* @__PURE__ */ L(e) ? e : new Gt(e, t);
}
var Gt = class {
	constructor(e, t) {
		this.dep = new qe(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ I(e), this._value = t ? e : Vt(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ F(e) || /* @__PURE__ */ Rt(e);
		e = n ? e : /* @__PURE__ */ I(e), O(e, t) && (this._rawValue = e, this._value = n ? e : Vt(e), this.dep.trigger());
	}
};
function z(e) {
	return /* @__PURE__ */ L(e) ? e.value : e;
}
var Kt = {
	get: (e, t, n) => t === "__v_raw" ? e : z(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ L(i) && !/* @__PURE__ */ L(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function qt(e) {
	return /* @__PURE__ */ Lt(e) ? e : new Proxy(e, Kt);
}
var Jt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new qe(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ge - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && N !== this) return je(this, !0), !0;
	}
	get value() {
		let e = this.dep.track();
		return Le(this), e && (e.version = this.dep.version), this._value;
	}
	set value(e) {
		this.setter && this.setter(e);
	}
};
// @__NO_SIDE_EFFECTS__
function Yt(e, t, n = !1) {
	let r, i;
	return h(e) ? r = e : (r = e.get, i = e.set), new Jt(r, i, n);
}
var Xt = {}, Zt = /* @__PURE__ */ new WeakMap(), Qt = void 0;
function $t(e, t = !1, n = Qt) {
	if (n) {
		let t = Zt.get(n);
		t || Zt.set(n, t = []), t.push(e);
	}
}
function en(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ F(e) || o === !1 || o === 0 ? tn(e, 1) : tn(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ L(e) ? (g = () => e.value, y = /* @__PURE__ */ F(e)) : /* @__PURE__ */ Lt(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Lt(e) || /* @__PURE__ */ F(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ L(e)) return e.value;
		if (/* @__PURE__ */ Lt(e)) return p(e);
		if (h(e)) return f ? f(e, 2) : e();
	})) : g = h(e) ? n ? f ? () => f(e, 2) : e : () => {
		if (_) {
			He();
			try {
				_();
			} finally {
				Ue();
			}
		}
		let t = Qt;
		Qt = m;
		try {
			return f ? f(e, 3, [v]) : e(v);
		} finally {
			Qt = t;
		}
	} : r, n && o) {
		let e = g, t = o === !0 ? Infinity : o;
		g = () => tn(e(), t);
	}
	let x = Te(), S = () => {
		m.stop(), x && x.active && c(x.effects, m);
	};
	if (s && n) {
		let e = n;
		n = (...t) => {
			let n = e(...t);
			return S(), n;
		};
	}
	let C = b ? Array(e.length).fill(Xt) : Xt, w = (e) => {
		if (m.flags & 1 && (m.dirty || e)) {
			if (n) {
				let t = m.run();
				if (e || o || y || (b ? t.some((e, t) => O(e, C[t])) : O(t, C))) {
					_ && _();
					let e = Qt;
					Qt = m;
					try {
						let e = [
							t,
							C === Xt ? void 0 : b && C[0] === Xt ? [] : C,
							v
						];
						C = t, f ? f(n, 3, e) : n(...e);
					} finally {
						Qt = e;
					}
				}
			} else m.run();
		}
	};
	return u && u(w), m = new De(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => $t(e, !1, m), _ = m.onStop = () => {
		let e = Zt.get(m);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			Zt.delete(m);
		}
	}, n ? a ? w(!0) : C = m.run() : l ? l(w.bind(null, !0), !0) : m.run(), S.pause = m.pause.bind(m), S.resume = m.resume.bind(m), S.stop = S, S;
}
function tn(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ L(e)) tn(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) tn(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		tn(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) tn(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && tn(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
function nn(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		an(e, t, n);
	}
}
function rn(e, t, n, r) {
	if (h(e)) {
		let i = nn(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			an(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(rn(e[a], t, n, r));
		return i;
	}
}
function an(e, n, r, i = !0) {
	let a = n ? n.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: s } = n && n.appContext.config || t;
	if (n) {
		let t = n.parent, i = n.proxy, a = `https://vuejs.org/error-reference/#runtime-${r}`;
		for (; t;) {
			let n = t.ec;
			if (n) {
				for (let t = 0; t < n.length; t++) if (n[t](e, i, a) === !1) return;
			}
			t = t.parent;
		}
		if (o) {
			He(), nn(o, null, 10, [
				e,
				i,
				a
			]), Ue();
			return;
		}
	}
	on(e, r, a, i, s);
}
function on(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var B = [], sn = -1, cn = [], ln = null, un = 0, dn = /* @__PURE__ */ Promise.resolve(), fn = null;
function pn(e) {
	let t = fn || dn;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function mn(e) {
	let t = sn + 1, n = B.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = B[r], a = bn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function hn(e) {
	if (!(e.flags & 1)) {
		let t = bn(e), n = B[B.length - 1];
		!n || !(e.flags & 2) && t >= bn(n) ? B.push(e) : B.splice(mn(t), 0, e), e.flags |= 1, gn();
	}
}
function gn() {
	fn ||= dn.then(xn);
}
function _n(e) {
	if (!d(e)) ln && e.id === -1 ? ln.splice(un + 1, 0, e) : e.flags & 1 || (cn.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) cn.push(e[t]);
	gn();
}
function vn(e, t, n = sn + 1) {
	for (; n < B.length; n++) {
		let t = B[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			B.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
		}
	}
}
function yn(e) {
	if (cn.length) {
		let e = [...new Set(cn)].sort((e, t) => bn(e) - bn(t));
		if (cn.length = 0, ln) {
			for (let t = 0; t < e.length; t++) ln.push(e[t]);
			return;
		}
		for (ln = e, un = 0; un < ln.length; un++) {
			let e = ln[un];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		ln = null, un = 0;
	}
}
var bn = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function xn(e) {
	try {
		for (sn = 0; sn < B.length; sn++) {
			let e = B[sn];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), nn(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; sn < B.length; sn++) {
			let e = B[sn];
			e && (e.flags &= -2);
		}
		sn = -1, B.length = 0, yn(e), fn = null, (B.length || cn.length) && xn(e);
	}
}
var V = null, Sn = null;
function Cn(e) {
	let t = V;
	return V = e, Sn = e && e.type.__scopeId || null, t;
}
function wn(e, t = V, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && ji(-1);
		let i = Cn(t), a = Oi.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = Oi.length; e > a; e--) ki();
			Cn(i), r._d && ji(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function Tn(e, n) {
	if (V === null) return e;
	let r = la(V), i = e.dirs ||= [];
	for (let e = 0; e < n.length; e++) {
		let [a, o, s, c = t] = n[e];
		a && (h(a) && (a = {
			mounted: a,
			updated: a
		}), a.deep && tn(o), i.push({
			dir: a,
			instance: r,
			value: o,
			oldValue: void 0,
			arg: s,
			modifiers: c
		}));
	}
	return e;
}
function En(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (He(), rn(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Ue());
	}
}
function Dn(e, t) {
	if (Q) {
		let n = Q.provides, r = Q.parent && Q.parent.provides;
		r === n && (n = Q.provides = Object.create(r)), n[e] = t;
	}
}
function On(e, t, n = !1) {
	let r = Xi();
	if (r || Ir) {
		let i = Ir ? Ir._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var kn = /* @__PURE__ */ Symbol.for("v-scx"), An = () => On(kn);
function jn(e, t, n) {
	return Mn(e, t, n);
}
function Mn(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (na) {
		if (c === "sync") {
			let e = An();
			f = e.__watcherHandles ||= [];
		} else if (!d) {
			let e = () => {};
			return e.stop = r, e.resume = r, e.pause = r, e;
		}
	}
	let p = Q;
	u.call = (e, t, n) => rn(e, p, t, n);
	let m = !1;
	c === "post" ? u.scheduler = (e) => {
		W(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : hn(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = en(e, n, u);
	return na && (f ? f.push(h) : d && h()), h;
}
function Nn(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? Pn(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = $i(this), s = Mn(i, a.bind(r), n);
	return o(), s;
}
function Pn(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var Fn = /* @__PURE__ */ Symbol("_vte"), In = (e) => e.__isTeleport, Ln = /* @__PURE__ */ Symbol("_leaveCb");
function Rn(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== Ei) {
			t = n;
			break;
		}
	}
	return t;
}
function zn(e) {
	if (!Jn(e)) return In(e.type) && e.children ? Rn(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Bn(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Bn(In(n.type) && zn(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Vn(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Hn(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function Un(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Wn = /* @__PURE__ */ new WeakMap();
function Gn(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Gn(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (qn(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Gn(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? la(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ I(v), b = v === t ? i : (e) => !Un(_, e) && u(y, e), x = (e, t) => !(t && Un(_, t));
	if (m != null && m !== p) {
		if (Kn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ L(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) nn(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ L(p);
		if (t || n) {
			let i = () => {
				if (e.f) {
					let n = t ? b(p) ? v[p] : _[p] : x(p) || !e.k ? p.value : _[e.k];
					if (o) d(n) && c(n, s);
					else if (d(n)) n.includes(s) || n.push(s);
					else if (t) _[p] = [s], b(p) && (v[p] = _[p]);
					else {
						let t = [s];
						x(p, e.k) && (p.value = t), e.k && (_[e.k] = t);
					}
				} else t ? (_[p] = l, b(p) && (v[p] = l)) : n && (x(p, e.k) && (p.value = l), e.k && (_[e.k] = l));
			};
			if (l) {
				let t = () => {
					i(), Wn.delete(e);
				};
				t.id = -1, Wn.set(e, t), W(t, r);
			} else Kn(e), i();
		}
	}
}
function Kn(e) {
	let t = Wn.get(e);
	t && (t.flags |= 8, Wn.delete(e));
}
ce().requestIdleCallback, ce().cancelIdleCallback;
var qn = (e) => !!e.type.__asyncLoader, Jn = (e) => e.type.__isKeepAlive;
function Yn(e, t) {
	Zn(e, "a", t);
}
function Xn(e, t) {
	Zn(e, "da", t);
}
function Zn(e, t, n = Q) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if ($n(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Jn(e.parent.vnode) && Qn(r, t, n, e), e = e.parent;
	}
}
function Qn(e, t, n, r) {
	let i = $n(t, e, r, !0);
	or(() => {
		c(r[t], i);
	}, n);
}
function $n(e, t, n = Q, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			He();
			let i = $i(n), a = rn(t, n, e, r);
			return i(), Ue(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var er = (e) => (t, n = Q) => {
	(!na || e === "sp") && $n(e, (...e) => t(...e), n);
}, tr = er("bm"), nr = er("m"), rr = er("bu"), ir = er("u"), ar = er("bum"), or = er("um"), sr = er("sp"), cr = er("rtg"), lr = er("rtc");
function ur(e, t = Q) {
	$n("ec", e, t);
}
var dr = /* @__PURE__ */ Symbol.for("v-ndc");
function H(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ Lt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ F(e), s = /* @__PURE__ */ Rt(e), e = tt(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Ht(Vt(e[n])) : Vt(e[n]) : e[n], n, void 0, a && a[n]);
	} else if (typeof e == "number") {
		i = Array(e);
		for (let n = 0; n < e; n++) i[n] = t(n + 1, n, void 0, a && a[n]);
	} else if (v(e)) {
		if (e[Symbol.iterator]) i = Array.from(e, (e, n) => t(e, n, void 0, a && a[n]));
		else {
			let n = Object.keys(e);
			i = Array(n.length);
			for (let r = 0, o = n.length; r < o; r++) {
				let o = n[r];
				i[r] = t(e[o], o, r, a && a[r]);
			}
		}
	} else i = [];
	return n && (n[r] = i), i;
}
function fr(e, t, n, r, i, a) {
	if (n ??= {}, V.ce || V.parent && qn(V.parent) && V.parent.ce) {
		let e = a != null && n.key == null ? s({}, n, { key: a }) : n, i = Object.keys(e).length > 0;
		return t !== "default" && (e.name = t), q(), Ni(G, null, [X("slot", e, r && r())], i ? -2 : 64);
	}
	let o = e[t];
	o && o._c && (o._d = !1);
	let c = Oi.length;
	q();
	let l;
	try {
		let i = o && pr(o(n)), s = n.key || a || i && i.key;
		l = Ni(G, { key: (s && !_(s) ? s : `_${t}`) + (!i && r ? "_fb" : "") }, i || (r ? r() : []), i && e._ === 1 ? 64 : -2);
	} catch (e) {
		for (let e = Oi.length; e > c; e--) ki();
		throw e;
	} finally {
		o && o._c && (o._d = !0);
	}
	return !i && l.scopeId && (l.slotScopeIds = [l.scopeId + "-s"]), l;
}
function pr(e) {
	return e.some((e) => !Pi(e) || !(e.type === Ei || e.type === G && !pr(e.children))) ? e : null;
}
var mr = (e) => e ? ta(e) ? la(e) : mr(e.parent) : null, hr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => mr(e.parent),
	$root: (e) => mr(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => wr(e),
	$forceUpdate: (e) => e.f ||= () => {
		hn(e.update);
	},
	$nextTick: (e) => e.n ||= pn.bind(e.proxy),
	$watch: (e) => Nn.bind(e)
}), gr = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), _r = {
	get({ _: e }, n) {
		if (n === "__v_skip") return !0;
		let { ctx: r, setupState: i, data: a, props: o, accessCache: s, type: c, appContext: l } = e;
		if (n[0] !== "$") {
			let e = s[n];
			if (e !== void 0) switch (e) {
				case 1: return i[n];
				case 2: return a[n];
				case 4: return r[n];
				case 3: return o[n];
			}
			else if (gr(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else yr && (s[n] = 0);
		}
		let d = hr[n], f, p;
		if (d) return n === "$attrs" && P(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return gr(a, n) ? (a[n] = r, !0) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) || n[0] === "$" && n.slice(1) in e ? !1 : (o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || gr(n, c) || u(o, c) || u(i, c) || u(hr, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function vr(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var yr = !0;
function br(e) {
	let t = wr(e), n = e.proxy, i = e.ctx;
	yr = !1, t.beforeCreate && Sr(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: T, renderTracked: ee, renderTriggered: te, errorCaptured: E, serverPrefetch: ne, expose: D, inheritAttrs: re, components: ie, directives: O, filters: ae } = t;
	if (u && xr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ Nt(t));
	}
	if (yr = !0, o) for (let e in o) {
		let t = o[e], a = $({
			get: h(t) ? t.bind(n, n) : h(t.get) ? t.get.bind(n, n) : r,
			set: !h(t) && h(t.set) ? t.set.bind(n) : r
		});
		Object.defineProperty(i, e, {
			enumerable: !0,
			configurable: !0,
			get: () => a.value,
			set: (e) => a.value = e
		});
	}
	if (c) for (let e in c) Cr(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			Dn(t, e[t]);
		});
	}
	f && Sr(f, e, "c");
	function k(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (k(tr, p), k(nr, m), k(rr, g), k(ir, _), k(Yn, y), k(Xn, b), k(ur, E), k(lr, ee), k(cr, te), k(ar, S), k(or, w), k(sr, ne), d(D)) {
		if (D.length) {
			let t = e.exposed ||= {};
			D.forEach((e) => {
				Object.defineProperty(t, e, {
					get: () => n[e],
					set: (t) => n[e] = t,
					enumerable: !0
				});
			});
		} else e.exposed ||= {};
	}
	T && e.render === r && (e.render = T), re != null && (e.inheritAttrs = re), ie && (e.components = ie), O && (e.directives = O), ne && Hn(e);
}
function xr(e, t, n = r) {
	d(e) && (e = kr(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? On(r.from || n, r.default, !0) : On(r.from || n) : On(r), /* @__PURE__ */ L(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function Sr(e, t, n) {
	rn(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function Cr(e, t, n, r) {
	let i = r.includes(".") ? Pn(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) && jn(i, n);
	} else if (h(e)) jn(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => Cr(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) && jn(i, r, e);
		}
	}
}
function wr(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => Tr(c, e, o, !0)), Tr(c, t, o)), v(t) && a.set(t, c), c;
}
function Tr(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && Tr(e, a, n, !0), i && i.forEach((t) => Tr(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = Er[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var Er = {
	data: Dr,
	props: jr,
	emits: jr,
	methods: Ar,
	computed: Ar,
	beforeCreate: U,
	created: U,
	beforeMount: U,
	mounted: U,
	beforeUpdate: U,
	updated: U,
	beforeDestroy: U,
	beforeUnmount: U,
	destroyed: U,
	unmounted: U,
	activated: U,
	deactivated: U,
	errorCaptured: U,
	serverPrefetch: U,
	components: Ar,
	directives: Ar,
	watch: Mr,
	provide: Dr,
	inject: Or
};
function Dr(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function Or(e, t) {
	return Ar(kr(e), kr(t));
}
function kr(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function U(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function Ar(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function jr(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), vr(e), vr(t ?? {})) : t;
}
function Mr(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = U(e[r], t[r]);
	return n;
}
function Nr() {
	return {
		app: null,
		config: {
			isNativeTag: i,
			performance: !1,
			globalProperties: {},
			optionMergeStrategies: {},
			errorHandler: void 0,
			warnHandler: void 0,
			compilerOptions: {}
		},
		mixins: [],
		components: {},
		directives: {},
		provides: /* @__PURE__ */ Object.create(null),
		optionsCache: /* @__PURE__ */ new WeakMap(),
		propsCache: /* @__PURE__ */ new WeakMap(),
		emitsCache: /* @__PURE__ */ new WeakMap()
	};
}
var Pr = 0;
function Fr(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = Nr(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: Pr++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: da,
			get config() {
				return i.config;
			},
			set config(e) {},
			use(e, ...t) {
				return a.has(e) || (e && h(e.install) ? (a.add(e), e.install(l, ...t)) : h(e) && (a.add(e), e(l, ...t))), l;
			},
			mixin(e) {
				return i.mixins.includes(e) || i.mixins.push(e), l;
			},
			component(e, t) {
				return t ? (i.components[e] = t, l) : i.components[e];
			},
			directive(e, t) {
				return t ? (i.directives[e] = t, l) : i.directives[e];
			},
			mount(a, o, s) {
				if (!c) {
					let u = l._ceVNode || X(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, la(u.component);
				}
			},
			onUnmount(e) {
				o.push(e);
			},
			unmount() {
				c && (rn(o, l._instance, 16), e(null, l._container), delete l._container.__vue_app__);
			},
			provide(e, t) {
				return i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = Ir;
				Ir = l;
				try {
					return e();
				} finally {
					Ir = t;
				}
			}
		};
		return l;
	};
}
var Ir = null, Lr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${E(t)}Modifiers`] || e[`${D(t)}Modifiers`];
function Rr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && Lr(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(oe)));
	let c, l = i[c = ie(n)] || i[c = ie(E(n))];
	!l && o && (l = i[c = ie(D(n))]), l && rn(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, rn(u, e, 6, a);
	}
}
var zr = /* @__PURE__ */ new WeakMap();
function Br(e, t, n = !1) {
	let r = n ? zr : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Br(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Vr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, D(t)) || u(e, t));
}
function Hr(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = Cn(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = Hi(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = Hi(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Ur(c);
		}
	} catch (t) {
		Oi.length = 0, an(t, e, 1), v = X(Ei);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Wr(y, a)), b = Bi(b, y, !1, !0));
	}
	return n.dirs && (b = Bi(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Bn(In(b.type) && zn(b) || b, n.transition), v = b, Cn(_), v;
}
var Ur = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Wr = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function Gr(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Kr(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (qr(o, r, n) && !Vr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Kr(r, o, l) : !!o;
	return !1;
}
function Kr(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (qr(t, e, a) && !Vr(n, a)) return !0;
	}
	return !1;
}
function qr(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !ye(r, i) : r !== i;
}
function Jr({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Yr = {}, Xr = () => Object.create(Yr), Zr = (e) => Object.getPrototypeOf(e) === Yr;
function Qr(e, t, n, r = !1) {
	let i = {}, a = Xr();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), ei(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ Pt(i) : e.type.props ? i : a, e.attrs = a;
}
function $r(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ I(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Vr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = E(o);
						i[t] = ti(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		ei(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = D(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = ti(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && $e(e.attrs, "set", "");
}
function ei(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (T(t)) continue;
		let l = n[t], d;
		a && u(a, d = E(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Vr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ I(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = ti(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function ti(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = $i(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === D(n)) && (r = !0));
	}
	return r;
}
var ni = /* @__PURE__ */ new WeakMap();
function ri(e, r, i = !1) {
	let a = i ? ni : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = ri(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = E(c[e]);
		ii(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = E(e);
		if (ii(t)) {
			let n = c[e], r = l[t] = d(n) || h(n) ? { type: n } : s({}, n), i = r.type, a = !1, o = !0;
			if (d(i)) for (let e = 0; e < i.length; ++e) {
				let t = i[e], n = h(t) && t.name;
				if (n === "Boolean") {
					a = !0;
					break;
				}
				n === "String" && (o = !1);
			}
			else a = h(i) && i.name === "Boolean";
			r[0] = a, r[1] = o, (a || u(r, "default")) && f.push(t);
		}
	}
	let m = [l, f];
	return v(e) && a.set(e, m), m;
}
function ii(e) {
	return e[0] !== "$" && !T(e);
}
var ai = (e) => e === "_" || e === "_ctx" || e === "$stable", oi = (e) => d(e) ? e.map(Hi) : [Hi(e)], si = (e, t, n) => {
	if (t._n) return t;
	let r = wn((...e) => oi(t(...e)), n);
	return r._c = !1, r;
}, ci = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (ai(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = si(n, i, r);
		else if (i != null) {
			let e = oi(i);
			t[n] = () => e;
		}
	}
}, li = (e, t) => {
	let n = oi(t);
	e.slots.default = () => n;
}, ui = (e, t, n) => {
	for (let r in t) (n || !ai(r)) && (e[r] = t[r]);
}, di = (e, t, n) => {
	let r = e.slots = Xr();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (ui(r, t, n), n && k(r, "_", e, !0)) : ci(t, r);
	} else t && li(e, t);
}, fi = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : ui(a, n, r) : (o = !n.$stable, ci(n, a)), s = n;
	} else n && (li(e, n), s = { default: 1 });
	if (o) for (let e in a) !ai(e) && s[e] == null && delete a[e];
}, W = wi;
function pi(e) {
	return mi(e);
}
function mi(e, i) {
	let a = ce();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !Fi(e, t) && (r = ve(e), A(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case Ti:
				y(e, t, n, r);
				break;
			case Ei:
				b(e, t, n, r);
				break;
			case Di:
				e ?? x(t, n, r, o);
				break;
			case G:
				ie(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? O(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, xe);
		}
		u != null && i ? Gn(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Gn(e.ref, null, a, e, !0);
	}, y = (e, t, n, r) => {
		if (e == null) o(t.el = u(t.children), n, r);
		else {
			let n = t.el = e.el;
			t.children !== e.children && f(n, t.children);
		}
	}, b = (e, t, n, r) => {
		e == null ? o(t.el = d(t.children || ""), n, r) : t.el = e.el;
	}, x = (e, t, n, r) => {
		[e.el, e.anchor] = _(e.children, t, n, r, e.el, e.anchor);
	}, S = ({ el: e, anchor: t }, n, r) => {
		let i;
		for (; e && e !== t;) i = h(e), o(e, n, r), e = i;
		o(t, n, r);
	}, C = ({ el: e, anchor: t }) => {
		let n;
		for (; e && e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, w = (e, t, n, r, i, a, o, s, c) => {
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) ee(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), ne(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, ee = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && E(e.children, d, null, r, i, hi(e, a), s, u), _ && En(e, null, r, "created"), te(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !T(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Ki(f, r, e);
		}
		_ && En(e, null, r, "beforeMount");
		let v = _i(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && W(() => {
			try {
				f && Ki(f, r, e), v && g.enter(d), _ && En(e, null, r, "mounted");
			} finally {}
		}, i);
	}, te = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || Ci(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				te(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, E = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? Ui(e[l]) : Hi(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, ne = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && gi(r, !1), (g = h.onVnodeBeforeUpdate) && Ki(g, r, n, e), f && En(n, e, r, "beforeUpdate"), r && gi(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? D(e.dynamicChildren, d, l, r, i, hi(n, a), o) : s || ue(e, n, l, null, r, i, hi(n, a), o, !1), u > 0) {
			if (u & 16) re(l, m, h, r, a);
			else if (u & 2 && m.class !== h.class && c(l, "class", null, h.class, a), u & 4 && c(l, "style", m.style, h.style, a), u & 8) {
				let e = n.dynamicProps;
				for (let t = 0; t < e.length; t++) {
					let n = e[t], i = m[n], o = h[n];
					(o !== i || n === "value") && c(l, n, i, o, a, r);
				}
			}
			u & 1 && e.children !== n.children && p(l, n.children);
		} else !s && d == null && re(l, m, h, r, a);
		((g = h.onVnodeUpdated) || f) && W(() => {
			g && Ki(g, r, n, e), f && En(n, e, r, "updated");
		}, i);
	}, D = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === G || !Fi(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, re = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !T(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (T(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, ie = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), E(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (D(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && vi(e, t, !0)) : ue(e, t, n, f, i, a, s, c, l);
	}, O = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : k(t, n, r, i, a, o, c) : oe(e, t, c);
	}, k = (e, t, n, r, i, a, o) => {
		let s = e.component = Yi(e, r, i);
		if (Jn(e) && (s.ctx.renderer = xe), ra(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, se, o), !e.el) {
				let r = s.subTree = X(Ei);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else se(s, e, t, n, i, a, o);
	}, oe = (e, t, n) => {
		let r = t.component = e.component;
		if (Gr(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				le(r, t, n);
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, r.vnode = t;
	}, se = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = bi(e);
					if (n) {
						t && (t.el = c.el, le(e, t, o)), n.asyncDep.then(() => {
							W(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				gi(e, !1), t ? (t.el = c.el, le(e, t, o)) : t = c, n && ae(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Ki(d, s, t, c), gi(e, !0);
				let f = Hr(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), ve(p), e, i, a), t.el = f.el, u === null && Jr(e, f.el), r && W(r, i), (d = t.props && t.props.onVnodeUpdated) && W(() => Ki(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = qn(t);
				if (gi(e, !1), l && ae(l), !m && (o = c && c.onVnodeBeforeMount) && Ki(o, d, t), gi(e, !0), s && Se) {
					let t = () => {
						e.subTree = Hr(e), Se(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Hr(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && W(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					W(() => Ki(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && qn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && W(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new De(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => hn(u), gi(e, !0), l();
	}, le = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, $r(e, t.props, r, n), fi(e, t.children, n), He(), vn(e), Ue();
	}, ue = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, u = e ? e.shapeFlag : 0, d = t.children, { patchFlag: f, shapeFlag: m } = t;
		if (f > 0) {
			if (f & 128) {
				fe(l, d, n, r, i, a, o, s, c);
				return;
			}
			if (f & 256) {
				de(l, d, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (u & 16 && _e(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? fe(l, d, n, r, i, a, o, s, c) : _e(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && E(d, n, r, i, a, o, s, c));
	}, de = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? Ui(t[p]) : Hi(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? _e(e, a, o, !0, !1, f) : E(t, r, i, a, o, s, c, l, f);
	}, fe = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? Ui(t[u]) : Hi(t[u]);
			if (Fi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? Ui(t[p]) : Hi(t[p]);
			if (Fi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? Ui(t[u]) : Hi(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) A(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? Ui(t[u]) : Hi(t[u]);
				e.key != null && g.set(e.key, u);
			}
			let _, y = 0, b = p - h + 1, x = !1, S = 0, C = Array(b);
			for (u = 0; u < b; u++) C[u] = 0;
			for (u = m; u <= f; u++) {
				let n = e[u];
				if (y >= b) {
					A(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && Fi(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? A(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? yi(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || Si(f) : i;
				C[u] === 0 ? v(null, n, r, p, a, o, s, c, l) : x && (_ < 0 || u !== w[_] ? pe(n, r, p, 2) : _--);
			}
		}
	}, pe = (e, t, n, r, i = null) => {
		let { el: a, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) {
			pe(e.component.subTree, t, n, r);
			return;
		}
		if (d & 128) {
			e.suspense.move(t, n, r);
			return;
		}
		if (d & 64) {
			c.move(e, t, n, xe);
			return;
		}
		if (c === G) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) pe(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === Di) {
			S(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[Ln] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), W(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[Ln];
					a._isLeaving && a[Ln](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, A = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (He(), Gn(s, null, n, e, !0), Ue()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !qn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Ki(_, t, e), u & 6) ge(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && En(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, xe, r) : l && !l.hasOnce && (a !== G || d > 0 && d & 64) ? _e(l, t, n, !1, !0) : (a === G && d & 384 || !i && u & 16) && _e(c, t, n), r && me(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && W(() => {
			_ && Ki(_, t, e), h && En(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, me = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === G) {
			he(n, r);
			return;
		}
		if (t === Di) {
			C(e);
			return;
		}
		let a = () => {
			s(n), i && !i.persisted && i.afterLeave && i.afterLeave();
		};
		if (e.shapeFlag & 1 && i && !i.persisted) {
			let { leave: t, delayLeave: r } = i, o = () => t(n, a);
			r ? r(e.el, a, o) : o();
		} else a();
	}, he = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, ge = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		xi(c), xi(l), r && ae(r), i.stop(), a && (a.flags |= 8, A(o, e, t, n)), s && W(s, t), W(() => {
			e.isUnmounted = !0;
		}, t);
	}, _e = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) A(e[o], t, n, r, i);
	}, ve = (e) => {
		if (e.shapeFlag & 6) return ve(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[Fn];
		return n ? h(n) : t;
	}, ye = !1, be = (e, t, n) => {
		let r;
		e == null ? t._vnode && (A(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, ye ||= (ye = !0, vn(r), yn(), !1);
	}, xe = {
		p: v,
		um: A,
		m: pe,
		r: me,
		mt: k,
		mc: E,
		pc: ue,
		pbc: D,
		n: ve,
		o: e
	}, j, Se;
	return i && ([j, Se] = i(xe)), {
		render: be,
		hydrate: j,
		createApp: Fr(be, j)
	};
}
function hi({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function gi({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function _i(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function vi(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = Ui(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && vi(t, a)), a.type === Ti && (a.patchFlag === -1 && (a = i[e] = Ui(a)), a.el = t.el), a.type === Ei && !a.el && (a.el = t.el);
	}
}
function yi(e) {
	let t = e.slice(), n = [0], r, i, a, o, s, c = e.length;
	for (r = 0; r < c; r++) {
		let c = e[r];
		if (c !== 0) {
			if (i = n[n.length - 1], e[i] < c) {
				t[r] = i, n.push(r);
				continue;
			}
			for (a = 0, o = n.length - 1; a < o;) s = a + o >> 1, e[n[s]] < c ? a = s + 1 : o = s;
			c < e[n[a]] && (a > 0 && (t[r] = n[a - 1]), n[a] = r);
		}
	}
	for (a = n.length, o = n[a - 1]; a-- > 0;) n[a] = o, o = t[o];
	return n;
}
function bi(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : bi(t);
}
function xi(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function Si(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? Si(t.subTree) : null;
}
var Ci = (e) => e.__isSuspense;
function wi(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : _n(e);
}
var G = /* @__PURE__ */ Symbol.for("v-fgt"), Ti = /* @__PURE__ */ Symbol.for("v-txt"), Ei = /* @__PURE__ */ Symbol.for("v-cmt"), Di = /* @__PURE__ */ Symbol.for("v-stc"), Oi = [], K = null;
function q(e = !1) {
	Oi.push(K = e ? null : []);
}
function ki() {
	Oi.pop(), K = Oi[Oi.length - 1] || null;
}
var Ai = 1;
function ji(e, t = !1) {
	Ai += e, e < 0 && K && t && (K.hasOnce = !0);
}
function Mi(e) {
	return e.dynamicChildren = Ai > 0 ? K || n : null, ki(), Ai > 0 && K && K.push(e), e;
}
function J(e, t, n, r, i, a) {
	return Mi(Y(e, t, n, r, i, a, !0));
}
function Ni(e, t, n, r, i) {
	return Mi(X(e, t, n, r, i, !0));
}
function Pi(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function Fi(e, t) {
	return e.type === t.type && e.key === t.key;
}
var Ii = ({ key: e }) => e ?? null, Li = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ L(e) || h(e) ? {
	i: V,
	r: e,
	k: t,
	f: !!n
} : e);
function Y(e, t = null, n = null, r = 0, i = null, a = e === G ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && Ii(t),
		ref: t && Li(t),
		scopeId: Sn,
		slotScopeIds: null,
		children: n,
		component: null,
		suspense: null,
		ssContent: null,
		ssFallback: null,
		dirs: null,
		transition: null,
		el: null,
		anchor: null,
		target: null,
		targetStart: null,
		targetAnchor: null,
		staticCount: 0,
		shapeFlag: a,
		patchFlag: r,
		dynamicProps: i,
		dynamicChildren: null,
		appContext: null,
		ctx: V
	};
	return s ? (Wi(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), Ai > 0 && !o && K && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && K.push(c), c;
}
var X = Ri;
function Ri(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === dr) && (e = Ei), Pi(e)) {
		let r = Bi(e, t, !0);
		return n && Wi(r, n), Ai > 0 && !a && K && (r.shapeFlag & 6 ? K[K.indexOf(e)] = r : K.push(r)), r.patchFlag = -2, r;
	}
	if (ua(e) && (e = e.__vccOpts), t) {
		t = zi(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = A(e)), v(n) && (/* @__PURE__ */ zt(n) && !d(n) && (n = s({}, n)), t.style = le(n));
	}
	let o = g(e) ? 1 : Ci(e) ? 128 : In(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return Y(e, t, n, r, i, o, a, !0);
}
function zi(e) {
	return e ? /* @__PURE__ */ zt(e) || Zr(e) ? s({}, e) : e : null;
}
function Bi(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? Gi(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && Ii(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(Li(t)) : [a, Li(t)] : Li(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== G ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && Bi(e.ssContent),
		ssFallback: e.ssFallback && Bi(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && Bn(u, c.clone(u)), u;
}
function Vi(e = " ", t = 0) {
	return X(Ti, null, e, t);
}
function Z(e = "", t = !1) {
	return t ? (q(), Ni(Ei, null, e)) : X(Ei, null, e);
}
function Hi(e) {
	return e == null || typeof e == "boolean" ? X(Ei) : d(e) ? X(G, null, e.slice()) : Pi(e) ? Ui(e) : X(Ti, null, String(e));
}
function Ui(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : Bi(e);
}
function Wi(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), Wi(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !Zr(t) ? t._ctx = V : r === 3 && V && (V.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			Wi(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: V
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Vi(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function Gi(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = A([t.class, r.class]));
		else if (e === "style") t.style = le([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function Ki(e, t, n, r = null) {
	rn(e, t, 7, [n, r]);
}
var qi = Nr(), Ji = 0;
function Yi(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || qi, o = {
		uid: Ji++,
		vnode: e,
		type: i,
		parent: n,
		appContext: a,
		root: null,
		next: null,
		subTree: null,
		effect: null,
		update: null,
		job: null,
		scope: new we(!0),
		render: null,
		proxy: null,
		exposed: null,
		exposeProxy: null,
		withProxy: null,
		provides: n ? n.provides : Object.create(a.provides),
		ids: n ? n.ids : [
			"",
			0,
			0
		],
		accessCache: null,
		renderCache: [],
		components: null,
		directives: null,
		propsOptions: ri(i, a),
		emitsOptions: Br(i, a),
		emit: null,
		emitted: null,
		propsDefaults: t,
		inheritAttrs: i.inheritAttrs,
		ctx: t,
		data: t,
		props: t,
		attrs: t,
		slots: t,
		refs: t,
		setupState: t,
		setupContext: null,
		suspense: r,
		suspenseId: r ? r.pendingId : 0,
		asyncDep: null,
		asyncResolved: !1,
		isMounted: !1,
		isUnmounted: !1,
		isDeactivated: !1,
		bc: null,
		c: null,
		bm: null,
		m: null,
		bu: null,
		u: null,
		um: null,
		bum: null,
		da: null,
		a: null,
		rtg: null,
		rtc: null,
		ec: null,
		sp: null
	};
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = Rr.bind(null, o), e.ce && e.ce(o), o;
}
var Q = null, Xi = () => Q || V, Zi, Qi;
{
	let e = ce(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	Zi = t("__VUE_INSTANCE_SETTERS__", (e) => Q = e), Qi = t("__VUE_SSR_SETTERS__", (e) => na = e);
}
var $i = (e) => {
	let t = Q;
	return Zi(e), e.scope.on(), () => {
		e.scope.off(), Zi(t);
	};
}, ea = () => {
	Q && Q.scope.off(), Zi(null);
};
function ta(e) {
	return e.vnode.shapeFlag & 4;
}
var na = !1;
function ra(e, t = !1, n = !1) {
	t && Qi(t);
	let { props: r, children: i } = e.vnode, a = ta(e);
	Qr(e, r, a, t), di(e, i, n || t);
	let o = a ? ia(e, t) : void 0;
	return t && Qi(!1), o;
}
function ia(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, _r);
	let { setup: r } = n;
	if (r) {
		He();
		let n = e.setupContext = r.length > 1 ? ca(e) : null, i = $i(e), a = nn(r, e, 0, [e.props, n]), o = y(a);
		if (Ue(), i(), (o || e.sp) && !qn(e) && Hn(e), o) {
			if (a.then(ea, ea), t) return a.then((n) => {
				Qi(!0);
				try {
					aa(e, n, t);
				} finally {
					Qi(!1);
				}
			}).catch((t) => {
				an(t, e, 0);
			});
			e.asyncDep = a;
		} else aa(e, a, t);
	} else oa(e, t);
}
function aa(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = qt(t)), oa(e, n);
}
function oa(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = $i(e);
		He();
		try {
			br(e);
		} finally {
			Ue(), t();
		}
	}
}
var sa = { get(e, t) {
	return P(e, "get", ""), e[t];
} };
function ca(e) {
	return {
		attrs: new Proxy(e.attrs, sa),
		slots: e.slots,
		emit: e.emit,
		expose: (t) => {
			e.exposed = t || {};
		}
	};
}
function la(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(qt(Bt(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in hr) return hr[n](e);
		},
		has(e, t) {
			return t in e || t in hr;
		}
	}) : e.proxy;
}
function ua(e) {
	return h(e) && "__vccOpts" in e;
}
var $ = (e, t) => /* @__PURE__ */ Yt(e, t, na), da = "3.5.42", fa = void 0, pa = typeof window < "u" && window.trustedTypes;
if (pa) try {
	fa = /* @__PURE__ */ pa.createPolicy("vue", { createHTML: (e) => e });
} catch {}
var ma = fa ? (e) => fa.createHTML(e) : (e) => e, ha = "http://www.w3.org/2000/svg", ga = "http://www.w3.org/1998/Math/MathML", _a = typeof document < "u" ? document : null, va = _a && /* @__PURE__ */ _a.createElement("template"), ya = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? _a.createElementNS(ha, e) : t === "mathml" ? _a.createElementNS(ga, e) : n ? _a.createElement(e, { is: n }) : _a.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => _a.createTextNode(e),
	createComment: (e) => _a.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => _a.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			va.innerHTML = ma(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = va.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, ba = /* @__PURE__ */ Symbol("_vtc");
function xa(e, t, n) {
	let r = e[ba];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var Sa = /* @__PURE__ */ Symbol("_vod"), Ca = /* @__PURE__ */ Symbol("_vsh"), wa = /* @__PURE__ */ Symbol(""), Ta = /(?:^|;)\s*display\s*:/;
function Ea(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? Oa(r, t, "");
			}
			else for (let e in t) n[e] ?? Oa(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? Oa(r, i, "") : Ma(e, i, !g(t) && t ? t[i] : void 0, o) || Oa(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[wa];
			e && (n += ";" + e), r.cssText = n, a = Ta.test(n);
		}
	} else t && e.removeAttribute("style");
	Sa in e && (e[Sa] = a ? r.display : "", e[Ca] && (r.display = "none"));
}
var Da = /\s*!important$/;
function Oa(e, t, n) {
	if (d(n)) n.forEach((n) => Oa(e, t, n));
	else if (n ??= "", t.startsWith("--")) Da.test(n) ? e.setProperty(t, n.replace(Da, ""), "important") : e.setProperty(t, n);
	else {
		let r = ja(e, t);
		Da.test(n) ? e.setProperty(D(r), n.replace(Da, ""), "important") : e[r] = n;
	}
}
var ka = [
	"Webkit",
	"Moz",
	"ms"
], Aa = {};
function ja(e, t) {
	let n = Aa[t];
	if (n) return n;
	let r = E(t);
	if (r !== "filter" && r in e) return Aa[t] = r;
	r = re(r);
	for (let n = 0; n < ka.length; n++) {
		let i = ka[n] + r;
		if (i in e) return Aa[t] = i;
	}
	return t;
}
function Ma(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var Na = "http://www.w3.org/1999/xlink";
function Pa(e, t, n, r, i, a = he(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Na, t.slice(6, t.length)) : e.setAttributeNS(Na, t, n) : n == null || a && !ge(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function Fa(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? ma(n) : n);
		return;
	}
	let a = e.tagName;
	if (t === "value" && a !== "PROGRESS" && !a.includes("-")) {
		let r = a === "OPTION" ? e.getAttribute("value") || "" : e.value, i = n == null ? e.type === "checkbox" ? "on" : "" : String(n);
		(r !== i || !("_value" in e)) && (e.value = i), n ?? e.removeAttribute(t), e._value = n;
		return;
	}
	let o = !1;
	if (n === "" || n == null) {
		let r = typeof e[t];
		r === "boolean" ? n = ge(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch {}
	o && e.removeAttribute(i || t);
}
function Ia(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function La(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var Ra = /* @__PURE__ */ Symbol("_vei");
function za(e, t, n, r, i = null) {
	let a = e[Ra] || (e[Ra] = {}), o = a[t];
	if (r && o) o.value = r;
	else {
		let [n, s] = Ha(t);
		r ? Ia(e, n, a[t] = Ka(r, i), s) : o && (La(e, n, o, s), a[t] = void 0);
	}
}
var Ba = /(Once|Passive|Capture)$/, Va = /^on:?(?:Once|Passive|Capture)$/;
function Ha(e) {
	let t, n;
	for (; (n = e.match(Ba)) && !Va.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : D(e.slice(2)), t];
}
var Ua = 0, Wa = /* @__PURE__ */ Promise.resolve(), Ga = () => Ua ||= (Wa.then(() => Ua = 0), Date.now());
function Ka(e, t) {
	let n = (e) => {
		if (!e._vts) e._vts = Date.now();
		else if (e._vts <= n.attached) return;
		let r = n.value;
		if (d(r)) {
			let n = e.stopImmediatePropagation;
			e.stopImmediatePropagation = () => {
				n.call(e), e._stopped = !0;
			};
			let i = r.slice(), a = [e];
			for (let n = 0; n < i.length && !e._stopped; n++) {
				let e = i[n];
				e && rn(e, t, 5, a);
			}
		} else rn(r, t, 5, [e]);
	};
	return n.value = e, n.attached = Ga(), n;
}
var qa = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Ja = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? xa(e, r, c) : t === "style" ? Ea(e, n, r) : a(t) ? o(t) || za(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Ya(e, t, r, c)) ? (Fa(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Pa(e, t, r, c, s, t !== "value")) : e._isVueCE && (Xa(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? Fa(e, E(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), Pa(e, t, r, c));
};
function Ya(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && qa(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return qa(t) && g(n) ? !1 : t in e;
}
function Xa(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = E(t);
	return Array.isArray(n) ? n.some((e) => E(e) === r) : Object.keys(n).some((e) => E(e) === r);
}
var Za = (e) => {
	let t = e.props["onUpdate:modelValue"] || !1;
	return d(t) ? (e) => ae(t, e) : t;
};
function Qa(e) {
	e.target.composing = !0;
}
function $a(e) {
	let t = e.target;
	t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
var eo = /* @__PURE__ */ Symbol("_assign"), to = /* @__PURE__ */ Symbol("_initialValue");
function no(e, t, n) {
	return t && (e = e.trim()), n && (e = oe(e)), e;
}
var ro = {
	created(e, { modifiers: { lazy: t, trim: n, number: r } }, i) {
		e.parentNode && (e.type === "text" ? e[to] = e.defaultValue.replace(/[\r\n]/g, "") : e.type === "textarea" && (e[to] = e.defaultValue.replace(/\r\n?/g, "\n"))), e[eo] = Za(i);
		let a = r || i.props && i.props.type === "number";
		Ia(e, t ? "change" : "input", (t) => {
			t.target.composing || e[eo](no(e.value, n, a));
		}), (n || a) && Ia(e, "change", () => {
			e.value = no(e.value, n, a);
		}), t || (Ia(e, "compositionstart", Qa), Ia(e, "compositionend", $a), Ia(e, "change", $a));
	},
	mounted(e, { value: t, modifiers: { trim: n, number: r } }) {
		let i = t ?? "", a = e[to];
		delete e[to], a !== void 0 && (e.type === "text" || e.type === "textarea") && e.value !== a ? e[eo](no(e.value, n, r)) : e.value = i;
	},
	beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: r, trim: i, number: a } }, o) {
		if (e[eo] = Za(o), e.composing) return;
		let s = (a || e.type === "number") && !/^0\d/.test(e.value) ? oe(e.value) : e.value, c = t ?? "";
		if (s === c) return;
		let l = e.getRootNode();
		(l instanceof Document || l instanceof ShadowRoot) && l.activeElement === e && e.type !== "range" && (r && t === n || i && e.value.trim() === c) || (e.value = c);
	}
}, io = {
	deep: !0,
	created(e, { value: t, modifiers: { number: n } }, r) {
		e._modelValue = t, Ia(e, "change", () => {
			let t = Array.prototype.filter.call(e.options, (e) => e.selected).map((e) => n ? oe(so(e)) : so(e)), r = e.multiple, i = r ? p(e._modelValue) ? new Set(t) : t : t[0], a = e._pendingValue = [r, r ? d(i) ? t.slice() : t : i];
			try {
				e[eo](i);
			} finally {
				pn(() => {
					e._pendingValue === a && (e._pendingValue = void 0);
				});
			}
		}), e[eo] = Za(r);
	},
	mounted(e, { value: t }) {
		oo(e, t);
	},
	beforeUpdate(e, { value: t }, n) {
		e._modelValue = t, e[eo] = Za(n);
	},
	updated(e, { value: t }) {
		let n = e._pendingValue;
		e._pendingValue = void 0, (!n || n[0] !== e.multiple || !ao(t, n[1], n[0])) && oo(e, t);
	}
};
function ao(e, t, n) {
	if (!n || d(e)) return ye(e, t);
	if (p(e)) {
		if (e.size !== t.length) return !1;
		for (let n of t) if (!e.has(n)) return !1;
		return !0;
	}
	return !1;
}
function oo(e, t) {
	let n = e.multiple, r = d(t);
	if (!n || r || p(t)) {
		for (let i = 0, a = e.options.length; i < a; i++) {
			let a = e.options[i], o = so(a);
			if (n) {
				if (r) {
					let e = typeof o;
					a.selected = e === "string" || e === "number" ? t.some((e) => String(e) === String(o)) : be(t, o) > -1;
				} else a.selected = t.has(o);
			} else if (ye(so(a), t)) {
				e.selectedIndex !== i && (e.selectedIndex = i);
				return;
			}
		}
		!n && e.selectedIndex !== -1 && (e.selectedIndex = -1);
	}
}
function so(e) {
	return "_value" in e ? e._value : e.value;
}
var co = [
	"ctrl",
	"shift",
	"alt",
	"meta"
], lo = {
	stop: (e) => e.stopPropagation(),
	prevent: (e) => e.preventDefault(),
	self: (e) => e.target !== e.currentTarget,
	ctrl: (e) => !e.ctrlKey,
	shift: (e) => !e.shiftKey,
	alt: (e) => !e.altKey,
	meta: (e) => !e.metaKey,
	left: (e) => "button" in e && e.button !== 0,
	middle: (e) => "button" in e && e.button !== 1,
	right: (e) => "button" in e && e.button !== 2,
	exact: (e, t) => co.some((n) => e[`${n}Key`] && !t.includes(n))
}, uo = (e, t) => {
	if (!e) return e;
	let n = e._withMods ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n, ...r) => {
		for (let e = 0; e < t.length; e++) {
			let r = lo[t[e]];
			if (r && r(n, t)) return;
		}
		return e(n, ...r);
	}));
}, fo = /* @__PURE__ */ s({ patchProp: Ja }, ya), po;
function mo() {
	return po ||= pi(fo);
}
var ho = ((...e) => {
	let t = mo().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = _o(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, go(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function go(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function _o(e) {
	return g(e) ? document.querySelector(e) : e;
}
//#endregion
//#region src/activityPolicy.ts
function vo(e) {
	if (!e?.instantUtc || !["confirmed", "reported"].includes(e.certainty) || e.timeBasis === "unknown" || !["second", "minute"].includes(e.precision)) return null;
	let t = Date.parse(e.instantUtc);
	return Number.isFinite(t) ? t : null;
}
function yo(e, t) {
	let n = vo(e.times.start), r = vo(e.times.playEnd);
	return r !== null && r <= t ? "ended" : n !== null && n > t ? "upcoming" : "ongoing";
}
function bo(e) {
	if (e <= 0) return {
		unit: "ended",
		first: 0,
		second: 0
	};
	let t = Math.max(1, Math.floor(e / 1e3));
	return e >= 2592e5 ? {
		unit: "days",
		first: Math.floor(t / 86400),
		second: Math.floor(t % 86400 / 3600)
	} : e >= 36e5 ? {
		unit: "hours",
		first: Math.floor(t / 3600),
		second: Math.floor(t % 3600 / 60)
	} : e >= 6e4 ? {
		unit: "minutes",
		first: Math.floor(t / 60),
		second: t % 60
	} : {
		unit: "seconds",
		first: t,
		second: 0
	};
}
var xo = (e) => [
	"major-story",
	"story",
	"featured-gameplay",
	"routine",
	"unknown"
].indexOf(e.importance), So = (e) => e.category.startsWith("gacha-");
function Co(e, t) {
	let n = [
		"ongoing",
		"upcoming",
		"ended",
		"unknown"
	];
	return [...e].sort((e, r) => {
		let i = yo(e, t), a = yo(r, t), o = Number(So(r)) - Number(So(e));
		if (o) return o;
		let s = n.indexOf(i) - n.indexOf(a);
		if (s) return s;
		let c = (e) => i === "ongoing" ? vo(e.times.playEnd) ?? 2 ** 53 - 1 : i === "upcoming" ? vo(e.times.start) ?? 2 ** 53 - 1 : i === "ended" ? -(vo(e.times.playEnd) ?? 0) : 0, l = c(e) - c(r);
		if (l) return l;
		if (i === "ongoing") {
			let t = xo(e) - xo(r);
			if (t) return t;
			let n = (vo(e.times.start) ?? 2 ** 53 - 1) - (vo(r.times.start) ?? 2 ** 53 - 1);
			if (n) return n;
		}
		if (i === "unknown") {
			let t = wo(e.title.normalize(), r.title.normalize());
			if (t) return t;
		}
		return wo(e.eventId, r.eventId);
	});
}
function wo(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/formatting.ts
function To(e) {
	return (t, n = {}) => e.i18n.t(t, n, t);
}
function Eo(e, t) {
	let n = vo(e);
	if (n === null) {
		let n = t.i18n.t("time.unverified");
		return e?.rawValue ? `${n} · ${e.rawValue}` : n;
	}
	return new Intl.DateTimeFormat(t.i18n.locale, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(n);
}
function Do(e, t) {
	return vo(e) === null ? t.i18n.t("time.started") : Eo(e, t);
}
function Oo(e, t) {
	let n = To(t);
	return e?.version?.number ? `${n("version.label")} ${e.version.number}` : n(e?.contentPeriod?.kind === "campaign" ? "version.topic" : "version.unverified");
}
function ko(e, t) {
	return e.replace(/\r\n?/g, "\n").replace(/[ \t]*[●•◆][ \t]*/g, "\n• ").replace(/(?=(?:活动时间|活动说明|开放时间|参与条件|参与要求|解锁条件|奖励内容|招募时间|活动期间|Event Period|Event Details)[：:])/g, "\n").replace(/(?=[一二三四五六七八九十]+、[ \t]*[^\n]{2,40}(?:开启时间|开放时间|版本更新|其他内容))/g, "\n").split(/\n+/).map((e) => e.trim()).filter((e) => e && e !== t).map((e) => {
		if (/^[•●◆]|^[-*]\s/.test(e)) return {
			kind: "bullet",
			text: e.replace(/^[•●◆*-]\s*/, "")
		};
		let t = /^(活动时间|活动说明|开放时间|参与条件|参与要求|解锁条件|奖励内容|招募时间|活动期间|Event Period|Event Details)[：:]\s*(.*)$/.exec(e);
		return t ? {
			kind: "field",
			label: t[1],
			text: t[2]
		} : {
			kind: "paragraph",
			text: e
		};
	});
}
//#endregion
//#region src/ActivityDescription.vue?vue&type=script&setup=true&lang.ts
var Ao = { class: "ga-event-description" }, jo = {
	key: 0,
	class: "ga-muted"
}, Mo = { key: 0 }, No = {
	key: 1,
	class: "ga-description-expand"
}, Po = { key: 0 }, Fo = {
	key: 2,
	class: "ga-muted"
}, Io = /* @__PURE__ */ Vn({
	__name: "ActivityDescription",
	props: {
		item: {},
		host: {}
	},
	setup(e) {
		let t = e, n = To(t.host), r = $(() => ko(t.item.description ?? "", t.item.title)), i = $(() => r.value.slice(0, 3)), a = $(() => r.value.slice(3));
		return (t, o) => (q(), J("div", Ao, [
			r.value.length ? Z("", !0) : (q(), J("p", jo, j(z(n)("description.missing")), 1)),
			(q(!0), J(G, null, H(i.value, (e, t) => (q(), J("div", {
				key: t,
				class: A(`ga-text-${e.kind}`)
			}, [e.label ? (q(), J("strong", Mo, j(e.label), 1)) : Z("", !0), Y("p", null, j(e.text), 1)], 2))), 128)),
			a.value.length ? (q(), J("details", No, [Y("summary", null, j(z(n)("description.expand")), 1), (q(!0), J(G, null, H(a.value, (e, t) => (q(), J("div", {
				key: t,
				class: A(`ga-text-${e.kind}`)
			}, [e.label ? (q(), J("strong", Po, j(e.label), 1)) : Z("", !0), Y("p", null, j(e.text), 1)], 2))), 128))])) : Z("", !0),
			e.item.descriptionTruncated ? (q(), J("p", Fo, j(z(n)("description.truncated")), 1)) : Z("", !0)
		]));
	}
}), Lo = { class: "ga-event-card" }, Ro = { class: "ga-event-heading" }, zo = {
	key: 0,
	class: "ga-event-tag"
}, Bo = { class: "ga-event-times" }, Vo = ["title"], Ho = { key: 0 }, Uo = {
	key: 0,
	class: "ga-notice"
}, Wo = { class: "ga-event-footer" }, Go = ["href"], Ko = {
	key: 1,
	class: "ga-muted"
}, qo = /* @__PURE__ */ Vn({
	__name: "ActivityEventCard",
	props: {
		item: {},
		now: {},
		host: {}
	},
	emits: ["official"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = To(n.host), a = $(() => {
			let e = vo(n.item.times.claimEnd);
			return yo(n.item, n.now) === "ended" && e !== null && e > n.now;
		});
		return (t, n) => (q(), J("article", Lo, [
			Y("header", Ro, [Y("h4", null, j(e.item.title), 1), [
				"major-story",
				"story",
				"featured-gameplay"
			].includes(e.item.importance) ? (q(), J("span", zo, j(z(i)(`importance.${e.item.importance}`)), 1)) : Z("", !0)]),
			Y("dl", Bo, [
				Y("div", null, [Y("dt", null, j(z(i)("time.start")), 1), Y("dd", { title: e.item.times.start?.rawValue ?? void 0 }, j(z(Do)(e.item.times.start, e.host)), 9, Vo)]),
				Y("div", null, [Y("dt", null, j(z(i)("time.playEnd")), 1), Y("dd", null, j(e.item.availability === "permanent" ? z(i)("time.permanent") : z(Eo)(e.item.times.playEnd, e.host)), 1)]),
				e.item.times.claimEnd ? (q(), J("div", Ho, [Y("dt", null, j(z(i)("time.claimEnd")), 1), Y("dd", null, j(z(Eo)(e.item.times.claimEnd, e.host)), 1)])) : Z("", !0)
			]),
			a.value ? (q(), J("p", Uo, j(z(i)("time.claimOpen")), 1)) : Z("", !0),
			X(Io, {
				item: e.item,
				host: e.host
			}, null, 8, ["item", "host"]),
			Y("footer", Wo, [e.item.officialUrl ? (q(), J("a", {
				key: 0,
				href: e.item.officialUrl,
				rel: "noopener noreferrer",
				onClick: n[0] ||= uo((t) => r("official", e.item), ["prevent"])
			}, j(z(i)(e.item.officialLinkKind === "exact-activity" ? "link.activity" : "link.version")) + " ↗", 9, Go)) : (q(), J("span", Ko, j(z(i)("link.missing")), 1))])
		]));
	}
}), Jo = { class: "ga-details" }, Yo = { class: "ga-detail-intro" }, Xo = { class: "ga-eyebrow" }, Zo = { class: "ga-detail-badges" }, Qo = { key: 0 }, $o = { key: 1 }, es = { class: "ga-muted" }, ts = {
	key: 0,
	class: "ga-version-end"
}, ns = {
	key: 0,
	class: "ga-error",
	role: "alert"
}, rs = ["aria-label"], is = { class: "ga-section-title" }, as = {
	key: 0,
	class: "ga-coverage-note"
}, os = {
	key: 1,
	class: "ga-muted ga-section-empty"
}, ss = ["open"], cs = ["data-state"], ls = { class: "ga-group-count" }, us = { class: "ga-event-list" }, ds = { class: "ga-source-details" }, fs = {
	key: 0,
	class: "ga-diagnostics"
}, ps = { class: "ga-muted" }, ms = { class: "ga-source-list" }, hs = { class: "ga-source-url" }, gs = /* @__PURE__ */ Vn({
	__name: "ActivityDetails",
	props: {
		feed: {},
		now: {},
		host: {}
	},
	setup(e) {
		let t = e, n = To(t.host), r = /* @__PURE__ */ R(""), i = Intl.DateTimeFormat().resolvedOptions().timeZone, a = $(() => {
			let e = Co(t.feed.activities, t.now);
			return ["gacha", "activities"].map((n) => ({
				id: n,
				groups: [
					"ongoing",
					"upcoming",
					"ended",
					"unknown"
				].map((r) => ({
					state: r,
					items: e.filter((e) => So(e) === (n === "gacha") && yo(e, t.now) === r)
				})).filter((e) => e.items.length)
			}));
		}), o = {
			"blue-archive": [
				"bluearchive-cn.com",
				"www.bluearchive-cn.com",
				"bluearchive.jp",
				"forum.nexon.com"
			],
			"genshin-impact": [
				"ys.mihoyo.com",
				"www.miyoushe.com",
				"operation-webstatic.mihoyo.com"
			],
			"arknights-endfield": ["endfield.hypergryph.com"],
			"stella-sora": ["stellasora.yostar.cn"],
			"honkai-star-rail": ["sr.mihoyo.com", "www.miyoushe.com"],
			"neverness-to-everness": ["yh.wanmei.com", "nte.perfectworld.com"],
			"wuthering-waves": ["mc.kurogames.com", "wiki.kurobbs.com"],
			"zenless-zone-zero": ["zzz.mihoyo.com", "www.miyoushe.com"]
		};
		async function s(e) {
			if (e.officialUrl) try {
				let i = new URL(e.officialUrl);
				if (i.protocol !== "https:" || i.username || i.password || !o[t.feed.gameId]?.includes(i.hostname)) throw Error(n("link.invalid"));
				await t.host.navigation.openExternal(i.href), r.value = "";
			} catch (e) {
				r.value = e instanceof Error ? e.message : String(e);
			}
		}
		function c(e) {
			return t.host.i18n.t(`diagnostic.${e}`, {}, n("diagnostic.other"));
		}
		return (t, o) => (q(), J("div", Jo, [
			Y("header", Yo, [
				Y("div", null, [Y("span", Xo, j(z(n)("details.game")), 1), Y("h2", null, j(z(n)(`game.${e.feed.gameId}`)), 1)]),
				Y("div", Zo, [e.feed.overview?.number ? (q(), J("span", Qo, j(z(Oo)(e.feed, e.host)), 1)) : Z("", !0), e.feed.progressionId === "default" ? Z("", !0) : (q(), J("span", $o, j(z(n)(`progression.${e.feed.progressionId}`)), 1))]),
				Y("p", es, j(z(n)("details.timezone", { zone: z(i) })), 1),
				e.feed.overview?.end ? (q(), J("p", ts, j(z(n)("time.overviewEnd")) + " · " + j(z(Eo)(e.feed.overview.end, e.host)), 1)) : Z("", !0)
			]),
			r.value ? (q(), J("p", ns, j(r.value), 1)) : Z("", !0),
			(q(!0), J(G, null, H(a.value, (t) => (q(), J("section", {
				key: t.id,
				class: "ga-detail-section",
				"aria-label": z(n)(`section.${t.id}`)
			}, [
				Y("div", is, [Y("h3", null, j(z(n)(`section.${t.id}`)), 1), Y("span", null, j(t.groups.reduce((e, t) => e + t.items.length, 0)), 1)]),
				t.id === "gacha" && e.feed.coverage.gacha.status !== "complete" ? (q(), J("div", as, [Y("strong", null, j(z(n)(`coverage.${e.feed.coverage.gacha.status}`)), 1), Y("p", null, j(z(n)("coverage.help")), 1)])) : Z("", !0),
				t.groups.length ? Z("", !0) : (q(), J("p", os, j(z(n)(t.id === "gacha" ? "coverage.empty" : "details.empty")), 1)),
				(q(!0), J(G, null, H(t.groups, (t) => (q(), J("details", {
					key: t.state,
					class: "ga-state-group",
					open: t.state !== "ended"
				}, [Y("summary", null, [
					Y("span", {
						class: "ga-state-dot",
						"data-state": t.state
					}, null, 8, cs),
					Y("span", null, j(z(n)(`state.${t.state}`)), 1),
					Y("span", ls, j(t.items.length), 1)
				]), Y("div", us, [(q(!0), J(G, null, H(t.items, (t) => (q(), Ni(qo, {
					key: t.eventId,
					item: t,
					host: e.host,
					now: e.now,
					onOfficial: s
				}, null, 8, [
					"item",
					"host",
					"now"
				]))), 128))])], 8, ss))), 128))
			], 8, rs))), 128)),
			Y("details", ds, [
				Y("summary", null, j(z(n)("sources")), 1),
				e.feed.health.diagnostics.length ? (q(), J("ul", fs, [(q(!0), J(G, null, H(e.feed.health.diagnostics, (e, t) => (q(), J("li", { key: `${e.code}-${t}` }, [Y("strong", null, j(c(e.code)), 1), Y("span", ps, j(e.code) + " · " + j(e.message), 1)]))), 128))])) : Z("", !0),
				Y("ul", ms, [(q(!0), J(G, null, H(e.feed.sources, (e) => (q(), J("li", { key: e.sourceId }, [
					Y("strong", null, j(z(n)(e.kind === "aggregate" ? "source.aggregate" : "source.official")), 1),
					Y("span", hs, j(e.url), 1),
					Y("p", null, j(e.note), 1)
				]))), 128))])
			])
		]));
	}
}), _s = [
	"blue-archive",
	"genshin-impact",
	"arknights-endfield",
	"stella-sora",
	"honkai-star-rail",
	"neverness-to-everness",
	"wuthering-waves",
	"zenless-zone-zero"
];
function vs(e, t) {
	return `${e}/${t}`;
}
//#endregion
//#region src/ActivitySettings.vue?vue&type=script&setup=true&lang.ts
var ys = { class: "ga-settings" }, bs = { class: "ga-interval-setting" }, xs = { for: "ga-carousel-interval" }, Ss = ["aria-invalid", "disabled"], Cs = {
	id: "ga-interval-help",
	class: "ga-muted"
}, ws = {
	key: 0,
	class: "ga-error",
	role: "alert"
}, Ts = { class: "ga-game-selections" }, Es = ["checked", "onChange"], Ds = ["onUpdate:modelValue"], Os = ["value"], ks = [
	"disabled",
	"aria-label",
	"onClick"
], As = [
	"disabled",
	"aria-label",
	"onClick"
], js = {
	key: 0,
	role: "alert",
	class: "ga-error"
}, Ms = { class: "ga-settings-refresh" }, Ns = { class: "ga-muted" }, Ps = ["disabled"], Fs = { class: "ga-muted" }, Is = { class: "ga-actions" }, Ls = ["disabled"], Rs = ["disabled"], zs = /* @__PURE__ */ Vn({
	__name: "ActivitySettings",
	props: {
		settings: {},
		host: {},
		busy: { type: Boolean },
		refreshing: { type: Boolean },
		error: {}
	},
	emits: [
		"save",
		"cancel",
		"refresh"
	],
	setup(e, { emit: t }) {
		let n = e, r = t, i = To(n.host), a = /* @__PURE__ */ R(structuredClone(n.settings)), o = $(() => Number.isInteger(a.value.carouselIntervalSeconds) && (a.value.carouselIntervalSeconds === -1 || a.value.carouselIntervalSeconds >= 10 && a.value.carouselIntervalSeconds <= 120));
		function s(e, t) {
			t.target.checked ? a.value.selectedGames.push(e) : a.value.selectedGames = a.value.selectedGames.filter((t) => t !== e);
		}
		function c(e, t) {
			let n = a.value.selectedGames, r = n.indexOf(e), i = r + t;
			r >= 0 && i >= 0 && i < n.length && ([n[r], n[i]] = [n[i], n[r]]);
		}
		return (t, n) => (q(), J("div", ys, [
			Y("p", null, j(z(i)("settings.help")), 1),
			Y("div", bs, [
				Y("label", xs, [
					Vi(j(z(i)("settings.interval")), 1),
					Tn(Y("input", {
						id: "ga-carousel-interval",
						"onUpdate:modelValue": n[0] ||= (e) => a.value.carouselIntervalSeconds = e,
						type: "number",
						min: "-1",
						max: "120",
						step: "1",
						"aria-invalid": !o.value,
						"aria-describedby": "ga-interval-help",
						disabled: e.busy
					}, null, 8, Ss), [[
						ro,
						a.value.carouselIntervalSeconds,
						void 0,
						{ number: !0 }
					]]),
					Y("span", null, j(z(i)("settings.seconds")), 1)
				]),
				Y("p", Cs, j(z(i)("settings.intervalHelp")), 1),
				o.value ? Z("", !0) : (q(), J("p", ws, j(z(i)("settings.intervalInvalid")), 1))
			]),
			Y("div", Ts, [(q(!0), J(G, null, H(z(_s), (e) => (q(), J("label", {
				key: e,
				class: "ga-selection"
			}, [Y("input", {
				type: "checkbox",
				checked: a.value.selectedGames.includes(e),
				onChange: (t) => s(e, t)
			}, null, 40, Es), Vi(j(z(i)(`game.${e}`)), 1)]))), 128))]),
			(q(), J(G, null, H(["blue-archive", "neverness-to-everness"], (e) => Y("label", { key: e }, [Vi(j(z(i)(`game.${e}`)) + " · " + j(z(i)("settings.progression")), 1), Tn(Y("select", { "onUpdate:modelValue": (t) => a.value.progressions[e] = t }, [(q(!0), J(G, null, H(e === "blue-archive" ? [
				"cn",
				"jp",
				"global"
			] : ["cn", "global"], (e) => (q(), J("option", {
				key: e,
				value: e
			}, j(z(i)(`progression.${e}`)), 9, Os))), 128))], 8, Ds), [[io, a.value.progressions[e]]])])), 64)),
			Y("ol", null, [(q(!0), J(G, null, H(a.value.selectedGames, (e, t) => (q(), J("li", { key: e }, [
				Y("span", null, j(z(i)(`game.${e}`)), 1),
				Y("nxp-button", {
					disabled: t === 0,
					"aria-label": `${z(i)("settings.up")} ${z(i)(`game.${e}`)}`,
					onClick: (t) => c(e, -1)
				}, "↑", 8, ks),
				Y("nxp-button", {
					disabled: t === a.value.selectedGames.length - 1,
					"aria-label": `${z(i)("settings.down")} ${z(i)(`game.${e}`)}`,
					onClick: (t) => c(e, 1)
				}, "↓", 8, As)
			]))), 128))]),
			e.error ? (q(), J("p", js, j(e.error), 1)) : Z("", !0),
			Y("div", Ms, [
				Y("div", Ns, [fr(t.$slots, "default")]),
				Y("nxp-button", {
					disabled: e.refreshing || e.busy,
					onClick: n[1] ||= (e) => r("refresh")
				}, j(z(i)(e.refreshing ? "state.loading" : "refresh")), 9, Ps),
				Y("p", Fs, j(z(i)("settings.refreshHelp")), 1)
			]),
			Y("div", Is, [Y("nxp-button", {
				disabled: e.busy,
				onClick: n[2] ||= (e) => r("cancel")
			}, j(z(i)("cancel")), 9, Ls), Y("nxp-button", {
				disabled: e.busy || !o.value,
				onClick: n[3] ||= (e) => r("save", a.value)
			}, j(z(i)("save")), 9, Rs)])
		]));
	}
}), Bs = { class: "ga-sr-only" }, Vs = {
	key: 0,
	role: "alert",
	class: "ga-error"
}, Hs = {
	key: 1,
	class: "ga-empty-carousel"
}, Us = [
	"disabled",
	"aria-label",
	"title"
], Ws = ["aria-label"], Gs = { class: "ga-viewport" }, Ks = [
	"aria-label",
	"aria-hidden",
	"inert"
], qs = [
	"src",
	"alt",
	"onError"
], Js = {
	key: 1,
	class: "ga-cover-fallback",
	"aria-hidden": "true"
}, Ys = { class: "ga-slide-copy" }, Xs = { class: "ga-slide-meta" }, Zs = { class: "ga-game-name" }, Qs = {
	key: 0,
	class: "ga-version"
}, $s = {
	key: 1,
	class: "ga-progression"
}, ec = {
	key: 0,
	class: "ga-deadline"
}, tc = ["datetime"], nc = {
	key: 1,
	class: "ga-description"
}, rc = ["disabled", "aria-label"], ic = { class: "ga-tools" }, ac = [
	"aria-label",
	"title",
	"aria-pressed"
], oc = ["aria-label", "title"], sc = ["disabled", "aria-label"], cc = ["disabled", "aria-label"], lc = { class: "ga-carousel-controls" }, uc = { class: "ga-indicators" }, dc = [
	"aria-label",
	"aria-current",
	"onClick"
], fc = [
	"open",
	"title",
	"locked"
], pc = { key: 0 }, mc = ["open", "title"], hc = /* @__PURE__ */ Vn({
	__name: "ActivityCarousel",
	props: {
		host: {},
		state: {},
		covers: {}
	},
	setup(e) {
		let t = e, n = To(t.host), { current: r, feeds: i, index: a, error: o, busy: s, refreshing: c, now: l, saveSettings: u, refresh: d } = t.state, f = /* @__PURE__ */ R(!1), p = /* @__PURE__ */ R(!1), m = /* @__PURE__ */ R(!1), h = /* @__PURE__ */ R(!1), g = /* @__PURE__ */ R(!1), _ = /* @__PURE__ */ R(!1), v = $(() => r.value?.selectedFeeds[a.value]), y = $(() => v.value ? i.value[vs(v.value.gameId, v.value.progressionId)] : null), b = $(() => (r.value?.selectedFeeds ?? []).map((e) => {
			let t = vs(e.gameId, e.progressionId), n = i.value[t];
			return {
				id: t,
				summary: e,
				feed: n,
				overview: n?.overview
			};
		})), { images: x, releaseImage: S } = t.covers, C = window.matchMedia?.("(prefers-reduced-motion: reduce)"), w = Intl.DateTimeFormat().resolvedOptions().timeZone, T = $(() => (r.value?.settings.carouselIntervalSeconds ?? 30) * 1e3), ee = performance.now() + T.value, te;
		function E(e) {
			a.value = e, ee = performance.now() + T.value;
		}
		jn(T, () => {
			ee = performance.now() + T.value;
		});
		function ne(e) {
			let t = b.value.length;
			t > 1 && E((a.value + e + t) % t);
		}
		function D(e) {
			e.target === e.currentTarget && ["ArrowLeft", "ArrowRight"].includes(e.key) && (e.preventDefault(), ne(e.key === "ArrowLeft" ? -1 : 1));
		}
		function re(e) {
			let t = vo(e);
			if (t === null) return n("time.unverified");
			let r = bo(t - l.value);
			return r.unit === "ended" ? n("state.ended") : n(`countdown.${r.unit}`, r);
		}
		function ie(e) {
			return new Intl.DateTimeFormat(t.host.i18n.locale, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(new Date(e));
		}
		function O() {
			r.value && (f.value = !0, o.value = "");
		}
		async function ae(e) {
			await u(e) && (f.value = !1);
		}
		function k() {
			g.value = C?.matches ?? !1;
		}
		function oe(e) {
			h.value = !!e.currentTarget.contains(e.relatedTarget);
		}
		return nr(() => {
			k(), C?.addEventListener("change", k), te = setInterval(() => {
				if (T.value < 0 || document.hidden || g.value || _.value || m.value || h.value || f.value || p.value) {
					ee = performance.now() + T.value;
					return;
				}
				performance.now() >= ee && ne(1);
			}, 250);
		}), ar(() => {
			clearInterval(te), C?.removeEventListener("change", k);
		}), (t, i) => (q(), J("nxp-card", {
			class: "game-activities",
			unstyled: !0,
			onMouseenter: i[7] ||= (e) => m.value = !0,
			onMouseleave: i[8] ||= (e) => m.value = !1,
			onFocusin: i[9] ||= (e) => h.value = !0,
			onFocusout: oe
		}, [
			Y("h2", Bs, j(z(n)("card.title")), 1),
			z(o) && !f.value ? (q(), J("p", Vs, j(z(o)), 1)) : Z("", !0),
			!z(r) || !z(r).selectedFeeds.length ? (q(), J("div", Hs, [Y("p", null, j(z(n)(z(r) ? "state.select" : "state.loading")), 1), Y("button", {
				type: "button",
				class: "ga-icon-button ga-empty-settings",
				disabled: !z(r),
				"aria-label": z(n)("settings.title"),
				title: z(n)("settings.title"),
				onClick: O
			}, "⚙️", 8, Us)])) : v.value ? (q(), J("div", {
				key: 2,
				class: "ga-carousel",
				role: "region",
				"aria-roledescription": "carousel",
				"aria-label": z(n)("carousel.label"),
				tabindex: "0",
				onKeydown: D
			}, [
				Y("div", Gs, [Y("div", {
					class: "ga-track",
					style: le({ transform: `translateX(-${z(a) * 100}%)` })
				}, [(q(!0), J(G, null, H(b.value, (t, r) => (q(), J("article", {
					key: t.id,
					class: "ga-slide",
					role: "group",
					"aria-roledescription": "slide",
					"aria-label": `${r + 1}/${b.value.length} · ${z(n)(`game.${t.summary.gameId}`)}`,
					"aria-hidden": r !== z(a),
					inert: r !== z(a) || void 0
				}, [
					z(x)[t.id] ? (q(), J("img", {
						key: 0,
						class: "ga-cover",
						src: z(x)[t.id],
						alt: t.overview?.cover?.alt ?? "",
						onError: (e) => z(S)(t.id)
					}, null, 40, qs)) : (q(), J("div", Js, [Y("span", null, j(z(n)(`game.${t.summary.gameId}`)), 1)])),
					i[10] ||= Y("div", { class: "ga-shade" }, null, -1),
					Y("div", Ys, [
						Y("div", Xs, [
							Y("span", Zs, j(z(n)(`game.${t.summary.gameId}`)), 1),
							t.overview?.number ? (q(), J("span", Qs, j(z(Oo)(t.feed, e.host)), 1)) : Z("", !0),
							t.summary.progressionId === "default" ? Z("", !0) : (q(), J("span", $s, j(z(n)(`progression.${t.summary.progressionId}`)), 1))
						]),
						Y("h3", null, j(t.overview?.title || z(n)("state.overview")), 1),
						t.overview?.end ? (q(), J("div", ec, [
							Y("span", null, j(z(n)("time.overviewEnd")), 1),
							Y("time", { datetime: t.overview.end.instantUtc || void 0 }, j(z(Eo)(t.overview.end, e.host)), 9, tc),
							Y("strong", null, j(re(t.overview.end)), 1)
						])) : t.feed ? Z("", !0) : (q(), J("p", nc, j(z(n)("state.loading")), 1))
					]),
					Y("button", {
						class: "ga-open-details",
						type: "button",
						disabled: !t.feed,
						"aria-label": z(n)("details.open", { game: z(n)(`game.${t.summary.gameId}`) }),
						"aria-haspopup": "dialog",
						onClick: i[0] ||= (e) => p.value = !0
					}, null, 8, rc)
				], 8, Ks))), 128))], 4)]),
				Y("div", ic, [T.value > 0 && b.value.length > 1 ? (q(), J("button", {
					key: 0,
					type: "button",
					class: "ga-icon-button",
					"aria-label": z(n)(_.value ? "carousel.resume" : "carousel.pause"),
					title: z(n)(_.value ? "carousel.resume" : "carousel.pause"),
					"aria-pressed": _.value,
					onClick: i[1] ||= (e) => _.value = !_.value
				}, j(_.value ? "▶️" : "⏸️"), 9, ac)) : Z("", !0), Y("button", {
					type: "button",
					class: "ga-icon-button",
					"aria-label": z(n)("settings.title"),
					title: z(n)("settings.title"),
					onClick: O
				}, "⚙️", 8, oc)]),
				Y("button", {
					type: "button",
					class: "ga-page-button ga-previous",
					disabled: b.value.length < 2,
					"aria-label": z(n)("carousel.previous"),
					onClick: i[2] ||= (e) => ne(-1)
				}, "‹", 8, sc),
				Y("button", {
					type: "button",
					class: "ga-page-button ga-next",
					disabled: b.value.length < 2,
					"aria-label": z(n)("carousel.next"),
					onClick: i[3] ||= (e) => ne(1)
				}, "›", 8, cc),
				Y("div", lc, [Y("div", uc, [(q(!0), J(G, null, H(b.value, (e, t) => (q(), J("button", {
					key: e.id,
					type: "button",
					"aria-label": `${z(n)("carousel.show")} ${z(n)(`game.${e.summary.gameId}`)}`,
					"aria-current": t === z(a) ? "true" : void 0,
					class: A({ "ga-current": t === z(a) }),
					onClick: (e) => E(t)
				}, [...i[11] ||= [Y("span", null, null, -1)]], 10, dc))), 128))])])
			], 40, Ws)) : Z("", !0),
			f.value && z(r) ? (q(), J("nxp-modal", {
				key: 3,
				open: f.value,
				title: z(n)("settings.title"),
				locked: z(s),
				onClose: i[5] ||= (e) => f.value = !1
			}, [X(zs, {
				settings: z(r).settings,
				host: e.host,
				busy: z(s),
				refreshing: z(c) || z(r).refreshing,
				error: z(o),
				onSave: ae,
				onCancel: i[4] ||= (e) => f.value = !1,
				onRefresh: z(d)
			}, {
				default: wn(() => [v.value ? (q(), J("span", pc, [Vi(j(z(n)(`cache.${v.value.cacheState}`)), 1), y.value?.health.lastGoodAt ? (q(), J(G, { key: 0 }, [Vi(" · " + j(z(n)("state.lastGood")) + " " + j(ie(y.value.health.lastGoodAt)) + " (" + j(z(w)) + ")", 1)], 64)) : Z("", !0)])) : Z("", !0)]),
				_: 1
			}, 8, [
				"settings",
				"host",
				"busy",
				"refreshing",
				"error",
				"onRefresh"
			])], 40, fc)) : Z("", !0),
			p.value ? (q(), J("nxp-modal", {
				key: 4,
				open: p.value,
				title: z(n)("details.title"),
				size: "wide",
				onClose: i[6] ||= (e) => p.value = !1
			}, [y.value ? (q(), Ni(gs, {
				key: 0,
				feed: y.value,
				host: e.host,
				now: z(l)
			}, null, 8, [
				"feed",
				"host",
				"now"
			])) : Z("", !0)], 40, mc)) : Z("", !0)
		], 32));
	}
});
//#endregion
//#region src/useActivityState.ts
function gc(e) {
	let t = /* @__PURE__ */ Ut(null), n = /* @__PURE__ */ Ut({}), r = /* @__PURE__ */ R(0), i = /* @__PURE__ */ R(""), a = /* @__PURE__ */ R(!1), o = /* @__PURE__ */ R(!1), s = /* @__PURE__ */ R(Date.now()), c = new AbortController(), l = !1, u = !1, d = !1, f = 0, p = Date.now(), m = performance.now(), h, g, _, v = 0;
	function y(e) {
		c.signal.aborted || (i.value = e instanceof Error ? e.message : String(e));
	}
	async function b() {
		if (l || document.hidden) return;
		if (u) {
			d = !0;
			return;
		}
		u = !0;
		let a = ++f;
		try {
			let o = await e.api.get("state", c.signal);
			if (l || a !== f) return;
			let u = t.value?.selectedFeeds[r.value];
			p = Date.parse(o.serverNowUtc), m = performance.now(), s.value = p, t.value = o;
			let d = u ? o.selectedFeeds.findIndex((e) => vs(e.gameId, e.progressionId) === vs(u.gameId, u.progressionId)) : -1;
			r.value = d >= 0 ? d : Math.min(r.value, Math.max(0, o.selectedFeeds.length - 1));
			let h = new Set(o.selectedFeeds.map((e) => vs(e.gameId, e.progressionId)));
			n.value = Object.fromEntries(Object.entries(n.value).filter(([e]) => h.has(e))), i.value = "", await Promise.all(o.selectedFeeds.map(async (t) => {
				let r = vs(t.gameId, t.progressionId);
				if (!t.snapshotId) return;
				let i = n.value[r];
				if (i?.snapshotId === t.snapshotId) {
					n.value = {
						...n.value,
						[r]: {
							...i,
							health: {
								...i.health,
								cacheState: t.cacheState
							}
						}
					};
					return;
				}
				try {
					let i = await e.api.get("feed", c.signal, {
						gameId: t.gameId,
						progressionId: t.progressionId,
						contentLocale: t.contentLocale
					});
					if (l || a !== f) return;
					i?.gameId === t.gameId && i.progressionId === t.progressionId && (n.value = {
						...n.value,
						[r]: i
					});
				} catch (e) {
					y(e);
				}
			})), v = performance.now() + 6e4;
		} catch (e) {
			y(e);
		} finally {
			u = !1, d && !l && (d = !1, b());
		}
	}
	async function x(n) {
		if (!t.value || a.value) return !1;
		a.value = !0;
		try {
			return await e.api.put("settings", {
				expectedRevision: t.value.settingsRevision,
				settings: {
					...n,
					onboardingCompleted: !0
				}
			}, c.signal), f++, await b(), !0;
		} catch (e) {
			return y(e), !1;
		} finally {
			a.value = !1;
		}
	}
	async function S(t) {
		try {
			let n = await e.api.get("refresh-status", c.signal, { operationId: t });
			if (l) return;
			["queued", "running"].includes(n.status) ? (await b(), _ = setTimeout(() => void S(t), 2e3)) : (_ = void 0, o.value = !1, await b());
		} catch (e) {
			_ = void 0, o.value = !1, y(e);
		}
	}
	async function C() {
		if (!(o.value || l)) {
			o.value = !0;
			try {
				let t = await e.api.post("refresh", { selected: !0 }, c.signal);
				l || (_ = setTimeout(() => void S(t.operationId), 2e3));
			} catch (e) {
				o.value = !1, y(e);
			}
		}
	}
	function w() {
		document.hidden || b();
	}
	document.addEventListener("visibilitychange", w), b(), h = setInterval(() => {
		document.hidden || (s.value = p + performance.now() - m);
	}, 1e3), g = setInterval(() => {
		(t.value?.refreshing || t.value?.selectedFeeds.some((e) => {
			let t = n.value[vs(e.gameId, e.progressionId)];
			return !t || t.overview?.cover?.assetId === null;
		}) || performance.now() >= v) && b();
	}, 2e3);
	function T() {
		l || (l = !0, f++, c.abort(), clearInterval(h), clearInterval(g), clearTimeout(_), document.removeEventListener("visibilitychange", w));
	}
	return {
		current: t,
		feeds: n,
		index: r,
		error: i,
		busy: a,
		refreshing: o,
		now: s,
		saveSettings: x,
		refresh: C,
		dispose: T
	};
}
//#endregion
//#region src/useCoverAssets.ts
function _c(e, t) {
	let n = /* @__PURE__ */ Ut({}), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = !1;
	function o(e) {
		if (r.get(e)?.abort(), r.delete(e), i.delete(e), n.value[e]) {
			URL.revokeObjectURL(n.value[e]);
			let t = { ...n.value };
			delete t[e], n.value = t;
		}
	}
	function s() {
		let e = new Set(t.value.map((e) => e.id));
		for (let t of i.keys()) e.has(t) || o(t);
		for (let e of t.value) {
			if (a) return;
			let t = e.cover?.assetId;
			if (!t) {
				o(e.id);
				continue;
			}
			i.get(e.id) !== t && (o(e.id), i.set(e.id, t), c(e.id, t));
		}
	}
	async function c(t, o) {
		let s = new AbortController();
		r.set(t, s);
		try {
			let r = await e.api.blob("assets", {
				query: { assetId: o },
				signal: s.signal
			});
			!a && !s.signal.aborted && i.get(t) === o && (n.value = {
				...n.value,
				[t]: URL.createObjectURL(r)
			});
		} catch {
			s.signal.aborted || i.delete(t);
		} finally {
			r.get(t) === s && r.delete(t);
		}
	}
	let l = jn(() => t.value.map((e) => `${e.id}:${e.cover?.assetId ?? ""}`).join("|"), s, { immediate: !0 });
	function u() {
		if (!a) {
			a = !0, l();
			for (let e of i.keys()) o(e);
		}
	}
	return {
		images: n,
		releaseImage: o,
		dispose: u
	};
}
//#endregion
//#region src/main.ts
function vc(e) {
	let t = gc(e), n = _c(e, $(() => (t.current.value?.selectedFeeds ?? []).map((e) => {
		let n = vs(e.gameId, e.progressionId);
		return {
			id: n,
			cover: t.feeds.value[n]?.overview?.cover ?? null
		};
	}))), r = e.dashboard.registerCard("carousel", (r) => {
		let i = ho(hc, {
			host: e,
			state: t,
			covers: n
		}), a = !1, o = () => {
			a || (a = !0, r.signal.removeEventListener("abort", o), i.unmount());
		};
		return r.signal.aborted ? o : (i.mount(r.element), r.signal.addEventListener("abort", o, { once: !0 }), o);
	});
	return { dispose() {
		r.dispose(), n.dispose(), t.dispose();
	} };
}
//#endregion
export { vc as activate };
