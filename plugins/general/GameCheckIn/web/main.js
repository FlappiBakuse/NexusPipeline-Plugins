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
}, T = /-\w/g, E = te((e) => e.replace(T, (e) => e.slice(1).toUpperCase())), ne = /\B([A-Z])/g, D = te((e) => e.replace(ne, "-$1").toLowerCase()), re = te((e) => e.charAt(0).toUpperCase() + e.slice(1)), O = te((e) => e ? `on${re(e)}` : ""), k = (e, t) => !Object.is(e, t), ie = (e, ...t) => {
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
	for (let r = 0; n && r < e.length; r++) n = _e(e[r], t[r]);
	return n;
}
function M(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && _e(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function _e(e, t) {
	if (e === t) return !0;
	let n = m(e), r = m(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = _(e), r = _(t), n || r) return e === t;
	if (n = d(e), r = d(t), n || r) return n && r ? ge(e, t) : !1;
	if (n = v(e), r = v(t), n || r) {
		if (!n || !r) return !1;
		if (n = f(e), r = f(t), n || r || (n = p(e), r = p(t), n || r)) return n && r ? M(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !_e(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
var ve = (e) => !!(e && e.__v_isRef === !0), N = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? ve(e) ? N(e.value) : JSON.stringify(e, ye, 2) : String(e), ye = (e, t) => ve(t) ? ye(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[be(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => be(e)) } : _(t) ? be(t) : v(t) && !d(t) && !C(t) ? String(t) : t, be = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e, P, xe = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !e && P && (P.active ? (this.parent = P, this.index = (P.scopes || (P.scopes = [])).push(this) - 1) : (this._active = !1, this._warnOnRun = !1));
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
			let t = P;
			try {
				return P = this, e();
			} finally {
				P = t;
			}
		}
	}
	on() {
		++this._on === 1 && (this.prevScope = P, P = this);
	}
	off() {
		if (this._on > 0 && --this._on === 0) {
			if (P === this) P = this.prevScope;
			else {
				let e = P;
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
function Se() {
	return P;
}
var F, Ce = /* @__PURE__ */ new WeakSet(), we = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, P && (P.active ? P.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, Ce.has(this) && (Ce.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Oe(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, Be(this), je(this);
		let e = F, t = I;
		F = this, I = !0;
		try {
			return this.fn();
		} finally {
			Me(this), F = e, I = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Fe(e);
			this.deps = this.depsTail = void 0, Be(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? Ce.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		Ne(this) && this.run();
	}
	get dirty() {
		return Ne(this);
	}
}, Te = 0, Ee, De;
function Oe(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = De, De = e;
		return;
	}
	e.next = Ee, Ee = e;
}
function ke() {
	Te++;
}
function Ae() {
	if (--Te > 0) return;
	if (De) {
		let e = De;
		for (De = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; Ee;) {
		let t = Ee;
		for (Ee = void 0; t;) {
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
function je(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Me(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), Fe(r), Ie(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function Ne(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (Pe(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function Pe(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ve) || (e.globalVersion = Ve, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Ne(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = F, r = I;
	F = e, I = !0;
	try {
		je(e);
		let n = e.fn(e._value);
		(t.version === 0 || k(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		F = n, I = r, Me(e), e.flags &= -3;
	}
}
function Fe(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) Fe(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function Ie(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var I = !0, Le = [];
function Re() {
	Le.push(I), I = !1;
}
function ze() {
	let e = Le.pop();
	I = e === void 0 || e;
}
function Be(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = F;
		F = void 0;
		try {
			t();
		} finally {
			F = e;
		}
	}
}
var Ve = 0, He = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, Ue = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!F || !I || F === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== F) t = this.activeLink = new He(F, this), F.deps ? (t.prevDep = F.depsTail, F.depsTail.nextDep = t, F.depsTail = t) : F.deps = F.depsTail = t, We(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = F.depsTail, t.nextDep = void 0, F.depsTail.nextDep = t, F.depsTail = t, F.deps === t && (F.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, Ve++, this.notify(e);
	}
	notify(e) {
		ke();
		try {
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			Ae();
		}
	}
};
function We(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) We(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var Ge = /* @__PURE__ */ new WeakMap(), Ke = /* @__PURE__ */ Symbol(""), qe = /* @__PURE__ */ Symbol(""), Je = /* @__PURE__ */ Symbol("");
function L(e, t, n) {
	if (I && F) {
		let t = Ge.get(e);
		t || Ge.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new Ue()), r.map = t, r.key = n), r.track();
	}
}
function Ye(e, t, n, r, i, a) {
	let o = Ge.get(e);
	if (!o) {
		Ve++;
		return;
	}
	let s = (e) => {
		e && e.trigger();
	};
	if (ke(), t === "clear") o.forEach(s);
	else {
		let i = d(e), a = i && w(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === Je || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(Je)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(Ke)), f(e) && s(o.get(qe)));
				break;
			case "delete":
				i || (s(o.get(Ke)), f(e) && s(o.get(qe)));
				break;
			case "set": f(e) && s(o.get(Ke));
		}
	}
	Ae();
}
function Xe(e) {
	let t = /* @__PURE__ */ B(e);
	return t === e ? t : (L(t, "iterate", Je), /* @__PURE__ */ z(e) ? t : t.map(V));
}
function Ze(e) {
	return L(e = /* @__PURE__ */ B(e), "iterate", Je), e;
}
function R(e, t) {
	return /* @__PURE__ */ Nt(e) ? It(/* @__PURE__ */ Mt(e) ? V(t) : t) : V(t);
}
var Qe = {
	__proto__: null,
	[Symbol.iterator]() {
		return $e(this, Symbol.iterator, (e) => R(this, e));
	},
	concat(...e) {
		return Xe(this).concat(...e.map((e) => d(e) ? Xe(e) : e));
	},
	entries() {
		return $e(this, "entries", (e) => (e[1] = R(this, e[1]), e));
	},
	every(e, t) {
		return tt(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return tt(this, "filter", e, t, (e) => e.map((e) => R(this, e)), arguments);
	},
	find(e, t) {
		return tt(this, "find", e, t, (e) => R(this, e), arguments);
	},
	findIndex(e, t) {
		return tt(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return tt(this, "findLast", e, t, (e) => R(this, e), arguments);
	},
	findLastIndex(e, t) {
		return tt(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return tt(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return rt(this, "includes", e);
	},
	indexOf(...e) {
		return rt(this, "indexOf", e);
	},
	join(e) {
		return Xe(this).join(e);
	},
	lastIndexOf(...e) {
		return rt(this, "lastIndexOf", e);
	},
	map(e, t) {
		return tt(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return it(this, "pop");
	},
	push(...e) {
		return it(this, "push", e);
	},
	reduce(e, ...t) {
		return nt(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return nt(this, "reduceRight", e, t);
	},
	shift() {
		return it(this, "shift");
	},
	some(e, t) {
		return tt(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return it(this, "splice", e);
	},
	toReversed() {
		return Xe(this).toReversed();
	},
	toSorted(e) {
		return Xe(this).toSorted(e);
	},
	toSpliced(...e) {
		return Xe(this).toSpliced(...e);
	},
	unshift(...e) {
		return it(this, "unshift", e);
	},
	values() {
		return $e(this, "values", (e) => R(this, e));
	}
};
function $e(e, t, n) {
	let r = Ze(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ z(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var et = Array.prototype;
function tt(e, t, n, r, i, a) {
	let o = Ze(e), s = o !== e && !/* @__PURE__ */ z(e), c = o[t];
	if (c !== et[t]) {
		let t = c.apply(e, a);
		return s ? V(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, R(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function nt(e, t, n, r) {
	let i = Ze(e), a = i !== e && !/* @__PURE__ */ z(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = R(e, t)), n.call(this, t, R(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? R(e, c) : c;
}
function rt(e, t, n) {
	let r = /* @__PURE__ */ B(e);
	L(r, "iterate", Je);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Pt(n[0]) ? (n[0] = /* @__PURE__ */ B(n[0]), r[t](...n)) : i;
}
function it(e, t, n = []) {
	Re(), ke();
	let r = (/* @__PURE__ */ B(e))[t].apply(e, n);
	return Ae(), ze(), r;
}
var at = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), ot = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function st(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ B(this);
	return L(t, "has", e), t.hasOwnProperty(e);
}
var ct = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Et : Tt : i ? wt : Ct).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = Qe[t])) return e;
			if (t === "hasOwnProperty") return st;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ H(e) ? e : n);
		if ((_(t) ? ot.has(t) : at(t)) || (r || L(e, "get", t), i)) return o;
		if (/* @__PURE__ */ H(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ At(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ At(o) : /* @__PURE__ */ Ot(o) : o;
	}
}, lt = class extends ct {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ Nt(i);
			if (!/* @__PURE__ */ z(n) && !/* @__PURE__ */ Nt(n) && (i = /* @__PURE__ */ B(i), n = /* @__PURE__ */ B(n)), !a && /* @__PURE__ */ H(i) && !/* @__PURE__ */ H(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ H(e) ? e : r);
		return e === /* @__PURE__ */ B(r) && s && (o ? k(n, i) && Ye(e, "set", t, n, i) : Ye(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Ye(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !ot.has(t)) && L(e, "has", t), n;
	}
	ownKeys(e) {
		return L(e, "iterate", d(e) ? "length" : Ke), Reflect.ownKeys(e);
	}
}, ut = class extends ct {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, dt = /* @__PURE__ */ new lt(), ft = /* @__PURE__ */ new ut(), pt = /* @__PURE__ */ new lt(!0), mt = (e) => e, ht = (e) => Reflect.getPrototypeOf(e);
function gt(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ B(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? mt : t ? It : V;
		return !t && L(a, "iterate", l ? qe : Ke), s(Object.create(u), { next() {
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
function _t(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function vt(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ B(r), a = /* @__PURE__ */ B(n);
			e || (k(n, a) && L(i, "get", n), L(i, "get", a));
			let { has: o } = ht(i), s = t ? mt : e ? It : V;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && L(/* @__PURE__ */ B(t), "iterate", Ke), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ B(n), i = /* @__PURE__ */ B(t);
			return e || (k(t, i) && L(r, "has", t), L(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ B(a), s = t ? mt : e ? It : V;
			return !e && L(o, "iterate", Ke), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: _t("add"),
		set: _t("set"),
		delete: _t("delete"),
		clear: _t("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ B(this), r = ht(n), i = /* @__PURE__ */ B(e), a = !t && !/* @__PURE__ */ z(e) && !/* @__PURE__ */ Nt(e) ? i : e;
			return r.has.call(n, a) || k(e, a) && r.has.call(n, e) || k(i, a) && r.has.call(n, i) || (n.add(a), Ye(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ z(n) && !/* @__PURE__ */ Nt(n) && (n = /* @__PURE__ */ B(n));
			let r = /* @__PURE__ */ B(this), { has: i, get: a } = ht(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ B(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? k(n, s) && Ye(r, "set", e, n, s) : Ye(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ B(this), { has: n, get: r } = ht(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ B(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Ye(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ B(this), t = e.size !== 0, n = e.clear();
			return t && Ye(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = gt(r, e, t);
	}), n;
}
function yt(e, t) {
	let n = vt(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var bt = { get: /* @__PURE__ */ yt(!1, !1) }, xt = { get: /* @__PURE__ */ yt(!1, !0) }, St = { get: /* @__PURE__ */ yt(!0, !1) }, Ct = /* @__PURE__ */ new WeakMap(), wt = /* @__PURE__ */ new WeakMap(), Tt = /* @__PURE__ */ new WeakMap(), Et = /* @__PURE__ */ new WeakMap();
function Dt(e) {
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
function Ot(e) {
	return /* @__PURE__ */ Nt(e) ? e : jt(e, !1, dt, bt, Ct);
}
// @__NO_SIDE_EFFECTS__
function kt(e) {
	return jt(e, !1, pt, xt, wt);
}
// @__NO_SIDE_EFFECTS__
function At(e) {
	return jt(e, !0, ft, St, Tt);
}
function jt(e, t, n, r, i) {
	if (!v(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = Dt(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function Mt(e) {
	return /* @__PURE__ */ Nt(e) ? /* @__PURE__ */ Mt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Nt(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function z(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Pt(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function B(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ B(t) : e;
}
function Ft(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && A(e, "__v_skip", !0), e;
}
var V = (e) => v(e) ? /* @__PURE__ */ Ot(e) : e, It = (e) => v(e) ? /* @__PURE__ */ At(e) : e;
// @__NO_SIDE_EFFECTS__
function H(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Lt(e) {
	return Rt(e, !1);
}
function Rt(e, t) {
	return /* @__PURE__ */ H(e) ? e : new zt(e, t);
}
var zt = class {
	constructor(e, t) {
		this.dep = new Ue(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ B(e), this._value = t ? e : V(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ z(e) || /* @__PURE__ */ Nt(e);
		e = n ? e : /* @__PURE__ */ B(e), k(e, t) && (this._rawValue = e, this._value = n ? e : V(e), this.dep.trigger());
	}
};
function Bt(e) {
	return /* @__PURE__ */ H(e) ? e.value : e;
}
var Vt = {
	get: (e, t, n) => t === "__v_raw" ? e : Bt(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ H(i) && !/* @__PURE__ */ H(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Ht(e) {
	return /* @__PURE__ */ Mt(e) ? e : new Proxy(e, Vt);
}
var Ut = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new Ue(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ve - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && F !== this) return Oe(this, !0), !0;
	}
	get value() {
		let e = this.dep.track();
		return Pe(this), e && (e.version = this.dep.version), this._value;
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
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ z(e) || o === !1 || o === 0 ? Xt(e, 1) : Xt(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ H(e) ? (g = () => e.value, y = /* @__PURE__ */ z(e)) : /* @__PURE__ */ Mt(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Mt(e) || /* @__PURE__ */ z(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ H(e)) return e.value;
		if (/* @__PURE__ */ Mt(e)) return p(e);
		if (h(e)) return f ? f(e, 2) : e();
	})) : g = h(e) ? n ? f ? () => f(e, 2) : e : () => {
		if (_) {
			Re();
			try {
				_();
			} finally {
				ze();
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
	let x = Se(), S = () => {
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
	return u && u(w), m = new we(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => Jt(e, !1, m), _ = m.onStop = () => {
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
	if (n.set(e, t), t--, /* @__PURE__ */ H(e)) Xt(e.value, t, n);
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
			Re(), Zt(o, null, 10, [
				e,
				i,
				a
			]), ze();
			return;
		}
	}
	$t(e, r, a, i, s);
}
function $t(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var W = [], en = -1, tn = [], nn = null, rn = 0, an = /* @__PURE__ */ Promise.resolve(), on = null;
function sn(e) {
	let t = on || an;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function cn(e) {
	let t = en + 1, n = W.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = W[r], a = mn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function ln(e) {
	if (!(e.flags & 1)) {
		let t = mn(e), n = W[W.length - 1];
		!n || !(e.flags & 2) && t >= mn(n) ? W.push(e) : W.splice(cn(t), 0, e), e.flags |= 1, un();
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
function fn(e, t, n = en + 1) {
	for (; n < W.length; n++) {
		let t = W[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			W.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
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
		for (en = 0; en < W.length; en++) {
			let e = W[en];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), Zt(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; en < W.length; en++) {
			let e = W[en];
			e && (e.flags &= -2);
		}
		en = -1, W.length = 0, pn(e), on = null, (W.length || tn.length) && hn(e);
	}
}
var gn = null, _n = null;
function vn(e) {
	let t = gn;
	return gn = e, _n = e && e.type.__scopeId || null, t;
}
function yn(e, t = gn, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && wi(-1);
		let i = vn(t), a = xi.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = xi.length; e > a; e--) Si();
			vn(i), r._d && wi(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function bn(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (Re(), U(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), ze());
	}
}
function xn(e, t) {
	if ($) {
		let n = $.provides, r = $.parent && $.parent.provides;
		r === n && (n = $.provides = Object.create(r)), n[e] = t;
	}
}
function Sn(e, t, n = !1) {
	let r = Wi();
	if (r || kr) {
		let i = kr ? kr._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var Cn = /* @__PURE__ */ Symbol.for("v-scx"), wn = () => Sn(Cn);
function Tn(e, t, n) {
	return En(e, t, n);
}
function En(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (Xi) {
		if (c === "sync") {
			let e = wn();
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
		K(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : ln(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Yt(e, n, u);
	return Xi && (f ? f.push(h) : d && h()), h;
}
function Dn(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? On(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = qi(this), s = En(i, a.bind(r), n);
	return o(), s;
}
function On(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var kn = /* @__PURE__ */ Symbol("_vte"), An = (e) => e.__isTeleport, jn = /* @__PURE__ */ Symbol("_leaveCb");
function Mn(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== yi) {
			t = n;
			break;
		}
	}
	return t;
}
function Nn(e) {
	if (!Hn(e)) return An(e.type) && e.children ? Mn(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Pn(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Pn(An(n.type) && Nn(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Fn(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function In(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function Ln(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Rn = /* @__PURE__ */ new WeakMap();
function zn(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => zn(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (Vn(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && zn(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? ra(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ B(v), b = v === t ? i : (e) => !Ln(_, e) && u(y, e), x = (e, t) => !(t && Ln(_, t));
	if (m != null && m !== p) {
		if (Bn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ H(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) Zt(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ H(p);
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
					i(), Rn.delete(e);
				};
				t.id = -1, Rn.set(e, t), K(t, r);
			} else Bn(e), i();
		}
	}
}
function Bn(e) {
	let t = Rn.get(e);
	t && (t.flags |= 8, Rn.delete(e));
}
se().requestIdleCallback, se().cancelIdleCallback;
var Vn = (e) => !!e.type.__asyncLoader, Hn = (e) => e.type.__isKeepAlive;
function Un(e, t) {
	Gn(e, "a", t);
}
function Wn(e, t) {
	Gn(e, "da", t);
}
function Gn(e, t, n = $) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (qn(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Hn(e.parent.vnode) && Kn(r, t, n, e), e = e.parent;
	}
}
function Kn(e, t, n, r) {
	let i = qn(t, e, r, !0);
	er(() => {
		c(r[t], i);
	}, n);
}
function qn(e, t, n = $, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			Re();
			let i = qi(n), a = U(t, n, e, r);
			return i(), ze(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var Jn = (e) => (t, n = $) => {
	(!Xi || e === "sp") && qn(e, (...e) => t(...e), n);
}, Yn = Jn("bm"), Xn = Jn("m"), Zn = Jn("bu"), Qn = Jn("u"), $n = Jn("bum"), er = Jn("um"), tr = Jn("sp"), nr = Jn("rtg"), rr = Jn("rtc");
function ir(e, t = $) {
	qn("ec", e, t);
}
var ar = /* @__PURE__ */ Symbol.for("v-ndc");
function or(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ Mt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ z(e), s = /* @__PURE__ */ Nt(e), e = Ze(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? It(V(e[n])) : V(e[n]) : e[n], n, void 0, a && a[n]);
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
var sr = (e) => e ? Yi(e) ? ra(e) : sr(e.parent) : null, cr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => sr(e.parent),
	$root: (e) => sr(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => _r(e),
	$forceUpdate: (e) => e.f ||= () => {
		ln(e.update);
	},
	$nextTick: (e) => e.n ||= sn.bind(e.proxy),
	$watch: (e) => Dn.bind(e)
}), lr = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), ur = {
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
			else if (lr(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else fr && (s[n] = 0);
		}
		let d = cr[n], f, p;
		if (d) return n === "$attrs" && L(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return lr(a, n) ? (a[n] = r, !0) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) || n[0] === "$" && n.slice(1) in e ? !1 : (o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || lr(n, c) || u(o, c) || u(i, c) || u(cr, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function dr(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var fr = !0;
function pr(e) {
	let t = _r(e), n = e.proxy, i = e.ctx;
	fr = !1, t.beforeCreate && hr(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: ee, renderTracked: te, renderTriggered: T, errorCaptured: E, serverPrefetch: ne, expose: D, inheritAttrs: re, components: O, directives: k, filters: ie } = t;
	if (u && mr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ Ot(t));
	}
	if (fr = !0, o) for (let e in o) {
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
	if (c) for (let e in c) gr(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			xn(t, e[t]);
		});
	}
	f && hr(f, e, "c");
	function A(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (A(Yn, p), A(Xn, m), A(Zn, g), A(Qn, _), A(Un, y), A(Wn, b), A(ir, E), A(rr, te), A(nr, T), A($n, S), A(er, w), A(tr, ne), d(D)) {
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
	ee && e.render === r && (e.render = ee), re != null && (e.inheritAttrs = re), O && (e.components = O), k && (e.directives = k), ne && In(e);
}
function mr(e, t, n = r) {
	d(e) && (e = Sr(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? Sn(r.from || n, r.default, !0) : Sn(r.from || n) : Sn(r), /* @__PURE__ */ H(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function hr(e, t, n) {
	U(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function gr(e, t, n, r) {
	let i = r.includes(".") ? On(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) && Tn(i, n);
	} else if (h(e)) Tn(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => gr(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) && Tn(i, r, e);
		}
	}
}
function _r(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => vr(c, e, o, !0)), vr(c, t, o)), v(t) && a.set(t, c), c;
}
function vr(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && vr(e, a, n, !0), i && i.forEach((t) => vr(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = yr[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var yr = {
	data: br,
	props: wr,
	emits: wr,
	methods: Cr,
	computed: Cr,
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
	components: Cr,
	directives: Cr,
	watch: Tr,
	provide: br,
	inject: xr
};
function br(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function xr(e, t) {
	return Cr(Sr(e), Sr(t));
}
function Sr(e) {
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
function Cr(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function wr(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), dr(e), dr(t ?? {})) : t;
}
function Tr(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = G(e[r], t[r]);
	return n;
}
function Er() {
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
var Dr = 0;
function Or(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = Er(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: Dr++,
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
				let t = kr;
				kr = l;
				try {
					return e();
				} finally {
					kr = t;
				}
			}
		};
		return l;
	};
}
var kr = null, Ar = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${E(t)}Modifiers`] || e[`${D(t)}Modifiers`];
function jr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && Ar(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(ae)));
	let c, l = i[c = O(n)] || i[c = O(E(n))];
	!l && o && (l = i[c = O(D(n))]), l && U(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, U(u, e, 6, a);
	}
}
var Mr = /* @__PURE__ */ new WeakMap();
function Nr(e, t, n = !1) {
	let r = n ? Mr : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Nr(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Pr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, D(t)) || u(e, t));
}
function Fr(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = vn(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = Ii(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = Ii(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Ir(c);
		}
	} catch (t) {
		xi.length = 0, Qt(t, e, 1), v = ji(yi);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Lr(y, a)), b = Pi(b, y, !1, !0));
	}
	return n.dirs && (b = Pi(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Pn(An(b.type) && Nn(b) || b, n.transition), v = b, vn(_), v;
}
var Ir = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Lr = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function Rr(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? zr(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Br(o, r, n) && !Pr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || zr(r, o, l) : !!o;
	return !1;
}
function zr(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (Br(t, e, a) && !Pr(n, a)) return !0;
	}
	return !1;
}
function Br(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !_e(r, i) : r !== i;
}
function Vr({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Hr = {}, Ur = () => Object.create(Hr), Wr = (e) => Object.getPrototypeOf(e) === Hr;
function Gr(e, t, n, r = !1) {
	let i = {}, a = Ur();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), qr(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ kt(i) : e.type.props ? i : a, e.attrs = a;
}
function Kr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ B(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Pr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = E(o);
						i[t] = Jr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		qr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = D(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Jr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Ye(e.attrs, "set", "");
}
function qr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (ee(t)) continue;
		let l = n[t], d;
		a && u(a, d = E(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Pr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ B(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = Jr(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function Jr(e, t, n, r, i, a) {
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
var Yr = /* @__PURE__ */ new WeakMap();
function Xr(e, r, i = !1) {
	let a = i ? Yr : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = Xr(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = E(c[e]);
		Zr(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = E(e);
		if (Zr(t)) {
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
function Zr(e) {
	return e[0] !== "$" && !ee(e);
}
var Qr = (e) => e === "_" || e === "_ctx" || e === "$stable", $r = (e) => d(e) ? e.map(Ii) : [Ii(e)], ei = (e, t, n) => {
	if (t._n) return t;
	let r = yn((...e) => $r(t(...e)), n);
	return r._c = !1, r;
}, ti = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (Qr(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = ei(n, i, r);
		else if (i != null) {
			let e = $r(i);
			t[n] = () => e;
		}
	}
}, ni = (e, t) => {
	let n = $r(t);
	e.slots.default = () => n;
}, ri = (e, t, n) => {
	for (let r in t) (n || !Qr(r)) && (e[r] = t[r]);
}, ii = (e, t, n) => {
	let r = e.slots = Ur();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (ri(r, t, n), n && A(r, "_", e, !0)) : ti(t, r);
	} else t && ni(e, t);
}, ai = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : ri(a, n, r) : (o = !n.$stable, ti(n, a)), s = n;
	} else n && (ni(e, n), s = { default: 1 });
	if (o) for (let e in a) !Qr(e) && s[e] == null && delete a[e];
}, K = _i;
function oi(e) {
	return si(e);
}
function si(e, i) {
	let a = se();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !Oi(e, t) && (r = M(e), j(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case vi:
				y(e, t, n, r);
				break;
			case yi:
				b(e, t, n, r);
				break;
			case bi:
				e ?? x(t, n, r, o);
				break;
			case q:
				O(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? k(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, N);
		}
		u != null && i ? zn(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && zn(e.ref, null, a, e, !0);
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
				n && n._beginPatch(), ne(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, te = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && E(e.children, d, null, r, i, ci(e, a), s, u), _ && bn(e, null, r, "created"), T(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !ee(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Bi(f, r, e);
		}
		_ && bn(e, null, r, "beforeMount");
		let v = ui(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && K(() => {
			try {
				f && Bi(f, r, e), v && g.enter(d), _ && bn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, T = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || gi(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				T(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, E = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? Li(e[l]) : Ii(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, ne = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && li(r, !1), (g = h.onVnodeBeforeUpdate) && Bi(g, r, n, e), f && bn(n, e, r, "beforeUpdate"), r && li(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? D(e.dynamicChildren, d, l, r, i, ci(n, a), o) : s || le(e, n, l, null, r, i, ci(n, a), o, !1), u > 0) {
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
		((g = h.onVnodeUpdated) || f) && K(() => {
			g && Bi(g, r, n, e), f && bn(n, e, r, "updated");
		}, i);
	}, D = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === q || !Oi(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
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
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), E(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (D(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && di(e, t, !0)) : le(e, t, n, f, i, a, s, c, l);
	}, k = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : A(t, n, r, i, a, o, c) : ae(e, t, c);
	}, A = (e, t, n, r, i, a, o) => {
		let s = e.component = Ui(e, r, i);
		if (Hn(e) && (s.ctx.renderer = N), Zi(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, oe, o), !e.el) {
				let r = s.subTree = ji(yi);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else oe(s, e, t, n, i, a, o);
	}, ae = (e, t, n) => {
		let r = t.component = e.component;
		if (Rr(e, t, n)) {
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
					let n = pi(e);
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
				li(e, !1), t ? (t.el = c.el, ce(e, t, o)) : t = c, n && ie(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Bi(d, s, t, c), li(e, !0);
				let f = Fr(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), M(p), e, i, a), t.el = f.el, u === null && Vr(e, f.el), r && K(r, i), (d = t.props && t.props.onVnodeUpdated) && K(() => Bi(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Vn(t);
				if (li(e, !1), l && ie(l), !m && (o = c && c.onVnodeBeforeMount) && Bi(o, d, t), li(e, !0), s && be) {
					let t = () => {
						e.subTree = Fr(e), be(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Fr(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && K(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					K(() => Bi(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Vn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && K(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new we(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => ln(u), li(e, !0), l();
	}, ce = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, Kr(e, t.props, r, n), ai(e, t.children, n), Re(), fn(e), ze();
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
			let n = t[p] = l ? Li(t[p]) : Ii(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? ge(e, a, o, !0, !1, f) : E(t, r, i, a, o, s, c, l, f);
	}, de = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? Li(t[u]) : Ii(t[u]);
			if (Oi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? Li(t[p]) : Ii(t[p]);
			if (Oi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? Li(t[u]) : Ii(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) j(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? Li(t[u]) : Ii(t[u]);
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
			let w = x ? fi(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || hi(f) : i;
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
			c.move(e, t, n, N);
			return;
		}
		if (c === q) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) fe(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === bi) {
			S(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[jn] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), K(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[jn];
					a._isLeaving && a[jn](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, j = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (Re(), zn(s, null, n, e, !0), ze()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Vn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Bi(_, t, e), u & 6) he(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && bn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, N, r) : l && !l.hasOnce && (a !== q || d > 0 && d & 64) ? ge(l, t, n, !1, !0) : (a === q && d & 384 || !i && u & 16) && ge(c, t, n), r && pe(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && K(() => {
			_ && Bi(_, t, e), h && bn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, pe = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === q) {
			me(n, r);
			return;
		}
		if (t === bi) {
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
		mi(c), mi(l), r && ie(r), i.stop(), a && (a.flags |= 8, j(o, e, t, n)), s && K(s, t), K(() => {
			e.isUnmounted = !0;
		}, t);
	}, ge = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) j(e[o], t, n, r, i);
	}, M = (e) => {
		if (e.shapeFlag & 6) return M(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[kn];
		return n ? h(n) : t;
	}, _e = !1, ve = (e, t, n) => {
		let r;
		e == null ? t._vnode && (j(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, _e ||= (_e = !0, fn(r), pn(), !1);
	}, N = {
		p: v,
		um: j,
		m: fe,
		r: pe,
		mt: A,
		mc: E,
		pc: le,
		pbc: D,
		n: M,
		o: e
	}, ye, be;
	return i && ([ye, be] = i(N)), {
		render: ve,
		hydrate: ye,
		createApp: Or(ve, ye)
	};
}
function ci({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function li({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function ui(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function di(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = Li(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && di(t, a)), a.type === vi && (a.patchFlag === -1 && (a = i[e] = Li(a)), a.el = t.el), a.type === yi && !a.el && (a.el = t.el);
	}
}
function fi(e) {
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
function pi(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : pi(t);
}
function mi(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function hi(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? hi(t.subTree) : null;
}
var gi = (e) => e.__isSuspense;
function _i(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : dn(e);
}
var q = /* @__PURE__ */ Symbol.for("v-fgt"), vi = /* @__PURE__ */ Symbol.for("v-txt"), yi = /* @__PURE__ */ Symbol.for("v-cmt"), bi = /* @__PURE__ */ Symbol.for("v-stc"), xi = [], J = null;
function Y(e = !1) {
	xi.push(J = e ? null : []);
}
function Si() {
	xi.pop(), J = xi[xi.length - 1] || null;
}
var Ci = 1;
function wi(e, t = !1) {
	Ci += e, e < 0 && J && t && (J.hasOnce = !0);
}
function Ti(e) {
	return e.dynamicChildren = Ci > 0 ? J || n : null, Si(), Ci > 0 && J && J.push(e), e;
}
function X(e, t, n, r, i, a) {
	return Ti(Z(e, t, n, r, i, a, !0));
}
function Ei(e, t, n, r, i) {
	return Ti(ji(e, t, n, r, i, !0));
}
function Di(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function Oi(e, t) {
	return e.type === t.type && e.key === t.key;
}
var ki = ({ key: e }) => e ?? null, Ai = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ H(e) || h(e) ? {
	i: gn,
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
		key: t && ki(t),
		ref: t && Ai(t),
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
		ctx: gn
	};
	return s ? (Ri(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), Ci > 0 && !o && J && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && J.push(c), c;
}
var ji = Mi;
function Mi(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === ar) && (e = yi), Di(e)) {
		let r = Pi(e, t, !0);
		return n && Ri(r, n), Ci > 0 && !a && J && (r.shapeFlag & 6 ? J[J.indexOf(e)] = r : J.push(r)), r.patchFlag = -2, r;
	}
	if (ia(e) && (e = e.__vccOpts), t) {
		t = Ni(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = j(e)), v(n) && (/* @__PURE__ */ Pt(n) && !d(n) && (n = s({}, n)), t.style = ce(n));
	}
	let o = g(e) ? 1 : gi(e) ? 128 : An(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return Z(e, t, n, r, i, o, a, !0);
}
function Ni(e) {
	return e ? /* @__PURE__ */ Pt(e) || Wr(e) ? s({}, e) : e : null;
}
function Pi(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? zi(i || {}, t) : i, u = {
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
		patchFlag: t && e.type !== q ? o === -1 ? 16 : o | 16 : o,
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
	return c && r && Pn(u, c.clone(u)), u;
}
function Fi(e = " ", t = 0) {
	return ji(vi, null, e, t);
}
function Q(e = "", t = !1) {
	return t ? (Y(), Ei(yi, null, e)) : ji(yi, null, e);
}
function Ii(e) {
	return e == null || typeof e == "boolean" ? ji(yi) : d(e) ? ji(q, null, e.slice()) : Di(e) ? Li(e) : ji(vi, null, String(e));
}
function Li(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : Pi(e);
}
function Ri(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), Ri(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !Wr(t) ? t._ctx = gn : r === 3 && gn && (gn.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			Ri(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: gn
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Fi(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function zi(...e) {
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
function Bi(e, t, n, r = null) {
	U(e, t, 7, [n, r]);
}
var Vi = Er(), Hi = 0;
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
		scope: new xe(!0),
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
		propsOptions: Xr(i, a),
		emitsOptions: Nr(i, a),
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
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = jr.bind(null, o), e.ce && e.ce(o), o;
}
var $ = null, Wi = () => $ || gn, Gi, Ki;
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
	Gr(e, r, a, t), ii(e, i, n || t);
	let o = a ? Qi(e, t) : void 0;
	return t && Ki(!1), o;
}
function Qi(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, ur);
	let { setup: r } = n;
	if (r) {
		Re();
		let n = e.setupContext = r.length > 1 ? na(e) : null, i = qi(e), a = Zt(r, e, 0, [e.props, n]), o = y(a);
		if (ze(), i(), (o || e.sp) && !Vn(e) && In(e), o) {
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
		Re();
		try {
			pr(e);
		} finally {
			ze(), t();
		}
	}
}
var ta = { get(e, t) {
	return L(e, "get", ""), e[t];
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
	return e.exposed ? e.exposeProxy ||= new Proxy(Ht(Ft(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in cr) return cr[n](e);
		},
		has(e, t) {
			return t in e || t in cr;
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
				e && U(e, t, 5, a);
			}
		} else U(r, t, 5, [e]);
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
	return Xa ||= oi(Ya);
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
//#region src/GameCheckInPage.vue?vue&type=script&setup=true&lang.ts
var to = {
	class: "gci-page",
	"data-game-check-in-page": ""
}, no = { class: "gci-page-head" }, ro = ["label"], io = {
	key: 0,
	class: "gci-timezone",
	role: "note"
}, ao = {
	key: 1,
	class: "gci-error",
	role: "alert"
}, oo = {
	key: 2,
	class: "gci-loading",
	role: "status"
}, so = { class: "gci-editor-head" }, co = { class: "gci-form-grid" }, lo = { class: "gci-field gci-field-wide" }, uo = ["model-value", "aria-label"], fo = { class: "gci-toggle-row gci-field-wide" }, po = ["model-value", "aria-label"], mo = { class: "gci-form-section" }, ho = { class: "gci-section-head" }, go = { class: "gci-platform-grid" }, _o = [
	"model-value",
	"aria-label",
	"onChange"
], vo = { class: "gci-form-section" }, yo = { class: "gci-section-head" }, bo = { class: "gci-secret-grid" }, xo = ["for"], So = [
	"id",
	"model-value",
	"placeholder",
	"aria-label",
	"onChange"
], Co = {
	key: 0,
	class: "gci-clear-secret-row"
}, wo = [
	"model-value",
	"aria-label",
	"onChange"
], To = { class: "gci-form-section" }, Eo = { class: "gci-section-head" }, Do = { class: "gci-form-grid" }, Oo = { class: "gci-field" }, ko = ["model-value", "aria-label"], Ao = { class: "gci-field" }, jo = ["model-value", "aria-label"], Mo = { class: "gci-field gci-field-wide" }, No = ["model-value", "aria-label"], Po = { class: "gci-form-section" }, Fo = { class: "gci-section-head" }, Io = ["label"], Lo = {
	key: 0,
	class: "gci-schedule-editor-list"
}, Ro = { class: "gci-schedule-controls" }, zo = { class: "gci-field" }, Bo = [
	"model-value",
	"aria-label",
	"onChange"
], Vo = { class: "gci-toggle-row gci-schedule-toggle" }, Ho = [
	"model-value",
	"aria-label",
	"onChange"
], Uo = ["label", "onClick"], Wo = ["aria-label"], Go = [
	"model-value",
	"aria-label",
	"onChange"
], Ko = {
	key: 1,
	class: "gci-inline-empty"
}, qo = { class: "gci-form-section" }, Jo = { class: "gci-section-head" }, Yo = { class: "gci-toggle-row" }, Xo = ["model-value", "aria-label"], Zo = { class: "gci-form-grid gci-form-grid-three" }, Qo = { class: "gci-field" }, $o = [
	"model-value",
	"options",
	"aria-label"
], es = { class: "gci-secret-field gci-field-wide" }, ts = { for: "gci-webhook-url" }, ns = [
	"model-value",
	"placeholder",
	"aria-label"
], rs = {
	key: 0,
	class: "gci-clear-secret-row"
}, is = ["model-value", "aria-label"], as = { class: "gci-secret-field" }, os = { for: "gci-webhook-secret" }, ss = [
	"model-value",
	"placeholder",
	"aria-label"
], cs = {
	key: 0,
	class: "gci-clear-secret-row"
}, ls = ["model-value", "aria-label"], us = {
	key: 0,
	class: "gci-field gci-field-wide"
}, ds = ["model-value", "aria-label"], fs = { class: "gci-form-section" }, ps = { class: "gci-section-head" }, ms = { class: "gci-toggle-row" }, hs = ["model-value", "aria-label"], gs = { class: "gci-form-grid gci-form-grid-three" }, _s = { class: "gci-field" }, vs = ["model-value", "aria-label"], ys = { class: "gci-field" }, bs = ["model-value", "aria-label"], xs = { class: "gci-field" }, Ss = [
	"model-value",
	"options",
	"aria-label"
], Cs = { class: "gci-secret-field" }, ws = { for: "gci-smtp-user" }, Ts = [
	"model-value",
	"placeholder",
	"aria-label"
], Es = {
	key: 0,
	class: "gci-clear-secret-row"
}, Ds = ["model-value", "aria-label"], Os = { class: "gci-secret-field" }, ks = { for: "gci-smtp-password" }, As = [
	"model-value",
	"placeholder",
	"aria-label"
], js = {
	key: 0,
	class: "gci-clear-secret-row"
}, Ms = ["model-value", "aria-label"], Ns = { class: "gci-field" }, Ps = ["model-value", "aria-label"], Fs = { class: "gci-field gci-field-wide" }, Is = ["model-value", "aria-label"], Ls = { class: "gci-field gci-field-wide" }, Rs = ["model-value", "aria-label"], zs = {
	key: 0,
	class: "gci-error",
	role: "alert"
}, Bs = { class: "gci-editor-actions" }, Vs = ["label"], Hs = ["label", "disabled"], Us = ["aria-label"], Ws = { class: "gci-task-head" }, Gs = { class: "gci-task-title" }, Ks = ["label", "tone"], qs = ["label", "tone"], Js = { class: "gci-task-actions" }, Ys = [
	"label",
	"disabled",
	"onClick"
], Xs = ["label", "onClick"], Zs = [
	"label",
	"disabled",
	"onClick"
], Qs = { class: "gci-task-meta" }, $s = { class: "gci-task-section" }, ec = {
	key: 0,
	class: "gci-tag-list"
}, tc = {
	key: 1,
	class: "gci-inline-empty"
}, nc = { class: "gci-task-section" }, rc = { class: "gci-section-head" }, ic = { class: "gci-muted" }, ac = {
	key: 0,
	class: "gci-schedule-list"
}, oc = { class: "gci-schedule-days" }, sc = ["label", "tone"], cc = {
	key: 1,
	class: "gci-inline-empty"
}, lc = { class: "gci-run-history" }, uc = {
	key: 0,
	class: "gci-run-list"
}, dc = { class: "gci-run-head" }, fc = ["label", "tone"], pc = {
	key: 0,
	class: "gci-result-list"
}, mc = {
	key: 1,
	class: "gci-inline-empty"
}, hc = {
	key: 1,
	class: "gci-inline-empty"
}, gc = ["title", "description"], _c = ["label"], vc = /* @__PURE__ */ Fn({
	__name: "GameCheckInPage",
	props: { host: {} },
	setup(e) {
		let t = e, n = /* @__PURE__ */ Lt(null), r = /* @__PURE__ */ Lt(!0), i = /* @__PURE__ */ Lt(!1), a = /* @__PURE__ */ Lt(""), o = /* @__PURE__ */ Lt(""), s = /* @__PURE__ */ Lt(null), c = aa(() => s.value?.id || ""), l = /* @__PURE__ */ Lt({}), u = /* @__PURE__ */ Lt({}), d = [
			"cn",
			"os",
			"skland",
			"skport",
			"kuro",
			"webhookUrl",
			"webhookSecret",
			"smtpUser",
			"smtpPassword"
		], f = [
			0,
			1,
			2,
			3,
			4,
			5,
			6
		], p = [
			{
				value: "auto",
				label: ""
			},
			{
				value: "ssl",
				label: ""
			},
			{
				value: "starttls",
				label: ""
			},
			{
				value: "none",
				label: ""
			}
		], m = [
			"cn",
			"os",
			"skland",
			"skport",
			"kuro"
		], h = null, g = 0, _ = !1, v = !1, y = new AbortController(), b = aa(() => n.value?.tasks || []), x = aa(() => n.value?.platforms || []), S = aa(() => b.value.find((e) => e.id === c.value)), C = aa(() => S.value?.webhookSecrets?.urlConfigured === !0), w = aa(() => S.value?.webhookSecrets?.signingSecretConfigured === !0), ee = aa(() => S.value?.smtpSecrets?.userConfigured === !0), te = aa(() => S.value?.smtpSecrets?.passwordConfigured === !0);
		function T(e, n = {}, r = "") {
			return t.host.i18n.t(e, n, r);
		}
		function E(e) {
			let t = e.detail;
			return Array.isArray(t) && t.length ? t[0] : e.target?.modelValue;
		}
		function ne(e, t) {
			l.value[e] = t, t.trim() && (u.value[e] = !1);
		}
		function D(e) {
			let t = e;
			return typeof t?.code == "string" ? t.code : "";
		}
		function re(e, t) {
			let n = D(e);
			return n ? T(`error.${n}`, {}, t) : t;
		}
		async function O(e = !1) {
			if (!(v || _)) {
				v = !0;
				try {
					let e = await t.host.api.get("state", y.signal);
					if (_) return;
					n.value = {
						tasks: Array.isArray(e?.tasks) ? e.tasks : [],
						platforms: Array.isArray(e?.platforms) ? e.platforms : [],
						webhookTypes: Array.isArray(e?.webhookTypes) ? e.webhookTypes : [],
						timeZoneId: e?.timeZoneId || "",
						localTime: e?.localTime || ""
					}, a.value = "";
				} catch {
					!_ && e && (a.value = T("error.state_failed", {}, "签到任务读取失败，请稍后重试。 "));
				} finally {
					v = !1, e && !_ && (r.value = !1);
				}
			}
		}
		function k(e) {
			return e ? {
				id: e.id,
				name: e.name,
				enabled: e.enabled,
				games: Object.fromEntries(Object.entries(e.games || {}).map(([e, t]) => [e, [...t]])),
				cnDeviceId: e.cnDeviceId,
				kuroDevCode: e.kuroDevCode,
				kuroDistinctId: e.kuroDistinctId,
				schedules: (e.schedules || []).map((e) => ({
					...e,
					days: [...e.days]
				})),
				notifications: JSON.parse(JSON.stringify(e.notifications))
			} : {
				name: T("task.new", {}, "新签到任务"),
				enabled: !0,
				games: {},
				cnDeviceId: "",
				kuroDevCode: "",
				kuroDistinctId: "",
				schedules: [],
				notifications: {
					webhook: {
						enabled: !1,
						type: "generic",
						template: "{\"text\":{text}}"
					},
					smtp: {
						enabled: !1,
						host: "",
						port: 465,
						secure: "auto",
						from: "",
						to: "",
						subjectPrefix: "[NexusPipeline]"
					}
				}
			};
		}
		function ie(e) {
			s.value = k(e), l.value = Object.fromEntries(d.map((e) => [e, ""])), u.value = Object.fromEntries(d.map((e) => [e, !1])), o.value = "", requestAnimationFrame(() => {
				document.querySelector("#gci-task-name input")?.focus();
			});
		}
		function A() {
			s.value = null, o.value = "";
		}
		function ae(e, t) {
			return s.value?.games[e]?.includes(t) === !0;
		}
		function oe(e, t, n) {
			if (!s.value) return;
			let r = new Set(s.value.games[e] || []);
			n ? r.add(t) : r.delete(t), r.size ? s.value.games[e] = [...r] : delete s.value.games[e];
		}
		function se() {
			if (!s.value) return;
			let e = globalThis.crypto?.randomUUID, t = typeof e == "function" ? e.call(globalThis.crypto) : `draft-${Date.now().toString(36)}-${(++g).toString(36)}`;
			s.value.schedules.push({
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
			});
		}
		function ce(e, t, n) {
			let r = new Set(e.days);
			n ? r.add(t) : r.delete(t), e.days = [...r].sort((e, t) => e - t);
		}
		function le(e) {
			return e.map((e) => T(`day.${e}`, {}, [
				"周日",
				"周一",
				"周二",
				"周三",
				"周四",
				"周五",
				"周六"
			][e])).join("、");
		}
		function ue(e) {
			return T(`day.${e}`, {}, [
				"周日",
				"周一",
				"周二",
				"周三",
				"周四",
				"周五",
				"周六"
			][e]);
		}
		function de(e) {
			return Object.entries(e.games || {}).flatMap(([e, t]) => {
				let n = x.value.find((t) => t.id === e), r = n?.name || T(`platform.${e}`, {}, e);
				return t.map((e) => {
					let t = n?.games.find((t) => t.id === e);
					return `${r} · ${t?.name || T(`game.${e}`, {}, e)}`;
				});
			});
		}
		function fe(e) {
			if (!e) return T("task.never_run", {}, "尚未运行");
			let t = new Date(e);
			return Number.isNaN(t.valueOf()) ? e : new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(t);
		}
		function pe(e) {
			return e.isRunning ? T("status.running", {}, "运行中") : T(`status.${e.recentRun?.status || "idle"}`, {}, e.recentRun?.status || T("status.idle", {}, "待运行"));
		}
		function me(e) {
			return e.code === "already" ? T("result.already", {}, "今日已签到") : e.success ? T("result.success", {}, "成功") : e.message || T(`result.${e.code}`, {}, "签到失败");
		}
		function he(e, t) {
			return x.value.find((t) => t.id === e)?.games.find((e) => e.id === t)?.name || T(`game.${t}`, {}, t);
		}
		function ge(e, t) {
			return m.includes(t) ? e?.credentials?.[t] === !0 : t === "webhookUrl" ? e?.webhookSecrets?.urlConfigured === !0 : t === "webhookSecret" ? e?.webhookSecrets?.signingSecretConfigured === !0 : t === "smtpUser" ? e?.smtpSecrets?.userConfigured === !0 : e?.smtpSecrets?.passwordConfigured === !0;
		}
		function M(e) {
			return T({
				cn: "field.cn_credential",
				os: "field.os_credential",
				skland: "field.skland_credential",
				skport: "field.skport_credential",
				kuro: "field.kuro_credential",
				webhookUrl: "field.webhook_url",
				webhookSecret: "field.webhook_secret",
				smtpUser: "field.smtp_user",
				smtpPassword: "field.smtp_password"
			}[e] || e, {}, e);
		}
		function _e() {
			return p.map((e) => ({
				...e,
				label: T(`secure.${e.value}`, {}, e.value)
			}));
		}
		function ve() {
			let e = {};
			for (let t of d) u.value[t] ? e[t] = { action: "clear" } : l.value[t] && (e[t] = {
				action: "set",
				value: l.value[t]
			});
			return e;
		}
		async function ye() {
			if (!s.value) return;
			o.value = "";
			let e = s.value;
			if (!e.name.trim()) {
				o.value = T("error.task_name_invalid", {}, "请填写任务名称。");
				return;
			}
			if (!Object.values(e.games).some((e) => e.length > 0)) {
				o.value = T("error.games_invalid", {}, "请选择至少一个平台游戏。");
				return;
			}
			if (e.schedules.some((e) => e.days.length === 0 || !/^\d{2}:\d{2}$/.test(e.time))) {
				o.value = T("error.schedule_settings_invalid", {}, "请检查固定时间和星期设置。");
				return;
			}
			i.value = !0;
			let n = {
				...e.id ? { id: e.id } : {},
				name: e.name,
				enabled: e.enabled,
				games: e.games,
				cnDeviceId: e.cnDeviceId,
				kuroDevCode: e.kuroDevCode,
				kuroDistinctId: e.kuroDistinctId,
				schedules: e.schedules,
				notifications: e.notifications,
				secrets: ve()
			};
			try {
				e.id ? await t.host.api.put("tasks", n, y.signal) : await t.host.api.post("tasks", n, y.signal), A(), await O(), t.host.ui?.toast(T("toast.saved", {}, "签到任务已保存。"), "success");
			} catch (e) {
				o.value = re(e, T("error.save_failed", {}, "任务保存失败，请检查填写内容后重试。"));
			} finally {
				i.value = !1;
			}
		}
		async function be(e) {
			try {
				await t.host.api.post("tasks/run", { taskId: e.id }, y.signal), await O(), t.host.ui?.toast(T("toast.run_started", {}, "签到已开始。"), "info");
			} catch (e) {
				a.value = re(e, T("error.run_failed", {}, "签到启动失败，请稍后重试。"));
			}
		}
		async function P(e) {
			if (window.confirm(T("task.delete_confirm", {}, "删除此任务及其凭据？"))) try {
				await t.host.api.delete("tasks", { taskId: e.id }, y.signal), c.value === e.id && A(), await O(), t.host.ui?.toast(T("toast.deleted", {}, "签到任务已删除。"), "success");
			} catch (e) {
				a.value = re(e, T("error.delete_failed", {}, "任务删除失败。"));
			}
		}
		function xe() {
			return r.value ? T("status.loading", {}, "正在读取…") : a.value;
		}
		return Xn(() => {
			O(!0), h = setInterval(() => void O(), 5e3);
		}), $n(() => {
			_ = !0, y.abort(), h && clearInterval(h);
		}), (e, t) => (Y(), X("section", to, [
			Z("header", no, [Z("div", null, [Z("h1", null, N(T("page.title", {}, "签到")), 1), Z("p", null, N(T("page.description", {}, "管理游戏签到任务、执行计划与独立通知。")), 1)]), Z("nxp-button", {
				label: T("action.add_task", {}, "添加签到任务"),
				tone: "primary",
				onClick: t[0] ||= (e) => ie()
			}, null, 8, ro)]),
			n.value?.timeZoneId ? (Y(), X("p", io, N(T("page.timezone", { zone: n.value.timeZoneId }, `本机时区：${n.value.timeZoneId}`)), 1)) : Q("", !0),
			a.value ? (Y(), X("p", ao, N(a.value), 1)) : r.value ? (Y(), X("p", oo, N(xe()), 1)) : Q("", !0),
			s.value ? (Y(), X("form", {
				key: 3,
				class: "gci-editor",
				"data-task-editor": "",
				onSubmit: Ja(ye, ["prevent"])
			}, [
				Z("header", so, [Z("div", null, [Z("h2", null, N(c.value ? T("editor.edit_title", {}, "编辑签到任务") : T("editor.new_title", {}, "新建签到任务")), 1), Z("p", null, N(T("editor.description", {}, "每项任务独立保存账号凭据和通知目标。")), 1)])]),
				Z("div", co, [Z("label", lo, [Z("span", null, N(T("field.name", {}, "任务名称")), 1), Z("nxp-text-input", {
					id: "gci-task-name",
					"model-value": s.value.name,
					maxlength: "100",
					autocomplete: "off",
					"aria-label": T("field.name", {}, "任务名称"),
					onChange: t[1] ||= (e) => s.value.name = E(e).trim()
				}, null, 40, uo)]), Z("div", fo, [Z("span", null, N(T("field.enabled", {}, "启用任务")), 1), Z("nxp-switch", {
					class: "gci-toggle",
					"model-value": s.value.enabled,
					"aria-label": T("field.enabled", {}, "启用任务"),
					"semantic-role": "switch",
					onChange: t[2] ||= (e) => s.value.enabled = E(e)
				}, null, 40, po)])]),
				Z("section", mo, [Z("div", ho, [Z("div", null, [Z("h3", null, N(T("field.platform_games", {}, "签到平台与游戏")), 1), Z("p", null, N(T("editor.games_hint", {}, "选择任务要签到的平台和游戏。")), 1)])]), Z("div", go, [(Y(!0), X(q, null, or(x.value, (e) => (Y(), X("fieldset", {
					key: e.id,
					class: "gci-platform"
				}, [Z("legend", null, N(e.name), 1), (Y(!0), X(q, null, or(e.games, (t) => (Y(), X("label", {
					key: t.id,
					class: "gci-check-row"
				}, [Z("span", null, N(t.name), 1), Z("nxp-switch", {
					class: "gci-check-switch",
					"model-value": ae(e.id, t.id),
					"aria-label": `${e.name} · ${t.name}`,
					"semantic-role": "switch",
					onChange: (n) => oe(e.id, t.id, E(n))
				}, null, 40, _o)]))), 128))]))), 128))])]),
				Z("section", vo, [Z("div", yo, [Z("div", null, [Z("h3", null, N(T("field.credential", {}, "独立凭据")), 1), Z("p", null, N(T("editor.secret_hint", {}, "凭据只属于当前签到任务。编辑时留空会保留已保存值。")), 1)])]), Z("div", bo, [(Y(), X(q, null, or(m, (e) => Z("div", {
					key: e,
					class: "gci-secret-field"
				}, [
					Z("label", { for: `gci-secret-${e}` }, N(M(e)), 9, xo),
					Z("nxp-text-input", {
						id: `gci-secret-${e}`,
						"model-value": l.value[e],
						type: "password",
						autocomplete: "new-password",
						placeholder: ge(S.value, e) ? T("field.credential_placeholder", {}, "留空以保留已保存的凭据") : T("field.credential_missing", {}, "未配置"),
						"aria-label": M(e),
						onChange: (t) => ne(e, E(t))
					}, null, 40, So),
					ge(S.value, e) ? (Y(), X("div", Co, [Z("span", null, N(T("action.clear_secret", {}, "清除已保存凭据")), 1), Z("nxp-switch", {
						class: "gci-clear-secret",
						"model-value": u.value[e],
						"aria-label": `${M(e)} · ${T("action.clear_secret", {}, "清除已保存凭据")}`,
						"semantic-role": "switch",
						onChange: (t) => u.value[e] = E(t)
					}, null, 40, wo)])) : Q("", !0)
				])), 64))])]),
				Z("section", To, [Z("div", Eo, [Z("div", null, [Z("h3", null, N(T("field.device_settings", {}, "设备标识")), 1), Z("p", null, N(T("editor.device_hint", {}, "留空时会为任务自动生成设备标识。")), 1)])]), Z("div", Do, [
					Z("label", Oo, [Z("span", null, N(T("field.cn_device_id", {}, "米游社设备 ID")), 1), Z("nxp-text-input", {
						"model-value": s.value.cnDeviceId,
						"aria-label": T("field.cn_device_id", {}, "米游社设备 ID"),
						onChange: t[3] ||= (e) => s.value.cnDeviceId = E(e).trim()
					}, null, 40, ko)]),
					Z("label", Ao, [Z("span", null, N(T("field.kuro_dev_code", {}, "库街区设备码")), 1), Z("nxp-text-input", {
						"model-value": s.value.kuroDevCode,
						"aria-label": T("field.kuro_dev_code", {}, "库街区设备码"),
						onChange: t[4] ||= (e) => s.value.kuroDevCode = E(e).trim()
					}, null, 40, jo)]),
					Z("label", Mo, [Z("span", null, N(T("field.kuro_distinct_id", {}, "库街区设备 ID")), 1), Z("nxp-text-input", {
						"model-value": s.value.kuroDistinctId,
						"aria-label": T("field.kuro_distinct_id", {}, "库街区设备 ID"),
						onChange: t[5] ||= (e) => s.value.kuroDistinctId = E(e).trim()
					}, null, 40, No)])
				])]),
				Z("section", Po, [Z("div", Fo, [Z("div", null, [Z("h3", null, N(T("field.schedule", {}, "固定时间计划")), 1), Z("p", null, N(T("field.schedule_hint", {}, "按本机时区执行；程序关闭期间错过的时间不会补跑。")), 1)]), Z("nxp-button", {
					label: T("action.add_schedule", {}, "添加固定时间"),
					variant: "ghost",
					onClick: se
				}, null, 8, Io)]), s.value.schedules.length ? (Y(), X("div", Lo, [(Y(!0), X(q, null, or(s.value.schedules, (e, t) => (Y(), X("fieldset", {
					key: e.id,
					class: "gci-schedule-editor-row"
				}, [
					Z("legend", null, N(T("field.schedule", {}, "固定时间计划")) + " " + N(t + 1), 1),
					Z("div", Ro, [
						Z("label", zo, [Z("span", null, N(T("field.schedule_time", {}, "时间")), 1), Z("nxp-time-picker", {
							"model-value": e.time,
							"aria-label": `${T("field.schedule_time", {}, "时间")} ${t + 1}`,
							onChange: (t) => e.time = E(t)
						}, null, 40, Bo)]),
						Z("div", Vo, [Z("span", null, N(T("field.schedule_enabled", {}, "启用此时间")), 1), Z("nxp-switch", {
							class: "gci-toggle",
							"model-value": e.enabled,
							"aria-label": `${T("field.schedule_enabled", {}, "启用此时间")} ${t + 1}`,
							"semantic-role": "switch",
							onChange: (t) => e.enabled = E(t)
						}, null, 40, Ho)]),
						Z("nxp-button", {
							label: T("action.remove_schedule", {}, "移除时间"),
							tone: "danger",
							onClick: (e) => s.value.schedules.splice(t, 1)
						}, null, 8, Uo)
					]),
					Z("div", {
						class: "gci-days",
						role: "group",
						"aria-label": T("field.schedule_days", {}, "星期")
					}, [(Y(), X(q, null, or(f, (t) => Z("label", {
						key: t,
						class: "gci-day-choice"
					}, [Z("span", null, N(ue(t)), 1), Z("nxp-switch", {
						class: "gci-day-switch",
						"model-value": e.days.includes(t),
						"aria-label": `${T("field.schedule_days", {}, "星期")} ${ue(t)}`,
						"semantic-role": "switch",
						onChange: (n) => ce(e, t, E(n))
					}, null, 40, Go)])), 64))], 8, Wo)
				]))), 128))])) : (Y(), X("p", Ko, N(T("empty.schedules", {}, "未设置固定时间")), 1))]),
				Z("section", qo, [
					Z("div", Jo, [Z("div", null, [Z("h3", null, N(T("field.webhook", {}, "Webhook 通知")), 1), Z("p", null, N(T("editor.notification_hint", {}, "每种通知单独设置目标和凭据。")), 1)])]),
					Z("div", Yo, [Z("span", null, N(T("field.webhook_enabled", {}, "启用 Webhook")), 1), Z("nxp-switch", {
						class: "gci-toggle",
						"model-value": s.value.notifications.webhook.enabled,
						"aria-label": T("field.webhook_enabled", {}, "启用 Webhook"),
						"semantic-role": "switch",
						onChange: t[6] ||= (e) => s.value.notifications.webhook.enabled = E(e)
					}, null, 40, Xo)]),
					Z("div", Zo, [
						Z("label", Qo, [Z("span", null, N(T("field.webhook_type", {}, "Webhook 类型")), 1), Z("nxp-select", {
							"model-value": s.value.notifications.webhook.type,
							options: (n.value?.webhookTypes || [
								"generic",
								"feishu",
								"dingtalk",
								"wecom",
								"discord",
								"slack"
							]).map((e) => ({
								value: e,
								label: T(`channel.${e}`, {}, e)
							})),
							"aria-label": T("field.webhook_type", {}, "Webhook 类型"),
							onChange: t[7] ||= (e) => s.value.notifications.webhook.type = E(e)
						}, null, 40, $o)]),
						Z("div", es, [
							Z("label", ts, N(M("webhookUrl")), 1),
							Z("nxp-text-input", {
								id: "gci-webhook-url",
								"model-value": l.value.webhookUrl,
								type: "password",
								autocomplete: "new-password",
								placeholder: C.value ? T("field.secret_configured", {}, "已保存，留空保留") : "",
								"aria-label": M("webhookUrl"),
								onChange: t[8] ||= (e) => ne("webhookUrl", E(e))
							}, null, 40, ns),
							C.value ? (Y(), X("div", rs, [Z("span", null, N(T("field.secret_clear", {}, "清除已保存值")), 1), Z("nxp-switch", {
								class: "gci-clear-secret",
								"model-value": u.value.webhookUrl,
								"aria-label": `${M("webhookUrl")} · ${T("field.secret_clear", {}, "清除已保存值")}`,
								"semantic-role": "switch",
								onChange: t[9] ||= (e) => u.value.webhookUrl = E(e)
							}, null, 40, is)])) : Q("", !0)
						]),
						Z("div", as, [
							Z("label", os, N(M("webhookSecret")), 1),
							Z("nxp-text-input", {
								id: "gci-webhook-secret",
								"model-value": l.value.webhookSecret,
								type: "password",
								autocomplete: "new-password",
								placeholder: w.value ? T("field.secret_configured", {}, "已保存，留空保留") : "",
								"aria-label": M("webhookSecret"),
								onChange: t[10] ||= (e) => ne("webhookSecret", E(e))
							}, null, 40, ss),
							w.value ? (Y(), X("div", cs, [Z("span", null, N(T("field.secret_clear", {}, "清除已保存值")), 1), Z("nxp-switch", {
								class: "gci-clear-secret",
								"model-value": u.value.webhookSecret,
								"aria-label": `${M("webhookSecret")} · ${T("field.secret_clear", {}, "清除已保存值")}`,
								"semantic-role": "switch",
								onChange: t[11] ||= (e) => u.value.webhookSecret = E(e)
							}, null, 40, ls)])) : Q("", !0)
						]),
						s.value.notifications.webhook.type === "generic" ? (Y(), X("label", us, [
							Z("span", null, N(T("field.webhook_template", {}, "自定义 JSON 模板")), 1),
							Z("nxp-text-area", {
								"model-value": s.value.notifications.webhook.template,
								rows: "3",
								"aria-label": T("field.webhook_template", {}, "自定义 JSON 模板"),
								onChange: t[12] ||= (e) => s.value.notifications.webhook.template = E(e)
							}, null, 40, ds),
							Z("small", null, N(T("editor.template_hint", {}, "将 {text} 裸写在 JSON 值位置，不要加引号，以插入签到结果。")), 1)
						])) : Q("", !0)
					])
				]),
				Z("section", fs, [
					Z("div", ps, [Z("div", null, [Z("h3", null, N(T("field.smtp", {}, "SMTP 邮件通知")), 1), Z("p", null, N(T("editor.smtp_hint", {}, "SMTP 用户名和密码保存在当前任务的独立凭据中。")), 1)])]),
					Z("div", ms, [Z("span", null, N(T("field.smtp_enabled", {}, "启用 SMTP")), 1), Z("nxp-switch", {
						class: "gci-toggle",
						"model-value": s.value.notifications.smtp.enabled,
						"aria-label": T("field.smtp_enabled", {}, "启用 SMTP"),
						"semantic-role": "switch",
						onChange: t[13] ||= (e) => s.value.notifications.smtp.enabled = E(e)
					}, null, 40, hs)]),
					Z("div", gs, [
						Z("label", _s, [Z("span", null, N(T("field.smtp_host", {}, "SMTP 服务器")), 1), Z("nxp-text-input", {
							"model-value": s.value.notifications.smtp.host,
							autocomplete: "off",
							"aria-label": T("field.smtp_host", {}, "SMTP 服务器"),
							onChange: t[14] ||= (e) => s.value.notifications.smtp.host = E(e).trim()
						}, null, 40, vs)]),
						Z("label", ys, [Z("span", null, N(T("field.smtp_port", {}, "端口")), 1), Z("nxp-number-input", {
							"model-value": s.value.notifications.smtp.port,
							min: "1",
							max: "65535",
							"aria-label": T("field.smtp_port", {}, "端口"),
							onChange: t[15] ||= (e) => s.value.notifications.smtp.port = Number(E(e))
						}, null, 40, bs)]),
						Z("label", xs, [Z("span", null, N(T("field.smtp_secure", {}, "安全连接")), 1), Z("nxp-select", {
							"model-value": s.value.notifications.smtp.secure,
							options: _e(),
							"aria-label": T("field.smtp_secure", {}, "安全连接"),
							onChange: t[16] ||= (e) => s.value.notifications.smtp.secure = E(e)
						}, null, 40, Ss)]),
						Z("div", Cs, [
							Z("label", ws, N(M("smtpUser")), 1),
							Z("nxp-text-input", {
								id: "gci-smtp-user",
								"model-value": l.value.smtpUser,
								type: "password",
								autocomplete: "new-password",
								placeholder: ee.value ? T("field.secret_configured", {}, "已保存，留空保留") : "",
								"aria-label": M("smtpUser"),
								onChange: t[17] ||= (e) => ne("smtpUser", E(e))
							}, null, 40, Ts),
							ee.value ? (Y(), X("div", Es, [Z("span", null, N(T("field.secret_clear", {}, "清除已保存值")), 1), Z("nxp-switch", {
								class: "gci-clear-secret",
								"model-value": u.value.smtpUser,
								"aria-label": `${M("smtpUser")} · ${T("field.secret_clear", {}, "清除已保存值")}`,
								"semantic-role": "switch",
								onChange: t[18] ||= (e) => u.value.smtpUser = E(e)
							}, null, 40, Ds)])) : Q("", !0)
						]),
						Z("div", Os, [
							Z("label", ks, N(M("smtpPassword")), 1),
							Z("nxp-text-input", {
								id: "gci-smtp-password",
								"model-value": l.value.smtpPassword,
								type: "password",
								autocomplete: "new-password",
								placeholder: te.value ? T("field.secret_configured", {}, "已保存，留空保留") : "",
								"aria-label": M("smtpPassword"),
								onChange: t[19] ||= (e) => ne("smtpPassword", E(e))
							}, null, 40, As),
							te.value ? (Y(), X("div", js, [Z("span", null, N(T("field.secret_clear", {}, "清除已保存值")), 1), Z("nxp-switch", {
								class: "gci-clear-secret",
								"model-value": u.value.smtpPassword,
								"aria-label": `${M("smtpPassword")} · ${T("field.secret_clear", {}, "清除已保存值")}`,
								"semantic-role": "switch",
								onChange: t[20] ||= (e) => u.value.smtpPassword = E(e)
							}, null, 40, Ms)])) : Q("", !0)
						]),
						Z("label", Ns, [Z("span", null, N(T("field.smtp_from", {}, "发件人（可留空）")), 1), Z("nxp-text-input", {
							"model-value": s.value.notifications.smtp.from,
							autocomplete: "off",
							"aria-label": T("field.smtp_from", {}, "发件人（可留空）"),
							onChange: t[21] ||= (e) => s.value.notifications.smtp.from = E(e).trim()
						}, null, 40, Ps)]),
						Z("label", Fs, [
							Z("span", null, N(T("field.smtp_to", {}, "收件人")), 1),
							Z("nxp-text-input", {
								"model-value": s.value.notifications.smtp.to,
								autocomplete: "off",
								"aria-label": T("field.smtp_to", {}, "收件人"),
								onChange: t[22] ||= (e) => s.value.notifications.smtp.to = E(e).trim()
							}, null, 40, Is),
							Z("small", null, N(T("editor.recipient_hint", {}, "可使用逗号分隔多个收件人。")), 1)
						]),
						Z("label", Ls, [Z("span", null, N(T("field.smtp_subject", {}, "邮件主题前缀")), 1), Z("nxp-text-input", {
							"model-value": s.value.notifications.smtp.subjectPrefix,
							maxlength: "120",
							"aria-label": T("field.smtp_subject", {}, "邮件主题前缀"),
							onChange: t[23] ||= (e) => s.value.notifications.smtp.subjectPrefix = E(e).trim()
						}, null, 40, Rs)])
					])
				]),
				o.value ? (Y(), X("p", zs, N(o.value), 1)) : Q("", !0),
				Z("footer", Bs, [Z("nxp-button", {
					label: T("action.cancel", {}, "取消"),
					variant: "ghost",
					onClick: A
				}, null, 8, Vs), Z("nxp-button", {
					label: i.value ? T("status.saving", {}, "保存中…") : T("action.save", {}, "保存任务"),
					tone: "primary",
					disabled: i.value,
					onClick: ye
				}, null, 8, Hs)])
			], 32)) : Q("", !0),
			b.value.length ? (Y(), X("div", {
				key: 4,
				class: "gci-task-list",
				"aria-label": T("page.title", {}, "签到任务")
			}, [(Y(!0), X(q, null, or(b.value, (e) => (Y(), X("article", {
				key: e.id,
				class: "gci-task-card"
			}, [
				Z("header", Ws, [Z("div", Gs, [
					Z("h2", null, N(e.name), 1),
					Z("nxp-badge", {
						label: pe(e),
						tone: e.isRunning ? "blue" : e.recentRun?.status === "success" ? "ok" : e.recentRun?.status === "failed" ? "bad" : "muted"
					}, null, 8, Ks),
					Z("nxp-badge", {
						label: e.enabled ? T("status.enabled", {}, "已启用") : T("status.disabled", {}, "已停用"),
						tone: e.enabled ? "ok" : "muted"
					}, null, 8, qs)
				]), Z("div", Js, [
					Z("nxp-button", {
						label: T("action.run", {}, "立即签到"),
						tone: "primary",
						disabled: e.isRunning,
						onClick: (t) => be(e)
					}, null, 8, Ys),
					Z("nxp-button", {
						label: T("action.edit", {}, "编辑"),
						variant: "ghost",
						onClick: (t) => ie(e)
					}, null, 8, Xs),
					Z("nxp-button", {
						label: T("action.delete", {}, "删除任务"),
						tone: "danger",
						disabled: e.isRunning,
						onClick: (t) => P(e)
					}, null, 8, Zs)
				])]),
				Z("div", Qs, [Z("div", null, [Z("span", null, N(T("task.next_run", {}, "下次签到")), 1), Z("strong", null, N(fe(e.nextRunAt)), 1)]), Z("div", null, [Z("span", null, N(T("task.last_run", {}, "最近运行")), 1), Z("strong", null, N(fe(e.recentRun?.completedAt || e.recentRun?.startedAt)), 1)])]),
				Z("section", $s, [Z("h3", null, N(T("field.platform_games", {}, "签到平台与游戏")), 1), de(e).length ? (Y(), X("div", ec, [(Y(!0), X(q, null, or(de(e), (e) => (Y(), X("span", {
					key: e,
					class: "gci-tag"
				}, N(e), 1))), 128))])) : (Y(), X("p", tc, N(T("empty.games", {}, "未选择游戏")), 1))]),
				Z("section", nc, [Z("div", rc, [Z("h3", null, N(T("field.schedule", {}, "固定时间计划")), 1), Z("span", ic, N(T("page.timezone", { zone: n.value?.timeZoneId || "" }, `本机时区：${n.value?.timeZoneId || ""}`)), 1)]), e.schedules?.length ? (Y(), X("div", ac, [(Y(!0), X(q, null, or(e.schedules, (e) => (Y(), X("div", {
					key: e.id,
					class: "gci-schedule-row"
				}, [
					Z("span", oc, N(le(e.days)), 1),
					Z("strong", null, N(e.time), 1),
					Z("nxp-badge", {
						label: e.enabled ? T("status.enabled", {}, "已启用") : T("status.disabled", {}, "已停用"),
						tone: e.enabled ? "ok" : "muted"
					}, null, 8, sc)
				]))), 128))])) : (Y(), X("p", cc, N(T("empty.schedules", {}, "未设置固定时间")), 1))]),
				Z("details", lc, [Z("summary", null, [Fi(N(T("action.show_results", {}, "运行结果")) + " ", 1), Z("span", null, "(" + N(e.runs?.length || 0) + ")", 1)]), e.runs?.length ? (Y(), X("div", uc, [(Y(!0), X(q, null, or(e.runs, (e) => (Y(), X("section", {
					key: e.id,
					class: "gci-run-card"
				}, [Z("header", dc, [Z("div", null, [Z("strong", null, N(fe(e.startedAt)), 1), Z("span", null, N(T(`trigger.${e.trigger}`, {}, e.trigger)), 1)]), Z("nxp-badge", {
					label: T(`status.${e.status}`, {}, e.status),
					tone: e.status === "success" ? "ok" : e.status === "running" ? "blue" : e.status === "partial" ? "warn" : "bad"
				}, null, 8, fc)]), e.results?.length ? (Y(), X("ul", pc, [(Y(!0), X(q, null, or(e.results, (e, t) => (Y(), X("li", {
					key: `${e.platform}-${e.gameCode}-${t}`,
					class: j(e.success ? "is-success" : "is-failed")
				}, [Z("span", null, N(T(`platform.${e.platform}`, {}, e.platform)) + " · " + N(he(e.platform, e.gameCode)), 1), Z("strong", null, N(me(e)), 1)], 2))), 128))])) : (Y(), X("p", mc, N(T("task.no_results", {}, "没有运行结果")), 1))]))), 128))])) : (Y(), X("p", hc, N(T("task.no_results", {}, "没有运行结果")), 1))])
			]))), 128))], 8, Us)) : !r.value && !a.value ? (Y(), X("nxp-empty-state", {
				key: 5,
				title: T("empty.title", {}, "还没有签到任务"),
				description: T("empty.description", {}, "添加任务后，可设置游戏、固定时间和独立通知。")
			}, [Z("nxp-button", {
				label: T("action.add_task", {}, "添加签到任务"),
				tone: "primary",
				onClick: t[24] ||= (e) => ie()
			}, null, 8, _c)], 8, gc)) : Q("", !0)
		]));
	}
});
//#endregion
//#region src/main.ts
function yc(e) {
	let t = null, n = e.routes.register("tasks", (n, r, i) => {
		t?.unmount();
		let a = document.querySelector("#view");
		a && (t = Qa(vc, { host: i || e }), t.mount(a));
	}), r = e.nav.register({
		id: "check-in-tasks",
		title: e.i18n.t("nav.title", {}, "签到"),
		route: "tasks",
		icon: "✓",
		order: -100
	}), i = e.lifecycle.onDispose(() => {
		t?.unmount(), t = null;
	});
	return { dispose() {
		t?.unmount(), t = null, i?.dispose?.(), n?.dispose?.(), r?.dispose?.();
	} };
}
//#endregion
export { yc as activate };
