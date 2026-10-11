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
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, ee = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), te = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, ne = /-\w/g, T = te((e) => e.replace(ne, (e) => e.slice(1).toUpperCase())), re = /\B([A-Z])/g, E = te((e) => e.replace(re, "-$1").toLowerCase()), ie = te((e) => e.charAt(0).toUpperCase() + e.slice(1)), ae = te((e) => e ? `on${ie(e)}` : ""), D = (e, t) => !Object.is(e, t), oe = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, O = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, se = (e) => {
	let t = parseFloat(e);
	return isNaN(t) ? e : t;
}, ce, le = () => ce ||= typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
function ue(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = g(r) ? me(r) : ue(r);
			if (i) for (let e in i) t[e] = i[e];
		}
		return t;
	}
	if (g(e) || v(e)) return e;
}
var de = /;(?![^(]*\))/g, fe = /:([^]+)/, pe = /\/\*[^]*?\*\//g;
function me(e) {
	let t = {};
	return e.replace(pe, "").split(de).forEach((e) => {
		if (e) {
			let n = e.split(fe);
			n.length > 1 && (t[n[0].trim()] = n[1].trim());
		}
	}), t;
}
function k(e) {
	let t = "";
	if (g(e)) t = e;
	else if (d(e)) for (let n = 0; n < e.length; n++) {
		let r = k(e[n]);
		r && (t += r + " ");
	}
	else if (v(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
var he = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", ge = /* @__PURE__ */ e(he);
he + "";
function _e(e) {
	return !!e || e === "";
}
function ve(e, t) {
	if (e.length !== t.length) return !1;
	let n = !0;
	for (let r = 0; n && r < e.length; r++) n = be(e[r], t[r]);
	return n;
}
function ye(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && be(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function be(e, t) {
	if (e === t) return !0;
	let n = m(e), r = m(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = _(e), r = _(t), n || r) return e === t;
	if (n = d(e), r = d(t), n || r) return n && r ? ve(e, t) : !1;
	if (n = v(e), r = v(t), n || r) {
		if (!n || !r) return !1;
		if (n = f(e), r = f(t), n || r || (n = p(e), r = p(t), n || r)) return n && r ? ye(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !be(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
var xe = (e) => !!(e && e.__v_isRef === !0), A = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? xe(e) ? A(e.value) : JSON.stringify(e, Se, 2) : String(e), Se = (e, t) => xe(t) ? Se(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[Ce(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => Ce(e)) } : _(t) ? Ce(t) : v(t) && !d(t) && !C(t) ? String(t) : t, Ce = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e, j, we = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !e && j && (j.active ? (this.parent = j, this.index = (j.scopes || (j.scopes = [])).push(this) - 1) : (this._active = !1, this._warnOnRun = !1));
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
			let t = j;
			try {
				return j = this, e();
			} finally {
				j = t;
			}
		}
	}
	on() {
		++this._on === 1 && (this.prevScope = j, j = this);
	}
	off() {
		if (this._on > 0 && --this._on === 0) {
			if (j === this) j = this.prevScope;
			else {
				let e = j;
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
	return j;
}
var M, Ee = /* @__PURE__ */ new WeakSet(), De = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, j && (j.active ? j.effects.push(this) : this.flags &= -2);
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
		this.flags |= 2, Ue(this), Pe(this);
		let e = M, t = N;
		M = this, N = !0;
		try {
			return this.fn();
		} finally {
			Fe(this), M = e, N = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Re(e);
			this.deps = this.depsTail = void 0, Ue(this), this.onStop && this.onStop(), this.flags &= -2;
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
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === We) || (e.globalVersion = We, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Ie(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = M, r = N;
	M = e, N = !0;
	try {
		Pe(e);
		let n = e.fn(e._value);
		(t.version === 0 || D(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		M = n, N = r, Fe(e), e.flags &= -3;
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
var N = !0, Be = [];
function Ve() {
	Be.push(N), N = !1;
}
function He() {
	let e = Be.pop();
	N = e === void 0 || e;
}
function Ue(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = M;
		M = void 0;
		try {
			t();
		} finally {
			M = e;
		}
	}
}
var We = 0, Ge = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, Ke = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!M || !N || M === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== M) t = this.activeLink = new Ge(M, this), M.deps ? (t.prevDep = M.depsTail, M.depsTail.nextDep = t, M.depsTail = t) : M.deps = M.depsTail = t, qe(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = M.depsTail, t.nextDep = void 0, M.depsTail.nextDep = t, M.depsTail = t, M.deps === t && (M.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, We++, this.notify(e);
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
function qe(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) qe(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var Je = /* @__PURE__ */ new WeakMap(), Ye = /* @__PURE__ */ Symbol(""), Xe = /* @__PURE__ */ Symbol(""), Ze = /* @__PURE__ */ Symbol("");
function P(e, t, n) {
	if (N && M) {
		let t = Je.get(e);
		t || Je.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new Ke()), r.map = t, r.key = n), r.track();
	}
}
function Qe(e, t, n, r, i, a) {
	let o = Je.get(e);
	if (!o) {
		We++;
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
				(n === "length" || n === Ze || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(Ze)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(Ye)), f(e) && s(o.get(Xe)));
				break;
			case "delete":
				i || (s(o.get(Ye)), f(e) && s(o.get(Xe)));
				break;
			case "set": f(e) && s(o.get(Ye));
		}
	}
	Ne();
}
function $e(e) {
	let t = /* @__PURE__ */ L(e);
	return t === e ? t : (P(t, "iterate", Ze), /* @__PURE__ */ I(e) ? t : t.map(R));
}
function et(e) {
	return P(e = /* @__PURE__ */ L(e), "iterate", Ze), e;
}
function F(e, t) {
	return /* @__PURE__ */ It(e) ? zt(/* @__PURE__ */ Ft(e) ? R(t) : t) : R(t);
}
var tt = {
	__proto__: null,
	[Symbol.iterator]() {
		return nt(this, Symbol.iterator, (e) => F(this, e));
	},
	concat(...e) {
		return $e(this).concat(...e.map((e) => d(e) ? $e(e) : e));
	},
	entries() {
		return nt(this, "entries", (e) => (e[1] = F(this, e[1]), e));
	},
	every(e, t) {
		return it(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return it(this, "filter", e, t, (e) => e.map((e) => F(this, e)), arguments);
	},
	find(e, t) {
		return it(this, "find", e, t, (e) => F(this, e), arguments);
	},
	findIndex(e, t) {
		return it(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return it(this, "findLast", e, t, (e) => F(this, e), arguments);
	},
	findLastIndex(e, t) {
		return it(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return it(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return ot(this, "includes", e);
	},
	indexOf(...e) {
		return ot(this, "indexOf", e);
	},
	join(e) {
		return $e(this).join(e);
	},
	lastIndexOf(...e) {
		return ot(this, "lastIndexOf", e);
	},
	map(e, t) {
		return it(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return st(this, "pop");
	},
	push(...e) {
		return st(this, "push", e);
	},
	reduce(e, ...t) {
		return at(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return at(this, "reduceRight", e, t);
	},
	shift() {
		return st(this, "shift");
	},
	some(e, t) {
		return it(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return st(this, "splice", e);
	},
	toReversed() {
		return $e(this).toReversed();
	},
	toSorted(e) {
		return $e(this).toSorted(e);
	},
	toSpliced(...e) {
		return $e(this).toSpliced(...e);
	},
	unshift(...e) {
		return st(this, "unshift", e);
	},
	values() {
		return nt(this, "values", (e) => F(this, e));
	}
};
function nt(e, t, n) {
	let r = et(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ I(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var rt = Array.prototype;
function it(e, t, n, r, i, a) {
	let o = et(e), s = o !== e && !/* @__PURE__ */ I(e), c = o[t];
	if (c !== rt[t]) {
		let t = c.apply(e, a);
		return s ? R(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, F(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function at(e, t, n, r) {
	let i = et(e), a = i !== e && !/* @__PURE__ */ I(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = F(e, t)), n.call(this, t, F(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? F(e, c) : c;
}
function ot(e, t, n) {
	let r = /* @__PURE__ */ L(e);
	P(r, "iterate", Ze);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Lt(n[0]) ? (n[0] = /* @__PURE__ */ L(n[0]), r[t](...n)) : i;
}
function st(e, t, n = []) {
	Ve(), Me();
	let r = (/* @__PURE__ */ L(e))[t].apply(e, n);
	return Ne(), He(), r;
}
var ct = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), lt = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function ut(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ L(this);
	return P(t, "has", e), t.hasOwnProperty(e);
}
var dt = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? kt : Ot : i ? Dt : Et).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = tt[t])) return e;
			if (t === "hasOwnProperty") return ut;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ z(e) ? e : n);
		if ((_(t) ? lt.has(t) : ct(t)) || (r || P(e, "get", t), i)) return o;
		if (/* @__PURE__ */ z(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ Nt(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ Nt(o) : /* @__PURE__ */ jt(o) : o;
	}
}, ft = class extends dt {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ It(i);
			if (!/* @__PURE__ */ I(n) && !/* @__PURE__ */ It(n) && (i = /* @__PURE__ */ L(i), n = /* @__PURE__ */ L(n)), !a && /* @__PURE__ */ z(i) && !/* @__PURE__ */ z(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ z(e) ? e : r);
		return e === /* @__PURE__ */ L(r) && s && (o ? D(n, i) && Qe(e, "set", t, n, i) : Qe(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Qe(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !lt.has(t)) && P(e, "has", t), n;
	}
	ownKeys(e) {
		return P(e, "iterate", d(e) ? "length" : Ye), Reflect.ownKeys(e);
	}
}, pt = class extends dt {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, mt = /* @__PURE__ */ new ft(), ht = /* @__PURE__ */ new pt(), gt = /* @__PURE__ */ new ft(!0), _t = (e) => e, vt = (e) => Reflect.getPrototypeOf(e);
function yt(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ L(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? _t : t ? zt : R;
		return !t && P(a, "iterate", l ? Xe : Ye), s(Object.create(u), { next() {
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
function bt(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function xt(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ L(r), a = /* @__PURE__ */ L(n);
			e || (D(n, a) && P(i, "get", n), P(i, "get", a));
			let { has: o } = vt(i), s = t ? _t : e ? zt : R;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && P(/* @__PURE__ */ L(t), "iterate", Ye), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ L(n), i = /* @__PURE__ */ L(t);
			return e || (D(t, i) && P(r, "has", t), P(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ L(a), s = t ? _t : e ? zt : R;
			return !e && P(o, "iterate", Ye), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: bt("add"),
		set: bt("set"),
		delete: bt("delete"),
		clear: bt("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ L(this), r = vt(n), i = /* @__PURE__ */ L(e), a = !t && !/* @__PURE__ */ I(e) && !/* @__PURE__ */ It(e) ? i : e;
			return r.has.call(n, a) || D(e, a) && r.has.call(n, e) || D(i, a) && r.has.call(n, i) || (n.add(a), Qe(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ I(n) && !/* @__PURE__ */ It(n) && (n = /* @__PURE__ */ L(n));
			let r = /* @__PURE__ */ L(this), { has: i, get: a } = vt(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ L(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? D(n, s) && Qe(r, "set", e, n, s) : Qe(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ L(this), { has: n, get: r } = vt(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ L(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Qe(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ L(this), t = e.size !== 0, n = e.clear();
			return t && Qe(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = yt(r, e, t);
	}), n;
}
function St(e, t) {
	let n = xt(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var Ct = { get: /* @__PURE__ */ St(!1, !1) }, wt = { get: /* @__PURE__ */ St(!1, !0) }, Tt = { get: /* @__PURE__ */ St(!0, !1) }, Et = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap(), Ot = /* @__PURE__ */ new WeakMap(), kt = /* @__PURE__ */ new WeakMap();
function At(e) {
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
function jt(e) {
	return /* @__PURE__ */ It(e) ? e : Pt(e, !1, mt, Ct, Et);
}
// @__NO_SIDE_EFFECTS__
function Mt(e) {
	return Pt(e, !1, gt, wt, Dt);
}
// @__NO_SIDE_EFFECTS__
function Nt(e) {
	return Pt(e, !0, ht, Tt, Ot);
}
function Pt(e, t, n, r, i) {
	if (!v(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = At(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function Ft(e) {
	return /* @__PURE__ */ It(e) ? /* @__PURE__ */ Ft(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function It(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function I(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Lt(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function L(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ L(t) : e;
}
function Rt(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && O(e, "__v_skip", !0), e;
}
var R = (e) => v(e) ? /* @__PURE__ */ jt(e) : e, zt = (e) => v(e) ? /* @__PURE__ */ Nt(e) : e;
// @__NO_SIDE_EFFECTS__
function z(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function B(e) {
	return Bt(e, !1);
}
function Bt(e, t) {
	return /* @__PURE__ */ z(e) ? e : new Vt(e, t);
}
var Vt = class {
	constructor(e, t) {
		this.dep = new Ke(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ L(e), this._value = t ? e : R(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ I(e) || /* @__PURE__ */ It(e);
		e = n ? e : /* @__PURE__ */ L(e), D(e, t) && (this._rawValue = e, this._value = n ? e : R(e), this.dep.trigger());
	}
};
function V(e) {
	return /* @__PURE__ */ z(e) ? e.value : e;
}
var Ht = {
	get: (e, t, n) => t === "__v_raw" ? e : V(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ z(i) && !/* @__PURE__ */ z(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Ut(e) {
	return /* @__PURE__ */ Ft(e) ? e : new Proxy(e, Ht);
}
var Wt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new Ke(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = We - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && M !== this) return je(this, !0), !0;
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
function Gt(e, t, n = !1) {
	let r, i;
	return h(e) ? r = e : (r = e.get, i = e.set), new Wt(r, i, n);
}
var Kt = {}, qt = /* @__PURE__ */ new WeakMap(), Jt = void 0;
function Yt(e, t = !1, n = Jt) {
	if (n) {
		let t = qt.get(n);
		t || qt.set(n, t = []), t.push(e);
	}
}
function Xt(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ I(e) || o === !1 || o === 0 ? Zt(e, 1) : Zt(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ z(e) ? (g = () => e.value, y = /* @__PURE__ */ I(e)) : /* @__PURE__ */ Ft(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Ft(e) || /* @__PURE__ */ I(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ z(e)) return e.value;
		if (/* @__PURE__ */ Ft(e)) return p(e);
		if (h(e)) return f ? f(e, 2) : e();
	})) : g = h(e) ? n ? f ? () => f(e, 2) : e : () => {
		if (_) {
			Ve();
			try {
				_();
			} finally {
				He();
			}
		}
		let t = Jt;
		Jt = m;
		try {
			return f ? f(e, 3, [v]) : e(v);
		} finally {
			Jt = t;
		}
	} : r, n && o) {
		let e = g, t = o === !0 ? Infinity : o;
		g = () => Zt(e(), t);
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
	let C = b ? Array(e.length).fill(Kt) : Kt, w = (e) => {
		if (m.flags & 1 && (m.dirty || e)) {
			if (n) {
				let t = m.run();
				if (e || o || y || (b ? t.some((e, t) => D(e, C[t])) : D(t, C))) {
					_ && _();
					let e = Jt;
					Jt = m;
					try {
						let e = [
							t,
							C === Kt ? void 0 : b && C[0] === Kt ? [] : C,
							v
						];
						C = t, f ? f(n, 3, e) : n(...e);
					} finally {
						Jt = e;
					}
				}
			} else m.run();
		}
	};
	return u && u(w), m = new De(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => Yt(e, !1, m), _ = m.onStop = () => {
		let e = qt.get(m);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			qt.delete(m);
		}
	}, n ? a ? w(!0) : C = m.run() : l ? l(w.bind(null, !0), !0) : m.run(), S.pause = m.pause.bind(m), S.resume = m.resume.bind(m), S.stop = S, S;
}
function Zt(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ z(e)) Zt(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) Zt(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		Zt(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) Zt(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && Zt(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
function Qt(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		$t(e, t, n);
	}
}
function H(e, t, n, r) {
	if (h(e)) {
		let i = Qt(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			$t(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(H(e[a], t, n, r));
		return i;
	}
}
function $t(e, n, r, i = !0) {
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
			Ve(), Qt(o, null, 10, [
				e,
				i,
				a
			]), He();
			return;
		}
	}
	en(e, r, a, i, s);
}
function en(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var U = [], tn = -1, nn = [], rn = null, an = 0, on = /* @__PURE__ */ Promise.resolve(), sn = null;
function cn(e) {
	let t = sn || on;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function ln(e) {
	let t = tn + 1, n = U.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = U[r], a = hn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function un(e) {
	if (!(e.flags & 1)) {
		let t = hn(e), n = U[U.length - 1];
		!n || !(e.flags & 2) && t >= hn(n) ? U.push(e) : U.splice(ln(t), 0, e), e.flags |= 1, dn();
	}
}
function dn() {
	sn ||= on.then(gn);
}
function fn(e) {
	if (!d(e)) rn && e.id === -1 ? rn.splice(an + 1, 0, e) : e.flags & 1 || (nn.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) nn.push(e[t]);
	dn();
}
function pn(e, t, n = tn + 1) {
	for (; n < U.length; n++) {
		let t = U[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			U.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
		}
	}
}
function mn(e) {
	if (nn.length) {
		let e = [...new Set(nn)].sort((e, t) => hn(e) - hn(t));
		if (nn.length = 0, rn) {
			for (let t = 0; t < e.length; t++) rn.push(e[t]);
			return;
		}
		for (rn = e, an = 0; an < rn.length; an++) {
			let e = rn[an];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		rn = null, an = 0;
	}
}
var hn = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function gn(e) {
	try {
		for (tn = 0; tn < U.length; tn++) {
			let e = U[tn];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), Qt(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; tn < U.length; tn++) {
			let e = U[tn];
			e && (e.flags &= -2);
		}
		tn = -1, U.length = 0, mn(e), sn = null, (U.length || nn.length) && gn(e);
	}
}
var W = null, _n = null;
function vn(e) {
	let t = W;
	return W = e, _n = e && e.type.__scopeId || null, t;
}
function yn(e, t = W, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && Ti(-1);
		let i = vn(t), a = Si.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = Si.length; e > a; e--) Ci();
			vn(i), r._d && Ti(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function bn(e, n) {
	if (W === null) return e;
	let r = ia(W), i = e.dirs ||= [];
	for (let e = 0; e < n.length; e++) {
		let [a, o, s, c = t] = n[e];
		a && (h(a) && (a = {
			mounted: a,
			updated: a
		}), a.deep && Zt(o), i.push({
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
function xn(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (Ve(), H(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), He());
	}
}
function Sn(e, t) {
	if ($) {
		let n = $.provides, r = $.parent && $.parent.provides;
		r === n && (n = $.provides = Object.create(r)), n[e] = t;
	}
}
function Cn(e, t, n = !1) {
	let r = Gi();
	if (r || Ar) {
		let i = Ar ? Ar._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var wn = /* @__PURE__ */ Symbol.for("v-scx"), Tn = () => Cn(wn);
function En(e, t, n) {
	return Dn(e, t, n);
}
function Dn(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (Zi) {
		if (c === "sync") {
			let e = Tn();
			f = e.__watcherHandles ||= [];
		} else if (!d) {
			let e = () => {};
			return e.stop = r, e.resume = r, e.pause = r, e;
		}
	}
	let p = $;
	u.call = (e, t, n) => H(e, p, t, n);
	let m = !1;
	c === "post" ? u.scheduler = (e) => {
		K(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : un(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Xt(e, n, u);
	return Zi && (f ? f.push(h) : d && h()), h;
}
function On(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? kn(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = Ji(this), s = Dn(i, a.bind(r), n);
	return o(), s;
}
function kn(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var An = /* @__PURE__ */ Symbol("_vte"), jn = (e) => e.__isTeleport, Mn = /* @__PURE__ */ Symbol("_leaveCb");
function Nn(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== bi) {
			t = n;
			break;
		}
	}
	return t;
}
function Pn(e) {
	if (!Un(e)) return jn(e.type) && e.children ? Nn(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Fn(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Fn(jn(n.type) && Pn(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function In(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Ln(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function Rn(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var zn = /* @__PURE__ */ new WeakMap();
function Bn(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Bn(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (Hn(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Bn(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? ia(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ L(v), b = v === t ? i : (e) => !Rn(_, e) && u(y, e), x = (e, t) => !(t && Rn(_, t));
	if (m != null && m !== p) {
		if (Vn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ z(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) Qt(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ z(p);
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
					i(), zn.delete(e);
				};
				t.id = -1, zn.set(e, t), K(t, r);
			} else Vn(e), i();
		}
	}
}
function Vn(e) {
	let t = zn.get(e);
	t && (t.flags |= 8, zn.delete(e));
}
le().requestIdleCallback, le().cancelIdleCallback;
var Hn = (e) => !!e.type.__asyncLoader, Un = (e) => e.type.__isKeepAlive;
function Wn(e, t) {
	Kn(e, "a", t);
}
function Gn(e, t) {
	Kn(e, "da", t);
}
function Kn(e, t, n = $) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Jn(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Un(e.parent.vnode) && qn(r, t, n, e), e = e.parent;
	}
}
function qn(e, t, n, r) {
	let i = Jn(t, e, r, !0);
	tr(() => {
		c(r[t], i);
	}, n);
}
function Jn(e, t, n = $, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			Ve();
			let i = Ji(n), a = H(t, n, e, r);
			return i(), He(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var Yn = (e) => (t, n = $) => {
	(!Zi || e === "sp") && Jn(e, (...e) => t(...e), n);
}, Xn = Yn("bm"), Zn = Yn("m"), Qn = Yn("bu"), $n = Yn("u"), er = Yn("bum"), tr = Yn("um"), nr = Yn("sp"), rr = Yn("rtg"), ir = Yn("rtc");
function ar(e, t = $) {
	Jn("ec", e, t);
}
var or = /* @__PURE__ */ Symbol.for("v-ndc");
function sr(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ Ft(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ I(e), s = /* @__PURE__ */ It(e), e = et(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? zt(R(e[n])) : R(e[n]) : e[n], n, void 0, a && a[n]);
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
var cr = (e) => e ? Xi(e) ? ia(e) : cr(e.parent) : null, lr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => cr(e.parent),
	$root: (e) => cr(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => vr(e),
	$forceUpdate: (e) => e.f ||= () => {
		un(e.update);
	},
	$nextTick: (e) => e.n ||= cn.bind(e.proxy),
	$watch: (e) => On.bind(e)
}), ur = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), dr = {
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
			else if (ur(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else pr && (s[n] = 0);
		}
		let d = lr[n], f, p;
		if (d) return n === "$attrs" && P(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return ur(a, n) ? (a[n] = r, !0) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) || n[0] === "$" && n.slice(1) in e ? !1 : (o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || ur(n, c) || u(o, c) || u(i, c) || u(lr, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function fr(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var pr = !0;
function mr(e) {
	let t = vr(e), n = e.proxy, i = e.ctx;
	pr = !1, t.beforeCreate && gr(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: ee, renderTracked: te, renderTriggered: ne, errorCaptured: T, serverPrefetch: re, expose: E, inheritAttrs: ie, components: ae, directives: D, filters: oe } = t;
	if (u && hr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ jt(t));
	}
	if (pr = !0, o) for (let e in o) {
		let t = o[e], a = oa({
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
	if (c) for (let e in c) _r(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			Sn(t, e[t]);
		});
	}
	f && gr(f, e, "c");
	function O(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (O(Xn, p), O(Zn, m), O(Qn, g), O($n, _), O(Wn, y), O(Gn, b), O(ar, T), O(ir, te), O(rr, ne), O(er, S), O(tr, w), O(nr, re), d(E)) {
		if (E.length) {
			let t = e.exposed ||= {};
			E.forEach((e) => {
				Object.defineProperty(t, e, {
					get: () => n[e],
					set: (t) => n[e] = t,
					enumerable: !0
				});
			});
		} else e.exposed ||= {};
	}
	ee && e.render === r && (e.render = ee), ie != null && (e.inheritAttrs = ie), ae && (e.components = ae), D && (e.directives = D), re && Ln(e);
}
function hr(e, t, n = r) {
	d(e) && (e = Cr(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? Cn(r.from || n, r.default, !0) : Cn(r.from || n) : Cn(r), /* @__PURE__ */ z(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function gr(e, t, n) {
	H(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function _r(e, t, n, r) {
	let i = r.includes(".") ? kn(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) && En(i, n);
	} else if (h(e)) En(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => _r(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) && En(i, r, e);
		}
	}
}
function vr(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => yr(c, e, o, !0)), yr(c, t, o)), v(t) && a.set(t, c), c;
}
function yr(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && yr(e, a, n, !0), i && i.forEach((t) => yr(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = br[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var br = {
	data: xr,
	props: Tr,
	emits: Tr,
	methods: wr,
	computed: wr,
	beforeCreate: G,
	created: G,
	beforeMount: G,
	mounted: G,
	beforeUpdate: G,
	updated: G,
	beforeDestroy: G,
	beforeUnmount: G,
	destroyed: G,
	unmounted: G,
	activated: G,
	deactivated: G,
	errorCaptured: G,
	serverPrefetch: G,
	components: wr,
	directives: wr,
	watch: Er,
	provide: xr,
	inject: Sr
};
function xr(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function Sr(e, t) {
	return wr(Cr(e), Cr(t));
}
function Cr(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function G(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function wr(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Tr(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), fr(e), fr(t ?? {})) : t;
}
function Er(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = G(e[r], t[r]);
	return n;
}
function Dr() {
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
var Or = 0;
function kr(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = Dr(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: Or++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: sa,
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
					let u = l._ceVNode || Mi(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, ia(u.component);
				}
			},
			onUnmount(e) {
				o.push(e);
			},
			unmount() {
				c && (H(o, l._instance, 16), e(null, l._container), delete l._container.__vue_app__);
			},
			provide(e, t) {
				return i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = Ar;
				Ar = l;
				try {
					return e();
				} finally {
					Ar = t;
				}
			}
		};
		return l;
	};
}
var Ar = null, jr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${T(t)}Modifiers`] || e[`${E(t)}Modifiers`];
function Mr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && jr(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(se)));
	let c, l = i[c = ae(n)] || i[c = ae(T(n))];
	!l && o && (l = i[c = ae(E(n))]), l && H(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, H(u, e, 6, a);
	}
}
var Nr = /* @__PURE__ */ new WeakMap();
function Pr(e, t, n = !1) {
	let r = n ? Nr : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Pr(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Fr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, E(t)) || u(e, t));
}
function Ir(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = vn(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = Li(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = Li(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Lr(c);
		}
	} catch (t) {
		Si.length = 0, $t(t, e, 1), v = Mi(bi);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Rr(y, a)), b = Fi(b, y, !1, !0));
	}
	return n.dirs && (b = Fi(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Fn(jn(b.type) && Pn(b) || b, n.transition), v = b, vn(_), v;
}
var Lr = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Rr = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function zr(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Br(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Vr(o, r, n) && !Fr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Br(r, o, l) : !!o;
	return !1;
}
function Br(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (Vr(t, e, a) && !Fr(n, a)) return !0;
	}
	return !1;
}
function Vr(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !be(r, i) : r !== i;
}
function Hr({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Ur = {}, Wr = () => Object.create(Ur), Gr = (e) => Object.getPrototypeOf(e) === Ur;
function Kr(e, t, n, r = !1) {
	let i = {}, a = Wr();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), Jr(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ Mt(i) : e.type.props ? i : a, e.attrs = a;
}
function qr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ L(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Fr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = T(o);
						i[t] = Yr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		Jr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = E(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Yr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Qe(e.attrs, "set", "");
}
function Jr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (ee(t)) continue;
		let l = n[t], d;
		a && u(a, d = T(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Fr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ L(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = Yr(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function Yr(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = Ji(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === E(n)) && (r = !0));
	}
	return r;
}
var Xr = /* @__PURE__ */ new WeakMap();
function Zr(e, r, i = !1) {
	let a = i ? Xr : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = Zr(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = T(c[e]);
		Qr(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = T(e);
		if (Qr(t)) {
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
function Qr(e) {
	return e[0] !== "$" && !ee(e);
}
var $r = (e) => e === "_" || e === "_ctx" || e === "$stable", ei = (e) => d(e) ? e.map(Li) : [Li(e)], ti = (e, t, n) => {
	if (t._n) return t;
	let r = yn((...e) => ei(t(...e)), n);
	return r._c = !1, r;
}, ni = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if ($r(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = ti(n, i, r);
		else if (i != null) {
			let e = ei(i);
			t[n] = () => e;
		}
	}
}, ri = (e, t) => {
	let n = ei(t);
	e.slots.default = () => n;
}, ii = (e, t, n) => {
	for (let r in t) (n || !$r(r)) && (e[r] = t[r]);
}, ai = (e, t, n) => {
	let r = e.slots = Wr();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (ii(r, t, n), n && O(r, "_", e, !0)) : ni(t, r);
	} else t && ri(e, t);
}, oi = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : ii(a, n, r) : (o = !n.$stable, ni(n, a)), s = n;
	} else n && (ri(e, n), s = { default: 1 });
	if (o) for (let e in a) !$r(e) && s[e] == null && delete a[e];
}, K = vi;
function si(e) {
	return ci(e);
}
function ci(e, i) {
	let a = le();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !ki(e, t) && (r = ye(e), k(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case yi:
				y(e, t, n, r);
				break;
			case bi:
				b(e, t, n, r);
				break;
			case xi:
				e ?? x(t, n, r, o);
				break;
			case q:
				ae(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? D(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, A);
		}
		u != null && i ? Bn(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Bn(e.ref, null, a, e, !0);
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
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) te(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), re(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, te = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && T(e.children, d, null, r, i, li(e, a), s, u), _ && xn(e, null, r, "created"), ne(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !ee(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Vi(f, r, e);
		}
		_ && xn(e, null, r, "beforeMount");
		let v = di(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && K(() => {
			try {
				f && Vi(f, r, e), v && g.enter(d), _ && xn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, ne = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || _i(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				ne(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, T = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? Ri(e[l]) : Li(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, re = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && ui(r, !1), (g = h.onVnodeBeforeUpdate) && Vi(g, r, n, e), f && xn(n, e, r, "beforeUpdate"), r && ui(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? E(e.dynamicChildren, d, l, r, i, li(n, a), o) : s || de(e, n, l, null, r, i, li(n, a), o, !1), u > 0) {
			if (u & 16) ie(l, m, h, r, a);
			else if (u & 2 && m.class !== h.class && c(l, "class", null, h.class, a), u & 4 && c(l, "style", m.style, h.style, a), u & 8) {
				let e = n.dynamicProps;
				for (let t = 0; t < e.length; t++) {
					let n = e[t], i = m[n], o = h[n];
					(o !== i || n === "value") && c(l, n, i, o, a, r);
				}
			}
			u & 1 && e.children !== n.children && p(l, n.children);
		} else !s && d == null && ie(l, m, h, r, a);
		((g = h.onVnodeUpdated) || f) && K(() => {
			g && Vi(g, r, n, e), f && xn(n, e, r, "updated");
		}, i);
	}, E = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === q || !ki(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, ie = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !ee(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (ee(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, ae = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), T(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (E(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && fi(e, t, !0)) : de(e, t, n, f, i, a, s, c, l);
	}, D = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : O(t, n, r, i, a, o, c) : se(e, t, c);
	}, O = (e, t, n, r, i, a, o) => {
		let s = e.component = Wi(e, r, i);
		if (Un(e) && (s.ctx.renderer = A), Qi(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, ce, o), !e.el) {
				let r = s.subTree = Mi(bi);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else ce(s, e, t, n, i, a, o);
	}, se = (e, t, n) => {
		let r = t.component = e.component;
		if (zr(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				ue(r, t, n);
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, r.vnode = t;
	}, ce = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = mi(e);
					if (n) {
						t && (t.el = c.el, ue(e, t, o)), n.asyncDep.then(() => {
							K(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				ui(e, !1), t ? (t.el = c.el, ue(e, t, o)) : t = c, n && oe(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Vi(d, s, t, c), ui(e, !0);
				let f = Ir(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), ye(p), e, i, a), t.el = f.el, u === null && Hr(e, f.el), r && K(r, i), (d = t.props && t.props.onVnodeUpdated) && K(() => Vi(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Hn(t);
				if (ui(e, !1), l && oe(l), !m && (o = c && c.onVnodeBeforeMount) && Vi(o, d, t), ui(e, !0), s && Ce) {
					let t = () => {
						e.subTree = Ir(e), Ce(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Ir(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && K(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					K(() => Vi(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Hn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && K(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new De(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => un(u), ui(e, !0), l();
	}, ue = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, qr(e, t.props, r, n), oi(e, t.children, n), Ve(), pn(e), He();
	}, de = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, u = e ? e.shapeFlag : 0, d = t.children, { patchFlag: f, shapeFlag: m } = t;
		if (f > 0) {
			if (f & 128) {
				pe(l, d, n, r, i, a, o, s, c);
				return;
			}
			if (f & 256) {
				fe(l, d, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (u & 16 && ve(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? pe(l, d, n, r, i, a, o, s, c) : ve(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && T(d, n, r, i, a, o, s, c));
	}, fe = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? Ri(t[p]) : Li(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? ve(e, a, o, !0, !1, f) : T(t, r, i, a, o, s, c, l, f);
	}, pe = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? Ri(t[u]) : Li(t[u]);
			if (ki(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? Ri(t[p]) : Li(t[p]);
			if (ki(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? Ri(t[u]) : Li(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) k(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? Ri(t[u]) : Li(t[u]);
				e.key != null && g.set(e.key, u);
			}
			let _, y = 0, b = p - h + 1, x = !1, S = 0, C = Array(b);
			for (u = 0; u < b; u++) C[u] = 0;
			for (u = m; u <= f; u++) {
				let n = e[u];
				if (y >= b) {
					k(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && ki(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? k(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? pi(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || gi(f) : i;
				C[u] === 0 ? v(null, n, r, p, a, o, s, c, l) : x && (_ < 0 || u !== w[_] ? me(n, r, p, 2) : _--);
			}
		}
	}, me = (e, t, n, r, i = null) => {
		let { el: a, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) {
			me(e.component.subTree, t, n, r);
			return;
		}
		if (d & 128) {
			e.suspense.move(t, n, r);
			return;
		}
		if (d & 64) {
			c.move(e, t, n, A);
			return;
		}
		if (c === q) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) me(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === xi) {
			S(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[Mn] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), K(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[Mn];
					a._isLeaving && a[Mn](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, k = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (Ve(), Bn(s, null, n, e, !0), He()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Hn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Vi(_, t, e), u & 6) _e(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && xn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, A, r) : l && !l.hasOnce && (a !== q || d > 0 && d & 64) ? ve(l, t, n, !1, !0) : (a === q && d & 384 || !i && u & 16) && ve(c, t, n), r && he(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && K(() => {
			_ && Vi(_, t, e), h && xn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, he = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === q) {
			ge(n, r);
			return;
		}
		if (t === xi) {
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
	}, ge = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, _e = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		hi(c), hi(l), r && oe(r), i.stop(), a && (a.flags |= 8, k(o, e, t, n)), s && K(s, t), K(() => {
			e.isUnmounted = !0;
		}, t);
	}, ve = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) k(e[o], t, n, r, i);
	}, ye = (e) => {
		if (e.shapeFlag & 6) return ye(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[An];
		return n ? h(n) : t;
	}, be = !1, xe = (e, t, n) => {
		let r;
		e == null ? t._vnode && (k(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, be ||= (be = !0, pn(r), mn(), !1);
	}, A = {
		p: v,
		um: k,
		m: me,
		r: he,
		mt: O,
		mc: T,
		pc: de,
		pbc: E,
		n: ye,
		o: e
	}, Se, Ce;
	return i && ([Se, Ce] = i(A)), {
		render: xe,
		hydrate: Se,
		createApp: kr(xe, Se)
	};
}
function li({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function ui({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function di(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function fi(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = Ri(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && fi(t, a)), a.type === yi && (a.patchFlag === -1 && (a = i[e] = Ri(a)), a.el = t.el), a.type === bi && !a.el && (a.el = t.el);
	}
}
function pi(e) {
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
function mi(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : mi(t);
}
function hi(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function gi(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? gi(t.subTree) : null;
}
var _i = (e) => e.__isSuspense;
function vi(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : fn(e);
}
var q = /* @__PURE__ */ Symbol.for("v-fgt"), yi = /* @__PURE__ */ Symbol.for("v-txt"), bi = /* @__PURE__ */ Symbol.for("v-cmt"), xi = /* @__PURE__ */ Symbol.for("v-stc"), Si = [], J = null;
function Y(e = !1) {
	Si.push(J = e ? null : []);
}
function Ci() {
	Si.pop(), J = Si[Si.length - 1] || null;
}
var wi = 1;
function Ti(e, t = !1) {
	wi += e, e < 0 && J && t && (J.hasOnce = !0);
}
function Ei(e) {
	return e.dynamicChildren = wi > 0 ? J || n : null, Ci(), wi > 0 && J && J.push(e), e;
}
function X(e, t, n, r, i, a) {
	return Ei(Z(e, t, n, r, i, a, !0));
}
function Di(e, t, n, r, i) {
	return Ei(Mi(e, t, n, r, i, !0));
}
function Oi(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function ki(e, t) {
	return e.type === t.type && e.key === t.key;
}
var Ai = ({ key: e }) => e ?? null, ji = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ z(e) || h(e) ? {
	i: W,
	r: e,
	k: t,
	f: !!n
} : e);
function Z(e, t = null, n = null, r = 0, i = null, a = e === q ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && Ai(t),
		ref: t && ji(t),
		scopeId: _n,
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
		ctx: W
	};
	return s ? (zi(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), wi > 0 && !o && J && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && J.push(c), c;
}
var Mi = Ni;
function Ni(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === or) && (e = bi), Oi(e)) {
		let r = Fi(e, t, !0);
		return n && zi(r, n), wi > 0 && !a && J && (r.shapeFlag & 6 ? J[J.indexOf(e)] = r : J.push(r)), r.patchFlag = -2, r;
	}
	if (aa(e) && (e = e.__vccOpts), t) {
		t = Pi(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = k(e)), v(n) && (/* @__PURE__ */ Lt(n) && !d(n) && (n = s({}, n)), t.style = ue(n));
	}
	let o = g(e) ? 1 : _i(e) ? 128 : jn(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return Z(e, t, n, r, i, o, a, !0);
}
function Pi(e) {
	return e ? /* @__PURE__ */ Lt(e) || Gr(e) ? s({}, e) : e : null;
}
function Fi(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? Bi(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && Ai(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(ji(t)) : [a, ji(t)] : ji(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== q ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && Fi(e.ssContent),
		ssFallback: e.ssFallback && Fi(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && Fn(u, c.clone(u)), u;
}
function Ii(e = " ", t = 0) {
	return Mi(yi, null, e, t);
}
function Q(e = "", t = !1) {
	return t ? (Y(), Di(bi, null, e)) : Mi(bi, null, e);
}
function Li(e) {
	return e == null || typeof e == "boolean" ? Mi(bi) : d(e) ? Mi(q, null, e.slice()) : Oi(e) ? Ri(e) : Mi(yi, null, String(e));
}
function Ri(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : Fi(e);
}
function zi(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), zi(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !Gr(t) ? t._ctx = W : r === 3 && W && (W.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			zi(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: W
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Ii(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function Bi(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = k([t.class, r.class]));
		else if (e === "style") t.style = ue([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function Vi(e, t, n, r = null) {
	H(e, t, 7, [n, r]);
}
var Hi = Dr(), Ui = 0;
function Wi(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || Hi, o = {
		uid: Ui++,
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
		propsOptions: Zr(i, a),
		emitsOptions: Pr(i, a),
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
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = Mr.bind(null, o), e.ce && e.ce(o), o;
}
var $ = null, Gi = () => $ || W, Ki, qi;
{
	let e = le(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	Ki = t("__VUE_INSTANCE_SETTERS__", (e) => $ = e), qi = t("__VUE_SSR_SETTERS__", (e) => Zi = e);
}
var Ji = (e) => {
	let t = $;
	return Ki(e), e.scope.on(), () => {
		e.scope.off(), Ki(t);
	};
}, Yi = () => {
	$ && $.scope.off(), Ki(null);
};
function Xi(e) {
	return e.vnode.shapeFlag & 4;
}
var Zi = !1;
function Qi(e, t = !1, n = !1) {
	t && qi(t);
	let { props: r, children: i } = e.vnode, a = Xi(e);
	Kr(e, r, a, t), ai(e, i, n || t);
	let o = a ? $i(e, t) : void 0;
	return t && qi(!1), o;
}
function $i(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, dr);
	let { setup: r } = n;
	if (r) {
		Ve();
		let n = e.setupContext = r.length > 1 ? ra(e) : null, i = Ji(e), a = Qt(r, e, 0, [e.props, n]), o = y(a);
		if (He(), i(), (o || e.sp) && !Hn(e) && Ln(e), o) {
			if (a.then(Yi, Yi), t) return a.then((n) => {
				qi(!0);
				try {
					ea(e, n, t);
				} finally {
					qi(!1);
				}
			}).catch((t) => {
				$t(t, e, 0);
			});
			e.asyncDep = a;
		} else ea(e, a, t);
	} else ta(e, t);
}
function ea(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Ut(t)), ta(e, n);
}
function ta(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = Ji(e);
		Ve();
		try {
			mr(e);
		} finally {
			He(), t();
		}
	}
}
var na = { get(e, t) {
	return P(e, "get", ""), e[t];
} };
function ra(e) {
	return {
		attrs: new Proxy(e.attrs, na),
		slots: e.slots,
		emit: e.emit,
		expose: (t) => {
			e.exposed = t || {};
		}
	};
}
function ia(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(Ut(Rt(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in lr) return lr[n](e);
		},
		has(e, t) {
			return t in e || t in lr;
		}
	}) : e.proxy;
}
function aa(e) {
	return h(e) && "__vccOpts" in e;
}
var oa = (e, t) => /* @__PURE__ */ Gt(e, t, Zi), sa = "3.5.42", ca = void 0, la = typeof window < "u" && window.trustedTypes;
if (la) try {
	ca = /* @__PURE__ */ la.createPolicy("vue", { createHTML: (e) => e });
} catch {}
var ua = ca ? (e) => ca.createHTML(e) : (e) => e, da = "http://www.w3.org/2000/svg", fa = "http://www.w3.org/1998/Math/MathML", pa = typeof document < "u" ? document : null, ma = pa && /* @__PURE__ */ pa.createElement("template"), ha = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? pa.createElementNS(da, e) : t === "mathml" ? pa.createElementNS(fa, e) : n ? pa.createElement(e, { is: n }) : pa.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => pa.createTextNode(e),
	createComment: (e) => pa.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => pa.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			ma.innerHTML = ua(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = ma.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, ga = /* @__PURE__ */ Symbol("_vtc");
function _a(e, t, n) {
	let r = e[ga];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var va = /* @__PURE__ */ Symbol("_vod"), ya = /* @__PURE__ */ Symbol("_vsh"), ba = /* @__PURE__ */ Symbol(""), xa = /(?:^|;)\s*display\s*:/;
function Sa(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? wa(r, t, "");
			}
			else for (let e in t) n[e] ?? wa(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? wa(r, i, "") : Oa(e, i, !g(t) && t ? t[i] : void 0, o) || wa(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[ba];
			e && (n += ";" + e), r.cssText = n, a = xa.test(n);
		}
	} else t && e.removeAttribute("style");
	va in e && (e[va] = a ? r.display : "", e[ya] && (r.display = "none"));
}
var Ca = /\s*!important$/;
function wa(e, t, n) {
	if (d(n)) n.forEach((n) => wa(e, t, n));
	else if (n ??= "", t.startsWith("--")) Ca.test(n) ? e.setProperty(t, n.replace(Ca, ""), "important") : e.setProperty(t, n);
	else {
		let r = Da(e, t);
		Ca.test(n) ? e.setProperty(E(r), n.replace(Ca, ""), "important") : e[r] = n;
	}
}
var Ta = [
	"Webkit",
	"Moz",
	"ms"
], Ea = {};
function Da(e, t) {
	let n = Ea[t];
	if (n) return n;
	let r = T(t);
	if (r !== "filter" && r in e) return Ea[t] = r;
	r = ie(r);
	for (let n = 0; n < Ta.length; n++) {
		let i = Ta[n] + r;
		if (i in e) return Ea[t] = i;
	}
	return t;
}
function Oa(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var ka = "http://www.w3.org/1999/xlink";
function Aa(e, t, n, r, i, a = ge(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(ka, t.slice(6, t.length)) : e.setAttributeNS(ka, t, n) : n == null || a && !_e(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function ja(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? ua(n) : n);
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
		r === "boolean" ? n = _e(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch {}
	o && e.removeAttribute(i || t);
}
function Ma(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function Na(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var Pa = /* @__PURE__ */ Symbol("_vei");
function Fa(e, t, n, r, i = null) {
	let a = e[Pa] || (e[Pa] = {}), o = a[t];
	if (r && o) o.value = r;
	else {
		let [n, s] = Ra(t);
		r ? Ma(e, n, a[t] = Ha(r, i), s) : o && (Na(e, n, o, s), a[t] = void 0);
	}
}
var Ia = /(Once|Passive|Capture)$/, La = /^on:?(?:Once|Passive|Capture)$/;
function Ra(e) {
	let t, n;
	for (; (n = e.match(Ia)) && !La.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : E(e.slice(2)), t];
}
var za = 0, Ba = /* @__PURE__ */ Promise.resolve(), Va = () => za ||= (Ba.then(() => za = 0), Date.now());
function Ha(e, t) {
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
				e && H(e, t, 5, a);
			}
		} else H(r, t, 5, [e]);
	};
	return n.value = e, n.attached = Va(), n;
}
var Ua = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Wa = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? _a(e, r, c) : t === "style" ? Sa(e, n, r) : a(t) ? o(t) || Fa(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Ga(e, t, r, c)) ? (ja(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Aa(e, t, r, c, s, t !== "value")) : e._isVueCE && (Ka(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? ja(e, T(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), Aa(e, t, r, c));
};
function Ga(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && Ua(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return Ua(t) && g(n) ? !1 : t in e;
}
function Ka(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = T(t);
	return Array.isArray(n) ? n.some((e) => T(e) === r) : Object.keys(n).some((e) => T(e) === r);
}
var qa = /* @__PURE__ */ s({ patchProp: Wa }, ha), Ja;
function Ya() {
	return Ja ||= si(qa);
}
var Xa = ((...e) => {
	let t = Ya().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = Qa(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, Za(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function Za(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function Qa(e) {
	return g(e) ? document.querySelector(e) : e;
}
//#endregion
//#region src/credentials.ts
var $a = (e) => {
	let t = e;
	for (let e of [
		t?.code,
		t?.data?.code,
		t?.data?.error,
		t?.message
	]) if (typeof e == "string" && /^[a-z][a-z0-9_]{0,63}$/.test(e)) return e;
	return "credential_request_failed";
};
function eo(e, t) {
	let n = /* @__PURE__ */ B({}), r = /* @__PURE__ */ B(!1), i = /* @__PURE__ */ B(!1), a = /* @__PURE__ */ B(0), o = /* @__PURE__ */ B(null), s = /* @__PURE__ */ new Map(), c = "", l = 0, u = new AbortController(), d, f, p = (e, t) => ({
		...e,
		inputValue: t?.inputValue || "",
		visible: t?.visible || !1,
		loading: !1,
		localError: t?.localError || "",
		localRevision: t?.localRevision || 0
	}), m = (e) => l === e && !u.signal.aborted, h = (e) => t($a(e));
	async function g(t = l) {
		let r = await e.api.post("credentials/editors/state", { editorSessionId: c }, u.signal);
		m(t) && (n.value = Object.fromEntries(Object.entries(r.fields).map(([e, t]) => [e, p(t, n.value[e])])));
	}
	function _() {
		l++, u.abort(), u = new AbortController(), d && clearInterval(d), f && clearTimeout(f);
		let t = c;
		c = "", i.value = !1, a.value = 0, n.value = {}, o.value = null, s.clear(), t && e.api.delete("credentials/editors", { editorSessionId: t }).catch(() => {});
	}
	async function v(t) {
		_();
		let a = l;
		try {
			let o = await e.clientSessions.get();
			if (!m(a)) return;
			r.value = o.nativeBrowserAvailable;
			let s = await e.api.post("credentials/editors", { taskId: t }, u.signal);
			if (!m(a)) {
				e.api.delete("credentials/editors", { editorSessionId: s.editorSessionId }).catch(() => {});
				return;
			}
			c = s.editorSessionId, n.value = Object.fromEntries(Object.entries(s.fields).map(([e, t]) => [e, p(t)])), i.value = !0;
			for (let [e, t] of Object.entries(n.value)) t.configured && t.source === "manual" && !t.error && y(e, !1);
			d = setInterval(() => {
				e.api.post("credentials/lease", { editorSessionId: c }, u.signal).catch((e) => {
					m(a) && h(e);
				});
			}, 6e4);
		} catch (e) {
			m(a) && h(e);
		}
	}
	async function y(t, r) {
		let a = l, s = n.value[t];
		if (!s || !i.value || (await C(), !m(a) || n.value[t] !== s || s.localError)) return;
		let d = s.fieldGeneration;
		s.loading = !0, s.localError = "";
		try {
			let i = await e.api.post("tasks/credential/read", {
				editorSessionId: c,
				platform: t,
				fieldGeneration: d
			}, u.signal);
			if (!m(a) || n.value[t] !== s || s.fieldGeneration !== d) return;
			if (i.platform !== t || i.fieldGeneration !== d || typeof i.configured != "boolean" || (i.configured ? typeof i.value != "string" : i.value !== null)) throw Error("credential_read_failed");
			s.inputValue = i.value || "", s.visible = r, s.source === "browser" && typeof i.revealRemainingSeconds == "number" && (f && clearTimeout(f), f = setTimeout(() => {
				for (let e of Object.values(n.value)) e.source === "browser" && (e.visible = !1, e.inputValue = "");
			}, Math.max(0, i.revealRemainingSeconds * 1e3)));
		} catch (e) {
			m(a) && n.value[t] === s && (s.visible = !1, $a(e) === "reveal_confirmation_required" ? o.value = t : s.localError = $a(e));
		} finally {
			m(a) && n.value[t] === s && (s.loading = !1);
		}
	}
	function b(t, r, o = !1) {
		let d = n.value[t];
		if (!d || !i.value) return;
		r || (o = !0), o || (d.inputValue = r);
		let f = ++d.localRevision, p = l, g = c;
		a.value++;
		let _ = (s.get(t) || Promise.resolve()).then(async () => {
			if (!m(p)) return;
			if (d.localError) throw Error("credential_draft_unconfirmed");
			let i = await e.api.put("credentials/draft", {
				editorSessionId: g,
				platform: t,
				expectedFieldGeneration: d.fieldGeneration,
				mutation: o ? "clear" : d.source === "browser" ? "edit-current" : "set-manual",
				...o ? {} : { value: r }
			}, u.signal);
			m(p) && n.value[t] === d && (Object.assign(d, i), o && d.localRevision === f && (d.inputValue = "", d.visible = !1));
		}).catch(async (e) => {
			m(p) && (d.localError = $a(e), h(e));
		}).finally(() => {
			m(p) && a.value--;
		});
		s.set(t, _);
	}
	async function x(e) {
		let t = n.value[e];
		if (t) {
			if (t.localError) {
				await C(), await g();
				let t = n.value[e];
				t && (t.localError = "");
			}
			b(e, "", !0);
		}
	}
	async function S(e) {
		let t = n.value[e];
		t && (t.localError = "", await y(e, t.visible));
	}
	async function C() {
		await Promise.all([...s.values()]);
	}
	async function w(e) {
		let t = n.value[e];
		if (t && i.value) {
			if (t.visible) {
				if (await C(), t.localError) return;
				t.visible = !1, t.source === "browser" && (t.inputValue = "");
			} else t.source === "browser" ? await y(e, !0) : t.visible = !0;
		}
	}
	async function ee() {
		let t = o.value, r = l;
		if (t) {
			o.value = null;
			try {
				let i = await e.api.post("tasks/credential/reveal/confirm", { confirm: !0 }, u.signal);
				if (!m(r)) return;
				f && clearTimeout(f), f = setTimeout(() => {
					for (let e of Object.values(n.value)) e.source === "browser" && (e.visible = !1, e.inputValue = "");
				}, Math.max(0, Date.parse(i.expiresAt) - Date.now())), await y(t, !0);
			} catch (e) {
				m(r) && h(e);
			}
		}
	}
	async function te(t) {
		let i = l, a = n.value[t];
		if (!a || !r.value || (await C(), a.localError || !m(i))) return;
		let o = !1, s = (e) => {
			o || (o = !0, h(e));
		};
		a.loading = !0;
		try {
			let r = await e.api.post("credentials/login/prepare", {
				editorSessionId: c,
				platform: t,
				expectedFieldGeneration: a.fieldGeneration
			}, u.signal);
			if (!m(i)) return;
			a.fieldGeneration = r.fieldGeneration;
			let o = await (await e.browserLogin.open(r, u.signal)).completed;
			if (!m(i)) return;
			let l = !o.success && ["browser_operation_cancelled", "credential_editor_closed"].includes(o.error || "");
			!o.success && !l && s(Error(o.error || "browser_validation_failed"));
			try {
				await g(i);
			} catch (e) {
				if (!l) throw e;
			}
			if (o.success) {
				let e = n.value[t];
				e.visible = !1, e.inputValue = "";
			}
		} catch (e) {
			m(i) && !(e instanceof DOMException && e.name === "AbortError") && s(e);
		} finally {
			if (m(i)) {
				a.loading = !1;
				let e = n.value[t];
				e && (e.loading = !1);
			}
		}
	}
	async function ne() {
		return await C(), !i.value || Object.values(n.value).some((e) => e.localError || e.error || e.loading) ? null : {
			editorSessionId: c,
			secrets: Object.fromEntries(Object.entries(n.value).map(([e, t]) => [e, {
				action: t.intent,
				fieldGeneration: t.fieldGeneration,
				...t.intent === "set" ? t.candidateId ? { candidateId: t.candidateId } : { value: t.inputValue } : {}
			}]))
		};
	}
	return {
		fields: n,
		native: r,
		ready: i,
		busy: a,
		confirmation: o,
		open: v,
		close: _,
		read: y,
		retry: S,
		mutate: b,
		clear: x,
		visibility: w,
		confirm: ee,
		login: te,
		payload: ne
	};
}
//#endregion
//#region src/CheckInTaskEditor.vue?vue&type=script&setup=true&lang.ts
var to = [
	"open",
	"title",
	"aria-label",
	"close-label"
], no = {
	key: 0,
	class: "gci-editor",
	"data-task-editor": ""
}, ro = { class: "gci-editor-section" }, io = { class: "gci-form-grid" }, ao = ["label"], oo = [
	"model-value",
	"aria-invalid",
	"aria-label"
], so = ["label"], co = ["model-value", "aria-label"], lo = [
	"model-value",
	"label",
	"description",
	"aria-label"
], uo = [
	"title",
	"description",
	"expanded"
], fo = { class: "gci-checkin-fields" }, po = { class: "gci-platform-list" }, mo = ["label", "help"], ho = [
	"id",
	"model-value",
	"options",
	"disabled",
	"placeholder",
	"aria-label",
	"onChange"
], go = { class: "gci-credential-list" }, _o = ["label", "help"], vo = { class: "gci-credential-input-row" }, yo = [
	"id",
	"model-value",
	"password-visible",
	"secret-configured",
	"readonly",
	"show-password-label",
	"hide-password-label",
	"disabled",
	"placeholder",
	"aria-label",
	"onPasswordVisibilityRequest"
], bo = [
	"label",
	"aria-label",
	"disabled",
	"onClick"
], xo = [
	"id",
	"label",
	"aria-label",
	"disabled",
	"onClick"
], So = {
	key: 0,
	role: "alert"
}, Co = [
	"disabled",
	"label",
	"onClick"
], wo = {
	key: 2,
	role: "status"
}, To = { class: "gci-notification-settings" }, Eo = [
	"model-value",
	"label",
	"description",
	"aria-label"
], Do = ["label", "help"], Oo = ["model-value", "aria-label"], ko = { class: "gci-schedules" }, Ao = { class: "gci-section-heading" }, jo = ["aria-label"], Mo = [
	"item-id",
	"data-dnd-id",
	"panel-id",
	"summary-label",
	"summary-meta",
	"days-label",
	"days-aria-label",
	"time-label",
	"expanded",
	"drag-label",
	"drag-title",
	"onToggle"
], No = [
	"aria-pressed",
	"aria-label",
	"title",
	"onClick"
], Po = [
	"id",
	"model-value",
	"aria-label",
	"onChange"
], Fo = [
	"model-value",
	"aria-label",
	"onChange"
], Io = ["label", "onClick"], Lo = {
	key: 1,
	class: "gci-empty-schedules"
}, Ro = ["label", "disabled"], zo = {
	key: 0,
	class: "gci-error",
	role: "alert"
}, Bo = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, Vo = [
	"label",
	"busy",
	"disabled"
], Ho = ["label", "disabled"], Uo = ["title", "close-label"], Wo = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, Go = ["label"], Ko = ["label"], qo = /* @__PURE__ */ In({
	__name: "CheckInTaskEditor",
	props: {
		open: { type: Boolean },
		task: {},
		tasks: {},
		platforms: {},
		timeZoneId: {},
		submitting: { type: Boolean },
		error: {},
		nameError: {},
		translate: { type: Function },
		host: {}
	},
	emits: [
		"close",
		"save",
		"invalid",
		"nameChange"
	],
	setup(e, { emit: t }) {
		let n = e, r = t, i = /* @__PURE__ */ B(null), a = eo(n.host, (e) => {
			n.open && n.host.ui?.toast(b(`error.${e}`, {}, "凭据操作未完成，请检查后重试。"), "error");
		}), { fields: o, native: s, ready: c, confirmation: l } = a, u = /* @__PURE__ */ new WeakMap(), d = {
			mounted(e, t) {
				let n = (e) => se(t.value, String(x(e) || ""));
				u.set(e, n), e.addEventListener("update:modelValue", n);
			},
			unmounted(e) {
				let t = u.get(e);
				t && e.removeEventListener("update:modelValue", t), u.delete(e);
			}
		}, f = /* @__PURE__ */ B(!0), p = /* @__PURE__ */ B([]), m = /* @__PURE__ */ B(""), h = /* @__PURE__ */ B(""), g = 0, _ = oa(() => [
			b("day.0", {}, "周日"),
			b("day.1", {}, "周一"),
			b("day.2", {}, "周二"),
			b("day.3", {}, "周三"),
			b("day.4", {}, "周四"),
			b("day.5", {}, "周五"),
			b("day.6", {}, "周六")
		]), v = oa(() => [
			b("common.sun", {}, "日"),
			b("common.mon", {}, "一"),
			b("common.tue", {}, "二"),
			b("common.wed", {}, "三"),
			b("common.thu", {}, "四"),
			b("common.fri", {}, "五"),
			b("common.sat", {}, "六")
		]);
		En(() => `${n.open}:${n.task?.id || "new"}`, () => {
			n.open ? S() : y();
		}, { immediate: !0 });
		function y() {
			a.close(), i.value = null;
		}
		er(y);
		function b(e, t = {}, r = "") {
			return n.translate(e, t, r);
		}
		function x(e) {
			let t = e.detail;
			return Array.isArray(t) && t.length ? t[0] : t === void 0 ? e.target?.modelValue : t;
		}
		function S() {
			y();
			let e = n.task;
			i.value = e ? {
				id: e.id,
				name: e.name,
				remark: e.remark || "",
				enabled: e.enabled,
				games: Object.fromEntries(Object.entries(e.games || {}).map(([e, t]) => [e, [...t]])),
				schedules: (e.schedules || []).map((e) => ({
					...e,
					days: [...e.days]
				})),
				notification: {
					enabled: e.notification?.enabled === !0,
					smtpTo: e.notification?.smtpTo || ""
				}
			} : {
				name: "",
				remark: "",
				enabled: !0,
				games: {},
				schedules: [],
				notification: {
					enabled: !1,
					smtpTo: ""
				}
			}, a.open(e?.id), f.value = !0, m.value = "", h.value = "", p.value = [];
		}
		function C(e, t) {
			i.value && (i.value[e] = t), e === "name" && (h.value = "", m.value = "", r("nameChange"));
		}
		function w(e, t) {
			if (!i.value) return;
			let n = x(t), r = Array.isArray(n) ? n.map(String) : [];
			r.length ? i.value.games[e] = r : delete i.value.games[e];
		}
		function ee(e) {
			return b(`field.${e}_games_description`, {}, "可留空。");
		}
		function te(e) {
			return e === "cn" ? "cnCookie" : e === "os" ? "osCookie" : e === "skland" ? "sklandToken" : e === "skport" ? "skportToken" : e === "kuro" ? "kuroToken" : e;
		}
		function ne(e) {
			return b(`field.${te(e)}_description`, {}, "填写该平台凭据。");
		}
		function T(e) {
			return b(`field.${te(e)}_placeholder`, {}, "");
		}
		function re(e) {
			let t = o.value[e];
			return t?.intent === "set" ? b("field.secret_set_pending", {}, "新凭据待保存") : t?.configured ? [t.maskedAccount, b("field.secret_configured", {}, "已配置，点击眼睛显示")].filter(Boolean).join(" · ") : T(e);
		}
		function E() {
			if (!i.value || i.value.schedules.length >= 30) return;
			let e = globalThis.crypto?.randomUUID, t = typeof e == "function" ? e.call(globalThis.crypto) : `draft-${Date.now().toString(36)}-${(++g).toString(36)}`, n = {
				id: t,
				days: [
					1,
					2,
					3,
					4,
					5
				],
				enabled: !0,
				time: "09:00"
			};
			i.value.schedules.push(n), p.value = [...p.value, t];
		}
		function ie(e) {
			if (!i.value) return;
			let [t] = i.value.schedules.splice(e, 1);
			t && (p.value = p.value.filter((e) => e !== t.id));
		}
		function ae(e) {
			return p.value.includes(e);
		}
		function D(e) {
			p.value = ae(e) ? p.value.filter((t) => t !== e) : [...p.value, e];
		}
		function oe(e, t) {
			e.days = e.days.includes(t) ? e.days.filter((e) => e !== t) : [...e.days, t].sort((e, t) => e - t);
		}
		function O(e) {
			if (!i.value) return;
			let t = i.value.schedules.map((e) => e.id);
			if (e.length !== t.length || new Set(e).size !== t.length || e.some((e) => !t.includes(e)) || e.every((e, n) => e === t[n])) return;
			let n = new Map(i.value.schedules.map((e) => [e.id, e]));
			i.value.schedules = e.map((e) => n.get(e)).filter((e) => !!e);
		}
		function se(e, t) {
			n.submitting || a.mutate(e, t);
		}
		function ce(e) {
			n.submitting || a.clear(e);
		}
		async function le() {
			if (!i.value || n.submitting) return;
			let e = i.value;
			if (!e.name.trim() || e.name.trim().length > 100) {
				let e = b("error.task_name_invalid", {}, "请输入不超过 100 个字符的任务名称。");
				h.value = e, r("invalid", e);
				return;
			}
			if (n.tasks.some((t) => t.id !== e.id && t.name.toLocaleLowerCase() === e.name.trim().toLocaleLowerCase())) {
				let e = b("error.task_name_duplicate", {}, "签到任务名称已存在。");
				h.value = e, r("invalid", e);
				return;
			}
			if (new TextEncoder().encode(e.remark).length > 512) {
				m.value = b("error.task_remark_invalid", {}, "备注不能超过 512 字节。");
				return;
			}
			if (e.schedules.some((e) => e.days.length === 0 || !/^\d{2}:\d{2}$/.test(e.time))) {
				m.value = b("error.schedule_settings_invalid", {}, "请检查计划时间和执行星期。");
				return;
			}
			if (e.notification.smtpTo.length > 4096) {
				m.value = b("error.smtp_recipient_invalid", {}, "SMTP 收件人内容过长。");
				return;
			}
			m.value = "";
			let t = await a.payload();
			if (!t) {
				m.value = b("error.credential_draft_unconfirmed", {}, "凭据草稿尚未确认，请检查错误后再保存。");
				return;
			}
			r("save", {
				...e,
				id: e.id,
				name: e.name.trim(),
				remark: e.remark.trim(),
				schedules: e.schedules.map((e) => ({
					...e,
					days: [...e.days]
				})),
				notification: {
					...e.notification,
					smtpTo: e.notification.smtpTo.trim()
				},
				...t
			});
		}
		return (t, n) => (Y(), X(q, null, [e.open ? (Y(), X("nxp-modal", {
			key: 0,
			open: e.open,
			title: e.task ? b("editor.edit_title", {}, "编辑签到任务") : b("editor.new_title", {}, "新建签到任务"),
			"aria-label": e.task ? b("editor.edit_title", {}, "编辑签到任务") : b("editor.new_title", {}, "新建签到任务"),
			size: "wide",
			locked: "",
			footer: "",
			"close-label": b("action.close", {}, "关闭"),
			onClose: n[9] ||= (e) => r("close")
		}, [i.value ? (Y(), X("div", no, [
			Z("section", ro, [Z("div", io, [Z("nxp-field", {
				label: b("field.name", {}, "任务名称"),
				required: ""
			}, [Z("nxp-text-input", {
				id: "gci-task-name",
				"model-value": i.value.name,
				required: "",
				"aria-invalid": h.value || e.nameError ? "true" : "false",
				"aria-label": b("field.name", {}, "任务名称"),
				onChange: n[0] ||= (e) => C("name", String(x(e) || "")),
				"onUpdate:modelValue": n[1] ||= (e) => C("name", String(x(e) || ""))
			}, null, 40, oo)], 8, ao), Z("nxp-field", { label: b("field.remark", {}, "备注") }, [Z("nxp-text-area", {
				id: "gci-task-remark",
				"model-value": i.value.remark,
				rows: "2",
				"aria-label": b("field.remark", {}, "备注"),
				onChange: n[2] ||= (e) => C("remark", String(x(e) || ""))
			}, null, 40, co)], 8, so)]), Z("nxp-switch-setting", {
				id: "gci-task-enabled",
				"model-value": i.value.enabled,
				label: b("field.task_enabled", {}, "启用此任务"),
				description: b("field.task_enabled_help", {}, "停用后不会按计划自动签到。"),
				"aria-label": b("field.task_enabled", {}, "启用此任务"),
				onChange: n[3] ||= (e) => C("enabled", x(e))
			}, null, 40, lo)]),
			Z("nxp-collapsible-card", {
				class: "gci-checkin-settings",
				title: b("field.checkin_settings", {}, "签到设置"),
				description: b("field.checkin_settings_help", {}, "按需配置五个平台的游戏和凭据，本任务触发时将对所选游戏执行签到。"),
				"panel-id": "gci-checkin-settings",
				surface: "secondary",
				expanded: f.value,
				onToggle: n[6] ||= (e) => f.value = x(e)
			}, [Z("div", fo, [
				Z("div", po, [(Y(!0), X(q, null, sr(e.platforms, (e) => (Y(), X("nxp-field", {
					key: `${e.id}-games`,
					label: b("field.platform_games", { platform: e.name }, `${e.name} 签到游戏`),
					help: ee(e.id)
				}, [Z("nxp-select", {
					id: `gci-games-${e.id}`,
					"model-value": i.value.games[e.id] || [],
					options: e.games.map((e) => ({
						value: e.id,
						label: e.name
					})),
					multiple: !0,
					disabled: e.games.length === 0,
					placeholder: b("common.choose", {}, "请选择"),
					"aria-label": b("field.platform_games", { platform: e.name }, `${e.name} 签到游戏`),
					onChange: (t) => w(e.id, t)
				}, null, 40, ho)], 8, mo))), 128))]),
				Z("div", go, [(Y(!0), X(q, null, sr(e.platforms, (t) => (Y(), X("div", {
					key: t.id,
					class: "gci-credential-row"
				}, [
					Z("nxp-field", {
						label: b("field.credential", { platform: t.name }, `${t.name} 凭据`),
						help: ne(t.id)
					}, [Z("div", vo, [
						bn(Z("nxp-text-input", {
							id: `gci-secret-${t.id}`,
							"model-value": V(o)[t.id]?.inputValue || "",
							type: "password",
							"show-password-toggle": !0,
							"password-visibility-controlled": "",
							"password-visible": V(o)[t.id]?.visible === !0,
							"secret-configured": V(o)[t.id]?.configured === !0,
							readonly: V(o)[t.id]?.source === "browser" && !V(o)[t.id]?.visible,
							"show-password-label": b("field.secret_show", {}, "显示凭据"),
							"hide-password-label": b("field.secret_hide", {}, "隐藏凭据"),
							disabled: e.submitting || !V(c) || V(o)[t.id]?.loading,
							autocomplete: "new-password",
							placeholder: re(t.id),
							"aria-label": b("field.credential", { platform: t.name }, `${t.name} 凭据`),
							onPasswordVisibilityRequest: (e) => V(a).visibility(t.id)
						}, null, 40, yo), [[d, t.id]]),
						V(s) && t.browserLogin?.ready ? (Y(), X("nxp-button", {
							key: 0,
							label: b("field.browser_login", {}, "网页登录"),
							"aria-label": `${t.name} · ${b("field.browser_login", {}, "网页登录")}`,
							disabled: e.submitting || !V(c) || V(o)[t.id]?.loading,
							onClick: (e) => V(a).login(t.id)
						}, null, 8, bo)) : Q("", !0),
						V(o)[t.id]?.configured ? (Y(), X("nxp-button", {
							key: 1,
							id: `gci-clear-${t.id}`,
							label: b("field.secret_clear", {}, "清除已保存凭据"),
							"aria-label": `${t.name} · ${b("field.secret_clear", {}, "清除已保存凭据")}`,
							disabled: e.submitting || !V(c) || V(o)[t.id]?.loading,
							onClick: (e) => ce(t.id)
						}, null, 8, xo)) : Q("", !0)
					])], 8, _o),
					V(o)[t.id]?.localError || V(o)[t.id]?.error ? (Y(), X("p", So, A(b(`error.${V(o)[t.id]?.localError || V(o)[t.id]?.error}`, {}, "凭据草稿未确认，请检查后清除并重新填写。")), 1)) : Q("", !0),
					V(o)[t.id]?.localError && V(o)[t.id]?.intent === "keep" ? (Y(), X("nxp-button", {
						key: 1,
						disabled: e.submitting,
						label: b("field.secret_retry", {}, "重试读取"),
						onClick: (e) => V(a).retry(t.id)
					}, null, 8, Co)) : Q("", !0),
					V(o)[t.id]?.intent === "clear" ? (Y(), X("p", wo, A(b("field.secret_clear_pending", {}, "将在保存后清除")), 1)) : Q("", !0)
				]))), 128))]),
				Z("section", To, [Z("nxp-switch-setting", {
					id: "gci-notification-enabled",
					"model-value": i.value.notification.enabled,
					label: b("field.notifications_enabled", {}, "启用通知"),
					description: b("field.notifications_help", {}, "使用宿主全局 Webhook 与 SMTP 设置。"),
					"aria-label": b("field.notifications_enabled", {}, "启用通知"),
					onChange: n[4] ||= (e) => i.value.notification.enabled = x(e)
				}, null, 40, Eo), Z("nxp-field", {
					label: b("field.smtp_to", {}, "SMTP 收件人"),
					help: b("field.smtp_to_help", {}, "留空时继承宿主全局 SMTP 收件人。")
				}, [Z("nxp-text-input", {
					id: "gci-smtp-to",
					"model-value": i.value.notification.smtpTo,
					autocomplete: "email",
					"aria-label": b("field.smtp_to", {}, "SMTP 收件人"),
					onChange: n[5] ||= (e) => i.value.notification.smtpTo = String(x(e) || "")
				}, null, 40, Oo)], 8, Do)])
			])], 40, uo),
			Z("section", ko, [
				Z("header", Ao, [Z("div", null, [Z("h3", null, A(b("field.schedule", {}, "定时计划")), 1), Z("p", null, A(b("field.schedule_help", { zone: e.timeZoneId }, `按本机时区 ${e.timeZoneId} 执行；应用关闭期间错过的时间不会补跑。`)), 1)])]),
				i.value.schedules.length ? (Y(), X("nxp-sortable-list", {
					key: 0,
					layout: "schedule",
					tag: "div",
					"aria-label": b("field.schedule", {}, "定时计划"),
					onReorder: n[7] ||= (e) => O(x(e))
				}, [(Y(!0), X(q, null, sr(i.value.schedules, (e, t) => (Y(), X("nxp-schedule-card", {
					key: e.id,
					"item-id": e.id,
					"data-dnd-id": e.id,
					"panel-id": `gci-schedule-${e.id}`,
					"summary-label": b("schedule.label", { index: t + 1 }, `定时 ${t + 1}`),
					"summary-meta": `${e.time} · ${b("schedule.days_count", { count: e.days.length }, `${e.days.length} 天`)}`,
					"days-label": b("field.schedule_days", {}, "执行周期（可多选）"),
					"days-aria-label": b("field.schedule_days", {}, "执行星期"),
					"time-label": b("field.schedule_time", {}, "执行时间"),
					expanded: ae(e.id),
					"drag-label": b("common.reorder.schedule", { index: t + 1 }, `调整计划 ${t + 1} 的顺序`),
					"drag-title": b("common.drag_to_reorder", {}, "拖动以调整顺序"),
					onToggle: (t) => D(e.id)
				}, [
					(Y(!0), X(q, null, sr(_.value, (t, n) => (Y(), X("nxp-button", {
						key: n,
						slot: "days",
						class: "gci-day-button",
						"aria-pressed": e.days.includes(n),
						"aria-label": t,
						title: t,
						onClick: (t) => oe(e, n)
					}, A(v.value[n]), 9, No))), 128)),
					Z("nxp-time-picker", {
						slot: "time",
						id: `gci-time-${e.id}`,
						"model-value": e.time,
						"aria-label": b("field.schedule_time", {}, "时间"),
						onChange: (t) => e.time = String(x(t) || e.time)
					}, null, 40, Po),
					Z("nxp-switch", {
						slot: "actions",
						"model-value": e.enabled,
						"semantic-role": "switch",
						"aria-label": `${b("field.schedule_enabled", {}, "启用此计划")} ${t + 1}`,
						onChange: (t) => e.enabled = x(t)
					}, null, 40, Fo),
					Z("nxp-button", {
						slot: "actions",
						label: b("action.remove_schedule", {}, "删除计划"),
						onClick: (e) => ie(t)
					}, null, 8, Io)
				], 40, Mo))), 128))], 40, jo)) : (Y(), X("p", Lo, A(b("empty.schedules", {}, "还没有定时计划")), 1)),
				Z("nxp-button", {
					label: `+ ${b("action.add_schedule", {}, "添加定时")}`,
					variant: "ghost",
					disabled: i.value.schedules.length >= 30,
					onClick: E
				}, null, 8, Ro)
			]),
			m.value || e.error ? (Y(), X("p", zo, A(m.value || e.error), 1)) : Q("", !0)
		])) : Q("", !0), Z("div", Bo, [Z("nxp-button", {
			label: e.submitting ? b("status.saving", {}, "保存中…") : b("action.save", {}, "保存"),
			tone: "primary",
			busy: e.submitting,
			disabled: !V(c),
			onClick: le
		}, null, 8, Vo), Z("nxp-button", {
			label: b("action.cancel", {}, "取消"),
			variant: "ghost",
			disabled: e.submitting,
			onClick: n[8] ||= (e) => r("close")
		}, null, 8, Ho)])], 40, to)) : Q("", !0), V(l) ? (Y(), X("nxp-modal", {
			key: 1,
			open: "",
			footer: "",
			title: b("reveal.title", {}, "显示自动获取的凭据"),
			"close-label": b("action.close", {}, "关闭"),
			onClose: n[12] ||= (e) => l.value = null
		}, [Z("p", null, A(b("reveal.description", {}, "凭据可用于访问你的账号。确认后，本客户端在 24 小时内可主动显示自动凭据；其他客户端仍需单独确认。关闭服务后确认失效。")), 1), Z("div", Wo, [Z("nxp-button", {
			tone: "primary",
			label: b("reveal.confirm", {}, "确认显示"),
			onClick: n[10] ||= (e) => V(a).confirm()
		}, null, 8, Go), Z("nxp-button", {
			variant: "ghost",
			label: b("action.cancel", {}, "取消"),
			onClick: n[11] ||= (e) => l.value = null
		}, null, 8, Ko)])], 40, Uo)) : Q("", !0)], 64));
	}
}), Jo = ["aria-label"], Yo = ["data-task-id", "data-dnd-id"], Xo = { class: "gci-task-row-main" }, Zo = ["label", "title"], Qo = {
	class: "gci-task-avatar",
	"aria-hidden": "true"
}, $o = { class: "gci-task-copy" }, es = { class: "gci-task-heading" }, ts = ["label"], ns = {
	key: 0,
	class: "gci-task-remark"
}, rs = { class: "gci-task-meta" }, is = ["label", "tone"], as = ["label", "tone"], os = ["label", "tone"], ss = ["label"], cs = ["label"], ls = { class: "gci-task-actions" }, us = [
	"label",
	"disabled",
	"onClick"
], ds = ["label", "onClick"], fs = [
	"label",
	"disabled",
	"onClick"
], ps = {
	key: 0,
	class: "gci-run-history"
}, ms = { class: "gci-run-list" }, hs = { class: "gci-run-entry" }, gs = { class: "gci-run-entry-head" }, _s = ["label", "tone"], vs = { key: 0 }, ys = /* @__PURE__ */ In({
	__name: "CheckInTaskList",
	props: {
		tasks: {},
		platforms: {},
		translate: { type: Function }
	},
	emits: [
		"run",
		"edit",
		"remove",
		"reorder"
	],
	setup(e, { emit: t }) {
		let n = e, r = t;
		function i(e, t = {}, r = "") {
			return n.translate(e, t, r);
		}
		function a(e) {
			let t = e.detail;
			return Array.isArray(t) && t.length ? t[0] : t === void 0 ? e.target?.modelValue : t;
		}
		function o(e) {
			return Array.from(e.trim())[0]?.toLocaleUpperCase() || "?";
		}
		function s(e) {
			return Object.values(e.games || {}).reduce((e, t) => e + t.length, 0);
		}
		function c(e) {
			if (!e) return i("task.no_next_run", {}, "未安排下次运行");
			let t = new Date(e);
			return Number.isNaN(t.getTime()) ? i("task.no_next_run", {}, "未安排下次运行") : i("task.next_run_badge", { time: t.toLocaleString(void 0, {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			}) }, `下次 ${t.toLocaleString(void 0, {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			})}`);
		}
		function l(e) {
			return e === "running" ? "blue" : e === "success" ? "ok" : e === "partial" ? "warn" : e === "failed" || e === "cancelled" ? "bad" : "muted";
		}
		function u(e) {
			if (!e) return i("task.no_results", {}, "没有运行记录");
			let t = new Date(e);
			return Number.isNaN(t.getTime()) ? e : t.toLocaleString();
		}
		function d(e, t) {
			return n.platforms.find((t) => t.id === e)?.games.find((e) => e.id === t)?.name || t;
		}
		function f(e) {
			let t = n.tasks.map((e) => e.id);
			e.length !== t.length || new Set(e).size !== t.length || e.some((e) => !t.includes(e)) || e.every((e, n) => e === t[n]) || r("reorder", e);
		}
		return (t, n) => (Y(), X("nxp-sortable-list", {
			class: "gci-task-list",
			tag: "div",
			role: "list",
			"aria-label": i("page.title", {}, "签到任务"),
			onReorder: n[0] ||= (e) => f(a(e))
		}, [(Y(!0), X(q, null, sr(e.tasks, (e) => (Y(), X("article", {
			key: e.id,
			class: "gci-task-row",
			"data-task-id": e.id,
			"data-dnd-id": e.id,
			role: "listitem"
		}, [Z("div", Xo, [
			Z("nxp-drag-handle", {
				class: "gci-drag-handle",
				label: i("common.reorder.task", { name: e.name }, `调整 ${e.name} 的顺序`),
				title: i("common.drag_to_reorder", {}, "拖动以调整顺序")
			}, null, 8, Zo),
			Z("span", Qo, A(o(e.name)), 1),
			Z("div", $o, [
				Z("div", es, [Z("h2", null, [Z("nxp-overflow-text", { label: e.name }, null, 8, ts)])]),
				e.remark ? (Y(), X("p", ns, A(e.remark), 1)) : Q("", !0),
				Z("div", rs, [
					Z("nxp-badge", {
						label: e.enabled ? i("status.enabled", {}, "已启用") : i("status.disabled", {}, "已停用"),
						tone: e.enabled ? "ok" : "muted"
					}, null, 8, is),
					e.recentRun ? (Y(), X("nxp-badge", {
						key: 0,
						label: i(`status.${e.recentRun.status}`, {}, e.recentRun.status),
						tone: l(e.recentRun.status)
					}, null, 8, as)) : Q("", !0),
					Z("nxp-badge", {
						label: e.notification?.enabled ? i("status.notifications_on", {}, "通知已开启") : i("status.notifications_off", {}, "通知已关闭"),
						tone: e.notification?.enabled ? "blue" : "muted"
					}, null, 8, os),
					Z("nxp-badge", {
						label: i("task.games_count", { count: s(e) }, `${s(e)} 个游戏`),
						tone: "muted"
					}, null, 8, ss),
					Z("nxp-badge", {
						label: c(e.nextRunAt),
						tone: "blue"
					}, null, 8, cs)
				])
			]),
			Z("div", ls, [
				Z("nxp-button", {
					label: i("action.run", {}, "立即签到"),
					variant: "ghost",
					disabled: e.isRunning,
					onClick: (t) => r("run", e)
				}, null, 8, us),
				Z("nxp-button", {
					label: i("action.edit", {}, "编辑签到"),
					variant: "ghost",
					onClick: (t) => r("edit", e)
				}, null, 8, ds),
				Z("nxp-button", {
					label: i("action.delete", {}, "删除签到"),
					tone: "danger",
					variant: "ghost",
					disabled: e.isRunning,
					onClick: (t) => r("remove", e)
				}, null, 8, fs)
			])
		]), e.recentRun ? (Y(), X("details", ps, [Z("summary", null, A(i("action.show_results", {}, "运行记录")), 1), Z("div", ms, [Z("section", hs, [Z("header", gs, [Z("span", null, A(u(e.recentRun.completedAt || e.recentRun.startedAt)), 1), Z("nxp-badge", {
			label: i(`status.${e.recentRun.status}`, {}, e.recentRun.status),
			tone: l(e.recentRun.status)
		}, null, 8, _s)]), e.recentRun.results?.length ? (Y(), X("ul", vs, [(Y(!0), X(q, null, sr(e.recentRun.results, (e, t) => (Y(), X("li", { key: `${e.platform}-${e.gameCode}-${t}` }, [Z("span", null, A(d(e.platform, e.gameCode)), 1), Z("span", null, A(e.message), 1)]))), 128))])) : Q("", !0)])])])) : Q("", !0)], 8, Yo))), 128))], 40, Jo));
	}
}), bs = {
	class: "gci-page",
	"data-game-check-in-page": ""
}, xs = { class: "gci-page-header" }, Ss = { class: "gci-page-header-copy" }, Cs = { class: "gci-page-header-eyebrow" }, ws = { class: "gci-page-header-description" }, Ts = { class: "gci-page-header-actions" }, Es = ["label"], Ds = {
	key: 0,
	class: "gci-error",
	role: "alert"
}, Os = {
	key: 1,
	class: "gci-loading",
	role: "status"
}, ks = ["title", "description"], As = ["label"], js = [
	"title",
	"locked",
	"closeable",
	"close-label"
], Ms = { class: "gci-confirm-message" }, Ns = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, Ps = ["label", "disabled"], Fs = ["label", "busy"], Is = /* @__PURE__ */ In({
	__name: "GameCheckInPage",
	props: { host: {} },
	setup(e) {
		let t = e, n = /* @__PURE__ */ B(null), r = /* @__PURE__ */ B(!0), i = /* @__PURE__ */ B(!1), a = /* @__PURE__ */ B(!1), o = /* @__PURE__ */ B(null), s = /* @__PURE__ */ B(""), c = /* @__PURE__ */ B(""), l = /* @__PURE__ */ B(""), u = /* @__PURE__ */ B(null), d = /* @__PURE__ */ B(!1), f = new AbortController(), p = null, m = !1, h = !1, g = oa(() => n.value?.tasks || []), _ = oa(() => n.value?.platforms || []), v = (e, n = {}, r = "") => t.host.i18n.t(e, n, r);
		function y(e, t = {}, n = "") {
			return v(e, t, n);
		}
		function b(e) {
			let t = e;
			if (typeof t?.code == "string" && t.code) return t.code;
			let n = t?.data;
			return typeof n?.code == "string" && n.code ? n.code : typeof n?.error == "string" ? n.error : "";
		}
		function x(e, t) {
			let n = b(e);
			return n ? y(`error.${n}`, {}, t) : t;
		}
		async function S(e = !1) {
			if (!(h || m)) {
				h = !0;
				try {
					let e = await t.host.api.get("state", f.signal);
					if (m) return;
					n.value = {
						tasks: Array.isArray(e?.tasks) ? e.tasks : [],
						platforms: Array.isArray(e?.platforms) ? e.platforms : [],
						timeZoneId: typeof e?.timeZoneId == "string" ? e.timeZoneId : ""
					}, s.value = "";
				} catch (t) {
					!m && e && (s.value = x(t, y("error.state_failed", {}, "签到任务读取失败，请稍后重试。")));
				} finally {
					h = !1, e && !m && (r.value = !1);
				}
			}
		}
		function C(e = null) {
			l.value = "", o.value = e, c.value = "", a.value = !0;
		}
		function w() {
			i.value || (a.value = !1, o.value = null, c.value = "");
		}
		async function ee(e) {
			if (!i.value) {
				i.value = !0, c.value = "";
				try {
					e.id ? await t.host.api.put("tasks", e, f.signal) : await t.host.api.post("tasks", e, f.signal), a.value = !1, o.value = null, await S(), t.host.ui?.toast(y("toast.saved", {}, "签到任务已保存。"), "success");
				} catch (e) {
					let n = b(e), r = x(e, y("error.save_failed", {}, "任务保存失败，请检查填写内容后重试。"));
					["task_name_invalid", "task_name_duplicate"].includes(n) ? (l.value = r, c.value = "") : c.value = r, n === "task_save_unconfirmed" && await S(), t.host.ui?.toast(r, "error");
				} finally {
					i.value = !1;
				}
			}
		}
		async function te(e) {
			if (!n.value || e.length !== n.value.tasks.length) return;
			let r = new Map(n.value.tasks.map((e) => [e.id, e]));
			if (new Set(e).size !== e.length || e.some((e) => !r.has(e))) return;
			let i = n.value.tasks;
			n.value = {
				...n.value,
				tasks: e.map((e) => r.get(e))
			};
			try {
				await t.host.api.put("tasks/order", { taskIds: e }, f.signal), await S();
			} catch (e) {
				n.value = {
					...n.value,
					tasks: i
				}, s.value = x(e, y("error.task_order_save_failed", {}, "任务顺序保存失败。"));
			}
		}
		async function ne(e) {
			try {
				await t.host.api.post("tasks/run", { taskId: e.id }, f.signal), await S(), t.host.ui?.toast(y("toast.run_started", {}, "签到已开始。"), "info");
			} catch (e) {
				s.value = x(e, y("error.run_failed", {}, "签到启动失败，请稍后重试。"));
			}
		}
		async function T() {
			let e = u.value;
			if (e && !d.value) {
				d.value = !0;
				try {
					await t.host.api.delete("tasks", { taskId: e.id }, f.signal), u.value = null, o.value?.id === e.id && w(), await S(), t.host.ui?.toast(y("toast.deleted", {}, "签到任务已删除。"), "success");
				} catch (e) {
					s.value = x(e, y("error.delete_failed", {}, "任务删除失败。")), t.host.ui?.toast(s.value, "error");
				} finally {
					d.value = !1;
				}
			}
		}
		return Zn(() => {
			S(!0), p = setInterval(() => void S(), 5e3);
		}), er(() => {
			m = !0, f.abort(), p && clearInterval(p);
		}), (f, p) => (Y(), X("section", bs, [
			Z("header", xs, [Z("div", Ss, [
				Z("div", Cs, A(y("page.title", {}, "签到")), 1),
				Z("h2", null, A(y("page.title", {}, "签到")), 1),
				Z("p", ws, A(y("page.description", {}, "管理多平台签到任务和运行计划。")), 1)
			]), Z("div", Ts, [Z("nxp-button", {
				label: y("action.add_task", {}, "添加签到任务"),
				tone: "primary",
				type: "button",
				onClick: p[0] ||= (e) => C()
			}, null, 8, Es)])]),
			s.value ? (Y(), X("p", Ds, A(s.value), 1)) : r.value ? (Y(), X("p", Os, A(y("status.loading", {}, "正在读取…")), 1)) : Q("", !0),
			g.value.length ? (Y(), Di(ys, {
				key: 2,
				tasks: g.value,
				platforms: _.value,
				translate: v,
				onRun: ne,
				onEdit: C,
				onRemove: p[1] ||= (e) => u.value = e,
				onReorder: te
			}, null, 8, ["tasks", "platforms"])) : !r.value && !s.value ? (Y(), X("nxp-empty-state", {
				key: 3,
				title: y("empty.title", {}, "还没有签到任务"),
				description: y("empty.description", {}, "创建任务后设置游戏、凭据和定时计划。")
			}, [Z("nxp-button", {
				label: y("action.add_task", {}, "添加签到任务"),
				tone: "primary",
				type: "button",
				onClick: p[2] ||= (e) => C()
			}, null, 8, As)], 8, ks)) : Q("", !0),
			Mi(qo, {
				open: a.value,
				task: o.value,
				tasks: n.value?.tasks || [],
				platforms: _.value,
				"time-zone-id": n.value?.timeZoneId || "",
				submitting: i.value,
				error: c.value,
				"name-error": l.value,
				translate: v,
				host: e.host,
				onClose: w,
				onSave: ee,
				onInvalid: p[3] ||= (e) => t.host.ui?.toast(e, "error"),
				onNameChange: p[4] ||= (e) => {
					l.value = "", c.value = "";
				}
			}, null, 8, [
				"open",
				"task",
				"tasks",
				"platforms",
				"time-zone-id",
				"submitting",
				"error",
				"name-error",
				"host"
			]),
			u.value ? (Y(), X("nxp-modal", {
				key: 4,
				open: "",
				footer: "",
				title: y("action.delete", {}, "删除签到"),
				locked: d.value,
				closeable: !d.value,
				"close-label": y("action.close", {}, "关闭"),
				onClose: p[6] ||= (e) => !d.value && (u.value = null)
			}, [Z("p", Ms, A(y("task.delete_confirm", {}, "删除此任务、计划和凭据？")) + " — " + A(u.value.name), 1), Z("div", Ns, [Z("nxp-button", {
				label: y("action.cancel", {}, "取消"),
				variant: "ghost",
				disabled: d.value,
				onClick: p[5] ||= (e) => u.value = null
			}, null, 8, Ps), Z("nxp-button", {
				label: y("action.confirm", {}, "确定"),
				tone: "danger",
				busy: d.value,
				onClick: T
			}, null, 8, Fs)])], 40, js)) : Q("", !0)
		]));
	}
});
//#endregion
//#region src/main.ts
function Ls(e) {
	let t = null, n = () => {}, r = e.routes.register("tasks", (r, i) => {
		n();
		let a = r.element;
		t = Xa(Is, { host: i || e }), t.mount(a);
		let o = t, s = !1;
		return n = () => {
			s || (s = !0, o.unmount(), t === o && (t = null));
		}, n;
	}), i = e.nav.register({
		id: "check-in-tasks",
		title: e.i18n.t("nav.title", {}, "签到"),
		titleKey: "nav.title",
		route: "tasks",
		icon: "check",
		order: -100
	}), a = e.lifecycle.onDispose(() => {
		n();
	});
	return { dispose() {
		n(), a?.dispose?.(), r?.dispose?.(), i?.dispose?.();
	} };
}
//#endregion
export { Ls as activate };
