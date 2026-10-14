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
		this.flags |= 2, He(this), Me(this);
		let e = P, t = Re;
		P = this, Re = !0;
		try {
			return this.fn();
		} finally {
			Ne(this), P = e, Re = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Ie(e);
			this.deps = this.depsTail = void 0, He(this), this.onStop && this.onStop(), this.flags &= -2;
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
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ue) || (e.globalVersion = Ue, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Pe(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = P, r = Re;
	P = e, Re = !0;
	try {
		Me(e);
		let n = e.fn(e._value);
		(t.version === 0 || k(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		P = n, Re = r, Ne(e), e.flags &= -3;
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
var Re = !0, ze = [];
function Be() {
	ze.push(Re), Re = !1;
}
function Ve() {
	let e = ze.pop();
	Re = e === void 0 || e;
}
function He(e) {
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
var Ue = 0, We = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, Ge = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!P || !Re || P === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== P) t = this.activeLink = new We(P, this), P.deps ? (t.prevDep = P.depsTail, P.depsTail.nextDep = t, P.depsTail = t) : P.deps = P.depsTail = t, Ke(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = P.depsTail, t.nextDep = void 0, P.depsTail.nextDep = t, P.depsTail = t, P.deps === t && (P.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, Ue++, this.notify(e);
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
function Ke(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) Ke(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var qe = /* @__PURE__ */ new WeakMap(), Je = /* @__PURE__ */ Symbol(""), Ye = /* @__PURE__ */ Symbol(""), Xe = /* @__PURE__ */ Symbol("");
function F(e, t, n) {
	if (Re && P) {
		let t = qe.get(e);
		t || qe.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new Ge()), r.map = t, r.key = n), r.track();
	}
}
function Ze(e, t, n, r, i, a) {
	let o = qe.get(e);
	if (!o) {
		Ue++;
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
				(n === "length" || n === Xe || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(Xe)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(Je)), f(e) && s(o.get(Ye)));
				break;
			case "delete":
				i || (s(o.get(Je)), f(e) && s(o.get(Ye)));
				break;
			case "set": f(e) && s(o.get(Je));
		}
	}
	je();
}
function Qe(e) {
	let t = /* @__PURE__ */ L(e);
	return t === e ? t : (F(t, "iterate", Xe), /* @__PURE__ */ I(e) ? t : t.map(zt));
}
function $e(e) {
	return F(e = /* @__PURE__ */ L(e), "iterate", Xe), e;
}
function et(e, t) {
	return /* @__PURE__ */ It(e) ? Bt(/* @__PURE__ */ Ft(e) ? zt(t) : t) : zt(t);
}
var tt = {
	__proto__: null,
	[Symbol.iterator]() {
		return nt(this, Symbol.iterator, (e) => et(this, e));
	},
	concat(...e) {
		return Qe(this).concat(...e.map((e) => d(e) ? Qe(e) : e));
	},
	entries() {
		return nt(this, "entries", (e) => (e[1] = et(this, e[1]), e));
	},
	every(e, t) {
		return it(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return it(this, "filter", e, t, (e) => e.map((e) => et(this, e)), arguments);
	},
	find(e, t) {
		return it(this, "find", e, t, (e) => et(this, e), arguments);
	},
	findIndex(e, t) {
		return it(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return it(this, "findLast", e, t, (e) => et(this, e), arguments);
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
		return Qe(this).join(e);
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
		return Qe(this).toReversed();
	},
	toSorted(e) {
		return Qe(this).toSorted(e);
	},
	toSpliced(...e) {
		return Qe(this).toSpliced(...e);
	},
	unshift(...e) {
		return st(this, "unshift", e);
	},
	values() {
		return nt(this, "values", (e) => et(this, e));
	}
};
function nt(e, t, n) {
	let r = $e(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ I(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var rt = Array.prototype;
function it(e, t, n, r, i, a) {
	let o = $e(e), s = o !== e && !/* @__PURE__ */ I(e), c = o[t];
	if (c !== rt[t]) {
		let t = c.apply(e, a);
		return s ? zt(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, et(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function at(e, t, n, r) {
	let i = $e(e), a = i !== e && !/* @__PURE__ */ I(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = et(e, t)), n.call(this, t, et(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? et(e, c) : c;
}
function ot(e, t, n) {
	let r = /* @__PURE__ */ L(e);
	F(r, "iterate", Xe);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Lt(n[0]) ? (n[0] = /* @__PURE__ */ L(n[0]), r[t](...n)) : i;
}
function st(e, t, n = []) {
	Be(), Ae();
	let r = (/* @__PURE__ */ L(e))[t].apply(e, n);
	return je(), Ve(), r;
}
var ct = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), lt = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function ut(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ L(this);
	return F(t, "has", e), t.hasOwnProperty(e);
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
		let o = Reflect.get(e, t, /* @__PURE__ */ R(e) ? e : n);
		if ((_(t) ? lt.has(t) : ct(t)) || (r || F(e, "get", t), i)) return o;
		if (/* @__PURE__ */ R(o)) {
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
			if (!/* @__PURE__ */ I(n) && !/* @__PURE__ */ It(n) && (i = /* @__PURE__ */ L(i), n = /* @__PURE__ */ L(n)), !a && /* @__PURE__ */ R(i) && !/* @__PURE__ */ R(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ R(e) ? e : r);
		return e === /* @__PURE__ */ L(r) && s && (o ? k(n, i) && Ze(e, "set", t, n, i) : Ze(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Ze(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !lt.has(t)) && F(e, "has", t), n;
	}
	ownKeys(e) {
		return F(e, "iterate", d(e) ? "length" : Je), Reflect.ownKeys(e);
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
		let i = this.__v_raw, a = /* @__PURE__ */ L(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? _t : t ? Bt : zt;
		return !t && F(a, "iterate", l ? Ye : Je), s(Object.create(u), { next() {
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
			e || (k(n, a) && F(i, "get", n), F(i, "get", a));
			let { has: o } = vt(i), s = t ? _t : e ? Bt : zt;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && F(/* @__PURE__ */ L(t), "iterate", Je), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ L(n), i = /* @__PURE__ */ L(t);
			return e || (k(t, i) && F(r, "has", t), F(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ L(a), s = t ? _t : e ? Bt : zt;
			return !e && F(o, "iterate", Je), a.forEach((e, t) => n.call(r, s(e), s(t), i));
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
			return r.has.call(n, a) || k(e, a) && r.has.call(n, e) || k(i, a) && r.has.call(n, i) || (n.add(a), Ze(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ I(n) && !/* @__PURE__ */ It(n) && (n = /* @__PURE__ */ L(n));
			let r = /* @__PURE__ */ L(this), { has: i, get: a } = vt(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ L(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? k(n, s) && Ze(r, "set", e, n, s) : Ze(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ L(this), { has: n, get: r } = vt(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ L(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Ze(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ L(this), t = e.size !== 0, n = e.clear();
			return t && Ze(e, "clear", void 0, void 0, void 0), n;
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
	return !u(e, "__v_skip") && Object.isExtensible(e) && A(e, "__v_skip", !0), e;
}
var zt = (e) => v(e) ? /* @__PURE__ */ jt(e) : e, Bt = (e) => v(e) ? /* @__PURE__ */ Nt(e) : e;
// @__NO_SIDE_EFFECTS__
function R(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function z(e) {
	return Ht(e, !1);
}
// @__NO_SIDE_EFFECTS__
function Vt(e) {
	return Ht(e, !0);
}
function Ht(e, t) {
	return /* @__PURE__ */ R(e) ? e : new Ut(e, t);
}
var Ut = class {
	constructor(e, t) {
		this.dep = new Ge(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ L(e), this._value = t ? e : zt(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ I(e) || /* @__PURE__ */ It(e);
		e = n ? e : /* @__PURE__ */ L(e), k(e, t) && (this._rawValue = e, this._value = n ? e : zt(e), this.dep.trigger());
	}
};
function B(e) {
	return /* @__PURE__ */ R(e) ? e.value : e;
}
var Wt = {
	get: (e, t, n) => t === "__v_raw" ? e : B(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ R(i) && !/* @__PURE__ */ R(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Gt(e) {
	return /* @__PURE__ */ Ft(e) ? e : new Proxy(e, Wt);
}
var Kt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new Ge(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ue - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
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
function qt(e, t, n = !1) {
	let r, i;
	return h(e) ? r = e : (r = e.get, i = e.set), new Kt(r, i, n);
}
var Jt = {}, Yt = /* @__PURE__ */ new WeakMap(), Xt = void 0;
function Zt(e, t = !1, n = Xt) {
	if (n) {
		let t = Yt.get(n);
		t || Yt.set(n, t = []), t.push(e);
	}
}
function Qt(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ I(e) || o === !1 || o === 0 ? $t(e, 1) : $t(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ R(e) ? (g = () => e.value, y = /* @__PURE__ */ I(e)) : /* @__PURE__ */ Ft(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Ft(e) || /* @__PURE__ */ I(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ R(e)) return e.value;
		if (/* @__PURE__ */ Ft(e)) return p(e);
		if (h(e)) return f ? f(e, 2) : e();
	})) : g = h(e) ? n ? f ? () => f(e, 2) : e : () => {
		if (_) {
			Be();
			try {
				_();
			} finally {
				Ve();
			}
		}
		let t = Xt;
		Xt = m;
		try {
			return f ? f(e, 3, [v]) : e(v);
		} finally {
			Xt = t;
		}
	} : r, n && o) {
		let e = g, t = o === !0 ? Infinity : o;
		g = () => $t(e(), t);
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
	let C = b ? Array(e.length).fill(Jt) : Jt, w = (e) => {
		if (m.flags & 1 && (m.dirty || e)) {
			if (n) {
				let t = m.run();
				if (e || o || y || (b ? t.some((e, t) => k(e, C[t])) : k(t, C))) {
					_ && _();
					let e = Xt;
					Xt = m;
					try {
						let e = [
							t,
							C === Jt ? void 0 : b && C[0] === Jt ? [] : C,
							v
						];
						C = t, f ? f(n, 3, e) : n(...e);
					} finally {
						Xt = e;
					}
				}
			} else m.run();
		}
	};
	return u && u(w), m = new Te(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => Zt(e, !1, m), _ = m.onStop = () => {
		let e = Yt.get(m);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			Yt.delete(m);
		}
	}, n ? a ? w(!0) : C = m.run() : l ? l(w.bind(null, !0), !0) : m.run(), S.pause = m.pause.bind(m), S.resume = m.resume.bind(m), S.stop = S, S;
}
function $t(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ R(e)) $t(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) $t(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		$t(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) $t(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && $t(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
function en(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		tn(e, t, n);
	}
}
function V(e, t, n, r) {
	if (h(e)) {
		let i = en(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			tn(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(V(e[a], t, n, r));
		return i;
	}
}
function tn(e, n, r, i = !0) {
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
			Be(), en(o, null, 10, [
				e,
				i,
				a
			]), Ve();
			return;
		}
	}
	nn(e, r, a, i, s);
}
function nn(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var H = [], rn = -1, an = [], on = null, sn = 0, cn = /* @__PURE__ */ Promise.resolve(), ln = null;
function un(e) {
	let t = ln || cn;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function dn(e) {
	let t = rn + 1, n = H.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = H[r], a = _n(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function fn(e) {
	if (!(e.flags & 1)) {
		let t = _n(e), n = H[H.length - 1];
		!n || !(e.flags & 2) && t >= _n(n) ? H.push(e) : H.splice(dn(t), 0, e), e.flags |= 1, pn();
	}
}
function pn() {
	ln ||= cn.then(vn);
}
function mn(e) {
	if (!d(e)) on && e.id === -1 ? on.splice(sn + 1, 0, e) : e.flags & 1 || (an.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) an.push(e[t]);
	pn();
}
function hn(e, t, n = rn + 1) {
	for (; n < H.length; n++) {
		let t = H[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			H.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
		}
	}
}
function gn(e) {
	if (an.length) {
		let e = [...new Set(an)].sort((e, t) => _n(e) - _n(t));
		if (an.length = 0, on) {
			for (let t = 0; t < e.length; t++) on.push(e[t]);
			return;
		}
		for (on = e, sn = 0; sn < on.length; sn++) {
			let e = on[sn];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		on = null, sn = 0;
	}
}
var _n = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function vn(e) {
	try {
		for (rn = 0; rn < H.length; rn++) {
			let e = H[rn];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), en(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; rn < H.length; rn++) {
			let e = H[rn];
			e && (e.flags &= -2);
		}
		rn = -1, H.length = 0, gn(e), ln = null, (H.length || an.length) && vn(e);
	}
}
var U = null, yn = null;
function bn(e) {
	let t = U;
	return U = e, yn = e && e.type.__scopeId || null, t;
}
function xn(e, t = U, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && Oi(-1);
		let i = bn(t), a = Ti.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = Ti.length; e > a; e--) Ei();
			bn(i), r._d && Oi(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function Sn(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (Be(), V(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Ve());
	}
}
function Cn(e, t) {
	if (Q) {
		let n = Q.provides, r = Q.parent && Q.parent.provides;
		r === n && (n = Q.provides = Object.create(r)), n[e] = t;
	}
}
function wn(e, t, n = !1) {
	let r = Ji();
	if (r || Nr) {
		let i = Nr ? Nr._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var Tn = /* @__PURE__ */ Symbol.for("v-scx"), En = () => wn(Tn);
function Dn(e, t, n) {
	return On(e, t, n);
}
function On(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (ea) {
		if (c === "sync") {
			let e = En();
			f = e.__watcherHandles ||= [];
		} else if (!d) {
			let e = () => {};
			return e.stop = r, e.resume = r, e.pause = r, e;
		}
	}
	let p = Q;
	u.call = (e, t, n) => V(e, p, t, n);
	let m = !1;
	c === "post" ? u.scheduler = (e) => {
		G(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : fn(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Qt(e, n, u);
	return ea && (f ? f.push(h) : d && h()), h;
}
function kn(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? An(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = Zi(this), s = On(i, a.bind(r), n);
	return o(), s;
}
function An(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var jn = /* @__PURE__ */ Symbol("_vte"), Mn = (e) => e.__isTeleport, Nn = /* @__PURE__ */ Symbol("_leaveCb");
function Pn(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== Ci) {
			t = n;
			break;
		}
	}
	return t;
}
function Fn(e) {
	if (!Wn(e)) return Mn(e.type) && e.children ? Pn(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function In(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		In(Mn(n.type) && Fn(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Ln(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Rn(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function zn(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Bn = /* @__PURE__ */ new WeakMap();
function Vn(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Vn(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (Un(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Vn(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? sa(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ L(v), b = v === t ? i : (e) => !zn(_, e) && u(y, e), x = (e, t) => !(t && zn(_, t));
	if (m != null && m !== p) {
		if (Hn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ R(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) en(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ R(p);
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
					i(), Bn.delete(e);
				};
				t.id = -1, Bn.set(e, t), G(t, r);
			} else Hn(e), i();
		}
	}
}
function Hn(e) {
	let t = Bn.get(e);
	t && (t.flags |= 8, Bn.delete(e));
}
se().requestIdleCallback, se().cancelIdleCallback;
var Un = (e) => !!e.type.__asyncLoader, Wn = (e) => e.type.__isKeepAlive;
function Gn(e, t) {
	qn(e, "a", t);
}
function Kn(e, t) {
	qn(e, "da", t);
}
function qn(e, t, n = Q) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Yn(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Wn(e.parent.vnode) && Jn(r, t, n, e), e = e.parent;
	}
}
function Jn(e, t, n, r) {
	let i = Yn(t, e, r, !0);
	nr(() => {
		c(r[t], i);
	}, n);
}
function Yn(e, t, n = Q, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			Be();
			let i = Zi(n), a = V(t, n, e, r);
			return i(), Ve(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var Xn = (e) => (t, n = Q) => {
	(!ea || e === "sp") && Yn(e, (...e) => t(...e), n);
}, Zn = Xn("bm"), Qn = Xn("m"), $n = Xn("bu"), er = Xn("u"), tr = Xn("bum"), nr = Xn("um"), rr = Xn("sp"), ir = Xn("rtg"), ar = Xn("rtc");
function or(e, t = Q) {
	Yn("ec", e, t);
}
var sr = /* @__PURE__ */ Symbol.for("v-ndc");
function cr(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ Ft(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ I(e), s = /* @__PURE__ */ It(e), e = $e(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Bt(zt(e[n])) : zt(e[n]) : e[n], n, void 0, a && a[n]);
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
function lr(e, t, n, r, i, a) {
	if (n ??= {}, U.ce || U.parent && Un(U.parent) && U.parent.ce) {
		let e = a != null && n.key == null ? s({}, n, { key: a }) : n, i = Object.keys(e).length > 0;
		return t !== "default" && (e.name = t), J(), Ai(K, null, [Fi("slot", e, r && r())], i ? -2 : 64);
	}
	let o = e[t];
	o && o._c && (o._d = !1);
	let c = Ti.length;
	J();
	let l;
	try {
		let i = o && ur(o(n)), s = n.key || a || i && i.key;
		l = Ai(K, { key: (s && !_(s) ? s : `_${t}`) + (!i && r ? "_fb" : "") }, i || (r ? r() : []), i && e._ === 1 ? 64 : -2);
	} catch (e) {
		for (let e = Ti.length; e > c; e--) Ei();
		throw e;
	} finally {
		o && o._c && (o._d = !0);
	}
	return !i && l.scopeId && (l.slotScopeIds = [l.scopeId + "-s"]), l;
}
function ur(e) {
	return e.some((e) => !ji(e) || !(e.type === Ci || e.type === K && !ur(e.children))) ? e : null;
}
var dr = (e) => e ? $i(e) ? sa(e) : dr(e.parent) : null, fr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => dr(e.parent),
	$root: (e) => dr(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => xr(e),
	$forceUpdate: (e) => e.f ||= () => {
		fn(e.update);
	},
	$nextTick: (e) => e.n ||= un.bind(e.proxy),
	$watch: (e) => kn.bind(e)
}), pr = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), mr = {
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
			else if (pr(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else gr && (s[n] = 0);
		}
		let d = fr[n], f, p;
		if (d) return n === "$attrs" && F(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return pr(a, n) ? (a[n] = r, !0) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) || n[0] === "$" && n.slice(1) in e ? !1 : (o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || pr(n, c) || u(o, c) || u(i, c) || u(fr, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function hr(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var gr = !0;
function _r(e) {
	let t = xr(e), n = e.proxy, i = e.ctx;
	gr = !1, t.beforeCreate && yr(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: T, renderTracked: E, renderTriggered: ee, errorCaptured: D, serverPrefetch: te, expose: O, inheritAttrs: ne, components: re, directives: k, filters: ie } = t;
	if (u && vr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ jt(t));
	}
	if (gr = !0, o) for (let e in o) {
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
	if (c) for (let e in c) br(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			Cn(t, e[t]);
		});
	}
	f && yr(f, e, "c");
	function A(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (A(Zn, p), A(Qn, m), A($n, g), A(er, _), A(Gn, y), A(Kn, b), A(or, D), A(ar, E), A(ir, ee), A(tr, S), A(nr, w), A(rr, te), d(O)) {
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
	T && e.render === r && (e.render = T), ne != null && (e.inheritAttrs = ne), re && (e.components = re), k && (e.directives = k), te && Rn(e);
}
function vr(e, t, n = r) {
	d(e) && (e = Er(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? wn(r.from || n, r.default, !0) : wn(r.from || n) : wn(r), /* @__PURE__ */ R(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function yr(e, t, n) {
	V(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function br(e, t, n, r) {
	let i = r.includes(".") ? An(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) && Dn(i, n);
	} else if (h(e)) Dn(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => br(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) && Dn(i, r, e);
		}
	}
}
function xr(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => Sr(c, e, o, !0)), Sr(c, t, o)), v(t) && a.set(t, c), c;
}
function Sr(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && Sr(e, a, n, !0), i && i.forEach((t) => Sr(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = Cr[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var Cr = {
	data: wr,
	props: Or,
	emits: Or,
	methods: Dr,
	computed: Dr,
	beforeCreate: W,
	created: W,
	beforeMount: W,
	mounted: W,
	beforeUpdate: W,
	updated: W,
	beforeDestroy: W,
	beforeUnmount: W,
	destroyed: W,
	unmounted: W,
	activated: W,
	deactivated: W,
	errorCaptured: W,
	serverPrefetch: W,
	components: Dr,
	directives: Dr,
	watch: kr,
	provide: wr,
	inject: Tr
};
function wr(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function Tr(e, t) {
	return Dr(Er(e), Er(t));
}
function Er(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function W(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function Dr(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Or(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), hr(e), hr(t ?? {})) : t;
}
function kr(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = W(e[r], t[r]);
	return n;
}
function Ar() {
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
var jr = 0;
function Mr(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = Ar(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: jr++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: la,
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
					let u = l._ceVNode || Fi(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, sa(u.component);
				}
			},
			onUnmount(e) {
				o.push(e);
			},
			unmount() {
				c && (V(o, l._instance, 16), e(null, l._container), delete l._container.__vue_app__);
			},
			provide(e, t) {
				return i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = Nr;
				Nr = l;
				try {
					return e();
				} finally {
					Nr = t;
				}
			}
		};
		return l;
	};
}
var Nr = null, Pr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${D(t)}Modifiers`] || e[`${O(t)}Modifiers`];
function Fr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && Pr(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(ae)));
	let c, l = i[c = re(n)] || i[c = re(D(n))];
	!l && o && (l = i[c = re(O(n))]), l && V(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, V(u, e, 6, a);
	}
}
var Ir = /* @__PURE__ */ new WeakMap();
function Lr(e, t, n = !1) {
	let r = n ? Ir : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Lr(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Rr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, O(t)) || u(e, t));
}
function zr(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = bn(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = Bi(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = Bi(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Br(c);
		}
	} catch (t) {
		Ti.length = 0, tn(t, e, 1), v = Fi(Ci);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Vr(y, a)), b = Ri(b, y, !1, !0));
	}
	return n.dirs && (b = Ri(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && In(Mn(b.type) && Fn(b) || b, n.transition), v = b, bn(_), v;
}
var Br = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Vr = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function Hr(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Ur(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Wr(o, r, n) && !Rr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Ur(r, o, l) : !!o;
	return !1;
}
function Ur(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (Wr(t, e, a) && !Rr(n, a)) return !0;
	}
	return !1;
}
function Wr(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !ve(r, i) : r !== i;
}
function Gr({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Kr = {}, qr = () => Object.create(Kr), Jr = (e) => Object.getPrototypeOf(e) === Kr;
function Yr(e, t, n, r = !1) {
	let i = {}, a = qr();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), Zr(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ Mt(i) : e.type.props ? i : a, e.attrs = a;
}
function Xr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ L(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Rr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = D(o);
						i[t] = Qr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		Zr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = O(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Qr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Ze(e.attrs, "set", "");
}
function Zr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (T(t)) continue;
		let l = n[t], d;
		a && u(a, d = D(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Rr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ L(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = Qr(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function Qr(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = Zi(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === O(n)) && (r = !0));
	}
	return r;
}
var $r = /* @__PURE__ */ new WeakMap();
function ei(e, r, i = !1) {
	let a = i ? $r : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = ei(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = D(c[e]);
		ti(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = D(e);
		if (ti(t)) {
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
function ti(e) {
	return e[0] !== "$" && !T(e);
}
var ni = (e) => e === "_" || e === "_ctx" || e === "$stable", ri = (e) => d(e) ? e.map(Bi) : [Bi(e)], ii = (e, t, n) => {
	if (t._n) return t;
	let r = xn((...e) => ri(t(...e)), n);
	return r._c = !1, r;
}, ai = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (ni(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = ii(n, i, r);
		else if (i != null) {
			let e = ri(i);
			t[n] = () => e;
		}
	}
}, oi = (e, t) => {
	let n = ri(t);
	e.slots.default = () => n;
}, si = (e, t, n) => {
	for (let r in t) (n || !ni(r)) && (e[r] = t[r]);
}, ci = (e, t, n) => {
	let r = e.slots = qr();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (si(r, t, n), n && A(r, "_", e, !0)) : ai(t, r);
	} else t && oi(e, t);
}, li = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : si(a, n, r) : (o = !n.$stable, ai(n, a)), s = n;
	} else n && (oi(e, n), s = { default: 1 });
	if (o) for (let e in a) !ni(e) && s[e] == null && delete a[e];
}, G = xi;
function ui(e) {
	return di(e);
}
function di(e, i) {
	let a = se();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !Mi(e, t) && (r = _e(e), j(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case Si:
				y(e, t, n, r);
				break;
			case Ci:
				b(e, t, n, r);
				break;
			case wi:
				e ?? x(t, n, r, o);
				break;
			case K:
				re(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? k(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, M);
		}
		u != null && i ? Vn(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Vn(e.ref, null, a, e, !0);
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
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && D(e.children, d, null, r, i, fi(e, a), s, u), _ && Sn(e, null, r, "created"), ee(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !T(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Wi(f, r, e);
		}
		_ && Sn(e, null, r, "beforeMount");
		let v = mi(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && G(() => {
			try {
				f && Wi(f, r, e), v && g.enter(d), _ && Sn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, ee = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || bi(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				ee(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, D = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? Vi(e[l]) : Bi(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, te = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && pi(r, !1), (g = h.onVnodeBeforeUpdate) && Wi(g, r, n, e), f && Sn(n, e, r, "beforeUpdate"), r && pi(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? O(e.dynamicChildren, d, l, r, i, fi(n, a), o) : s || le(e, n, l, null, r, i, fi(n, a), o, !1), u > 0) {
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
		((g = h.onVnodeUpdated) || f) && G(() => {
			g && Wi(g, r, n, e), f && Sn(n, e, r, "updated");
		}, i);
	}, O = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === K || !Mi(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
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
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), D(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (O(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && hi(e, t, !0)) : le(e, t, n, f, i, a, s, c, l);
	}, k = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : A(t, n, r, i, a, o, c) : ae(e, t, c);
	}, A = (e, t, n, r, i, a, o) => {
		let s = e.component = qi(e, r, i);
		if (Wn(e) && (s.ctx.renderer = M), ta(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, oe, o), !e.el) {
				let r = s.subTree = Fi(Ci);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else oe(s, e, t, n, i, a, o);
	}, ae = (e, t, n) => {
		let r = t.component = e.component;
		if (Hr(e, t, n)) {
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
					let n = _i(e);
					if (n) {
						t && (t.el = c.el, ce(e, t, o)), n.asyncDep.then(() => {
							G(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				pi(e, !1), t ? (t.el = c.el, ce(e, t, o)) : t = c, n && ie(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Wi(d, s, t, c), pi(e, !0);
				let f = zr(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), _e(p), e, i, a), t.el = f.el, u === null && Gr(e, f.el), r && G(r, i), (d = t.props && t.props.onVnodeUpdated) && G(() => Wi(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Un(t);
				if (pi(e, !1), l && ie(l), !m && (o = c && c.onVnodeBeforeMount) && Wi(o, d, t), pi(e, !0), s && xe) {
					let t = () => {
						e.subTree = zr(e), xe(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = zr(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && G(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					G(() => Wi(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Un(d.vnode) && d.vnode.shapeFlag & 256) && e.a && G(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Te(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => fn(u), pi(e, !0), l();
	}, ce = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, Xr(e, t.props, r, n), li(e, t.children, n), Be(), hn(e), Ve();
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
			let n = t[p] = l ? Vi(t[p]) : Bi(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? ge(e, a, o, !0, !1, f) : D(t, r, i, a, o, s, c, l, f);
	}, de = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? Vi(t[u]) : Bi(t[u]);
			if (Mi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? Vi(t[p]) : Bi(t[p]);
			if (Mi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? Vi(t[u]) : Bi(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) j(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? Vi(t[u]) : Bi(t[u]);
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
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && Mi(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? j(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? gi(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || yi(f) : i;
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
		if (c === K) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) fe(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === wi) {
			S(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[Nn] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), G(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[Nn];
					a._isLeaving && a[Nn](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, j = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (Be(), Vn(s, null, n, e, !0), Ve()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Un(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Wi(_, t, e), u & 6) he(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && Sn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, M, r) : l && !l.hasOnce && (a !== K || d > 0 && d & 64) ? ge(l, t, n, !1, !0) : (a === K && d & 384 || !i && u & 16) && ge(c, t, n), r && pe(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && G(() => {
			_ && Wi(_, t, e), h && Sn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, pe = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === K) {
			me(n, r);
			return;
		}
		if (t === wi) {
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
		vi(c), vi(l), r && ie(r), i.stop(), a && (a.flags |= 8, j(o, e, t, n)), s && G(s, t), G(() => {
			e.isUnmounted = !0;
		}, t);
	}, ge = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) j(e[o], t, n, r, i);
	}, _e = (e) => {
		if (e.shapeFlag & 6) return _e(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[jn];
		return n ? h(n) : t;
	}, ve = !1, ye = (e, t, n) => {
		let r;
		e == null ? t._vnode && (j(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, ve ||= (ve = !0, hn(r), gn(), !1);
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
		createApp: Mr(ye, be)
	};
}
function fi({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function pi({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function mi(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function hi(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = Vi(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && hi(t, a)), a.type === Si && (a.patchFlag === -1 && (a = i[e] = Vi(a)), a.el = t.el), a.type === Ci && !a.el && (a.el = t.el);
	}
}
function gi(e) {
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
function _i(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : _i(t);
}
function vi(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function yi(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? yi(t.subTree) : null;
}
var bi = (e) => e.__isSuspense;
function xi(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : mn(e);
}
var K = /* @__PURE__ */ Symbol.for("v-fgt"), Si = /* @__PURE__ */ Symbol.for("v-txt"), Ci = /* @__PURE__ */ Symbol.for("v-cmt"), wi = /* @__PURE__ */ Symbol.for("v-stc"), Ti = [], q = null;
function J(e = !1) {
	Ti.push(q = e ? null : []);
}
function Ei() {
	Ti.pop(), q = Ti[Ti.length - 1] || null;
}
var Di = 1;
function Oi(e, t = !1) {
	Di += e, e < 0 && q && t && (q.hasOnce = !0);
}
function ki(e) {
	return e.dynamicChildren = Di > 0 ? q || n : null, Ei(), Di > 0 && q && q.push(e), e;
}
function Y(e, t, n, r, i, a) {
	return ki(X(e, t, n, r, i, a, !0));
}
function Ai(e, t, n, r, i) {
	return ki(Fi(e, t, n, r, i, !0));
}
function ji(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function Mi(e, t) {
	return e.type === t.type && e.key === t.key;
}
var Ni = ({ key: e }) => e ?? null, Pi = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ R(e) || h(e) ? {
	i: U,
	r: e,
	k: t,
	f: !!n
} : e);
function X(e, t = null, n = null, r = 0, i = null, a = e === K ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && Ni(t),
		ref: t && Pi(t),
		scopeId: yn,
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
		ctx: U
	};
	return s ? (Hi(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), Di > 0 && !o && q && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && q.push(c), c;
}
var Fi = Ii;
function Ii(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === sr) && (e = Ci), ji(e)) {
		let r = Ri(e, t, !0);
		return n && Hi(r, n), Di > 0 && !a && q && (r.shapeFlag & 6 ? q[q.indexOf(e)] = r : q.push(r)), r.patchFlag = -2, r;
	}
	if (ca(e) && (e = e.__vccOpts), t) {
		t = Li(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = j(e)), v(n) && (/* @__PURE__ */ Lt(n) && !d(n) && (n = s({}, n)), t.style = ce(n));
	}
	let o = g(e) ? 1 : bi(e) ? 128 : Mn(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return X(e, t, n, r, i, o, a, !0);
}
function Li(e) {
	return e ? /* @__PURE__ */ Lt(e) || Jr(e) ? s({}, e) : e : null;
}
function Ri(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? Ui(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && Ni(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(Pi(t)) : [a, Pi(t)] : Pi(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== K ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && Ri(e.ssContent),
		ssFallback: e.ssFallback && Ri(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && In(u, c.clone(u)), u;
}
function zi(e = " ", t = 0) {
	return Fi(Si, null, e, t);
}
function Z(e = "", t = !1) {
	return t ? (J(), Ai(Ci, null, e)) : Fi(Ci, null, e);
}
function Bi(e) {
	return e == null || typeof e == "boolean" ? Fi(Ci) : d(e) ? Fi(K, null, e.slice()) : ji(e) ? Vi(e) : Fi(Si, null, String(e));
}
function Vi(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : Ri(e);
}
function Hi(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), Hi(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !Jr(t) ? t._ctx = U : r === 3 && U && (U.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			Hi(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: U
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [zi(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function Ui(...e) {
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
function Wi(e, t, n, r = null) {
	V(e, t, 7, [n, r]);
}
var Gi = Ar(), Ki = 0;
function qi(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || Gi, o = {
		uid: Ki++,
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
		propsOptions: ei(i, a),
		emitsOptions: Lr(i, a),
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
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = Fr.bind(null, o), e.ce && e.ce(o), o;
}
var Q = null, Ji = () => Q || U, Yi, Xi;
{
	let e = se(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	Yi = t("__VUE_INSTANCE_SETTERS__", (e) => Q = e), Xi = t("__VUE_SSR_SETTERS__", (e) => ea = e);
}
var Zi = (e) => {
	let t = Q;
	return Yi(e), e.scope.on(), () => {
		e.scope.off(), Yi(t);
	};
}, Qi = () => {
	Q && Q.scope.off(), Yi(null);
};
function $i(e) {
	return e.vnode.shapeFlag & 4;
}
var ea = !1;
function ta(e, t = !1, n = !1) {
	t && Xi(t);
	let { props: r, children: i } = e.vnode, a = $i(e);
	Yr(e, r, a, t), ci(e, i, n || t);
	let o = a ? na(e, t) : void 0;
	return t && Xi(!1), o;
}
function na(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, mr);
	let { setup: r } = n;
	if (r) {
		Be();
		let n = e.setupContext = r.length > 1 ? oa(e) : null, i = Zi(e), a = en(r, e, 0, [e.props, n]), o = y(a);
		if (Ve(), i(), (o || e.sp) && !Un(e) && Rn(e), o) {
			if (a.then(Qi, Qi), t) return a.then((n) => {
				Xi(!0);
				try {
					ra(e, n, t);
				} finally {
					Xi(!1);
				}
			}).catch((t) => {
				tn(t, e, 0);
			});
			e.asyncDep = a;
		} else ra(e, a, t);
	} else ia(e, t);
}
function ra(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Gt(t)), ia(e, n);
}
function ia(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = Zi(e);
		Be();
		try {
			_r(e);
		} finally {
			Ve(), t();
		}
	}
}
var aa = { get(e, t) {
	return F(e, "get", ""), e[t];
} };
function oa(e) {
	return {
		attrs: new Proxy(e.attrs, aa),
		slots: e.slots,
		emit: e.emit,
		expose: (t) => {
			e.exposed = t || {};
		}
	};
}
function sa(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(Gt(Rt(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in fr) return fr[n](e);
		},
		has(e, t) {
			return t in e || t in fr;
		}
	}) : e.proxy;
}
function ca(e) {
	return h(e) && "__vccOpts" in e;
}
var $ = (e, t) => /* @__PURE__ */ qt(e, t, ea), la = "3.5.42", ua = void 0, da = typeof window < "u" && window.trustedTypes;
if (da) try {
	ua = /* @__PURE__ */ da.createPolicy("vue", { createHTML: (e) => e });
} catch {}
var fa = ua ? (e) => ua.createHTML(e) : (e) => e, pa = "http://www.w3.org/2000/svg", ma = "http://www.w3.org/1998/Math/MathML", ha = typeof document < "u" ? document : null, ga = ha && /* @__PURE__ */ ha.createElement("template"), _a = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? ha.createElementNS(pa, e) : t === "mathml" ? ha.createElementNS(ma, e) : n ? ha.createElement(e, { is: n }) : ha.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => ha.createTextNode(e),
	createComment: (e) => ha.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => ha.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			ga.innerHTML = fa(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = ga.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, va = /* @__PURE__ */ Symbol("_vtc");
function ya(e, t, n) {
	let r = e[va];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var ba = /* @__PURE__ */ Symbol("_vod"), xa = /* @__PURE__ */ Symbol("_vsh"), Sa = /* @__PURE__ */ Symbol(""), Ca = /(?:^|;)\s*display\s*:/;
function wa(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? Ea(r, t, "");
			}
			else for (let e in t) n[e] ?? Ea(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? Ea(r, i, "") : Aa(e, i, !g(t) && t ? t[i] : void 0, o) || Ea(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[Sa];
			e && (n += ";" + e), r.cssText = n, a = Ca.test(n);
		}
	} else t && e.removeAttribute("style");
	ba in e && (e[ba] = a ? r.display : "", e[xa] && (r.display = "none"));
}
var Ta = /\s*!important$/;
function Ea(e, t, n) {
	if (d(n)) n.forEach((n) => Ea(e, t, n));
	else if (n ??= "", t.startsWith("--")) Ta.test(n) ? e.setProperty(t, n.replace(Ta, ""), "important") : e.setProperty(t, n);
	else {
		let r = ka(e, t);
		Ta.test(n) ? e.setProperty(O(r), n.replace(Ta, ""), "important") : e[r] = n;
	}
}
var Da = [
	"Webkit",
	"Moz",
	"ms"
], Oa = {};
function ka(e, t) {
	let n = Oa[t];
	if (n) return n;
	let r = D(t);
	if (r !== "filter" && r in e) return Oa[t] = r;
	r = ne(r);
	for (let n = 0; n < Da.length; n++) {
		let i = Da[n] + r;
		if (i in e) return Oa[t] = i;
	}
	return t;
}
function Aa(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var ja = "http://www.w3.org/1999/xlink";
function Ma(e, t, n, r, i, a = me(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(ja, t.slice(6, t.length)) : e.setAttributeNS(ja, t, n) : n == null || a && !he(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function Na(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? fa(n) : n);
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
function Pa(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function Fa(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var Ia = /* @__PURE__ */ Symbol("_vei");
function La(e, t, n, r, i = null) {
	let a = e[Ia] || (e[Ia] = {}), o = a[t];
	if (r && o) o.value = r;
	else {
		let [n, s] = Ba(t);
		r ? Pa(e, n, a[t] = Wa(r, i), s) : o && (Fa(e, n, o, s), a[t] = void 0);
	}
}
var Ra = /(Once|Passive|Capture)$/, za = /^on:?(?:Once|Passive|Capture)$/;
function Ba(e) {
	let t, n;
	for (; (n = e.match(Ra)) && !za.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : O(e.slice(2)), t];
}
var Va = 0, Ha = /* @__PURE__ */ Promise.resolve(), Ua = () => Va ||= (Ha.then(() => Va = 0), Date.now());
function Wa(e, t) {
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
				e && V(e, t, 5, a);
			}
		} else V(r, t, 5, [e]);
	};
	return n.value = e, n.attached = Ua(), n;
}
var Ga = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Ka = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? ya(e, r, c) : t === "style" ? wa(e, n, r) : a(t) ? o(t) || La(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : qa(e, t, r, c)) ? (Na(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Ma(e, t, r, c, s, t !== "value")) : e._isVueCE && (Ja(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? Na(e, D(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), Ma(e, t, r, c));
};
function qa(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && Ga(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return Ga(t) && g(n) ? !1 : t in e;
}
function Ja(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = D(t);
	return Array.isArray(n) ? n.some((e) => D(e) === r) : Object.keys(n).some((e) => D(e) === r);
}
var Ya = /* @__PURE__ */ s({ patchProp: Ka }, _a), Xa;
function Za() {
	return Xa ||= ui(Ya);
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
//#region src/activityPolicy.ts
function to(e) {
	if (!e?.instantUtc) return null;
	let t = Date.parse(e.instantUtc);
	return Number.isFinite(t) ? t : null;
}
var no = to;
function ro(e, t) {
	let n = to(e.times.start), r = to(e.times.playEnd);
	return n !== null && r !== null && n >= r ? "unknown" : r !== null && r <= t ? "ended" : n !== null && n > t ? "upcoming" : n !== null && r !== null ? "ongoing" : "unknown";
}
function io(e) {
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
function ao(e, t) {
	let n = [
		"ongoing",
		"upcoming",
		"unknown",
		"ended"
	];
	return [...e].sort((e, r) => {
		let i = ro(e, t), a = ro(r, t), o = n.indexOf(i) - n.indexOf(a);
		if (o) return o;
		let s = (e) => i === "ongoing" ? to(e.times.playEnd) ?? 2 ** 53 - 1 : i === "upcoming" ? to(e.times.start) ?? 2 ** 53 - 1 : i === "ended" ? -(to(e.times.playEnd) ?? 0) : 0;
		return s(e) - s(r);
	});
}
//#endregion
//#region src/formatting.ts
function oo(e) {
	return (t, n = {}) => e.i18n.t(t, n, t);
}
function so(e, t, n) {
	let r = no(e);
	if (r === null) {
		let n = t.i18n.t("time.unverified");
		return e?.rawValue ? `${n} · ${e.rawValue}` : n;
	}
	let i = new Intl.DateTimeFormat(t.i18n.locale, {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: n
	}).format(r);
	if (e?.timeBasis !== "source-default") return i;
	let a = e.sourceZone === "Asia/Shanghai" ? "UTC+8" : e.sourceZone === "Asia/Tokyo" ? "UTC+9" : e.sourceZone;
	return `${i} · ${t.i18n.t("time.sourceDefault", { zone: a })}`;
}
function co(e, t) {
	let n = oo(t);
	return e?.overview?.number ? `${n("version.label")} ${e.overview.number}` : n("version.unverified");
}
//#endregion
//#region src/ActivityEventCard.vue?vue&type=script&setup=true&lang.ts
var lo = { class: "ga-event-copy" }, uo = {
	key: 0,
	class: "ga-muted"
}, fo = { class: "ga-event-summary" }, po = { class: "ga-event-time" }, mo = {
	key: 0,
	class: "ga-event-media"
}, ho = ["src", "alt"], go = /* @__PURE__ */ Ln({
	__name: "ActivityEventCard",
	props: {
		item: {},
		now: {},
		host: {},
		image: {},
		zone: {}
	},
	setup(e) {
		let t = oo(e.host);
		return (n, r) => (J(), Y("article", { class: j(["ga-event-card", { "ga-event-card--no-image": !e.image }]) }, [X("div", lo, [
			X("h4", null, M(e.item.title), 1),
			e.item.kind ? (J(), Y("p", uo, M(e.item.kind), 1)) : Z("", !0),
			X("p", fo, M(e.item.summary || B(t)("details.summaryMissing")), 1),
			X("div", po, [
				X("span", null, M(B(so)(e.item.times.start, e.host, e.zone)), 1),
				r[0] ||= X("span", null, " — ", -1),
				X("span", null, M(B(so)(e.item.times.playEnd, e.host, e.zone)), 1)
			])
		]), e.image ? (J(), Y("div", mo, [X("img", {
			src: e.image,
			alt: e.item.cover?.alt ?? ""
		}, null, 8, ho)])) : Z("", !0)], 2));
	}
}), _o = { class: "ga-details" }, vo = { class: "ga-detail-intro" }, yo = { class: "ga-eyebrow" }, bo = {
	key: 0,
	class: "ga-detail-badges"
}, xo = { class: "ga-muted" }, So = { class: "ga-muted" }, Co = {
	key: 1,
	class: "ga-notice"
}, wo = ["aria-label"], To = { class: "ga-section-title" }, Eo = {
	key: 0,
	class: "ga-muted ga-section-empty"
}, Do = ["open", "onToggle"], Oo = ["data-state"], ko = { class: "ga-group-count" }, Ao = { class: "ga-event-list" }, jo = /* @__PURE__ */ Ln({
	__name: "ActivityDetails",
	props: {
		feed: {},
		now: {},
		host: {},
		covers: {},
		zone: {}
	},
	setup(e) {
		let t = e, n = oo(t.host), r = `details/${crypto.randomUUID()}/`, i = /* @__PURE__ */ z(/* @__PURE__ */ new Set([
			"ongoing",
			"upcoming",
			"unknown"
		]));
		Dn(() => t.feed.activities.filter((e) => i.value.has(ro(e, t.now))).map((e) => ({
			id: e.eventId,
			entityId: e.eventId,
			cover: e.cover
		})), (e) => t.covers.bindMany(r, e), { immediate: !0 }), tr(() => t.covers.releaseGroup(r));
		function a(e, t) {
			let n = new Set(i.value);
			e.target.open ? n.add(t) : n.delete(t), i.value = n;
		}
		let o = $(() => {
			let e = ao(t.feed.activities, t.now);
			return [
				"ongoing",
				"upcoming",
				"ended",
				"unknown"
			].map((n) => ({
				state: n,
				items: e.filter((e) => ro(e, t.now) === n)
			})).filter((e) => e.items.length);
		});
		return (t, s) => (J(), Y("div", _o, [X("header", vo, [
			X("div", null, [X("span", yo, M(B(n)("details.game")), 1), X("h2", null, M(B(n)(`game.${e.feed.gameId}`)), 1)]),
			e.feed.progressionId === "default" ? Z("", !0) : (J(), Y("div", bo, [X("span", null, M(B(n)(`progression.${e.feed.progressionId}`)), 1)])),
			X("p", xo, M(B(n)("details.timezone", { zone: e.zone })), 1),
			X("p", So, M(B(n)("source.sra")), 1),
			e.feed.health.cacheState === "stale" ? (J(), Y("p", Co, M(B(n)("sra.cached")), 1)) : Z("", !0)
		]), X("section", {
			class: "ga-detail-section",
			"aria-label": B(n)("section.activities")
		}, [
			X("div", To, [X("h3", null, M(B(n)("section.activities")), 1), X("span", null, M(e.feed.activities.length), 1)]),
			o.value.length ? Z("", !0) : (J(), Y("p", Eo, M(B(n)("details.empty")), 1)),
			(J(!0), Y(K, null, cr(o.value, (t) => (J(), Y("details", {
				key: t.state,
				class: "ga-state-group",
				open: i.value.has(t.state),
				onToggle: (e) => a(e, t.state)
			}, [X("summary", null, [
				X("span", {
					class: "ga-state-dot",
					"data-state": t.state
				}, null, 8, Oo),
				X("span", null, M(B(n)(`state.${t.state}`)), 1),
				X("span", ko, M(t.items.length), 1)
			]), X("div", Ao, [(J(!0), Y(K, null, cr(t.items, (t) => (J(), Ai(go, {
				key: t.eventId,
				item: t,
				image: e.covers.images.value[r + t.eventId],
				host: e.host,
				now: e.now,
				zone: e.zone
			}, null, 8, [
				"item",
				"image",
				"host",
				"now",
				"zone"
			]))), 128))])], 40, Do))), 128))
		], 8, wo)]));
	}
}), Mo = { class: "ga-game-setting" }, No = { class: "ga-game-handle" }, Po = [
	"disabled",
	"label",
	"title"
], Fo = { class: "ga-game-copy" }, Io = ["data-help"], Lo = [
	"id",
	"model-value",
	"options",
	"disabled",
	"aria-label"
], Ro = [
	"model-value",
	"disabled",
	"aria-label"
], zo = /* @__PURE__ */ Ln({
	__name: "ActivityGameSetting",
	props: {
		game: {},
		host: {},
		enabled: { type: Boolean },
		busy: { type: Boolean },
		progression: {}
	},
	emits: ["toggle", "progression"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = oo(n.host), a = $(() => n.game === "blue-archive" ? [
			"cn",
			"jp",
			"global"
		] : n.game === "neverness-to-everness" ? ["cn", "global"] : []), o = $(() => a.value.map((e) => ({
			value: e,
			label: i(`progression.${e}`)
		})));
		return (t, n) => (J(), Y("article", Mo, [
			X("div", No, [e.enabled ? (J(), Y("nxp-drag-handle", {
				key: 0,
				disabled: e.busy,
				label: B(i)("settings.drag", { game: B(i)(`game.${e.game}`) }),
				title: B(i)("settings.dragHelp")
			}, null, 8, Po)) : Z("", !0)]),
			X("div", Fo, [X("strong", null, M(B(i)(`game.${e.game}`)), 1)]),
			o.value.length ? (J(), Y("div", {
				key: 0,
				class: "ga-game-progression",
				"data-help": B(i)("settings.progressionHelp")
			}, [X("nxp-select", {
				id: `ga-progression-${e.game}`,
				"model-value": e.progression,
				options: o.value,
				disabled: e.busy,
				"aria-label": `${B(i)(`game.${e.game}`)} · ${B(i)("settings.progression")}`,
				onChange: n[0] ||= (e) => r("progression", e.detail[0])
			}, null, 40, Lo)], 8, Io)) : Z("", !0),
			X("nxp-switch", {
				"model-value": e.enabled,
				"semantic-role": "switch",
				disabled: e.busy,
				"aria-label": B(i)(`game.${e.game}`),
				onChange: n[1] ||= (e) => r("toggle", e.detail[0])
			}, null, 40, Ro)
		]));
	}
}), Bo = [
	"blue-archive",
	"genshin-impact",
	"arknights-endfield",
	"stella-sora",
	"honkai-star-rail",
	"neverness-to-everness",
	"wuthering-waves",
	"zenless-zone-zero"
];
function Vo(e, t) {
	return `${e}/${t}`;
}
//#endregion
//#region src/ActivitySettings.vue?vue&type=script&setup=true&lang.ts
var Ho = { class: "ga-settings" }, Uo = ["aria-label", "data-help"], Wo = { class: "ga-settings-heading" }, Go = { class: "ga-settings-card" }, Ko = ["disabled"], qo = ["data-help"], Jo = { for: "ga-carousel-interval" }, Yo = { class: "ga-muted" }, Xo = [
	"model-value",
	"aria-label",
	"disabled"
], Zo = {
	key: 0,
	class: "ga-error",
	role: "alert"
}, Qo = {
	key: 0,
	role: "alert",
	class: "ga-error"
}, $o = { class: "ga-muted" }, es = { class: "ga-actions" }, ts = ["disabled"], ns = ["disabled"], rs = /* @__PURE__ */ Ln({
	__name: "ActivitySettings",
	props: {
		settings: {},
		host: {},
		busy: { type: Boolean },
		error: {}
	},
	emits: [
		"save",
		"cancel",
		"refresh"
	],
	setup(e, { emit: t }) {
		let n = e, r = t, i = oo(n.host), a = /* @__PURE__ */ z(structuredClone(n.settings)), o = /* @__PURE__ */ z(a.value.carouselIntervalSeconds), s = $(() => typeof o.value == "number" && Number.isInteger(o.value) && (o.value === -1 || o.value >= 10 && o.value <= 120)), c = $(() => Bo.filter((e) => !a.value.selectedGames.includes(e)));
		function l(e, t) {
			t && !a.value.selectedGames.includes(e) ? a.value.selectedGames.push(e) : t || (a.value.selectedGames = a.value.selectedGames.filter((t) => t !== e));
		}
		function u(e) {
			n.busy || (a.value.selectedGames = e.detail[0]);
		}
		function d() {
			!n.busy && s.value && r("save", {
				...a.value,
				carouselIntervalSeconds: Number(o.value)
			});
		}
		return (t, n) => (J(), Y("div", Ho, [
			X("section", {
				"aria-label": B(i)("settings.games"),
				"data-help": B(i)("settings.help")
			}, [X("h3", Wo, M(B(i)("settings.games")), 1), X("div", Go, [a.value.selectedGames.length ? (J(), Y("nxp-sortable-list", {
				key: 0,
				disabled: e.busy,
				onReorder: u
			}, [(J(!0), Y(K, null, cr(a.value.selectedGames, (t) => (J(), Ai(zo, {
				key: t,
				"data-dnd-id": t,
				game: t,
				host: e.host,
				enabled: !0,
				busy: e.busy,
				progression: a.value.progressions[t],
				onToggle: (e) => l(t, e),
				onProgression: (e) => a.value.progressions[t] = e
			}, null, 8, [
				"data-dnd-id",
				"game",
				"host",
				"busy",
				"progression",
				"onToggle",
				"onProgression"
			]))), 128))], 40, Ko)) : Z("", !0), (J(!0), Y(K, null, cr(c.value, (t) => (J(), Ai(zo, {
				key: t,
				game: t,
				host: e.host,
				enabled: !1,
				busy: e.busy,
				progression: a.value.progressions[t],
				onToggle: (e) => l(t, e),
				onProgression: (e) => a.value.progressions[t] = e
			}, null, 8, [
				"game",
				"host",
				"busy",
				"progression",
				"onToggle",
				"onProgression"
			]))), 128))])], 8, Uo),
			X("div", {
				class: "ga-interval-setting",
				"data-help": B(i)("settings.intervalHelp")
			}, [
				X("label", Jo, [zi(M(B(i)("settings.interval")) + " ", 1), X("span", Yo, "(" + M(B(i)("settings.seconds")) + ")", 1)]),
				X("nxp-number-input", {
					id: "ga-carousel-interval",
					"model-value": o.value,
					min: -1,
					max: 120,
					step: 1,
					"aria-label": B(i)("settings.interval"),
					disabled: e.busy,
					onChange: n[0] ||= (e) => o.value = e.detail[0]
				}, null, 40, Xo),
				s.value ? Z("", !0) : (J(), Y("p", Zo, M(B(i)("settings.intervalInvalid")), 1))
			], 8, qo),
			e.error ? (J(), Y("p", Qo, M(e.error), 1)) : Z("", !0),
			X("div", $o, [lr(t.$slots, "default")]),
			X("div", es, [X("nxp-button", {
				disabled: e.busy,
				onClick: n[1] ||= (e) => r("cancel")
			}, M(B(i)("cancel")), 9, ts), X("nxp-button", {
				tone: "primary",
				disabled: e.busy || !s.value,
				onClick: d
			}, M(B(i)("save")), 9, ns)])
		]));
	}
}), is = { class: "ga-sr-only" }, as = {
	key: 0,
	role: "alert",
	class: "ga-error"
}, os = {
	key: 1,
	class: "ga-empty-carousel"
}, ss = [
	"disabled",
	"aria-label",
	"title"
], cs = ["aria-label"], ls = { class: "ga-viewport" }, us = [
	"aria-label",
	"aria-hidden",
	"inert"
], ds = ["src", "alt"], fs = {
	key: 1,
	class: "ga-cover-fallback",
	"aria-hidden": "true"
}, ps = { class: "ga-slide-copy" }, ms = { class: "ga-slide-meta" }, hs = { class: "ga-game-name" }, gs = {
	key: 0,
	class: "ga-version"
}, _s = {
	key: 1,
	class: "ga-progression"
}, vs = {
	key: 0,
	class: "ga-deadline"
}, ys = ["datetime"], bs = {
	key: 1,
	class: "ga-description"
}, xs = ["disabled", "aria-label"], Ss = { class: "ga-tools" }, Cs = [
	"aria-label",
	"title",
	"aria-pressed"
], ws = {
	class: "ga-button-glyph",
	"aria-hidden": "true"
}, Ts = [
	"aria-label",
	"title",
	"disabled"
], Es = ["aria-label", "title"], Ds = ["disabled", "aria-label"], Os = ["disabled", "aria-label"], ks = { class: "ga-carousel-controls" }, As = {
	class: "ga-refresh-status",
	role: "status",
	"aria-live": "polite"
}, js = { class: "ga-indicators" }, Ms = [
	"aria-label",
	"aria-current",
	"onClick"
], Ns = [
	"open",
	"title",
	"locked"
], Ps = { key: 0 }, Fs = ["open", "title"], Is = /* @__PURE__ */ Ln({
	__name: "ActivityCarousel",
	props: {
		host: {},
		state: {},
		covers: {}
	},
	setup(e) {
		let t = e, n = oo(t.host), { current: r, feeds: i, index: a, error: o, busy: s, refreshing: c, manualRefreshing: l, now: u, result: d, zone: f, saveSettings: p, refresh: m } = t.state, h = /* @__PURE__ */ z(!1), g = /* @__PURE__ */ z(!1), _ = /* @__PURE__ */ z(!1), v = /* @__PURE__ */ z(!1), y = /* @__PURE__ */ z(!1), b = /* @__PURE__ */ z(!1), x = $(() => r.value?.selectedFeeds[a.value]), S = $(() => x.value ? i.value[Vo(x.value.gameId, x.value.progressionId)] : null), C = $(() => (r.value?.selectedFeeds ?? []).map((e) => {
			let t = Vo(e.gameId, e.progressionId), n = i.value[t];
			return {
				id: t,
				summary: e,
				feed: n,
				overview: n?.overview
			};
		})), { images: w } = t.covers, T = window.matchMedia?.("(prefers-reduced-motion: reduce)"), E = $(() => (r.value?.settings.carouselIntervalSeconds ?? 30) * 1e3), ee = performance.now() + E.value, D;
		function te(e) {
			a.value = e, ee = performance.now() + E.value;
		}
		Dn(E, () => {
			ee = performance.now() + E.value;
		});
		function O(e) {
			let t = C.value.length;
			t > 1 && te((a.value + e + t) % t);
		}
		function ne(e) {
			e.target === e.currentTarget && ["ArrowLeft", "ArrowRight"].includes(e.key) && (e.preventDefault(), O(e.key === "ArrowLeft" ? -1 : 1));
		}
		function re(e) {
			let t = no(e);
			if (t === null) return n("time.unverified");
			let r = io(t - u.value);
			return r.unit === "ended" ? n("state.ended") : n(`countdown.${r.unit}`, r);
		}
		function k(e) {
			return new Intl.DateTimeFormat(t.host.i18n.locale, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(new Date(e));
		}
		function ie() {
			r.value && (h.value = !0, o.value = "");
		}
		async function A(e) {
			await p(e) && (h.value = !1);
		}
		function ae() {
			y.value = T?.matches ?? !1;
		}
		function oe(e) {
			v.value = !!e.currentTarget.contains(e.relatedTarget);
		}
		return Qn(() => {
			ae(), T?.addEventListener("change", ae), D = setInterval(() => {
				if (E.value < 0 || document.hidden || y.value || b.value || _.value || v.value || h.value || g.value) {
					ee = performance.now() + E.value;
					return;
				}
				performance.now() >= ee && O(1);
			}, 250);
		}), tr(() => {
			clearInterval(D), T?.removeEventListener("change", ae);
		}), (t, i) => (J(), Y("nxp-card", {
			class: "game-activities",
			unstyled: !0,
			onMouseenter: i[8] ||= (e) => _.value = !0,
			onMouseleave: i[9] ||= (e) => _.value = !1,
			onFocusin: i[10] ||= (e) => v.value = !0,
			onFocusout: oe
		}, [
			X("h2", is, M(B(n)("card.title")), 1),
			B(o) && !h.value ? (J(), Y("p", as, M(B(o)), 1)) : Z("", !0),
			!B(r) || !B(r).selectedFeeds.length ? (J(), Y("div", os, [X("p", null, M(B(n)(B(r) ? "state.select" : "state.loading")), 1), X("nxp-button", {
				type: "button",
				class: "ga-icon-button ga-empty-settings",
				disabled: !B(r),
				"aria-label": B(n)("settings.title"),
				title: B(n)("settings.title"),
				onClick: ie
			}, [...i[11] ||= [X("span", {
				class: "ga-button-glyph",
				"aria-hidden": "true"
			}, "⚙️", -1)]], 8, ss)])) : x.value ? (J(), Y("div", {
				key: 2,
				class: "ga-carousel",
				role: "region",
				"aria-roledescription": "carousel",
				"aria-label": B(n)("carousel.label"),
				tabindex: "0",
				onKeydown: ne
			}, [
				X("div", ls, [X("div", {
					class: "ga-track",
					style: ce({ transform: `translateX(-${B(a) * 100}%)` })
				}, [(J(!0), Y(K, null, cr(C.value, (t, r) => (J(), Y("article", {
					key: t.id,
					class: "ga-slide",
					role: "group",
					"aria-roledescription": "slide",
					"aria-label": `${r + 1}/${C.value.length} · ${B(n)(`game.${t.summary.gameId}`)}`,
					"aria-hidden": r !== B(a),
					inert: r !== B(a) || void 0
				}, [
					B(w)["overview/" + t.id] ? (J(), Y("img", {
						key: 0,
						class: "ga-cover",
						src: B(w)["overview/" + t.id],
						alt: t.overview?.cover?.alt ?? ""
					}, null, 8, ds)) : (J(), Y("div", fs, [X("span", null, M(B(n)(`game.${t.summary.gameId}`)), 1)])),
					i[12] ||= X("div", { class: "ga-shade" }, null, -1),
					X("div", ps, [
						X("div", ms, [
							X("span", hs, M(B(n)(`game.${t.summary.gameId}`)), 1),
							t.overview?.number ? (J(), Y("span", gs, M(B(co)(t.feed, e.host)), 1)) : Z("", !0),
							t.summary.progressionId === "default" ? Z("", !0) : (J(), Y("span", _s, M(B(n)(`progression.${t.summary.progressionId}`)), 1))
						]),
						X("h3", null, M(t.overview?.title || B(n)("state.overview")), 1),
						t.overview?.end ? (J(), Y("div", vs, [
							X("span", null, M(B(n)("time.overviewEnd")), 1),
							X("time", { datetime: t.overview.end.instantUtc || void 0 }, M(B(so)(t.overview.end, e.host, B(f))), 9, ys),
							X("strong", null, M(re(t.overview.end)), 1)
						])) : t.feed ? Z("", !0) : (J(), Y("p", bs, M(B(n)(t.summary.health.diagnostics.length ? "state.unavailable" : "state.loading")), 1))
					]),
					X("nxp-button", {
						class: "ga-open-details",
						type: "button",
						disabled: !t.feed,
						"aria-label": B(n)("details.open", { game: B(n)(`game.${t.summary.gameId}`) }),
						"aria-haspopup": "dialog",
						onClick: i[0] ||= (e) => g.value = !0
					}, null, 8, xs)
				], 8, us))), 128))], 4)]),
				X("div", Ss, [
					E.value > 0 && C.value.length > 1 ? (J(), Y("nxp-button", {
						key: 0,
						type: "button",
						class: "ga-icon-button",
						"aria-label": B(n)(b.value ? "carousel.resume" : "carousel.pause"),
						title: B(n)(b.value ? "carousel.resume" : "carousel.pause"),
						"aria-pressed": b.value,
						onClick: i[1] ||= (e) => b.value = !b.value
					}, [X("span", ws, M(b.value ? "▶️" : "⏸️"), 1)], 8, Cs)) : Z("", !0),
					X("nxp-button", {
						type: "button",
						class: "ga-icon-button",
						"aria-label": B(n)("refresh"),
						title: B(n)("refresh"),
						disabled: B(l),
						onClick: i[2] ||= (t) => {
							e.covers.retryFailed(), B(m)();
						}
					}, [...i[13] ||= [X("span", {
						class: "ga-button-glyph",
						"aria-hidden": "true"
					}, "🔄", -1)]], 8, Ts),
					X("nxp-button", {
						type: "button",
						class: "ga-icon-button",
						"aria-label": B(n)("settings.title"),
						title: B(n)("settings.title"),
						onClick: ie
					}, [...i[14] ||= [X("span", {
						class: "ga-button-glyph",
						"aria-hidden": "true"
					}, "⚙️", -1)]], 8, Es)
				]),
				X("nxp-button", {
					type: "button",
					class: "ga-page-button ga-previous",
					disabled: C.value.length < 2,
					"aria-label": B(n)("carousel.previous"),
					onClick: i[3] ||= (e) => O(-1)
				}, [...i[15] ||= [X("span", {
					class: "ga-page-glyph",
					"aria-hidden": "true"
				}, "‹", -1)]], 8, Ds),
				X("nxp-button", {
					type: "button",
					class: "ga-page-button ga-next",
					disabled: C.value.length < 2,
					"aria-label": B(n)("carousel.next"),
					onClick: i[4] ||= (e) => O(1)
				}, [...i[16] ||= [X("span", {
					class: "ga-page-glyph",
					"aria-hidden": "true"
				}, "›", -1)]], 8, Os),
				X("div", ks, [X("span", As, M(B(c) ? B(n)("state.loading") : B(d) ? B(n)(`refreshResult.${B(d).status}`, B(d)) : ""), 1), X("div", js, [(J(!0), Y(K, null, cr(C.value, (e, t) => (J(), Y("nxp-button", {
					key: e.id,
					type: "button",
					"aria-label": `${B(n)("carousel.show")} ${B(n)(`game.${e.summary.gameId}`)}`,
					"aria-current": t === B(a) ? "true" : void 0,
					class: j({ "ga-current": t === B(a) }),
					onClick: (e) => te(t)
				}, [...i[17] ||= [X("span", {
					class: "ga-indicator-bar",
					"aria-hidden": "true"
				}, null, -1)]], 10, Ms))), 128))])])
			], 40, cs)) : Z("", !0),
			h.value && B(r) ? (J(), Y("nxp-modal", {
				key: 3,
				open: h.value,
				title: B(n)("settings.title"),
				size: "wide",
				surface: "secondary",
				locked: B(s),
				onClose: i[6] ||= (e) => h.value = !1
			}, [Fi(rs, {
				settings: B(r).settings,
				host: e.host,
				busy: B(s),
				error: B(o),
				onSave: A,
				onCancel: i[5] ||= (e) => h.value = !1
			}, {
				default: xn(() => [x.value ? (J(), Y("span", Ps, [zi(M(B(n)(`cache.${x.value.health.cacheState}`)), 1), S.value?.health.lastGoodAt ? (J(), Y(K, { key: 0 }, [zi(" · " + M(B(n)("state.lastGood")) + " " + M(k(S.value.health.lastGoodAt)) + " (" + M(B(f)) + ")", 1)], 64)) : Z("", !0)])) : Z("", !0)]),
				_: 1
			}, 8, [
				"settings",
				"host",
				"busy",
				"error"
			])], 40, Ns)) : Z("", !0),
			g.value ? (J(), Y("nxp-modal", {
				key: 4,
				open: g.value,
				title: B(n)("details.title"),
				size: "wide",
				onClose: i[7] ||= (e) => g.value = !1
			}, [S.value ? (J(), Ai(jo, {
				key: 0,
				feed: S.value,
				host: e.host,
				now: B(u),
				covers: e.covers,
				zone: B(f)
			}, null, 8, [
				"feed",
				"host",
				"now",
				"covers",
				"zone"
			])) : Z("", !0)], 40, Fs)) : Z("", !0)
		], 32));
	}
});
//#endregion
//#region src/useActivityState.ts
function Ls(e) {
	let t = /* @__PURE__ */ Vt(null), n = /* @__PURE__ */ Vt({}), r = /* @__PURE__ */ z(0), i = /* @__PURE__ */ z(""), a = /* @__PURE__ */ z(!1), o = /* @__PURE__ */ z(!1), s = /* @__PURE__ */ z(Date.now()), c = /* @__PURE__ */ Vt(null), l = $(() => o.value || ["queued", "running"].includes(c.value?.status ?? "")), u = /* @__PURE__ */ z(Intl.DateTimeFormat().resolvedOptions().timeZone), d = $(() => o.value || !!t.value?.refreshing || ["queued", "running"].includes(c.value?.status ?? "")), f = new AbortController(), p = !1, m = 0, h = !1, g = null, _ = null, v, y = Date.now(), b = performance.now(), x = /* @__PURE__ */ new Map();
	function S(e) {
		p || (i.value = e instanceof Error ? e.message : String(e));
	}
	function C() {
		clearTimeout(v), !p && !document.hidden && (v = setTimeout(() => void T(), d.value ? 2e3 : 6e4));
	}
	async function w() {
		let i = m;
		if (_) try {
			let t = await e.api.get("refresh-status", f.signal, { operationId: _ });
			p || (c.value = t, ["queued", "running"].includes(t.status) || (_ = null));
		} catch (e) {
			_ = null, S(e);
		}
		let a = await e.api.get("state", f.signal);
		if (p || i !== m) return;
		if (a.formatVersion !== 3) throw Error("activity_state_version_invalid");
		let o = t.value?.selectedFeeds[r.value];
		y = Date.parse(a.serverNowUtc), b = performance.now(), s.value = y, t.value = a;
		let l = o ? a.selectedFeeds.findIndex((e) => Vo(e.gameId, e.progressionId) === Vo(o.gameId, o.progressionId)) : -1;
		r.value = l >= 0 ? l : Math.min(r.value, Math.max(0, a.selectedFeeds.length - 1));
		let u = new Set(a.selectedFeeds.map((e) => Vo(e.gameId, e.progressionId)));
		for (let [e, t] of x) u.has(e) || (t.abort(), x.delete(e));
		n.value = Object.fromEntries(Object.entries(n.value).filter(([e]) => u.has(e))), await Promise.all(a.selectedFeeds.map(async (t) => {
			let r = Vo(t.gameId, t.progressionId), a = n.value[r];
			if (!t.snapshotId) return;
			if (a?.snapshotId === t.snapshotId) {
				n.value = {
					...n.value,
					[r]: {
						...a,
						health: t.health
					}
				};
				return;
			}
			let o = new AbortController();
			x.get(r)?.abort(), x.set(r, o);
			let s = () => o.abort();
			f.signal.addEventListener("abort", s, { once: !0 });
			try {
				let a = await e.api.get("feed", o.signal, {
					gameId: t.gameId,
					progressionId: t.progressionId,
					contentLocale: t.contentLocale
				});
				!p && i === m && !o.signal.aborted && u.has(r) && a?.formatVersion === 3 && a.gameId === t.gameId && a.progressionId === t.progressionId && a.contentLocale === t.contentLocale && (n.value = {
					...n.value,
					[r]: {
						...a,
						health: t.health
					}
				});
			} catch (e) {
				o.signal.aborted || S(e);
			} finally {
				f.signal.removeEventListener("abort", s), x.get(r) === o && x.delete(r);
			}
		}));
	}
	function T() {
		return p || document.hidden ? Promise.resolve() : (h = !0, g || (clearTimeout(v), g = (async () => {
			do {
				h = !1;
				try {
					await w();
				} catch (e) {
					S(e);
				}
			} while (h && !p && !document.hidden);
		})().finally(() => {
			g = null, C();
		}), g));
	}
	async function E(n) {
		if (!t.value || a.value) return !1;
		a.value = !0;
		try {
			await e.api.put("settings", {
				expectedRevision: t.value.settingsRevision,
				settings: {
					...n,
					onboardingCompleted: !0
				}
			}, f.signal), m++;
			for (let e of x.values()) e.abort();
			return await T(), !0;
		} catch (e) {
			return S(e), !1;
		} finally {
			a.value = !1;
		}
	}
	async function ee() {
		if (!(l.value || p)) {
			o.value = !0;
			try {
				let t = await e.api.post("refresh", { selected: !0 }, f.signal);
				_ = t.operationId, c.value = {
					...t,
					status: "queued"
				}, await T();
			} catch (e) {
				S(e);
			} finally {
				o.value = !1, C();
			}
		}
	}
	function D() {
		clearTimeout(v), document.hidden || (u.value = Intl.DateTimeFormat().resolvedOptions().timeZone, T());
	}
	document.addEventListener("visibilitychange", D);
	let te = setInterval(() => {
		document.hidden || (s.value = y + performance.now() - b);
	}, 1e3);
	T();
	function O() {
		if (!p) {
			p = !0, m++, f.abort(), clearTimeout(v), clearInterval(te);
			for (let e of x.values()) e.abort();
			x.clear(), document.removeEventListener("visibilitychange", D);
		}
	}
	return {
		current: t,
		feeds: n,
		index: r,
		error: i,
		busy: a,
		refreshing: d,
		manualRefreshing: l,
		now: s,
		result: c,
		zone: u,
		saveSettings: E,
		refresh: ee,
		load: T,
		dispose: O
	};
}
//#endregion
//#region src/useCoverAssets.ts
function Rs(e, t) {
	let n = /* @__PURE__ */ Vt({}), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = !1, o = 0, s;
	function c() {
		for (let e of r.values()) e.references.clear();
		for (let [e, t] of i) for (let n of [t.desired, t.displayed]) n && r.get(n)?.references.add(e);
		for (let [e, t] of r) t.references.size || (t.request?.abort(), t.url && URL.revokeObjectURL(t.url), r.delete(e));
		n.value = Object.fromEntries([...i].flatMap(([e, t]) => {
			let n = t.displayed ? r.get(t.displayed)?.url : null;
			return n ? [[e, n]] : [];
		}));
	}
	function l(e, t) {
		let n = new Set(t.map((t) => e + t.id));
		for (let t of i.keys()) t.startsWith(e) && !n.has(t) && i.delete(t);
		for (let n of t) {
			let t = e + n.id, a = n.entityId ?? n.id, o = n.cover?.assetId ?? null, s = i.get(t), c = s?.entityId === a ? s : {
				entityId: a,
				desired: null,
				displayed: null,
				generation: 0
			};
			c.desired !== o && c.generation++, c.desired = o, n.cover || (c.displayed = null), i.set(t, c), o && !r.has(o) && r.set(o, {
				assetId: o,
				state: "failed",
				references: /* @__PURE__ */ new Set(),
				attempts: 0,
				retryAt: 0
			}), o && r.get(o)?.state === "ready" && (c.displayed = o);
		}
		c(), p();
	}
	function u(e) {
		i.delete(e), c(), p();
	}
	function d(e) {
		for (let t of i.keys()) t.startsWith(e) && i.delete(t);
		c(), p();
	}
	function f() {
		for (let e of r.values()) e.state === "failed" && (e.retryAt = 0, e.attempts = 0);
		p();
	}
	function p() {
		if (clearTimeout(s), a) return;
		for (let e of r.values()) {
			if (o >= 4) break;
			e.references.size && e.state === "failed" && e.attempts < 4 && e.retryAt <= Date.now() && h(e);
		}
		let e = [...r.values()].filter((e) => e.references.size && e.state === "failed" && e.attempts < 4).map((e) => e.retryAt);
		e.length && o < 4 && (s = setTimeout(p, Math.max(50, Math.min(...e) - Date.now())));
	}
	async function m(e) {
		let t = new Image();
		t.src = e, await t.decode();
	}
	async function h(t) {
		t.state = "loading", t.attempts++, o++;
		let n = new AbortController();
		t.request = n;
		let s;
		try {
			let o = await e.api.blob("assets", {
				query: { assetId: t.assetId },
				signal: n.signal
			});
			if (s = URL.createObjectURL(o), await m(s), a || n.signal.aborted || r.get(t.assetId) !== t) return;
			t.url = s, s = void 0, t.state = "ready";
			for (let e of i.values()) e.desired === t.assetId && (e.displayed = t.assetId);
		} catch (e) {
			n.signal.aborted || (t.state = "failed", t.retryAt = Date.now() + [
				5e3,
				3e4,
				12e4,
				6e5
			][Math.min(t.attempts - 1, 3)], /401|403/.test(String(e)) && (t.attempts = 4));
		} finally {
			s && URL.revokeObjectURL(s), o--, t.request = void 0, c(), p();
		}
	}
	let g = Dn(() => t.value.map((e) => `${e.id}:${e.entityId ?? ""}:${e.cover?.assetId ?? ""}`).join("|"), () => l("overview/", t.value), { immediate: !0 });
	function _() {
		if (!a) {
			a = !0, g(), clearTimeout(s);
			for (let e of r.values()) e.request?.abort(), e.url && URL.revokeObjectURL(e.url);
			r.clear(), i.clear(), n.value = {};
		}
	}
	return {
		images: n,
		bindMany: l,
		releaseImage: u,
		releaseGroup: d,
		retryFailed: f,
		dispose: _
	};
}
//#endregion
//#region src/main.ts
function zs(e) {
	let t = Ls(e), n = Rs(e, $(() => (t.current.value?.selectedFeeds ?? []).map((e) => {
		let n = Vo(e.gameId, e.progressionId);
		return {
			id: n,
			entityId: t.feeds.value[n]?.overview?.overviewId,
			cover: t.feeds.value[n]?.overview?.cover ?? null
		};
	}))), r = e.dashboard.registerCard("carousel", (r) => {
		let i = Qa(Is, {
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
export { zs as activate };
