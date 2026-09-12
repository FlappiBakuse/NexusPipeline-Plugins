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
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, ee = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), T = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, te = /-\w/g, E = T((e) => e.replace(te, (e) => e.slice(1).toUpperCase())), ne = /\B([A-Z])/g, D = T((e) => e.replace(ne, "-$1").toLowerCase()), re = T((e) => e.charAt(0).toUpperCase() + e.slice(1)), O = T((e) => e ? `on${re(e)}` : ""), k = (e, t) => !Object.is(e, t), ie = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, A = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, ae = (e) => {
	let t = parseFloat(e);
	return isNaN(t) ? e : t;
}, oe, se = () => oe ||= typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
function ce(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = g(r) ? fe(r) : ce(r);
			if (i) for (let e in i) t[e] = i[e];
		}
		return t;
	}
	if (g(e) || v(e)) return e;
}
var le = /;(?![^(]*\))/g, ue = /:([^]+)/, de = /\/\*[^]*?\*\//g;
function fe(e) {
	let t = {};
	return e.replace(de, "").split(le).forEach((e) => {
		if (e) {
			let n = e.split(ue);
			n.length > 1 && (t[n[0].trim()] = n[1].trim());
		}
	}), t;
}
function j(e) {
	let t = "";
	if (g(e)) t = e;
	else if (d(e)) for (let n = 0; n < e.length; n++) {
		let r = j(e[n]);
		r && (t += r + " ");
	}
	else if (v(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
var pe = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", me = /* @__PURE__ */ e(pe);
pe + "";
function he(e) {
	return !!e || e === "";
}
function ge(e, t) {
	if (e.length !== t.length) return !1;
	let n = !0;
	for (let r = 0; n && r < e.length; r++) n = ve(e[r], t[r]);
	return n;
}
function _e(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && ve(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function ve(e, t) {
	if (e === t) return !0;
	let n = m(e), r = m(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = _(e), r = _(t), n || r) return e === t;
	if (n = d(e), r = d(t), n || r) return n && r ? ge(e, t) : !1;
	if (n = v(e), r = v(t), n || r) {
		if (!n || !r) return !1;
		if (n = f(e), r = f(t), n || r || (n = p(e), r = p(t), n || r)) return n && r ? _e(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !ve(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
var ye = (e) => !!(e && e.__v_isRef === !0), M = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? ye(e) ? M(e.value) : JSON.stringify(e, be, 2) : String(e), be = (e, t) => ye(t) ? be(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[xe(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => xe(e)) } : _(t) ? xe(t) : v(t) && !d(t) && !C(t) ? String(t) : t, xe = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e, N, Se = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !e && N && (N.active ? (this.parent = N, this.index = (N.scopes || (N.scopes = [])).push(this) - 1) : (this._active = !1, this._warnOnRun = !1));
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
			let t = N;
			try {
				return N = this, e();
			} finally {
				N = t;
			}
		}
	}
	on() {
		++this._on === 1 && (this.prevScope = N, N = this);
	}
	off() {
		if (this._on > 0 && --this._on === 0) {
			if (N === this) N = this.prevScope;
			else {
				let e = N;
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
function Ce() {
	return N;
}
var P, we = /* @__PURE__ */ new WeakSet(), Te = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, N && (N.active ? N.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, we.has(this) && (we.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || ke(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, Ve(this), Me(this);
		let e = P, t = F;
		P = this, F = !0;
		try {
			return this.fn();
		} finally {
			Ne(this), P = e, F = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Ie(e);
			this.deps = this.depsTail = void 0, Ve(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? we.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		Pe(this) && this.run();
	}
	get dirty() {
		return Pe(this);
	}
}, Ee = 0, De, Oe;
function ke(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = Oe, Oe = e;
		return;
	}
	e.next = De, De = e;
}
function Ae() {
	Ee++;
}
function je() {
	if (--Ee > 0) return;
	if (Oe) {
		let e = Oe;
		for (Oe = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; De;) {
		let t = De;
		for (De = void 0; t;) {
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
function Me(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Ne(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), Ie(r), Le(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function Pe(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (Fe(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function Fe(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === He) || (e.globalVersion = He, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Pe(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = P, r = F;
	P = e, F = !0;
	try {
		Me(e);
		let n = e.fn(e._value);
		(t.version === 0 || k(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		P = n, F = r, Ne(e), e.flags &= -3;
	}
}
function Ie(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) Ie(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function Le(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var F = !0, Re = [];
function ze() {
	Re.push(F), F = !1;
}
function Be() {
	let e = Re.pop();
	F = e === void 0 || e;
}
function Ve(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = P;
		P = void 0;
		try {
			t();
		} finally {
			P = e;
		}
	}
}
var He = 0, Ue = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, We = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!P || !F || P === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== P) t = this.activeLink = new Ue(P, this), P.deps ? (t.prevDep = P.depsTail, P.depsTail.nextDep = t, P.depsTail = t) : P.deps = P.depsTail = t, Ge(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = P.depsTail, t.nextDep = void 0, P.depsTail.nextDep = t, P.depsTail = t, P.deps === t && (P.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, He++, this.notify(e);
	}
	notify(e) {
		Ae();
		try {
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			je();
		}
	}
};
function Ge(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) Ge(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var Ke = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ Symbol(""), Je = /* @__PURE__ */ Symbol(""), Ye = /* @__PURE__ */ Symbol("");
function I(e, t, n) {
	if (F && P) {
		let t = Ke.get(e);
		t || Ke.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new We()), r.map = t, r.key = n), r.track();
	}
}
function Xe(e, t, n, r, i, a) {
	let o = Ke.get(e);
	if (!o) {
		He++;
		return;
	}
	let s = (e) => {
		e && e.trigger();
	};
	if (Ae(), t === "clear") o.forEach(s);
	else {
		let i = d(e), a = i && w(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === Ye || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(Ye)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(qe)), f(e) && s(o.get(Je)));
				break;
			case "delete":
				i || (s(o.get(qe)), f(e) && s(o.get(Je)));
				break;
			case "set": f(e) && s(o.get(qe));
		}
	}
	je();
}
function Ze(e) {
	let t = /* @__PURE__ */ z(e);
	return t === e ? t : (I(t, "iterate", Ye), /* @__PURE__ */ R(e) ? t : t.map(B));
}
function Qe(e) {
	return I(e = /* @__PURE__ */ z(e), "iterate", Ye), e;
}
function L(e, t) {
	return /* @__PURE__ */ Pt(e) ? Lt(/* @__PURE__ */ Nt(e) ? B(t) : t) : B(t);
}
var $e = {
	__proto__: null,
	[Symbol.iterator]() {
		return et(this, Symbol.iterator, (e) => L(this, e));
	},
	concat(...e) {
		return Ze(this).concat(...e.map((e) => d(e) ? Ze(e) : e));
	},
	entries() {
		return et(this, "entries", (e) => (e[1] = L(this, e[1]), e));
	},
	every(e, t) {
		return nt(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return nt(this, "filter", e, t, (e) => e.map((e) => L(this, e)), arguments);
	},
	find(e, t) {
		return nt(this, "find", e, t, (e) => L(this, e), arguments);
	},
	findIndex(e, t) {
		return nt(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return nt(this, "findLast", e, t, (e) => L(this, e), arguments);
	},
	findLastIndex(e, t) {
		return nt(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return nt(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return it(this, "includes", e);
	},
	indexOf(...e) {
		return it(this, "indexOf", e);
	},
	join(e) {
		return Ze(this).join(e);
	},
	lastIndexOf(...e) {
		return it(this, "lastIndexOf", e);
	},
	map(e, t) {
		return nt(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return at(this, "pop");
	},
	push(...e) {
		return at(this, "push", e);
	},
	reduce(e, ...t) {
		return rt(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return rt(this, "reduceRight", e, t);
	},
	shift() {
		return at(this, "shift");
	},
	some(e, t) {
		return nt(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return at(this, "splice", e);
	},
	toReversed() {
		return Ze(this).toReversed();
	},
	toSorted(e) {
		return Ze(this).toSorted(e);
	},
	toSpliced(...e) {
		return Ze(this).toSpliced(...e);
	},
	unshift(...e) {
		return at(this, "unshift", e);
	},
	values() {
		return et(this, "values", (e) => L(this, e));
	}
};
function et(e, t, n) {
	let r = Qe(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ R(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var tt = Array.prototype;
function nt(e, t, n, r, i, a) {
	let o = Qe(e), s = o !== e && !/* @__PURE__ */ R(e), c = o[t];
	if (c !== tt[t]) {
		let t = c.apply(e, a);
		return s ? B(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, L(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function rt(e, t, n, r) {
	let i = Qe(e), a = i !== e && !/* @__PURE__ */ R(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = L(e, t)), n.call(this, t, L(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? L(e, c) : c;
}
function it(e, t, n) {
	let r = /* @__PURE__ */ z(e);
	I(r, "iterate", Ye);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Ft(n[0]) ? (n[0] = /* @__PURE__ */ z(n[0]), r[t](...n)) : i;
}
function at(e, t, n = []) {
	ze(), Ae();
	let r = (/* @__PURE__ */ z(e))[t].apply(e, n);
	return je(), Be(), r;
}
var ot = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), st = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function ct(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ z(this);
	return I(t, "has", e), t.hasOwnProperty(e);
}
var lt = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Dt : Et : i ? Tt : wt).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = $e[t])) return e;
			if (t === "hasOwnProperty") return ct;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ V(e) ? e : n);
		if ((_(t) ? st.has(t) : ot(t)) || (r || I(e, "get", t), i)) return o;
		if (/* @__PURE__ */ V(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ jt(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ jt(o) : /* @__PURE__ */ kt(o) : o;
	}
}, ut = class extends lt {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ Pt(i);
			if (!/* @__PURE__ */ R(n) && !/* @__PURE__ */ Pt(n) && (i = /* @__PURE__ */ z(i), n = /* @__PURE__ */ z(n)), !a && /* @__PURE__ */ V(i) && !/* @__PURE__ */ V(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ V(e) ? e : r);
		return e === /* @__PURE__ */ z(r) && s && (o ? k(n, i) && Xe(e, "set", t, n, i) : Xe(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Xe(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !st.has(t)) && I(e, "has", t), n;
	}
	ownKeys(e) {
		return I(e, "iterate", d(e) ? "length" : qe), Reflect.ownKeys(e);
	}
}, dt = class extends lt {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, ft = /* @__PURE__ */ new ut(), pt = /* @__PURE__ */ new dt(), mt = /* @__PURE__ */ new ut(!0), ht = (e) => e, gt = (e) => Reflect.getPrototypeOf(e);
function _t(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ z(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? ht : t ? Lt : B;
		return !t && I(a, "iterate", l ? Je : qe), s(Object.create(u), { next() {
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
function vt(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function yt(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ z(r), a = /* @__PURE__ */ z(n);
			e || (k(n, a) && I(i, "get", n), I(i, "get", a));
			let { has: o } = gt(i), s = t ? ht : e ? Lt : B;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && I(/* @__PURE__ */ z(t), "iterate", qe), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ z(n), i = /* @__PURE__ */ z(t);
			return e || (k(t, i) && I(r, "has", t), I(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ z(a), s = t ? ht : e ? Lt : B;
			return !e && I(o, "iterate", qe), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: vt("add"),
		set: vt("set"),
		delete: vt("delete"),
		clear: vt("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ z(this), r = gt(n), i = /* @__PURE__ */ z(e), a = !t && !/* @__PURE__ */ R(e) && !/* @__PURE__ */ Pt(e) ? i : e;
			return r.has.call(n, a) || k(e, a) && r.has.call(n, e) || k(i, a) && r.has.call(n, i) || (n.add(a), Xe(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ R(n) && !/* @__PURE__ */ Pt(n) && (n = /* @__PURE__ */ z(n));
			let r = /* @__PURE__ */ z(this), { has: i, get: a } = gt(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ z(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? k(n, s) && Xe(r, "set", e, n, s) : Xe(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ z(this), { has: n, get: r } = gt(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ z(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Xe(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ z(this), t = e.size !== 0, n = e.clear();
			return t && Xe(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = _t(r, e, t);
	}), n;
}
function bt(e, t) {
	let n = yt(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var xt = { get: /* @__PURE__ */ bt(!1, !1) }, St = { get: /* @__PURE__ */ bt(!1, !0) }, Ct = { get: /* @__PURE__ */ bt(!0, !1) }, wt = /* @__PURE__ */ new WeakMap(), Tt = /* @__PURE__ */ new WeakMap(), Et = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap();
function Ot(e) {
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
function kt(e) {
	return /* @__PURE__ */ Pt(e) ? e : Mt(e, !1, ft, xt, wt);
}
// @__NO_SIDE_EFFECTS__
function At(e) {
	return Mt(e, !1, mt, St, Tt);
}
// @__NO_SIDE_EFFECTS__
function jt(e) {
	return Mt(e, !0, pt, Ct, Et);
}
function Mt(e, t, n, r, i) {
	if (!v(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = Ot(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function Nt(e) {
	return /* @__PURE__ */ Pt(e) ? /* @__PURE__ */ Nt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Pt(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function R(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Ft(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function z(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ z(t) : e;
}
function It(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && A(e, "__v_skip", !0), e;
}
var B = (e) => v(e) ? /* @__PURE__ */ kt(e) : e, Lt = (e) => v(e) ? /* @__PURE__ */ jt(e) : e;
// @__NO_SIDE_EFFECTS__
function V(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Rt(e) {
	return zt(e, !1);
}
function zt(e, t) {
	return /* @__PURE__ */ V(e) ? e : new Bt(e, t);
}
var Bt = class {
	constructor(e, t) {
		this.dep = new We(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ z(e), this._value = t ? e : B(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ R(e) || /* @__PURE__ */ Pt(e);
		e = n ? e : /* @__PURE__ */ z(e), k(e, t) && (this._rawValue = e, this._value = n ? e : B(e), this.dep.trigger());
	}
};
function Vt(e) {
	return /* @__PURE__ */ V(e) ? e.value : e;
}
var Ht = {
	get: (e, t, n) => t === "__v_raw" ? e : Vt(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ V(i) && !/* @__PURE__ */ V(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Ut(e) {
	return /* @__PURE__ */ Nt(e) ? e : new Proxy(e, Ht);
}
var Wt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new We(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = He - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && P !== this) return ke(this, !0), !0;
	}
	get value() {
		let e = this.dep.track();
		return Fe(this), e && (e.version = this.dep.version), this._value;
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
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ R(e) || o === !1 || o === 0 ? Zt(e, 1) : Zt(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ V(e) ? (g = () => e.value, y = /* @__PURE__ */ R(e)) : /* @__PURE__ */ Nt(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Nt(e) || /* @__PURE__ */ R(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ V(e)) return e.value;
		if (/* @__PURE__ */ Nt(e)) return p(e);
		if (h(e)) return f ? f(e, 2) : e();
	})) : g = h(e) ? n ? f ? () => f(e, 2) : e : () => {
		if (_) {
			ze();
			try {
				_();
			} finally {
				Be();
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
	let x = Ce(), S = () => {
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
				if (e || o || y || (b ? t.some((e, t) => k(e, C[t])) : k(t, C))) {
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
	return u && u(w), m = new Te(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => Yt(e, !1, m), _ = m.onStop = () => {
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
	if (n.set(e, t), t--, /* @__PURE__ */ V(e)) Zt(e.value, t, n);
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
			ze(), Qt(o, null, 10, [
				e,
				i,
				a
			]), Be();
			return;
		}
	}
	en(e, r, a, i, s);
}
function en(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var U = [], W = -1, tn = [], nn = null, rn = 0, an = /* @__PURE__ */ Promise.resolve(), on = null;
function sn(e) {
	let t = on || an;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function cn(e) {
	let t = W + 1, n = U.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = U[r], a = mn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function ln(e) {
	if (!(e.flags & 1)) {
		let t = mn(e), n = U[U.length - 1];
		!n || !(e.flags & 2) && t >= mn(n) ? U.push(e) : U.splice(cn(t), 0, e), e.flags |= 1, un();
	}
}
function un() {
	on ||= an.then(hn);
}
function dn(e) {
	if (!d(e)) nn && e.id === -1 ? nn.splice(rn + 1, 0, e) : e.flags & 1 || (tn.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) tn.push(e[t]);
	un();
}
function fn(e, t, n = W + 1) {
	for (; n < U.length; n++) {
		let t = U[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			U.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
		}
	}
}
function pn(e) {
	if (tn.length) {
		let e = [...new Set(tn)].sort((e, t) => mn(e) - mn(t));
		if (tn.length = 0, nn) {
			for (let t = 0; t < e.length; t++) nn.push(e[t]);
			return;
		}
		for (nn = e, rn = 0; rn < nn.length; rn++) {
			let e = nn[rn];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		nn = null, rn = 0;
	}
}
var mn = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function hn(e) {
	try {
		for (W = 0; W < U.length; W++) {
			let e = U[W];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), Qt(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; W < U.length; W++) {
			let e = U[W];
			e && (e.flags &= -2);
		}
		W = -1, U.length = 0, pn(e), on = null, (U.length || tn.length) && hn(e);
	}
}
var G = null, gn = null;
function _n(e) {
	let t = G;
	return G = e, gn = e && e.type.__scopeId || null, t;
}
function vn(e, t = G, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && wi(-1);
		let i = _n(t), a = bi.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = bi.length; e > a; e--) Si();
			_n(i), r._d && wi(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function yn(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (ze(), H(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Be());
	}
}
function bn(e, t) {
	if ($) {
		let n = $.provides, r = $.parent && $.parent.provides;
		r === n && (n = $.provides = Object.create(r)), n[e] = t;
	}
}
function xn(e, t, n = !1) {
	let r = Wi();
	if (r || Or) {
		let i = Or ? Or._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var Sn = /* @__PURE__ */ Symbol.for("v-scx"), Cn = () => xn(Sn);
function wn(e, t, n) {
	return Tn(e, t, n);
}
function Tn(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (Xi) {
		if (c === "sync") {
			let e = Cn();
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
		q(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : ln(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Xt(e, n, u);
	return Xi && (f ? f.push(h) : d && h()), h;
}
function En(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? Dn(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = qi(this), s = Tn(i, a.bind(r), n);
	return o(), s;
}
function Dn(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var On = /* @__PURE__ */ Symbol("_vte"), kn = (e) => e.__isTeleport, An = /* @__PURE__ */ Symbol("_leaveCb");
function jn(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== vi) {
			t = n;
			break;
		}
	}
	return t;
}
function Mn(e) {
	if (!Vn(e)) return kn(e.type) && e.children ? jn(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Nn(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Nn(kn(n.type) && Mn(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Pn(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Fn(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function In(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Ln = /* @__PURE__ */ new WeakMap();
function Rn(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Rn(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (Bn(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Rn(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? ra(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ z(v), b = v === t ? i : (e) => !In(_, e) && u(y, e), x = (e, t) => !(t && In(_, t));
	if (m != null && m !== p) {
		if (zn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ V(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) Qt(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ V(p);
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
					i(), Ln.delete(e);
				};
				t.id = -1, Ln.set(e, t), q(t, r);
			} else zn(e), i();
		}
	}
}
function zn(e) {
	let t = Ln.get(e);
	t && (t.flags |= 8, Ln.delete(e));
}
se().requestIdleCallback, se().cancelIdleCallback;
var Bn = (e) => !!e.type.__asyncLoader, Vn = (e) => e.type.__isKeepAlive;
function Hn(e, t) {
	Wn(e, "a", t);
}
function Un(e, t) {
	Wn(e, "da", t);
}
function Wn(e, t, n = $) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Kn(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Vn(e.parent.vnode) && Gn(r, t, n, e), e = e.parent;
	}
}
function Gn(e, t, n, r) {
	let i = Kn(t, e, r, !0);
	$n(() => {
		c(r[t], i);
	}, n);
}
function Kn(e, t, n = $, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			ze();
			let i = qi(n), a = H(t, n, e, r);
			return i(), Be(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var qn = (e) => (t, n = $) => {
	(!Xi || e === "sp") && Kn(e, (...e) => t(...e), n);
}, Jn = qn("bm"), Yn = qn("m"), Xn = qn("bu"), Zn = qn("u"), Qn = qn("bum"), $n = qn("um"), er = qn("sp"), tr = qn("rtg"), nr = qn("rtc");
function rr(e, t = $) {
	Kn("ec", e, t);
}
var ir = /* @__PURE__ */ Symbol.for("v-ndc");
function ar(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ Nt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ R(e), s = /* @__PURE__ */ Pt(e), e = Qe(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Lt(B(e[n])) : B(e[n]) : e[n], n, void 0, a && a[n]);
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
var or = (e) => e ? Yi(e) ? ra(e) : or(e.parent) : null, sr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => or(e.parent),
	$root: (e) => or(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => gr(e),
	$forceUpdate: (e) => e.f ||= () => {
		ln(e.update);
	},
	$nextTick: (e) => e.n ||= sn.bind(e.proxy),
	$watch: (e) => En.bind(e)
}), cr = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), lr = {
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
			else if (cr(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else dr && (s[n] = 0);
		}
		let d = sr[n], f, p;
		if (d) return n === "$attrs" && I(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return cr(a, n) ? (a[n] = r, !0) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) || n[0] === "$" && n.slice(1) in e ? !1 : (o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || cr(n, c) || u(o, c) || u(i, c) || u(sr, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function ur(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var dr = !0;
function fr(e) {
	let t = gr(e), n = e.proxy, i = e.ctx;
	dr = !1, t.beforeCreate && mr(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: ee, renderTracked: T, renderTriggered: te, errorCaptured: E, serverPrefetch: ne, expose: D, inheritAttrs: re, components: O, directives: k, filters: ie } = t;
	if (u && pr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ kt(t));
	}
	if (dr = !0, o) for (let e in o) {
		let t = o[e], a = aa({
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
	if (c) for (let e in c) hr(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			bn(t, e[t]);
		});
	}
	f && mr(f, e, "c");
	function A(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (A(Jn, p), A(Yn, m), A(Xn, g), A(Zn, _), A(Hn, y), A(Un, b), A(rr, E), A(nr, T), A(tr, te), A(Qn, S), A($n, w), A(er, ne), d(D)) {
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
	ee && e.render === r && (e.render = ee), re != null && (e.inheritAttrs = re), O && (e.components = O), k && (e.directives = k), ne && Fn(e);
}
function pr(e, t, n = r) {
	d(e) && (e = xr(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? xn(r.from || n, r.default, !0) : xn(r.from || n) : xn(r), /* @__PURE__ */ V(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function mr(e, t, n) {
	H(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function hr(e, t, n, r) {
	let i = r.includes(".") ? Dn(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) && wn(i, n);
	} else if (h(e)) wn(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => hr(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) && wn(i, r, e);
		}
	}
}
function gr(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => _r(c, e, o, !0)), _r(c, t, o)), v(t) && a.set(t, c), c;
}
function _r(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && _r(e, a, n, !0), i && i.forEach((t) => _r(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = vr[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var vr = {
	data: yr,
	props: Cr,
	emits: Cr,
	methods: Sr,
	computed: Sr,
	beforeCreate: K,
	created: K,
	beforeMount: K,
	mounted: K,
	beforeUpdate: K,
	updated: K,
	beforeDestroy: K,
	beforeUnmount: K,
	destroyed: K,
	unmounted: K,
	activated: K,
	deactivated: K,
	errorCaptured: K,
	serverPrefetch: K,
	components: Sr,
	directives: Sr,
	watch: wr,
	provide: yr,
	inject: br
};
function yr(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function br(e, t) {
	return Sr(xr(e), xr(t));
}
function xr(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function K(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function Sr(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Cr(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), ur(e), ur(t ?? {})) : t;
}
function wr(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = K(e[r], t[r]);
	return n;
}
function Tr() {
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
var Er = 0;
function Dr(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = Tr(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: Er++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: oa,
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
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, ra(u.component);
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
				let t = Or;
				Or = l;
				try {
					return e();
				} finally {
					Or = t;
				}
			}
		};
		return l;
	};
}
var Or = null, kr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${E(t)}Modifiers`] || e[`${D(t)}Modifiers`];
function Ar(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && kr(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(ae)));
	let c, l = i[c = O(n)] || i[c = O(E(n))];
	!l && o && (l = i[c = O(D(n))]), l && H(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, H(u, e, 6, a);
	}
}
var jr = /* @__PURE__ */ new WeakMap();
function Mr(e, t, n = !1) {
	let r = n ? jr : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Mr(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Nr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, D(t)) || u(e, t));
}
function Pr(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = _n(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = Z(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = Z(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Fr(c);
		}
	} catch (t) {
		bi.length = 0, $t(t, e, 1), v = Mi(vi);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Ir(y, a)), b = Fi(b, y, !1, !0));
	}
	return n.dirs && (b = Fi(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Nn(kn(b.type) && Mn(b) || b, n.transition), v = b, _n(_), v;
}
var Fr = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Ir = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function Lr(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Rr(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (zr(o, r, n) && !Nr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Rr(r, o, l) : !!o;
	return !1;
}
function Rr(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (zr(t, e, a) && !Nr(n, a)) return !0;
	}
	return !1;
}
function zr(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !ve(r, i) : r !== i;
}
function Br({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Vr = {}, Hr = () => Object.create(Vr), Ur = (e) => Object.getPrototypeOf(e) === Vr;
function Wr(e, t, n, r = !1) {
	let i = {}, a = Hr();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), Kr(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ At(i) : e.type.props ? i : a, e.attrs = a;
}
function Gr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ z(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Nr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = E(o);
						i[t] = qr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		Kr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = D(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = qr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Xe(e.attrs, "set", "");
}
function Kr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (ee(t)) continue;
		let l = n[t], d;
		a && u(a, d = E(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Nr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ z(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = qr(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function qr(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = qi(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === D(n)) && (r = !0));
	}
	return r;
}
var Jr = /* @__PURE__ */ new WeakMap();
function Yr(e, r, i = !1) {
	let a = i ? Jr : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = Yr(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = E(c[e]);
		Xr(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = E(e);
		if (Xr(t)) {
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
function Xr(e) {
	return e[0] !== "$" && !ee(e);
}
var Zr = (e) => e === "_" || e === "_ctx" || e === "$stable", Qr = (e) => d(e) ? e.map(Z) : [Z(e)], $r = (e, t, n) => {
	if (t._n) return t;
	let r = vn((...e) => Qr(t(...e)), n);
	return r._c = !1, r;
}, ei = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (Zr(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = $r(n, i, r);
		else if (i != null) {
			let e = Qr(i);
			t[n] = () => e;
		}
	}
}, ti = (e, t) => {
	let n = Qr(t);
	e.slots.default = () => n;
}, ni = (e, t, n) => {
	for (let r in t) (n || !Zr(r)) && (e[r] = t[r]);
}, ri = (e, t, n) => {
	let r = e.slots = Hr();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (ni(r, t, n), n && A(r, "_", e, !0)) : ei(t, r);
	} else t && ti(e, t);
}, ii = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : ni(a, n, r) : (o = !n.$stable, ei(n, a)), s = n;
	} else n && (ti(e, n), s = { default: 1 });
	if (o) for (let e in a) !Zr(e) && s[e] == null && delete a[e];
}, q = gi;
function ai(e) {
	return oi(e);
}
function oi(e, i) {
	let a = se();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !ki(e, t) && (r = _e(e), j(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case _i:
				y(e, t, n, r);
				break;
			case vi:
				b(e, t, n, r);
				break;
			case yi:
				e ?? x(t, n, r, o);
				break;
			case J:
				O(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? k(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, M);
		}
		u != null && i ? Rn(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Rn(e.ref, null, a, e, !0);
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
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) T(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), ne(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, T = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && E(e.children, d, null, r, i, si(e, a), s, u), _ && yn(e, null, r, "created"), te(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !ee(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Q(f, r, e);
		}
		_ && yn(e, null, r, "beforeMount");
		let v = li(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && q(() => {
			try {
				f && Q(f, r, e), v && g.enter(d), _ && yn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, te = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || hi(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				te(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, E = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? Ri(e[l]) : Z(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, ne = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && ci(r, !1), (g = h.onVnodeBeforeUpdate) && Q(g, r, n, e), f && yn(n, e, r, "beforeUpdate"), r && ci(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? D(e.dynamicChildren, d, l, r, i, si(n, a), o) : s || le(e, n, l, null, r, i, si(n, a), o, !1), u > 0) {
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
		((g = h.onVnodeUpdated) || f) && q(() => {
			g && Q(g, r, n, e), f && yn(n, e, r, "updated");
		}, i);
	}, D = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === J || !ki(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, re = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !ee(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (ee(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, O = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), E(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (D(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && ui(e, t, !0)) : le(e, t, n, f, i, a, s, c, l);
	}, k = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : A(t, n, r, i, a, o, c) : ae(e, t, c);
	}, A = (e, t, n, r, i, a, o) => {
		let s = e.component = Ui(e, r, i);
		if (Vn(e) && (s.ctx.renderer = M), Zi(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, oe, o), !e.el) {
				let r = s.subTree = Mi(vi);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else oe(s, e, t, n, i, a, o);
	}, ae = (e, t, n) => {
		let r = t.component = e.component;
		if (Lr(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				ce(r, t, n);
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, r.vnode = t;
	}, oe = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = fi(e);
					if (n) {
						t && (t.el = c.el, ce(e, t, o)), n.asyncDep.then(() => {
							q(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				ci(e, !1), t ? (t.el = c.el, ce(e, t, o)) : t = c, n && ie(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Q(d, s, t, c), ci(e, !0);
				let f = Pr(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), _e(p), e, i, a), t.el = f.el, u === null && Br(e, f.el), r && q(r, i), (d = t.props && t.props.onVnodeUpdated) && q(() => Q(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Bn(t);
				if (ci(e, !1), l && ie(l), !m && (o = c && c.onVnodeBeforeMount) && Q(o, d, t), ci(e, !0), s && xe) {
					let t = () => {
						e.subTree = Pr(e), xe(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Pr(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && q(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					q(() => Q(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Bn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && q(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Te(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => ln(u), ci(e, !0), l();
	}, ce = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, Gr(e, t.props, r, n), ii(e, t.children, n), ze(), fn(e), Be();
	}, le = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, u = e ? e.shapeFlag : 0, d = t.children, { patchFlag: f, shapeFlag: m } = t;
		if (f > 0) {
			if (f & 128) {
				de(l, d, n, r, i, a, o, s, c);
				return;
			}
			if (f & 256) {
				ue(l, d, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (u & 16 && ge(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? de(l, d, n, r, i, a, o, s, c) : ge(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && E(d, n, r, i, a, o, s, c));
	}, ue = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? Ri(t[p]) : Z(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? ge(e, a, o, !0, !1, f) : E(t, r, i, a, o, s, c, l, f);
	}, de = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? Ri(t[u]) : Z(t[u]);
			if (ki(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? Ri(t[p]) : Z(t[p]);
			if (ki(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? Ri(t[u]) : Z(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) j(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? Ri(t[u]) : Z(t[u]);
				e.key != null && g.set(e.key, u);
			}
			let _, y = 0, b = p - h + 1, x = !1, S = 0, C = Array(b);
			for (u = 0; u < b; u++) C[u] = 0;
			for (u = m; u <= f; u++) {
				let n = e[u];
				if (y >= b) {
					j(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && ki(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? j(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? di(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || mi(f) : i;
				C[u] === 0 ? v(null, n, r, p, a, o, s, c, l) : x && (_ < 0 || u !== w[_] ? fe(n, r, p, 2) : _--);
			}
		}
	}, fe = (e, t, n, r, i = null) => {
		let { el: a, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) {
			fe(e.component.subTree, t, n, r);
			return;
		}
		if (d & 128) {
			e.suspense.move(t, n, r);
			return;
		}
		if (d & 64) {
			c.move(e, t, n, M);
			return;
		}
		if (c === J) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) fe(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === yi) {
			S(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[An] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), q(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[An];
					a._isLeaving && a[An](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, j = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (ze(), Rn(s, null, n, e, !0), Be()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Bn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Q(_, t, e), u & 6) he(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && yn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, M, r) : l && !l.hasOnce && (a !== J || d > 0 && d & 64) ? ge(l, t, n, !1, !0) : (a === J && d & 384 || !i && u & 16) && ge(c, t, n), r && pe(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && q(() => {
			_ && Q(_, t, e), h && yn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, pe = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === J) {
			me(n, r);
			return;
		}
		if (t === yi) {
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
	}, me = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, he = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		pi(c), pi(l), r && ie(r), i.stop(), a && (a.flags |= 8, j(o, e, t, n)), s && q(s, t), q(() => {
			e.isUnmounted = !0;
		}, t);
	}, ge = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) j(e[o], t, n, r, i);
	}, _e = (e) => {
		if (e.shapeFlag & 6) return _e(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[On];
		return n ? h(n) : t;
	}, ve = !1, ye = (e, t, n) => {
		let r;
		e == null ? t._vnode && (j(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, ve ||= (ve = !0, fn(r), pn(), !1);
	}, M = {
		p: v,
		um: j,
		m: fe,
		r: pe,
		mt: A,
		mc: E,
		pc: le,
		pbc: D,
		n: _e,
		o: e
	}, be, xe;
	return i && ([be, xe] = i(M)), {
		render: ye,
		hydrate: be,
		createApp: Dr(ye, be)
	};
}
function si({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function ci({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function li(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function ui(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = Ri(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && ui(t, a)), a.type === _i && (a.patchFlag === -1 && (a = i[e] = Ri(a)), a.el = t.el), a.type === vi && !a.el && (a.el = t.el);
	}
}
function di(e) {
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
function fi(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : fi(t);
}
function pi(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function mi(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? mi(t.subTree) : null;
}
var hi = (e) => e.__isSuspense;
function gi(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : dn(e);
}
var J = /* @__PURE__ */ Symbol.for("v-fgt"), _i = /* @__PURE__ */ Symbol.for("v-txt"), vi = /* @__PURE__ */ Symbol.for("v-cmt"), yi = /* @__PURE__ */ Symbol.for("v-stc"), bi = [], Y = null;
function xi(e = !1) {
	bi.push(Y = e ? null : []);
}
function Si() {
	bi.pop(), Y = bi[bi.length - 1] || null;
}
var Ci = 1;
function wi(e, t = !1) {
	Ci += e, e < 0 && Y && t && (Y.hasOnce = !0);
}
function Ti(e) {
	return e.dynamicChildren = Ci > 0 ? Y || n : null, Si(), Ci > 0 && Y && Y.push(e), e;
}
function Ei(e, t, n, r, i, a) {
	return Ti(X(e, t, n, r, i, a, !0));
}
function Di(e, t, n, r, i) {
	return Ti(Mi(e, t, n, r, i, !0));
}
function Oi(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function ki(e, t) {
	return e.type === t.type && e.key === t.key;
}
var Ai = ({ key: e }) => e ?? null, ji = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ V(e) || h(e) ? {
	i: G,
	r: e,
	k: t,
	f: !!n
} : e);
function X(e, t = null, n = null, r = 0, i = null, a = e === J ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && Ai(t),
		ref: t && ji(t),
		scopeId: gn,
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
		ctx: G
	};
	return s ? (zi(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), Ci > 0 && !o && Y && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && Y.push(c), c;
}
var Mi = Ni;
function Ni(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === ir) && (e = vi), Oi(e)) {
		let r = Fi(e, t, !0);
		return n && zi(r, n), Ci > 0 && !a && Y && (r.shapeFlag & 6 ? Y[Y.indexOf(e)] = r : Y.push(r)), r.patchFlag = -2, r;
	}
	if (ia(e) && (e = e.__vccOpts), t) {
		t = Pi(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = j(e)), v(n) && (/* @__PURE__ */ Ft(n) && !d(n) && (n = s({}, n)), t.style = ce(n));
	}
	let o = g(e) ? 1 : hi(e) ? 128 : kn(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return X(e, t, n, r, i, o, a, !0);
}
function Pi(e) {
	return e ? /* @__PURE__ */ Ft(e) || Ur(e) ? s({}, e) : e : null;
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
		patchFlag: t && e.type !== J ? o === -1 ? 16 : o | 16 : o,
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
	return c && r && Nn(u, c.clone(u)), u;
}
function Ii(e = " ", t = 0) {
	return Mi(_i, null, e, t);
}
function Li(e = "", t = !1) {
	return t ? (xi(), Di(vi, null, e)) : Mi(vi, null, e);
}
function Z(e) {
	return e == null || typeof e == "boolean" ? Mi(vi) : d(e) ? Mi(J, null, e.slice()) : Oi(e) ? Ri(e) : Mi(_i, null, String(e));
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
			!r && !Ur(t) ? t._ctx = G : r === 3 && G && (G.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			zi(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: G
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Ii(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function Bi(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = j([t.class, r.class]));
		else if (e === "style") t.style = ce([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function Q(e, t, n, r = null) {
	H(e, t, 7, [n, r]);
}
var Vi = Tr(), Hi = 0;
function Ui(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || Vi, o = {
		uid: Hi++,
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
		scope: new Se(!0),
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
		propsOptions: Yr(i, a),
		emitsOptions: Mr(i, a),
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
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = Ar.bind(null, o), e.ce && e.ce(o), o;
}
var $ = null, Wi = () => $ || G, Gi, Ki;
{
	let e = se(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	Gi = t("__VUE_INSTANCE_SETTERS__", (e) => $ = e), Ki = t("__VUE_SSR_SETTERS__", (e) => Xi = e);
}
var qi = (e) => {
	let t = $;
	return Gi(e), e.scope.on(), () => {
		e.scope.off(), Gi(t);
	};
}, Ji = () => {
	$ && $.scope.off(), Gi(null);
};
function Yi(e) {
	return e.vnode.shapeFlag & 4;
}
var Xi = !1;
function Zi(e, t = !1, n = !1) {
	t && Ki(t);
	let { props: r, children: i } = e.vnode, a = Yi(e);
	Wr(e, r, a, t), ri(e, i, n || t);
	let o = a ? Qi(e, t) : void 0;
	return t && Ki(!1), o;
}
function Qi(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, lr);
	let { setup: r } = n;
	if (r) {
		ze();
		let n = e.setupContext = r.length > 1 ? na(e) : null, i = qi(e), a = Qt(r, e, 0, [e.props, n]), o = y(a);
		if (Be(), i(), (o || e.sp) && !Bn(e) && Fn(e), o) {
			if (a.then(Ji, Ji), t) return a.then((n) => {
				Ki(!0);
				try {
					$i(e, n, t);
				} finally {
					Ki(!1);
				}
			}).catch((t) => {
				$t(t, e, 0);
			});
			e.asyncDep = a;
		} else $i(e, a, t);
	} else ea(e, t);
}
function $i(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Ut(t)), ea(e, n);
}
function ea(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = qi(e);
		ze();
		try {
			fr(e);
		} finally {
			Be(), t();
		}
	}
}
var ta = { get(e, t) {
	return I(e, "get", ""), e[t];
} };
function na(e) {
	return {
		attrs: new Proxy(e.attrs, ta),
		slots: e.slots,
		emit: e.emit,
		expose: (t) => {
			e.exposed = t || {};
		}
	};
}
function ra(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(Ut(It(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in sr) return sr[n](e);
		},
		has(e, t) {
			return t in e || t in sr;
		}
	}) : e.proxy;
}
function ia(e) {
	return h(e) && "__vccOpts" in e;
}
var aa = (e, t) => /* @__PURE__ */ Gt(e, t, Xi), oa = "3.5.42", sa = void 0, ca = typeof window < "u" && window.trustedTypes;
if (ca) try {
	sa = /* @__PURE__ */ ca.createPolicy("vue", { createHTML: (e) => e });
} catch {}
var la = sa ? (e) => sa.createHTML(e) : (e) => e, ua = "http://www.w3.org/2000/svg", da = "http://www.w3.org/1998/Math/MathML", fa = typeof document < "u" ? document : null, pa = fa && /* @__PURE__ */ fa.createElement("template"), ma = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? fa.createElementNS(ua, e) : t === "mathml" ? fa.createElementNS(da, e) : n ? fa.createElement(e, { is: n }) : fa.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => fa.createTextNode(e),
	createComment: (e) => fa.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => fa.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			pa.innerHTML = la(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = pa.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, ha = /* @__PURE__ */ Symbol("_vtc");
function ga(e, t, n) {
	let r = e[ha];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var _a = /* @__PURE__ */ Symbol("_vod"), va = /* @__PURE__ */ Symbol("_vsh"), ya = /* @__PURE__ */ Symbol(""), ba = /(?:^|;)\s*display\s*:/;
function xa(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? Ca(r, t, "");
			}
			else for (let e in t) n[e] ?? Ca(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? Ca(r, i, "") : Da(e, i, !g(t) && t ? t[i] : void 0, o) || Ca(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[ya];
			e && (n += ";" + e), r.cssText = n, a = ba.test(n);
		}
	} else t && e.removeAttribute("style");
	_a in e && (e[_a] = a ? r.display : "", e[va] && (r.display = "none"));
}
var Sa = /\s*!important$/;
function Ca(e, t, n) {
	if (d(n)) n.forEach((n) => Ca(e, t, n));
	else if (n ??= "", t.startsWith("--")) Sa.test(n) ? e.setProperty(t, n.replace(Sa, ""), "important") : e.setProperty(t, n);
	else {
		let r = Ea(e, t);
		Sa.test(n) ? e.setProperty(D(r), n.replace(Sa, ""), "important") : e[r] = n;
	}
}
var wa = [
	"Webkit",
	"Moz",
	"ms"
], Ta = {};
function Ea(e, t) {
	let n = Ta[t];
	if (n) return n;
	let r = E(t);
	if (r !== "filter" && r in e) return Ta[t] = r;
	r = re(r);
	for (let n = 0; n < wa.length; n++) {
		let i = wa[n] + r;
		if (i in e) return Ta[t] = i;
	}
	return t;
}
function Da(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var Oa = "http://www.w3.org/1999/xlink";
function ka(e, t, n, r, i, a = me(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Oa, t.slice(6, t.length)) : e.setAttributeNS(Oa, t, n) : n == null || a && !he(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function Aa(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? la(n) : n);
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
		r === "boolean" ? n = he(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch {}
	o && e.removeAttribute(i || t);
}
function ja(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function Ma(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var Na = /* @__PURE__ */ Symbol("_vei");
function Pa(e, t, n, r, i = null) {
	let a = e[Na] || (e[Na] = {}), o = a[t];
	if (r && o) o.value = r;
	else {
		let [n, s] = La(t);
		r ? ja(e, n, a[t] = Va(r, i), s) : o && (Ma(e, n, o, s), a[t] = void 0);
	}
}
var Fa = /(Once|Passive|Capture)$/, Ia = /^on:?(?:Once|Passive|Capture)$/;
function La(e) {
	let t, n;
	for (; (n = e.match(Fa)) && !Ia.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : D(e.slice(2)), t];
}
var Ra = 0, za = /* @__PURE__ */ Promise.resolve(), Ba = () => Ra ||= (za.then(() => Ra = 0), Date.now());
function Va(e, t) {
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
	return n.value = e, n.attached = Ba(), n;
}
var Ha = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Ua = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? ga(e, r, c) : t === "style" ? xa(e, n, r) : a(t) ? o(t) || Pa(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Wa(e, t, r, c)) ? (Aa(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && ka(e, t, r, c, s, t !== "value")) : e._isVueCE && (Ga(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? Aa(e, E(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), ka(e, t, r, c));
};
function Wa(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && Ha(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return Ha(t) && g(n) ? !1 : t in e;
}
function Ga(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = E(t);
	return Array.isArray(n) ? n.some((e) => E(e) === r) : Object.keys(n).some((e) => E(e) === r);
}
var Ka = [
	"ctrl",
	"shift",
	"alt",
	"meta"
], qa = {
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
	exact: (e, t) => Ka.some((n) => e[`${n}Key`] && !t.includes(n))
}, Ja = (e, t) => {
	if (!e) return e;
	let n = e._withMods ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n, ...r) => {
		for (let e = 0; e < t.length; e++) {
			let r = qa[t[e]];
			if (r && r(n, t)) return;
		}
		return e(n, ...r);
	}));
}, Ya = /* @__PURE__ */ s({ patchProp: Ua }, ma), Xa;
function Za() {
	return Xa ||= ai(Ya);
}
var Qa = ((...e) => {
	let t = Za().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = eo(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, $a(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function $a(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function eo(e) {
	return g(e) ? document.querySelector(e) : e;
}
//#endregion
//#region src/palette.ts
function to(e, t, n) {
	return `hsl(${Math.round(e)} ${Math.round(t)}% ${Math.round(n)}%)`;
}
function no(e, t, n, r) {
	return `hsl(${Math.round(e)} ${Math.round(t)}% ${Math.round(n)}% / ${r})`;
}
function ro(e, t, n) {
	let r = (e) => {
		let t = e / 255;
		return t <= .03928 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
	};
	return .2126 * r(e) + .7152 * r(t) + .0722 * r(n);
}
function io(e, t, n) {
	e /= 255, t /= 255, n /= 255;
	let r = Math.max(e, t, n), i = Math.min(e, t, n), a = 0, o = 0, s = (r + i) / 2, c = r - i;
	return c && (o = c / (1 - Math.abs(2 * s - 1)), a = r === e ? 60 * ((t - n) / c % 6) : r === t ? 60 * ((n - e) / c + 2) : 60 * ((e - t) / c + 4)), [
		(a + 360) % 360,
		o * 100,
		s * 100
	];
}
async function ao(e) {
	if (!(e instanceof Blob)) throw TypeError("壁纸数据无效");
	let t = await createImageBitmap(e), n = document.createElement("canvas");
	n.width = 64, n.height = 64;
	let r = n.getContext("2d", { willReadFrequently: !0 });
	if (!r) throw t.close?.(), Error("无法读取壁纸像素");
	r.drawImage(t, 0, 0, 64, 64), t.close?.();
	let i = r.getImageData(0, 0, 64, 64).data, a = 0, o = 0, s = 0, c = 0;
	for (let e = 0; e < i.length; e += 4) {
		let t = i[e + 3] / 255;
		a += i[e] * t, o += i[e + 1] * t, s += i[e + 2] * t, c += t;
	}
	a = Math.round(a / Math.max(1, c)), o = Math.round(o / Math.max(1, c)), s = Math.round(s / Math.max(1, c));
	let l = ro(a, o, s) < .42, [u, d] = io(a, o, s), f = Math.max(10, Math.min(32, d * .34 + 8));
	return {
		"--accent": to(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42),
		"--accent-strong": to(u, Math.max(52, Math.min(84, d + 25)), l ? 74 : 34),
		"--accent-alt": to((u + 32) % 360, 64, l ? 68 : 38),
		"--accent-soft": no(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42, l ? .2 : .18),
		"--on-accent": "#ffffff",
		"--mask": l ? "rgba(4, 10, 20, .44)" : "rgba(255, 255, 255, .42)",
		"--focus": `0 0 0 3px ${no(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42, .32)}`,
		"--wallpaper-card-dark": to(u, f, 16),
		"--wallpaper-card-dark-soft": to(u, Math.min(36, f + 2), 21),
		"--wallpaper-card-dark-hover": to(u, Math.min(40, f + 5), 26),
		"--wallpaper-card-dark-border": no(u, Math.min(44, f + 10), 64, .32),
		"--wallpaper-card-light": to(u, f, 97),
		"--wallpaper-card-light-soft": to(u, Math.min(36, f + 2), 93),
		"--wallpaper-card-light-hover": to(u, Math.min(40, f + 5), 89),
		"--wallpaper-card-light-border": no(u, Math.min(44, f + 10), 42, .24)
	};
}
//#endregion
//#region src/wallpaperApi.ts
function oo(e, t, n) {
	return e.api.blob("asset", {
		query: { id: t },
		signal: n
	});
}
function so(e, t) {
	return e.api.get("state", t);
}
function co(e, t, n) {
	return e.api.put("settings", t, n);
}
function lo(e, t, n) {
	return e.api.post("assets/delete", { id: t }, n);
}
function uo(e, t, n, r) {
	return e.api.put("assets/palette", {
		id: t,
		palette: n
	}, r);
}
function fo(e, t, n) {
	return e.api.post("rotation/advance", { reason: t }, n);
}
async function po(e, t, n) {
	let r = await e.api.upload("assets", t, {
		contentType: t.type || "application/octet-stream",
		query: { name: t.name },
		signal: n
	});
	return {
		asset: r?.asset,
		state: r?.state
	};
}
async function mo(e, t, n) {
	if (t.paletteVersion === 3 && t.palette && Object.keys(t.palette).length > 0) return t.palette;
	try {
		let r = await ao(n);
		return await uo(e, t.id, r), r;
	} catch {
		return null;
	}
}
//#endregion
//#region src/WallpaperSettings.vue?vue&type=script&setup=true&lang.ts
var ho = [
	"title",
	"description",
	"expanded"
], go = { class: "cw-body" }, _o = { class: "cw-status-row" }, vo = { class: "cw-muted" }, yo = ["tone"], bo = { class: "cw-switch-list" }, xo = [
	"label",
	"description",
	"model-value",
	"aria-label"
], So = [
	"label",
	"description",
	"model-value",
	"aria-label"
], Co = { class: "cw-grid cw-controls" }, wo = ["data-help"], To = { class: "cw-field-label" }, Eo = [
	"model-value",
	"options",
	"aria-label"
], Do = ["data-help"], Oo = { class: "cw-field-label" }, ko = ["model-value", "aria-label"], Ao = { class: "cw-grid cw-effects" }, jo = ["data-help"], Mo = { class: "cw-field-label" }, No = { class: "cw-range-row" }, Po = ["model-value", "aria-label"], Fo = ["data-help"], Io = { class: "cw-field-label" }, Lo = { class: "cw-range-row" }, Ro = ["model-value", "aria-label"], zo = ["data-help"], Bo = { class: "cw-field-label" }, Vo = { class: "cw-range-row" }, Ho = ["model-value", "aria-label"], Uo = { class: "cw-upload-row" }, Wo = ["label"], Go = { class: "cw-muted" }, Ko = { class: "cw-list" }, qo = {
	key: 0,
	class: "cw-muted cw-empty"
}, Jo = ["onDrop"], Yo = [
	"aria-label",
	"title",
	"onDragstart"
], Xo = ["src", "alt"], Zo = {
	key: 1,
	class: "cw-thumb-placeholder",
	"aria-hidden": "true"
}, Qo = { class: "cw-item-copy" }, $o = { class: "cw-muted" }, es = ["onClick"], ts = { class: "cw-card-footer" }, ns = { class: "cw-muted" }, rs = {
	key: 0,
	class: "cw-error"
}, is = "custom-wallpaper", as = "nxp-settings-panel-toggle", os = "nxp-settings-panel-state", ss = /* @__PURE__ */ Pn({
	__name: "WallpaperSettings",
	props: {
		host: {},
		context: {}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ Rt(null), r = /* @__PURE__ */ Rt(!1), i = /* @__PURE__ */ Rt(""), a = /* @__PURE__ */ Rt("muted"), o = /* @__PURE__ */ Rt(""), s = /* @__PURE__ */ Rt(""), c = /* @__PURE__ */ Rt({}), l = null, u = null, d = null, f = !1, p = aa(() => [
			{
				value: "timer",
				label: _("rotation.timer", {}, "按时间随机轮换")
			},
			{
				value: "startup",
				label: _("rotation.startup", {}, "每次启动 Web 随机轮换")
			},
			{
				value: "off",
				label: _("rotation.off", {}, "不轮换")
			}
		]), m = aa(() => {
			let e = n.value?.assets || [], t = new Map(e.map((e) => [e.id, e]));
			return [.../* @__PURE__ */ new Set([...n.value?.order || [], ...e.map((e) => e.id)])].map((e) => t.get(e)).filter((e) => !!e);
		}), h = aa(() => n.value?.enabled === !0), g = aa(() => n.value?.effects?.applyTransparencyToSecondarySurfaces !== !1);
		function _(e, n = {}, r = "") {
			return t.host.i18n.t(e, n, r);
		}
		function v(e, t = "muted") {
			i.value = e, a.value = t;
		}
		function y(e, t, n) {
			let r = e?.code || "", i = {
				invalid_type: _("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"),
				too_large: _("error.size", {}, "壁纸文件不能超过 8192 KB"),
				quota_count: _("error.count", {}, "壁纸数量不能超过 32 张"),
				quota_total: _("error.total", {}, "壁纸总容量不能超过 256 MiB"),
				invalid_image: _("error.image", {}, "壁纸文件内容与声明类型不匹配"),
				invalid_config: _("error.config", {}, "壁纸设置无效"),
				invalid_asset: _("error.asset", {}, "壁纸资源无效"),
				not_found: _("error.not_found", {}, "壁纸资源不存在"),
				invalid_palette: _("error.palette", {}, "壁纸配色无效")
			};
			return i[r] ? i[r] : r ? _("error.generic", { code: r }, `操作失败：${r}`) : _(t, {}, n);
		}
		function b(e) {
			let t = Number(e) || 0;
			return t < 1048576 ? `${Math.max(1, Math.round(t / 1024))} KiB` : `${(t / 1024 / 1024).toFixed(1)} MiB`;
		}
		function x(e) {
			window.dispatchEvent(new CustomEvent(as, { detail: { panelId: e } }));
		}
		function S(e) {
			r.value = e, x(e ? is : null);
		}
		function C(e) {
			let t = e.detail?.panelId;
			(t === null || typeof t == "string") && (r.value = t === is);
		}
		async function w(e = []) {
			let t = new Set(e);
			Object.entries(c.value).forEach(([e, n]) => {
				t.has(e) || (URL.revokeObjectURL(n), delete c.value[e]);
			});
		}
		async function ee(e) {
			await w(e.map((e) => e.id));
			for (let n of e) if (!c.value[n.id]) try {
				let e = await oo(t.host, n.id);
				if (f) return;
				c.value = {
					...c.value,
					[n.id]: URL.createObjectURL(e)
				};
			} catch {}
		}
		async function T(e) {
			if (!e?.effectiveEnabled || !e.currentId) {
				t.host.appearance.clearBackground(), t.host.appearance.clearTokens();
				return;
			}
			let n = (e.assets || []).find((t) => t.id === e.currentId);
			if (!n) {
				t.host.appearance.clearBackground(), t.host.appearance.clearTokens();
				return;
			}
			try {
				let r = await oo(t.host, n.id);
				if (f) return;
				let i = URL.createObjectURL(r);
				t.host.appearance.setBackground({
					url: i,
					blurPx: e.effects?.blurPx,
					dimPercent: e.effects?.dimPercent,
					surfaceTransparencyPercent: e.effects?.surfaceTransparencyPercent,
					secondarySurfaceTransparency: e.effects?.applyTransparencyToSecondarySurfaces !== !1
				});
				let a = await mo(t.host, n, r);
				if (f) return;
				a && t.host.appearance.setTokens(a), te(e);
			} catch (e) {
				o.value = e instanceof Error ? e.message : String(e);
			}
		}
		function te(e) {
			u && clearTimeout(u), u = null;
			let t = e.rotation?.nextSwitchAt;
			if (e.rotation?.mode !== "timer" || !t) return;
			let n = Math.max(1e3, new Date(t).getTime() - Date.now());
			u = setTimeout(() => {
				E("timer");
			}, n);
		}
		async function E(e = "") {
			try {
				let r = e === "startup" ? await fo(t.host, "startup") : await so(t.host);
				if (f) return;
				n.value = r, v(r.effectiveEnabled ? _("status.enabled", {}, "已启用") : _("status.disabled", {}, "未启用"), r.effectiveEnabled ? "ok" : "muted"), await T(r), await ee(r.assets || []);
			} catch (e) {
				v(_("status.read_failed", {}, "读取失败"), "bad"), o.value = e instanceof Error ? e.message : String(e);
			}
		}
		function ne(e, r) {
			n.value &&= r(n.value), l && clearTimeout(l), l = setTimeout(() => {
				l = null, (async () => {
					try {
						v(_("status.saving", {}, "保存中"), "blue");
						let r = await co(t.host, e);
						if (f) return;
						n.value = r, v(r.effectiveEnabled ? _("status.enabled", {}, "已启用") : _("status.disabled", {}, "未启用"), r.effectiveEnabled ? "ok" : "muted"), await T(r);
					} catch (e) {
						v(_("status.save_failed", {}, "保存失败"), "bad"), o.value = y(e, "status.save_failed", "保存失败"), await E();
					}
				})();
			}, 0);
		}
		function D() {
			let e = n.value || {};
			return {
				order: m.value.map((e) => e.id),
				selectedId: e.selectedId || "",
				rotation: {
					mode: e.rotation?.mode || "off",
					intervalMinutes: Number(e.rotation?.intervalMinutes) || 30,
					epochUnixMs: e.rotation?.epochUnixMs || Date.now()
				},
				effects: {
					blurPx: Number(e.effects?.blurPx) || 0,
					dimPercent: Number(e.effects?.dimPercent) || 0,
					surfaceTransparencyPercent: Number(e.effects?.surfaceTransparencyPercent) || 0,
					applyTransparencyToSecondarySurfaces: g.value
				}
			};
		}
		function re(e) {
			if (!n.value) return;
			if (e === "enabled") {
				let e = !h.value;
				ne({
					enabled: e,
					rotation: D().rotation
				}, (t) => ({
					...t,
					enabled: e,
					effectiveEnabled: e && (t.order?.length || 0) > 0
				}));
				return;
			}
			let t = !g.value;
			ne({ effects: {
				...D().effects,
				applyTransparencyToSecondarySurfaces: t
			} }, (e) => ({
				...e,
				effects: {
					...e.effects || {},
					applyTransparencyToSecondarySurfaces: t
				}
			}));
		}
		function O(e, t) {
			if (!n.value) return;
			let r = D();
			e === "mode" && (r.rotation.mode = String(t), r.rotation.epochUnixMs = Date.now()), e === "interval" && (r.rotation.intervalMinutes = Number(t) || 30), e === "blur" && (r.effects.blurPx = Number(t) || 0), e === "dim" && (r.effects.dimPercent = Number(t) || 0), e === "transparency" && (r.effects.surfaceTransparencyPercent = Number(t) || 0), ne(r, (e) => ({
				...e,
				rotation: {
					...e.rotation || {},
					...r.rotation
				},
				effects: {
					...e.effects || {},
					...r.effects
				}
			}));
		}
		async function k(e = []) {
			for (let r of e) {
				let e = n.value?.limits || {}, i = Number(e.maxAssets) || 32, a = Number(e.maxAssetBytes) || 8388608;
				if ((n.value?.assets?.length || 0) >= i) {
					t.host.ui.toast(_("error.count", {}, "壁纸数量不能超过 32 张"), "error");
					break;
				}
				if (![
					"image/jpeg",
					"image/png",
					"image/webp"
				].includes(String(r.type).toLowerCase())) {
					t.host.ui.toast(_("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"), "error");
					continue;
				}
				if (r.size > a) {
					t.host.ui.toast(_("error.size", {}, "壁纸文件不能超过 8192 KB"), "error");
					continue;
				}
				try {
					let e = await createImageBitmap(r), n = e.height > e.width;
					e.close?.(), n && t.host.ui.toast(_("warning.portrait", {}, "该图片可能在电脑上显示效果不佳"), "warn");
				} catch {}
				try {
					v(_("status.uploading", { name: r.name }, `上传中：${r.name}`), "blue");
					let e = await po(t.host, r);
					if (e.state && (n.value = e.state), e.asset) try {
						await mo(t.host, e.asset, r);
					} catch (e) {
						t.host.ui.toast(_("warning.palette", { error: e instanceof Error ? e.message : String(e) }, "壁纸已上传，配色稍后生成"), "warn");
					}
					await E();
				} catch (e) {
					v(_("status.upload_failed", {}, "上传失败"), "bad"), o.value = y(e, "status.upload_failed", "上传失败");
				}
			}
		}
		async function ie(e) {
			try {
				let r = await lo(t.host, e);
				if (f) return;
				let i = c.value[e];
				i && (URL.revokeObjectURL(i), delete c.value[e]), n.value = r, v(r.effectiveEnabled ? _("status.enabled", {}, "已启用") : _("status.disabled", {}, "未启用"), r.effectiveEnabled ? "ok" : "muted"), await T(r);
			} catch (e) {
				v(_("status.delete_failed", {}, "删除失败"), "bad"), o.value = y(e, "status.delete_failed", "删除失败");
			}
		}
		function A(e) {
			if (!s.value || s.value === e || !n.value) return;
			let t = m.value.map((e) => e.id).filter((e) => e !== s.value), r = t.indexOf(e);
			t.splice(r < 0 ? t.length : r, 0, s.value), s.value = "", ne({ order: t }, (e) => ({
				...e,
				order: t
			}));
		}
		return Yn(async () => {
			window.addEventListener(os, C), await E("startup"), d = setInterval(() => {
				(async () => {
					try {
						let e = await so(t.host);
						if (f || e.revision === n.value?.revision) return;
						n.value = e, v(e.effectiveEnabled ? _("status.enabled", {}, "已启用") : _("status.disabled", {}, "未启用"), e.effectiveEnabled ? "ok" : "muted"), await T(e), await ee(e.assets || []);
					} catch {}
				})();
			}, 3e4);
		}), Qn(() => {
			f = !0, window.removeEventListener(os, C), l && clearTimeout(l), u && clearTimeout(u), d && clearInterval(d), l = null, u = null, d = null, Object.values(c.value).forEach((e) => URL.revokeObjectURL(e)), c.value = {}, t.host.appearance.clearBackground(), t.host.appearance.clearTokens();
		}), (e, t) => (xi(), Ei("nxp-collapsible-card", {
			title: _("card.title", {}, "自定义壁纸"),
			description: _("card.description", {}, "同步壁纸、轮换方式和显示效果"),
			expanded: r.value,
			"panel-id": "settings-panel-custom-wallpaper",
			"data-settings-panel": "custom-wallpaper",
			"data-testid": "custom-wallpaper-card",
			onToggle: t[10] ||= (e) => S(e.detail?.[0] === !0)
		}, [X("div", go, [
			X("div", _o, [X("span", vo, M(_("settings.sync", {}, "服务端同步到当前 NexusPipeline 实例的全部浏览器。")), 1), X("nxp-badge", { tone: a.value }, M(i.value), 9, yo)]),
			X("div", bo, [X("nxp-switch-setting", {
				label: _("settings.enabled", {}, "启用自定义壁纸"),
				description: _("settings.enabled_help", {}, "启用后使用自定义壁纸作为页面背景。"),
				"model-value": h.value,
				"aria-label": _("settings.enabled", {}, "启用自定义壁纸"),
				onChange: t[0] ||= (e) => re("enabled")
			}, null, 40, xo), X("nxp-switch-setting", {
				label: _("settings.secondary", {}, "透明度运用于非主页面"),
				description: _("settings.secondary_help", {}, "关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。"),
				"model-value": g.value,
				"aria-label": _("settings.secondary", {}, "透明度运用于非主页面"),
				onChange: t[1] ||= (e) => re("secondary")
			}, null, 40, So)]),
			X("div", Co, [X("label", {
				class: "cw-field",
				"data-help": _("settings.rotation_help", {}, "按时间随机轮换会按设定间隔切换壁纸；每次启动 Web 随机轮换只在服务启动后选择一次。")
			}, [X("span", To, M(_("settings.rotation", {}, "轮换方式")), 1), X("nxp-select", {
				"model-value": n.value?.rotation?.mode || "off",
				options: p.value,
				"aria-label": _("settings.rotation", {}, "轮换方式"),
				onChange: t[2] ||= (e) => O("mode", e.detail?.[0] || e.target?.modelValue || "off")
			}, null, 40, Eo)], 8, wo), X("label", {
				class: "cw-field",
				"data-help": _("settings.interval_help", {}, "轮换方式为按时间随机轮换时生效，范围为 1 至 1440 分钟。")
			}, [X("span", Oo, M(_("settings.interval", {}, "轮换间隔（分钟）")), 1), X("nxp-number-input", {
				"model-value": n.value?.rotation?.intervalMinutes || 30,
				min: "1",
				max: "1440",
				step: "1",
				"aria-label": _("settings.interval", {}, "轮换间隔（分钟）"),
				onChange: t[3] ||= (e) => O("interval", e.detail?.[0] || e.target?.modelValue)
			}, null, 40, ko)], 8, Do)]),
			X("div", Ao, [
				X("label", {
					class: "cw-field",
					"data-help": _("settings.blur_help", {}, "模糊范围为 0 至 40 像素。")
				}, [X("span", Mo, M(_("settings.blur", {}, "模糊（像素）")), 1), X("span", No, [X("nxp-range", {
					"model-value": n.value?.effects?.blurPx || 0,
					min: "0",
					max: "40",
					step: "1",
					"aria-label": _("settings.blur", {}, "模糊（像素）"),
					onChange: t[4] ||= (e) => O("blur", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Po), X("output", null, M(n.value?.effects?.blurPx || 0) + "px", 1)])], 8, jo),
				X("label", {
					class: "cw-field",
					"data-help": _("settings.dim_help", {}, "变暗范围为 0 至 80%，用于调整壁纸与内容的对比度。")
				}, [X("span", Io, M(_("settings.dim", {}, "变暗")), 1), X("span", Lo, [X("nxp-range", {
					"model-value": n.value?.effects?.dimPercent ?? 20,
					min: "0",
					max: "80",
					step: "1",
					"aria-label": _("settings.dim", {}, "变暗"),
					onChange: t[5] ||= (e) => O("dim", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Ro), X("output", null, M(n.value?.effects?.dimPercent ?? 20) + "%", 1)])], 8, Fo),
				X("label", {
					class: "cw-field",
					"data-help": _("settings.transparency_help", {}, "控制页面卡片、侧边栏和其他表面的透明度，范围为 0 至 50%。")
				}, [X("span", Bo, M(_("settings.transparency", {}, "卡片与侧边栏透明度")), 1), X("span", Vo, [X("nxp-range", {
					"model-value": n.value?.effects?.surfaceTransparencyPercent || 0,
					min: "0",
					max: "50",
					step: "1",
					"aria-label": _("settings.transparency", {}, "卡片与侧边栏透明度"),
					onChange: t[6] ||= (e) => O("transparency", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Ho), X("output", null, M(n.value?.effects?.surfaceTransparencyPercent || 0) + "%", 1)])], 8, zo)
			]),
			X("div", Uo, [X("nxp-file-picker", {
				accept: "image/jpeg,image/png,image/webp",
				multiple: "",
				label: _("settings.add", {}, "添加壁纸"),
				onChange: t[7] ||= (e) => k(e.detail?.[0] || e.target?.files || [])
			}, null, 40, Wo), X("span", Go, M(_("settings.file_help", {}, "JPEG、PNG、WebP，单张最大 8192 KB")), 1)]),
			X("div", Ko, [m.value.length ? Li("", !0) : (xi(), Ei("p", qo, M(_("empty", {}, "尚未添加壁纸。")), 1)), (xi(!0), Ei(J, null, ar(m.value, (e) => (xi(), Ei("div", {
				key: e.id,
				class: j(["cw-item", { "is-dragging": s.value === e.id }]),
				onDragover: t[9] ||= Ja(() => {}, ["prevent"]),
				onDrop: (t) => A(e.id)
			}, [
				X("button", {
					class: "cw-drag-handle",
					type: "button",
					draggable: "true",
					"aria-label": `${_("drag", {}, "拖拽排序")}：${e.originalName || e.id}`,
					title: _("drag", {}, "拖拽排序"),
					onDragstart: Ja((t) => s.value = e.id, ["stop"]),
					onDragend: t[8] ||= (e) => s.value = ""
				}, "⠿", 40, Yo),
				c.value[e.id] ? (xi(), Ei("img", {
					key: 0,
					src: c.value[e.id],
					alt: e.originalName || e.id
				}, null, 8, Xo)) : (xi(), Ei("span", Zo)),
				X("div", Qo, [X("strong", null, M(e.originalName || e.id), 1), X("span", $o, M(b(e.sizeBytes)), 1)]),
				X("nxp-button", {
					tone: "danger",
					variant: "ghost",
					size: "sm",
					onClick: (t) => ie(e.id)
				}, M(_("remove", {}, "删除")), 9, es)
			], 42, Jo))), 128))]),
			X("div", ts, [X("span", ns, M(_("settings.max_help", {}, "最多 32 张，实例总容量 256 MiB。")), 1)]),
			o.value ? (xi(), Ei("p", rs, M(o.value), 1)) : Li("", !0)
		])], 40, ho));
	}
});
//#endregion
//#region src/main.ts
function cs(e) {
	return e.slots.register("settings.cards", (t) => {
		let n = Qa(ss, {
			host: e,
			context: t.context
		});
		return n.mount(t.element), () => n.unmount();
	});
}
//#endregion
export { cs as activate };
