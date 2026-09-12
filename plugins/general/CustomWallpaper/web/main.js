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
}, ne = /-\w/g, T = te((e) => e.replace(ne, (e) => e.slice(1).toUpperCase())), re = /\B([A-Z])/g, E = te((e) => e.replace(re, "-$1").toLowerCase()), ie = te((e) => e.charAt(0).toUpperCase() + e.slice(1)), D = te((e) => e ? `on${ie(e)}` : ""), O = (e, t) => !Object.is(e, t), ae = (e, ...t) => {
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
var be = (e) => !!(e && e.__v_isRef === !0), j = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? be(e) ? j(e.value) : JSON.stringify(e, xe, 2) : String(e), xe = (e, t) => be(t) ? xe(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[Se(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => Se(e)) } : _(t) ? Se(t) : v(t) && !d(t) && !C(t) ? String(t) : t, Se = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e, M, Ce = class {
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
function we() {
	return M;
}
var N, Te = /* @__PURE__ */ new WeakSet(), Ee = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, M && (M.active ? M.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, Te.has(this) && (Te.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Ae(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, He(this), Ne(this);
		let e = N, t = P;
		N = this, P = !0;
		try {
			return this.fn();
		} finally {
			Pe(this), N = e, P = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Le(e);
			this.deps = this.depsTail = void 0, He(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? Te.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		Fe(this) && this.run();
	}
	get dirty() {
		return Fe(this);
	}
}, De = 0, Oe, ke;
function Ae(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = ke, ke = e;
		return;
	}
	e.next = Oe, Oe = e;
}
function je() {
	De++;
}
function Me() {
	if (--De > 0) return;
	if (ke) {
		let e = ke;
		for (ke = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; Oe;) {
		let t = Oe;
		for (Oe = void 0; t;) {
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
function Ne(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Pe(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), Le(r), Re(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function Fe(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (Ie(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function Ie(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ue) || (e.globalVersion = Ue, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Fe(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = N, r = P;
	N = e, P = !0;
	try {
		Ne(e);
		let n = e.fn(e._value);
		(t.version === 0 || O(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		N = n, P = r, Pe(e), e.flags &= -3;
	}
}
function Le(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) Le(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function Re(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var P = !0, ze = [];
function Be() {
	ze.push(P), P = !1;
}
function Ve() {
	let e = ze.pop();
	P = e === void 0 || e;
}
function He(e) {
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
var Ue = 0, We = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, Ge = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!N || !P || N === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== N) t = this.activeLink = new We(N, this), N.deps ? (t.prevDep = N.depsTail, N.depsTail.nextDep = t, N.depsTail = t) : N.deps = N.depsTail = t, Ke(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = N.depsTail, t.nextDep = void 0, N.depsTail.nextDep = t, N.depsTail = t, N.deps === t && (N.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, Ue++, this.notify(e);
	}
	notify(e) {
		je();
		try {
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			Me();
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
	if (P && N) {
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
	if (je(), t === "clear") o.forEach(s);
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
	Me();
}
function Qe(e) {
	let t = /* @__PURE__ */ R(e);
	return t === e ? t : (F(t, "iterate", Xe), /* @__PURE__ */ L(e) ? t : t.map(z));
}
function $e(e) {
	return F(e = /* @__PURE__ */ R(e), "iterate", Xe), e;
}
function I(e, t) {
	return /* @__PURE__ */ Ft(e) ? Rt(/* @__PURE__ */ Pt(e) ? z(t) : t) : z(t);
}
var et = {
	__proto__: null,
	[Symbol.iterator]() {
		return tt(this, Symbol.iterator, (e) => I(this, e));
	},
	concat(...e) {
		return Qe(this).concat(...e.map((e) => d(e) ? Qe(e) : e));
	},
	entries() {
		return tt(this, "entries", (e) => (e[1] = I(this, e[1]), e));
	},
	every(e, t) {
		return rt(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return rt(this, "filter", e, t, (e) => e.map((e) => I(this, e)), arguments);
	},
	find(e, t) {
		return rt(this, "find", e, t, (e) => I(this, e), arguments);
	},
	findIndex(e, t) {
		return rt(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return rt(this, "findLast", e, t, (e) => I(this, e), arguments);
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
		return Qe(this).join(e);
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
		return Qe(this).toReversed();
	},
	toSorted(e) {
		return Qe(this).toSorted(e);
	},
	toSpliced(...e) {
		return Qe(this).toSpliced(...e);
	},
	unshift(...e) {
		return ot(this, "unshift", e);
	},
	values() {
		return tt(this, "values", (e) => I(this, e));
	}
};
function tt(e, t, n) {
	let r = $e(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ L(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var nt = Array.prototype;
function rt(e, t, n, r, i, a) {
	let o = $e(e), s = o !== e && !/* @__PURE__ */ L(e), c = o[t];
	if (c !== nt[t]) {
		let t = c.apply(e, a);
		return s ? z(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, I(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function it(e, t, n, r) {
	let i = $e(e), a = i !== e && !/* @__PURE__ */ L(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = I(e, t)), n.call(this, t, I(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? I(e, c) : c;
}
function at(e, t, n) {
	let r = /* @__PURE__ */ R(e);
	F(r, "iterate", Xe);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ It(n[0]) ? (n[0] = /* @__PURE__ */ R(n[0]), r[t](...n)) : i;
}
function ot(e, t, n = []) {
	Be(), je();
	let r = (/* @__PURE__ */ R(e))[t].apply(e, n);
	return Me(), Ve(), r;
}
var st = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), ct = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function lt(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ R(this);
	return F(t, "has", e), t.hasOwnProperty(e);
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
		if ((_(t) ? ct.has(t) : st(t)) || (r || F(e, "get", t), i)) return o;
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
		return e === /* @__PURE__ */ R(r) && s && (o ? O(n, i) && Ze(e, "set", t, n, i) : Ze(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Ze(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !ct.has(t)) && F(e, "has", t), n;
	}
	ownKeys(e) {
		return F(e, "iterate", d(e) ? "length" : Je), Reflect.ownKeys(e);
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
function yt(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function bt(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ R(r), a = /* @__PURE__ */ R(n);
			e || (O(n, a) && F(i, "get", n), F(i, "get", a));
			let { has: o } = _t(i), s = t ? gt : e ? Rt : z;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && F(/* @__PURE__ */ R(t), "iterate", Je), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ R(n), i = /* @__PURE__ */ R(t);
			return e || (O(t, i) && F(r, "has", t), F(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ R(a), s = t ? gt : e ? Rt : z;
			return !e && F(o, "iterate", Je), a.forEach((e, t) => n.call(r, s(e), s(t), i));
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
			return r.has.call(n, a) || O(e, a) && r.has.call(n, e) || O(i, a) && r.has.call(n, i) || (n.add(a), Ze(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ L(n) && !/* @__PURE__ */ Ft(n) && (n = /* @__PURE__ */ R(n));
			let r = /* @__PURE__ */ R(this), { has: i, get: a } = _t(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ R(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? O(n, s) && Ze(r, "set", e, n, s) : Ze(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ R(this), { has: n, get: r } = _t(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ R(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Ze(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ R(this), t = e.size !== 0, n = e.clear();
			return t && Ze(e, "clear", void 0, void 0, void 0), n;
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
	return !u(e, "__v_skip") && Object.isExtensible(e) && k(e, "__v_skip", !0), e;
}
var z = (e) => v(e) ? /* @__PURE__ */ At(e) : e, Rt = (e) => v(e) ? /* @__PURE__ */ Mt(e) : e;
// @__NO_SIDE_EFFECTS__
function B(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function zt(e) {
	return Bt(e, !1);
}
function Bt(e, t) {
	return /* @__PURE__ */ B(e) ? e : new Vt(e, t);
}
var Vt = class {
	constructor(e, t) {
		this.dep = new Ge(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ R(e), this._value = t ? e : z(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ L(e) || /* @__PURE__ */ Ft(e);
		e = n ? e : /* @__PURE__ */ R(e), O(e, t) && (this._rawValue = e, this._value = n ? e : z(e), this.dep.trigger());
	}
};
function Ht(e) {
	return /* @__PURE__ */ B(e) ? e.value : e;
}
var Ut = {
	get: (e, t, n) => t === "__v_raw" ? e : Ht(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ B(i) && !/* @__PURE__ */ B(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Wt(e) {
	return /* @__PURE__ */ Pt(e) ? e : new Proxy(e, Ut);
}
var Gt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new Ge(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ue - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && N !== this) return Ae(this, !0), !0;
	}
	get value() {
		let e = this.dep.track();
		return Ie(this), e && (e.version = this.dep.version), this._value;
	}
	set value(e) {
		this.setter && this.setter(e);
	}
};
// @__NO_SIDE_EFFECTS__
function Kt(e, t, n = !1) {
	let r, i;
	return h(e) ? r = e : (r = e.get, i = e.set), new Gt(r, i, n);
}
var qt = {}, Jt = /* @__PURE__ */ new WeakMap(), Yt = void 0;
function Xt(e, t = !1, n = Yt) {
	if (n) {
		let t = Jt.get(n);
		t || Jt.set(n, t = []), t.push(e);
	}
}
function Zt(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ L(e) || o === !1 || o === 0 ? Qt(e, 1) : Qt(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ B(e) ? (g = () => e.value, y = /* @__PURE__ */ L(e)) : /* @__PURE__ */ Pt(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ Pt(e) || /* @__PURE__ */ L(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ B(e)) return e.value;
		if (/* @__PURE__ */ Pt(e)) return p(e);
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
		let t = Yt;
		Yt = m;
		try {
			return f ? f(e, 3, [v]) : e(v);
		} finally {
			Yt = t;
		}
	} : r, n && o) {
		let e = g, t = o === !0 ? Infinity : o;
		g = () => Qt(e(), t);
	}
	let x = we(), S = () => {
		m.stop(), x && x.active && c(x.effects, m);
	};
	if (s && n) {
		let e = n;
		n = (...t) => {
			let n = e(...t);
			return S(), n;
		};
	}
	let C = b ? Array(e.length).fill(qt) : qt, w = (e) => {
		if (m.flags & 1 && (m.dirty || e)) {
			if (n) {
				let t = m.run();
				if (e || o || y || (b ? t.some((e, t) => O(e, C[t])) : O(t, C))) {
					_ && _();
					let e = Yt;
					Yt = m;
					try {
						let e = [
							t,
							C === qt ? void 0 : b && C[0] === qt ? [] : C,
							v
						];
						C = t, f ? f(n, 3, e) : n(...e);
					} finally {
						Yt = e;
					}
				}
			} else m.run();
		}
	};
	return u && u(w), m = new Ee(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => Xt(e, !1, m), _ = m.onStop = () => {
		let e = Jt.get(m);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			Jt.delete(m);
		}
	}, n ? a ? w(!0) : C = m.run() : l ? l(w.bind(null, !0), !0) : m.run(), S.pause = m.pause.bind(m), S.resume = m.resume.bind(m), S.stop = S, S;
}
function Qt(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ B(e)) Qt(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) Qt(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		Qt(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) Qt(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && Qt(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
function $t(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		en(e, t, n);
	}
}
function V(e, t, n, r) {
	if (h(e)) {
		let i = $t(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			en(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(V(e[a], t, n, r));
		return i;
	}
}
function en(e, n, r, i = !0) {
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
			Be(), $t(o, null, 10, [
				e,
				i,
				a
			]), Ve();
			return;
		}
	}
	tn(e, r, a, i, s);
}
function tn(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var H = [], U = -1, nn = [], rn = null, an = 0, on = /* @__PURE__ */ Promise.resolve(), sn = null;
function cn(e) {
	let t = sn || on;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function ln(e) {
	let t = U + 1, n = H.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = H[r], a = hn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function un(e) {
	if (!(e.flags & 1)) {
		let t = hn(e), n = H[H.length - 1];
		!n || !(e.flags & 2) && t >= hn(n) ? H.push(e) : H.splice(ln(t), 0, e), e.flags |= 1, dn();
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
function pn(e, t, n = U + 1) {
	for (; n < H.length; n++) {
		let t = H[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			H.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
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
		for (U = 0; U < H.length; U++) {
			let e = H[U];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), $t(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; U < H.length; U++) {
			let e = H[U];
			e && (e.flags &= -2);
		}
		U = -1, H.length = 0, mn(e), sn = null, (H.length || nn.length) && gn(e);
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
		let i = vn(t), a = xi.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = xi.length; e > a; e--) Ci();
			vn(i), r._d && Ti(1);
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
		c && (Be(), V(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Ve());
	}
}
function xn(e, t) {
	if (Q) {
		let n = Q.provides, r = Q.parent && Q.parent.provides;
		r === n && (n = Q.provides = Object.create(r)), n[e] = t;
	}
}
function Sn(e, t, n = !1) {
	let r = Gi();
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
	if (Zi) {
		if (c === "sync") {
			let e = wn();
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
		K(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : un(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = Zt(e, n, u);
	return Zi && (f ? f.push(h) : d && h()), h;
}
function Dn(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? On(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = Ji(this), s = En(i, a.bind(r), n);
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
	let s = a.shapeFlag & 4 ? ia(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ R(v), b = v === t ? i : (e) => !Ln(_, e) && u(y, e), x = (e, t) => !(t && Ln(_, t));
	if (m != null && m !== p) {
		if (Bn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ B(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) $t(p, f, 12, [l, _]);
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
ce().requestIdleCallback, ce().cancelIdleCallback;
var Vn = (e) => !!e.type.__asyncLoader, Hn = (e) => e.type.__isKeepAlive;
function Un(e, t) {
	Gn(e, "a", t);
}
function Wn(e, t) {
	Gn(e, "da", t);
}
function Gn(e, t, n = Q) {
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
function qn(e, t, n = Q, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			Be();
			let i = Ji(n), a = V(t, n, e, r);
			return i(), Ve(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var Jn = (e) => (t, n = Q) => {
	(!Zi || e === "sp") && qn(e, (...e) => t(...e), n);
}, Yn = Jn("bm"), Xn = Jn("m"), Zn = Jn("bu"), Qn = Jn("u"), $n = Jn("bum"), er = Jn("um"), tr = Jn("sp"), nr = Jn("rtg"), rr = Jn("rtc");
function ir(e, t = Q) {
	qn("ec", e, t);
}
var ar = /* @__PURE__ */ Symbol.for("v-ndc");
function or(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ Pt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ L(e), s = /* @__PURE__ */ Ft(e), e = $e(e)), i = Array(e.length);
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
var sr = (e) => e ? Xi(e) ? ia(e) : sr(e.parent) : null, cr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
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
		un(e.update);
	},
	$nextTick: (e) => e.n ||= cn.bind(e.proxy),
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
		if (d) return n === "$attrs" && F(e.attrs, "get", ""), d(e);
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
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: y, deactivated: b, beforeDestroy: x, beforeUnmount: S, destroyed: C, unmounted: w, render: ee, renderTracked: te, renderTriggered: ne, errorCaptured: T, serverPrefetch: re, expose: E, inheritAttrs: ie, components: D, directives: O, filters: ae } = t;
	if (u && mr(u, i, null), s) for (let e in s) {
		let t = s[e];
		h(t) && (i[e] = t.bind(n));
	}
	if (a) {
		let t = a.call(n, n);
		v(t) && (e.data = /* @__PURE__ */ At(t));
	}
	if (fr = !0, o) for (let e in o) {
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
	if (c) for (let e in c) gr(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			xn(t, e[t]);
		});
	}
	f && hr(f, e, "c");
	function k(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (k(Yn, p), k(Xn, m), k(Zn, g), k(Qn, _), k(Un, y), k(Wn, b), k(ir, T), k(rr, te), k(nr, ne), k($n, S), k(er, w), k(tr, re), d(E)) {
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
	ee && e.render === r && (e.render = ee), ie != null && (e.inheritAttrs = ie), D && (e.components = D), O && (e.directives = O), re && In(e);
}
function mr(e, t, n = r) {
	d(e) && (e = Sr(e));
	for (let n in e) {
		let r = e[n], i;
		i = v(r) ? "default" in r ? Sn(r.from || n, r.default, !0) : Sn(r.from || n) : Sn(r), /* @__PURE__ */ B(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function hr(e, t, n) {
	V(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
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
					let u = l._ceVNode || Ni(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, ia(u.component);
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
var kr = null, Ar = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${T(t)}Modifiers`] || e[`${E(t)}Modifiers`];
function jr(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && Ar(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(oe)));
	let c, l = i[c = D(n)] || i[c = D(T(n))];
	!l && o && (l = i[c = D(E(n))]), l && V(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, V(u, e, 6, a);
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
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, E(t)) || u(e, t));
}
function Fr(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = vn(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = X(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = X(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Ir(c);
		}
	} catch (t) {
		xi.length = 0, en(t, e, 1), v = Ni(yi);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Lr(y, a)), b = Ii(b, y, !1, !0));
	}
	return n.dirs && (b = Ii(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Pn(An(b.type) && Nn(b) || b, n.transition), v = b, vn(_), v;
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
	return n === "style" && v(r) && v(i) ? !ye(r, i) : r !== i;
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
	e.props = n ? r ? i : /* @__PURE__ */ jt(i) : e.type.props ? i : a, e.attrs = a;
}
function Kr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ R(i), [c] = e.propsOptions, l = !1;
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
						let t = T(o);
						i[t] = Jr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		qr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = E(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Jr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && Ze(e.attrs, "set", "");
}
function qr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (ee(t)) continue;
		let l = n[t], d;
		a && u(a, d = T(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Pr(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ R(r), i = c || t;
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
		let n = T(c[e]);
		Zr(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = T(e);
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
var Qr = (e) => e === "_" || e === "_ctx" || e === "$stable", $r = (e) => d(e) ? e.map(X) : [X(e)], ei = (e, t, n) => {
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
		e ? (ri(r, t, n), n && k(r, "_", e, !0)) : ti(t, r);
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
	let a = ce();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !Ai(e, t) && (r = ve(e), A(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
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
				D(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? w(e, t, n, r, i, a, o, s, c) : d & 6 ? O(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, j);
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
				n && n._beginPatch(), re(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, te = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && T(e.children, d, null, r, i, ci(e, a), s, u), _ && bn(e, null, r, "created"), ne(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !ee(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && Z(f, r, e);
		}
		_ && bn(e, null, r, "beforeMount");
		let v = ui(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && K(() => {
			try {
				f && Z(f, r, e), v && g.enter(d), _ && bn(e, null, r, "mounted");
			} finally {}
		}, i);
	}, ne = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || gi(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				ne(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, T = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? zi(e[l]) : X(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, re = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && li(r, !1), (g = h.onVnodeBeforeUpdate) && Z(g, r, n, e), f && bn(n, e, r, "beforeUpdate"), r && li(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? E(e.dynamicChildren, d, l, r, i, ci(n, a), o) : s || ue(e, n, l, null, r, i, ci(n, a), o, !1), u > 0) {
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
			g && Z(g, r, n, e), f && bn(n, e, r, "updated");
		}, i);
	}, E = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === q || !Ai(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
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
	}, D = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), T(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (E(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && di(e, t, !0)) : ue(e, t, n, f, i, a, s, c, l);
	}, O = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : k(t, n, r, i, a, o, c) : oe(e, t, c);
	}, k = (e, t, n, r, i, a, o) => {
		let s = e.component = Wi(e, r, i);
		if (Hn(e) && (s.ctx.renderer = j), Qi(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, se, o), !e.el) {
				let r = s.subTree = Ni(yi);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else se(s, e, t, n, i, a, o);
	}, oe = (e, t, n) => {
		let r = t.component = e.component;
		if (Rr(e, t, n)) {
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
					let n = pi(e);
					if (n) {
						t && (t.el = c.el, le(e, t, o)), n.asyncDep.then(() => {
							K(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				li(e, !1), t ? (t.el = c.el, le(e, t, o)) : t = c, n && ae(n), (d = t.props && t.props.onVnodeBeforeUpdate) && Z(d, s, t, c), li(e, !0);
				let f = Fr(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), ve(p), e, i, a), t.el = f.el, u === null && Vr(e, f.el), r && K(r, i), (d = t.props && t.props.onVnodeUpdated) && K(() => Z(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Vn(t);
				if (li(e, !1), l && ae(l), !m && (o = c && c.onVnodeBeforeMount) && Z(o, d, t), li(e, !0), s && Se) {
					let t = () => {
						e.subTree = Fr(e), Se(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Fr(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && K(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					K(() => Z(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Vn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && K(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Ee(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => un(u), li(e, !0), l();
	}, le = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, Kr(e, t.props, r, n), ai(e, t.children, n), Be(), pn(e), Ve();
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
		m & 8 ? (u & 16 && _e(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? fe(l, d, n, r, i, a, o, s, c) : _e(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && T(d, n, r, i, a, o, s, c));
	}, de = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? zi(t[p]) : X(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? _e(e, a, o, !0, !1, f) : T(t, r, i, a, o, s, c, l, f);
	}, fe = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? zi(t[u]) : X(t[u]);
			if (Ai(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? zi(t[p]) : X(t[p]);
			if (Ai(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? zi(t[u]) : X(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) A(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? zi(t[u]) : X(t[u]);
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
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && Ai(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? A(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? fi(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || hi(f) : i;
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
			c.move(e, t, n, j);
			return;
		}
		if (c === q) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) pe(u[e], t, n, r);
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
	}, A = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (Be(), zn(s, null, n, e, !0), Ve()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Vn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && Z(_, t, e), u & 6) ge(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && bn(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, j, r) : l && !l.hasOnce && (a !== q || d > 0 && d & 64) ? _e(l, t, n, !1, !0) : (a === q && d & 384 || !i && u & 16) && _e(c, t, n), r && me(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && K(() => {
			_ && Z(_, t, e), h && bn(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, me = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === q) {
			he(n, r);
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
	}, he = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, ge = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		mi(c), mi(l), r && ae(r), i.stop(), a && (a.flags |= 8, A(o, e, t, n)), s && K(s, t), K(() => {
			e.isUnmounted = !0;
		}, t);
	}, _e = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) A(e[o], t, n, r, i);
	}, ve = (e) => {
		if (e.shapeFlag & 6) return ve(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[kn];
		return n ? h(n) : t;
	}, ye = !1, be = (e, t, n) => {
		let r;
		e == null ? t._vnode && (A(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, ye ||= (ye = !0, pn(r), mn(), !1);
	}, j = {
		p: v,
		um: A,
		m: pe,
		r: me,
		mt: k,
		mc: T,
		pc: ue,
		pbc: E,
		n: ve,
		o: e
	}, xe, Se;
	return i && ([xe, Se] = i(j)), {
		render: be,
		hydrate: xe,
		createApp: Or(be, xe)
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
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = zi(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && di(t, a)), a.type === vi && (a.patchFlag === -1 && (a = i[e] = zi(a)), a.el = t.el), a.type === yi && !a.el && (a.el = t.el);
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
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : fn(e);
}
var q = /* @__PURE__ */ Symbol.for("v-fgt"), vi = /* @__PURE__ */ Symbol.for("v-txt"), yi = /* @__PURE__ */ Symbol.for("v-cmt"), bi = /* @__PURE__ */ Symbol.for("v-stc"), xi = [], J = null;
function Si(e = !1) {
	xi.push(J = e ? null : []);
}
function Ci() {
	xi.pop(), J = xi[xi.length - 1] || null;
}
var wi = 1;
function Ti(e, t = !1) {
	wi += e, e < 0 && J && t && (J.hasOnce = !0);
}
function Ei(e) {
	return e.dynamicChildren = wi > 0 ? J || n : null, Ci(), wi > 0 && J && J.push(e), e;
}
function Di(e, t, n, r, i, a) {
	return Ei(Y(e, t, n, r, i, a, !0));
}
function Oi(e, t, n, r, i) {
	return Ei(Ni(e, t, n, r, i, !0));
}
function ki(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function Ai(e, t) {
	return e.type === t.type && e.key === t.key;
}
var ji = ({ key: e }) => e ?? null, Mi = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ B(e) || h(e) ? {
	i: W,
	r: e,
	k: t,
	f: !!n
} : e);
function Y(e, t = null, n = null, r = 0, i = null, a = e === q ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && ji(t),
		ref: t && Mi(t),
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
	return s ? (Bi(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), wi > 0 && !o && J && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && J.push(c), c;
}
var Ni = Pi;
function Pi(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === ar) && (e = yi), ki(e)) {
		let r = Ii(e, t, !0);
		return n && Bi(r, n), wi > 0 && !a && J && (r.shapeFlag & 6 ? J[J.indexOf(e)] = r : J.push(r)), r.patchFlag = -2, r;
	}
	if (aa(e) && (e = e.__vccOpts), t) {
		t = Fi(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = A(e)), v(n) && (/* @__PURE__ */ It(n) && !d(n) && (n = s({}, n)), t.style = le(n));
	}
	let o = g(e) ? 1 : gi(e) ? 128 : An(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return Y(e, t, n, r, i, o, a, !0);
}
function Fi(e) {
	return e ? /* @__PURE__ */ It(e) || Wr(e) ? s({}, e) : e : null;
}
function Ii(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? Vi(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && ji(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(Mi(t)) : [a, Mi(t)] : Mi(t) : a,
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
		ssContent: e.ssContent && Ii(e.ssContent),
		ssFallback: e.ssFallback && Ii(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && Pn(u, c.clone(u)), u;
}
function Li(e = " ", t = 0) {
	return Ni(vi, null, e, t);
}
function Ri(e = "", t = !1) {
	return t ? (Si(), Oi(yi, null, e)) : Ni(yi, null, e);
}
function X(e) {
	return e == null || typeof e == "boolean" ? Ni(yi) : d(e) ? Ni(q, null, e.slice()) : ki(e) ? zi(e) : Ni(vi, null, String(e));
}
function zi(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : Ii(e);
}
function Bi(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), Bi(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !Wr(t) ? t._ctx = W : r === 3 && W && (W.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			Bi(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: W
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Li(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function Vi(...e) {
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
function Z(e, t, n, r = null) {
	V(e, t, 7, [n, r]);
}
var Hi = Er(), Ui = 0;
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
		scope: new Ce(!0),
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
var Q = null, Gi = () => Q || W, Ki, qi;
{
	let e = ce(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	Ki = t("__VUE_INSTANCE_SETTERS__", (e) => Q = e), qi = t("__VUE_SSR_SETTERS__", (e) => Zi = e);
}
var Ji = (e) => {
	let t = Q;
	return Ki(e), e.scope.on(), () => {
		e.scope.off(), Ki(t);
	};
}, Yi = () => {
	Q && Q.scope.off(), Ki(null);
};
function Xi(e) {
	return e.vnode.shapeFlag & 4;
}
var Zi = !1;
function Qi(e, t = !1, n = !1) {
	t && qi(t);
	let { props: r, children: i } = e.vnode, a = Xi(e);
	Gr(e, r, a, t), ii(e, i, n || t);
	let o = a ? $i(e, t) : void 0;
	return t && qi(!1), o;
}
function $i(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, ur);
	let { setup: r } = n;
	if (r) {
		Be();
		let n = e.setupContext = r.length > 1 ? ra(e) : null, i = Ji(e), a = $t(r, e, 0, [e.props, n]), o = y(a);
		if (Ve(), i(), (o || e.sp) && !Vn(e) && In(e), o) {
			if (a.then(Yi, Yi), t) return a.then((n) => {
				qi(!0);
				try {
					ea(e, n, t);
				} finally {
					qi(!1);
				}
			}).catch((t) => {
				en(t, e, 0);
			});
			e.asyncDep = a;
		} else ea(e, a, t);
	} else ta(e, t);
}
function ea(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Wt(t)), ta(e, n);
}
function ta(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = Ji(e);
		Be();
		try {
			pr(e);
		} finally {
			Ve(), t();
		}
	}
}
var na = { get(e, t) {
	return F(e, "get", ""), e[t];
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
	return e.exposed ? e.exposeProxy ||= new Proxy(Wt(Lt(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in cr) return cr[n](e);
		},
		has(e, t) {
			return t in e || t in cr;
		}
	}) : e.proxy;
}
function aa(e) {
	return h(e) && "__vccOpts" in e;
}
var oa = (e, t) => /* @__PURE__ */ Kt(e, t, Zi), sa = "3.5.42", ca = void 0, la = typeof window < "u" && window.trustedTypes;
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
function Aa(e, t, n, r, i, a = he(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(ka, t.slice(6, t.length)) : e.setAttributeNS(ka, t, n) : n == null || a && !ge(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
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
		r === "boolean" ? n = ge(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
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
				e && V(e, t, 5, a);
			}
		} else V(r, t, 5, [e]);
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
var qa = [
	"ctrl",
	"shift",
	"alt",
	"meta"
], Ja = {
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
	exact: (e, t) => qa.some((n) => e[`${n}Key`] && !t.includes(n))
}, Ya = (e, t) => {
	if (!e) return e;
	let n = e._withMods ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n, ...r) => {
		for (let e = 0; e < t.length; e++) {
			let r = Ja[t[e]];
			if (r && r(n, t)) return;
		}
		return e(n, ...r);
	}));
}, Xa = /* @__PURE__ */ s({ patchProp: Wa }, ha), Za;
function Qa() {
	return Za ||= oi(Xa);
}
var $a = ((...e) => {
	let t = Qa().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = to(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, eo(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function eo(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function to(e) {
	return g(e) ? document.querySelector(e) : e;
}
//#endregion
//#region src/palette.ts
function $(e, t, n) {
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
		"--accent": $(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42),
		"--accent-strong": $(u, Math.max(52, Math.min(84, d + 25)), l ? 74 : 34),
		"--accent-alt": $((u + 32) % 360, 64, l ? 68 : 38),
		"--accent-soft": no(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42, l ? .2 : .18),
		"--on-accent": "#ffffff",
		"--mask": l ? "rgba(4, 10, 20, .44)" : "rgba(255, 255, 255, .42)",
		"--focus": `0 0 0 3px ${no(u, Math.max(48, Math.min(78, d + 18)), l ? 66 : 42, .32)}`,
		"--wallpaper-card-dark": $(u, f, 16),
		"--wallpaper-card-dark-soft": $(u, Math.min(36, f + 2), 21),
		"--wallpaper-card-dark-hover": $(u, Math.min(40, f + 5), 26),
		"--wallpaper-card-dark-border": no(u, Math.min(44, f + 10), 64, .32),
		"--wallpaper-card-light": $(u, f, 97),
		"--wallpaper-card-light-soft": $(u, Math.min(36, f + 2), 93),
		"--wallpaper-card-light-hover": $(u, Math.min(40, f + 5), 89),
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
async function fo(e, t, n) {
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
async function po(e, t, n) {
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
var mo = [
	"title",
	"description",
	"expanded"
], ho = { class: "cw-body" }, go = { class: "cw-status-row" }, _o = { class: "cw-muted" }, vo = ["tone", "label"], yo = [
	"label",
	"description",
	"model-value",
	"aria-label"
], bo = [
	"label",
	"description",
	"model-value",
	"aria-label"
], xo = { class: "cw-grid cw-controls" }, So = ["data-help"], Co = { class: "cw-field-label" }, wo = [
	"model-value",
	"options",
	"aria-label"
], To = ["data-help"], Eo = { class: "cw-field-label" }, Do = ["model-value", "aria-label"], Oo = { class: "cw-grid cw-effects" }, ko = ["data-help"], Ao = { class: "cw-field-label" }, jo = { class: "cw-range-row" }, Mo = ["model-value", "aria-label"], No = ["data-help"], Po = { class: "cw-field-label" }, Fo = { class: "cw-range-row" }, Io = ["model-value", "aria-label"], Lo = ["data-help"], Ro = { class: "cw-field-label" }, zo = { class: "cw-range-row" }, Bo = ["model-value", "aria-label"], Vo = { class: "cw-upload-row" }, Ho = ["label"], Uo = { class: "cw-muted" }, Wo = { class: "cw-list" }, Go = {
	key: 0,
	class: "cw-muted cw-empty"
}, Ko = ["onDrop"], qo = [
	"aria-label",
	"title",
	"onDragstart"
], Jo = ["src", "alt"], Yo = {
	key: 1,
	class: "cw-thumb-placeholder",
	"aria-hidden": "true"
}, Xo = { class: "cw-item-copy" }, Zo = { class: "cw-muted" }, Qo = ["label", "onClick"], $o = { class: "cw-card-footer" }, es = { class: "cw-muted" }, ts = {
	key: 0,
	class: "cw-error"
}, ns = "custom-wallpaper", rs = "nxp-settings-panel-toggle", is = "nxp-settings-panel-state", as = /* @__PURE__ */ Fn({
	__name: "WallpaperSettings",
	props: {
		host: {},
		runtime: {},
		context: {}
	},
	setup(e) {
		let t = e, n = t.runtime.snapshot(), r = /* @__PURE__ */ zt(n.state), i = /* @__PURE__ */ zt(n.error), a = /* @__PURE__ */ zt(!1), o = /* @__PURE__ */ zt(""), s = /* @__PURE__ */ zt(""), c = /* @__PURE__ */ zt(""), l = /* @__PURE__ */ zt({}), u = null, d = null, f = !1, p = oa(() => [
			{
				value: "timer",
				label: b("rotation.timer", {}, "按时间随机轮换")
			},
			{
				value: "startup",
				label: b("rotation.startup", {}, "每次启动 Web 随机轮换")
			},
			{
				value: "off",
				label: b("rotation.off", {}, "不轮换")
			}
		]), m = oa(() => {
			let e = r.value?.assets || [], t = new Map(e.map((e) => [e.id, e]));
			return [.../* @__PURE__ */ new Set([...r.value?.order || [], ...e.map((e) => e.id)])].map((e) => t.get(e)).filter((e) => !!e);
		}), h = oa(() => r.value?.enabled === !0), g = oa(() => r.value?.effects?.applyTransparencyToSecondarySurfaces !== !1), _ = oa(() => o.value ? o.value : i.value ? b("status.read_failed", {}, "读取失败") : r.value?.effectiveEnabled === !0 ? b("status.enabled", {}, "已启用") : b("status.disabled", {}, "未启用")), v = oa(() => o.value ? "blue" : i.value ? "bad" : r.value?.effectiveEnabled === !0 ? "ok" : "muted"), y = oa(() => s.value || i.value);
		function b(e, n = {}, r = "") {
			return t.host.i18n.t(e, n, r);
		}
		function x(e, t, n) {
			let r = e?.code || "", i = {
				invalid_type: b("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"),
				too_large: b("error.size", {}, "壁纸文件不能超过 8192 KB"),
				quota_count: b("error.count", {}, "壁纸数量不能超过 32 张"),
				quota_total: b("error.total", {}, "壁纸总容量不能超过 256 MiB"),
				invalid_image: b("error.image", {}, "壁纸文件内容与声明类型不匹配"),
				invalid_config: b("error.config", {}, "壁纸设置无效"),
				invalid_asset: b("error.asset", {}, "壁纸资源无效"),
				not_found: b("error.not_found", {}, "壁纸资源不存在"),
				invalid_palette: b("error.palette", {}, "壁纸配色无效")
			};
			return i[r] ? i[r] : r ? b("error.generic", { code: r }, `操作失败：${r}`) : b(t, {}, n);
		}
		function S(e) {
			let t = Number(e) || 0;
			return t < 1048576 ? `${Math.max(1, Math.round(t / 1024))} KiB` : `${(t / 1024 / 1024).toFixed(1)} MiB`;
		}
		function C(e) {
			window.dispatchEvent(new CustomEvent(rs, { detail: { panelId: e } }));
		}
		function w(e) {
			a.value = e, C(e ? ns : null);
		}
		function ee(e) {
			let t = e.detail?.panelId;
			(t === null || typeof t == "string") && (a.value = t === ns);
		}
		function te(e) {
			f || (r.value = e.state, i.value = e.error);
		}
		async function ne(e = []) {
			let t = new Set(e);
			Object.entries(l.value).forEach(([e, n]) => {
				t.has(e) || (URL.revokeObjectURL(n), delete l.value[e]);
			});
		}
		async function T(e) {
			await ne(e.map((e) => e.id));
			for (let n of e) if (!l.value[n.id]) try {
				let e = await oo(t.host, n.id);
				if (f) return;
				l.value = {
					...l.value,
					[n.id]: URL.createObjectURL(e)
				};
			} catch {}
		}
		function re(e, n) {
			r.value &&= n(r.value), u && clearTimeout(u), u = setTimeout(() => {
				u = null, (async () => {
					o.value = b("status.saving", {}, "保存中");
					try {
						let n = await co(t.host, e);
						if (f) return;
						await t.runtime.apply(n);
					} catch (e) {
						s.value = x(e, "status.save_failed", "保存失败"), await t.runtime.refresh();
					} finally {
						o.value = "";
					}
				})();
			}, 0);
		}
		function E() {
			let e = r.value || {};
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
		function ie(e) {
			if (!r.value) return;
			if (e === "enabled") {
				let e = !h.value;
				re({
					enabled: e,
					rotation: E().rotation
				}, (t) => ({
					...t,
					enabled: e,
					effectiveEnabled: e && (t.order?.length || 0) > 0
				}));
				return;
			}
			let t = !g.value;
			re({ effects: {
				...E().effects,
				applyTransparencyToSecondarySurfaces: t
			} }, (e) => ({
				...e,
				effects: {
					...e.effects || {},
					applyTransparencyToSecondarySurfaces: t
				}
			}));
		}
		function D(e, t) {
			if (!r.value) return;
			let n = E();
			e === "mode" && (n.rotation.mode = String(t), n.rotation.epochUnixMs = Date.now()), e === "interval" && (n.rotation.intervalMinutes = Number(t) || 30), e === "blur" && (n.effects.blurPx = Number(t) || 0), e === "dim" && (n.effects.dimPercent = Number(t) || 0), e === "transparency" && (n.effects.surfaceTransparencyPercent = Number(t) || 0), re(n, (e) => ({
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
		async function O(e = []) {
			for (let n of e) {
				let e = r.value?.limits || {}, i = Number(e.maxAssets) || 32, a = Number(e.maxAssetBytes) || 8388608;
				if ((r.value?.assets?.length || 0) >= i) {
					t.host.ui.toast(b("error.count", {}, "壁纸数量不能超过 32 张"), "error");
					break;
				}
				if (![
					"image/jpeg",
					"image/png",
					"image/webp"
				].includes(String(n.type).toLowerCase())) {
					t.host.ui.toast(b("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"), "error");
					continue;
				}
				if (n.size > a) {
					t.host.ui.toast(b("error.size", {}, "壁纸文件不能超过 8192 KB"), "error");
					continue;
				}
				try {
					let e = await createImageBitmap(n), r = e.height > e.width;
					e.close?.(), r && t.host.ui.toast(b("warning.portrait", {}, "该图片可能在电脑上显示效果不佳"), "warn");
				} catch {}
				try {
					o.value = b("status.uploading", { name: n.name }, `上传中：${n.name}`);
					let e = await fo(t.host, n);
					if (f) return;
					if (e.asset) try {
						await po(t.host, e.asset, n);
					} catch (e) {
						t.host.ui.toast(b("warning.palette", { error: e instanceof Error ? e.message : String(e) }, "壁纸已上传，配色稍后生成"), "warn");
					}
					await t.runtime.refresh(), await T(r.value?.assets || []);
				} catch (e) {
					s.value = x(e, "status.upload_failed", "上传失败");
				} finally {
					o.value = "";
				}
			}
		}
		async function ae(e) {
			try {
				let n = await lo(t.host, e);
				if (f) return;
				let r = l.value[e];
				r && (URL.revokeObjectURL(r), delete l.value[e]), await t.runtime.apply(n);
			} catch (e) {
				s.value = x(e, "status.delete_failed", "删除失败");
			}
		}
		function k(e) {
			if (!c.value || c.value === e || !r.value) return;
			let t = m.value.map((e) => e.id).filter((e) => e !== c.value), n = t.indexOf(e);
			t.splice(n < 0 ? t.length : n, 0, c.value), c.value = "", re({ order: t }, (e) => ({
				...e,
				order: t
			}));
		}
		return Xn(async () => {
			window.addEventListener(is, ee), d = t.runtime.subscribe(te), te(t.runtime.snapshot()), await T(r.value?.assets || []);
		}), $n(() => {
			f = !0, window.removeEventListener(is, ee), d?.(), d = null, u && clearTimeout(u), u = null, Object.values(l.value).forEach((e) => URL.revokeObjectURL(e)), l.value = {};
		}), (e, t) => (Si(), Di("nxp-collapsible-card", {
			title: b("card.title", {}, "自定义壁纸"),
			description: b("card.description", {}, "同步壁纸、轮换方式和显示效果"),
			expanded: a.value,
			"panel-id": "settings-panel-custom-wallpaper",
			"data-settings-panel": "custom-wallpaper",
			"data-testid": "custom-wallpaper-card",
			onToggle: t[10] ||= (e) => w(e.detail?.[0] === !0)
		}, [Y("div", ho, [
			Y("div", go, [Y("span", _o, j(b("settings.sync", {}, "服务端同步到当前 NexusPipeline 实例的全部浏览器。")), 1), Y("nxp-badge", {
				tone: v.value,
				label: _.value
			}, null, 8, vo)]),
			Y("nxp-switch-list", null, [Y("nxp-switch-setting", {
				label: b("settings.enabled", {}, "启用自定义壁纸"),
				description: b("settings.enabled_help", {}, "启用后使用自定义壁纸作为页面背景。"),
				"model-value": h.value,
				"aria-label": b("settings.enabled", {}, "启用自定义壁纸"),
				onChange: t[0] ||= (e) => ie("enabled")
			}, null, 40, yo), Y("nxp-switch-setting", {
				label: b("settings.secondary", {}, "透明度运用于非主页面"),
				description: b("settings.secondary_help", {}, "关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。"),
				"model-value": g.value,
				"aria-label": b("settings.secondary", {}, "透明度运用于非主页面"),
				onChange: t[1] ||= (e) => ie("secondary")
			}, null, 40, bo)]),
			Y("div", xo, [Y("label", {
				class: "cw-field",
				"data-help": b("settings.rotation_help", {}, "按时间随机轮换会按设定间隔切换壁纸；每次启动 Web 随机轮换只在服务启动后选择一次。")
			}, [Y("span", Co, j(b("settings.rotation", {}, "轮换方式")), 1), Y("nxp-select", {
				"model-value": r.value?.rotation?.mode || "off",
				options: p.value,
				"aria-label": b("settings.rotation", {}, "轮换方式"),
				onChange: t[2] ||= (e) => D("mode", e.detail?.[0] || e.target?.modelValue || "off")
			}, null, 40, wo)], 8, So), Y("label", {
				class: "cw-field",
				"data-help": b("settings.interval_help", {}, "轮换方式为按时间随机轮换时生效，范围为 1 至 1440 分钟。")
			}, [Y("span", Eo, j(b("settings.interval", {}, "轮换间隔（分钟）")), 1), Y("nxp-number-input", {
				"model-value": r.value?.rotation?.intervalMinutes || 30,
				min: "1",
				max: "1440",
				step: "1",
				"aria-label": b("settings.interval", {}, "轮换间隔（分钟）"),
				onChange: t[3] ||= (e) => D("interval", e.detail?.[0] || e.target?.modelValue)
			}, null, 40, Do)], 8, To)]),
			Y("div", Oo, [
				Y("label", {
					class: "cw-field",
					"data-help": b("settings.blur_help", {}, "模糊范围为 0 至 40 像素。")
				}, [Y("span", Ao, j(b("settings.blur", {}, "模糊（像素）")), 1), Y("span", jo, [Y("nxp-range", {
					"model-value": r.value?.effects?.blurPx || 0,
					min: "0",
					max: "40",
					step: "1",
					"aria-label": b("settings.blur", {}, "模糊（像素）"),
					onChange: t[4] ||= (e) => D("blur", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Mo), Y("output", null, j(r.value?.effects?.blurPx || 0) + "px", 1)])], 8, ko),
				Y("label", {
					class: "cw-field",
					"data-help": b("settings.dim_help", {}, "变暗范围为 0 至 80%，用于调整壁纸与内容的对比度。")
				}, [Y("span", Po, j(b("settings.dim", {}, "变暗")), 1), Y("span", Fo, [Y("nxp-range", {
					"model-value": r.value?.effects?.dimPercent ?? 20,
					min: "0",
					max: "80",
					step: "1",
					"aria-label": b("settings.dim", {}, "变暗"),
					onChange: t[5] ||= (e) => D("dim", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Io), Y("output", null, j(r.value?.effects?.dimPercent ?? 20) + "%", 1)])], 8, No),
				Y("label", {
					class: "cw-field",
					"data-help": b("settings.transparency_help", {}, "控制页面卡片、侧边栏和其他表面的透明度，范围为 0 至 50%。")
				}, [Y("span", Ro, j(b("settings.transparency", {}, "卡片与侧边栏透明度")), 1), Y("span", zo, [Y("nxp-range", {
					"model-value": r.value?.effects?.surfaceTransparencyPercent || 0,
					min: "0",
					max: "50",
					step: "1",
					"aria-label": b("settings.transparency", {}, "卡片与侧边栏透明度"),
					onChange: t[6] ||= (e) => D("transparency", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Bo), Y("output", null, j(r.value?.effects?.surfaceTransparencyPercent || 0) + "%", 1)])], 8, Lo)
			]),
			Y("div", Vo, [Y("nxp-file-picker", {
				accept: "image/jpeg,image/png,image/webp",
				multiple: "",
				label: b("settings.add", {}, "添加壁纸"),
				onChange: t[7] ||= (e) => O(e.detail?.[0] || e.target?.files || [])
			}, null, 40, Ho), Y("span", Uo, j(b("settings.file_help", {}, "JPEG、PNG、WebP，单张最大 8192 KB")), 1)]),
			Y("div", Wo, [m.value.length ? Ri("", !0) : (Si(), Di("p", Go, j(b("empty", {}, "尚未添加壁纸。")), 1)), (Si(!0), Di(q, null, or(m.value, (e) => (Si(), Di("div", {
				key: e.id,
				class: A(["cw-item", { "is-dragging": c.value === e.id }]),
				onDragover: t[9] ||= Ya(() => {}, ["prevent"]),
				onDrop: (t) => k(e.id)
			}, [
				Y("button", {
					class: "cw-drag-handle",
					type: "button",
					draggable: "true",
					"aria-label": `${b("drag", {}, "拖拽排序")}：${e.originalName || e.id}`,
					title: b("drag", {}, "拖拽排序"),
					onDragstart: Ya((t) => c.value = e.id, ["stop"]),
					onDragend: t[8] ||= (e) => c.value = ""
				}, "⠿", 40, qo),
				l.value[e.id] ? (Si(), Di("img", {
					key: 0,
					src: l.value[e.id],
					alt: e.originalName || e.id
				}, null, 8, Jo)) : (Si(), Di("span", Yo)),
				Y("div", Xo, [Y("strong", null, j(e.originalName || e.id), 1), Y("span", Zo, j(S(e.sizeBytes)), 1)]),
				Y("nxp-button", {
					tone: "danger",
					variant: "ghost",
					size: "sm",
					label: b("remove", {}, "删除"),
					onClick: (t) => ae(e.id)
				}, null, 8, Qo)
			], 42, Ko))), 128))]),
			Y("div", $o, [Y("span", es, j(b("settings.max_help", {}, "最多 32 张，实例总容量 256 MiB。")), 1)]),
			y.value ? (Si(), Di("p", ts, j(y.value), 1)) : Ri("", !0)
		])], 40, mo));
	}
});
//#endregion
//#region src/wallpaperRuntime.ts
function os(e) {
	return !e?.effectiveEnabled || !e.currentId ? null : (e.assets || []).find((t) => t.id === e.currentId) || null;
}
function ss(e, t) {
	return e?.effects?.blurPx !== t?.effects?.blurPx || e?.effects?.dimPercent !== t?.effects?.dimPercent || e?.effects?.surfaceTransparencyPercent !== t?.effects?.surfaceTransparencyPercent || e?.effects?.applyTransparencyToSecondarySurfaces !== t?.effects?.applyTransparencyToSecondarySurfaces;
}
function cs(e, t) {
	return e?.revision !== t?.revision || e?.currentId !== t?.currentId || e?.effectiveEnabled !== t?.effectiveEnabled || ss(e, t);
}
function ls(e, t = {}) {
	let n = Math.max(1e3, Number(t.pollIntervalMs) || 3e4), r = /* @__PURE__ */ new Set(), i = null, a = "", o = null, s = null, c = null, l = 0, u = !1;
	function d() {
		return {
			state: i,
			error: a
		};
	}
	function f(e, t = "") {
		i = e, a = t;
		let n = d();
		r.forEach((e) => {
			try {
				e(n);
			} catch {}
		});
	}
	function p() {
		o && clearTimeout(o), o = null;
	}
	function m(e) {
		p();
		let t = e?.rotation?.nextSwitchAt;
		if (e?.rotation?.mode !== "timer" || !t) return;
		let n = Math.max(1e3, new Date(t).getTime() - Date.now());
		o = setTimeout(() => {
			o = null, _();
		}, n);
	}
	async function h(t, n) {
		if (u || (f(t), !n)) return;
		let r = ++l;
		p();
		let i = os(t);
		if (!i) {
			e.appearance.clearBackground(), e.appearance.clearTokens();
			return;
		}
		try {
			let n = await oo(e, i.id);
			if (u || r !== l) return;
			e.appearance.setBackground({
				url: URL.createObjectURL(n),
				blurPx: t?.effects?.blurPx,
				dimPercent: t?.effects?.dimPercent,
				surfaceTransparencyPercent: t?.effects?.surfaceTransparencyPercent,
				secondarySurfaceTransparency: t?.effects?.applyTransparencyToSecondarySurfaces !== !1
			});
			let a = await po(e, i, n);
			if (u || r !== l) return;
			a && e.appearance.setTokens(a), m(t);
		} catch (e) {
			if (u || r !== l) return;
			f(t, e instanceof Error ? e.message : String(e));
		}
	}
	async function g(t) {
		if (!u) try {
			let n = await so(e);
			if (u) return;
			await h(n, t || cs(i, n));
		} catch (e) {
			if (u) return;
			f(i, e instanceof Error ? e.message : String(e));
		}
	}
	async function _() {
		return c || (c = g(!1).finally(() => {
			c = null;
		}), c);
	}
	return {
		snapshot: d,
		async start() {
			u || (await g(!0), !(u || s) && (s = setInterval(() => {
				_();
			}, n)));
		},
		refresh: _,
		async apply(e) {
			await h(e, !0);
		},
		subscribe(e) {
			return r.add(e), () => r.delete(e);
		},
		dispose() {
			u || (u = !0, l += 1, p(), s && clearInterval(s), s = null, r.clear(), e.appearance.clearBackground(), e.appearance.clearTokens(), i = null, a = "");
		}
	};
}
//#endregion
//#region src/main.ts
function us(e) {
	let t = ls(e);
	t.start();
	let n = e.slots.register("settings.cards", (n) => {
		let r = $a(as, {
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
export { us as activate };
