//#region ../../../../node_modules/@vue/shared/dist/shared.esm-bundler.js
// @__NO_SIDE_EFFECTS__
function e(e) {
	let t = /* @__PURE__ */ Object.create(null);
	for (let n of e.split(",")) t[n] = 1;
	return (e) => e in t;
}
var t = process.env.NODE_ENV === "production" ? {} : Object.freeze({}), n = process.env.NODE_ENV === "production" ? [] : Object.freeze([]), r = () => {}, i = () => !1, a = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), o = (e) => e.startsWith("onUpdate:"), s = Object.assign, c = (e, t) => {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, T = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), ee = /* @__PURE__ */ e("bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"), te = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, ne = /-\w/g, E = te((e) => e.replace(ne, (e) => e.slice(1).toUpperCase())), re = /\B([A-Z])/g, D = te((e) => e.replace(re, "-$1").toLowerCase()), ie = te((e) => e.charAt(0).toUpperCase() + e.slice(1)), ae = te((e) => e ? `on${ie(e)}` : ""), O = (e, t) => !Object.is(e, t), oe = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, se = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, k = (e) => {
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
function he(e) {
	let t = "";
	if (g(e)) t = e;
	else if (d(e)) for (let n = 0; n < e.length; n++) {
		let r = he(e[n]);
		r && (t += r + " ");
	}
	else if (v(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
var ge = "html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot", _e = "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view", ve = "annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics", ye = /* @__PURE__ */ e(ge), be = /* @__PURE__ */ e(_e), xe = /* @__PURE__ */ e(ve), Se = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", Ce = /* @__PURE__ */ e(Se);
Se + "";
function we(e) {
	return !!e || e === "";
}
function Te(e, t) {
	if (e.length !== t.length) return !1;
	let n = !0;
	for (let r = 0; n && r < e.length; r++) n = De(e[r], t[r]);
	return n;
}
function Ee(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && De(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function De(e, t) {
	if (e === t) return !0;
	let n = m(e), r = m(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = _(e), r = _(t), n || r) return e === t;
	if (n = d(e), r = d(t), n || r) return n && r ? Te(e, t) : !1;
	if (n = v(e), r = v(t), n || r) {
		if (!n || !r) return !1;
		if (n = f(e), r = f(t), n || r || (n = p(e), r = p(t), n || r)) return n && r ? Ee(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !De(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
var Oe = (e) => !!(e && e.__v_isRef === !0), ke = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? Oe(e) ? ke(e.value) : JSON.stringify(e, Ae, 2) : String(e), Ae = (e, t) => Oe(t) ? Ae(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[je(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => je(e)) } : _(t) ? je(t) : v(t) && !d(t) && !C(t) ? String(t) : t, je = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e;
//#endregion
//#region ../../../../node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js
function A(e, ...t) {
	console.warn(`[Vue warn] ${e}`, ...t);
}
var j, Me = class {
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
		} else process.env.NODE_ENV !== "production" && this._warnOnRun && A("cannot run an inactive effect scope.");
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
function Ne() {
	return j;
}
var M, Pe = /* @__PURE__ */ new WeakSet(), Fe = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, j && (j.active ? j.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, Pe.has(this) && (Pe.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || ze(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, Ye(this), He(this);
		let e = M, t = N;
		M = this, N = !0;
		try {
			return this.fn();
		} finally {
			process.env.NODE_ENV !== "production" && M !== this && A("Active effect was not restored correctly - this is likely a Vue internal bug."), Ue(this), M = e, N = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Ke(e);
			this.deps = this.depsTail = void 0, Ye(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? Pe.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		We(this) && this.run();
	}
	get dirty() {
		return We(this);
	}
}, Ie = 0, Le, Re;
function ze(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = Re, Re = e;
		return;
	}
	e.next = Le, Le = e;
}
function Be() {
	Ie++;
}
function Ve() {
	if (--Ie > 0) return;
	if (Re) {
		let e = Re;
		for (Re = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; Le;) {
		let t = Le;
		for (Le = void 0; t;) {
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
function He(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Ue(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), Ke(r), qe(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function We(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (Ge(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function Ge(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Xe) || (e.globalVersion = Xe, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !We(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = M, r = N;
	M = e, N = !0;
	try {
		He(e);
		let n = e.fn(e._value);
		(t.version === 0 || O(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		M = n, N = r, Ue(e), e.flags &= -3;
	}
}
function Ke(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), process.env.NODE_ENV !== "production" && n.subsHead === e && (n.subsHead = i), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) Ke(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function qe(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var N = !0, Je = [];
function P() {
	Je.push(N), N = !1;
}
function F() {
	let e = Je.pop();
	N = e === void 0 || e;
}
function Ye(e) {
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
var Xe = 0, Ze = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, Qe = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0, process.env.NODE_ENV !== "production" && (this.subsHead = void 0);
	}
	track(e) {
		if (!M || !N || M === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== M) t = this.activeLink = new Ze(M, this), M.deps ? (t.prevDep = M.depsTail, M.depsTail.nextDep = t, M.depsTail = t) : M.deps = M.depsTail = t, $e(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = M.depsTail, t.nextDep = void 0, M.depsTail.nextDep = t, M.depsTail = t, M.deps === t && (M.deps = e);
		}
		return process.env.NODE_ENV !== "production" && M.onTrack && M.onTrack(s({ effect: M }, e)), t;
	}
	trigger(e) {
		this.version++, Xe++, this.notify(e);
	}
	notify(e) {
		Be();
		try {
			if (process.env.NODE_ENV !== "production") for (let t = this.subsHead; t; t = t.nextSub) t.sub.onTrigger && !(t.sub.flags & 8) && t.sub.onTrigger(s({ effect: t.sub }, e));
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			Ve();
		}
	}
};
function $e(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) $e(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), process.env.NODE_ENV !== "production" && e.dep.subsHead === void 0 && (e.dep.subsHead = e), e.dep.subs = e;
	}
}
var et = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Object iterate"), nt = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Map keys iterate"), rt = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Array iterate");
function I(e, t, n) {
	if (N && M) {
		let r = et.get(e);
		r || et.set(e, r = /* @__PURE__ */ new Map());
		let i = r.get(n);
		i || (r.set(n, i = new Qe()), i.map = r, i.key = n), process.env.NODE_ENV === "production" ? i.track() : i.track({
			target: e,
			type: t,
			key: n
		});
	}
}
function it(e, t, n, r, i, a) {
	let o = et.get(e);
	if (!o) {
		Xe++;
		return;
	}
	let s = (o) => {
		o && (process.env.NODE_ENV === "production" ? o.trigger() : o.trigger({
			target: e,
			type: t,
			key: n,
			newValue: r,
			oldValue: i,
			oldTarget: a
		}));
	};
	if (Be(), t === "clear") o.forEach(s);
	else {
		let i = d(e), a = i && w(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === rt || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(rt)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(tt)), f(e) && s(o.get(nt)));
				break;
			case "delete":
				i || (s(o.get(tt)), f(e) && s(o.get(nt)));
				break;
			case "set": f(e) && s(o.get(tt));
		}
	}
	Ve();
}
function at(e) {
	let t = /* @__PURE__ */ B(e);
	return t === e ? t : (I(t, "iterate", rt), /* @__PURE__ */ z(e) ? t : t.map(Jt));
}
function ot(e) {
	return I(e = /* @__PURE__ */ B(e), "iterate", rt), e;
}
function L(e, t) {
	return /* @__PURE__ */ Gt(e) ? Yt(/* @__PURE__ */ Wt(e) ? Jt(t) : t) : Jt(t);
}
var st = {
	__proto__: null,
	[Symbol.iterator]() {
		return ct(this, Symbol.iterator, (e) => L(this, e));
	},
	concat(...e) {
		return at(this).concat(...e.map((e) => d(e) ? at(e) : e));
	},
	entries() {
		return ct(this, "entries", (e) => (e[1] = L(this, e[1]), e));
	},
	every(e, t) {
		return ut(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return ut(this, "filter", e, t, (e) => e.map((e) => L(this, e)), arguments);
	},
	find(e, t) {
		return ut(this, "find", e, t, (e) => L(this, e), arguments);
	},
	findIndex(e, t) {
		return ut(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return ut(this, "findLast", e, t, (e) => L(this, e), arguments);
	},
	findLastIndex(e, t) {
		return ut(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return ut(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return ft(this, "includes", e);
	},
	indexOf(...e) {
		return ft(this, "indexOf", e);
	},
	join(e) {
		return at(this).join(e);
	},
	lastIndexOf(...e) {
		return ft(this, "lastIndexOf", e);
	},
	map(e, t) {
		return ut(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return pt(this, "pop");
	},
	push(...e) {
		return pt(this, "push", e);
	},
	reduce(e, ...t) {
		return dt(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return dt(this, "reduceRight", e, t);
	},
	shift() {
		return pt(this, "shift");
	},
	some(e, t) {
		return ut(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return pt(this, "splice", e);
	},
	toReversed() {
		return at(this).toReversed();
	},
	toSorted(e) {
		return at(this).toSorted(e);
	},
	toSpliced(...e) {
		return at(this).toSpliced(...e);
	},
	unshift(...e) {
		return pt(this, "unshift", e);
	},
	values() {
		return ct(this, "values", (e) => L(this, e));
	}
};
function ct(e, t, n) {
	let r = ot(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ z(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var lt = Array.prototype;
function ut(e, t, n, r, i, a) {
	let o = ot(e), s = o !== e && !/* @__PURE__ */ z(e), c = o[t];
	if (c !== lt[t]) {
		let t = c.apply(e, a);
		return s ? Jt(t) : t;
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
function dt(e, t, n, r) {
	let i = ot(e), a = i !== e && !/* @__PURE__ */ z(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = L(e, t)), n.call(this, t, L(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? L(e, c) : c;
}
function ft(e, t, n) {
	let r = /* @__PURE__ */ B(e);
	I(r, "iterate", rt);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Kt(n[0]) ? (n[0] = /* @__PURE__ */ B(n[0]), r[t](...n)) : i;
}
function pt(e, t, n = []) {
	P(), Be();
	let r = (/* @__PURE__ */ B(e))[t].apply(e, n);
	return Ve(), F(), r;
}
var mt = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), ht = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function gt(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ B(this);
	return I(t, "has", e), t.hasOwnProperty(e);
}
var _t = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Rt : Lt : i ? It : Ft).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = st[t])) return e;
			if (t === "hasOwnProperty") return gt;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ V(e) ? e : n);
		if ((_(t) ? ht.has(t) : mt(t)) || (r || I(e, "get", t), i)) return o;
		if (/* @__PURE__ */ V(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ Ht(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ Ht(o) : /* @__PURE__ */ Bt(o) : o;
	}
}, vt = class extends _t {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let r = /* @__PURE__ */ Gt(i);
			if (!/* @__PURE__ */ z(n) && !/* @__PURE__ */ Gt(n) && (i = /* @__PURE__ */ B(i), n = /* @__PURE__ */ B(n)), !a && /* @__PURE__ */ V(i) && !/* @__PURE__ */ V(n)) return r ? (process.env.NODE_ENV !== "production" && A(`Set operation on key "${String(t)}" failed: target is readonly.`, e[t]), !0) : (i.value = n, !0);
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ V(e) ? e : r);
		return e === /* @__PURE__ */ B(r) && s && (o ? O(n, i) && it(e, "set", t, n, i) : it(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && it(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !ht.has(t)) && I(e, "has", t), n;
	}
	ownKeys(e) {
		return I(e, "iterate", d(e) ? "length" : tt), Reflect.ownKeys(e);
	}
}, yt = class extends _t {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return process.env.NODE_ENV !== "production" && A(`Set operation on key "${String(t)}" failed: target is readonly.`, e), !0;
	}
	deleteProperty(e, t) {
		return process.env.NODE_ENV !== "production" && A(`Delete operation on key "${String(t)}" failed: target is readonly.`, e), !0;
	}
}, bt = /* @__PURE__ */ new vt(), xt = /* @__PURE__ */ new yt(), St = /* @__PURE__ */ new vt(!0), Ct = /* @__PURE__ */ new yt(!0), wt = (e) => e, Tt = (e) => Reflect.getPrototypeOf(e);
function Et(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ B(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? wt : t ? Yt : Jt;
		return !t && I(a, "iterate", l ? nt : tt), s(Object.create(u), { next() {
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
function Dt(e) {
	return function(...t) {
		if (process.env.NODE_ENV !== "production") {
			let n = t[0] ? `on key "${t[0]}" ` : "";
			A(`${ie(e)} operation ${n}failed: target is readonly.`, /* @__PURE__ */ B(this));
		}
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function Ot(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ B(r), a = /* @__PURE__ */ B(n);
			e || (O(n, a) && I(i, "get", n), I(i, "get", a));
			let { has: o } = Tt(i), s = t ? wt : e ? Yt : Jt;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && I(/* @__PURE__ */ B(t), "iterate", tt), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ B(n), i = /* @__PURE__ */ B(t);
			return e || (O(t, i) && I(r, "has", t), I(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ B(a), s = t ? wt : e ? Yt : Jt;
			return !e && I(o, "iterate", tt), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: Dt("add"),
		set: Dt("set"),
		delete: Dt("delete"),
		clear: Dt("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ B(this), r = Tt(n), i = /* @__PURE__ */ B(e), a = !t && !/* @__PURE__ */ z(e) && !/* @__PURE__ */ Gt(e) ? i : e;
			return r.has.call(n, a) || O(e, a) && r.has.call(n, e) || O(i, a) && r.has.call(n, i) || (n.add(a), it(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ z(n) && !/* @__PURE__ */ Gt(n) && (n = /* @__PURE__ */ B(n));
			let r = /* @__PURE__ */ B(this), { has: i, get: a } = Tt(r), o = i.call(r, e);
			o ? process.env.NODE_ENV !== "production" && Pt(r, i, e) : (e = /* @__PURE__ */ B(e), o = i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? O(n, s) && it(r, "set", e, n, s) : it(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ B(this), { has: n, get: r } = Tt(t), i = n.call(t, e);
			i ? process.env.NODE_ENV !== "production" && Pt(t, n, e) : (e = /* @__PURE__ */ B(e), i = n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && it(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ B(this), t = e.size !== 0, n = process.env.NODE_ENV === "production" ? void 0 : f(e) ? new Map(e) : new Set(e), r = e.clear();
			return t && it(e, "clear", void 0, void 0, n), r;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = Et(r, e, t);
	}), n;
}
function kt(e, t) {
	let n = Ot(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var At = { get: /* @__PURE__ */ kt(!1, !1) }, jt = { get: /* @__PURE__ */ kt(!1, !0) }, Mt = { get: /* @__PURE__ */ kt(!0, !1) }, Nt = { get: /* @__PURE__ */ kt(!0, !0) };
function Pt(e, t, n) {
	let r = /* @__PURE__ */ B(n);
	if (r !== n && t.call(e, r)) {
		let t = S(e);
		A(`Reactive ${t} contains both the raw and reactive versions of the same object${t === "Map" ? " as keys" : ""}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
	}
}
var Ft = /* @__PURE__ */ new WeakMap(), It = /* @__PURE__ */ new WeakMap(), Lt = /* @__PURE__ */ new WeakMap(), Rt = /* @__PURE__ */ new WeakMap();
function zt(e) {
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
function Bt(e) {
	return /* @__PURE__ */ Gt(e) ? e : Ut(e, !1, bt, At, Ft);
}
// @__NO_SIDE_EFFECTS__
function Vt(e) {
	return Ut(e, !1, St, jt, It);
}
// @__NO_SIDE_EFFECTS__
function Ht(e) {
	return Ut(e, !0, xt, Mt, Lt);
}
// @__NO_SIDE_EFFECTS__
function R(e) {
	return Ut(e, !0, Ct, Nt, Rt);
}
function Ut(e, t, n, r, i) {
	if (!v(e)) return process.env.NODE_ENV !== "production" && A(`value cannot be made ${t ? "readonly" : "reactive"}: ${String(e)}`), e;
	if (e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = zt(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function Wt(e) {
	return /* @__PURE__ */ Gt(e) ? /* @__PURE__ */ Wt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Gt(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function z(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Kt(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function B(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ B(t) : e;
}
function qt(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && se(e, "__v_skip", !0), e;
}
var Jt = (e) => v(e) ? /* @__PURE__ */ Bt(e) : e, Yt = (e) => v(e) ? /* @__PURE__ */ Ht(e) : e;
// @__NO_SIDE_EFFECTS__
function V(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Xt(e) {
	return Zt(e, !1);
}
function Zt(e, t) {
	return /* @__PURE__ */ V(e) ? e : new Qt(e, t);
}
var Qt = class {
	constructor(e, t) {
		this.dep = new Qe(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ B(e), this._value = t ? e : Jt(e), this.__v_isShallow = t;
	}
	get value() {
		return process.env.NODE_ENV === "production" ? this.dep.track() : this.dep.track({
			target: this,
			type: "get",
			key: "value"
		}), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ z(e) || /* @__PURE__ */ Gt(e);
		e = n ? e : /* @__PURE__ */ B(e), O(e, t) && (this._rawValue = e, this._value = n ? e : Jt(e), process.env.NODE_ENV === "production" ? this.dep.trigger() : this.dep.trigger({
			target: this,
			type: "set",
			key: "value",
			newValue: e,
			oldValue: t
		}));
	}
};
function $t(e) {
	return /* @__PURE__ */ V(e) ? e.value : e;
}
var en = {
	get: (e, t, n) => t === "__v_raw" ? e : $t(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ V(i) && !/* @__PURE__ */ V(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function tn(e) {
	return /* @__PURE__ */ Wt(e) ? e : new Proxy(e, en);
}
var nn = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new Qe(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Xe - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && M !== this) return ze(this, !0), !0;
		process.env.NODE_ENV;
	}
	get value() {
		let e = process.env.NODE_ENV === "production" ? this.dep.track() : this.dep.track({
			target: this,
			type: "get",
			key: "value"
		});
		return Ge(this), e && (e.version = this.dep.version), this._value;
	}
	set value(e) {
		this.setter ? this.setter(e) : process.env.NODE_ENV !== "production" && A("Write operation failed: computed value is readonly");
	}
};
// @__NO_SIDE_EFFECTS__
function rn(e, t, n = !1) {
	let r, i;
	h(e) ? r = e : (r = e.get, i = e.set);
	let a = new nn(r, i, n);
	return process.env.NODE_ENV !== "production" && t && !n && (a.onTrack = t.onTrack, a.onTrigger = t.onTrigger), a;
}
var an = {}, on = /* @__PURE__ */ new WeakMap(), sn = void 0;
function cn(e, t = !1, n = sn) {
	if (n) {
		let t = on.get(n);
		t || on.set(n, t = []), t.push(e);
	} else process.env.NODE_ENV !== "production" && !t && A("onWatcherCleanup() was called when there was no active watcher to associate with.");
}
function ln(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => {
		(i.onWarn || A)("Invalid watch source: ", e, "A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.");
	}, m = (e) => o ? e : /* @__PURE__ */ z(e) || o === !1 || o === 0 ? un(e, 1) : un(e), g, _, v, y, b = !1, x = !1;
	if (/* @__PURE__ */ V(e) ? (_ = () => e.value, b = /* @__PURE__ */ z(e)) : /* @__PURE__ */ Wt(e) ? (_ = () => m(e), b = !0) : d(e) ? (x = !0, b = e.some((e) => /* @__PURE__ */ Wt(e) || /* @__PURE__ */ z(e)), _ = () => e.map((e) => {
		if (/* @__PURE__ */ V(e)) return e.value;
		if (/* @__PURE__ */ Wt(e)) return m(e);
		if (h(e)) return f ? f(e, 2) : e();
		process.env.NODE_ENV !== "production" && p(e);
	})) : h(e) ? _ = n ? f ? () => f(e, 2) : e : () => {
		if (v) {
			P();
			try {
				v();
			} finally {
				F();
			}
		}
		let t = sn;
		sn = g;
		try {
			return f ? f(e, 3, [y]) : e(y);
		} finally {
			sn = t;
		}
	} : (_ = r, process.env.NODE_ENV !== "production" && p(e)), n && o) {
		let e = _, t = o === !0 ? Infinity : o;
		_ = () => un(e(), t);
	}
	let S = Ne(), C = () => {
		g.stop(), S && S.active && c(S.effects, g);
	};
	if (s && n) {
		let e = n;
		n = (...t) => {
			let n = e(...t);
			return C(), n;
		};
	}
	let w = x ? Array(e.length).fill(an) : an, T = (e) => {
		if (g.flags & 1 && (g.dirty || e)) {
			if (n) {
				let t = g.run();
				if (e || o || b || (x ? t.some((e, t) => O(e, w[t])) : O(t, w))) {
					v && v();
					let e = sn;
					sn = g;
					try {
						let e = [
							t,
							w === an ? void 0 : x && w[0] === an ? [] : w,
							y
						];
						w = t, f ? f(n, 3, e) : n(...e);
					} finally {
						sn = e;
					}
				}
			} else g.run();
		}
	};
	return u && u(T), g = new Fe(_), g.scheduler = l ? () => l(T, !1) : T, y = (e) => cn(e, !1, g), v = g.onStop = () => {
		let e = on.get(g);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			on.delete(g);
		}
	}, process.env.NODE_ENV !== "production" && (g.onTrack = i.onTrack, g.onTrigger = i.onTrigger), n ? a ? T(!0) : w = g.run() : l ? l(T.bind(null, !0), !0) : g.run(), C.pause = g.pause.bind(g), C.resume = g.resume.bind(g), C.stop = C, C;
}
function un(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ V(e)) un(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) un(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		un(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) un(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && un(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
var dn = [];
function fn(e) {
	dn.push(e);
}
function pn() {
	dn.pop();
}
var mn = !1;
function H(e, ...t) {
	if (mn) return;
	mn = !0, P();
	let n = dn.length ? dn[dn.length - 1].component : null, r = n && n.appContext.config.warnHandler, i = hn();
	if (r) xn(r, n, 11, [
		e + t.map((e) => e.toString?.call(e) ?? JSON.stringify(e)).join(""),
		n && n.proxy,
		i.map(({ vnode: e }) => `at <${Vo(n, e.type)}>`).join("\n"),
		i
	]);
	else {
		let n = [`[Vue warn]: ${e}`, ...t];
		i.length && n.push("\n", ...gn(i)), console.warn(...n);
	}
	F(), mn = !1;
}
function hn() {
	let e = dn[dn.length - 1];
	if (!e) return [];
	let t = [];
	for (; e;) {
		let n = t[0];
		n && n.vnode === e ? n.recurseCount++ : t.push({
			vnode: e,
			recurseCount: 0
		});
		let r = e.component && e.component.parent;
		e = r && r.vnode;
	}
	return t;
}
function gn(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push(...n === 0 ? [] : ["\n"], ..._n(e));
	}), t;
}
function _n({ vnode: e, recurseCount: t }) {
	let n = t > 0 ? `... (${t} recursive calls)` : "", r = e.component ? e.component.parent == null : !1, i = ` at <${Vo(e.component, e.type, r)}`, a = ">" + n;
	return e.props ? [
		i,
		...vn(e.props),
		a
	] : [i + a];
}
function vn(e) {
	let t = [], n = Object.keys(e);
	return n.slice(0, 3).forEach((n) => {
		t.push(...yn(n, e[n]));
	}), n.length > 3 && t.push(" ..."), t;
}
function yn(e, t, n) {
	return g(t) ? (t = JSON.stringify(t), n ? t : [`${e}=${t}`]) : typeof t == "number" || typeof t == "boolean" || t == null ? n ? t : [`${e}=${t}`] : /* @__PURE__ */ V(t) ? (t = yn(e, /* @__PURE__ */ B(t.value), !0), n ? t : [
		`${e}=Ref<`,
		t,
		">"
	]) : h(t) ? [`${e}=fn${t.name ? `<${t.name}>` : ""}`] : (t = /* @__PURE__ */ B(t), n ? t : [`${e}=`, t]);
}
var bn = {
	sp: "serverPrefetch hook",
	bc: "beforeCreate hook",
	c: "created hook",
	bm: "beforeMount hook",
	m: "mounted hook",
	bu: "beforeUpdate hook",
	u: "updated",
	bum: "beforeUnmount hook",
	um: "unmounted hook",
	a: "activated hook",
	da: "deactivated hook",
	ec: "errorCaptured hook",
	rtc: "renderTracked hook",
	rtg: "renderTriggered hook",
	0: "setup function",
	1: "render function",
	2: "watcher getter",
	3: "watcher callback",
	4: "watcher cleanup function",
	5: "native event handler",
	6: "component event handler",
	7: "vnode hook",
	8: "directive hook",
	9: "transition hook",
	10: "app errorHandler",
	11: "app warnHandler",
	12: "ref function",
	13: "async component loader",
	14: "scheduler flush",
	15: "component update",
	16: "app unmount cleanup function"
};
function xn(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		Sn(e, t, n);
	}
}
function U(e, t, n, r) {
	if (h(e)) {
		let i = xn(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			Sn(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(U(e[a], t, n, r));
		return i;
	}
	process.env.NODE_ENV !== "production" && H(`Invalid value type passed to callWithAsyncErrorHandling(): ${typeof e}`);
}
function Sn(e, n, r, i = !0) {
	let a = n ? n.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: s } = n && n.appContext.config || t;
	if (n) {
		let t = n.parent, i = n.proxy, a = process.env.NODE_ENV === "production" ? `https://vuejs.org/error-reference/#runtime-${r}` : bn[r];
		for (; t;) {
			let n = t.ec;
			if (n) {
				for (let t = 0; t < n.length; t++) if (n[t](e, i, a) === !1) return;
			}
			t = t.parent;
		}
		if (o) {
			P(), xn(o, null, 10, [
				e,
				i,
				a
			]), F();
			return;
		}
	}
	Cn(e, r, a, i, s);
}
function Cn(e, t, n, r = !0, i = !1) {
	if (process.env.NODE_ENV !== "production") {
		let i = bn[t];
		if (n && fn(n), H(`Unhandled error${i ? ` during execution of ${i}` : ""}`), n && pn(), r) throw e;
		console.error(e);
	} else if (i) throw e;
	else console.error(e);
}
var W = [], G = -1, wn = [], Tn = null, En = 0, Dn = /* @__PURE__ */ Promise.resolve(), On = null, kn = 100;
function An(e) {
	let t = On || Dn;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function jn(e) {
	let t = G + 1, n = W.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = W[r], a = Ln(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function Mn(e) {
	if (!(e.flags & 1)) {
		let t = Ln(e), n = W[W.length - 1];
		!n || !(e.flags & 2) && t >= Ln(n) ? W.push(e) : W.splice(jn(t), 0, e), e.flags |= 1, Nn();
	}
}
function Nn() {
	On ||= Dn.then(Rn);
}
function Pn(e) {
	if (!d(e)) Tn && e.id === -1 ? Tn.splice(En + 1, 0, e) : e.flags & 1 || (wn.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) wn.push(e[t]);
	Nn();
}
function Fn(e, t, n = G + 1) {
	for (process.env.NODE_ENV !== "production" && (t ||= /* @__PURE__ */ new Map()); n < W.length; n++) {
		let r = W[n];
		if (r && r.flags & 2) {
			if (e && r.id !== e.uid || process.env.NODE_ENV !== "production" && zn(t, r)) continue;
			W.splice(n, 1), n--, r.flags & 4 && (r.flags &= -2), r(), r.flags & 4 || (r.flags &= -2);
		}
	}
}
function In(e) {
	if (wn.length) {
		let t = [...new Set(wn)].sort((e, t) => Ln(e) - Ln(t));
		if (wn.length = 0, Tn) {
			for (let e = 0; e < t.length; e++) Tn.push(t[e]);
			return;
		}
		for (Tn = t, process.env.NODE_ENV !== "production" && (e ||= /* @__PURE__ */ new Map()), En = 0; En < Tn.length; En++) {
			let t = Tn[En];
			process.env.NODE_ENV !== "production" && zn(e, t) || (t.flags & 4 && (t.flags &= -2), t.flags & 8 || t(), t.flags &= -2);
		}
		Tn = null, En = 0;
	}
}
var Ln = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function Rn(e) {
	process.env.NODE_ENV !== "production" && (e ||= /* @__PURE__ */ new Map());
	let t = process.env.NODE_ENV === "production" ? r : (t) => zn(e, t);
	try {
		for (G = 0; G < W.length; G++) {
			let e = W[G];
			if (e && !(e.flags & 8)) {
				if (process.env.NODE_ENV !== "production" && t(e)) continue;
				e.flags & 4 && (e.flags &= -2), xn(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2);
			}
		}
	} finally {
		for (; G < W.length; G++) {
			let e = W[G];
			e && (e.flags &= -2);
		}
		G = -1, W.length = 0, In(e), On = null, (W.length || wn.length) && Rn(e);
	}
}
function zn(e, t) {
	let n = e.get(t) || 0;
	if (n > kn) {
		let e = t.i, n = e && Bo(e.type);
		return Sn(`Maximum recursive updates exceeded${n ? ` in component <${n}>` : ""}. This means you have a reactive effect that is mutating its own dependencies and thus recursively triggering itself. Possible sources include component template, render function, updated hook or watcher source function.`, null, 10), !0;
	}
	return e.set(t, n + 1), !1;
}
var K = !1, Bn = (e) => {
	try {
		return K;
	} finally {
		K = e;
	}
}, Vn = /* @__PURE__ */ new Map();
process.env.NODE_ENV !== "production" && (le().__VUE_HMR_RUNTIME__ = {
	createRecord: Xn(Gn),
	rerender: Xn(qn),
	reload: Xn(Jn)
});
var Hn = /* @__PURE__ */ new Map();
function Un(e) {
	let t = e.type.__hmrId, n = Hn.get(t);
	n ||= (Gn(t, e.type), Hn.get(t)), n.instances.add(e);
}
function Wn(e) {
	Hn.get(e.type.__hmrId).instances.delete(e);
}
function Gn(e, t) {
	return !Hn.has(e) && (Hn.set(e, {
		initialDef: Kn(t),
		instances: /* @__PURE__ */ new Set()
	}), !0);
}
function Kn(e) {
	return Ho(e) ? e.__vccOpts : e;
}
function qn(e, t) {
	let n = Hn.get(e);
	n && (n.initialDef.render = t, [...n.instances].forEach((e) => {
		t && (e.render = t, Kn(e.type).render = t), e.renderCache = [], K = !0, e.job.flags & 8 || e.update(), K = !1;
	}));
}
function Jn(e, t) {
	let n = Hn.get(e);
	if (!n) return;
	t = Kn(t), Yn(n.initialDef, t);
	let r = [...n.instances];
	for (let e = 0; e < r.length; e++) {
		let i = r[e], a = Kn(i.type), o = Vn.get(a);
		o || (a !== n.initialDef && Yn(a, t), Vn.set(a, o = /* @__PURE__ */ new Set())), o.add(i), i.appContext.propsCache.delete(i.type), i.appContext.emitsCache.delete(i.type), i.appContext.optionsCache.delete(i.type), i.ceReload ? (o.add(i), i.ceReload(t.styles), o.delete(i)) : i.parent ? Mn(() => {
			i.job.flags & 8 || (K = !0, i.parent.update(), K = !1, o.delete(i));
		}) : i.appContext.reload ? i.appContext.reload() : typeof window < "u" ? window.location.reload() : console.warn("[HMR] Root or manually mounted instance modified. Full reload required."), i.root.ce && i !== i.root && i.root.ce._removeChildStyle(a);
	}
	Pn(() => {
		Vn.clear();
	});
}
function Yn(e, t) {
	s(e, t);
	for (let n in e) n !== "__file" && !(n in t) && delete e[n];
}
function Xn(e) {
	return (t, n) => {
		try {
			return e(t, n);
		} catch (e) {
			console.error(e), console.warn("[HMR] Something went wrong during Vue component hot-reload. Full reload required.");
		}
	};
}
var Zn, Qn = [], $n = !1;
function er(e, ...t) {
	Zn ? Zn.emit(e, ...t) : $n || Qn.push({
		event: e,
		args: t
	});
}
function tr(e, t) {
	Zn = e, Zn ? (Zn.enabled = !0, Qn.forEach(({ event: e, args: t }) => Zn.emit(e, ...t)), Qn = []) : typeof window < "u" && window.HTMLElement && !(window.navigator?.userAgent)?.includes("jsdom") ? ((t.__VUE_DEVTOOLS_HOOK_REPLAY__ = t.__VUE_DEVTOOLS_HOOK_REPLAY__ || []).push((e) => {
		tr(e, t);
	}), setTimeout(() => {
		Zn || (t.__VUE_DEVTOOLS_HOOK_REPLAY__ = null, $n = !0, Qn = []);
	}, 3e3)) : ($n = !0, Qn = []);
}
function nr(e, t) {
	er("app:init", e, t, {
		Fragment: Ua,
		Text: Wa,
		Comment: X,
		Static: Ga
	});
}
function rr(e) {
	er("app:unmount", e);
}
var ir = /* @__PURE__ */ cr("component:added"), ar = /* @__PURE__ */ cr("component:updated"), or = /* @__PURE__ */ cr("component:removed"), sr = (e) => {
	Zn && typeof Zn.cleanupBuffer == "function" && !Zn.cleanupBuffer(e) && or(e);
};
// @__NO_SIDE_EFFECTS__
function cr(e) {
	return (t) => {
		er(e, t.appContext.app, t.uid, t.parent ? t.parent.uid : void 0, t);
	};
}
var lr = /* @__PURE__ */ dr("perf:start"), ur = /* @__PURE__ */ dr("perf:end");
function dr(e) {
	return (t, n, r) => {
		er(e, t.appContext.app, t.uid, t, n, r);
	};
}
function fr(e, t, n) {
	er("component:emit", e.appContext.app, e, t, n);
}
var q = null, pr = null;
function mr(e) {
	let t = q;
	return q = e, pr = e && e.type.__scopeId || null, t;
}
function hr(e, t = q, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && Xa(-1);
		let i = mr(t), a = Ka.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = Ka.length; e > a; e--) Ja();
			mr(i), r._d && Xa(1);
		}
		return process.env.NODE_ENV !== "production" && ar(t), o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function gr(e) {
	ee(e) && H("Do not use built-in directive ids as custom directive id: " + e);
}
function _r(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (P(), U(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), F());
	}
}
function vr(e, t) {
	if (process.env.NODE_ENV !== "production" && (!$ || $.isMounted) && H("provide() can only be used inside setup()."), $) {
		let n = $.provides, r = $.parent && $.parent.provides;
		r === n && (n = $.provides = Object.create(r)), n[e] = t;
	}
}
function yr(e, t, n = !1) {
	let r = bo();
	if (r || Ni) {
		let i = Ni ? Ni._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
		process.env.NODE_ENV !== "production" && H(`injection "${String(e)}" not found.`);
	} else process.env.NODE_ENV !== "production" && H("inject() can only be used inside setup() or functional components.");
}
var br = /* @__PURE__ */ Symbol.for("v-scx"), xr = () => {
	{
		let e = yr(br);
		return e || process.env.NODE_ENV !== "production" && H("Server rendering context not provided. Make sure to only call useSSRContext() conditionally in the server build."), e;
	}
};
function Sr(e, t, n) {
	return process.env.NODE_ENV !== "production" && !h(t) && H("`watch(fn, options?)` signature has been moved to a separate API. Use `watchEffect(fn, options?)` instead. `watch` now only supports `watch(source, cb, options?) signature."), Cr(e, t, n);
}
function Cr(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i;
	process.env.NODE_ENV !== "production" && !n && (a !== void 0 && H("watch() \"immediate\" option is only respected when using the watch(source, callback, options?) signature."), o !== void 0 && H("watch() \"deep\" option is only respected when using the watch(source, callback, options?) signature."), l !== void 0 && H("watch() \"once\" option is only respected when using the watch(source, callback, options?) signature."));
	let u = s({}, i);
	process.env.NODE_ENV !== "production" && (u.onWarn = H);
	let d = n && a || !n && c !== "post", f;
	if (Oo) {
		if (c === "sync") {
			let e = xr();
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
		Y(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : Mn(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = ln(e, n, u);
	return Oo && (f ? f.push(h) : d && h()), h;
}
function wr(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? Tr(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = Co(this), s = Cr(i, a.bind(r), n);
	return o(), s;
}
function Tr(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var Er = /* @__PURE__ */ Symbol("_vte"), Dr = (e) => e.__isTeleport, Or = /* @__PURE__ */ Symbol("_leaveCb");
function kr(e) {
	let t = e[0];
	if (e.length > 1) {
		let n = !1;
		for (let r of e) if (r.type !== X) {
			if (process.env.NODE_ENV !== "production" && n) {
				H("<transition> can only be used on a single element or component. Use <transition-group> for lists.");
				break;
			}
			if (t = r, n = !0, process.env.NODE_ENV === "production") break;
		}
	}
	return t;
}
function Ar(e) {
	if (!Br(e)) return Dr(e.type) && e.children ? kr(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function jr(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		jr(Dr(n.type) && Ar(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Mr(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Nr(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
var Pr = /* @__PURE__ */ new WeakSet();
function Fr(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Ir = /* @__PURE__ */ new WeakMap();
function Lr(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Lr(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (zr(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Lr(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? Lo(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e;
	if (process.env.NODE_ENV !== "production" && !f) {
		H("Missing ref owner context. ref cannot be used on hoisted vnodes. A vnode with ref must be created inside the render function.");
		return;
	}
	let m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ B(v), b = v === t ? i : (e) => process.env.NODE_ENV !== "production" && (u(y, e) && !/* @__PURE__ */ V(y[e]) && H(`Template ref "${e}" used on a non-ref value. It will not work in the production build.`), Pr.has(y[e])) || Fr(_, e) ? !1 : u(y, e), x = (e, t) => !(process.env.NODE_ENV !== "production" && Pr.has(e) || t && Fr(_, t));
	if (m != null && m !== p) {
		if (Rr(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ V(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) xn(p, f, 12, [l, _]);
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
				} else t ? (_[p] = l, b(p) && (v[p] = l)) : n ? (x(p, e.k) && (p.value = l), e.k && (_[e.k] = l)) : process.env.NODE_ENV !== "production" && H("Invalid template ref type:", p, `(${typeof p})`);
			};
			if (l) {
				let t = () => {
					i(), Ir.delete(e);
				};
				t.id = -1, Ir.set(e, t), Y(t, r);
			} else Rr(e), i();
		} else process.env.NODE_ENV !== "production" && H("Invalid template ref type:", p, `(${typeof p})`);
	}
}
function Rr(e) {
	let t = Ir.get(e);
	t && (t.flags |= 8, Ir.delete(e));
}
le().requestIdleCallback, le().cancelIdleCallback;
var zr = (e) => !!e.type.__asyncLoader, Br = (e) => e.type.__isKeepAlive;
function Vr(e, t) {
	Ur(e, "a", t);
}
function Hr(e, t) {
	Ur(e, "da", t);
}
function Ur(e, t, n = $) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Gr(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Br(e.parent.vnode) && Wr(r, t, n, e), e = e.parent;
	}
}
function Wr(e, t, n, r) {
	let i = Gr(t, e, r, !0);
	Qr(() => {
		c(r[t], i);
	}, n);
}
function Gr(e, t, n = $, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			P();
			let i = Co(n), a = U(t, n, e, r);
			return i(), F(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
	process.env.NODE_ENV !== "production" && H(`${ae(bn[e].replace(/ hook$/, ""))} is called when there is no active component instance to be associated with. Lifecycle injection APIs can only be used during execution of setup(). If you are using async setup(), make sure to register lifecycle hooks before the first await statement.`);
}
var Kr = (e) => (t, n = $) => {
	(!Oo || e === "sp") && Gr(e, (...e) => t(...e), n);
}, qr = Kr("bm"), Jr = Kr("m"), Yr = Kr("bu"), Xr = Kr("u"), Zr = Kr("bum"), Qr = Kr("um"), $r = Kr("sp"), ei = Kr("rtg"), ti = Kr("rtc");
function ni(e, t = $) {
	Gr("ec", e, t);
}
var ri = /* @__PURE__ */ Symbol.for("v-ndc"), ii = (e) => e ? Do(e) ? Lo(e) : ii(e.parent) : null, ai = (e) => {
	let t = !1;
	for (;;) {
		if (e.patchFlag > 0 && e.patchFlag & 2048) {
			let n = Ui(e.children);
			if (!n) return;
			e = n, t = !0;
			continue;
		}
		let n = e.component;
		if (n && n.subTree) {
			e = n.subTree;
			continue;
		}
		let r = e.suspense;
		if (r && r.activeBranch) {
			e = r.activeBranch;
			continue;
		}
		return t ? e.el : void 0;
	}
}, oi = (e) => {
	let t = e.subTree && ai(e.subTree);
	return t === void 0 ? e.vnode.el : t;
}, si = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => process.env.NODE_ENV === "production" ? e.vnode.el : oi(e),
	$data: (e) => e.data,
	$props: (e) => process.env.NODE_ENV === "production" ? e.props : /* @__PURE__ */ R(e.props),
	$attrs: (e) => process.env.NODE_ENV === "production" ? e.attrs : /* @__PURE__ */ R(e.attrs),
	$slots: (e) => process.env.NODE_ENV === "production" ? e.slots : /* @__PURE__ */ R(e.slots),
	$refs: (e) => process.env.NODE_ENV === "production" ? e.refs : /* @__PURE__ */ R(e.refs),
	$parent: (e) => ii(e.parent),
	$root: (e) => ii(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => xi(e),
	$forceUpdate: (e) => e.f ||= () => {
		Mn(e.update);
	},
	$nextTick: (e) => e.n ||= An.bind(e.proxy),
	$watch: (e) => wr.bind(e)
}), ci = (e) => e === "_" || e === "$", li = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), ui = {
	get({ _: e }, n) {
		if (n === "__v_skip") return !0;
		let { ctx: r, setupState: i, data: a, props: o, accessCache: s, type: c, appContext: l } = e;
		if (process.env.NODE_ENV !== "production" && n === "__isVue") return !0;
		if (n[0] !== "$") {
			let e = s[n];
			if (e !== void 0) switch (e) {
				case 1: return i[n];
				case 2: return a[n];
				case 4: return r[n];
				case 3: return o[n];
			}
			else if (li(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else gi && (s[n] = 0);
		}
		let d = si[n], f, p;
		if (d) return n === "$attrs" ? (I(e.attrs, "get", ""), process.env.NODE_ENV !== "production" && Bi()) : process.env.NODE_ENV !== "production" && n === "$slots" && I(e, "get", n), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
		process.env.NODE_ENV !== "production" && q && (!g(n) || n.indexOf("__v") !== 0) && (a !== t && ci(n[0]) && u(a, n) ? H(`Property ${JSON.stringify(n)} must be accessed via $data because it starts with a reserved character ("$" or "_") and is not proxied on the render context.`) : e === q && H(`Property ${JSON.stringify(n)} was accessed during render but is not defined on instance.`));
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return li(a, n) ? (a[n] = r, !0) : process.env.NODE_ENV !== "production" && a.__isScriptSetup && u(a, n) ? (H(`Cannot mutate <script setup> binding "${n}" from Options API.`), !1) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) ? (process.env.NODE_ENV !== "production" && H(`Attempting to mutate prop "${n}". Props are readonly.`), !1) : n[0] === "$" && n.slice(1) in e ? (process.env.NODE_ENV !== "production" && H(`Attempting to mutate public property "${n}". Properties starting with $ are reserved and readonly.`), !1) : (process.env.NODE_ENV !== "production" && n in e.appContext.config.globalProperties ? Object.defineProperty(o, n, {
			enumerable: !0,
			configurable: !0,
			value: r
		}) : o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || li(n, c) || u(o, c) || u(i, c) || u(si, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
process.env.NODE_ENV !== "production" && (ui.ownKeys = (e) => (H("Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead."), Reflect.ownKeys(e)));
function di(e) {
	let t = {};
	return Object.defineProperty(t, "_", {
		configurable: !0,
		enumerable: !1,
		get: () => e
	}), Object.keys(si).forEach((n) => {
		Object.defineProperty(t, n, {
			configurable: !0,
			enumerable: !1,
			get: () => si[n](e),
			set: r
		});
	}), t;
}
function fi(e) {
	let { ctx: t, propsOptions: [n] } = e;
	n && Object.keys(n).forEach((n) => {
		Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => e.props[n],
			set: r
		});
	});
}
function pi(e) {
	let { ctx: t, setupState: n } = e;
	Object.keys(/* @__PURE__ */ B(n)).forEach((e) => {
		if (!n.__isScriptSetup) {
			if (ci(e[0])) {
				H(`setup() return property ${JSON.stringify(e)} should not start with "$" or "_" which are reserved prefixes for Vue internals.`);
				return;
			}
			Object.defineProperty(t, e, {
				enumerable: !0,
				configurable: !0,
				get: () => n[e],
				set: r
			});
		}
	});
}
function mi(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
function hi() {
	let e = /* @__PURE__ */ Object.create(null);
	return (t, n) => {
		e[n] ? H(`${t} property "${n}" is already defined in ${e[n]}.`) : e[n] = t;
	};
}
var gi = !0;
function _i(e) {
	let t = xi(e), n = e.proxy, i = e.ctx;
	gi = !1, t.beforeCreate && yi(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: b, deactivated: x, beforeDestroy: S, beforeUnmount: C, destroyed: w, unmounted: T, render: ee, renderTracked: te, renderTriggered: ne, errorCaptured: E, serverPrefetch: re, expose: D, inheritAttrs: ie, components: ae, directives: O, filters: oe } = t, se = process.env.NODE_ENV === "production" ? null : hi();
	if (process.env.NODE_ENV !== "production") {
		let [t] = e.propsOptions;
		if (t) for (let e in t) se("Props", e);
	}
	if (u && vi(u, i, se), s) for (let e in s) {
		let t = s[e];
		h(t) ? (process.env.NODE_ENV === "production" ? i[e] = t.bind(n) : Object.defineProperty(i, e, {
			value: t.bind(n),
			configurable: !0,
			enumerable: !0,
			writable: !0
		}), process.env.NODE_ENV !== "production" && se("Methods", e)) : process.env.NODE_ENV !== "production" && H(`Method "${e}" has type "${typeof t}" in the component definition. Did you reference the function correctly?`);
	}
	if (a) {
		process.env.NODE_ENV !== "production" && !h(a) && H("The data option must be a function. Plain object usage is no longer supported.");
		let t = a.call(n, n);
		if (process.env.NODE_ENV !== "production" && y(t) && H("data() returned a Promise - note data() cannot be async; If you intend to perform data fetching before component renders, use async setup() + <Suspense>."), !v(t)) process.env.NODE_ENV !== "production" && H("data() should return an object.");
		else if (e.data = /* @__PURE__ */ Bt(t), process.env.NODE_ENV !== "production") for (let e in t) se("Data", e), ci(e[0]) || Object.defineProperty(i, e, {
			configurable: !0,
			enumerable: !0,
			get: () => t[e],
			set: r
		});
	}
	if (gi = !0, o) for (let e in o) {
		let t = o[e], a = h(t) ? t.bind(n, n) : h(t.get) ? t.get.bind(n, n) : r;
		process.env.NODE_ENV !== "production" && a === r && H(`Computed property "${e}" has no getter.`);
		let s = Uo({
			get: a,
			set: !h(t) && h(t.set) ? t.set.bind(n) : process.env.NODE_ENV === "production" ? r : () => {
				H(`Write operation failed: computed property "${e}" is readonly.`);
			}
		});
		Object.defineProperty(i, e, {
			enumerable: !0,
			configurable: !0,
			get: () => s.value,
			set: (e) => s.value = e
		}), process.env.NODE_ENV !== "production" && se("Computed", e);
	}
	if (c) for (let e in c) bi(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			vr(t, e[t]);
		});
	}
	f && yi(f, e, "c");
	function k(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (k(qr, p), k(Jr, m), k(Yr, g), k(Xr, _), k(Vr, b), k(Hr, x), k(ni, E), k(ti, te), k(ei, ne), k(Zr, C), k(Qr, T), k($r, re), d(D)) {
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
	ee && e.render === r && (e.render = ee), ie != null && (e.inheritAttrs = ie), ae && (e.components = ae), O && (e.directives = O), re && Nr(e);
}
function vi(e, t, n = r) {
	d(e) && (e = Ei(e));
	for (let r in e) {
		let i = e[r], a;
		a = v(i) ? "default" in i ? yr(i.from || r, i.default, !0) : yr(i.from || r) : yr(i), /* @__PURE__ */ V(a) ? Object.defineProperty(t, r, {
			enumerable: !0,
			configurable: !0,
			get: () => a.value,
			set: (e) => a.value = e
		}) : t[r] = a, process.env.NODE_ENV !== "production" && n("Inject", r);
	}
}
function yi(e, t, n) {
	U(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function bi(e, t, n, r) {
	let i = r.includes(".") ? Tr(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) ? Sr(i, n) : process.env.NODE_ENV !== "production" && H(`Invalid watch handler specified by key "${e}"`, n);
	} else if (h(e)) Sr(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => bi(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) ? Sr(i, r, e) : process.env.NODE_ENV !== "production" && H(`Invalid watch handler specified by key "${e.handler}"`, r);
		}
	} else process.env.NODE_ENV !== "production" && H(`Invalid watch option: "${r}"`, e);
}
function xi(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => Si(c, e, o, !0)), Si(c, t, o)), v(t) && a.set(t, c), c;
}
function Si(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && Si(e, a, n, !0), i && i.forEach((t) => Si(e, t, n, !0));
	for (let i in t) if (r && i === "expose") process.env.NODE_ENV !== "production" && H("\"expose\" option is ignored when declared in mixins or extends. It should only be declared in the base component itself.");
	else {
		let r = Ci[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var Ci = {
	data: wi,
	props: Oi,
	emits: Oi,
	methods: Di,
	computed: Di,
	beforeCreate: J,
	created: J,
	beforeMount: J,
	mounted: J,
	beforeUpdate: J,
	updated: J,
	beforeDestroy: J,
	beforeUnmount: J,
	destroyed: J,
	unmounted: J,
	activated: J,
	deactivated: J,
	errorCaptured: J,
	serverPrefetch: J,
	components: Di,
	directives: Di,
	watch: ki,
	provide: wi,
	inject: Ti
};
function wi(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function Ti(e, t) {
	return Di(Ei(e), Ei(t));
}
function Ei(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function J(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function Di(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Oi(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), mi(e), mi(t ?? {})) : t;
}
function ki(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = J(e[r], t[r]);
	return n;
}
function Ai() {
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
var ji = 0;
function Mi(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (process.env.NODE_ENV !== "production" && H("root props passed to app.mount() must be an object."), r = null);
		let i = Ai(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: ji++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: Go,
			get config() {
				return i.config;
			},
			set config(e) {
				process.env.NODE_ENV !== "production" && H("app.config cannot be replaced. Modify individual options instead.");
			},
			use(e, ...t) {
				return a.has(e) ? process.env.NODE_ENV !== "production" && H("Plugin has already been applied to target app.") : e && h(e.install) ? (a.add(e), e.install(l, ...t)) : h(e) ? (a.add(e), e(l, ...t)) : process.env.NODE_ENV !== "production" && H("A plugin must either be a function or an object with an \"install\" function."), l;
			},
			mixin(e) {
				return i.mixins.includes(e) ? process.env.NODE_ENV !== "production" && H("Mixin has already been applied to target app" + (e.name ? `: ${e.name}` : "")) : i.mixins.push(e), l;
			},
			component(e, t) {
				return process.env.NODE_ENV !== "production" && Eo(e, i.config), t ? (process.env.NODE_ENV !== "production" && i.components[e] && H(`Component "${e}" has already been registered in target app.`), i.components[e] = t, l) : i.components[e];
			},
			directive(e, t) {
				return process.env.NODE_ENV !== "production" && gr(e), t ? (process.env.NODE_ENV !== "production" && i.directives[e] && H(`Directive "${e}" has already been registered in target app.`), i.directives[e] = t, l) : i.directives[e];
			},
			mount(a, o, s) {
				if (c) process.env.NODE_ENV !== "production" && H("App has already been mounted.\nIf you want to remount the same app, move your app creation logic into a factory function and create fresh app instances for each mount - e.g. `const createMyApp = () => createApp(App)`");
				else {
					process.env.NODE_ENV !== "production" && a.__vue_app__ && H("There is already an app instance mounted on the host container.\n If you want to mount another app on the same host container, you need to unmount the previous app by calling `app.unmount()` first.");
					let u = l._ceVNode || oo(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), process.env.NODE_ENV !== "production" && (i.reload = () => {
						let t = lo(u);
						t.el = null, e(t, a, s);
					}), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, process.env.NODE_ENV !== "production" && (l._instance = u.component, nr(l, Go)), Lo(u.component);
				}
			},
			onUnmount(e) {
				process.env.NODE_ENV !== "production" && typeof e != "function" && H(`Expected function as first argument to app.onUnmount(), but got ${typeof e}`), o.push(e);
			},
			unmount() {
				c ? (U(o, l._instance, 16), e(null, l._container), process.env.NODE_ENV !== "production" && (l._instance = null, rr(l)), delete l._container.__vue_app__) : process.env.NODE_ENV !== "production" && H("Cannot unmount an app that is not mounted.");
			},
			provide(e, t) {
				return process.env.NODE_ENV !== "production" && e in i.provides && (u(i.provides, e) ? H(`App already provides property with key "${String(e)}". It will be overwritten with the new value.`) : H(`App already provides property with key "${String(e)}" inherited from its parent element. It will be overwritten with the new value.`)), i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = Ni;
				Ni = l;
				try {
					return e();
				} finally {
					Ni = t;
				}
			}
		};
		return l;
	};
}
var Ni = null, Pi = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${E(t)}Modifiers`] || e[`${D(t)}Modifiers`];
function Fi(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t;
	if (process.env.NODE_ENV !== "production") {
		let { emitsOptions: t, propsOptions: [i] } = e;
		if (t) {
			if (!(n in t)) (!i || !(ae(E(n)) in i)) && H(`Component emitted event "${n}" but it is neither declared in the emits option nor as an "${ae(E(n))}" prop.`);
			else {
				let e = t[n];
				h(e) && (e(...r) || H(`Invalid event arguments: event validation failed for event "${n}".`));
			}
		}
	}
	let a = r, o = n.startsWith("update:"), s = o && Pi(i, n.slice(7));
	if (s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(k))), process.env.NODE_ENV !== "production" && fr(e, n, a), process.env.NODE_ENV !== "production") {
		let t = n.toLowerCase();
		t !== n && i[ae(t)] && H(`Event "${t}" is emitted in component ${Vo(e, e.type)} but the handler is registered for "${n}". Note that HTML attributes are case-insensitive and you cannot use v-on to listen to camelCase events when using in-DOM templates. You should probably use "${D(n)}" instead of "${n}".`);
	}
	let c, l = i[c = ae(n)] || i[c = ae(E(n))];
	!l && o && (l = i[c = ae(D(n))]), l && U(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, U(u, e, 6, a);
	}
}
var Ii = /* @__PURE__ */ new WeakMap();
function Li(e, t, n = !1) {
	let r = n ? Ii : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Li(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Ri(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, D(t)) || u(e, t));
}
var zi = !1;
function Bi() {
	zi = !0;
}
function Vi(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [s], slots: c, attrs: l, emit: u, render: d, renderCache: f, props: p, data: m, setupState: h, ctx: g, inheritAttrs: _ } = e, v = mr(e), y, b;
	process.env.NODE_ENV !== "production" && (zi = !1);
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = process.env.NODE_ENV !== "production" && h.__isScriptSetup ? new Proxy(e, { get(e, t, n) {
				return H(`Property '${String(t)}' was accessed via 'this'. Avoid using 'this' in templates.`), Reflect.get(e, t, n);
			} }) : e;
			y = Q(d.call(t, e, f, process.env.NODE_ENV === "production" ? p : /* @__PURE__ */ R(p), h, m, g)), b = l;
		} else {
			let e = t;
			process.env.NODE_ENV !== "production" && l === p && Bi(), y = Q(e.length > 1 ? e(process.env.NODE_ENV === "production" ? p : /* @__PURE__ */ R(p), process.env.NODE_ENV === "production" ? {
				attrs: l,
				slots: c,
				emit: u
			} : {
				get attrs() {
					return Bi(), /* @__PURE__ */ R(l);
				},
				slots: c,
				emit: u
			}) : e(process.env.NODE_ENV === "production" ? p : /* @__PURE__ */ R(p), null)), b = t.props ? l : Wi(l);
		}
	} catch (t) {
		Ka.length = 0, Sn(t, e, 1), y = oo(X);
	}
	let x = y, S;
	if (process.env.NODE_ENV !== "production" && y.patchFlag > 0 && y.patchFlag & 2048 && ([x, S] = Hi(y)), b && _ !== !1) {
		let e = Object.keys(b), { shapeFlag: t } = x;
		if (e.length) {
			if (t & 7) s && e.some(o) && (b = Gi(b, s)), x = lo(x, b, !1, !0);
			else if (process.env.NODE_ENV !== "production" && !zi && x.type !== X) {
				let e = Object.keys(l), t = [], n = [];
				for (let r = 0, i = e.length; r < i; r++) {
					let i = e[r];
					a(i) ? o(i) || t.push(i[2].toLowerCase() + i.slice(3)) : n.push(i);
				}
				n.length && H(`Extraneous non-props attributes (${n.join(", ")}) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes.`), t.length && H(`Extraneous non-emits event listeners (${t.join(", ")}) were passed to component but could not be automatically inherited because component renders fragment or text root nodes. If the listener is intended to be a component custom event listener only, declare it using the "emits" option.`);
			}
		}
	}
	if (n.dirs && (process.env.NODE_ENV !== "production" && !Ki(x) && H("Runtime directive used on component with non-element root node. The directives will not function as intended."), x = lo(x, null, !1, !0), x.dirs = x.dirs ? x.dirs.concat(n.dirs) : n.dirs), n.transition) {
		let e = Dr(x.type) && Ar(x) || x;
		process.env.NODE_ENV !== "production" && !Ki(e) && H("Component inside <Transition> renders non-element root node that cannot be animated."), jr(e, n.transition);
	}
	return process.env.NODE_ENV !== "production" && S ? S(x) : y = x, mr(v), y;
}
var Hi = (e) => {
	let t = e.children, n = e.dynamicChildren, r = Ui(t, !1);
	if (!r) return [e, void 0];
	if (process.env.NODE_ENV !== "production" && r.patchFlag > 0 && r.patchFlag & 2048) return Hi(r);
	let i = t.indexOf(r), a = n ? n.indexOf(r) : -1;
	return [Q(r), (r) => {
		t[i] = r, n && (a > -1 ? n[a] = r : r.patchFlag > 0 && (e.dynamicChildren = [...n, r]));
	}];
};
function Ui(e, t = !0) {
	let n;
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		if ($a(i)) {
			if (i.type !== X || i.children === "v-if") {
				if (n) return;
				if (n = i, process.env.NODE_ENV !== "production" && t && n.patchFlag > 0 && n.patchFlag & 2048) return Ui(n.children);
			}
		} else return;
	}
	return n;
}
var Wi = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Gi = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
}, Ki = (e) => e.shapeFlag & 7 || e.type === X;
function qi(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (process.env.NODE_ENV !== "production" && (i || s) && K || t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Ji(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Yi(o, r, n) && !Ri(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Ji(r, o, l) : !!o;
	return !1;
}
function Ji(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (Yi(t, e, a) && !Ri(n, a)) return !0;
	}
	return !1;
}
function Yi(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !De(r, i) : r !== i;
}
function Xi({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Zi = {}, Qi = () => Object.create(Zi), $i = (e) => Object.getPrototypeOf(e) === Zi;
function ea(e, t, n, r = !1) {
	let i = {}, a = Qi();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), ra(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	process.env.NODE_ENV !== "production" && la(t || {}, i, e), e.props = n ? r ? i : /* @__PURE__ */ Vt(i) : e.type.props ? i : a, e.attrs = a;
}
function ta(e) {
	for (; e;) {
		if (e.type.__hmrId) return !0;
		e = e.parent;
	}
}
function na(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ B(i), [c] = e.propsOptions, l = !1;
	if (!(process.env.NODE_ENV !== "production" && ta(e)) && (r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Ri(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = E(o);
						i[t] = ia(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		ra(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = D(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = ia(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && it(e.attrs, "set", ""), process.env.NODE_ENV !== "production" && la(t || {}, i, e);
}
function ra(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (T(t)) continue;
		let l = n[t], d;
		a && u(a, d = E(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Ri(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ B(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = ia(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function ia(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = Co(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === D(n)) && (r = !0));
	}
	return r;
}
var aa = /* @__PURE__ */ new WeakMap();
function oa(e, r, i = !1) {
	let a = i ? aa : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = oa(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		process.env.NODE_ENV !== "production" && !g(c[e]) && H("props must be strings when using array syntax.", c[e]);
		let n = E(c[e]);
		sa(n) && (l[n] = t);
	}
	else if (c) {
		process.env.NODE_ENV !== "production" && !v(c) && H("invalid props options", c);
		for (let e in c) {
			let t = E(e);
			if (sa(t)) {
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
	}
	let m = [l, f];
	return v(e) && a.set(e, m), m;
}
function sa(e) {
	return e[0] !== "$" && !T(e) || (process.env.NODE_ENV !== "production" && H(`Invalid prop name: "${e}" is a reserved property.`), !1);
}
function ca(e) {
	return e === null ? "null" : typeof e == "function" ? e.name || "" : typeof e == "object" && e.constructor && e.constructor.name || "";
}
function la(e, t, n) {
	let r = /* @__PURE__ */ B(t), i = n.propsOptions[0], a = Object.keys(e).map((e) => E(e));
	for (let e in i) {
		let t = i[e];
		t != null && ua(e, r[e], t, process.env.NODE_ENV === "production" ? r : /* @__PURE__ */ R(r), !a.includes(e));
	}
}
function ua(e, t, n, r, i) {
	let { type: a, required: o, validator: s, skipCheck: c } = n;
	if (o && i) {
		H("Missing required prop: \"" + e + "\"");
		return;
	}
	if (t != null || o) {
		if (a != null && a !== !0 && !c) {
			let n = !1, r = d(a) ? a : [a], i = [];
			for (let e = 0; e < r.length && !n; e++) {
				let { valid: a, expectedType: o } = fa(t, r[e]);
				i.push(o || ""), n = a;
			}
			if (!n) {
				H(pa(e, t, i));
				return;
			}
		}
		s && !s(t, r) && H("Invalid prop: custom validator check failed for prop \"" + e + "\".");
	}
}
var da = /* @__PURE__ */ e("String,Number,Boolean,Function,Symbol,BigInt");
function fa(e, t) {
	let n, r = ca(t);
	if (r === "null") n = e === null;
	else if (da(r)) {
		let i = typeof e;
		n = i === r.toLowerCase(), !n && i === "object" && (n = e instanceof t);
	} else n = r === "Object" ? v(e) : r === "Array" ? d(e) : e instanceof t;
	return {
		valid: n,
		expectedType: r
	};
}
function pa(e, t, n) {
	if (n.length === 0) return `Prop type [] for prop "${e}" won't match anything. Did you mean to use type Array instead?`;
	let r = `Invalid prop: type check failed for prop "${e}". Expected ${n.map(ie).join(" | ")}`, i = n[0], a = S(t), o = ma(t, i), s = ma(t, a);
	return n.length === 1 && ha(i) && ga(i, a) && (r += ` with value ${o}`), r += `, got ${a} `, ha(a) && (r += `with value ${s}.`), r;
}
function ma(e, t) {
	return _(e) ? e.toString() : t === "String" ? `"${e}"` : t === "Number" ? `${Number(e)}` : `${e}`;
}
function ha(e) {
	return [
		"string",
		"number",
		"boolean"
	].some((t) => e.toLowerCase() === t);
}
function ga(...e) {
	return e.every((e) => {
		let t = e.toLowerCase();
		return t !== "boolean" && t !== "symbol";
	});
}
var _a = (e) => e === "_" || e === "_ctx" || e === "$stable", va = (e) => d(e) ? e.map(Q) : [Q(e)], ya = (e, t, n) => {
	if (t._n) return t;
	let r = hr((...r) => (process.env.NODE_ENV !== "production" && $ && !(n === null && q) && !(n && n.root !== $.root) && H(`Slot "${e}" invoked outside of the render function: this will not track dependencies used in the slot. Invoke the slot function inside the render function instead.`), va(t(...r))), n);
	return r._c = !1, r;
}, ba = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (_a(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = ya(n, i, r);
		else if (i != null) {
			process.env.NODE_ENV !== "production" && H(`Non-function value encountered for slot "${n}". Prefer function slots for better performance.`);
			let e = va(i);
			t[n] = () => e;
		}
	}
}, xa = (e, t) => {
	process.env.NODE_ENV !== "production" && !Br(e.vnode) && H("Non-function value encountered for default slot. Prefer function slots for better performance.");
	let n = va(t);
	e.slots.default = () => n;
}, Sa = (e, t, n) => {
	for (let r in t) (n || !_a(r)) && (e[r] = t[r]);
}, Ca = (e, t, n) => {
	let r = e.slots = Qi();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (Sa(r, t, n), n && se(r, "_", e, !0)) : ba(t, r);
	} else t && xa(e, t);
}, wa = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let t = n._;
		t ? process.env.NODE_ENV !== "production" && K ? (Sa(a, n, r), it(e, "set", "$slots")) : r && t === 1 ? o = !1 : Sa(a, n, r) : (o = !n.$stable, ba(n, a)), s = n;
	} else n && (xa(e, n), s = { default: 1 });
	if (o) for (let e in a) !_a(e) && s[e] == null && delete a[e];
}, Ta, Ea;
function Da(e, t) {
	e.appContext.config.performance && ka() && Ea.mark(`vue-${t}-${e.uid}`), process.env.NODE_ENV !== "production" && lr(e, t, ka() ? Ea.now() : Date.now());
}
function Oa(e, t) {
	if (e.appContext.config.performance && ka()) {
		let n = `vue-${t}-${e.uid}`, r = n + ":end", i = `<${Vo(e, e.type)}> ${t}`;
		Ea.mark(r), Ea.measure(i, n, r), Ea.clearMeasures(i), Ea.clearMarks(n), Ea.clearMarks(r);
	}
	process.env.NODE_ENV !== "production" && ur(e, t, ka() ? Ea.now() : Date.now());
}
function ka() {
	return Ta === void 0 && (typeof window < "u" && window.performance ? (Ta = !0, Ea = window.performance) : Ta = !1), Ta;
}
function Aa() {
	let e = [];
	if (process.env.NODE_ENV !== "production" && e.length) {
		let t = e.length > 1;
		console.warn(`Feature flag${t ? "s" : ""} ${e.join(", ")} ${t ? "are" : "is"} not explicitly defined. You are running the esm-bundler build of Vue, which expects these compile-time feature flags to be globally injected via the bundler config in order to get better tree-shaking in the production bundle.

For more details, see https://link.vuejs.org/feature-flags.`);
	}
}
var Y = Ha;
function ja(e) {
	return Ma(e);
}
function Ma(e, i) {
	Aa();
	let a = le();
	a.__VUE__ = !0, process.env.NODE_ENV !== "production" && tr(a.__VUE_DEVTOOLS_GLOBAL_HOOK__, a);
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = process.env.NODE_ENV !== "production" && K ? !1 : !!t.dynamicChildren) => {
		if (e === t) return;
		e && !eo(e, t) && (r = xe(e), ge(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case Wa:
				y(e, t, n, r);
				break;
			case X:
				b(e, t, n, r);
				break;
			case Ga:
				e == null ? x(t, n, r, o) : process.env.NODE_ENV !== "production" && S(e, t, n, o);
				break;
			case Ua:
				ae(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? ee(e, t, n, r, i, a, o, s, c) : d & 6 ? O(e, t, n, r, i, a, o, s, c) : d & 64 || d & 128 ? l.process(e, t, n, r, i, a, o, s, c, we) : process.env.NODE_ENV !== "production" && H("Invalid VNode type:", l, `(${typeof l})`);
		}
		u != null && i ? Lr(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Lr(e.ref, null, a, e, !0);
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
	}, S = (e, t, n, r) => {
		if (t.children !== e.children) {
			let i = h(e.anchor);
			w(e), [t.el, t.anchor] = _(t.children, n, i, r);
		} else t.el = e.el, t.anchor = e.anchor;
	}, C = ({ el: e, anchor: t }, n, r) => {
		let i;
		for (; e && e !== t;) i = h(e), o(e, n, r), e = i;
		o(t, n, r);
	}, w = ({ el: e, anchor: t }) => {
		let n;
		for (; e && e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, ee = (e, t, n, r, i, a, o, s, c) => {
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
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && E(e.children, d, null, r, i, Na(e, a), s, u), _ && _r(e, null, r, "created"), ne(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !T(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && go(f, r, e);
		}
		process.env.NODE_ENV !== "production" && (se(d, "__vnode", e, !0), se(d, "__vueParentComponent", r, !0)), _ && _r(e, null, r, "beforeMount");
		let v = Fa(i, g);
		if (v && g.beforeEnter(d), o(d, t, n), (f = m && m.onVnodeMounted) || v || _) {
			let t = process.env.NODE_ENV !== "production" && K;
			Y(() => {
				let n;
				process.env.NODE_ENV !== "production" && (n = Bn(t));
				try {
					f && go(f, r, e), v && g.enter(d), _ && _r(e, null, r, "mounted");
				} finally {
					process.env.NODE_ENV !== "production" && Bn(n);
				}
			}, i);
		}
	}, ne = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (process.env.NODE_ENV !== "production" && n.patchFlag > 0 && n.patchFlag & 2048 && (n = Ui(n.children) || n), t === n || Va(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				ne(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, E = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? po(e[l]) : Q(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, re = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el;
		process.env.NODE_ENV !== "production" && (l.__vnode = n);
		let { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && Pa(r, !1), (g = h.onVnodeBeforeUpdate) && go(g, r, n, e), f && _r(n, e, r, "beforeUpdate"), r && Pa(r, !0), (process.env.NODE_ENV !== "production" && K || d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length)) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? (D(e.dynamicChildren, d, l, r, i, Na(n, a), o), process.env.NODE_ENV !== "production" && Ia(e, n)) : s || fe(e, n, l, null, r, i, Na(n, a), o, !1), u > 0) {
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
		((g = h.onVnodeUpdated) || f) && Y(() => {
			g && go(g, r, n, e), f && _r(n, e, r, "updated");
		}, i);
	}, D = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === Ua || !eo(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, ie = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !T(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (T(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, ae = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		process.env.NODE_ENV !== "production" && (K || p & 2048) && (p = 0, l = !1, m = null), h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), E(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (D(e.dynamicChildren, m, n, i, a, s, c), process.env.NODE_ENV === "production" ? (t.key != null || i && t === i.subTree) && Ia(e, t, !0) : Ia(e, t)) : fe(e, t, n, f, i, a, s, c, l);
	}, O = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : k(t, n, r, i, a, o, c) : ce(e, t, c);
	}, k = (e, t, n, r, i, a, o) => {
		let s = e.component = yo(e, r, i);
		if (process.env.NODE_ENV !== "production" && s.type.__hmrId && Un(s), process.env.NODE_ENV !== "production" && (fn(e), Da(s, "mount")), Br(e) && (s.ctx.renderer = we), process.env.NODE_ENV !== "production" && Da(s, "init"), ko(s, !1, o), process.env.NODE_ENV !== "production" && Oa(s, "init"), process.env.NODE_ENV !== "production" && K && (e.el = null), s.asyncDep) {
			if (i && i.registerDep(s, ue, o), !e.el) {
				let r = s.subTree = oo(X);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else ue(s, e, t, n, i, a, o);
		process.env.NODE_ENV !== "production" && (pn(), Oa(s, "mount"));
	}, ce = (e, t, n) => {
		let r = t.component = e.component;
		if (qi(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				process.env.NODE_ENV !== "production" && fn(t), de(r, t, n), process.env.NODE_ENV !== "production" && pn();
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, r.vnode = t;
	}, ue = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = Ra(e);
					if (n) {
						t && (t.el = c.el, de(e, t, o)), n.asyncDep.then(() => {
							Y(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				process.env.NODE_ENV !== "production" && fn(t || e.vnode), Pa(e, !1), t ? (t.el = c.el, de(e, t, o)) : t = c, n && oe(n), (d = t.props && t.props.onVnodeBeforeUpdate) && go(d, s, t, c), Pa(e, !0), process.env.NODE_ENV !== "production" && Da(e, "render");
				let f = Vi(e);
				process.env.NODE_ENV !== "production" && Oa(e, "render");
				let p = e.subTree;
				e.subTree = f, process.env.NODE_ENV !== "production" && Da(e, "patch"), v(p, f, m(p.el), xe(p), e, i, a), process.env.NODE_ENV !== "production" && Oa(e, "patch"), t.el = f.el, u === null && Xi(e, f.el), r && Y(r, i), (d = t.props && t.props.onVnodeUpdated) && Y(() => go(d, s, t, c), i), process.env.NODE_ENV !== "production" && ar(e), process.env.NODE_ENV !== "production" && pn();
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = zr(t);
				if (Pa(e, !1), l && oe(l), !m && (o = c && c.onVnodeBeforeMount) && go(o, d, t), Pa(e, !0), s && Ee) {
					let t = () => {
						process.env.NODE_ENV !== "production" && Da(e, "render"), e.subTree = Vi(e), process.env.NODE_ENV !== "production" && Oa(e, "render"), process.env.NODE_ENV !== "production" && Da(e, "hydrate"), Ee(s, e.subTree, e, i, null), process.env.NODE_ENV !== "production" && Oa(e, "hydrate");
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0), process.env.NODE_ENV !== "production" && Da(e, "render");
					let o = e.subTree = Vi(e);
					process.env.NODE_ENV !== "production" && Oa(e, "render"), process.env.NODE_ENV !== "production" && Da(e, "patch"), v(null, o, n, r, e, i, a), process.env.NODE_ENV !== "production" && Oa(e, "patch"), t.el = o.el;
				}
				if (u && Y(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					Y(() => go(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && zr(d.vnode) && d.vnode.shapeFlag & 256) && e.a && Y(e.a, i), e.isMounted = !0, process.env.NODE_ENV !== "production" && ir(e), t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Fe(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => Mn(u), Pa(e, !0), process.env.NODE_ENV !== "production" && (c.onTrack = e.rtc ? (t) => oe(e.rtc, t) : void 0, c.onTrigger = e.rtg ? (t) => oe(e.rtg, t) : void 0), l();
	}, de = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, na(e, t.props, r, n), wa(e, t.children, n), P(), Fn(e), F();
	}, fe = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, u = e ? e.shapeFlag : 0, d = t.children, { patchFlag: f, shapeFlag: m } = t;
		if (f > 0) {
			if (f & 128) {
				me(l, d, n, r, i, a, o, s, c);
				return;
			}
			if (f & 256) {
				pe(l, d, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (u & 16 && be(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? me(l, d, n, r, i, a, o, s, c) : be(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && E(d, n, r, i, a, o, s, c));
	}, pe = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? po(t[p]) : Q(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? be(e, a, o, !0, !1, f) : E(t, r, i, a, o, s, c, l, f);
	}, me = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? po(t[u]) : Q(t[u]);
			if (eo(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? po(t[p]) : Q(t[p]);
			if (eo(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? po(t[u]) : Q(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) ge(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? po(t[u]) : Q(t[u]);
				e.key != null && (process.env.NODE_ENV !== "production" && g.has(e.key) && H("Duplicate keys found during update:", JSON.stringify(e.key), "Make sure keys are unique."), g.set(e.key, u));
			}
			let _, y = 0, b = p - h + 1, x = !1, S = 0, C = Array(b);
			for (u = 0; u < b; u++) C[u] = 0;
			for (u = m; u <= f; u++) {
				let n = e[u];
				if (y >= b) {
					ge(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && eo(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? ge(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? La(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || Ba(f) : i;
				C[u] === 0 ? v(null, n, r, p, a, o, s, c, l) : x && (_ < 0 || u !== w[_] ? he(n, r, p, 2) : _--);
			}
		}
	}, he = (e, t, n, r, i = null) => {
		let { el: a, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) {
			he(e.component.subTree, t, n, r);
			return;
		}
		if (d & 128) {
			e.suspense.move(t, n, r);
			return;
		}
		if (d & 64) {
			c.move(e, t, n, we);
			return;
		}
		if (c === Ua) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) he(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === Ga) {
			C(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[Or] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), Y(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[Or];
					a._isLeaving && a[Or](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, ge = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (P(), Lr(s, null, n, e, !0), F()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !zr(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && go(_, t, e), u & 6) ye(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && _r(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, we, r) : l && !l.hasOnce && (a !== Ua || d > 0 && d & 64) ? be(l, t, n, !1, !0) : (a === Ua && d & 384 || !i && u & 16) && be(c, t, n), r && _e(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && Y(() => {
			_ && go(_, t, e), h && _r(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, _e = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === Ua) {
			process.env.NODE_ENV !== "production" && e.patchFlag > 0 && e.patchFlag & 2048 && i && !i.persisted ? e.children.forEach((e) => {
				e.type === X ? s(e.el) : _e(e);
			}) : ve(n, r);
			return;
		}
		if (t === Ga) {
			w(e);
			return;
		}
		let a = () => {
			s(n), i && !i.persisted && i.afterLeave && i.afterLeave();
		};
		if (e.shapeFlag & 1 && i && !i.persisted) {
			let { leave: t, delayLeave: r } = i, o = () => t(n, a);
			r ? r(e.el, a, o) : o();
		} else a();
	}, ve = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, ye = (e, t, n) => {
		process.env.NODE_ENV !== "production" && e.type.__hmrId && Wn(e);
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		za(c), za(l), r && oe(r), i.stop(), a && (a.flags |= 8, ge(o, e, t, n)), s && Y(s, t), Y(() => {
			e.isUnmounted = !0;
		}, t), process.env.NODE_ENV !== "production" && sr(e);
	}, be = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) ge(e[o], t, n, r, i);
	}, xe = (e) => {
		if (e.shapeFlag & 6) return xe(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[Er];
		return n ? h(n) : t;
	}, Se = !1, Ce = (e, t, n) => {
		let r;
		e == null ? t._vnode && (ge(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, Se ||= (Se = !0, Fn(r), In(), !1);
	}, we = {
		p: v,
		um: ge,
		m: he,
		r: _e,
		mt: k,
		mc: E,
		pc: fe,
		pbc: D,
		n: xe,
		o: e
	}, Te, Ee;
	return i && ([Te, Ee] = i(we)), {
		render: Ce,
		hydrate: Te,
		createApp: Mi(Ce, Te)
	};
}
function Na({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function Pa({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Fa(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Ia(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = po(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && Ia(t, a)), a.type === Wa && (a.patchFlag === -1 && (a = i[e] = po(a)), a.el = t.el), a.type === X && !a.el && (a.el = t.el), process.env.NODE_ENV !== "production" && a.el && (a.el.__vnode = a);
	}
}
function La(e) {
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
function Ra(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : Ra(t);
}
function za(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function Ba(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? Ba(t.subTree) : null;
}
var Va = (e) => e.__isSuspense;
function Ha(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : Pn(e);
}
var Ua = /* @__PURE__ */ Symbol.for("v-fgt"), Wa = /* @__PURE__ */ Symbol.for("v-txt"), X = /* @__PURE__ */ Symbol.for("v-cmt"), Ga = /* @__PURE__ */ Symbol.for("v-stc"), Ka = [], Z = null;
function qa(e = !1) {
	Ka.push(Z = e ? null : []);
}
function Ja() {
	Ka.pop(), Z = Ka[Ka.length - 1] || null;
}
var Ya = 1;
function Xa(e, t = !1) {
	Ya += e, e < 0 && Z && t && (Z.hasOnce = !0);
}
function Za(e) {
	return e.dynamicChildren = Ya > 0 ? Z || n : null, Ja(), Ya > 0 && Z && Z.push(e), e;
}
function Qa(e, t, n, r, i, a) {
	return Za(io(e, t, n, r, i, a, !0));
}
function $a(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function eo(e, t) {
	if (process.env.NODE_ENV !== "production" && t.shapeFlag & 6 && e.component) {
		let n = Vn.get(t.type);
		if (n && n.has(e.component)) return e.shapeFlag &= -257, t.shapeFlag &= -513, !1;
	}
	return e.type === t.type && e.key === t.key;
}
var to = (...e) => so(...e), no = ({ key: e }) => e ?? null, ro = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ V(e) || h(e) ? {
	i: q,
	r: e,
	k: t,
	f: !!n
} : e);
function io(e, t = null, n = null, r = 0, i = null, a = e === Ua ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && no(t),
		ref: t && ro(t),
		scopeId: pr,
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
		ctx: q
	};
	if (s ? (mo(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), process.env.NODE_ENV !== "production" && c.key !== c.key && H("VNode created with invalid key (NaN). VNode type:", c.type), process.env.NODE_ENV !== "production" && t && c.shapeFlag & 1) {
		let e = t.innerHTML == null ? t.textContent == null ? null : "textContent" : "innerHTML";
		e && ao(c.children) && H(`The \`${e}\` prop on <${c.type}> will override its children. Remove either the \`${e}\` prop or the children.`);
	}
	return Ya > 0 && !o && Z && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && Z.push(c), c;
}
function ao(e) {
	return g(e) ? e !== "" : d(e) ? e.length > 0 : !1;
}
var oo = process.env.NODE_ENV === "production" ? so : to;
function so(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === ri) && (process.env.NODE_ENV !== "production" && !e && H(`Invalid vnode type when creating vnode: ${e}.`), e = X), $a(e)) {
		let r = lo(e, t, !0);
		return n && mo(r, n), Ya > 0 && !a && Z && (r.shapeFlag & 6 ? Z[Z.indexOf(e)] = r : Z.push(r)), r.patchFlag = -2, r;
	}
	if (Ho(e) && (e = e.__vccOpts), t) {
		t = co(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = he(e)), v(n) && (/* @__PURE__ */ Kt(n) && !d(n) && (n = s({}, n)), t.style = ue(n));
	}
	let o = g(e) ? 1 : Va(e) ? 128 : Dr(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return process.env.NODE_ENV !== "production" && o & 4 && /* @__PURE__ */ Kt(e) && (e = /* @__PURE__ */ B(e), H("Vue received a Component that was made a reactive object. This can lead to unnecessary performance overhead and should be avoided by marking the component with `markRaw` or using `shallowRef` instead of `ref`.", "\nComponent that was made reactive: ", e)), io(e, t, n, r, i, o, a, !0);
}
function co(e) {
	return e ? /* @__PURE__ */ Kt(e) || $i(e) ? s({}, e) : e : null;
}
function lo(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? ho(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && no(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(ro(t)) : [a, ro(t)] : ro(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: process.env.NODE_ENV !== "production" && o === -1 && d(s) ? s.map(uo) : s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== Ua ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && lo(e.ssContent),
		ssFallback: e.ssFallback && lo(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && jr(u, c.clone(u)), u;
}
function uo(e) {
	let t = lo(e);
	return d(e.children) && (t.children = e.children.map(uo)), t;
}
function fo(e = " ", t = 0) {
	return oo(Wa, null, e, t);
}
function Q(e) {
	return e == null || typeof e == "boolean" ? oo(X) : d(e) ? oo(Ua, null, e.slice()) : $a(e) ? po(e) : oo(Wa, null, String(e));
}
function po(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : lo(e);
}
function mo(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), mo(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !$i(t) ? t._ctx = q : r === 3 && q && (q.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			mo(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: q
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [fo(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function ho(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = he([t.class, r.class]));
		else if (e === "style") t.style = ue([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function go(e, t, n, r = null) {
	U(e, t, 7, [n, r]);
}
var _o = Ai(), vo = 0;
function yo(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || _o, o = {
		uid: vo++,
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
		scope: new Me(!0),
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
		propsOptions: oa(i, a),
		emitsOptions: Li(i, a),
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
	return o.ctx = process.env.NODE_ENV === "production" ? { _: o } : di(o), o.root = n ? n.root : o, o.emit = Fi.bind(null, o), e.ce && e.ce(o), o;
}
var $ = null, bo = () => $ || q, xo, So;
{
	let e = le(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	xo = t("__VUE_INSTANCE_SETTERS__", (e) => $ = e), So = t("__VUE_SSR_SETTERS__", (e) => Oo = e);
}
var Co = (e) => {
	let t = $;
	return xo(e), e.scope.on(), () => {
		e.scope.off(), xo(t);
	};
}, wo = () => {
	$ && $.scope.off(), xo(null);
}, To = /* @__PURE__ */ e("slot,component");
function Eo(e, { isNativeTag: t }) {
	(To(e) || t(e)) && H("Do not use built-in or reserved HTML elements as component id: " + e);
}
function Do(e) {
	return e.vnode.shapeFlag & 4;
}
var Oo = !1;
function ko(e, t = !1, n = !1) {
	t && So(t);
	let { props: r, children: i } = e.vnode, a = Do(e);
	ea(e, r, a, t), Ca(e, i, n || t);
	let o = a ? Ao(e, t) : void 0;
	return t && So(!1), o;
}
function Ao(e, t) {
	let n = e.type;
	if (process.env.NODE_ENV !== "production") {
		if (n.name && Eo(n.name, e.appContext.config), n.components) {
			let t = Object.keys(n.components);
			for (let n = 0; n < t.length; n++) Eo(t[n], e.appContext.config);
		}
		if (n.directives) {
			let e = Object.keys(n.directives);
			for (let t = 0; t < e.length; t++) gr(e[t]);
		}
		n.compilerOptions && Mo() && H("\"compilerOptions\" is only supported when using a build of Vue that includes the runtime compiler. Since you are using a runtime-only build, the options should be passed via your build tool config instead.");
	}
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, ui), process.env.NODE_ENV !== "production" && fi(e);
	let { setup: r } = n;
	if (r) {
		P();
		let i = e.setupContext = r.length > 1 ? Io(e) : null, a = Co(e), o = xn(r, e, 0, [process.env.NODE_ENV === "production" ? e.props : /* @__PURE__ */ R(e.props), i]), s = y(o);
		if (F(), a(), (s || e.sp) && !zr(e) && Nr(e), s) {
			if (o.then(wo, wo), t) return o.then((n) => {
				So(!0);
				try {
					jo(e, n, t);
				} finally {
					So(!1);
				}
			}).catch((t) => {
				Sn(t, e, 0);
			});
			e.asyncDep = o, process.env.NODE_ENV !== "production" && !e.suspense && H(`Component <${Vo(e, n)}>: setup function returned a promise, but no <Suspense> boundary was found in the parent component tree. A component with async setup() must be nested in a <Suspense> in order to be rendered.`);
		} else jo(e, o, t);
	} else No(e, t);
}
function jo(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) ? (process.env.NODE_ENV !== "production" && $a(t) && H("setup() should not return VNodes directly - return a render function instead."), process.env.NODE_ENV !== "production" && (e.devtoolsRawSetupState = t), e.setupState = tn(t), process.env.NODE_ENV !== "production" && pi(e)) : process.env.NODE_ENV !== "production" && t !== void 0 && H(`setup() should return an object. Received: ${t === null ? "null" : typeof t}`), No(e, n);
}
var Mo = () => !0;
function No(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = Co(e);
		P();
		try {
			_i(e);
		} finally {
			F(), t();
		}
	}
	process.env.NODE_ENV !== "production" && !i.render && e.render === r && !t && (i.template ? H("Component provided template option but runtime compilation is not supported in this build of Vue. Configure your bundler to alias \"vue\" to \"vue/dist/vue.esm-bundler.js\".") : H("Component is missing template or render function: ", i));
}
var Po = process.env.NODE_ENV === "production" ? { get(e, t) {
	return I(e, "get", ""), e[t];
} } : {
	get(e, t) {
		return Bi(), I(e, "get", ""), e[t];
	},
	set() {
		return H("setupContext.attrs is readonly."), !1;
	},
	deleteProperty() {
		return H("setupContext.attrs is readonly."), !1;
	}
};
function Fo(e) {
	return new Proxy(e.slots, { get(t, n) {
		return I(e, "get", "$slots"), t[n];
	} });
}
function Io(e) {
	let t = (t) => {
		if (process.env.NODE_ENV !== "production" && (e.exposed && H("expose() should be called only once per setup()."), t != null)) {
			let e = typeof t;
			e === "object" && (d(t) ? e = "array" : /* @__PURE__ */ V(t) && (e = "ref")), e !== "object" && H(`expose() should be passed a plain object, received ${e}.`);
		}
		e.exposed = t || {};
	};
	if (process.env.NODE_ENV !== "production") {
		let n, r;
		return Object.freeze({
			get attrs() {
				return n ||= new Proxy(e.attrs, Po);
			},
			get slots() {
				return r ||= Fo(e);
			},
			get emit() {
				return (t, ...n) => e.emit(t, ...n);
			},
			expose: t
		});
	}
	return {
		attrs: new Proxy(e.attrs, Po),
		slots: e.slots,
		emit: e.emit,
		expose: t
	};
}
function Lo(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(tn(qt(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in si) return si[n](e);
		},
		has(e, t) {
			return t in e || t in si;
		}
	}) : e.proxy;
}
var Ro = /(?:^|[-_])\w/g, zo = (e) => e.replace(Ro, (e) => e.toUpperCase()).replace(/[-_]/g, "");
function Bo(e, t = !0) {
	return h(e) ? e.displayName || e.name : e.name || t && e.__name;
}
function Vo(e, t, n = !1) {
	let r = Bo(t);
	if (!r && t.__file) {
		let e = t.__file.match(/([^/\\]+)\.\w+$/);
		e && (r = e[1]);
	}
	if (!r && e) {
		let n = (e) => {
			for (let n in e) if (e[n] === t) return n;
		};
		r = n(e.components) || e.parent && n(e.parent.type.components) || n(e.appContext.components);
	}
	return r ? zo(r) : n ? "App" : "Anonymous";
}
function Ho(e) {
	return h(e) && "__vccOpts" in e;
}
var Uo = (e, t) => {
	let n = /* @__PURE__ */ rn(e, t, Oo);
	if (process.env.NODE_ENV !== "production") {
		let e = bo();
		e && e.appContext.config.warnRecursiveComputed && (n._warnRecursive = !0);
	}
	return n;
};
function Wo() {
	if (process.env.NODE_ENV === "production" || typeof window > "u") return;
	let e = { style: "color:#3ba776" }, n = { style: "color:#1677ff" }, r = { style: "color:#f5222d" }, i = { style: "color:#eb2f96" }, a = {
		__vue_custom_formatter: !0,
		header(t) {
			if (!v(t)) return null;
			if (t.__isVue) return [
				"div",
				e,
				"VueInstance"
			];
			if (/* @__PURE__ */ V(t)) {
				P();
				let n = t.value;
				return F(), [
					"div",
					{},
					[
						"span",
						e,
						p(t)
					],
					"<",
					l(n),
					">"
				];
			}
			return /* @__PURE__ */ Wt(t) ? [
				"div",
				{},
				[
					"span",
					e,
					/* @__PURE__ */ z(t) ? "ShallowReactive" : "Reactive"
				],
				"<",
				l(t),
				`>${/* @__PURE__ */ Gt(t) ? " (readonly)" : ""}`
			] : /* @__PURE__ */ Gt(t) ? [
				"div",
				{},
				[
					"span",
					e,
					/* @__PURE__ */ z(t) ? "ShallowReadonly" : "Readonly"
				],
				"<",
				l(t),
				">"
			] : null;
		},
		hasBody(e) {
			return e && e.__isVue;
		},
		body(e) {
			if (e && e.__isVue) return [
				"div",
				{},
				...o(e.$)
			];
		}
	};
	function o(e) {
		let n = [];
		e.type.props && e.props && n.push(c("props", /* @__PURE__ */ B(e.props))), e.setupState !== t && n.push(c("setup", e.setupState)), e.data !== t && n.push(c("data", /* @__PURE__ */ B(e.data)));
		let r = u(e, "computed");
		r && n.push(c("computed", r));
		let a = u(e, "inject");
		return a && n.push(c("injected", a)), n.push([
			"div",
			{},
			[
				"span",
				{ style: i.style + ";opacity:0.66" },
				"$ (internal): "
			],
			["object", { object: e }]
		]), n;
	}
	function c(e, t) {
		return t = s({}, t), Object.keys(t).length ? [
			"div",
			{ style: "line-height:1.25em;margin-bottom:0.6em" },
			[
				"div",
				{ style: "color:#476582" },
				e
			],
			[
				"div",
				{ style: "padding-left:1.25em" },
				...Object.keys(t).map((e) => [
					"div",
					{},
					[
						"span",
						i,
						e + ": "
					],
					l(t[e], !1)
				])
			]
		] : ["span", {}];
	}
	function l(e, t = !0) {
		return typeof e == "number" ? [
			"span",
			n,
			e
		] : typeof e == "string" ? [
			"span",
			r,
			JSON.stringify(e)
		] : typeof e == "boolean" ? [
			"span",
			i,
			e
		] : v(e) ? ["object", { object: t ? /* @__PURE__ */ B(e) : e }] : [
			"span",
			r,
			String(e)
		];
	}
	function u(e, t) {
		let n = e.type;
		if (h(n)) return;
		let r = {};
		for (let i in e.ctx) f(n, i, t) && (r[i] = e.ctx[i]);
		return r;
	}
	function f(e, t, n) {
		let r = e[n];
		if (d(r) && r.includes(t) || v(r) && t in r || e.extends && f(e.extends, t, n) || e.mixins && e.mixins.some((e) => f(e, t, n))) return !0;
	}
	function p(e) {
		return /* @__PURE__ */ z(e) ? "ShallowRef" : e.effect ? "ComputedRef" : "Ref";
	}
	window.devtoolsFormatters ? window.devtoolsFormatters.push(a) : window.devtoolsFormatters = [a];
}
var Go = "3.5.42", Ko = process.env.NODE_ENV === "production" ? r : H;
process.env.NODE_ENV, process.env.NODE_ENV;
//#endregion
//#region ../../../../node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js
var qo = void 0, Jo = typeof window < "u" && window.trustedTypes;
if (Jo) try {
	qo = /* @__PURE__ */ Jo.createPolicy("vue", { createHTML: (e) => e });
} catch (e) {
	process.env.NODE_ENV !== "production" && Ko(`Error creating trusted types policy: ${e}`);
}
var Yo = qo ? (e) => qo.createHTML(e) : (e) => e, Xo = "http://www.w3.org/2000/svg", Zo = "http://www.w3.org/1998/Math/MathML", Qo = typeof document < "u" ? document : null, $o = Qo && /* @__PURE__ */ Qo.createElement("template"), es = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? Qo.createElementNS(Xo, e) : t === "mathml" ? Qo.createElementNS(Zo, e) : n ? Qo.createElement(e, { is: n }) : Qo.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => Qo.createTextNode(e),
	createComment: (e) => Qo.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => Qo.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			$o.innerHTML = Yo(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = $o.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, ts = /* @__PURE__ */ Symbol("_vtc");
function ns(e, t, n) {
	let r = e[ts];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var rs = /* @__PURE__ */ Symbol("_vod"), is = /* @__PURE__ */ Symbol("_vsh"), as = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "CSS_VAR_TEXT"), os = /(?:^|;)\s*display\s*:/;
function ss(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? us(r, t, "");
			}
			else for (let e in t) n[e] ?? us(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? us(r, i, "") : ms(e, i, !g(t) && t ? t[i] : void 0, o) || us(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[as];
			e && (n += ";" + e), r.cssText = n, a = os.test(n);
		}
	} else t && e.removeAttribute("style");
	rs in e && (e[rs] = a ? r.display : "", e[is] && (r.display = "none"));
}
var cs = /[^\\];\s*$/, ls = /\s*!important$/;
function us(e, t, n) {
	if (d(n)) n.forEach((n) => us(e, t, n));
	else if (n ??= "", process.env.NODE_ENV !== "production" && cs.test(n) && Ko(`Unexpected semicolon at the end of '${t}' style value: '${n}'`), t.startsWith("--")) ls.test(n) ? e.setProperty(t, n.replace(ls, ""), "important") : e.setProperty(t, n);
	else {
		let r = ps(e, t);
		ls.test(n) ? e.setProperty(D(r), n.replace(ls, ""), "important") : e[r] = n;
	}
}
var ds = [
	"Webkit",
	"Moz",
	"ms"
], fs = {};
function ps(e, t) {
	let n = fs[t];
	if (n) return n;
	let r = E(t);
	if (r !== "filter" && r in e) return fs[t] = r;
	r = ie(r);
	for (let n = 0; n < ds.length; n++) {
		let i = ds[n] + r;
		if (i in e) return fs[t] = i;
	}
	return t;
}
function ms(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var hs = "http://www.w3.org/1999/xlink";
function gs(e, t, n, r, i, a = Ce(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(hs, t.slice(6, t.length)) : e.setAttributeNS(hs, t, n) : n == null || a && !we(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function _s(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? Yo(n) : n);
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
		r === "boolean" ? n = we(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch (e) {
		process.env.NODE_ENV !== "production" && !o && Ko(`Failed setting prop "${t}" on <${a.toLowerCase()}>: value ${n} is invalid.`, e);
	}
	o && e.removeAttribute(i || t);
}
function vs(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function ys(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var bs = /* @__PURE__ */ Symbol("_vei");
function xs(e, t, n, r, i = null) {
	let a = e[bs] || (e[bs] = {}), o = a[t];
	if (r && o) o.value = process.env.NODE_ENV === "production" ? r : ks(r, t);
	else {
		let [n, s] = ws(t);
		r ? vs(e, n, a[t] = Os(process.env.NODE_ENV === "production" ? r : ks(r, t), i), s) : o && (ys(e, n, o, s), a[t] = void 0);
	}
}
var Ss = /(Once|Passive|Capture)$/, Cs = /^on:?(?:Once|Passive|Capture)$/;
function ws(e) {
	let t, n;
	for (; (n = e.match(Ss)) && !Cs.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : D(e.slice(2)), t];
}
var Ts = 0, Es = /* @__PURE__ */ Promise.resolve(), Ds = () => Ts ||= (Es.then(() => Ts = 0), Date.now());
function Os(e, t) {
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
	return n.value = e, n.attached = Ds(), n;
}
function ks(e, t) {
	return h(e) || d(e) ? e : (Ko(`Wrong type passed as event handler to ${t} - did you forget @ or : in front of your prop?
Expected function or array of functions, received type ${typeof e}.`), r);
}
var As = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, js = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? ns(e, r, c) : t === "style" ? ss(e, n, r) : a(t) ? o(t) || xs(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Ms(e, t, r, c)) ? (_s(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && gs(e, t, r, c, s, t !== "value")) : e._isVueCE && (Ns(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? _s(e, E(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), gs(e, t, r, c));
};
function Ms(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && As(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return As(t) && g(n) ? !1 : t in e;
}
function Ns(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = E(t);
	return Array.isArray(n) ? n.some((e) => E(e) === r) : Object.keys(n).some((e) => E(e) === r);
}
var Ps = /* @__PURE__ */ s({ patchProp: js }, es), Fs;
function Is() {
	return Fs ||= ja(Ps);
}
var Ls = ((...e) => {
	let t = Is().createApp(...e);
	process.env.NODE_ENV !== "production" && (zs(t), Bs(t));
	let { mount: n } = t;
	return t.mount = (e) => {
		let r = Vs(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, Rs(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function Rs(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function zs(e) {
	Object.defineProperty(e.config, "isNativeTag", {
		value: (e) => ye(e) || be(e) || xe(e),
		writable: !1
	});
}
function Bs(e) {
	if (Mo()) {
		let t = e.config.isCustomElement;
		Object.defineProperty(e.config, "isCustomElement", {
			get() {
				return t;
			},
			set() {
				Ko("The `isCustomElement` config option is deprecated. Use `compilerOptions.isCustomElement` instead.");
			}
		});
		let n = e.config.compilerOptions, r = "The `compilerOptions` config option is only respected when using a build of Vue.js that includes the runtime compiler (aka \"full build\"). Since you are using the runtime-only build, `compilerOptions` must be passed to `@vue/compiler-dom` in the build setup instead.\n- For vue-loader: pass it via vue-loader's `compilerOptions` loader option.\n- For vue-cli: see https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-loader\n- For vite: pass it via @vitejs/plugin-vue options. See https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue#example-for-passing-options-to-vuecompiler-sfc";
		Object.defineProperty(e.config, "compilerOptions", {
			get() {
				return Ko(r), n;
			},
			set() {
				Ko(r);
			}
		});
	}
}
function Vs(e) {
	if (g(e)) {
		let t = document.querySelector(e);
		return process.env.NODE_ENV !== "production" && !t && Ko(`Failed to mount app: mount target selector "${e}" returned null.`), t;
	}
	return process.env.NODE_ENV !== "production" && window.ShadowRoot && e instanceof window.ShadowRoot && e.mode === "closed" && Ko("mounting on a ShadowRoot with `{mode: \"closed\"}` may lead to unpredictable bugs"), e;
}
//#endregion
//#region ../../../../node_modules/vue/dist/vue.runtime.esm-bundler.js
function Hs() {
	Wo();
}
process.env.NODE_ENV !== "production" && Hs();
//#endregion
//#region src/LiveScreenshot.vue?vue&type=script&setup=true&lang.ts
var Us = {
	class: "live-screenshot-card",
	"data-live-screenshot-card": ""
}, Ws = { class: "live-screenshot-heading" }, Gs = { class: "live-screenshot-stage" }, Ks = ["src", "alt"], qs = {
	key: 1,
	class: "muted"
}, Js = { class: "live-screenshot-footer" }, Ys = { class: "muted" }, Xs = { class: "muted" }, Zs = /* @__PURE__ */ Mr({
	__name: "LiveScreenshot",
	props: {
		host: {},
		context: {}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ Xt("waiting_run"), r = /* @__PURE__ */ Xt(""), i = /* @__PURE__ */ Xt(""), a = /* @__PURE__ */ Xt(""), o = null, s = null, c = !1;
		function l(e, n = {}, r = "") {
			return t.host.i18n.t(e, n, r);
		}
		function u() {
			return String(t.context?.primaryId || "").trim();
		}
		async function d() {
			if (!(c || s || !u())) {
				s = new AbortController();
				try {
					let e = await t.host.executionPreview.capture(u(), s.signal);
					if (c) return;
					n.value = e.state === "ready" && e.url ? "ready" : e.state, a.value = e.url || "", r.value = e.source === "emulator" ? l("emulator", {}, "模拟器") : e.source ? l("pc_game", {}, "PC 游戏") : "", i.value = e.capturedAt ? l("recent_update", { time: t.host.i18n.formatTime(e.capturedAt, { hour12: !1 }) }, `最近更新 ${e.capturedAt}`) : "";
				} catch (e) {
					!c && e?.name !== "AbortError" && (n.value = "unavailable", a.value = "");
				} finally {
					s = null;
				}
			}
		}
		function f() {
			return n.value === "waiting_for_game" || n.value === "window_not_ready" ? l("waiting_game", {}, "正在等待游戏窗口…") : n.value === "emulator_not_ready" ? l("waiting_emulator", {}, "正在等待模拟器画面…") : n.value === "unavailable" ? l("unavailable", {}, "暂时无法获取游戏窗口画面") : l("waiting_run", {}, "等待任务画面");
		}
		return Jr(() => {
			d(), o = setInterval(() => void d(), 5e3);
		}), Zr(() => {
			c = !0, o && clearInterval(o), s?.abort();
		}), (e, t) => (qa(), Qa("section", Us, [
			io("div", Ws, [io("strong", null, ke(l("title", {}, "实时画面")), 1), io("span", { class: he(["badge", n.value === "ready" ? "ok" : "muted"]) }, ke(r.value || l("waiting", {}, "等待")), 3)]),
			io("div", Gs, [a.value ? (qa(), Qa("img", {
				key: 0,
				class: "live-screenshot-image",
				src: a.value,
				alt: l("current_game", {}, "当前游戏画面")
			}, null, 8, Ks)) : (qa(), Qa("span", qs, ke(f()), 1))]),
			io("div", Js, [io("span", Ys, ke(i.value), 1), io("span", Xs, ke(l("refresh", {}, "每 5 秒更新")), 1)])
		]));
	}
});
//#endregion
//#region src/main.ts
function Qs(e) {
	return e.slots.register("dispatch.running.sidecar", (t) => {
		let n = Ls(Zs, {
			host: e,
			context: t.context
		});
		return n.mount(t.element), () => n.unmount();
	});
}
//#endregion
export { Qs as activate };
