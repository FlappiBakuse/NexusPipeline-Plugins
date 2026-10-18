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
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, T = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), E = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, ee = /-\w/g, D = E((e) => e.replace(ee, (e) => e.slice(1).toUpperCase())), te = /\B([A-Z])/g, O = E((e) => e.replace(te, "-$1").toLowerCase()), ne = E((e) => e.charAt(0).toUpperCase() + e.slice(1)), re = E((e) => e ? `on${ne(e)}` : ""), k = (e, t) => !Object.is(e, t), ie = (e, ...t) => {
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
	let t = /* @__PURE__ */ R(e);
	return t === e ? t : (I(t, "iterate", Ye), /* @__PURE__ */ L(e) ? t : t.map(z));
}
function Qe(e) {
	return I(e = /* @__PURE__ */ R(e), "iterate", Ye), e;
}
function $e(e, t) {
	return /* @__PURE__ */ Ft(e) ? Rt(/* @__PURE__ */ Pt(e) ? z(t) : t) : z(t);
}
var et = {
	__proto__: null,
	[Symbol.iterator]() {
		return tt(this, Symbol.iterator, (e) => $e(this, e));
	},
	concat(...e) {
		return Ze(this).concat(...e.map((e) => d(e) ? Ze(e) : e));
	},
	entries() {
		return tt(this, "entries", (e) => (e[1] = $e(this, e[1]), e));
	},
	every(e, t) {
		return rt(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return rt(this, "filter", e, t, (e) => e.map((e) => $e(this, e)), arguments);
	},
	find(e, t) {
		return rt(this, "find", e, t, (e) => $e(this, e), arguments);
	},
	findIndex(e, t) {
		return rt(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return rt(this, "findLast", e, t, (e) => $e(this, e), arguments);
	},
	findLastIndex(e, t) {
		return rt(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return rt(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return at(this, "includes", e);
	},
	indexOf(...e) {
		return at(this, "indexOf", e);
	},
	join(e) {
		return Ze(this).join(e);
	},
	lastIndexOf(...e) {
		return at(this, "lastIndexOf", e);
	},
	map(e, t) {
		return rt(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return ot(this, "pop");
	},
	push(...e) {
		return ot(this, "push", e);
	},
	reduce(e, ...t) {
		return it(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return it(this, "reduceRight", e, t);
	},
	shift() {
		return ot(this, "shift");
	},
	some(e, t) {
		return rt(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return ot(this, "splice", e);
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
		return ot(this, "unshift", e);
	},
	values() {
		return tt(this, "values", (e) => $e(this, e));
	}
};
function tt(e, t, n) {
	let r = Qe(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ L(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var nt = Array.prototype;
function rt(e, t, n, r, i, a) {
	let o = Qe(e), s = o !== e && !/* @__PURE__ */ L(e), c = o[t];
	if (c !== nt[t]) {
		let t = c.apply(e, a);
		return s ? z(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, $e(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function it(e, t, n, r) {
	let i = Qe(e), a = i !== e && !/* @__PURE__ */ L(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = $e(e, t)), n.call(this, t, $e(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? $e(e, c) : c;
}
function at(e, t, n) {
	let r = /* @__PURE__ */ R(e);
	I(r, "iterate", Ye);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ It(n[0]) ? (n[0] = /* @__PURE__ */ R(n[0]), r[t](...n)) : i;
}
function ot(e, t, n = []) {
	ze(), Ae();
	let r = (/* @__PURE__ */ R(e))[t].apply(e, n);
	return je(), Be(), r;
}
var st = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), ct = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function lt(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ R(this);
	return I(t, "has", e), t.hasOwnProperty(e);
}
var ut = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Ot : Dt : i ? Et : Tt).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = et[t])) return e;
			if (t === "hasOwnProperty") return lt;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ B(e) ? e : n);
		if ((_(t) ? ct.has(t) : st(t)) || (r || I(e, "get", t), i)) return o;
		if (/* @__PURE__ */ B(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ Mt(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ Mt(o) : /* @__PURE__ */ At(o) : o;
	}
}, dt = class extends ut {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ Ft(i);
			if (!/* @__PURE__ */ L(n) && !/* @__PURE__ */ Ft(n) && (i = /* @__PURE__ */ R(i), n = /* @__PURE__ */ R(n)), !a && /* @__PURE__ */ B(i) && !/* @__PURE__ */ B(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ B(e) ? e : r);
		return e === /* @__PURE__ */ R(r) && s && (o ? k(n, i) && Xe(e, "set", t, n, i) : Xe(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Xe(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !ct.has(t)) && I(e, "has", t), n;
	}
	ownKeys(e) {
		return I(e, "iterate", d(e) ? "length" : qe), Reflect.ownKeys(e);
	}
}, ft = class extends ut {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, pt = /* @__PURE__ */ new dt(), mt = /* @__PURE__ */ new ft(), ht = /* @__PURE__ */ new dt(!0), gt = (e) => e, _t = (e) => Reflect.getPrototypeOf(e);
function vt(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ R(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? gt : t ? Rt : z;
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
function yt(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function bt(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ R(r), a = /* @__PURE__ */ R(n);
			e || (k(n, a) && I(i, "get", n), I(i, "get", a));
			let { has: o } = _t(i), s = t ? gt : e ? Rt : z;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && I(/* @__PURE__ */ R(t), "iterate", qe), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ R(n), i = /* @__PURE__ */ R(t);
			return e || (k(t, i) && I(r, "has", t), I(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ R(a), s = t ? gt : e ? Rt : z;
			return !e && I(o, "iterate", qe), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: yt("add"),
		set: yt("set"),
		delete: yt("delete"),
		clear: yt("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ R(this), r = _t(n), i = /* @__PURE__ */ R(e), a = !t && !/* @__PURE__ */ L(e) && !/* @__PURE__ */ Ft(e) ? i : e;
			return r.has.call(n, a) || k(e, a) && r.has.call(n, e) || k(i, a) && r.has.call(n, i) || (n.add(a), Xe(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ L(n) && !/* @__PURE__ */ Ft(n) && (n = /* @__PURE__ */ R(n));
			let r = /* @__PURE__ */ R(this), { has: i, get: a } = _t(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ R(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? k(n, s) && Xe(r, "set", e, n, s) : Xe(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ R(this), { has: n, get: r } = _t(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ R(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Xe(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ R(this), t = e.size !== 0, n = e.clear();
			return t && Xe(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = vt(r, e, t);
	}), n;
}
function xt(e, t) {
	let n = bt(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var St = { get: /* @__PURE__ */ xt(!1, !1) }, Ct = { get: /* @__PURE__ */ xt(!1, !0) }, wt = { get: /* @__PURE__ */ xt(!0, !1) }, Tt = /* @__PURE__ */ new WeakMap(), Et = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap(), Ot = /* @__PURE__ */ new WeakMap();
function kt(e) {
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
function At(e) {
	return /* @__PURE__ */ Ft(e) ? e : Nt(e, !1, pt, St, Tt);
}
// @__NO_SIDE_EFFECTS__
function jt(e) {
	return Nt(e, !1, ht, Ct, Et);
}
// @__NO_SIDE_EFFECTS__
function Mt(e) {
	return Nt(e, !0, mt, wt, Dt);
}
function Nt(e, t, n, r, i) {
	if (!v(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = kt(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function Pt(e) {
	return /* @__PURE__ */ Ft(e) ? /* @__PURE__ */ Pt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Ft(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function L(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function It(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function R(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ R(t) : e;
}
function Lt(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && A(e, "__v_skip", !0), e;
}
var z = (e) => v(e) ? /* @__PURE__ */ At(e) : e, Rt = (e) => v(e) ? /* @__PURE__ */ Mt(e) : e;
// @__NO_SIDE_EFFECTS__
function B(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function V(e) {
	return zt(e, !1);
}
function zt(e, t) {
	return /* @__PURE__ */ B(e) ? e : new Bt(e, t);
}
var Bt = class {
	constructor(e, t) {
		this.dep = new We(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ R(e), this._value = t ? e : z(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ L(e) || /* @__PURE__ */ Ft(e);
		e = n ? e : /* @__PURE__ */ R(e), k(e, t) && (this._rawValue = e, this._value = n ? e : z(e), this.dep.trigger());
	}
};
function H(e) {
	return /* @__PURE__ */ B(e) ? e.value : e;
}
var Vt = {
	get: (e, t, n) => t === "__v_raw" ? e : H(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ B(i) && !/* @__PURE__ */ B(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Ht(e) {
	return /* @__PURE__ */ Pt(e) ? e : new Proxy(e, Vt);
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
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ L(e) || o === !1 || o === 0 ? Xt(e, 1) : Xt(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ B(e) ? (g = () => e.value, y = /* @__PURE__ */ L(e)) : /* @__PURE__ */ Pt(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Pt(e) || /* @__PURE__ */ L(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ B(e)) return e.value;
		if (/* @__PURE__ */ Pt(e)) return p(e);
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
	if (n.set(e, t), t--, /* @__PURE__ */ B(e)) Xt(e.value, t, n);
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
		$t(e, t, n);
	}
}
function Qt(e, t, n, r) {
	if (h(e)) {
		let i = Zt(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			$t(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(Qt(e[a], t, n, r));
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
			ze(), Zt(o, null, 10, [
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
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), Zt(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
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
		}), a.deep && Xt(o), i.push({
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
		c && (ze(), Qt(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Be());
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
	u.call = (e, t, n) => Qt(e, p, t, n);
	let m = !1;
	c === "post" ? u.scheduler = (e) => {
		K(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : un(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Yt(e, n, u);
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
	let s = a.shapeFlag & 4 ? ia(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ R(v), b = v === t ? i : (e) => !Rn(_, e) && u(y, e), x = (e, t) => !(t && Rn(_, t));
	if (m != null && m !== p) {
		if (Vn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ B(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) Zt(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ B(p);
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
se().requestIdleCallback, se().cancelIdleCallback;
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
			ze();
			let i = Ji(n), a = Qt(t, n, e, r);
			return i(), Be(), a;
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
		let n = o && /* @__PURE__ */ Pt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ L(e), s = /* @__PURE__ */ Ft(e), e = Qe(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Rt(z(e[n])) : z(e[n]) : e[n], n, void 0, a && a[n]);
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
		if (d) return n === "$attrs" && I(e.attrs, "get", ""), d(e);
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
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: T, renderTracked: E, renderTriggered: ee, errorCaptured: D, serverPrefetch: te, expose: O, inheritAttrs: ne, components: re, directives: k, filters: ie } = t;
	if (u && hr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ At(t));
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
	function A(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (A(Xn, p), A(Zn, m), A(Qn, g), A($n, _), A(Wn, y), A(Gn, b), A(ar, D), A(ir, E), A(rr, ee), A(er, S), A(tr, w), A(nr, te), d(O)) {
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
	T && e.render === r && (e.render = T), ne != null && (e.inheritAttrs = ne), re && (e.components = re), k && (e.directives = k), te && Ln(e);
}
function hr(e, t, n = r) {
	d(e) && (e = Cr(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? Cn(r.from || n, r.default, !0) : Cn(r.from || n) : Cn(r), /* @__PURE__ */ B(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function gr(e, t, n) {
	Qt(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
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
				c && (Qt(o, l._instance, 16), e(null, l._container), delete l._container.__vue_app__);
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
var Ar = null, jr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${D(t)}Modifiers`] || e[`${O(t)}Modifiers`];
function Mr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && jr(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(ae)));
	let c, l = i[c = re(n)] || i[c = re(D(n))];
	!l && o && (l = i[c = re(O(n))]), l && Qt(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, Qt(u, e, 6, a);
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
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, O(t)) || u(e, t));
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
	return n === "style" && v(r) && v(i) ? !ve(r, i) : r !== i;
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
	e.props = n ? r ? i : /* @__PURE__ */ jt(i) : e.type.props ? i : a, e.attrs = a;
}
function qr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ R(i), [c] = e.propsOptions, l = !1;
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
						let t = D(o);
						i[t] = Yr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		Jr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = O(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Yr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Xe(e.attrs, "set", "");
}
function Jr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (T(t)) continue;
		let l = n[t], d;
		a && u(a, d = D(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Fr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ R(r), i = c || t;
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
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === O(n)) && (r = !0));
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
		let n = D(c[e]);
		Qr(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = D(e);
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
	return e[0] !== "$" && !T(e);
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
		e ? (ii(r, t, n), n && A(r, "_", e, !0)) : ni(t, r);
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
	let a = se();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !ki(e, t) && (r = _e(e), j(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
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
				re(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? k(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, M);
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
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) E(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), te(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, E = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && D(e.children, d, null, r, i, li(e, a), s, u), _ && xn(e, null, r, "created"), ee(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !T(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Vi(f, r, e);
		}
		_ && xn(e, null, r, "beforeMount");
		let v = di(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && K(() => {
			try {
				f && Vi(f, r, e), v && g.enter(d), _ && xn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, ee = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || _i(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				ee(e, t, t.scopeId, t.slotScopeIds, i.parent);
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
		if (r && ui(r, !1), (g = h.onVnodeBeforeUpdate) && Vi(g, r, n, e), f && xn(n, e, r, "beforeUpdate"), r && ui(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? O(e.dynamicChildren, d, l, r, i, li(n, a), o) : s || le(e, n, l, null, r, i, li(n, a), o, !1), u > 0) {
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
		((g = h.onVnodeUpdated) || f) && K(() => {
			g && Vi(g, r, n, e), f && xn(n, e, r, "updated");
		}, i);
	}, O = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === q || !ki(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, ne = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !T(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (T(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, re = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), D(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (O(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && fi(e, t, !0)) : le(e, t, n, f, i, a, s, c, l);
	}, k = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : A(t, n, r, i, a, o, c) : ae(e, t, c);
	}, A = (e, t, n, r, i, a, o) => {
		let s = e.component = Wi(e, r, i);
		if (Un(e) && (s.ctx.renderer = M), Qi(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, oe, o), !e.el) {
				let r = s.subTree = Mi(bi);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else oe(s, e, t, n, i, a, o);
	}, ae = (e, t, n) => {
		let r = t.component = e.component;
		if (zr(e, t, n)) {
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
					let n = mi(e);
					if (n) {
						t && (t.el = c.el, ce(e, t, o)), n.asyncDep.then(() => {
							K(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				ui(e, !1), t ? (t.el = c.el, ce(e, t, o)) : t = c, n && ie(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Vi(d, s, t, c), ui(e, !0);
				let f = Ir(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), _e(p), e, i, a), t.el = f.el, u === null && Hr(e, f.el), r && K(r, i), (d = t.props && t.props.onVnodeUpdated) && K(() => Vi(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Hn(t);
				if (ui(e, !1), l && ie(l), !m && (o = c && c.onVnodeBeforeMount) && Vi(o, d, t), ui(e, !0), s && xe) {
					let t = () => {
						e.subTree = Ir(e), xe(s, e.subTree, e, i, null);
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
		let c = e.effect = new Te(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => un(u), ui(e, !0), l();
	}, ce = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, qr(e, t.props, r, n), oi(e, t.children, n), ze(), pn(e), Be();
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
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && ki(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? j(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? pi(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || gi(f) : i;
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
		if (c === q) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) fe(u[e], t, n, r);
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
	}, j = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (ze(), Bn(s, null, n, e, !0), Be()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Hn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Vi(_, t, e), u & 6) he(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && xn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, M, r) : l && !l.hasOnce && (a !== q || d > 0 && d & 64) ? ge(l, t, n, !1, !0) : (a === q && d & 384 || !i && u & 16) && ge(c, t, n), r && pe(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && K(() => {
			_ && Vi(_, t, e), h && xn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, pe = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === q) {
			me(n, r);
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
	}, me = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, he = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		hi(c), hi(l), r && ie(r), i.stop(), a && (a.flags |= 8, j(o, e, t, n)), s && K(s, t), K(() => {
			e.isUnmounted = !0;
		}, t);
	}, ge = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) j(e[o], t, n, r, i);
	}, _e = (e) => {
		if (e.shapeFlag & 6) return _e(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[An];
		return n ? h(n) : t;
	}, ve = !1, ye = (e, t, n) => {
		let r;
		e == null ? t._vnode && (j(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, ve ||= (ve = !0, pn(r), mn(), !1);
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
		createApp: kr(ye, be)
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
var Ai = ({ key: e }) => e ?? null, ji = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ B(e) || h(e) ? {
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
		e && !g(e) && (t.class = j(e)), v(n) && (/* @__PURE__ */ It(n) && !d(n) && (n = s({}, n)), t.style = ce(n));
	}
	let o = g(e) ? 1 : _i(e) ? 128 : jn(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return Z(e, t, n, r, i, o, a, !0);
}
function Pi(e) {
	return e ? /* @__PURE__ */ It(e) || Gr(e) ? s({}, e) : e : null;
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
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = j([t.class, r.class]));
		else if (e === "style") t.style = ce([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function Vi(e, t, n, r = null) {
	Qt(e, t, 7, [n, r]);
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
	let e = se(), t = (t, n) => {
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
		ze();
		let n = e.setupContext = r.length > 1 ? ra(e) : null, i = Ji(e), a = Zt(r, e, 0, [e.props, n]), o = y(a);
		if (Be(), i(), (o || e.sp) && !Hn(e) && Ln(e), o) {
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
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Ht(t)), ta(e, n);
}
function ta(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = Ji(e);
		ze();
		try {
			mr(e);
		} finally {
			Be(), t();
		}
	}
}
var na = { get(e, t) {
	return I(e, "get", ""), e[t];
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
	return e.exposed ? e.exposeProxy ||= new Proxy(Ht(Lt(e.exposed)), {
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
var oa = (e, t) => /* @__PURE__ */ Wt(e, t, Zi), sa = "3.5.42", ca = void 0, la = typeof window < "u" && window.trustedTypes;
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
		Ca.test(n) ? e.setProperty(O(r), n.replace(Ca, ""), "important") : e[r] = n;
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
	let r = D(t);
	if (r !== "filter" && r in e) return Ea[t] = r;
	r = ne(r);
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
function Aa(e, t, n, r, i, a = me(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(ka, t.slice(6, t.length)) : e.setAttributeNS(ka, t, n) : n == null || a && !he(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
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
		r === "boolean" ? n = he(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
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
	return [e[2] === ":" ? e.slice(3) : O(e.slice(2)), t];
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
				e && Qt(e, t, 5, a);
			}
		} else Qt(r, t, 5, [e]);
	};
	return n.value = e, n.attached = Va(), n;
}
var Ua = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Wa = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? _a(e, r, c) : t === "style" ? Sa(e, n, r) : a(t) ? o(t) || Fa(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Ga(e, t, r, c)) ? (ja(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Aa(e, t, r, c, s, t !== "value")) : e._isVueCE && (Ka(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? ja(e, D(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), Aa(e, t, r, c));
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
	let r = D(t);
	return Array.isArray(n) ? n.some((e) => D(e) === r) : Object.keys(n).some((e) => D(e) === r);
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
	let n = /* @__PURE__ */ V({}), r = /* @__PURE__ */ V(!1), i = /* @__PURE__ */ V(!1), a = /* @__PURE__ */ V(0), o = /* @__PURE__ */ V(null), s = /* @__PURE__ */ V(null), c = "", l, u = /* @__PURE__ */ new Map(), d = "", f = 0, p = new AbortController(), m, h, g = (e, t) => ({
		...e,
		inputValue: t?.inputValue || "",
		visible: t?.visible || !1,
		loading: !1,
		localError: t?.localError || "",
		localRevision: t?.localRevision || 0
	}), _ = (e) => f === e && !p.signal.aborted, v = (e) => t($a(e));
	async function y(t = f) {
		let r = await e.api.post("credentials/editors/state", { editorSessionId: d }, p.signal);
		_(t) && (n.value = Object.fromEntries(Object.entries(r.fields).map(([e, t]) => [e, g(t, n.value[e])])));
	}
	function b() {
		O(), f++, p.abort(), p = new AbortController(), m && clearInterval(m), h && clearTimeout(h);
		let t = d;
		d = "", i.value = !1, a.value = 0, n.value = {}, o.value = null, u.clear(), t && e.api.delete("credentials/editors", { editorSessionId: t }).catch(() => {});
	}
	async function x(t) {
		b();
		let a = f;
		try {
			let o = await e.clientSessions.get();
			if (!_(a)) return;
			r.value = o.nativeBrowserAvailable;
			let s = await e.api.post("credentials/editors", { taskId: t }, p.signal);
			if (!_(a)) {
				e.api.delete("credentials/editors", { editorSessionId: s.editorSessionId }).catch(() => {});
				return;
			}
			d = s.editorSessionId, n.value = Object.fromEntries(Object.entries(s.fields).map(([e, t]) => [e, g(t)])), i.value = !0;
			for (let [e, t] of Object.entries(n.value)) t.configured && t.source === "manual" && !t.error && S(e, !1);
			m = setInterval(() => {
				e.api.post("credentials/lease", { editorSessionId: d }, p.signal).catch((e) => {
					_(a) && v(e);
				});
			}, 6e4);
		} catch (e) {
			_(a) && v(e);
		}
	}
	async function S(t, r) {
		let a = f, s = n.value[t];
		if (!s || !i.value || (await E(), !_(a) || n.value[t] !== s || s.localError)) return;
		let c = s.fieldGeneration;
		s.loading = !0, s.localError = "";
		try {
			let i = await e.api.post("tasks/credential/read", {
				editorSessionId: d,
				platform: t,
				fieldGeneration: c
			}, p.signal);
			if (!_(a) || n.value[t] !== s || s.fieldGeneration !== c) return;
			if (i.platform !== t || i.fieldGeneration !== c || typeof i.configured != "boolean" || (i.configured ? typeof i.value != "string" : i.value !== null)) throw Error("credential_read_failed");
			s.inputValue = i.value || "", s.visible = r, s.source === "browser" && typeof i.revealRemainingSeconds == "number" && (h && clearTimeout(h), h = setTimeout(() => {
				for (let e of Object.values(n.value)) e.source === "browser" && (e.visible = !1, e.inputValue = "");
			}, Math.max(0, i.revealRemainingSeconds * 1e3)));
		} catch (e) {
			_(a) && n.value[t] === s && (s.visible = !1, $a(e) === "reveal_confirmation_required" ? o.value = t : s.localError = $a(e));
		} finally {
			_(a) && n.value[t] === s && (s.loading = !1);
		}
	}
	function C(t, r, o = !1) {
		let s = n.value[t];
		if (!s || !i.value) return;
		r || (o = !0), o || (s.inputValue = r);
		let c = ++s.localRevision, l = f, m = d;
		a.value++;
		let h = (u.get(t) || Promise.resolve()).then(async () => {
			if (!_(l)) return;
			if (s.localError) throw Error("credential_draft_unconfirmed");
			let i = await e.api.put("credentials/draft", {
				editorSessionId: m,
				platform: t,
				expectedFieldGeneration: s.fieldGeneration,
				mutation: o ? "clear" : s.source === "browser" ? "edit-current" : "set-manual",
				...o ? {} : { value: r }
			}, p.signal);
			_(l) && n.value[t] === s && (Object.assign(s, i), o && s.localRevision === c && (s.inputValue = "", s.visible = !1));
		}).catch(async (e) => {
			_(l) && (s.localError = $a(e), v(e));
		}).finally(() => {
			_(l) && a.value--;
		});
		u.set(t, h);
	}
	async function w(e) {
		let t = n.value[e];
		if (t) {
			if (t.localError) {
				await E(), await y();
				let t = n.value[e];
				t && (t.localError = "");
			}
			C(e, "", !0);
		}
	}
	async function T(e) {
		let t = n.value[e];
		t && (t.localError = "", await S(e, t.visible));
	}
	async function E() {
		await Promise.all([...u.values()]);
	}
	async function ee(e) {
		let t = n.value[e];
		if (t && i.value) {
			if (t.visible) {
				if (await E(), t.localError) return;
				t.visible = !1, t.source === "browser" && (t.inputValue = "");
			} else t.source === "browser" ? await S(e, !0) : t.visible = !0;
		}
	}
	async function D() {
		let t = o.value, r = f;
		if (t) {
			o.value = null;
			try {
				let i = await e.api.post("tasks/credential/reveal/confirm", { confirm: !0 }, p.signal);
				if (!_(r)) return;
				h && clearTimeout(h), h = setTimeout(() => {
					for (let e of Object.values(n.value)) e.source === "browser" && (e.visible = !1, e.inputValue = "");
				}, Math.max(0, Date.parse(i.expiresAt) - Date.now())), await S(t, !0);
			} catch (e) {
				_(r) && v(e);
			}
		}
	}
	async function te(t) {
		let i = f, a = n.value[t];
		if (!a || !r.value || (await E(), a.localError || !_(i))) return;
		let o = !1, l = (e) => {
			o || (o = !0, v(e));
		};
		a.loading = !0;
		try {
			let r = await e.api.post("credentials/login/prepare", {
				editorSessionId: d,
				platform: t,
				expectedFieldGeneration: a.fieldGeneration
			}, p.signal);
			if (!_(i)) return;
			if (a.fieldGeneration = r.fieldGeneration, t === "tajiduo") {
				c = String(r.context.operation || ""), s.value = {
					phone: "",
					value: "",
					mode: "sms",
					busy: !1,
					sent: !1,
					error: ""
				};
				return;
			}
			let o = await (await e.browserLogin.open(r, p.signal)).completed;
			if (!_(i)) return;
			let u = !o.success && ["browser_operation_cancelled", "credential_editor_closed"].includes(o.error || "");
			!o.success && !u && l(Error(o.error || "browser_validation_failed"));
			try {
				await y(i);
			} catch (e) {
				if (!u) throw e;
			}
			if (o.success) {
				let e = n.value[t];
				e.visible = !1, e.inputValue = "";
			}
		} catch (e) {
			_(i) && !(e instanceof DOMException && e.name === "AbortError") && l(e);
		} finally {
			if (_(i)) {
				a.loading = !1;
				let e = n.value[t];
				e && (e.loading = !1);
			}
		}
	}
	function O() {
		let t = c;
		if (c = "", l?.abort(), l = void 0, s.value &&= (s.value.phone = "", s.value.value = "", null), t && d) {
			let n = f;
			e.api.delete("credentials/login/tajiduo", {
				editorSessionId: d,
				operation: t
			}).then(() => {
				if (_(n) && i.value) return y(n);
			}).catch(() => {});
		}
	}
	async function ne(t = !1) {
		let r = s.value, i = f, a = c;
		if (!r || r.busy || !a) return;
		r.busy = !0, r.error = "", l = new AbortController();
		let o = AbortSignal.any([p.signal, l.signal]), u = {
			editorSessionId: d,
			operation: a,
			mode: t ? "send" : r.mode,
			phone: r.phone.trim(),
			value: t ? "" : r.value
		};
		r.value = "";
		try {
			let t = await e.api.post("credentials/login/tajiduo", u, o);
			if (!_(i) || c !== a) return;
			if (t.sent) {
				r.sent = !0;
				return;
			}
			if (!t.editor) throw Error("credential_request_failed");
			let l = await e.api.post("credentials/login/tajiduo", {
				editorSessionId: d,
				operation: a,
				mode: "accept"
			}, o);
			if (!_(i) || c !== a) return;
			n.value = Object.fromEntries(Object.entries(l.editor.fields).map(([e, t]) => [e, g(t, n.value[e])])), n.value.tajiduo.visible = !1, n.value.tajiduo.inputValue = "", c = "", r.phone = "", s.value = null;
		} catch (e) {
			_(i) && c === a && (r.error = $a(e));
		} finally {
			u.phone = "", u.value = "", r.busy = !1;
		}
	}
	async function re() {
		return await E(), s.value || !i.value || Object.values(n.value).some((e) => e.localError || e.error || e.loading) ? null : {
			editorSessionId: d,
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
		tajiduo: s,
		submitTajiduo: ne,
		cancelTajiduo: O,
		open: x,
		close: b,
		read: S,
		retry: T,
		mutate: C,
		clear: w,
		visibility: ee,
		confirm: D,
		login: te,
		payload: re
	};
}
//#endregion
//#region src/TajiduoLogin.vue?vue&type=script&setup=true&lang.ts
var to = ["title", "aria-label"], no = { class: "gci-checkin-fields" }, ro = ["label"], io = [
	"model-value",
	"disabled",
	"options",
	"aria-label"
], ao = ["label"], oo = [
	"model-value",
	"disabled",
	"aria-label"
], so = ["label"], co = [
	"model-value",
	"disabled",
	"aria-label"
], lo = ["label", "disabled"], uo = {
	key: 1,
	role: "status"
}, fo = {
	key: 2,
	role: "alert"
}, po = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, mo = ["label"], ho = ["label", "disabled"], go = /* @__PURE__ */ In({
	__name: "TajiduoLogin",
	props: {
		form: {},
		translate: { type: Function }
	},
	emits: ["close", "submit"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = (e, t) => n.translate(e, {}, t), a = /* @__PURE__ */ new WeakMap(), o = {
			mounted(e, t) {
				let r = (e) => {
					let r = e.detail;
					n.form[t.value] = String(Array.isArray(r) ? r[0] : r ?? "");
				};
				a.set(e, r), e.addEventListener("update:modelValue", r);
			},
			unmounted(e) {
				let t = a.get(e);
				t && e.removeEventListener("update:modelValue", t), a.delete(e);
			}
		};
		function s(e) {
			let t = e.detail;
			n.form.mode = String(Array.isArray(t) ? t[0] : t), n.form.value = "";
		}
		return (t, n) => (Y(), X("nxp-modal", {
			open: "",
			locked: "",
			footer: "",
			title: i("tajiduo.login_title", "塔吉多登录"),
			"aria-label": i("tajiduo.login_title", "塔吉多登录"),
			onClose: n[3] ||= (e) => r("close")
		}, [Z("div", no, [
			Z("p", null, M(i("tajiduo.login_help", "通过官方账号接口登录。密码和验证码仅用于本次认证，不会保存；登录后请保存签到任务使凭据生效。")), 1),
			Z("nxp-field", { label: i("tajiduo.login_method", "登录方式") }, [Z("nxp-select", {
				id: "gci-tajiduo-mode",
				"model-value": e.form.mode,
				disabled: e.form.busy,
				options: [{
					value: "sms",
					label: i("tajiduo.sms", "短信验证码")
				}, {
					value: "password",
					label: i("tajiduo.password", "密码")
				}],
				"aria-label": i("tajiduo.login_method", "登录方式"),
				onChange: s
			}, null, 40, io)], 8, ro),
			Z("nxp-field", { label: i("tajiduo.phone", "手机号") }, [bn(Z("nxp-text-input", {
				id: "gci-tajiduo-phone",
				"model-value": e.form.phone,
				disabled: e.form.busy,
				autocomplete: "off",
				"aria-label": i("tajiduo.phone", "手机号")
			}, null, 8, oo), [[o, "phone"]])], 8, ao),
			Z("nxp-field", { label: e.form.mode === "sms" ? i("tajiduo.sms", "短信验证码") : i("tajiduo.password", "密码") }, [bn(Z("nxp-text-input", {
				id: "gci-tajiduo-value",
				"model-value": e.form.value,
				type: "password",
				disabled: e.form.busy,
				autocomplete: "new-password",
				"aria-label": e.form.mode === "sms" ? i("tajiduo.sms", "短信验证码") : i("tajiduo.password", "密码")
			}, null, 8, co), [[o, "value"]])], 8, so),
			e.form.mode === "sms" ? (Y(), X("nxp-button", {
				key: 0,
				label: i("tajiduo.send_sms", "发送验证码"),
				disabled: e.form.busy,
				onClick: n[0] ||= (e) => r("submit", !0)
			}, null, 8, lo)) : Q("", !0),
			e.form.sent ? (Y(), X("p", uo, M(i("tajiduo.sms_sent", "验证码已发送，请输入收到的验证码。60 秒内请勿重复发送。")), 1)) : Q("", !0),
			e.form.error ? (Y(), X("p", fo, M(e.translate(`error.${e.form.error}`, {}, i("tajiduo.login_failed", "登录未完成，请检查信息、网络或官方账号状态后重试。"))), 1)) : Q("", !0)
		]), Z("div", po, [Z("nxp-button", {
			label: i("action.cancel", "取消"),
			onClick: n[1] ||= (e) => r("close")
		}, null, 8, mo), Z("nxp-button", {
			tone: "primary",
			label: e.form.busy ? i("tajiduo.signing_in", "正在登录…") : i("tajiduo.sign_in", "登录"),
			disabled: e.form.busy,
			onClick: n[2] ||= (e) => r("submit", !1)
		}, null, 8, ho)])], 40, to));
	}
}), _o = [
	"open",
	"title",
	"aria-label",
	"close-label"
], vo = {
	key: 0,
	class: "gci-editor",
	"data-task-editor": ""
}, yo = { class: "gci-editor-section" }, bo = { class: "gci-form-grid" }, xo = ["label"], So = [
	"model-value",
	"aria-invalid",
	"aria-label"
], Co = ["label"], wo = ["model-value", "aria-label"], To = [
	"model-value",
	"label",
	"description",
	"aria-label"
], Eo = [
	"title",
	"description",
	"expanded"
], Do = { class: "gci-checkin-fields" }, Oo = { class: "gci-platform-list" }, ko = ["label", "help"], Ao = [
	"id",
	"model-value",
	"options",
	"disabled",
	"placeholder",
	"aria-label",
	"onChange"
], jo = { class: "gci-credential-list" }, Mo = ["label", "help"], No = { class: "gci-credential-input-row" }, Po = [
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
], Fo = [
	"label",
	"aria-label",
	"disabled",
	"onClick"
], Io = [
	"id",
	"label",
	"aria-label",
	"disabled",
	"onClick"
], Lo = {
	key: 0,
	role: "alert"
}, Ro = [
	"disabled",
	"label",
	"onClick"
], zo = {
	key: 2,
	role: "status"
}, Bo = { class: "gci-notification-settings" }, Vo = [
	"model-value",
	"label",
	"description",
	"aria-label"
], Ho = ["label", "help"], Uo = [
	"model-value",
	"options",
	"aria-label"
], Wo = { class: "gci-schedules" }, Go = { class: "gci-section-heading" }, Ko = ["aria-label"], qo = [
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
], Jo = [
	"aria-pressed",
	"aria-label",
	"title",
	"onClick"
], Yo = [
	"id",
	"model-value",
	"aria-label",
	"onChange"
], Xo = [
	"model-value",
	"aria-label",
	"onChange"
], Zo = ["label", "onClick"], Qo = {
	key: 1,
	class: "gci-empty-schedules"
}, $o = ["label", "disabled"], es = {
	key: 0,
	class: "gci-error",
	role: "alert"
}, ts = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, ns = [
	"label",
	"busy",
	"disabled"
], rs = ["label", "disabled"], is = ["title", "close-label"], as = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, os = ["label"], ss = ["label"], cs = /* @__PURE__ */ In({
	__name: "CheckInTaskEditor",
	props: {
		open: { type: Boolean },
		task: {},
		tasks: {},
		platforms: {},
		notificationTasks: {},
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
		let n = e, r = t, i = /* @__PURE__ */ V(null), a = eo(n.host, (e) => {
			n.open && n.host.ui?.toast(S(`error.${e}`, {}, "凭据操作未完成，请检查后重试。"), "error");
		}), { fields: o, native: s, ready: c, confirmation: l, tajiduo: u } = a, d = /* @__PURE__ */ new WeakMap(), f = {
			mounted(e, t) {
				let n = (e) => se(t.value, String(C(e) || ""));
				d.set(e, n), e.addEventListener("update:modelValue", n);
			},
			unmounted(e) {
				let t = d.get(e);
				t && e.removeEventListener("update:modelValue", t), d.delete(e);
			}
		}, p = oa(() => {
			let e = n.notificationTasks.map((e) => ({
				value: e.id,
				label: `${e.name} · ${e.type.toUpperCase()}${e.configured ? e.enabled ? "" : ` · ${S("status.notification_disabled", {}, "已禁用")}` : ` · ${S("status.notification_invalid", {}, "配置异常")}`}`
			}));
			for (let t of i.value?.notification.notificationTaskIds || []) e.some((e) => e.value === t) || e.push({
				value: t,
				label: S("status.notification_deleted", {}, "已删除的通知任务")
			});
			return e;
		}), m = /* @__PURE__ */ V(!0), h = /* @__PURE__ */ V([]), g = /* @__PURE__ */ V(""), _ = /* @__PURE__ */ V(""), v = 0, y = oa(() => [
			S("day.0", {}, "周日"),
			S("day.1", {}, "周一"),
			S("day.2", {}, "周二"),
			S("day.3", {}, "周三"),
			S("day.4", {}, "周四"),
			S("day.5", {}, "周五"),
			S("day.6", {}, "周六")
		]), b = oa(() => [
			S("common.sun", {}, "日"),
			S("common.mon", {}, "一"),
			S("common.tue", {}, "二"),
			S("common.wed", {}, "三"),
			S("common.thu", {}, "四"),
			S("common.fri", {}, "五"),
			S("common.sat", {}, "六")
		]);
		En(() => `${n.open}:${n.task?.id || "new"}`, () => {
			n.open ? w() : x();
		}, { immediate: !0 });
		function x() {
			a.close(), i.value = null;
		}
		er(x);
		function S(e, t = {}, r = "") {
			return n.translate(e, t, r);
		}
		function C(e) {
			let t = e.detail;
			return Array.isArray(t) && t.length ? t[0] : t === void 0 ? e.target?.modelValue : t;
		}
		function w() {
			x();
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
					notificationTaskIds: [...e.notification?.notificationTaskIds || []]
				}
			} : {
				name: "",
				remark: "",
				enabled: !0,
				games: {},
				schedules: [],
				notification: {
					enabled: !1,
					notificationTaskIds: []
				}
			}, a.open(e?.id), m.value = !0, g.value = "", _.value = "", h.value = [];
		}
		function T(e, t) {
			i.value && (i.value[e] = t), e === "name" && (_.value = "", g.value = "", r("nameChange"));
		}
		function E(e, t) {
			if (!i.value) return;
			let n = C(t), r = Array.isArray(n) ? n.map(String) : [];
			r.length ? i.value.games[e] = r : delete i.value.games[e];
		}
		function ee(e) {
			return S(`field.${e}_games_description`, {}, "可留空。");
		}
		function D(e) {
			return e === "cn" ? "cnCookie" : e === "os" ? "osCookie" : e === "skland" ? "sklandToken" : e === "skport" ? "skportToken" : e === "kuro" ? "kuroToken" : e;
		}
		function te(e) {
			return S(`field.${D(e)}_description`, {}, "填写该平台凭据。");
		}
		function O(e) {
			return S(`field.${D(e)}_placeholder`, {}, "");
		}
		function ne(e) {
			let t = o.value[e];
			return t?.intent === "set" ? S("field.secret_set_pending", {}, "新凭据待保存") : t?.configured ? [t.maskedAccount, S("field.secret_configured", {}, "已配置，点击眼睛显示")].filter(Boolean).join(" · ") : O(e);
		}
		function re() {
			if (!i.value || i.value.schedules.length >= 30) return;
			let e = globalThis.crypto?.randomUUID, t = typeof e == "function" ? e.call(globalThis.crypto) : `draft-${Date.now().toString(36)}-${(++v).toString(36)}`, n = {
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
			i.value.schedules.push(n), h.value = [...h.value, t];
		}
		function k(e) {
			if (!i.value) return;
			let [t] = i.value.schedules.splice(e, 1);
			t && (h.value = h.value.filter((e) => e !== t.id));
		}
		function ie(e) {
			return h.value.includes(e);
		}
		function A(e) {
			h.value = ie(e) ? h.value.filter((t) => t !== e) : [...h.value, e];
		}
		function ae(e, t) {
			e.days = e.days.includes(t) ? e.days.filter((e) => e !== t) : [...e.days, t].sort((e, t) => e - t);
		}
		function oe(e) {
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
				let e = S("error.task_name_invalid", {}, "请输入不超过 100 个字符的任务名称。");
				_.value = e, r("invalid", e);
				return;
			}
			if (n.tasks.some((t) => t.id !== e.id && t.name.toLocaleLowerCase() === e.name.trim().toLocaleLowerCase())) {
				let e = S("error.task_name_duplicate", {}, "签到任务名称已存在。");
				_.value = e, r("invalid", e);
				return;
			}
			if (new TextEncoder().encode(e.remark).length > 512) {
				g.value = S("error.task_remark_invalid", {}, "备注不能超过 512 字节。");
				return;
			}
			if (e.schedules.some((e) => e.days.length === 0 || !/^\d{2}:\d{2}$/.test(e.time))) {
				g.value = S("error.schedule_settings_invalid", {}, "请检查计划时间和执行星期。");
				return;
			}
			g.value = "";
			let t = await a.payload();
			if (!t) {
				g.value = S("error.credential_draft_unconfirmed", {}, "凭据草稿尚未确认，请检查错误后再保存。");
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
					notificationTaskIds: [...e.notification.notificationTaskIds]
				},
				...t
			});
		}
		return (t, n) => (Y(), X(q, null, [
			e.open ? (Y(), X("nxp-modal", {
				key: 0,
				open: e.open,
				title: e.task ? S("editor.edit_title", {}, "编辑签到任务") : S("editor.new_title", {}, "新建签到任务"),
				"aria-label": e.task ? S("editor.edit_title", {}, "编辑签到任务") : S("editor.new_title", {}, "新建签到任务"),
				size: "wide",
				locked: "",
				footer: "",
				"close-label": S("action.close", {}, "关闭"),
				onClose: n[9] ||= (e) => r("close")
			}, [i.value ? (Y(), X("div", vo, [
				Z("section", yo, [Z("div", bo, [Z("nxp-field", {
					label: S("field.name", {}, "任务名称"),
					required: ""
				}, [Z("nxp-text-input", {
					id: "gci-task-name",
					"model-value": i.value.name,
					required: "",
					"aria-invalid": _.value || e.nameError ? "true" : "false",
					"aria-label": S("field.name", {}, "任务名称"),
					onChange: n[0] ||= (e) => T("name", String(C(e) || "")),
					"onUpdate:modelValue": n[1] ||= (e) => T("name", String(C(e) || ""))
				}, null, 40, So)], 8, xo), Z("nxp-field", { label: S("field.remark", {}, "备注") }, [Z("nxp-text-area", {
					id: "gci-task-remark",
					"model-value": i.value.remark,
					rows: "2",
					"aria-label": S("field.remark", {}, "备注"),
					onChange: n[2] ||= (e) => T("remark", String(C(e) || ""))
				}, null, 40, wo)], 8, Co)]), Z("nxp-switch-setting", {
					id: "gci-task-enabled",
					"model-value": i.value.enabled,
					label: S("field.task_enabled", {}, "启用此任务"),
					description: S("field.task_enabled_help", {}, "停用后不会按计划自动签到。"),
					"aria-label": S("field.task_enabled", {}, "启用此任务"),
					onChange: n[3] ||= (e) => T("enabled", C(e))
				}, null, 40, To)]),
				Z("nxp-collapsible-card", {
					class: "gci-checkin-settings",
					title: S("field.checkin_settings", {}, "签到设置"),
					description: S("field.checkin_settings_help", {}, "按需配置五个平台的游戏和凭据，本任务触发时将对所选游戏执行签到。"),
					"panel-id": "gci-checkin-settings",
					surface: "secondary",
					expanded: m.value,
					onToggle: n[6] ||= (e) => m.value = C(e)
				}, [Z("div", Do, [
					Z("div", Oo, [(Y(!0), X(q, null, sr(e.platforms, (e) => (Y(), X("nxp-field", {
						key: `${e.id}-games`,
						label: S("field.platform_games", { platform: e.name }, `${e.name} 签到游戏`),
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
						placeholder: S("common.choose", {}, "请选择"),
						"aria-label": S("field.platform_games", { platform: e.name }, `${e.name} 签到游戏`),
						onChange: (t) => E(e.id, t)
					}, null, 40, Ao)], 8, ko))), 128))]),
					Z("div", jo, [(Y(!0), X(q, null, sr(e.platforms, (t) => (Y(), X("div", {
						key: t.id,
						class: "gci-credential-row"
					}, [
						Z("nxp-field", {
							label: S("field.credential", { platform: t.name }, `${t.name} 凭据`),
							help: te(t.id)
						}, [Z("div", No, [
							bn(Z("nxp-text-input", {
								id: `gci-secret-${t.id}`,
								"model-value": H(o)[t.id]?.inputValue || "",
								type: "password",
								"show-password-toggle": !0,
								"password-visibility-controlled": "",
								"password-visible": H(o)[t.id]?.visible === !0,
								"secret-configured": H(o)[t.id]?.configured === !0,
								readonly: H(o)[t.id]?.source === "browser" && !H(o)[t.id]?.visible,
								"show-password-label": S("field.secret_show", {}, "显示凭据"),
								"hide-password-label": S("field.secret_hide", {}, "隐藏凭据"),
								disabled: e.submitting || !H(c) || H(o)[t.id]?.loading,
								autocomplete: "new-password",
								placeholder: ne(t.id),
								"aria-label": S("field.credential", { platform: t.name }, `${t.name} 凭据`),
								onPasswordVisibilityRequest: (e) => H(a).visibility(t.id)
							}, null, 40, Po), [[f, t.id]]),
							H(s) && t.browserLogin?.ready ? (Y(), X("nxp-button", {
								key: 0,
								label: S("field.browser_login", {}, "网页登录"),
								"aria-label": `${t.name} · ${S("field.browser_login", {}, "网页登录")}`,
								disabled: e.submitting || !H(c) || H(o)[t.id]?.loading,
								onClick: (e) => H(a).login(t.id)
							}, null, 8, Fo)) : Q("", !0),
							H(o)[t.id]?.configured ? (Y(), X("nxp-button", {
								key: 1,
								id: `gci-clear-${t.id}`,
								label: S("field.secret_clear", {}, "清除已保存凭据"),
								"aria-label": `${t.name} · ${S("field.secret_clear", {}, "清除已保存凭据")}`,
								disabled: e.submitting || !H(c) || H(o)[t.id]?.loading,
								onClick: (e) => ce(t.id)
							}, null, 8, Io)) : Q("", !0)
						])], 8, Mo),
						H(o)[t.id]?.localError || H(o)[t.id]?.error ? (Y(), X("p", Lo, M(S(`error.${H(o)[t.id]?.localError || H(o)[t.id]?.error}`, {}, "凭据草稿未确认，请检查后清除并重新填写。")), 1)) : Q("", !0),
						H(o)[t.id]?.localError && H(o)[t.id]?.intent === "keep" ? (Y(), X("nxp-button", {
							key: 1,
							disabled: e.submitting,
							label: S("field.secret_retry", {}, "重试读取"),
							onClick: (e) => H(a).retry(t.id)
						}, null, 8, Ro)) : Q("", !0),
						H(o)[t.id]?.intent === "clear" ? (Y(), X("p", zo, M(S("field.secret_clear_pending", {}, "将在保存后清除")), 1)) : Q("", !0)
					]))), 128))]),
					Z("section", Bo, [Z("nxp-switch-setting", {
						id: "gci-notification-enabled",
						"model-value": i.value.notification.enabled,
						label: S("field.notifications_enabled", {}, "启用通知"),
						description: S("field.notifications_help", {}, "选择通知任务；不选则不发送。"),
						"aria-label": S("field.notifications_enabled", {}, "启用通知"),
						onChange: n[4] ||= (e) => i.value.notification.enabled = C(e)
					}, null, 40, Vo), Z("nxp-field", {
						label: S("field.notification_tasks", {}, "通知任务"),
						help: S("field.notifications_help", {}, "选择通知任务；不选则不发送。")
					}, [Z("nxp-select", {
						id: "gci-notification-tasks",
						"model-value": i.value.notification.notificationTaskIds,
						options: p.value,
						multiple: !0,
						"aria-label": S("field.notification_tasks", {}, "通知任务"),
						onChange: n[5] ||= (e) => i.value.notification.notificationTaskIds = C(e)
					}, null, 40, Uo)], 8, Ho)])
				])], 40, Eo),
				Z("section", Wo, [
					Z("header", Go, [Z("div", null, [Z("h3", null, M(S("field.schedule", {}, "定时计划")), 1), Z("p", null, M(S("field.schedule_help", { zone: e.timeZoneId }, `按本机时区 ${e.timeZoneId} 执行；应用关闭期间错过的时间不会补跑。`)), 1)])]),
					i.value.schedules.length ? (Y(), X("nxp-sortable-list", {
						key: 0,
						layout: "schedule",
						tag: "div",
						"aria-label": S("field.schedule", {}, "定时计划"),
						onReorder: n[7] ||= (e) => oe(C(e))
					}, [(Y(!0), X(q, null, sr(i.value.schedules, (e, t) => (Y(), X("nxp-schedule-card", {
						key: e.id,
						"item-id": e.id,
						"data-dnd-id": e.id,
						"panel-id": `gci-schedule-${e.id}`,
						"summary-label": S("schedule.label", { index: t + 1 }, `定时 ${t + 1}`),
						"summary-meta": `${e.time} · ${S("schedule.days_count", { count: e.days.length }, `${e.days.length} 天`)}`,
						"days-label": S("field.schedule_days", {}, "执行周期（可多选）"),
						"days-aria-label": S("field.schedule_days", {}, "执行星期"),
						"time-label": S("field.schedule_time", {}, "执行时间"),
						expanded: ie(e.id),
						"drag-label": S("common.reorder.schedule", { index: t + 1 }, `调整计划 ${t + 1} 的顺序`),
						"drag-title": S("common.drag_to_reorder", {}, "拖动以调整顺序"),
						onToggle: (t) => A(e.id)
					}, [
						(Y(!0), X(q, null, sr(y.value, (t, n) => (Y(), X("nxp-button", {
							key: n,
							slot: "days",
							class: "gci-day-button",
							"aria-pressed": e.days.includes(n),
							"aria-label": t,
							title: t,
							onClick: (t) => ae(e, n)
						}, M(b.value[n]), 9, Jo))), 128)),
						Z("nxp-time-picker", {
							slot: "time",
							id: `gci-time-${e.id}`,
							"model-value": e.time,
							"aria-label": S("field.schedule_time", {}, "时间"),
							onChange: (t) => e.time = String(C(t) || e.time)
						}, null, 40, Yo),
						Z("nxp-switch", {
							slot: "actions",
							"model-value": e.enabled,
							"semantic-role": "switch",
							"aria-label": `${S("field.schedule_enabled", {}, "启用此计划")} ${t + 1}`,
							onChange: (t) => e.enabled = C(t)
						}, null, 40, Xo),
						Z("nxp-button", {
							slot: "actions",
							label: S("action.remove_schedule", {}, "删除计划"),
							onClick: (e) => k(t)
						}, null, 8, Zo)
					], 40, qo))), 128))], 40, Ko)) : (Y(), X("p", Qo, M(S("empty.schedules", {}, "还没有定时计划")), 1)),
					Z("nxp-button", {
						label: `+ ${S("action.add_schedule", {}, "添加定时")}`,
						variant: "ghost",
						disabled: i.value.schedules.length >= 30,
						onClick: re
					}, null, 8, $o)
				]),
				g.value || e.error ? (Y(), X("p", es, M(g.value || e.error), 1)) : Q("", !0)
			])) : Q("", !0), Z("div", ts, [Z("nxp-button", {
				label: e.submitting ? S("status.saving", {}, "保存中…") : S("action.save", {}, "保存"),
				tone: "primary",
				busy: e.submitting,
				disabled: !H(c),
				onClick: le
			}, null, 8, ns), Z("nxp-button", {
				label: S("action.cancel", {}, "取消"),
				variant: "ghost",
				disabled: e.submitting,
				onClick: n[8] ||= (e) => r("close")
			}, null, 8, rs)])], 40, _o)) : Q("", !0),
			H(u) ? (Y(), Di(go, {
				key: 1,
				form: H(u),
				translate: e.translate,
				onClose: n[10] ||= (e) => H(a).cancelTajiduo(),
				onSubmit: n[11] ||= (e) => H(a).submitTajiduo(e)
			}, null, 8, ["form", "translate"])) : Q("", !0),
			H(l) ? (Y(), X("nxp-modal", {
				key: 2,
				open: "",
				footer: "",
				title: S("reveal.title", {}, "显示自动获取的凭据"),
				"close-label": S("action.close", {}, "关闭"),
				onClose: n[14] ||= (e) => l.value = null
			}, [Z("p", null, M(S("reveal.description", {}, "凭据可用于访问你的账号。确认后，本客户端在 24 小时内可主动显示自动凭据；其他客户端仍需单独确认。关闭服务后确认失效。")), 1), Z("div", as, [Z("nxp-button", {
				tone: "primary",
				label: S("reveal.confirm", {}, "确认显示"),
				onClick: n[12] ||= (e) => H(a).confirm()
			}, null, 8, os), Z("nxp-button", {
				variant: "ghost",
				label: S("action.cancel", {}, "取消"),
				onClick: n[13] ||= (e) => l.value = null
			}, null, 8, ss)])], 40, is)) : Q("", !0)
		], 64));
	}
}), ls = ["aria-label"], us = ["data-task-id", "data-dnd-id"], ds = { class: "gci-task-row-main" }, fs = ["label", "title"], ps = {
	class: "gci-task-avatar",
	"aria-hidden": "true"
}, ms = { class: "gci-task-copy" }, hs = { class: "gci-task-heading" }, gs = ["label"], _s = {
	key: 0,
	class: "gci-task-remark"
}, vs = { class: "gci-task-meta" }, ys = ["label", "tone"], bs = ["label", "tone"], xs = ["label", "tone"], Ss = ["label"], Cs = ["label"], ws = { class: "gci-task-actions" }, Ts = [
	"label",
	"disabled",
	"onClick"
], Es = ["label", "onClick"], Ds = [
	"label",
	"disabled",
	"onClick"
], Os = {
	key: 0,
	class: "gci-run-history"
}, ks = { class: "gci-run-list" }, As = { class: "gci-run-entry" }, js = { class: "gci-run-entry-head" }, Ms = ["label", "tone"], Ns = { key: 0 }, Ps = { key: 1 }, Fs = { class: "gci-diagnostics" }, Is = /* @__PURE__ */ In({
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
		}, [Z("div", ds, [
			Z("nxp-drag-handle", {
				class: "gci-drag-handle",
				label: i("common.reorder.task", { name: e.name }, `调整 ${e.name} 的顺序`),
				title: i("common.drag_to_reorder", {}, "拖动以调整顺序")
			}, null, 8, fs),
			Z("span", ps, M(o(e.name)), 1),
			Z("div", ms, [
				Z("div", hs, [Z("h2", null, [Z("nxp-overflow-text", { label: e.name }, null, 8, gs)])]),
				e.remark ? (Y(), X("p", _s, M(e.remark), 1)) : Q("", !0),
				Z("div", vs, [
					Z("nxp-badge", {
						label: e.enabled ? i("status.enabled", {}, "已启用") : i("status.disabled", {}, "已停用"),
						tone: e.enabled ? "ok" : "muted"
					}, null, 8, ys),
					e.recentRun ? (Y(), X("nxp-badge", {
						key: 0,
						label: i(`status.${e.recentRun.status}`, {}, e.recentRun.status),
						tone: l(e.recentRun.status)
					}, null, 8, bs)) : Q("", !0),
					Z("nxp-badge", {
						label: e.notification?.enabled ? i("status.notifications_on", {}, "通知已开启") : i("status.notifications_off", {}, "通知已关闭"),
						tone: e.notification?.enabled ? "blue" : "muted"
					}, null, 8, xs),
					Z("nxp-badge", {
						label: i("task.games_count", { count: s(e) }, `${s(e)} 个游戏`),
						tone: "muted"
					}, null, 8, Ss),
					Z("nxp-badge", {
						label: c(e.nextRunAt),
						tone: "blue"
					}, null, 8, Cs)
				])
			]),
			Z("div", ws, [
				Z("nxp-button", {
					label: i("action.run", {}, "立即签到"),
					variant: "ghost",
					disabled: e.isRunning,
					onClick: (t) => r("run", e)
				}, null, 8, Ts),
				Z("nxp-button", {
					label: i("action.edit", {}, "编辑签到"),
					variant: "ghost",
					onClick: (t) => r("edit", e)
				}, null, 8, Es),
				Z("nxp-button", {
					label: i("action.delete", {}, "删除签到"),
					tone: "danger",
					variant: "ghost",
					disabled: e.isRunning,
					onClick: (t) => r("remove", e)
				}, null, 8, Ds)
			])
		]), e.recentRun ? (Y(), X("details", Os, [Z("summary", null, M(i("action.show_results", {}, "运行记录")), 1), Z("div", ks, [Z("section", As, [
			Z("header", js, [Z("span", null, M(u(e.recentRun.completedAt || e.recentRun.startedAt)), 1), Z("nxp-badge", {
				label: i(`status.${e.recentRun.status}`, {}, e.recentRun.status),
				tone: l(e.recentRun.status)
			}, null, 8, Ms)]),
			e.recentRun.results?.length ? (Y(), X("ul", Ns, [(Y(!0), X(q, null, sr(e.recentRun.results, (e, t) => (Y(), X("li", { key: `${e.platform}-${e.gameCode}-${t}` }, [Z("span", null, M(d(e.platform, e.gameCode)), 1), Z("span", null, M(e.message), 1)]))), 128))])) : Q("", !0),
			e.recentRun.diagnostics?.length ? (Y(), X("details", Ps, [Z("summary", null, M(i("diagnostics.title", {}, "本次脱敏诊断（保留七天）")), 1), Z("pre", Fs, M(JSON.stringify(e.recentRun.diagnostics, null, 2)), 1)])) : Q("", !0)
		])])])) : Q("", !0)], 8, us))), 128))], 40, ls));
	}
}), Ls = {
	class: "gci-page",
	"data-game-check-in-page": ""
}, Rs = { class: "gci-page-header" }, zs = { class: "gci-page-header-copy" }, Bs = { class: "gci-page-header-eyebrow" }, Vs = { class: "gci-page-header-description" }, Hs = { class: "gci-page-header-actions" }, Us = ["label"], Ws = {
	key: 0,
	class: "gci-error",
	role: "alert"
}, Gs = {
	key: 1,
	class: "gci-loading",
	role: "status"
}, Ks = ["title", "description"], qs = ["label"], Js = [
	"title",
	"locked",
	"closeable",
	"close-label"
], Ys = { class: "gci-confirm-message" }, Xs = {
	slot: "footer",
	class: "gci-modal-footer-actions"
}, Zs = ["label", "disabled"], Qs = ["label", "busy"], $s = /* @__PURE__ */ In({
	__name: "GameCheckInPage",
	props: {
		host: {},
		initialState: {},
		deferPolling: { type: Boolean },
		signal: {}
	},
	setup(e, { expose: t }) {
		let n = e, r = /* @__PURE__ */ V(n.initialState ? {
			notificationTasks: n.initialState.notificationTasks || [],
			tasks: Array.isArray(n.initialState.tasks) ? n.initialState.tasks : [],
			platforms: Array.isArray(n.initialState.platforms) ? n.initialState.platforms : [],
			timeZoneId: typeof n.initialState.timeZoneId == "string" ? n.initialState.timeZoneId : ""
		} : null), i = /* @__PURE__ */ V(!n.initialState), a = /* @__PURE__ */ V(!1), o = /* @__PURE__ */ V(!1), s = /* @__PURE__ */ V(null), c = /* @__PURE__ */ V(""), l = /* @__PURE__ */ V(""), u = /* @__PURE__ */ V(""), d = /* @__PURE__ */ V(null), f = /* @__PURE__ */ V(!1), p = new AbortController(), m = null, h = !1, g = !1, _ = oa(() => r.value?.tasks || []), v = oa(() => r.value?.platforms || []), y = (e, t = {}, r = "") => n.host.i18n.t(e, t, r);
		function b(e, t = {}, n = "") {
			return y(e, t, n);
		}
		function x(e) {
			let t = e;
			if (typeof t?.code == "string" && t.code) return t.code;
			let n = t?.data;
			return typeof n?.code == "string" && n.code ? n.code : typeof n?.error == "string" ? n.error : "";
		}
		function S(e, t) {
			let n = x(e);
			return n ? b(`error.${n}`, {}, t) : t;
		}
		async function C(e = !1) {
			if (!(g || h)) {
				g = !0;
				try {
					let e = await n.host.api.get("state", p.signal);
					if (h) return;
					r.value = {
						notificationTasks: e?.notificationTasks || [],
						tasks: Array.isArray(e?.tasks) ? e.tasks : [],
						platforms: Array.isArray(e?.platforms) ? e.platforms : [],
						timeZoneId: typeof e?.timeZoneId == "string" ? e.timeZoneId : ""
					}, c.value = "";
				} catch (t) {
					!h && e && (c.value = S(t, b("error.state_failed", {}, "签到任务读取失败，请稍后重试。")));
				} finally {
					g = !1, e && !h && (i.value = !1);
				}
			}
		}
		function w(e = null) {
			u.value = "", s.value = e, l.value = "", o.value = !0;
		}
		function T() {
			a.value || (o.value = !1, s.value = null, l.value = "");
		}
		async function E(e) {
			if (!a.value) {
				a.value = !0, l.value = "";
				try {
					e.id ? await n.host.api.put("tasks", e, p.signal) : await n.host.api.post("tasks", e, p.signal), o.value = !1, s.value = null, await C(), n.host.ui?.toast(b("toast.saved", {}, "签到任务已保存。"), "success");
				} catch (e) {
					let t = x(e), r = S(e, b("error.save_failed", {}, "任务保存失败，请检查填写内容后重试。"));
					["task_name_invalid", "task_name_duplicate"].includes(t) ? (u.value = r, l.value = "") : l.value = r, t === "task_save_unconfirmed" && await C(), n.host.ui?.toast(r, "error");
				} finally {
					a.value = !1;
				}
			}
		}
		async function ee(e) {
			if (!r.value || e.length !== r.value.tasks.length) return;
			let t = new Map(r.value.tasks.map((e) => [e.id, e]));
			if (new Set(e).size !== e.length || e.some((e) => !t.has(e))) return;
			let i = r.value.tasks;
			r.value = {
				...r.value,
				tasks: e.map((e) => t.get(e))
			};
			try {
				await n.host.api.put("tasks/order", { taskIds: e }, p.signal), await C();
			} catch (e) {
				r.value = {
					...r.value,
					tasks: i
				}, c.value = S(e, b("error.task_order_save_failed", {}, "任务顺序保存失败。"));
			}
		}
		async function D(e) {
			try {
				await n.host.api.post("tasks/run", { taskId: e.id }, p.signal), await C(), n.host.ui?.toast(b("toast.run_started", {}, "签到已开始。"), "info");
			} catch (e) {
				c.value = S(e, b("error.run_failed", {}, "签到启动失败，请稍后重试。"));
			}
		}
		async function te() {
			let e = d.value;
			if (e && !f.value) {
				f.value = !0;
				try {
					await n.host.api.delete("tasks", { taskId: e.id }, p.signal), d.value = null, s.value?.id === e.id && T(), await C(), n.host.ui?.toast(b("toast.deleted", {}, "签到任务已删除。"), "success");
				} catch (e) {
					c.value = S(e, b("error.delete_failed", {}, "任务删除失败。")), n.host.ui?.toast(c.value, "error");
				} finally {
					f.value = !1;
				}
			}
		}
		function O() {
			!h && !m && (m = setInterval(() => void C(), 5e3));
		}
		let ne = () => p.abort();
		return n.signal?.addEventListener("abort", ne, { once: !0 }), n.signal?.aborted && ne(), t({ startPolling: O }), Zn(() => {
			n.initialState || C(!0), n.deferPolling || O();
		}), er(() => {
			h = !0, n.signal?.removeEventListener("abort", ne), p.abort(), m && clearInterval(m);
		}), (t, p) => (Y(), X("section", Ls, [
			Z("header", Rs, [Z("div", zs, [
				Z("div", Bs, M(b("page.title", {}, "签到")), 1),
				Z("h2", null, M(b("page.title", {}, "签到")), 1),
				Z("p", Vs, M(b("page.description", {}, "管理多平台签到任务和运行计划。")), 1)
			]), Z("div", Hs, [Z("nxp-button", {
				label: b("action.add_task", {}, "添加签到任务"),
				tone: "primary",
				type: "button",
				onClick: p[0] ||= (e) => w()
			}, null, 8, Us)])]),
			c.value ? (Y(), X("p", Ws, M(c.value), 1)) : i.value ? (Y(), X("p", Gs, M(b("status.loading", {}, "正在读取…")), 1)) : Q("", !0),
			_.value.length ? (Y(), Di(Is, {
				key: 2,
				tasks: _.value,
				platforms: v.value,
				"notification-tasks": r.value?.notificationTasks || [],
				translate: y,
				onRun: D,
				onEdit: w,
				onRemove: p[1] ||= (e) => d.value = e,
				onReorder: ee
			}, null, 8, [
				"tasks",
				"platforms",
				"notification-tasks"
			])) : !i.value && !c.value ? (Y(), X("nxp-empty-state", {
				key: 3,
				title: b("empty.title", {}, "还没有签到任务"),
				description: b("empty.description", {}, "创建任务后设置游戏、凭据和定时计划。")
			}, [Z("nxp-button", {
				label: b("action.add_task", {}, "添加签到任务"),
				tone: "primary",
				type: "button",
				onClick: p[2] ||= (e) => w()
			}, null, 8, qs)], 8, Ks)) : Q("", !0),
			Mi(cs, {
				open: o.value,
				task: s.value,
				tasks: r.value?.tasks || [],
				platforms: v.value,
				"notification-tasks": r.value?.notificationTasks || [],
				"time-zone-id": r.value?.timeZoneId || "",
				submitting: a.value,
				error: l.value,
				"name-error": u.value,
				translate: y,
				host: e.host,
				onClose: T,
				onSave: E,
				onInvalid: p[3] ||= (e) => n.host.ui?.toast(e, "error"),
				onNameChange: p[4] ||= (e) => {
					u.value = "", l.value = "";
				}
			}, null, 8, [
				"open",
				"task",
				"tasks",
				"platforms",
				"notification-tasks",
				"time-zone-id",
				"submitting",
				"error",
				"name-error",
				"host"
			]),
			d.value ? (Y(), X("nxp-modal", {
				key: 4,
				open: "",
				footer: "",
				title: b("action.delete", {}, "删除签到"),
				locked: f.value,
				closeable: !f.value,
				"close-label": b("action.close", {}, "关闭"),
				onClose: p[6] ||= (e) => !f.value && (d.value = null)
			}, [Z("p", Ys, M(b("task.delete_confirm", {}, "删除此任务、计划和凭据？")) + " — " + M(d.value.name), 1), Z("div", Xs, [Z("nxp-button", {
				label: b("action.cancel", {}, "取消"),
				variant: "ghost",
				disabled: f.value,
				onClick: p[5] ||= (e) => d.value = null
			}, null, 8, Zs), Z("nxp-button", {
				class: "solid",
				label: b("action.confirm", {}, "确定"),
				tone: "danger",
				busy: f.value,
				onClick: te
			}, null, 8, Qs)])], 40, Js)) : Q("", !0)
		]));
	}
});
//#endregion
//#region src/main.ts
function ec(e) {
	let t = /* @__PURE__ */ new Set(), n = () => {
		for (let e of [...t]) e();
	}, r = e.routes.register("tasks", async (n, r) => {
		let i = r || e, a = await i.api.get("state", n.signal);
		if (n.signal.aborted) throw new DOMException("", "AbortError");
		let o = n.element, s = Xa($s, {
			host: i,
			initialState: a || {},
			deferPolling: !0,
			signal: n.signal
		}), c = s.mount(o), l = !1, u, d = () => {
			o.isConnected && !l && (u?.disconnect(), c.startPolling());
		};
		o.isConnected ? d() : (u = new MutationObserver(d), u.observe(document.documentElement, {
			childList: !0,
			subtree: !0
		}));
		let f = () => {
			l || (l = !0, u?.disconnect(), n.signal.removeEventListener("abort", f), s.unmount(), t.delete(f));
		};
		return t.add(f), n.signal.addEventListener("abort", f, { once: !0 }), n.signal.aborted && f(), f;
	}), i = e.nav.register({
		id: "check-in-tasks",
		title: e.i18n.t("nav.title", {}, "签到"),
		titleKey: "nav.title",
		route: "tasks",
		icon: "check",
		order: -100
	});
	return { dispose() {
		n(), r?.dispose?.(), i?.dispose?.();
	} };
}
//#endregion
export { ec as activate };
