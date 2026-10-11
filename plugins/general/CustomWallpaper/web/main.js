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
}, E = /-\w/g, D = T((e) => e.replace(E, (e) => e.slice(1).toUpperCase())), te = /\B([A-Z])/g, O = T((e) => e.replace(te, "-$1").toLowerCase()), ne = T((e) => e.charAt(0).toUpperCase() + e.slice(1)), re = T((e) => e ? `on${ne(e)}` : ""), k = (e, t) => !Object.is(e, t), ie = (e, ...t) => {
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
function H(e) {
	return Rt(e, !1);
}
function Rt(e, t) {
	return /* @__PURE__ */ V(e) ? e : new zt(e, t);
}
var zt = class {
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
function Bt(e) {
	return /* @__PURE__ */ V(e) ? e.value : e;
}
var Vt = {
	get: (e, t, n) => t === "__v_raw" ? e : Bt(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ V(i) && !/* @__PURE__ */ V(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Ht(e) {
	return /* @__PURE__ */ Nt(e) ? e : new Proxy(e, Vt);
}
var Ut = class {
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
function Wt(e, t, n = !1) {
	let r, i;
	return h(e) ? r = e : (r = e.get, i = e.set), new Ut(r, i, n);
}
var Gt = {}, Kt = /* @__PURE__ */ new WeakMap(), qt = void 0;
function Jt(e, t = !1, n = qt) {
	if (n) {
		let t = Kt.get(n);
		t || Kt.set(n, t = []), t.push(e);
	}
}
function Yt(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ R(e) || o === !1 || o === 0 ? Xt(e, 1) : Xt(e), m, g, _, v, y = !1, b = !1;
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
		let t = qt;
		qt = m;
		try {
			return f ? f(e, 3, [v]) : e(v);
		} finally {
			qt = t;
		}
	} : r, n && o) {
		let e = g, t = o === !0 ? Infinity : o;
		g = () => Xt(e(), t);
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
	let C = b ? Array(e.length).fill(Gt) : Gt, w = (e) => {
		if (m.flags & 1 && (m.dirty || e)) {
			if (n) {
				let t = m.run();
				if (e || o || y || (b ? t.some((e, t) => k(e, C[t])) : k(t, C))) {
					_ && _();
					let e = qt;
					qt = m;
					try {
						let e = [
							t,
							C === Gt ? void 0 : b && C[0] === Gt ? [] : C,
							v
						];
						C = t, f ? f(n, 3, e) : n(...e);
					} finally {
						qt = e;
					}
				}
			} else m.run();
		}
	};
	return u && u(w), m = new Te(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => Jt(e, !1, m), _ = m.onStop = () => {
		let e = Kt.get(m);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			Kt.delete(m);
		}
	}, n ? a ? w(!0) : C = m.run() : l ? l(w.bind(null, !0), !0) : m.run(), S.pause = m.pause.bind(m), S.resume = m.resume.bind(m), S.stop = S, S;
}
function Xt(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ V(e)) Xt(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) Xt(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		Xt(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) Xt(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && Xt(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
function Zt(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		Qt(e, t, n);
	}
}
function U(e, t, n, r) {
	if (h(e)) {
		let i = Zt(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			Qt(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(U(e[a], t, n, r));
		return i;
	}
}
function Qt(e, n, r, i = !0) {
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
			ze(), Zt(o, null, 10, [
				e,
				i,
				a
			]), Be();
			return;
		}
	}
	$t(e, r, a, i, s);
}
function $t(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var W = [], G = -1, en = [], tn = null, nn = 0, rn = /* @__PURE__ */ Promise.resolve(), an = null;
function on(e) {
	let t = an || rn;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function sn(e) {
	let t = G + 1, n = W.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = W[r], a = pn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function cn(e) {
	if (!(e.flags & 1)) {
		let t = pn(e), n = W[W.length - 1];
		!n || !(e.flags & 2) && t >= pn(n) ? W.push(e) : W.splice(sn(t), 0, e), e.flags |= 1, ln();
	}
}
function ln() {
	an ||= rn.then(mn);
}
function un(e) {
	if (!d(e)) tn && e.id === -1 ? tn.splice(nn + 1, 0, e) : e.flags & 1 || (en.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) en.push(e[t]);
	ln();
}
function dn(e, t, n = G + 1) {
	for (; n < W.length; n++) {
		let t = W[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			W.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
		}
	}
}
function fn(e) {
	if (en.length) {
		let e = [...new Set(en)].sort((e, t) => pn(e) - pn(t));
		if (en.length = 0, tn) {
			for (let t = 0; t < e.length; t++) tn.push(e[t]);
			return;
		}
		for (tn = e, nn = 0; nn < tn.length; nn++) {
			let e = tn[nn];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		tn = null, nn = 0;
	}
}
var pn = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function mn(e) {
	try {
		for (G = 0; G < W.length; G++) {
			let e = W[G];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), Zt(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; G < W.length; G++) {
			let e = W[G];
			e && (e.flags &= -2);
		}
		G = -1, W.length = 0, fn(e), an = null, (W.length || en.length) && mn(e);
	}
}
var K = null, hn = null;
function gn(e) {
	let t = K;
	return K = e, hn = e && e.type.__scopeId || null, t;
}
function _n(e, t = K, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && Ci(-1);
		let i = gn(t), a = yi.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = yi.length; e > a; e--) xi();
			gn(i), r._d && Ci(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function vn(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (ze(), U(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Be());
	}
}
function yn(e, t) {
	if ($) {
		let n = $.provides, r = $.parent && $.parent.provides;
		r === n && (n = $.provides = Object.create(r)), n[e] = t;
	}
}
function bn(e, t, n = !1) {
	let r = Wi();
	if (r || Dr) {
		let i = Dr ? Dr._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var xn = /* @__PURE__ */ Symbol.for("v-scx"), Sn = () => bn(xn);
function Cn(e, t, n) {
	return wn(e, t, n);
}
function wn(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (Xi) {
		if (c === "sync") {
			let e = Sn();
			f = e.__watcherHandles ||= [];
		} else if (!d) {
			let e = () => {};
			return e.stop = r, e.resume = r, e.pause = r, e;
		}
	}
	let p = $;
	u.call = (e, t, n) => U(e, p, t, n);
	let m = !1;
	c === "post" ? u.scheduler = (e) => {
		J(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : cn(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Yt(e, n, u);
	return Xi && (f ? f.push(h) : d && h()), h;
}
function Tn(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? En(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = qi(this), s = wn(i, a.bind(r), n);
	return o(), s;
}
function En(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var Dn = /* @__PURE__ */ Symbol("_vte"), On = (e) => e.__isTeleport, kn = /* @__PURE__ */ Symbol("_leaveCb");
function An(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== _i) {
			t = n;
			break;
		}
	}
	return t;
}
function jn(e) {
	if (!Bn(e)) return On(e.type) && e.children ? An(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Mn(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Mn(On(n.type) && jn(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Nn(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Pn(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function Fn(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var In = /* @__PURE__ */ new WeakMap();
function Ln(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Ln(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (zn(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Ln(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? ra(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ z(v), b = v === t ? i : (e) => !Fn(_, e) && u(y, e), x = (e, t) => !(t && Fn(_, t));
	if (m != null && m !== p) {
		if (Rn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ V(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) Zt(p, f, 12, [l, _]);
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
					i(), In.delete(e);
				};
				t.id = -1, In.set(e, t), J(t, r);
			} else Rn(e), i();
		}
	}
}
function Rn(e) {
	let t = In.get(e);
	t && (t.flags |= 8, In.delete(e));
}
se().requestIdleCallback, se().cancelIdleCallback;
var zn = (e) => !!e.type.__asyncLoader, Bn = (e) => e.type.__isKeepAlive;
function Vn(e, t) {
	Un(e, "a", t);
}
function Hn(e, t) {
	Un(e, "da", t);
}
function Un(e, t, n = $) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Gn(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Bn(e.parent.vnode) && Wn(r, t, n, e), e = e.parent;
	}
}
function Wn(e, t, n, r) {
	let i = Gn(t, e, r, !0);
	Qn(() => {
		c(r[t], i);
	}, n);
}
function Gn(e, t, n = $, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			ze();
			let i = qi(n), a = U(t, n, e, r);
			return i(), Be(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var Kn = (e) => (t, n = $) => {
	(!Xi || e === "sp") && Gn(e, (...e) => t(...e), n);
}, qn = Kn("bm"), Jn = Kn("m"), Yn = Kn("bu"), Xn = Kn("u"), Zn = Kn("bum"), Qn = Kn("um"), $n = Kn("sp"), er = Kn("rtg"), tr = Kn("rtc");
function nr(e, t = $) {
	Gn("ec", e, t);
}
var rr = /* @__PURE__ */ Symbol.for("v-ndc");
function ir(e, t, n, r) {
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
var ar = (e) => e ? Yi(e) ? ra(e) : ar(e.parent) : null, or = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => ar(e.parent),
	$root: (e) => ar(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => hr(e),
	$forceUpdate: (e) => e.f ||= () => {
		cn(e.update);
	},
	$nextTick: (e) => e.n ||= on.bind(e.proxy),
	$watch: (e) => Tn.bind(e)
}), sr = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), cr = {
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
			else if (sr(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else ur && (s[n] = 0);
		}
		let d = or[n], f, p;
		if (d) return n === "$attrs" && I(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return sr(a, n) ? (a[n] = r, !0) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) || n[0] === "$" && n.slice(1) in e ? !1 : (o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || sr(n, c) || u(o, c) || u(i, c) || u(or, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function lr(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var ur = !0;
function dr(e) {
	let t = hr(e), n = e.proxy, i = e.ctx;
	ur = !1, t.beforeCreate && pr(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: ee, renderTracked: T, renderTriggered: E, errorCaptured: D, serverPrefetch: te, expose: O, inheritAttrs: ne, components: re, directives: k, filters: ie } = t;
	if (u && fr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ kt(t));
	}
	if (ur = !0, o) for (let e in o) {
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
	if (c) for (let e in c) mr(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			yn(t, e[t]);
		});
	}
	f && pr(f, e, "c");
	function A(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (A(qn, p), A(Jn, m), A(Yn, g), A(Xn, _), A(Vn, y), A(Hn, b), A(nr, D), A(tr, T), A(er, E), A(Zn, S), A(Qn, w), A($n, te), d(O)) {
		if (O.length) {
			let t = e.exposed ||= {};
			O.forEach((e) => {
				Object.defineProperty(t, e, {
					get: () => n[e],
					set: (t) => n[e] = t,
					enumerable: !0
				});
			});
		} else e.exposed ||= {};
	}
	ee && e.render === r && (e.render = ee), ne != null && (e.inheritAttrs = ne), re && (e.components = re), k && (e.directives = k), te && Pn(e);
}
function fr(e, t, n = r) {
	d(e) && (e = br(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? bn(r.from || n, r.default, !0) : bn(r.from || n) : bn(r), /* @__PURE__ */ V(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function pr(e, t, n) {
	U(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function mr(e, t, n, r) {
	let i = r.includes(".") ? En(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) && Cn(i, n);
	} else if (h(e)) Cn(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => mr(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) && Cn(i, r, e);
		}
	}
}
function hr(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => gr(c, e, o, !0)), gr(c, t, o)), v(t) && a.set(t, c), c;
}
function gr(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && gr(e, a, n, !0), i && i.forEach((t) => gr(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = _r[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var _r = {
	data: vr,
	props: Sr,
	emits: Sr,
	methods: xr,
	computed: xr,
	beforeCreate: q,
	created: q,
	beforeMount: q,
	mounted: q,
	beforeUpdate: q,
	updated: q,
	beforeDestroy: q,
	beforeUnmount: q,
	destroyed: q,
	unmounted: q,
	activated: q,
	deactivated: q,
	errorCaptured: q,
	serverPrefetch: q,
	components: xr,
	directives: xr,
	watch: Cr,
	provide: vr,
	inject: yr
};
function vr(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function yr(e, t) {
	return xr(br(e), br(t));
}
function br(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function q(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function xr(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Sr(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), lr(e), lr(t ?? {})) : t;
}
function Cr(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = q(e[r], t[r]);
	return n;
}
function wr() {
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
var Tr = 0;
function Er(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = wr(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: Tr++,
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
					let u = l._ceVNode || ji(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, ra(u.component);
				}
			},
			onUnmount(e) {
				o.push(e);
			},
			unmount() {
				c && (U(o, l._instance, 16), e(null, l._container), delete l._container.__vue_app__);
			},
			provide(e, t) {
				return i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = Dr;
				Dr = l;
				try {
					return e();
				} finally {
					Dr = t;
				}
			}
		};
		return l;
	};
}
var Dr = null, Or = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${D(t)}Modifiers`] || e[`${O(t)}Modifiers`];
function kr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && Or(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(ae)));
	let c, l = i[c = re(n)] || i[c = re(D(n))];
	!l && o && (l = i[c = re(O(n))]), l && U(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, U(u, e, 6, a);
	}
}
var Ar = /* @__PURE__ */ new WeakMap();
function jr(e, t, n = !1) {
	let r = n ? Ar : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = jr(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Mr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, O(t)) || u(e, t));
}
function Nr(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = gn(e), v, y;
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
			}) : e(f, null)), y = t.props ? c : Pr(c);
		}
	} catch (t) {
		yi.length = 0, Qt(t, e, 1), v = ji(_i);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Fr(y, a)), b = Pi(b, y, !1, !0));
	}
	return n.dirs && (b = Pi(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Mn(On(b.type) && jn(b) || b, n.transition), v = b, gn(_), v;
}
var Pr = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Fr = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function Ir(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Lr(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Rr(o, r, n) && !Mr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Lr(r, o, l) : !!o;
	return !1;
}
function Lr(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (Rr(t, e, a) && !Mr(n, a)) return !0;
	}
	return !1;
}
function Rr(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !ve(r, i) : r !== i;
}
function zr({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Br = {}, Vr = () => Object.create(Br), Hr = (e) => Object.getPrototypeOf(e) === Br;
function Ur(e, t, n, r = !1) {
	let i = {}, a = Vr();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), Gr(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ At(i) : e.type.props ? i : a, e.attrs = a;
}
function Wr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ z(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Mr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = D(o);
						i[t] = Kr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		Gr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = O(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Kr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Xe(e.attrs, "set", "");
}
function Gr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (ee(t)) continue;
		let l = n[t], d;
		a && u(a, d = D(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Mr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ z(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = Kr(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function Kr(e, t, n, r, i, a) {
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
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === O(n)) && (r = !0));
	}
	return r;
}
var qr = /* @__PURE__ */ new WeakMap();
function Jr(e, r, i = !1) {
	let a = i ? qr : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = Jr(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = D(c[e]);
		Yr(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = D(e);
		if (Yr(t)) {
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
function Yr(e) {
	return e[0] !== "$" && !ee(e);
}
var Xr = (e) => e === "_" || e === "_ctx" || e === "$stable", Zr = (e) => d(e) ? e.map(Li) : [Li(e)], Qr = (e, t, n) => {
	if (t._n) return t;
	let r = _n((...e) => Zr(t(...e)), n);
	return r._c = !1, r;
}, $r = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (Xr(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = Qr(n, i, r);
		else if (i != null) {
			let e = Zr(i);
			t[n] = () => e;
		}
	}
}, ei = (e, t) => {
	let n = Zr(t);
	e.slots.default = () => n;
}, ti = (e, t, n) => {
	for (let r in t) (n || !Xr(r)) && (e[r] = t[r]);
}, ni = (e, t, n) => {
	let r = e.slots = Vr();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (ti(r, t, n), n && A(r, "_", e, !0)) : $r(t, r);
	} else t && ei(e, t);
}, ri = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : ti(a, n, r) : (o = !n.$stable, $r(n, a)), s = n;
	} else n && (ei(e, n), s = { default: 1 });
	if (o) for (let e in a) !Xr(e) && s[e] == null && delete a[e];
}, J = hi;
function ii(e) {
	return ai(e);
}
function ai(e, i) {
	let a = se();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !Oi(e, t) && (r = _e(e), j(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case gi:
				y(e, t, n, r);
				break;
			case _i:
				b(e, t, n, r);
				break;
			case vi:
				e ?? x(t, n, r, o);
				break;
			case Y:
				re(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? k(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, M);
		}
		u != null && i ? Ln(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Ln(e.ref, null, a, e, !0);
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
				n && n._beginPatch(), te(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, T = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && D(e.children, d, null, r, i, oi(e, a), s, u), _ && vn(e, null, r, "created"), E(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !ee(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Q(f, r, e);
		}
		_ && vn(e, null, r, "beforeMount");
		let v = ci(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && J(() => {
			try {
				f && Q(f, r, e), v && g.enter(d), _ && vn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, E = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || mi(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				E(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, D = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? Ri(e[l]) : Li(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, te = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && si(r, !1), (g = h.onVnodeBeforeUpdate) && Q(g, r, n, e), f && vn(n, e, r, "beforeUpdate"), r && si(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? O(e.dynamicChildren, d, l, r, i, oi(n, a), o) : s || le(e, n, l, null, r, i, oi(n, a), o, !1), u > 0) {
			if (u & 16) ne(l, m, h, r, a);
			else if (u & 2 && m.class !== h.class && c(l, "class", null, h.class, a), u & 4 && c(l, "style", m.style, h.style, a), u & 8) {
				let e = n.dynamicProps;
				for (let t = 0; t < e.length; t++) {
					let n = e[t], i = m[n], o = h[n];
					(o !== i || n === "value") && c(l, n, i, o, a, r);
				}
			}
			u & 1 && e.children !== n.children && p(l, n.children);
		} else !s && d == null && ne(l, m, h, r, a);
		((g = h.onVnodeUpdated) || f) && J(() => {
			g && Q(g, r, n, e), f && vn(n, e, r, "updated");
		}, i);
	}, O = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === Y || !Oi(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, ne = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !ee(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (ee(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, re = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), D(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (O(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && li(e, t, !0)) : le(e, t, n, f, i, a, s, c, l);
	}, k = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : A(t, n, r, i, a, o, c) : ae(e, t, c);
	}, A = (e, t, n, r, i, a, o) => {
		let s = e.component = Ui(e, r, i);
		if (Bn(e) && (s.ctx.renderer = M), Zi(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, oe, o), !e.el) {
				let r = s.subTree = ji(_i);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else oe(s, e, t, n, i, a, o);
	}, ae = (e, t, n) => {
		let r = t.component = e.component;
		if (Ir(e, t, n)) {
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
					let n = di(e);
					if (n) {
						t && (t.el = c.el, ce(e, t, o)), n.asyncDep.then(() => {
							J(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				si(e, !1), t ? (t.el = c.el, ce(e, t, o)) : t = c, n && ie(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Q(d, s, t, c), si(e, !0);
				let f = Nr(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), _e(p), e, i, a), t.el = f.el, u === null && zr(e, f.el), r && J(r, i), (d = t.props && t.props.onVnodeUpdated) && J(() => Q(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = zn(t);
				if (si(e, !1), l && ie(l), !m && (o = c && c.onVnodeBeforeMount) && Q(o, d, t), si(e, !0), s && xe) {
					let t = () => {
						e.subTree = Nr(e), xe(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Nr(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && J(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					J(() => Q(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && zn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && J(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Te(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => cn(u), si(e, !0), l();
	}, ce = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, Wr(e, t.props, r, n), ri(e, t.children, n), ze(), dn(e), Be();
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
		m & 8 ? (u & 16 && ge(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? de(l, d, n, r, i, a, o, s, c) : ge(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && D(d, n, r, i, a, o, s, c));
	}, ue = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? Ri(t[p]) : Li(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? ge(e, a, o, !0, !1, f) : D(t, r, i, a, o, s, c, l, f);
	}, de = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? Ri(t[u]) : Li(t[u]);
			if (Oi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? Ri(t[p]) : Li(t[p]);
			if (Oi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? Ri(t[u]) : Li(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) j(e[u], a, o, !0), u++;
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
					j(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && Oi(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? j(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? ui(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || pi(f) : i;
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
		if (c === Y) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) fe(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === vi) {
			S(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[kn] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), J(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[kn];
					a._isLeaving && a[kn](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, j = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (ze(), Ln(s, null, n, e, !0), Be()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !zn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Q(_, t, e), u & 6) he(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && vn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, M, r) : l && !l.hasOnce && (a !== Y || d > 0 && d & 64) ? ge(l, t, n, !1, !0) : (a === Y && d & 384 || !i && u & 16) && ge(c, t, n), r && pe(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && J(() => {
			_ && Q(_, t, e), h && vn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, pe = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === Y) {
			me(n, r);
			return;
		}
		if (t === vi) {
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
		fi(c), fi(l), r && ie(r), i.stop(), a && (a.flags |= 8, j(o, e, t, n)), s && J(s, t), J(() => {
			e.isUnmounted = !0;
		}, t);
	}, ge = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) j(e[o], t, n, r, i);
	}, _e = (e) => {
		if (e.shapeFlag & 6) return _e(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[Dn];
		return n ? h(n) : t;
	}, ve = !1, ye = (e, t, n) => {
		let r;
		e == null ? t._vnode && (j(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, ve ||= (ve = !0, dn(r), fn(), !1);
	}, M = {
		p: v,
		um: j,
		m: fe,
		r: pe,
		mt: A,
		mc: D,
		pc: le,
		pbc: O,
		n: _e,
		o: e
	}, be, xe;
	return i && ([be, xe] = i(M)), {
		render: ye,
		hydrate: be,
		createApp: Er(ye, be)
	};
}
function oi({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function si({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function ci(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function li(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = Ri(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && li(t, a)), a.type === gi && (a.patchFlag === -1 && (a = i[e] = Ri(a)), a.el = t.el), a.type === _i && !a.el && (a.el = t.el);
	}
}
function ui(e) {
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
function di(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : di(t);
}
function fi(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function pi(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? pi(t.subTree) : null;
}
var mi = (e) => e.__isSuspense;
function hi(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : un(e);
}
var Y = /* @__PURE__ */ Symbol.for("v-fgt"), gi = /* @__PURE__ */ Symbol.for("v-txt"), _i = /* @__PURE__ */ Symbol.for("v-cmt"), vi = /* @__PURE__ */ Symbol.for("v-stc"), yi = [], X = null;
function bi(e = !1) {
	yi.push(X = e ? null : []);
}
function xi() {
	yi.pop(), X = yi[yi.length - 1] || null;
}
var Si = 1;
function Ci(e, t = !1) {
	Si += e, e < 0 && X && t && (X.hasOnce = !0);
}
function wi(e) {
	return e.dynamicChildren = Si > 0 ? X || n : null, xi(), Si > 0 && X && X.push(e), e;
}
function Ti(e, t, n, r, i, a) {
	return wi(Z(e, t, n, r, i, a, !0));
}
function Ei(e, t, n, r, i) {
	return wi(ji(e, t, n, r, i, !0));
}
function Di(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function Oi(e, t) {
	return e.type === t.type && e.key === t.key;
}
var ki = ({ key: e }) => e ?? null, Ai = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ V(e) || h(e) ? {
	i: K,
	r: e,
	k: t,
	f: !!n
} : e);
function Z(e, t = null, n = null, r = 0, i = null, a = e === Y ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && ki(t),
		ref: t && Ai(t),
		scopeId: hn,
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
		ctx: K
	};
	return s ? (zi(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), Si > 0 && !o && X && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && X.push(c), c;
}
var ji = Mi;
function Mi(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === rr) && (e = _i), Di(e)) {
		let r = Pi(e, t, !0);
		return n && zi(r, n), Si > 0 && !a && X && (r.shapeFlag & 6 ? X[X.indexOf(e)] = r : X.push(r)), r.patchFlag = -2, r;
	}
	if (ia(e) && (e = e.__vccOpts), t) {
		t = Ni(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = j(e)), v(n) && (/* @__PURE__ */ Ft(n) && !d(n) && (n = s({}, n)), t.style = ce(n));
	}
	let o = g(e) ? 1 : mi(e) ? 128 : On(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return Z(e, t, n, r, i, o, a, !0);
}
function Ni(e) {
	return e ? /* @__PURE__ */ Ft(e) || Hr(e) ? s({}, e) : e : null;
}
function Pi(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? Bi(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && ki(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(Ai(t)) : [a, Ai(t)] : Ai(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== Y ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && Pi(e.ssContent),
		ssFallback: e.ssFallback && Pi(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && Mn(u, c.clone(u)), u;
}
function Fi(e = " ", t = 0) {
	return ji(gi, null, e, t);
}
function Ii(e = "", t = !1) {
	return t ? (bi(), Ei(_i, null, e)) : ji(_i, null, e);
}
function Li(e) {
	return e == null || typeof e == "boolean" ? ji(_i) : d(e) ? ji(Y, null, e.slice()) : Di(e) ? Ri(e) : ji(gi, null, String(e));
}
function Ri(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : Pi(e);
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
			!r && !Hr(t) ? t._ctx = K : r === 3 && K && (K.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			zi(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: K
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Fi(t)]) : n = 8;
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
	U(e, t, 7, [n, r]);
}
var Vi = wr(), Hi = 0;
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
		propsOptions: Jr(i, a),
		emitsOptions: jr(i, a),
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
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = kr.bind(null, o), e.ce && e.ce(o), o;
}
var $ = null, Wi = () => $ || K, Gi, Ki;
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
	Ur(e, r, a, t), ni(e, i, n || t);
	let o = a ? Qi(e, t) : void 0;
	return t && Ki(!1), o;
}
function Qi(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, cr);
	let { setup: r } = n;
	if (r) {
		ze();
		let n = e.setupContext = r.length > 1 ? na(e) : null, i = qi(e), a = Zt(r, e, 0, [e.props, n]), o = y(a);
		if (Be(), i(), (o || e.sp) && !zn(e) && Pn(e), o) {
			if (a.then(Ji, Ji), t) return a.then((n) => {
				Ki(!0);
				try {
					$i(e, n, t);
				} finally {
					Ki(!1);
				}
			}).catch((t) => {
				Qt(t, e, 0);
			});
			e.asyncDep = a;
		} else $i(e, a, t);
	} else ea(e, t);
}
function $i(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Ht(t)), ea(e, n);
}
function ea(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = qi(e);
		ze();
		try {
			dr(e);
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
	return e.exposed ? e.exposeProxy ||= new Proxy(Ht(It(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in or) return or[n](e);
		},
		has(e, t) {
			return t in e || t in or;
		}
	}) : e.proxy;
}
function ia(e) {
	return h(e) && "__vccOpts" in e;
}
var aa = (e, t) => /* @__PURE__ */ Wt(e, t, Xi), oa = "3.5.42", sa = void 0, ca = typeof window < "u" && window.trustedTypes;
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
		Sa.test(n) ? e.setProperty(O(r), n.replace(Sa, ""), "important") : e[r] = n;
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
	let r = D(t);
	if (r !== "filter" && r in e) return Ta[t] = r;
	r = ne(r);
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
	return [e[2] === ":" ? e.slice(3) : O(e.slice(2)), t];
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
				e && U(e, t, 5, a);
			}
		} else U(r, t, 5, [e]);
	};
	return n.value = e, n.attached = Ba(), n;
}
var Ha = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Ua = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? ga(e, r, c) : t === "style" ? xa(e, n, r) : a(t) ? o(t) || Pa(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Wa(e, t, r, c)) ? (Aa(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && ka(e, t, r, c, s, t !== "value")) : e._isVueCE && (Ga(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? Aa(e, D(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), ka(e, t, r, c));
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
	let r = D(t);
	return Array.isArray(n) ? n.some((e) => D(e) === r) : Object.keys(n).some((e) => D(e) === r);
}
var Ka = /* @__PURE__ */ s({ patchProp: Ua }, ma), qa;
function Ja() {
	return qa ||= ii(Ka);
}
var Ya = ((...e) => {
	let t = Ja().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = Za(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, Xa(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function Xa(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function Za(e) {
	return g(e) ? document.querySelector(e) : e;
}
//#endregion
//#region src/palette.ts
function Qa(e, t, n) {
	return `hsl(${Math.round(e)} ${Math.round(t)}% ${Math.round(n)}%)`;
}
function $a(e, t, n, r) {
	return `hsl(${Math.round(e)} ${Math.round(t)}% ${Math.round(n)}% / ${r})`;
}
function eo(e, t, n) {
	let r = (e) => {
		let t = e / 255;
		return t <= .03928 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
	};
	return .2126 * r(e) + .7152 * r(t) + .0722 * r(n);
}
function to(e, t, n) {
	e /= 255, t /= 255, n /= 255;
	let r = Math.max(e, t, n), i = Math.min(e, t, n), a = 0, o = 0, s = (r + i) / 2, c = r - i;
	return c && (o = c / (1 - Math.abs(2 * s - 1)), a = r === e ? 60 * ((t - n) / c % 6) : r === t ? 60 * ((n - e) / c + 2) : 60 * ((e - t) / c + 4)), [
		(a + 360) % 360,
		o * 100,
		s * 100
	];
}
async function no(e) {
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
	let l = eo(a, o, s) < .42, [u, d] = to(a, o, s), f = Math.max(10, Math.min(32, d * .34 + 8));
	return {
		"--accent": Qa(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42),
		"--accent-strong": Qa(u, Math.max(52, Math.min(84, d + 25)), l ? 74 : 34),
		"--accent-alt": Qa((u + 32) % 360, 64, l ? 68 : 38),
		"--accent-soft": $a(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42, l ? .2 : .18),
		"--on-accent": "#ffffff",
		"--mask": l ? "rgba(4, 10, 20, .44)" : "rgba(255, 255, 255, .42)",
		"--focus": `0 0 0 3px ${$a(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42, .32)}`,
		"--wallpaper-card-dark": Qa(u, f, 16),
		"--wallpaper-card-dark-soft": Qa(u, Math.min(36, f + 2), 21),
		"--wallpaper-card-dark-hover": Qa(u, Math.min(40, f + 5), 26),
		"--wallpaper-card-dark-border": $a(u, Math.min(44, f + 10), 64, .32),
		"--wallpaper-card-light": Qa(u, f, 97),
		"--wallpaper-card-light-soft": Qa(u, Math.min(36, f + 2), 93),
		"--wallpaper-card-light-hover": Qa(u, Math.min(40, f + 5), 89),
		"--wallpaper-card-light-border": $a(u, Math.min(44, f + 10), 42, .24)
	};
}
//#endregion
//#region src/wallpaperApi.ts
function ro(e, t, n) {
	return e.api.blob("asset", {
		query: { id: t },
		signal: n
	});
}
function io(e, t) {
	return e.api.get("state", t);
}
function ao(e, t) {
	return e.api.post("rotation/advance-session", void 0, t);
}
function oo(e, t, n) {
	return e.api.put("settings", t, n);
}
function so(e, t, n) {
	return e.api.post("assets/delete", { id: t }, n);
}
function co(e, t, n, r) {
	return e.api.put("assets/palette", {
		id: t,
		palette: n
	}, r);
}
async function lo(e, t, n) {
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
async function uo(e, t, n, r = !0) {
	if (t.paletteVersion === 3 && t.palette && Object.keys(t.palette).length > 0) return t.palette;
	try {
		let i = await no(n);
		return r && await co(e, t.id, i), i;
	} catch {
		return null;
	}
}
//#endregion
//#region src/WallpaperSettings.vue?vue&type=script&setup=true&lang.ts
var fo = [
	"title",
	"description",
	"expanded"
], po = { class: "cw-body" }, mo = { class: "cw-status-row" }, ho = { class: "cw-muted" }, go = ["tone", "label"], _o = [
	"label",
	"description",
	"model-value",
	"aria-label"
], vo = [
	"label",
	"description",
	"model-value",
	"aria-label"
], yo = { class: "cw-grid cw-controls" }, bo = ["help", "label"], xo = [
	"model-value",
	"options",
	"aria-label"
], So = ["help", "label"], Co = ["model-value", "aria-label"], wo = { class: "cw-grid cw-effects" }, To = ["help", "label"], Eo = { class: "cw-range-row" }, Do = ["model-value", "aria-label"], Oo = ["help", "label"], ko = { class: "cw-range-row" }, Ao = ["model-value", "aria-label"], jo = ["help", "label"], Mo = { class: "cw-range-row" }, No = ["model-value", "aria-label"], Po = { class: "cw-upload-row" }, Fo = ["label"], Io = { class: "cw-muted" }, Lo = ["aria-label"], Ro = {
	key: 0,
	class: "cw-muted cw-empty"
}, zo = ["data-dnd-id"], Bo = ["label", "title"], Vo = ["src", "alt"], Ho = {
	key: 1,
	class: "cw-thumb-placeholder",
	"aria-hidden": "true"
}, Uo = { class: "cw-item-copy" }, Wo = { class: "cw-muted" }, Go = ["label", "onClick"], Ko = { class: "cw-card-footer" }, qo = { class: "cw-muted" }, Jo = {
	key: 0,
	class: "cw-error"
}, Yo = "custom-wallpaper", Xo = "nxp-settings-panel-toggle", Zo = "nxp-settings-panel-state", Qo = /* @__PURE__ */ Nn({
	__name: "WallpaperSettings",
	props: {
		host: {},
		runtime: {},
		context: {}
	},
	setup(e) {
		let t = e, n = t.runtime.snapshot(), r = /* @__PURE__ */ H(n.state), i = /* @__PURE__ */ H(n.error), a = /* @__PURE__ */ H(!1), o = /* @__PURE__ */ H(""), s = /* @__PURE__ */ H(""), c = /* @__PURE__ */ H({}), l = /* @__PURE__ */ H({}), u = /* @__PURE__ */ H(null), d = /* @__PURE__ */ H(null), f = /* @__PURE__ */ H(null), p = [], m = null, h = null, g = !1, _ = null, v = !1, y = aa(() => [
			{
				value: "timer",
				label: T("rotation.timer", {}, "按时间随机轮换")
			},
			{
				value: "startup",
				label: T("rotation.startup", {}, "每次启动 Web 随机轮换")
			},
			{
				value: "off",
				label: T("rotation.off", {}, "不轮换")
			}
		]), b = aa(() => {
			let e = r.value?.assets || [], t = new Map(e.map((e) => [e.id, e]));
			return [.../* @__PURE__ */ new Set([...r.value?.order || [], ...e.map((e) => e.id)])].map((e) => t.get(e)).filter((e) => !!e);
		}), x = aa(() => r.value?.enabled === !0), S = aa(() => r.value?.effects?.applyTransparencyToSecondarySurfaces !== !1), C = aa(() => o.value ? o.value : i.value ? T("status.read_failed", {}, "读取失败") : r.value?.effectiveEnabled === !0 ? T("status.enabled", {}, "已启用") : T("status.disabled", {}, "未启用")), w = aa(() => o.value ? "blue" : i.value ? "bad" : r.value?.effectiveEnabled === !0 ? "ok" : "muted"), ee = aa(() => s.value || i.value);
		function T(e, n = {}, r = "") {
			return t.host.i18n.t(e, n, r);
		}
		function E(e) {
			let t = e.detail;
			return Array.isArray(t) && t.length ? t[0] : t === void 0 ? e.target?.modelValue : t;
		}
		function D(e, t, n) {
			let r = e?.code || "", i = {
				invalid_type: T("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"),
				too_large: T("error.size", {}, "壁纸文件不能超过 8192 KB"),
				quota_count: T("error.count", {}, "壁纸数量不能超过 32 张"),
				quota_total: T("error.total", {}, "壁纸总容量不能超过 256 MiB"),
				invalid_image: T("error.image", {}, "壁纸文件内容与声明类型不匹配"),
				invalid_config: T("error.config", {}, "壁纸设置无效"),
				invalid_asset: T("error.asset", {}, "壁纸资源无效"),
				not_found: T("error.not_found", {}, "壁纸资源不存在"),
				invalid_palette: T("error.palette", {}, "壁纸配色无效")
			};
			return i[r] ? i[r] : r ? T("error.generic", { code: r }, `操作失败：${r}`) : T(t, {}, n);
		}
		function te(e) {
			let t = Number(e) || 0;
			return t < 1048576 ? `${Math.max(1, Math.round(t / 1024))} KiB` : `${(t / 1024 / 1024).toFixed(1)} MiB`;
		}
		function O(e) {
			window.dispatchEvent(new CustomEvent(Xo, { detail: { panelId: e } }));
		}
		function ne(e) {
			a.value = e, O(e ? Yo : null);
		}
		function re(e) {
			let t = e.detail?.panelId;
			(t === null || typeof t == "string") && (a.value = t === Yo);
		}
		function k(e) {
			v || (r.value = e.state, i.value = e.error, ie());
		}
		function ie() {
			if (!(g || h)) for (let e of Object.keys(l.value)) {
				let t = l.value[e];
				t?.committed && r.value?.effects?.[e] === t.value && delete l.value[e];
			}
		}
		function A(e, t = 0) {
			return l.value[e]?.value ?? r.value?.effects?.[e] ?? t;
		}
		function ae(e, t) {
			l.value[e] = {
				value: Number(t) || 0,
				committed: !1
			};
		}
		function oe(e, t, n) {
			l.value[e] = {
				value: Number(n) || 0,
				committed: !0
			}, pe(t, n);
		}
		async function se(e = []) {
			let t = new Set(e);
			Object.entries(c.value).forEach(([e, n]) => {
				t.has(e) || (URL.revokeObjectURL(n), delete c.value[e]);
			});
		}
		async function ce(e) {
			await se(e.map((e) => e.id));
			for (let n of e) if (!c.value[n.id]) try {
				let e = await ro(t.host, n.id);
				if (v) return;
				c.value = {
					...c.value,
					[n.id]: URL.createObjectURL(e)
				};
			} catch {}
		}
		function le(e, t) {
			r.value &&= t(r.value), h = {
				...h,
				...e
			}, m && clearTimeout(m), m = setTimeout(() => {
				m = null, ue();
			}, 0);
		}
		async function ue() {
			if (!(g || v)) {
				g = !0, o.value = T("status.saving", {}, "保存中");
				try {
					for (; h && !v;) {
						let e = h;
						h = null;
						try {
							let n = await oo(t.host, e);
							if (v) return;
							await t.runtime.apply(n);
						} catch (e) {
							s.value = D(e, "status.save_failed", "保存失败"), await t.runtime.refresh();
						}
					}
				} finally {
					g = !1, o.value = "", ie();
				}
			}
		}
		function de(e) {
			let t = l.value[e];
			return t?.committed ? t.value : r.value?.effects?.[e] ?? 0;
		}
		function fe() {
			let e = r.value || {};
			return {
				order: b.value.map((e) => e.id),
				selectedId: e.selectedId || "",
				rotation: {
					mode: e.rotation?.mode || "off",
					intervalMinutes: Number(e.rotation?.intervalMinutes) || 30,
					epochUnixMs: e.rotation?.epochUnixMs || Date.now()
				},
				effects: {
					blurPx: de("blurPx"),
					dimPercent: de("dimPercent"),
					surfaceTransparencyPercent: de("surfaceTransparencyPercent"),
					applyTransparencyToSecondarySurfaces: S.value
				}
			};
		}
		function j(e) {
			if (!r.value) return;
			if (e === "enabled") {
				let e = !x.value;
				le({
					enabled: e,
					rotation: fe().rotation
				}, (t) => ({
					...t,
					enabled: e,
					effectiveEnabled: e && (t.order?.length || 0) > 0
				}));
				return;
			}
			let t = !S.value;
			le({ effects: {
				...fe().effects,
				applyTransparencyToSecondarySurfaces: t
			} }, (e) => ({
				...e,
				effects: {
					...e.effects || {},
					applyTransparencyToSecondarySurfaces: t
				}
			}));
		}
		function pe(e, t) {
			if (!r.value) return;
			let n = fe();
			e === "mode" && (n.rotation.mode = String(t), n.rotation.epochUnixMs = Date.now()), e === "interval" && (n.rotation.intervalMinutes = Number(t) || 30), e === "blur" && (n.effects.blurPx = Number(t) || 0), e === "dim" && (n.effects.dimPercent = Number(t) || 0), e === "transparency" && (n.effects.surfaceTransparencyPercent = Number(t) || 0), le(n, (e) => ({
				...e,
				rotation: {
					...e.rotation || {},
					...n.rotation
				},
				effects: {
					...e.effects || {},
					...n.effects
				}
			}));
		}
		async function me(e = []) {
			for (let n of e) {
				let e = r.value?.limits || {}, i = Number(e.maxAssets) || 32, a = Number(e.maxAssetBytes) || 8388608;
				if ((r.value?.assets?.length || 0) >= i) {
					t.host.ui.toast(T("error.count", {}, "壁纸数量不能超过 32 张"), "error");
					break;
				}
				if (![
					"image/jpeg",
					"image/png",
					"image/webp"
				].includes(String(n.type).toLowerCase())) {
					t.host.ui.toast(T("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"), "error");
					continue;
				}
				if (n.size > a) {
					t.host.ui.toast(T("error.size", {}, "壁纸文件不能超过 8192 KB"), "error");
					continue;
				}
				try {
					let e = await createImageBitmap(n), r = e.height > e.width;
					e.close?.(), r && t.host.ui.toast(T("warning.portrait", {}, "该图片可能在电脑上显示效果不佳"), "warn");
				} catch {}
				try {
					o.value = T("status.uploading", { name: n.name }, `上传中：${n.name}`);
					let e = await lo(t.host, n);
					if (v) return;
					if (e.asset) try {
						await uo(t.host, e.asset, n);
					} catch (e) {
						t.host.ui.toast(T("warning.palette", { error: e instanceof Error ? e.message : String(e) }, "壁纸已上传，配色稍后生成"), "warn");
					}
					await t.runtime.refresh(), await ce(r.value?.assets || []);
				} catch (e) {
					s.value = D(e, "status.upload_failed", "上传失败");
				} finally {
					o.value = "";
				}
			}
		}
		async function he(e) {
			try {
				let n = await so(t.host, e);
				if (v) return;
				let r = c.value[e];
				r && (URL.revokeObjectURL(r), delete c.value[e]), await t.runtime.apply(n);
			} catch (e) {
				s.value = D(e, "status.delete_failed", "删除失败");
			}
		}
		function ge(e) {
			if (!r.value) return;
			let t = b.value.map((e) => e.id);
			e.length !== t.length || new Set(e).size !== t.length || e.some((e) => !t.includes(e)) || e.every((e, n) => e === t[n]) || le({ order: e }, (t) => ({
				...t,
				order: e
			}));
		}
		return Jn(async () => {
			for (let [e, t] of [
				["blurPx", u],
				["dimPercent", d],
				["surfaceTransparencyPercent", f]
			]) {
				let n = t.value;
				if (!n) continue;
				let r = (t) => ae(e, E(t));
				n.addEventListener("update:modelValue", r), p.push(() => n.removeEventListener("update:modelValue", r));
			}
			window.addEventListener(Zo, re), _ = t.runtime.subscribe(k), k(t.runtime.snapshot()), await ce(r.value?.assets || []);
		}), Zn(() => {
			v = !0, p.splice(0).forEach((e) => e()), window.removeEventListener(Zo, re), _?.(), _ = null, m && clearTimeout(m), m = null, h = null, Object.values(c.value).forEach((e) => URL.revokeObjectURL(e)), c.value = {};
		}), (e, t) => (bi(), Ti("nxp-collapsible-card", {
			title: T("card.title", {}, "自定义壁纸"),
			description: T("card.description", {}, "同步壁纸、轮换方式和显示效果"),
			expanded: a.value,
			"panel-id": "settings-panel-custom-wallpaper",
			"data-settings-panel": "custom-wallpaper",
			"data-testid": "custom-wallpaper-card",
			onToggle: t[9] ||= (e) => ne(e.detail?.[0] === !0)
		}, [Z("div", po, [
			Z("div", mo, [Z("span", ho, M(T("settings.sync", {}, "服务端同步到当前 NexusPipeline 实例的全部浏览器。")), 1), Z("nxp-badge", {
				tone: w.value,
				label: C.value
			}, null, 8, go)]),
			Z("nxp-switch-list", null, [Z("nxp-switch-setting", {
				label: T("settings.enabled", {}, "启用自定义壁纸"),
				description: T("settings.enabled_help", {}, "启用后使用自定义壁纸作为页面背景。"),
				"model-value": x.value,
				"aria-label": T("settings.enabled", {}, "启用自定义壁纸"),
				onChange: t[0] ||= (e) => j("enabled")
			}, null, 40, _o), Z("nxp-switch-setting", {
				label: T("settings.secondary", {}, "透明度运用于非主页面"),
				description: T("settings.secondary_help", {}, "关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。"),
				"model-value": S.value,
				"aria-label": T("settings.secondary", {}, "透明度运用于非主页面"),
				onChange: t[1] ||= (e) => j("secondary")
			}, null, 40, vo)]),
			Z("div", yo, [Z("nxp-field", {
				class: "cw-field",
				help: T("settings.rotation_help", {}, "按时间随机轮换会按设定间隔切换壁纸；重新加载 Web UI 或打开新的 Web UI 会话会推进一次。"),
				label: T("settings.rotation", {}, "轮换方式")
			}, [Z("nxp-select", {
				"model-value": r.value?.rotation?.mode || "off",
				options: y.value,
				"aria-label": T("settings.rotation", {}, "轮换方式"),
				onChange: t[2] ||= (e) => pe("mode", E(e) || "off")
			}, null, 40, xo)], 8, bo), Z("nxp-field", {
				class: "cw-field",
				help: T("settings.interval_help", {}, "轮换方式为按时间随机轮换时生效，范围为 1 至 1440 分钟。"),
				label: T("settings.interval", {}, "轮换间隔（分钟）")
			}, [Z("nxp-number-input", {
				"model-value": r.value?.rotation?.intervalMinutes || 30,
				min: 1,
				max: 1440,
				step: 1,
				"aria-label": T("settings.interval", {}, "轮换间隔（分钟）"),
				onChange: t[3] ||= (e) => pe("interval", E(e))
			}, null, 40, Co)], 8, So)]),
			Z("div", wo, [
				Z("nxp-field", {
					class: "cw-field",
					help: T("settings.blur_help", {}, "模糊范围为 0 至 40 像素。"),
					label: T("settings.blur", {}, "模糊（像素）")
				}, [Z("span", Eo, [Z("nxp-range", {
					ref_key: "blurRange",
					ref: u,
					"model-value": A("blurPx"),
					min: 0,
					max: 40,
					step: 1,
					"aria-label": T("settings.blur", {}, "模糊（像素）"),
					onChange: t[4] ||= (e) => oe("blurPx", "blur", E(e))
				}, null, 40, Do), Z("output", null, M(A("blurPx")) + "px", 1)])], 8, To),
				Z("nxp-field", {
					class: "cw-field",
					help: T("settings.dim_help", {}, "变暗范围为 0 至 80%，用于调整壁纸与内容的对比度。"),
					label: T("settings.dim", {}, "变暗")
				}, [Z("span", ko, [Z("nxp-range", {
					ref_key: "dimRange",
					ref: d,
					"model-value": A("dimPercent", 20),
					min: 0,
					max: 80,
					step: 1,
					"aria-label": T("settings.dim", {}, "变暗"),
					onChange: t[5] ||= (e) => oe("dimPercent", "dim", E(e))
				}, null, 40, Ao), Z("output", null, M(A("dimPercent", 20)) + "%", 1)])], 8, Oo),
				Z("nxp-field", {
					class: "cw-field",
					help: T("settings.transparency_help", {}, "控制页面卡片、侧边栏和其他表面的透明度，范围为 0 至 50%。"),
					label: T("settings.transparency", {}, "卡片与侧边栏透明度")
				}, [Z("span", Mo, [Z("nxp-range", {
					ref_key: "transparencyRange",
					ref: f,
					"model-value": A("surfaceTransparencyPercent"),
					min: 0,
					max: 50,
					step: 1,
					"aria-label": T("settings.transparency", {}, "卡片与侧边栏透明度"),
					onChange: t[6] ||= (e) => oe("surfaceTransparencyPercent", "transparency", E(e))
				}, null, 40, No), Z("output", null, M(A("surfaceTransparencyPercent")) + "%", 1)])], 8, jo)
			]),
			Z("div", Po, [Z("nxp-file-picker", {
				accept: "image/jpeg,image/png,image/webp",
				multiple: "",
				label: T("settings.add", {}, "添加壁纸"),
				onChange: t[7] ||= (e) => me(e.detail?.[0] || e.target?.files || [])
			}, null, 40, Fo), Z("span", Io, M(T("settings.file_help", {}, "JPEG、PNG、WebP，单张最大 8192 KB")), 1)]),
			Z("nxp-sortable-list", {
				class: "cw-list",
				"aria-label": T("settings.order", {}, "壁纸顺序"),
				onReorder: t[8] ||= (e) => ge(E(e))
			}, [b.value.length ? Ii("", !0) : (bi(), Ti("p", Ro, M(T("empty", {}, "尚未添加壁纸。")), 1)), (bi(!0), Ti(Y, null, ir(b.value, (e) => (bi(), Ti("div", {
				key: e.id,
				class: "cw-item",
				"data-dnd-id": e.id
			}, [
				Z("nxp-drag-handle", {
					class: "cw-drag-handle",
					label: `${T("drag", {}, "拖拽排序")}：${e.originalName || e.id}`,
					title: T("drag", {}, "拖拽排序")
				}, null, 8, Bo),
				c.value[e.id] ? (bi(), Ti("img", {
					key: 0,
					src: c.value[e.id],
					alt: e.originalName || e.id
				}, null, 8, Vo)) : (bi(), Ti("span", Ho)),
				Z("div", Uo, [Z("strong", null, M(e.originalName || e.id), 1), Z("span", Wo, M(te(e.sizeBytes)), 1)]),
				Z("nxp-button", {
					tone: "danger",
					variant: "ghost",
					size: "sm",
					label: T("remove", {}, "删除"),
					onClick: (t) => he(e.id)
				}, null, 8, Go)
			], 8, zo))), 128))], 40, Lo),
			Z("div", Ko, [Z("span", qo, M(T("settings.max_help", {}, "最多 32 张，实例总容量 256 MiB。")), 1)]),
			ee.value ? (bi(), Ti("p", Jo, M(ee.value), 1)) : Ii("", !0)
		])], 40, fo));
	}
});
//#endregion
//#region src/wallpaperRuntime.ts
function $o(e) {
	return !e?.effectiveEnabled || !e.currentId ? null : (e.assets || []).find((t) => t.id === e.currentId) || null;
}
function es(e, t) {
	return e?.effects?.blurPx !== t?.effects?.blurPx || e?.effects?.dimPercent !== t?.effects?.dimPercent || e?.effects?.surfaceTransparencyPercent !== t?.effects?.surfaceTransparencyPercent || e?.effects?.applyTransparencyToSecondarySurfaces !== t?.effects?.applyTransparencyToSecondarySurfaces;
}
function ts(e, t) {
	return e?.revision !== t?.revision || e?.currentId !== t?.currentId || e?.effectiveEnabled !== t?.effectiveEnabled || es(e, t);
}
function ns(e, t = {}) {
	let n = Math.max(1e3, Number(t.pollIntervalMs) || 3e4), r = /* @__PURE__ */ new Set(), i = null, a = "", o = null, s = null, c = null, l = -1, u = 0, d = null, f = "", p = 0, m = 0, h = !1;
	function g() {
		return {
			state: i,
			error: a
		};
	}
	function _(e, t = "") {
		i = e, a = t;
		let n = g();
		r.forEach((e) => {
			try {
				e(n);
			} catch {}
		});
	}
	function v() {
		o && clearTimeout(o), o = null;
	}
	function y(e) {
		v();
		let t = e?.rotation?.nextSwitchAt;
		if (!$o(e) || e?.rotation?.mode !== "timer" || !t) {
			f = "", p = 0;
			return;
		}
		let n = new Date(t).getTime();
		if (!Number.isFinite(n)) return;
		f !== t && (f = t, p = 0);
		let r = n - Date.now();
		r <= 0 && p++ >= 8 || (r > 0 && (p = 0), o = setTimeout(() => {
			o = null, S();
		}, Math.min(2147483647, Math.max(1e3, r))));
	}
	async function b(t, n) {
		if (h || (_(t), y(t), !n)) return;
		let r = ++m, i = $o(t);
		if (!i) {
			e.appearance.clearBackground(), e.appearance.clearTokens();
			return;
		}
		try {
			let n = await ro(e, i.id);
			if (h || r !== m) return;
			e.appearance.setBackground({
				url: URL.createObjectURL(n),
				blurPx: t?.effects?.blurPx,
				dimPercent: t?.effects?.dimPercent,
				surfaceTransparencyPercent: t?.effects?.surfaceTransparencyPercent,
				secondarySurfaceTransparency: t?.effects?.applyTransparencyToSecondarySurfaces !== !1
			});
			let a = await uo(e, i, n, !1);
			if (h || r !== m) return;
			a && e.appearance.setTokens(a);
		} catch (e) {
			if (h || r !== m) return;
			_(t, e instanceof Error ? e.message : String(e));
		}
	}
	async function x(t) {
		if (h) return;
		let n = u;
		try {
			let r = await io(e);
			if (h || n !== u) return;
			if ((r.revision ?? 0) < (i?.revision ?? 0)) {
				y(i);
				return;
			}
			await b(r, t || ts(i, r));
		} catch (e) {
			if (h || n !== u) return;
			_(i, e instanceof Error ? e.message : String(e)), y(i);
		}
	}
	async function S() {
		if (h) return;
		if (c && l === u) return c;
		l = u;
		let e = x(!1).finally(() => {
			c === e && (c = null);
		});
		return c = e, e;
	}
	async function C() {
		if (h || s) return;
		if (d) return d;
		let t = ++u, r = (async () => {
			try {
				let n = await e.getCapabilities();
				if (h || t !== u) return;
				let r = n.connectionKind === "local" ? await ao(e) : await io(e);
				if (h || t !== u) return;
				await b(r, !0);
			} catch {
				!h && t === u && await x(!0);
			}
		})().finally(() => {
			!h && !s && (s = setInterval(() => {
				S();
			}, n)), d === r && (d = null);
		});
		return d = r, r;
	}
	return {
		snapshot: g,
		start: C,
		refresh: S,
		async apply(e) {
			u += 1, await b(e, !0);
		},
		subscribe(e) {
			return r.add(e), () => r.delete(e);
		},
		dispose() {
			h || (h = !0, u += 1, m += 1, v(), s && clearInterval(s), s = null, r.clear(), e.appearance.clearBackground(), e.appearance.clearTokens(), i = null, a = "");
		}
	};
}
//#endregion
//#region src/main.ts
function rs(e) {
	let t = ns(e);
	t.start();
	let n = e.slots.register("settings.cards", (n) => {
		let r = Ya(Qo, {
			host: e,
			runtime: t,
			context: n.context
		});
		return r.mount(n.element), () => r.unmount();
	});
	return { dispose() {
		n?.dispose?.(), t.dispose();
	} };
}
//#endregion
export { rs as activate };
