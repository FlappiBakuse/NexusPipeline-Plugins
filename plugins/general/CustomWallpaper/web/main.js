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
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, ee = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), te = /* @__PURE__ */ e("bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"), ne = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, re = /-\w/g, T = ne((e) => e.replace(re, (e) => e.slice(1).toUpperCase())), ie = /\B([A-Z])/g, E = ne((e) => e.replace(ie, "-$1").toLowerCase()), ae = ne((e) => e.charAt(0).toUpperCase() + e.slice(1)), oe = ne((e) => e ? `on${ae(e)}` : ""), D = (e, t) => !Object.is(e, t), se = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, ce = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, O = (e) => {
	let t = parseFloat(e);
	return isNaN(t) ? e : t;
}, le, ue = () => le ||= typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
function de(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = g(r) ? he(r) : de(r);
			if (i) for (let e in i) t[e] = i[e];
		}
		return t;
	}
	if (g(e) || v(e)) return e;
}
var fe = /;(?![^(]*\))/g, pe = /:([^]+)/, me = /\/\*[^]*?\*\//g;
function he(e) {
	let t = {};
	return e.replace(me, "").split(fe).forEach((e) => {
		if (e) {
			let n = e.split(pe);
			n.length > 1 && (t[n[0].trim()] = n[1].trim());
		}
	}), t;
}
function ge(e) {
	let t = "";
	if (g(e)) t = e;
	else if (d(e)) for (let n = 0; n < e.length; n++) {
		let r = ge(e[n]);
		r && (t += r + " ");
	}
	else if (v(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
var _e = "html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot", ve = "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view", ye = "annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics", be = /* @__PURE__ */ e(_e), xe = /* @__PURE__ */ e(ve), Se = /* @__PURE__ */ e(ye), Ce = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", we = /* @__PURE__ */ e(Ce);
Ce + "";
function Te(e) {
	return !!e || e === "";
}
function Ee(e, t) {
	if (e.length !== t.length) return !1;
	let n = !0;
	for (let r = 0; n && r < e.length; r++) n = Oe(e[r], t[r]);
	return n;
}
function De(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && Oe(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function Oe(e, t) {
	if (e === t) return !0;
	let n = m(e), r = m(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = _(e), r = _(t), n || r) return e === t;
	if (n = d(e), r = d(t), n || r) return n && r ? Ee(e, t) : !1;
	if (n = v(e), r = v(t), n || r) {
		if (!n || !r) return !1;
		if (n = f(e), r = f(t), n || r || (n = p(e), r = p(t), n || r)) return n && r ? De(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !Oe(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
var ke = (e) => !!(e && e.__v_isRef === !0), k = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? ke(e) ? k(e.value) : JSON.stringify(e, Ae, 2) : String(e), Ae = (e, t) => ke(t) ? Ae(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[je(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => je(e)) } : _(t) ? je(t) : v(t) && !d(t) && !C(t) ? String(t) : t, je = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e;
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
		this.flags |= 2, Xe(this), He(this);
		let e = M, t = Je;
		M = this, Je = !0;
		try {
			return this.fn();
		} finally {
			process.env.NODE_ENV !== "production" && M !== this && A("Active effect was not restored correctly - this is likely a Vue internal bug."), Ue(this), M = e, Je = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) Ke(e);
			this.deps = this.depsTail = void 0, Xe(this), this.onStop && this.onStop(), this.flags &= -2;
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
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ze) || (e.globalVersion = Ze, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !We(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = M, r = Je;
	M = e, Je = !0;
	try {
		He(e);
		let n = e.fn(e._value);
		(t.version === 0 || D(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		M = n, Je = r, Ue(e), e.flags &= -3;
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
var Je = !0, Ye = [];
function N() {
	Ye.push(Je), Je = !1;
}
function P() {
	let e = Ye.pop();
	Je = e === void 0 || e;
}
function Xe(e) {
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
var Ze = 0, Qe = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, $e = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0, process.env.NODE_ENV !== "production" && (this.subsHead = void 0);
	}
	track(e) {
		if (!M || !Je || M === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== M) t = this.activeLink = new Qe(M, this), M.deps ? (t.prevDep = M.depsTail, M.depsTail.nextDep = t, M.depsTail = t) : M.deps = M.depsTail = t, et(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = M.depsTail, t.nextDep = void 0, M.depsTail.nextDep = t, M.depsTail = t, M.deps === t && (M.deps = e);
		}
		return process.env.NODE_ENV !== "production" && M.onTrack && M.onTrack(s({ effect: M }, e)), t;
	}
	trigger(e) {
		this.version++, Ze++, this.notify(e);
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
function et(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) et(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), process.env.NODE_ENV !== "production" && e.dep.subsHead === void 0 && (e.dep.subsHead = e), e.dep.subs = e;
	}
}
var tt = /* @__PURE__ */ new WeakMap(), nt = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Object iterate"), rt = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Map keys iterate"), it = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Array iterate");
function F(e, t, n) {
	if (Je && M) {
		let r = tt.get(e);
		r || tt.set(e, r = /* @__PURE__ */ new Map());
		let i = r.get(n);
		i || (r.set(n, i = new $e()), i.map = r, i.key = n), process.env.NODE_ENV === "production" ? i.track() : i.track({
			target: e,
			type: t,
			key: n
		});
	}
}
function at(e, t, n, r, i, a) {
	let o = tt.get(e);
	if (!o) {
		Ze++;
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
				(n === "length" || n === it || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(it)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(nt)), f(e) && s(o.get(rt)));
				break;
			case "delete":
				i || (s(o.get(nt)), f(e) && s(o.get(rt)));
				break;
			case "set": f(e) && s(o.get(nt));
		}
	}
	Ve();
}
function ot(e) {
	let t = /* @__PURE__ */ R(e);
	return t === e ? t : (F(t, "iterate", it), /* @__PURE__ */ L(e) ? t : t.map(z));
}
function st(e) {
	return F(e = /* @__PURE__ */ R(e), "iterate", it), e;
}
function ct(e, t) {
	return /* @__PURE__ */ I(e) ? Xt(/* @__PURE__ */ qt(e) ? z(t) : t) : z(t);
}
var lt = {
	__proto__: null,
	[Symbol.iterator]() {
		return ut(this, Symbol.iterator, (e) => ct(this, e));
	},
	concat(...e) {
		return ot(this).concat(...e.map((e) => d(e) ? ot(e) : e));
	},
	entries() {
		return ut(this, "entries", (e) => (e[1] = ct(this, e[1]), e));
	},
	every(e, t) {
		return ft(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return ft(this, "filter", e, t, (e) => e.map((e) => ct(this, e)), arguments);
	},
	find(e, t) {
		return ft(this, "find", e, t, (e) => ct(this, e), arguments);
	},
	findIndex(e, t) {
		return ft(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return ft(this, "findLast", e, t, (e) => ct(this, e), arguments);
	},
	findLastIndex(e, t) {
		return ft(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return ft(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return mt(this, "includes", e);
	},
	indexOf(...e) {
		return mt(this, "indexOf", e);
	},
	join(e) {
		return ot(this).join(e);
	},
	lastIndexOf(...e) {
		return mt(this, "lastIndexOf", e);
	},
	map(e, t) {
		return ft(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return ht(this, "pop");
	},
	push(...e) {
		return ht(this, "push", e);
	},
	reduce(e, ...t) {
		return pt(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return pt(this, "reduceRight", e, t);
	},
	shift() {
		return ht(this, "shift");
	},
	some(e, t) {
		return ft(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return ht(this, "splice", e);
	},
	toReversed() {
		return ot(this).toReversed();
	},
	toSorted(e) {
		return ot(this).toSorted(e);
	},
	toSpliced(...e) {
		return ot(this).toSpliced(...e);
	},
	unshift(...e) {
		return ht(this, "unshift", e);
	},
	values() {
		return ut(this, "values", (e) => ct(this, e));
	}
};
function ut(e, t, n) {
	let r = st(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ L(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var dt = Array.prototype;
function ft(e, t, n, r, i, a) {
	let o = st(e), s = o !== e && !/* @__PURE__ */ L(e), c = o[t];
	if (c !== dt[t]) {
		let t = c.apply(e, a);
		return s ? z(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, ct(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function pt(e, t, n, r) {
	let i = st(e), a = i !== e && !/* @__PURE__ */ L(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = ct(e, t)), n.call(this, t, ct(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? ct(e, c) : c;
}
function mt(e, t, n) {
	let r = /* @__PURE__ */ R(e);
	F(r, "iterate", it);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Jt(n[0]) ? (n[0] = /* @__PURE__ */ R(n[0]), r[t](...n)) : i;
}
function ht(e, t, n = []) {
	N(), Be();
	let r = (/* @__PURE__ */ R(e))[t].apply(e, n);
	return Ve(), P(), r;
}
var gt = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), _t = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function vt(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ R(this);
	return F(t, "has", e), t.hasOwnProperty(e);
}
var yt = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Bt : zt : i ? Rt : Lt).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = lt[t])) return e;
			if (t === "hasOwnProperty") return vt;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ B(e) ? e : n);
		if ((_(t) ? _t.has(t) : gt(t)) || (r || F(e, "get", t), i)) return o;
		if (/* @__PURE__ */ B(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ Wt(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ Wt(o) : /* @__PURE__ */ Ht(o) : o;
	}
}, bt = class extends yt {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let r = /* @__PURE__ */ I(i);
			if (!/* @__PURE__ */ L(n) && !/* @__PURE__ */ I(n) && (i = /* @__PURE__ */ R(i), n = /* @__PURE__ */ R(n)), !a && /* @__PURE__ */ B(i) && !/* @__PURE__ */ B(n)) return r ? (process.env.NODE_ENV !== "production" && A(`Set operation on key "${String(t)}" failed: target is readonly.`, e[t]), !0) : (i.value = n, !0);
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ B(e) ? e : r);
		return e === /* @__PURE__ */ R(r) && s && (o ? D(n, i) && at(e, "set", t, n, i) : at(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && at(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!_(t) || !_t.has(t)) && F(e, "has", t), n;
	}
	ownKeys(e) {
		return F(e, "iterate", d(e) ? "length" : nt), Reflect.ownKeys(e);
	}
}, xt = class extends yt {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return process.env.NODE_ENV !== "production" && A(`Set operation on key "${String(t)}" failed: target is readonly.`, e), !0;
	}
	deleteProperty(e, t) {
		return process.env.NODE_ENV !== "production" && A(`Delete operation on key "${String(t)}" failed: target is readonly.`, e), !0;
	}
}, St = /* @__PURE__ */ new bt(), Ct = /* @__PURE__ */ new xt(), wt = /* @__PURE__ */ new bt(!0), Tt = /* @__PURE__ */ new xt(!0), Et = (e) => e, Dt = (e) => Reflect.getPrototypeOf(e);
function Ot(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ R(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? Et : t ? Xt : z;
		return !t && F(a, "iterate", l ? rt : nt), s(Object.create(u), { next() {
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
function kt(e) {
	return function(...t) {
		if (process.env.NODE_ENV !== "production") {
			let n = t[0] ? `on key "${t[0]}" ` : "";
			A(`${ae(e)} operation ${n}failed: target is readonly.`, /* @__PURE__ */ R(this));
		}
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function At(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ R(r), a = /* @__PURE__ */ R(n);
			e || (D(n, a) && F(i, "get", n), F(i, "get", a));
			let { has: o } = Dt(i), s = t ? Et : e ? Xt : z;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && F(/* @__PURE__ */ R(t), "iterate", nt), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ R(n), i = /* @__PURE__ */ R(t);
			return e || (D(t, i) && F(r, "has", t), F(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ R(a), s = t ? Et : e ? Xt : z;
			return !e && F(o, "iterate", nt), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: kt("add"),
		set: kt("set"),
		delete: kt("delete"),
		clear: kt("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ R(this), r = Dt(n), i = /* @__PURE__ */ R(e), a = !t && !/* @__PURE__ */ L(e) && !/* @__PURE__ */ I(e) ? i : e;
			return r.has.call(n, a) || D(e, a) && r.has.call(n, e) || D(i, a) && r.has.call(n, i) || (n.add(a), at(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ L(n) && !/* @__PURE__ */ I(n) && (n = /* @__PURE__ */ R(n));
			let r = /* @__PURE__ */ R(this), { has: i, get: a } = Dt(r), o = i.call(r, e);
			o ? process.env.NODE_ENV !== "production" && It(r, i, e) : (e = /* @__PURE__ */ R(e), o = i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? D(n, s) && at(r, "set", e, n, s) : at(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ R(this), { has: n, get: r } = Dt(t), i = n.call(t, e);
			i ? process.env.NODE_ENV !== "production" && It(t, n, e) : (e = /* @__PURE__ */ R(e), i = n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && at(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ R(this), t = e.size !== 0, n = process.env.NODE_ENV === "production" ? void 0 : f(e) ? new Map(e) : new Set(e), r = e.clear();
			return t && at(e, "clear", void 0, void 0, n), r;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = Ot(r, e, t);
	}), n;
}
function jt(e, t) {
	let n = At(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(u(n, r) && r in t ? n : t, r, i);
}
var Mt = { get: /* @__PURE__ */ jt(!1, !1) }, Nt = { get: /* @__PURE__ */ jt(!1, !0) }, Pt = { get: /* @__PURE__ */ jt(!0, !1) }, Ft = { get: /* @__PURE__ */ jt(!0, !0) };
function It(e, t, n) {
	let r = /* @__PURE__ */ R(n);
	if (r !== n && t.call(e, r)) {
		let t = S(e);
		A(`Reactive ${t} contains both the raw and reactive versions of the same object${t === "Map" ? " as keys" : ""}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
	}
}
var Lt = /* @__PURE__ */ new WeakMap(), Rt = /* @__PURE__ */ new WeakMap(), zt = /* @__PURE__ */ new WeakMap(), Bt = /* @__PURE__ */ new WeakMap();
function Vt(e) {
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
function Ht(e) {
	return /* @__PURE__ */ I(e) ? e : Kt(e, !1, St, Mt, Lt);
}
// @__NO_SIDE_EFFECTS__
function Ut(e) {
	return Kt(e, !1, wt, Nt, Rt);
}
// @__NO_SIDE_EFFECTS__
function Wt(e) {
	return Kt(e, !0, Ct, Pt, zt);
}
// @__NO_SIDE_EFFECTS__
function Gt(e) {
	return Kt(e, !0, Tt, Ft, Bt);
}
function Kt(e, t, n, r, i) {
	if (!v(e)) return process.env.NODE_ENV !== "production" && A(`value cannot be made ${t ? "readonly" : "reactive"}: ${String(e)}`), e;
	if (e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = Vt(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function qt(e) {
	return /* @__PURE__ */ I(e) ? /* @__PURE__ */ qt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function I(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function L(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Jt(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function R(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ R(t) : e;
}
function Yt(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && ce(e, "__v_skip", !0), e;
}
var z = (e) => v(e) ? /* @__PURE__ */ Ht(e) : e, Xt = (e) => v(e) ? /* @__PURE__ */ Wt(e) : e;
// @__NO_SIDE_EFFECTS__
function B(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Zt(e) {
	return Qt(e, !1);
}
function Qt(e, t) {
	return /* @__PURE__ */ B(e) ? e : new $t(e, t);
}
var $t = class {
	constructor(e, t) {
		this.dep = new $e(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ R(e), this._value = t ? e : z(e), this.__v_isShallow = t;
	}
	get value() {
		return process.env.NODE_ENV === "production" ? this.dep.track() : this.dep.track({
			target: this,
			type: "get",
			key: "value"
		}), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ L(e) || /* @__PURE__ */ I(e);
		e = n ? e : /* @__PURE__ */ R(e), D(e, t) && (this._rawValue = e, this._value = n ? e : z(e), process.env.NODE_ENV === "production" ? this.dep.trigger() : this.dep.trigger({
			target: this,
			type: "set",
			key: "value",
			newValue: e,
			oldValue: t
		}));
	}
};
function en(e) {
	return /* @__PURE__ */ B(e) ? e.value : e;
}
var tn = {
	get: (e, t, n) => t === "__v_raw" ? e : en(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ B(i) && !/* @__PURE__ */ B(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function nn(e) {
	return /* @__PURE__ */ qt(e) ? e : new Proxy(e, tn);
}
var rn = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new $e(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ze - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
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
function an(e, t, n = !1) {
	let r, i;
	h(e) ? r = e : (r = e.get, i = e.set);
	let a = new rn(r, i, n);
	return process.env.NODE_ENV !== "production" && t && !n && (a.onTrack = t.onTrack, a.onTrigger = t.onTrigger), a;
}
var on = {}, sn = /* @__PURE__ */ new WeakMap(), cn = void 0;
function ln(e, t = !1, n = cn) {
	if (n) {
		let t = sn.get(n);
		t || sn.set(n, t = []), t.push(e);
	} else process.env.NODE_ENV !== "production" && !t && A("onWatcherCleanup() was called when there was no active watcher to associate with.");
}
function un(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => {
		(i.onWarn || A)("Invalid watch source: ", e, "A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.");
	}, m = (e) => o ? e : /* @__PURE__ */ L(e) || o === !1 || o === 0 ? dn(e, 1) : dn(e), g, _, v, y, b = !1, x = !1;
	if (/* @__PURE__ */ B(e) ? (_ = () => e.value, b = /* @__PURE__ */ L(e)) : /* @__PURE__ */ qt(e) ? (_ = () => m(e), b = !0) : d(e) ? (x = !0, b = e.some((e) => /* @__PURE__ */ qt(e) || /* @__PURE__ */ L(e)), _ = () => e.map((e) => {
		if (/* @__PURE__ */ B(e)) return e.value;
		if (/* @__PURE__ */ qt(e)) return m(e);
		if (h(e)) return f ? f(e, 2) : e();
		process.env.NODE_ENV !== "production" && p(e);
	})) : h(e) ? _ = n ? f ? () => f(e, 2) : e : () => {
		if (v) {
			N();
			try {
				v();
			} finally {
				P();
			}
		}
		let t = cn;
		cn = g;
		try {
			return f ? f(e, 3, [y]) : e(y);
		} finally {
			cn = t;
		}
	} : (_ = r, process.env.NODE_ENV !== "production" && p(e)), n && o) {
		let e = _, t = o === !0 ? Infinity : o;
		_ = () => dn(e(), t);
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
	let w = x ? Array(e.length).fill(on) : on, ee = (e) => {
		if (g.flags & 1 && (g.dirty || e)) {
			if (n) {
				let t = g.run();
				if (e || o || b || (x ? t.some((e, t) => D(e, w[t])) : D(t, w))) {
					v && v();
					let e = cn;
					cn = g;
					try {
						let e = [
							t,
							w === on ? void 0 : x && w[0] === on ? [] : w,
							y
						];
						w = t, f ? f(n, 3, e) : n(...e);
					} finally {
						cn = e;
					}
				}
			} else g.run();
		}
	};
	return u && u(ee), g = new Fe(_), g.scheduler = l ? () => l(ee, !1) : ee, y = (e) => ln(e, !1, g), v = g.onStop = () => {
		let e = sn.get(g);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			sn.delete(g);
		}
	}, process.env.NODE_ENV !== "production" && (g.onTrack = i.onTrack, g.onTrigger = i.onTrigger), n ? a ? ee(!0) : w = g.run() : l ? l(ee.bind(null, !0), !0) : g.run(), C.pause = g.pause.bind(g), C.resume = g.resume.bind(g), C.stop = C, C;
}
function dn(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ B(e)) dn(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) dn(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		dn(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) dn(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && dn(e[r], t, n);
	}
	return e;
}
//#endregion
//#region ../../../../node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
var fn = [];
function pn(e) {
	fn.push(e);
}
function mn() {
	fn.pop();
}
var hn = !1;
function V(e, ...t) {
	if (hn) return;
	hn = !0, N();
	let n = fn.length ? fn[fn.length - 1].component : null, r = n && n.appContext.config.warnHandler, i = gn();
	if (r) Sn(r, n, 11, [
		e + t.map((e) => e.toString?.call(e) ?? JSON.stringify(e)).join(""),
		n && n.proxy,
		i.map(({ vnode: e }) => `at <${Go(n, e.type)}>`).join("\n"),
		i
	]);
	else {
		let n = [`[Vue warn]: ${e}`, ...t];
		i.length && n.push("\n", ..._n(i)), console.warn(...n);
	}
	P(), hn = !1;
}
function gn() {
	let e = fn[fn.length - 1];
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
function _n(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push(...n === 0 ? [] : ["\n"], ...vn(e));
	}), t;
}
function vn({ vnode: e, recurseCount: t }) {
	let n = t > 0 ? `... (${t} recursive calls)` : "", r = e.component ? e.component.parent == null : !1, i = ` at <${Go(e.component, e.type, r)}`, a = ">" + n;
	return e.props ? [
		i,
		...yn(e.props),
		a
	] : [i + a];
}
function yn(e) {
	let t = [], n = Object.keys(e);
	return n.slice(0, 3).forEach((n) => {
		t.push(...bn(n, e[n]));
	}), n.length > 3 && t.push(" ..."), t;
}
function bn(e, t, n) {
	return g(t) ? (t = JSON.stringify(t), n ? t : [`${e}=${t}`]) : typeof t == "number" || typeof t == "boolean" || t == null ? n ? t : [`${e}=${t}`] : /* @__PURE__ */ B(t) ? (t = bn(e, /* @__PURE__ */ R(t.value), !0), n ? t : [
		`${e}=Ref<`,
		t,
		">"
	]) : h(t) ? [`${e}=fn${t.name ? `<${t.name}>` : ""}`] : (t = /* @__PURE__ */ R(t), n ? t : [`${e}=`, t]);
}
var xn = {
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
function Sn(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		Cn(e, t, n);
	}
}
function H(e, t, n, r) {
	if (h(e)) {
		let i = Sn(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			Cn(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(H(e[a], t, n, r));
		return i;
	}
	process.env.NODE_ENV !== "production" && V(`Invalid value type passed to callWithAsyncErrorHandling(): ${typeof e}`);
}
function Cn(e, n, r, i = !0) {
	let a = n ? n.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: s } = n && n.appContext.config || t;
	if (n) {
		let t = n.parent, i = n.proxy, a = process.env.NODE_ENV === "production" ? `https://vuejs.org/error-reference/#runtime-${r}` : xn[r];
		for (; t;) {
			let n = t.ec;
			if (n) {
				for (let t = 0; t < n.length; t++) if (n[t](e, i, a) === !1) return;
			}
			t = t.parent;
		}
		if (o) {
			N(), Sn(o, null, 10, [
				e,
				i,
				a
			]), P();
			return;
		}
	}
	wn(e, r, a, i, s);
}
function wn(e, t, n, r = !0, i = !1) {
	if (process.env.NODE_ENV !== "production") {
		let i = xn[t];
		if (n && pn(n), V(`Unhandled error${i ? ` during execution of ${i}` : ""}`), n && mn(), r) throw e;
		console.error(e);
	} else if (i) throw e;
	else console.error(e);
}
var U = [], Tn = -1, En = [], Dn = null, On = 0, kn = /* @__PURE__ */ Promise.resolve(), An = null, jn = 100;
function Mn(e) {
	let t = An || kn;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function Nn(e) {
	let t = Tn + 1, n = U.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = U[r], a = zn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function Pn(e) {
	if (!(e.flags & 1)) {
		let t = zn(e), n = U[U.length - 1];
		!n || !(e.flags & 2) && t >= zn(n) ? U.push(e) : U.splice(Nn(t), 0, e), e.flags |= 1, Fn();
	}
}
function Fn() {
	An ||= kn.then(Bn);
}
function In(e) {
	if (!d(e)) Dn && e.id === -1 ? Dn.splice(On + 1, 0, e) : e.flags & 1 || (En.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) En.push(e[t]);
	Fn();
}
function Ln(e, t, n = Tn + 1) {
	for (process.env.NODE_ENV !== "production" && (t ||= /* @__PURE__ */ new Map()); n < U.length; n++) {
		let r = U[n];
		if (r && r.flags & 2) {
			if (e && r.id !== e.uid || process.env.NODE_ENV !== "production" && Vn(t, r)) continue;
			U.splice(n, 1), n--, r.flags & 4 && (r.flags &= -2), r(), r.flags & 4 || (r.flags &= -2);
		}
	}
}
function Rn(e) {
	if (En.length) {
		let t = [...new Set(En)].sort((e, t) => zn(e) - zn(t));
		if (En.length = 0, Dn) {
			for (let e = 0; e < t.length; e++) Dn.push(t[e]);
			return;
		}
		for (Dn = t, process.env.NODE_ENV !== "production" && (e ||= /* @__PURE__ */ new Map()), On = 0; On < Dn.length; On++) {
			let t = Dn[On];
			process.env.NODE_ENV !== "production" && Vn(e, t) || (t.flags & 4 && (t.flags &= -2), t.flags & 8 || t(), t.flags &= -2);
		}
		Dn = null, On = 0;
	}
}
var zn = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function Bn(e) {
	process.env.NODE_ENV !== "production" && (e ||= /* @__PURE__ */ new Map());
	let t = process.env.NODE_ENV === "production" ? r : (t) => Vn(e, t);
	try {
		for (Tn = 0; Tn < U.length; Tn++) {
			let e = U[Tn];
			if (e && !(e.flags & 8)) {
				if (process.env.NODE_ENV !== "production" && t(e)) continue;
				e.flags & 4 && (e.flags &= -2), Sn(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2);
			}
		}
	} finally {
		for (; Tn < U.length; Tn++) {
			let e = U[Tn];
			e && (e.flags &= -2);
		}
		Tn = -1, U.length = 0, Rn(e), An = null, (U.length || En.length) && Bn(e);
	}
}
function Vn(e, t) {
	let n = e.get(t) || 0;
	if (n > jn) {
		let e = t.i, n = e && Wo(e.type);
		return Cn(`Maximum recursive updates exceeded${n ? ` in component <${n}>` : ""}. This means you have a reactive effect that is mutating its own dependencies and thus recursively triggering itself. Possible sources include component template, render function, updated hook or watcher source function.`, null, 10), !0;
	}
	return e.set(t, n + 1), !1;
}
var W = !1, Hn = (e) => {
	try {
		return W;
	} finally {
		W = e;
	}
}, Un = /* @__PURE__ */ new Map();
process.env.NODE_ENV !== "production" && (ue().__VUE_HMR_RUNTIME__ = {
	createRecord: Qn(qn),
	rerender: Qn(Yn),
	reload: Qn(Xn)
});
var Wn = /* @__PURE__ */ new Map();
function Gn(e) {
	let t = e.type.__hmrId, n = Wn.get(t);
	n ||= (qn(t, e.type), Wn.get(t)), n.instances.add(e);
}
function Kn(e) {
	Wn.get(e.type.__hmrId).instances.delete(e);
}
function qn(e, t) {
	return !Wn.has(e) && (Wn.set(e, {
		initialDef: Jn(t),
		instances: /* @__PURE__ */ new Set()
	}), !0);
}
function Jn(e) {
	return Ko(e) ? e.__vccOpts : e;
}
function Yn(e, t) {
	let n = Wn.get(e);
	n && (n.initialDef.render = t, [...n.instances].forEach((e) => {
		t && (e.render = t, Jn(e.type).render = t), e.renderCache = [], W = !0, e.job.flags & 8 || e.update(), W = !1;
	}));
}
function Xn(e, t) {
	let n = Wn.get(e);
	if (!n) return;
	t = Jn(t), Zn(n.initialDef, t);
	let r = [...n.instances];
	for (let e = 0; e < r.length; e++) {
		let i = r[e], a = Jn(i.type), o = Un.get(a);
		o || (a !== n.initialDef && Zn(a, t), Un.set(a, o = /* @__PURE__ */ new Set())), o.add(i), i.appContext.propsCache.delete(i.type), i.appContext.emitsCache.delete(i.type), i.appContext.optionsCache.delete(i.type), i.ceReload ? (o.add(i), i.ceReload(t.styles), o.delete(i)) : i.parent ? Pn(() => {
			i.job.flags & 8 || (W = !0, i.parent.update(), W = !1, o.delete(i));
		}) : i.appContext.reload ? i.appContext.reload() : typeof window < "u" ? window.location.reload() : console.warn("[HMR] Root or manually mounted instance modified. Full reload required."), i.root.ce && i !== i.root && i.root.ce._removeChildStyle(a);
	}
	In(() => {
		Un.clear();
	});
}
function Zn(e, t) {
	s(e, t);
	for (let n in e) n !== "__file" && !(n in t) && delete e[n];
}
function Qn(e) {
	return (t, n) => {
		try {
			return e(t, n);
		} catch (e) {
			console.error(e), console.warn("[HMR] Something went wrong during Vue component hot-reload. Full reload required.");
		}
	};
}
var $n, er = [], tr = !1;
function nr(e, ...t) {
	$n ? $n.emit(e, ...t) : tr || er.push({
		event: e,
		args: t
	});
}
function rr(e, t) {
	$n = e, $n ? ($n.enabled = !0, er.forEach(({ event: e, args: t }) => $n.emit(e, ...t)), er = []) : typeof window < "u" && window.HTMLElement && !(window.navigator?.userAgent)?.includes("jsdom") ? ((t.__VUE_DEVTOOLS_HOOK_REPLAY__ = t.__VUE_DEVTOOLS_HOOK_REPLAY__ || []).push((e) => {
		rr(e, t);
	}), setTimeout(() => {
		$n || (t.__VUE_DEVTOOLS_HOOK_REPLAY__ = null, tr = !0, er = []);
	}, 3e3)) : (tr = !0, er = []);
}
function ir(e, t) {
	nr("app:init", e, t, {
		Fragment: J,
		Text: qa,
		Comment: Y,
		Static: Ja
	});
}
function ar(e) {
	nr("app:unmount", e);
}
var or = /* @__PURE__ */ ur("component:added"), sr = /* @__PURE__ */ ur("component:updated"), cr = /* @__PURE__ */ ur("component:removed"), lr = (e) => {
	$n && typeof $n.cleanupBuffer == "function" && !$n.cleanupBuffer(e) && cr(e);
};
// @__NO_SIDE_EFFECTS__
function ur(e) {
	return (t) => {
		nr(e, t.appContext.app, t.uid, t.parent ? t.parent.uid : void 0, t);
	};
}
var dr = /* @__PURE__ */ pr("perf:start"), fr = /* @__PURE__ */ pr("perf:end");
function pr(e) {
	return (t, n, r) => {
		nr(e, t.appContext.app, t.uid, t, n, r);
	};
}
function mr(e, t, n) {
	nr("component:emit", e.appContext.app, e, t, n);
}
var G = null, hr = null;
function gr(e) {
	let t = G;
	return G = e, hr = e && e.type.__scopeId || null, t;
}
function _r(e, t = G, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && $a(-1);
		let i = gr(t), a = Ya.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = Ya.length; e > a; e--) Za();
			gr(i), r._d && $a(1);
		}
		return process.env.NODE_ENV !== "production" && sr(t), o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function vr(e) {
	te(e) && V("Do not use built-in directive ids as custom directive id: " + e);
}
function yr(e, n) {
	if (G === null) return process.env.NODE_ENV !== "production" && V("withDirectives can only be used inside render functions."), e;
	let r = Vo(G), i = e.dirs ||= [];
	for (let e = 0; e < n.length; e++) {
		let [a, o, s, c = t] = n[e];
		a && (h(a) && (a = {
			mounted: a,
			updated: a
		}), a.deep && dn(o), i.push({
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
function br(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (N(), H(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), P());
	}
}
function xr(e, t) {
	if (process.env.NODE_ENV !== "production" && (!$ || $.isMounted) && V("provide() can only be used inside setup()."), $) {
		let n = $.provides, r = $.parent && $.parent.provides;
		r === n && (n = $.provides = Object.create(r)), n[e] = t;
	}
}
function Sr(e, t, n = !1) {
	let r = wo();
	if (r || Li) {
		let i = Li ? Li._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
		process.env.NODE_ENV !== "production" && V(`injection "${String(e)}" not found.`);
	} else process.env.NODE_ENV !== "production" && V("inject() can only be used inside setup() or functional components.");
}
var Cr = /* @__PURE__ */ Symbol.for("v-scx"), wr = () => {
	{
		let e = Sr(Cr);
		return e || process.env.NODE_ENV !== "production" && V("Server rendering context not provided. Make sure to only call useSSRContext() conditionally in the server build."), e;
	}
};
function Tr(e, t, n) {
	return process.env.NODE_ENV !== "production" && !h(t) && V("`watch(fn, options?)` signature has been moved to a separate API. Use `watchEffect(fn, options?)` instead. `watch` now only supports `watch(source, cb, options?) signature."), Er(e, t, n);
}
function Er(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i;
	process.env.NODE_ENV !== "production" && !n && (a !== void 0 && V("watch() \"immediate\" option is only respected when using the watch(source, callback, options?) signature."), o !== void 0 && V("watch() \"deep\" option is only respected when using the watch(source, callback, options?) signature."), l !== void 0 && V("watch() \"once\" option is only respected when using the watch(source, callback, options?) signature."));
	let u = s({}, i);
	process.env.NODE_ENV !== "production" && (u.onWarn = V);
	let d = n && a || !n && c !== "post", f;
	if (Mo) {
		if (c === "sync") {
			let e = wr();
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
		t ? e() : Pn(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = un(e, n, u);
	return Mo && (f ? f.push(h) : d && h()), h;
}
function Dr(e, t, n) {
	let r = this.proxy, i = g(e) ? e.includes(".") ? Or(r, e) : () => r[e] : e.bind(r, r), a;
	h(t) ? a = t : (a = t.handler, n = t);
	let o = Do(this), s = Er(i, a.bind(r), n);
	return o(), s;
}
function Or(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var kr = /* @__PURE__ */ Symbol("_vte"), Ar = (e) => e.__isTeleport, jr = /* @__PURE__ */ Symbol("_leaveCb");
function Mr(e) {
	let t = e[0];
	if (e.length > 1) {
		let n = !1;
		for (let r of e) if (r.type !== Y) {
			if (process.env.NODE_ENV !== "production" && n) {
				V("<transition> can only be used on a single element or component. Use <transition-group> for lists.");
				break;
			}
			if (t = r, n = !0, process.env.NODE_ENV === "production") break;
		}
	}
	return t;
}
function Nr(e) {
	if (!Ur(e)) return Ar(e.type) && e.children ? Mr(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Pr(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Pr(Ar(n.type) && Nr(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
// @__NO_SIDE_EFFECTS__
function Fr(e, t) {
	return h(e) ? /* @__PURE__ */ s({ name: e.name }, t, { setup: e }) : e;
}
function Ir(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
var Lr = /* @__PURE__ */ new WeakSet();
function Rr(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var zr = /* @__PURE__ */ new WeakMap();
function Br(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => Br(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (Hr(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Br(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? Vo(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e;
	if (process.env.NODE_ENV !== "production" && !f) {
		V("Missing ref owner context. ref cannot be used on hoisted vnodes. A vnode with ref must be created inside the render function.");
		return;
	}
	let m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ R(v), b = v === t ? i : (e) => process.env.NODE_ENV !== "production" && (u(y, e) && !/* @__PURE__ */ B(y[e]) && V(`Template ref "${e}" used on a non-ref value. It will not work in the production build.`), Lr.has(y[e])) || Rr(_, e) ? !1 : u(y, e), x = (e, t) => !(process.env.NODE_ENV !== "production" && Lr.has(e) || t && Rr(_, t));
	if (m != null && m !== p) {
		if (Vr(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ B(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) Sn(p, f, 12, [l, _]);
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
				} else t ? (_[p] = l, b(p) && (v[p] = l)) : n ? (x(p, e.k) && (p.value = l), e.k && (_[e.k] = l)) : process.env.NODE_ENV !== "production" && V("Invalid template ref type:", p, `(${typeof p})`);
			};
			if (l) {
				let t = () => {
					i(), zr.delete(e);
				};
				t.id = -1, zr.set(e, t), q(t, r);
			} else Vr(e), i();
		} else process.env.NODE_ENV !== "production" && V("Invalid template ref type:", p, `(${typeof p})`);
	}
}
function Vr(e) {
	let t = zr.get(e);
	t && (t.flags |= 8, zr.delete(e));
}
ue().requestIdleCallback, ue().cancelIdleCallback;
var Hr = (e) => !!e.type.__asyncLoader, Ur = (e) => e.type.__isKeepAlive;
function Wr(e, t) {
	Kr(e, "a", t);
}
function Gr(e, t) {
	Kr(e, "da", t);
}
function Kr(e, t, n = $) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Jr(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Ur(e.parent.vnode) && qr(r, t, n, e), e = e.parent;
	}
}
function qr(e, t, n, r) {
	let i = Jr(t, e, r, !0);
	ti(() => {
		c(r[t], i);
	}, n);
}
function Jr(e, t, n = $, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			N();
			let i = Do(n), a = H(t, n, e, r);
			return i(), P(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
	process.env.NODE_ENV !== "production" && V(`${oe(xn[e].replace(/ hook$/, ""))} is called when there is no active component instance to be associated with. Lifecycle injection APIs can only be used during execution of setup(). If you are using async setup(), make sure to register lifecycle hooks before the first await statement.`);
}
var Yr = (e) => (t, n = $) => {
	(!Mo || e === "sp") && Jr(e, (...e) => t(...e), n);
}, Xr = Yr("bm"), Zr = Yr("m"), Qr = Yr("bu"), $r = Yr("u"), ei = Yr("bum"), ti = Yr("um"), ni = Yr("sp"), ri = Yr("rtg"), ii = Yr("rtc");
function ai(e, t = $) {
	Jr("ec", e, t);
}
var oi = /* @__PURE__ */ Symbol.for("v-ndc");
function si(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ qt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ L(e), s = /* @__PURE__ */ I(e), e = st(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Xt(z(e[n])) : z(e[n]) : e[n], n, void 0, a && a[n]);
	} else if (typeof e == "number") {
		if (process.env.NODE_ENV !== "production" && (!Number.isInteger(e) || e < 0)) V(`The v-for range expects a positive integer value but got ${e}.`), i = [];
		else {
			i = Array(e);
			for (let n = 0; n < e; n++) i[n] = t(n + 1, n, void 0, a && a[n]);
		}
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
var ci = (e) => e ? jo(e) ? Vo(e) : ci(e.parent) : null, li = (e) => {
	let t = !1;
	for (;;) {
		if (e.patchFlag > 0 && e.patchFlag & 2048) {
			let n = qi(e.children);
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
}, ui = (e) => {
	let t = e.subTree && li(e.subTree);
	return t === void 0 ? e.vnode.el : t;
}, di = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => process.env.NODE_ENV === "production" ? e.vnode.el : ui(e),
	$data: (e) => e.data,
	$props: (e) => process.env.NODE_ENV === "production" ? e.props : /* @__PURE__ */ Gt(e.props),
	$attrs: (e) => process.env.NODE_ENV === "production" ? e.attrs : /* @__PURE__ */ Gt(e.attrs),
	$slots: (e) => process.env.NODE_ENV === "production" ? e.slots : /* @__PURE__ */ Gt(e.slots),
	$refs: (e) => process.env.NODE_ENV === "production" ? e.refs : /* @__PURE__ */ Gt(e.refs),
	$parent: (e) => ci(e.parent),
	$root: (e) => ci(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => Ti(e),
	$forceUpdate: (e) => e.f ||= () => {
		Pn(e.update);
	},
	$nextTick: (e) => e.n ||= Mn.bind(e.proxy),
	$watch: (e) => Dr.bind(e)
}), fi = (e) => e === "_" || e === "$", pi = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), mi = {
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
			else if (pi(i, n)) return s[n] = 1, i[n];
			else if (a !== t && u(a, n)) return s[n] = 2, a[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else bi && (s[n] = 0);
		}
		let d = di[n], f, p;
		if (d) return n === "$attrs" ? (F(e.attrs, "get", ""), process.env.NODE_ENV !== "production" && Wi()) : process.env.NODE_ENV !== "production" && n === "$slots" && F(e, "get", n), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
		process.env.NODE_ENV !== "production" && G && (!g(n) || n.indexOf("__v") !== 0) && (a !== t && fi(n[0]) && u(a, n) ? V(`Property ${JSON.stringify(n)} must be accessed via $data because it starts with a reserved character ("$" or "_") and is not proxied on the render context.`) : e === G && V(`Property ${JSON.stringify(n)} was accessed during render but is not defined on instance.`));
	},
	set({ _: e }, n, r) {
		let { data: i, setupState: a, ctx: o } = e;
		return pi(a, n) ? (a[n] = r, !0) : process.env.NODE_ENV !== "production" && a.__isScriptSetup && u(a, n) ? (V(`Cannot mutate <script setup> binding "${n}" from Options API.`), !1) : i !== t && u(i, n) ? (i[n] = r, !0) : u(e.props, n) ? (process.env.NODE_ENV !== "production" && V(`Attempting to mutate prop "${n}". Props are readonly.`), !1) : n[0] === "$" && n.slice(1) in e ? (process.env.NODE_ENV !== "production" && V(`Attempting to mutate public property "${n}". Properties starting with $ are reserved and readonly.`), !1) : (process.env.NODE_ENV !== "production" && n in e.appContext.config.globalProperties ? Object.defineProperty(o, n, {
			enumerable: !0,
			configurable: !0,
			value: r
		}) : o[n] = r, !0);
	},
	has({ _: { data: e, setupState: n, accessCache: r, ctx: i, appContext: a, props: o, type: s } }, c) {
		let l;
		return !!(r[c] || e !== t && c[0] !== "$" && u(e, c) || pi(n, c) || u(o, c) || u(i, c) || u(di, c) || u(a.config.globalProperties, c) || (l = s.__cssModules) && l[c]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
process.env.NODE_ENV !== "production" && (mi.ownKeys = (e) => (V("Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead."), Reflect.ownKeys(e)));
function hi(e) {
	let t = {};
	return Object.defineProperty(t, "_", {
		configurable: !0,
		enumerable: !1,
		get: () => e
	}), Object.keys(di).forEach((n) => {
		Object.defineProperty(t, n, {
			configurable: !0,
			enumerable: !1,
			get: () => di[n](e),
			set: r
		});
	}), t;
}
function gi(e) {
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
function _i(e) {
	let { ctx: t, setupState: n } = e;
	Object.keys(/* @__PURE__ */ R(n)).forEach((e) => {
		if (!n.__isScriptSetup) {
			if (fi(e[0])) {
				V(`setup() return property ${JSON.stringify(e)} should not start with "$" or "_" which are reserved prefixes for Vue internals.`);
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
function vi(e) {
	return d(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
function yi() {
	let e = /* @__PURE__ */ Object.create(null);
	return (t, n) => {
		e[n] ? V(`${t} property "${n}" is already defined in ${e[n]}.`) : e[n] = t;
	};
}
var bi = !0;
function xi(e) {
	let t = Ti(e), n = e.proxy, i = e.ctx;
	bi = !1, t.beforeCreate && Ci(t.beforeCreate, e, "bc");
	let { data: a, computed: o, methods: s, watch: c, provide: l, inject: u, created: f, beforeMount: p, mounted: m, beforeUpdate: g, updated: _, activated: b, deactivated: x, beforeDestroy: S, beforeUnmount: C, destroyed: w, unmounted: ee, render: te, renderTracked: ne, renderTriggered: re, errorCaptured: T, serverPrefetch: ie, expose: E, inheritAttrs: ae, components: oe, directives: D, filters: se } = t, ce = process.env.NODE_ENV === "production" ? null : yi();
	if (process.env.NODE_ENV !== "production") {
		let [t] = e.propsOptions;
		if (t) for (let e in t) ce("Props", e);
	}
	if (u && Si(u, i, ce), s) for (let e in s) {
		let t = s[e];
		h(t) ? (process.env.NODE_ENV === "production" ? i[e] = t.bind(n) : Object.defineProperty(i, e, {
			value: t.bind(n),
			configurable: !0,
			enumerable: !0,
			writable: !0
		}), process.env.NODE_ENV !== "production" && ce("Methods", e)) : process.env.NODE_ENV !== "production" && V(`Method "${e}" has type "${typeof t}" in the component definition. Did you reference the function correctly?`);
	}
	if (a) {
		process.env.NODE_ENV !== "production" && !h(a) && V("The data option must be a function. Plain object usage is no longer supported.");
		let t = a.call(n, n);
		if (process.env.NODE_ENV !== "production" && y(t) && V("data() returned a Promise - note data() cannot be async; If you intend to perform data fetching before component renders, use async setup() + <Suspense>."), !v(t)) process.env.NODE_ENV !== "production" && V("data() should return an object.");
		else if (e.data = /* @__PURE__ */ Ht(t), process.env.NODE_ENV !== "production") for (let e in t) ce("Data", e), fi(e[0]) || Object.defineProperty(i, e, {
			configurable: !0,
			enumerable: !0,
			get: () => t[e],
			set: r
		});
	}
	if (bi = !0, o) for (let e in o) {
		let t = o[e], a = h(t) ? t.bind(n, n) : h(t.get) ? t.get.bind(n, n) : r;
		process.env.NODE_ENV !== "production" && a === r && V(`Computed property "${e}" has no getter.`);
		let s = qo({
			get: a,
			set: !h(t) && h(t.set) ? t.set.bind(n) : process.env.NODE_ENV === "production" ? r : () => {
				V(`Write operation failed: computed property "${e}" is readonly.`);
			}
		});
		Object.defineProperty(i, e, {
			enumerable: !0,
			configurable: !0,
			get: () => s.value,
			set: (e) => s.value = e
		}), process.env.NODE_ENV !== "production" && ce("Computed", e);
	}
	if (c) for (let e in c) wi(c[e], i, n, e);
	if (l) {
		let e = h(l) ? l.call(n) : l;
		Reflect.ownKeys(e).forEach((t) => {
			xr(t, e[t]);
		});
	}
	f && Ci(f, e, "c");
	function O(e, t) {
		d(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (O(Xr, p), O(Zr, m), O(Qr, g), O($r, _), O(Wr, b), O(Gr, x), O(ai, T), O(ii, ne), O(ri, re), O(ei, C), O(ti, ee), O(ni, ie), d(E)) {
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
	te && e.render === r && (e.render = te), ae != null && (e.inheritAttrs = ae), oe && (e.components = oe), D && (e.directives = D), ie && Ir(e);
}
function Si(e, t, n = r) {
	d(e) && (e = Ai(e));
	for (let r in e) {
		let i = e[r], a;
		a = v(i) ? "default" in i ? Sr(i.from || r, i.default, !0) : Sr(i.from || r) : Sr(i), /* @__PURE__ */ B(a) ? Object.defineProperty(t, r, {
			enumerable: !0,
			configurable: !0,
			get: () => a.value,
			set: (e) => a.value = e
		}) : t[r] = a, process.env.NODE_ENV !== "production" && n("Inject", r);
	}
}
function Ci(e, t, n) {
	H(d(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function wi(e, t, n, r) {
	let i = r.includes(".") ? Or(n, r) : () => n[r];
	if (g(e)) {
		let n = t[e];
		h(n) ? Tr(i, n) : process.env.NODE_ENV !== "production" && V(`Invalid watch handler specified by key "${e}"`, n);
	} else if (h(e)) Tr(i, e.bind(n));
	else if (v(e)) {
		if (d(e)) e.forEach((e) => wi(e, t, n, r));
		else {
			let r = h(e.handler) ? e.handler.bind(n) : t[e.handler];
			h(r) ? Tr(i, r, e) : process.env.NODE_ENV !== "production" && V(`Invalid watch handler specified by key "${e.handler}"`, r);
		}
	} else process.env.NODE_ENV !== "production" && V(`Invalid watch option: "${r}"`, e);
}
function Ti(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => Ei(c, e, o, !0)), Ei(c, t, o)), v(t) && a.set(t, c), c;
}
function Ei(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && Ei(e, a, n, !0), i && i.forEach((t) => Ei(e, t, n, !0));
	for (let i in t) if (r && i === "expose") process.env.NODE_ENV !== "production" && V("\"expose\" option is ignored when declared in mixins or extends. It should only be declared in the base component itself.");
	else {
		let r = Di[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var Di = {
	data: Oi,
	props: Mi,
	emits: Mi,
	methods: ji,
	computed: ji,
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
	components: ji,
	directives: ji,
	watch: Ni,
	provide: Oi,
	inject: ki
};
function Oi(e, t) {
	return t ? e ? function() {
		return s(h(e) ? e.call(this, this) : e, h(t) ? t.call(this, this) : t);
	} : t : e;
}
function ki(e, t) {
	return ji(Ai(e), Ai(t));
}
function Ai(e) {
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
function ji(e, t) {
	return e ? s(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Mi(e, t) {
	return e ? d(e) && d(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : s(/* @__PURE__ */ Object.create(null), vi(e), vi(t ?? {})) : t;
}
function Ni(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = s(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = K(e[r], t[r]);
	return n;
}
function Pi() {
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
var Fi = 0;
function Ii(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (process.env.NODE_ENV !== "production" && V("root props passed to app.mount() must be an object."), r = null);
		let i = Pi(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: Fi++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: Yo,
			get config() {
				return i.config;
			},
			set config(e) {
				process.env.NODE_ENV !== "production" && V("app.config cannot be replaced. Modify individual options instead.");
			},
			use(e, ...t) {
				return a.has(e) ? process.env.NODE_ENV !== "production" && V("Plugin has already been applied to target app.") : e && h(e.install) ? (a.add(e), e.install(l, ...t)) : h(e) ? (a.add(e), e(l, ...t)) : process.env.NODE_ENV !== "production" && V("A plugin must either be a function or an object with an \"install\" function."), l;
			},
			mixin(e) {
				return i.mixins.includes(e) ? process.env.NODE_ENV !== "production" && V("Mixin has already been applied to target app" + (e.name ? `: ${e.name}` : "")) : i.mixins.push(e), l;
			},
			component(e, t) {
				return process.env.NODE_ENV !== "production" && Ao(e, i.config), t ? (process.env.NODE_ENV !== "production" && i.components[e] && V(`Component "${e}" has already been registered in target app.`), i.components[e] = t, l) : i.components[e];
			},
			directive(e, t) {
				return process.env.NODE_ENV !== "production" && vr(e), t ? (process.env.NODE_ENV !== "production" && i.directives[e] && V(`Directive "${e}" has already been registered in target app.`), i.directives[e] = t, l) : i.directives[e];
			},
			mount(a, o, s) {
				if (c) process.env.NODE_ENV !== "production" && V("App has already been mounted.\nIf you want to remount the same app, move your app creation logic into a factory function and create fresh app instances for each mount - e.g. `const createMyApp = () => createApp(App)`");
				else {
					process.env.NODE_ENV !== "production" && a.__vue_app__ && V("There is already an app instance mounted on the host container.\n If you want to mount another app on the same host container, you need to unmount the previous app by calling `app.unmount()` first.");
					let u = l._ceVNode || lo(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), process.env.NODE_ENV !== "production" && (i.reload = () => {
						let t = po(u);
						t.el = null, e(t, a, s);
					}), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, process.env.NODE_ENV !== "production" && (l._instance = u.component, ir(l, Yo)), Vo(u.component);
				}
			},
			onUnmount(e) {
				process.env.NODE_ENV !== "production" && typeof e != "function" && V(`Expected function as first argument to app.onUnmount(), but got ${typeof e}`), o.push(e);
			},
			unmount() {
				c ? (H(o, l._instance, 16), e(null, l._container), process.env.NODE_ENV !== "production" && (l._instance = null, ar(l)), delete l._container.__vue_app__) : process.env.NODE_ENV !== "production" && V("Cannot unmount an app that is not mounted.");
			},
			provide(e, t) {
				return process.env.NODE_ENV !== "production" && e in i.provides && (u(i.provides, e) ? V(`App already provides property with key "${String(e)}". It will be overwritten with the new value.`) : V(`App already provides property with key "${String(e)}" inherited from its parent element. It will be overwritten with the new value.`)), i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = Li;
				Li = l;
				try {
					return e();
				} finally {
					Li = t;
				}
			}
		};
		return l;
	};
}
var Li = null, Ri = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${T(t)}Modifiers`] || e[`${E(t)}Modifiers`];
function zi(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t;
	if (process.env.NODE_ENV !== "production") {
		let { emitsOptions: t, propsOptions: [i] } = e;
		if (t) {
			if (!(n in t)) (!i || !(oe(T(n)) in i)) && V(`Component emitted event "${n}" but it is neither declared in the emits option nor as an "${oe(T(n))}" prop.`);
			else {
				let e = t[n];
				h(e) && (e(...r) || V(`Invalid event arguments: event validation failed for event "${n}".`));
			}
		}
	}
	let a = r, o = n.startsWith("update:"), s = o && Ri(i, n.slice(7));
	if (s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(O))), process.env.NODE_ENV !== "production" && mr(e, n, a), process.env.NODE_ENV !== "production") {
		let t = n.toLowerCase();
		t !== n && i[oe(t)] && V(`Event "${t}" is emitted in component ${Go(e, e.type)} but the handler is registered for "${n}". Note that HTML attributes are case-insensitive and you cannot use v-on to listen to camelCase events when using in-DOM templates. You should probably use "${E(n)}" instead of "${n}".`);
	}
	let c, l = i[c = oe(n)] || i[c = oe(T(n))];
	!l && o && (l = i[c = oe(E(n))]), l && H(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, H(u, e, 6, a);
	}
}
var Bi = /* @__PURE__ */ new WeakMap();
function Vi(e, t, n = !1) {
	let r = n ? Bi : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, c = !1;
	if (!h(e)) {
		let r = (e) => {
			let n = Vi(e, t, !0);
			n && (c = !0, s(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !c ? (v(e) && r.set(e, null), null) : (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o);
}
function Hi(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, E(t)) || u(e, t));
}
var Ui = !1;
function Wi() {
	Ui = !0;
}
function Gi(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [s], slots: c, attrs: l, emit: u, render: d, renderCache: f, props: p, data: m, setupState: h, ctx: g, inheritAttrs: _ } = e, v = gr(e), y, b;
	process.env.NODE_ENV !== "production" && (Ui = !1);
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = process.env.NODE_ENV !== "production" && h.__isScriptSetup ? new Proxy(e, { get(e, t, n) {
				return V(`Property '${String(t)}' was accessed via 'this'. Avoid using 'this' in templates.`), Reflect.get(e, t, n);
			} }) : e;
			y = Q(d.call(t, e, f, process.env.NODE_ENV === "production" ? p : /* @__PURE__ */ Gt(p), h, m, g)), b = l;
		} else {
			let e = t;
			process.env.NODE_ENV !== "production" && l === p && Wi(), y = Q(e.length > 1 ? e(process.env.NODE_ENV === "production" ? p : /* @__PURE__ */ Gt(p), process.env.NODE_ENV === "production" ? {
				attrs: l,
				slots: c,
				emit: u
			} : {
				get attrs() {
					return Wi(), /* @__PURE__ */ Gt(l);
				},
				slots: c,
				emit: u
			}) : e(process.env.NODE_ENV === "production" ? p : /* @__PURE__ */ Gt(p), null)), b = t.props ? l : Ji(l);
		}
	} catch (t) {
		Ya.length = 0, Cn(t, e, 1), y = lo(Y);
	}
	let x = y, S;
	if (process.env.NODE_ENV !== "production" && y.patchFlag > 0 && y.patchFlag & 2048 && ([x, S] = Ki(y)), b && _ !== !1) {
		let e = Object.keys(b), { shapeFlag: t } = x;
		if (e.length) {
			if (t & 7) s && e.some(o) && (b = Yi(b, s)), x = po(x, b, !1, !0);
			else if (process.env.NODE_ENV !== "production" && !Ui && x.type !== Y) {
				let e = Object.keys(l), t = [], n = [];
				for (let r = 0, i = e.length; r < i; r++) {
					let i = e[r];
					a(i) ? o(i) || t.push(i[2].toLowerCase() + i.slice(3)) : n.push(i);
				}
				n.length && V(`Extraneous non-props attributes (${n.join(", ")}) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes.`), t.length && V(`Extraneous non-emits event listeners (${t.join(", ")}) were passed to component but could not be automatically inherited because component renders fragment or text root nodes. If the listener is intended to be a component custom event listener only, declare it using the "emits" option.`);
			}
		}
	}
	if (n.dirs && (process.env.NODE_ENV !== "production" && !Xi(x) && V("Runtime directive used on component with non-element root node. The directives will not function as intended."), x = po(x, null, !1, !0), x.dirs = x.dirs ? x.dirs.concat(n.dirs) : n.dirs), n.transition) {
		let e = Ar(x.type) && Nr(x) || x;
		process.env.NODE_ENV !== "production" && !Xi(e) && V("Component inside <Transition> renders non-element root node that cannot be animated."), Pr(e, n.transition);
	}
	return process.env.NODE_ENV !== "production" && S ? S(x) : y = x, gr(v), y;
}
var Ki = (e) => {
	let t = e.children, n = e.dynamicChildren, r = qi(t, !1);
	if (!r) return [e, void 0];
	if (process.env.NODE_ENV !== "production" && r.patchFlag > 0 && r.patchFlag & 2048) return Ki(r);
	let i = t.indexOf(r), a = n ? n.indexOf(r) : -1;
	return [Q(r), (r) => {
		t[i] = r, n && (a > -1 ? n[a] = r : r.patchFlag > 0 && (e.dynamicChildren = [...n, r]));
	}];
};
function qi(e, t = !0) {
	let n;
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		if (ro(i)) {
			if (i.type !== Y || i.children === "v-if") {
				if (n) return;
				if (n = i, process.env.NODE_ENV !== "production" && t && n.patchFlag > 0 && n.patchFlag & 2048) return qi(n.children);
			}
		} else return;
	}
	return n;
}
var Ji = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Yi = (e, t) => {
	let n = {};
	for (let r in e) (!o(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
}, Xi = (e) => e.shapeFlag & 7 || e.type === Y;
function Zi(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (process.env.NODE_ENV !== "production" && (i || s) && W || t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Qi(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if ($i(o, r, n) && !Hi(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Qi(r, o, l) : !!o;
	return !1;
}
function Qi(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if ($i(t, e, a) && !Hi(n, a)) return !0;
	}
	return !1;
}
function $i(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !Oe(r, i) : r !== i;
}
function ea({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var ta = {}, na = () => Object.create(ta), ra = (e) => Object.getPrototypeOf(e) === ta;
function ia(e, t, n, r = !1) {
	let i = {}, a = na();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), sa(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	process.env.NODE_ENV !== "production" && pa(t || {}, i, e), e.props = n ? r ? i : /* @__PURE__ */ Ut(i) : e.type.props ? i : a, e.attrs = a;
}
function aa(e) {
	for (; e;) {
		if (e.type.__hmrId) return !0;
		e = e.parent;
	}
}
function oa(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ R(i), [c] = e.propsOptions, l = !1;
	if (!(process.env.NODE_ENV !== "production" && aa(e)) && (r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Hi(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = T(o);
						i[t] = ca(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		sa(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !u(t, a) && ((r = E(a)) === a || !u(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = ca(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !u(t, e)) && (delete a[e], l = !0);
	}
	l && at(e.attrs, "set", ""), process.env.NODE_ENV !== "production" && pa(t || {}, i, e);
}
function sa(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (ee(t)) continue;
		let l = n[t], d;
		a && u(a, d = T(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : Hi(e.emitsOptions, t) || (!(t in i) || l !== i[t]) && (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ R(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = ca(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function ca(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = Do(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === E(n)) && (r = !0));
	}
	return r;
}
var la = /* @__PURE__ */ new WeakMap();
function ua(e, r, i = !1) {
	let a = i ? la : r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [], p = !1;
	if (!h(e)) {
		let t = (e) => {
			p = !0;
			let [t, n] = ua(e, r, !0);
			s(l, t), n && f.push(...n);
		};
		!i && r.mixins.length && r.mixins.forEach(t), e.extends && t(e.extends), e.mixins && e.mixins.forEach(t);
	}
	if (!c && !p) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		process.env.NODE_ENV !== "production" && !g(c[e]) && V("props must be strings when using array syntax.", c[e]);
		let n = T(c[e]);
		da(n) && (l[n] = t);
	}
	else if (c) {
		process.env.NODE_ENV !== "production" && !v(c) && V("invalid props options", c);
		for (let e in c) {
			let t = T(e);
			if (da(t)) {
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
function da(e) {
	return e[0] !== "$" && !ee(e) || (process.env.NODE_ENV !== "production" && V(`Invalid prop name: "${e}" is a reserved property.`), !1);
}
function fa(e) {
	return e === null ? "null" : typeof e == "function" ? e.name || "" : typeof e == "object" && e.constructor && e.constructor.name || "";
}
function pa(e, t, n) {
	let r = /* @__PURE__ */ R(t), i = n.propsOptions[0], a = Object.keys(e).map((e) => T(e));
	for (let e in i) {
		let t = i[e];
		t != null && ma(e, r[e], t, process.env.NODE_ENV === "production" ? r : /* @__PURE__ */ Gt(r), !a.includes(e));
	}
}
function ma(e, t, n, r, i) {
	let { type: a, required: o, validator: s, skipCheck: c } = n;
	if (o && i) {
		V("Missing required prop: \"" + e + "\"");
		return;
	}
	if (t != null || o) {
		if (a != null && a !== !0 && !c) {
			let n = !1, r = d(a) ? a : [a], i = [];
			for (let e = 0; e < r.length && !n; e++) {
				let { valid: a, expectedType: o } = ga(t, r[e]);
				i.push(o || ""), n = a;
			}
			if (!n) {
				V(_a(e, t, i));
				return;
			}
		}
		s && !s(t, r) && V("Invalid prop: custom validator check failed for prop \"" + e + "\".");
	}
}
var ha = /* @__PURE__ */ e("String,Number,Boolean,Function,Symbol,BigInt");
function ga(e, t) {
	let n, r = fa(t);
	if (r === "null") n = e === null;
	else if (ha(r)) {
		let i = typeof e;
		n = i === r.toLowerCase(), !n && i === "object" && (n = e instanceof t);
	} else n = r === "Object" ? v(e) : r === "Array" ? d(e) : e instanceof t;
	return {
		valid: n,
		expectedType: r
	};
}
function _a(e, t, n) {
	if (n.length === 0) return `Prop type [] for prop "${e}" won't match anything. Did you mean to use type Array instead?`;
	let r = `Invalid prop: type check failed for prop "${e}". Expected ${n.map(ae).join(" | ")}`, i = n[0], a = S(t), o = va(t, i), s = va(t, a);
	return n.length === 1 && ya(i) && ba(i, a) && (r += ` with value ${o}`), r += `, got ${a} `, ya(a) && (r += `with value ${s}.`), r;
}
function va(e, t) {
	return _(e) ? e.toString() : t === "String" ? `"${e}"` : t === "Number" ? `${Number(e)}` : `${e}`;
}
function ya(e) {
	return [
		"string",
		"number",
		"boolean"
	].some((t) => e.toLowerCase() === t);
}
function ba(...e) {
	return e.every((e) => {
		let t = e.toLowerCase();
		return t !== "boolean" && t !== "symbol";
	});
}
var xa = (e) => e === "_" || e === "_ctx" || e === "$stable", Sa = (e) => d(e) ? e.map(Q) : [Q(e)], Ca = (e, t, n) => {
	if (t._n) return t;
	let r = _r((...r) => (process.env.NODE_ENV !== "production" && $ && !(n === null && G) && !(n && n.root !== $.root) && V(`Slot "${e}" invoked outside of the render function: this will not track dependencies used in the slot. Invoke the slot function inside the render function instead.`), Sa(t(...r))), n);
	return r._c = !1, r;
}, wa = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (xa(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = Ca(n, i, r);
		else if (i != null) {
			process.env.NODE_ENV !== "production" && V(`Non-function value encountered for slot "${n}". Prefer function slots for better performance.`);
			let e = Sa(i);
			t[n] = () => e;
		}
	}
}, Ta = (e, t) => {
	process.env.NODE_ENV !== "production" && !Ur(e.vnode) && V("Non-function value encountered for default slot. Prefer function slots for better performance.");
	let n = Sa(t);
	e.slots.default = () => n;
}, Ea = (e, t, n) => {
	for (let r in t) (n || !xa(r)) && (e[r] = t[r]);
}, Da = (e, t, n) => {
	let r = e.slots = na();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (Ea(r, t, n), n && ce(r, "_", e, !0)) : wa(t, r);
	} else t && Ta(e, t);
}, Oa = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let t = n._;
		t ? process.env.NODE_ENV !== "production" && W ? (Ea(a, n, r), at(e, "set", "$slots")) : r && t === 1 ? o = !1 : Ea(a, n, r) : (o = !n.$stable, wa(n, a)), s = n;
	} else n && (Ta(e, n), s = { default: 1 });
	if (o) for (let e in a) !xa(e) && s[e] == null && delete a[e];
}, ka, Aa;
function ja(e, t) {
	e.appContext.config.performance && Na() && Aa.mark(`vue-${t}-${e.uid}`), process.env.NODE_ENV !== "production" && dr(e, t, Na() ? Aa.now() : Date.now());
}
function Ma(e, t) {
	if (e.appContext.config.performance && Na()) {
		let n = `vue-${t}-${e.uid}`, r = n + ":end", i = `<${Go(e, e.type)}> ${t}`;
		Aa.mark(r), Aa.measure(i, n, r), Aa.clearMeasures(i), Aa.clearMarks(n), Aa.clearMarks(r);
	}
	process.env.NODE_ENV !== "production" && fr(e, t, Na() ? Aa.now() : Date.now());
}
function Na() {
	return ka === void 0 && (typeof window < "u" && window.performance ? (ka = !0, Aa = window.performance) : ka = !1), ka;
}
function Pa() {
	let e = [];
	if (process.env.NODE_ENV !== "production" && e.length) {
		let t = e.length > 1;
		console.warn(`Feature flag${t ? "s" : ""} ${e.join(", ")} ${t ? "are" : "is"} not explicitly defined. You are running the esm-bundler build of Vue, which expects these compile-time feature flags to be globally injected via the bundler config in order to get better tree-shaking in the production bundle.

For more details, see https://link.vuejs.org/feature-flags.`);
	}
}
var q = Ka;
function Fa(e) {
	return Ia(e);
}
function Ia(e, i) {
	Pa();
	let a = ue();
	a.__VUE__ = !0, process.env.NODE_ENV !== "production" && rr(a.__VUE_DEVTOOLS_GLOBAL_HOOK__, a);
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = process.env.NODE_ENV !== "production" && W ? !1 : !!t.dynamicChildren) => {
		if (e === t) return;
		e && !io(e, t) && (r = Se(e), _e(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case qa:
				y(e, t, n, r);
				break;
			case Y:
				b(e, t, n, r);
				break;
			case Ja:
				e == null ? x(t, n, r, o) : process.env.NODE_ENV !== "production" && S(e, t, n, o);
				break;
			case J:
				oe(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? te(e, t, n, r, i, a, o, s, c) : d & 6 ? D(e, t, n, r, i, a, o, s, c) : d & 64 || d & 128 ? l.process(e, t, n, r, i, a, o, s, c, Te) : process.env.NODE_ENV !== "production" && V("Invalid VNode type:", l, `(${typeof l})`);
		}
		u != null && i ? Br(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Br(e.ref, null, a, e, !0);
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
	}, te = (e, t, n, r, i, a, o, s, c) => {
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) ne(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), ie(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, ne = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && T(e.children, d, null, r, i, La(e, a), s, u), _ && br(e, null, r, "created"), re(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !ee(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && bo(f, r, e);
		}
		process.env.NODE_ENV !== "production" && (ce(d, "__vnode", e, !0), ce(d, "__vueParentComponent", r, !0)), _ && br(e, null, r, "beforeMount");
		let v = za(i, g);
		if (v && g.beforeEnter(d), o(d, t, n), (f = m && m.onVnodeMounted) || v || _) {
			let t = process.env.NODE_ENV !== "production" && W;
			q(() => {
				let n;
				process.env.NODE_ENV !== "production" && (n = Hn(t));
				try {
					f && bo(f, r, e), v && g.enter(d), _ && br(e, null, r, "mounted");
				} finally {
					process.env.NODE_ENV !== "production" && Hn(n);
				}
			}, i);
		}
	}, re = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (process.env.NODE_ENV !== "production" && n.patchFlag > 0 && n.patchFlag & 2048 && (n = qi(n.children) || n), t === n || Ga(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				re(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, T = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? _o(e[l]) : Q(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, ie = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el;
		process.env.NODE_ENV !== "production" && (l.__vnode = n);
		let { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && Ra(r, !1), (g = h.onVnodeBeforeUpdate) && bo(g, r, n, e), f && br(n, e, r, "beforeUpdate"), r && Ra(r, !0), (process.env.NODE_ENV !== "production" && W || d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length)) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? (E(e.dynamicChildren, d, l, r, i, La(n, a), o), process.env.NODE_ENV !== "production" && Ba(e, n)) : s || pe(e, n, l, null, r, i, La(n, a), o, !1), u > 0) {
			if (u & 16) ae(l, m, h, r, a);
			else if (u & 2 && m.class !== h.class && c(l, "class", null, h.class, a), u & 4 && c(l, "style", m.style, h.style, a), u & 8) {
				let e = n.dynamicProps;
				for (let t = 0; t < e.length; t++) {
					let n = e[t], i = m[n], o = h[n];
					(o !== i || n === "value") && c(l, n, i, o, a, r);
				}
			}
			u & 1 && e.children !== n.children && p(l, n.children);
		} else !s && d == null && ae(l, m, h, r, a);
		((g = h.onVnodeUpdated) || f) && q(() => {
			g && bo(g, r, n, e), f && br(n, e, r, "updated");
		}, i);
	}, E = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === J || !io(c, l) || c.shapeFlag & 198) ? m(c.el) : n;
			v(c, l, u, null, r, i, a, o, !0);
		}
	}, ae = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !ee(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (ee(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, oe = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		process.env.NODE_ENV !== "production" && (W || p & 2048) && (p = 0, l = !1, m = null), h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), T(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (E(e.dynamicChildren, m, n, i, a, s, c), process.env.NODE_ENV === "production" ? (t.key != null || i && t === i.subTree) && Ba(e, t, !0) : Ba(e, t)) : pe(e, t, n, f, i, a, s, c, l);
	}, D = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : O(t, n, r, i, a, o, c) : le(e, t, c);
	}, O = (e, t, n, r, i, a, o) => {
		let s = e.component = Co(e, r, i);
		if (process.env.NODE_ENV !== "production" && s.type.__hmrId && Gn(s), process.env.NODE_ENV !== "production" && (pn(e), ja(s, "mount")), Ur(e) && (s.ctx.renderer = Te), process.env.NODE_ENV !== "production" && ja(s, "init"), No(s, !1, o), process.env.NODE_ENV !== "production" && Ma(s, "init"), process.env.NODE_ENV !== "production" && W && (e.el = null), s.asyncDep) {
			if (i && i.registerDep(s, de, o), !e.el) {
				let r = s.subTree = lo(Y);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else de(s, e, t, n, i, a, o);
		process.env.NODE_ENV !== "production" && (mn(), Ma(s, "mount"));
	}, le = (e, t, n) => {
		let r = t.component = e.component;
		if (Zi(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				process.env.NODE_ENV !== "production" && pn(t), fe(r, t, n), process.env.NODE_ENV !== "production" && mn();
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, r.vnode = t;
	}, de = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = Ha(e);
					if (n) {
						t && (t.el = c.el, fe(e, t, o)), n.asyncDep.then(() => {
							q(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				process.env.NODE_ENV !== "production" && pn(t || e.vnode), Ra(e, !1), t ? (t.el = c.el, fe(e, t, o)) : t = c, n && se(n), (d = t.props && t.props.onVnodeBeforeUpdate) && bo(d, s, t, c), Ra(e, !0), process.env.NODE_ENV !== "production" && ja(e, "render");
				let f = Gi(e);
				process.env.NODE_ENV !== "production" && Ma(e, "render");
				let p = e.subTree;
				e.subTree = f, process.env.NODE_ENV !== "production" && ja(e, "patch"), v(p, f, m(p.el), Se(p), e, i, a), process.env.NODE_ENV !== "production" && Ma(e, "patch"), t.el = f.el, u === null && ea(e, f.el), r && q(r, i), (d = t.props && t.props.onVnodeUpdated) && q(() => bo(d, s, t, c), i), process.env.NODE_ENV !== "production" && sr(e), process.env.NODE_ENV !== "production" && mn();
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Hr(t);
				if (Ra(e, !1), l && se(l), !m && (o = c && c.onVnodeBeforeMount) && bo(o, d, t), Ra(e, !0), s && De) {
					let t = () => {
						process.env.NODE_ENV !== "production" && ja(e, "render"), e.subTree = Gi(e), process.env.NODE_ENV !== "production" && Ma(e, "render"), process.env.NODE_ENV !== "production" && ja(e, "hydrate"), De(s, e.subTree, e, i, null), process.env.NODE_ENV !== "production" && Ma(e, "hydrate");
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0), process.env.NODE_ENV !== "production" && ja(e, "render");
					let o = e.subTree = Gi(e);
					process.env.NODE_ENV !== "production" && Ma(e, "render"), process.env.NODE_ENV !== "production" && ja(e, "patch"), v(null, o, n, r, e, i, a), process.env.NODE_ENV !== "production" && Ma(e, "patch"), t.el = o.el;
				}
				if (u && q(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					q(() => bo(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Hr(d.vnode) && d.vnode.shapeFlag & 256) && e.a && q(e.a, i), e.isMounted = !0, process.env.NODE_ENV !== "production" && or(e), t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Fe(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => Pn(u), Ra(e, !0), process.env.NODE_ENV !== "production" && (c.onTrack = e.rtc ? (t) => se(e.rtc, t) : void 0, c.onTrigger = e.rtg ? (t) => se(e.rtg, t) : void 0), l();
	}, fe = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, oa(e, t.props, r, n), Oa(e, t.children, n), N(), Ln(e), P();
	}, pe = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, u = e ? e.shapeFlag : 0, d = t.children, { patchFlag: f, shapeFlag: m } = t;
		if (f > 0) {
			if (f & 128) {
				he(l, d, n, r, i, a, o, s, c);
				return;
			}
			if (f & 256) {
				me(l, d, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (u & 16 && xe(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? he(l, d, n, r, i, a, o, s, c) : xe(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && T(d, n, r, i, a, o, s, c));
	}, me = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? _o(t[p]) : Q(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? xe(e, a, o, !0, !1, f) : T(t, r, i, a, o, s, c, l, f);
	}, he = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? _o(t[u]) : Q(t[u]);
			if (io(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? _o(t[p]) : Q(t[p]);
			if (io(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? _o(t[u]) : Q(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) _e(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? _o(t[u]) : Q(t[u]);
				e.key != null && (process.env.NODE_ENV !== "production" && g.has(e.key) && V("Duplicate keys found during update:", JSON.stringify(e.key), "Make sure keys are unique."), g.set(e.key, u));
			}
			let _, y = 0, b = p - h + 1, x = !1, S = 0, C = Array(b);
			for (u = 0; u < b; u++) C[u] = 0;
			for (u = m; u <= f; u++) {
				let n = e[u];
				if (y >= b) {
					_e(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && io(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? _e(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? Va(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || Wa(f) : i;
				C[u] === 0 ? v(null, n, r, p, a, o, s, c, l) : x && (_ < 0 || u !== w[_] ? ge(n, r, p, 2) : _--);
			}
		}
	}, ge = (e, t, n, r, i = null) => {
		let { el: a, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) {
			ge(e.component.subTree, t, n, r);
			return;
		}
		if (d & 128) {
			e.suspense.move(t, n, r);
			return;
		}
		if (d & 64) {
			c.move(e, t, n, Te);
			return;
		}
		if (c === J) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) ge(u[e], t, n, r);
			o(e.anchor, t, n);
			return;
		}
		if (c === Ja) {
			C(e, t, n);
			return;
		}
		if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[jr] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), q(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[jr];
					a._isLeaving && a[jr](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, _e = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (N(), Br(s, null, n, e, !0), P()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Hr(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && bo(_, t, e), u & 6) be(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && br(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, Te, r) : l && !l.hasOnce && (a !== J || d > 0 && d & 64) ? xe(l, t, n, !1, !0) : (a === J && d & 384 || !i && u & 16) && xe(c, t, n), r && ve(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && q(() => {
			_ && bo(_, t, e), h && br(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, ve = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e;
		if (t === J) {
			process.env.NODE_ENV !== "production" && e.patchFlag > 0 && e.patchFlag & 2048 && i && !i.persisted ? e.children.forEach((e) => {
				e.type === Y ? s(e.el) : ve(e);
			}) : ye(n, r);
			return;
		}
		if (t === Ja) {
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
	}, ye = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, be = (e, t, n) => {
		process.env.NODE_ENV !== "production" && e.type.__hmrId && Kn(e);
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		Ua(c), Ua(l), r && se(r), i.stop(), a && (a.flags |= 8, _e(o, e, t, n)), s && q(s, t), q(() => {
			e.isUnmounted = !0;
		}, t), process.env.NODE_ENV !== "production" && lr(e);
	}, xe = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) _e(e[o], t, n, r, i);
	}, Se = (e) => {
		if (e.shapeFlag & 6) return Se(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[kr];
		return n ? h(n) : t;
	}, Ce = !1, we = (e, t, n) => {
		let r;
		e == null ? t._vnode && (_e(t._vnode, null, null, !0), r = t._vnode.component) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e, Ce ||= (Ce = !0, Ln(r), Rn(), !1);
	}, Te = {
		p: v,
		um: _e,
		m: ge,
		r: ve,
		mt: O,
		mc: T,
		pc: pe,
		pbc: E,
		n: Se,
		o: e
	}, Ee, De;
	return i && ([Ee, De] = i(Te)), {
		render: we,
		hydrate: Ee,
		createApp: Ii(we, Ee)
	};
}
function La({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function Ra({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function za(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Ba(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = _o(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && Ba(t, a)), a.type === qa && (a.patchFlag === -1 && (a = i[e] = _o(a)), a.el = t.el), a.type === Y && !a.el && (a.el = t.el), process.env.NODE_ENV !== "production" && a.el && (a.el.__vnode = a);
	}
}
function Va(e) {
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
function Ha(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : Ha(t);
}
function Ua(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function Wa(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? Wa(t.subTree) : null;
}
var Ga = (e) => e.__isSuspense;
function Ka(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : In(e);
}
var J = /* @__PURE__ */ Symbol.for("v-fgt"), qa = /* @__PURE__ */ Symbol.for("v-txt"), Y = /* @__PURE__ */ Symbol.for("v-cmt"), Ja = /* @__PURE__ */ Symbol.for("v-stc"), Ya = [], X = null;
function Xa(e = !1) {
	Ya.push(X = e ? null : []);
}
function Za() {
	Ya.pop(), X = Ya[Ya.length - 1] || null;
}
var Qa = 1;
function $a(e, t = !1) {
	Qa += e, e < 0 && X && t && (X.hasOnce = !0);
}
function eo(e) {
	return e.dynamicChildren = Qa > 0 ? X || n : null, Za(), Qa > 0 && X && X.push(e), e;
}
function to(e, t, n, r, i, a) {
	return eo(Z(e, t, n, r, i, a, !0));
}
function no(e, t, n, r, i) {
	return eo(lo(e, t, n, r, i, !0));
}
function ro(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function io(e, t) {
	if (process.env.NODE_ENV !== "production" && t.shapeFlag & 6 && e.component) {
		let n = Un.get(t.type);
		if (n && n.has(e.component)) return e.shapeFlag &= -257, t.shapeFlag &= -513, !1;
	}
	return e.type === t.type && e.key === t.key;
}
var ao = (...e) => uo(...e), oo = ({ key: e }) => e ?? null, so = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ B(e) || h(e) ? {
	i: G,
	r: e,
	k: t,
	f: !!n
} : e);
function Z(e, t = null, n = null, r = 0, i = null, a = e === J ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && oo(t),
		ref: t && so(t),
		scopeId: hr,
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
	if (s ? (vo(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), process.env.NODE_ENV !== "production" && c.key !== c.key && V("VNode created with invalid key (NaN). VNode type:", c.type), process.env.NODE_ENV !== "production" && t && c.shapeFlag & 1) {
		let e = t.innerHTML == null ? t.textContent == null ? null : "textContent" : "innerHTML";
		e && co(c.children) && V(`The \`${e}\` prop on <${c.type}> will override its children. Remove either the \`${e}\` prop or the children.`);
	}
	return Qa > 0 && !o && X && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && X.push(c), c;
}
function co(e) {
	return g(e) ? e !== "" : d(e) ? e.length > 0 : !1;
}
var lo = process.env.NODE_ENV === "production" ? uo : ao;
function uo(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === oi) && (process.env.NODE_ENV !== "production" && !e && V(`Invalid vnode type when creating vnode: ${e}.`), e = Y), ro(e)) {
		let r = po(e, t, !0);
		return n && vo(r, n), Qa > 0 && !a && X && (r.shapeFlag & 6 ? X[X.indexOf(e)] = r : X.push(r)), r.patchFlag = -2, r;
	}
	if (Ko(e) && (e = e.__vccOpts), t) {
		t = fo(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = ge(e)), v(n) && (/* @__PURE__ */ Jt(n) && !d(n) && (n = s({}, n)), t.style = de(n));
	}
	let o = g(e) ? 1 : Ga(e) ? 128 : Ar(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return process.env.NODE_ENV !== "production" && o & 4 && /* @__PURE__ */ Jt(e) && (e = /* @__PURE__ */ R(e), V("Vue received a Component that was made a reactive object. This can lead to unnecessary performance overhead and should be avoided by marking the component with `markRaw` or using `shallowRef` instead of `ref`.", "\nComponent that was made reactive: ", e)), Z(e, t, n, r, i, o, a, !0);
}
function fo(e) {
	return e ? /* @__PURE__ */ Jt(e) || ra(e) ? s({}, e) : e : null;
}
function po(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? yo(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && oo(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(so(t)) : [a, so(t)] : so(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: process.env.NODE_ENV !== "production" && o === -1 && d(s) ? s.map(mo) : s,
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
		ssContent: e.ssContent && po(e.ssContent),
		ssFallback: e.ssFallback && po(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && Pr(u, c.clone(u)), u;
}
function mo(e) {
	let t = po(e);
	return d(e.children) && (t.children = e.children.map(mo)), t;
}
function ho(e = " ", t = 0) {
	return lo(qa, null, e, t);
}
function go(e = "", t = !1) {
	return t ? (Xa(), no(Y, null, e)) : lo(Y, null, e);
}
function Q(e) {
	return e == null || typeof e == "boolean" ? lo(Y) : d(e) ? lo(J, null, e.slice()) : ro(e) ? _o(e) : lo(qa, null, String(e));
}
function _o(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : po(e);
}
function vo(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), vo(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !ra(t) ? t._ctx = G : r === 3 && G && (G.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			vo(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: G
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [ho(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function yo(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = ge([t.class, r.class]));
		else if (e === "style") t.style = de([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function bo(e, t, n, r = null) {
	H(e, t, 7, [n, r]);
}
var xo = Pi(), So = 0;
function Co(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || xo, o = {
		uid: So++,
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
		propsOptions: ua(i, a),
		emitsOptions: Vi(i, a),
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
	return o.ctx = process.env.NODE_ENV === "production" ? { _: o } : hi(o), o.root = n ? n.root : o, o.emit = zi.bind(null, o), e.ce && e.ce(o), o;
}
var $ = null, wo = () => $ || G, To, Eo;
{
	let e = ue(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	To = t("__VUE_INSTANCE_SETTERS__", (e) => $ = e), Eo = t("__VUE_SSR_SETTERS__", (e) => Mo = e);
}
var Do = (e) => {
	let t = $;
	return To(e), e.scope.on(), () => {
		e.scope.off(), To(t);
	};
}, Oo = () => {
	$ && $.scope.off(), To(null);
}, ko = /* @__PURE__ */ e("slot,component");
function Ao(e, { isNativeTag: t }) {
	(ko(e) || t(e)) && V("Do not use built-in or reserved HTML elements as component id: " + e);
}
function jo(e) {
	return e.vnode.shapeFlag & 4;
}
var Mo = !1;
function No(e, t = !1, n = !1) {
	t && Eo(t);
	let { props: r, children: i } = e.vnode, a = jo(e);
	ia(e, r, a, t), Da(e, i, n || t);
	let o = a ? Po(e, t) : void 0;
	return t && Eo(!1), o;
}
function Po(e, t) {
	let n = e.type;
	if (process.env.NODE_ENV !== "production") {
		if (n.name && Ao(n.name, e.appContext.config), n.components) {
			let t = Object.keys(n.components);
			for (let n = 0; n < t.length; n++) Ao(t[n], e.appContext.config);
		}
		if (n.directives) {
			let e = Object.keys(n.directives);
			for (let t = 0; t < e.length; t++) vr(e[t]);
		}
		n.compilerOptions && Io() && V("\"compilerOptions\" is only supported when using a build of Vue that includes the runtime compiler. Since you are using a runtime-only build, the options should be passed via your build tool config instead.");
	}
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, mi), process.env.NODE_ENV !== "production" && gi(e);
	let { setup: r } = n;
	if (r) {
		N();
		let i = e.setupContext = r.length > 1 ? Bo(e) : null, a = Do(e), o = Sn(r, e, 0, [process.env.NODE_ENV === "production" ? e.props : /* @__PURE__ */ Gt(e.props), i]), s = y(o);
		if (P(), a(), (s || e.sp) && !Hr(e) && Ir(e), s) {
			if (o.then(Oo, Oo), t) return o.then((n) => {
				Eo(!0);
				try {
					Fo(e, n, t);
				} finally {
					Eo(!1);
				}
			}).catch((t) => {
				Cn(t, e, 0);
			});
			e.asyncDep = o, process.env.NODE_ENV !== "production" && !e.suspense && V(`Component <${Go(e, n)}>: setup function returned a promise, but no <Suspense> boundary was found in the parent component tree. A component with async setup() must be nested in a <Suspense> in order to be rendered.`);
		} else Fo(e, o, t);
	} else Lo(e, t);
}
function Fo(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) ? (process.env.NODE_ENV !== "production" && ro(t) && V("setup() should not return VNodes directly - return a render function instead."), process.env.NODE_ENV !== "production" && (e.devtoolsRawSetupState = t), e.setupState = nn(t), process.env.NODE_ENV !== "production" && _i(e)) : process.env.NODE_ENV !== "production" && t !== void 0 && V(`setup() should return an object. Received: ${t === null ? "null" : typeof t}`), Lo(e, n);
}
var Io = () => !0;
function Lo(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
	{
		let t = Do(e);
		N();
		try {
			xi(e);
		} finally {
			P(), t();
		}
	}
	process.env.NODE_ENV !== "production" && !i.render && e.render === r && !t && (i.template ? V("Component provided template option but runtime compilation is not supported in this build of Vue. Configure your bundler to alias \"vue\" to \"vue/dist/vue.esm-bundler.js\".") : V("Component is missing template or render function: ", i));
}
var Ro = process.env.NODE_ENV === "production" ? { get(e, t) {
	return F(e, "get", ""), e[t];
} } : {
	get(e, t) {
		return Wi(), F(e, "get", ""), e[t];
	},
	set() {
		return V("setupContext.attrs is readonly."), !1;
	},
	deleteProperty() {
		return V("setupContext.attrs is readonly."), !1;
	}
};
function zo(e) {
	return new Proxy(e.slots, { get(t, n) {
		return F(e, "get", "$slots"), t[n];
	} });
}
function Bo(e) {
	let t = (t) => {
		if (process.env.NODE_ENV !== "production" && (e.exposed && V("expose() should be called only once per setup()."), t != null)) {
			let e = typeof t;
			e === "object" && (d(t) ? e = "array" : /* @__PURE__ */ B(t) && (e = "ref")), e !== "object" && V(`expose() should be passed a plain object, received ${e}.`);
		}
		e.exposed = t || {};
	};
	if (process.env.NODE_ENV !== "production") {
		let n, r;
		return Object.freeze({
			get attrs() {
				return n ||= new Proxy(e.attrs, Ro);
			},
			get slots() {
				return r ||= zo(e);
			},
			get emit() {
				return (t, ...n) => e.emit(t, ...n);
			},
			expose: t
		});
	}
	return {
		attrs: new Proxy(e.attrs, Ro),
		slots: e.slots,
		emit: e.emit,
		expose: t
	};
}
function Vo(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(nn(Yt(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in di) return di[n](e);
		},
		has(e, t) {
			return t in e || t in di;
		}
	}) : e.proxy;
}
var Ho = /(?:^|[-_])\w/g, Uo = (e) => e.replace(Ho, (e) => e.toUpperCase()).replace(/[-_]/g, "");
function Wo(e, t = !0) {
	return h(e) ? e.displayName || e.name : e.name || t && e.__name;
}
function Go(e, t, n = !1) {
	let r = Wo(t);
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
	return r ? Uo(r) : n ? "App" : "Anonymous";
}
function Ko(e) {
	return h(e) && "__vccOpts" in e;
}
var qo = (e, t) => {
	let n = /* @__PURE__ */ an(e, t, Mo);
	if (process.env.NODE_ENV !== "production") {
		let e = wo();
		e && e.appContext.config.warnRecursiveComputed && (n._warnRecursive = !0);
	}
	return n;
};
function Jo() {
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
			if (/* @__PURE__ */ B(t)) {
				N();
				let n = t.value;
				return P(), [
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
			return /* @__PURE__ */ qt(t) ? [
				"div",
				{},
				[
					"span",
					e,
					/* @__PURE__ */ L(t) ? "ShallowReactive" : "Reactive"
				],
				"<",
				l(t),
				`>${/* @__PURE__ */ I(t) ? " (readonly)" : ""}`
			] : /* @__PURE__ */ I(t) ? [
				"div",
				{},
				[
					"span",
					e,
					/* @__PURE__ */ L(t) ? "ShallowReadonly" : "Readonly"
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
		e.type.props && e.props && n.push(c("props", /* @__PURE__ */ R(e.props))), e.setupState !== t && n.push(c("setup", e.setupState)), e.data !== t && n.push(c("data", /* @__PURE__ */ R(e.data)));
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
		] : v(e) ? ["object", { object: t ? /* @__PURE__ */ R(e) : e }] : [
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
		return /* @__PURE__ */ L(e) ? "ShallowRef" : e.effect ? "ComputedRef" : "Ref";
	}
	window.devtoolsFormatters ? window.devtoolsFormatters.push(a) : window.devtoolsFormatters = [a];
}
var Yo = "3.5.42", Xo = process.env.NODE_ENV === "production" ? r : V;
process.env.NODE_ENV, process.env.NODE_ENV;
//#endregion
//#region ../../../../node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js
var Zo = void 0, Qo = typeof window < "u" && window.trustedTypes;
if (Qo) try {
	Zo = /* @__PURE__ */ Qo.createPolicy("vue", { createHTML: (e) => e });
} catch (e) {
	process.env.NODE_ENV !== "production" && Xo(`Error creating trusted types policy: ${e}`);
}
var $o = Zo ? (e) => Zo.createHTML(e) : (e) => e, es = "http://www.w3.org/2000/svg", ts = "http://www.w3.org/1998/Math/MathML", ns = typeof document < "u" ? document : null, rs = ns && /* @__PURE__ */ ns.createElement("template"), is = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? ns.createElementNS(es, e) : t === "mathml" ? ns.createElementNS(ts, e) : n ? ns.createElement(e, { is: n }) : ns.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => ns.createTextNode(e),
	createComment: (e) => ns.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => ns.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			rs.innerHTML = $o(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = rs.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, as = /* @__PURE__ */ Symbol("_vtc");
function os(e, t, n) {
	let r = e[as];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var ss = /* @__PURE__ */ Symbol("_vod"), cs = /* @__PURE__ */ Symbol("_vsh"), ls = {
	name: "show",
	beforeMount(e, { value: t }, { transition: n }) {
		e[ss] = e.style.display === "none" ? "" : e.style.display, n && t ? n.beforeEnter(e) : us(e, t);
	},
	mounted(e, { value: t }, { transition: n }) {
		n && t && n.enter(e);
	},
	updated(e, { value: t, oldValue: n }, { transition: r }) {
		!t != !n && (r ? t ? (r.beforeEnter(e), us(e, !0), r.enter(e)) : r.leave(e, () => {
			us(e, !1);
		}) : us(e, t));
	},
	beforeUnmount(e, { value: t }) {
		us(e, t);
	}
};
function us(e, t) {
	e.style.display = t ? e[ss] : "none", e[cs] = !t;
}
var ds = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "CSS_VAR_TEXT"), fs = /(?:^|;)\s*display\s*:/;
function ps(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? gs(r, t, "");
			}
			else for (let e in t) n[e] ?? gs(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? gs(r, i, "") : bs(e, i, !g(t) && t ? t[i] : void 0, o) || gs(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[ds];
			e && (n += ";" + e), r.cssText = n, a = fs.test(n);
		}
	} else t && e.removeAttribute("style");
	ss in e && (e[ss] = a ? r.display : "", e[cs] && (r.display = "none"));
}
var ms = /[^\\];\s*$/, hs = /\s*!important$/;
function gs(e, t, n) {
	if (d(n)) n.forEach((n) => gs(e, t, n));
	else if (n ??= "", process.env.NODE_ENV !== "production" && ms.test(n) && Xo(`Unexpected semicolon at the end of '${t}' style value: '${n}'`), t.startsWith("--")) hs.test(n) ? e.setProperty(t, n.replace(hs, ""), "important") : e.setProperty(t, n);
	else {
		let r = ys(e, t);
		hs.test(n) ? e.setProperty(E(r), n.replace(hs, ""), "important") : e[r] = n;
	}
}
var _s = [
	"Webkit",
	"Moz",
	"ms"
], vs = {};
function ys(e, t) {
	let n = vs[t];
	if (n) return n;
	let r = T(t);
	if (r !== "filter" && r in e) return vs[t] = r;
	r = ae(r);
	for (let n = 0; n < _s.length; n++) {
		let i = _s[n] + r;
		if (i in e) return vs[t] = i;
	}
	return t;
}
function bs(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var xs = "http://www.w3.org/1999/xlink";
function Ss(e, t, n, r, i, a = we(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(xs, t.slice(6, t.length)) : e.setAttributeNS(xs, t, n) : n == null || a && !Te(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function Cs(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? $o(n) : n);
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
		r === "boolean" ? n = Te(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch (e) {
		process.env.NODE_ENV !== "production" && !o && Xo(`Failed setting prop "${t}" on <${a.toLowerCase()}>: value ${n} is invalid.`, e);
	}
	o && e.removeAttribute(i || t);
}
function ws(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function Ts(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var Es = /* @__PURE__ */ Symbol("_vei");
function Ds(e, t, n, r, i = null) {
	let a = e[Es] || (e[Es] = {}), o = a[t];
	if (r && o) o.value = process.env.NODE_ENV === "production" ? r : Fs(r, t);
	else {
		let [n, s] = As(t);
		r ? ws(e, n, a[t] = Ps(process.env.NODE_ENV === "production" ? r : Fs(r, t), i), s) : o && (Ts(e, n, o, s), a[t] = void 0);
	}
}
var Os = /(Once|Passive|Capture)$/, ks = /^on:?(?:Once|Passive|Capture)$/;
function As(e) {
	let t, n;
	for (; (n = e.match(Os)) && !ks.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : E(e.slice(2)), t];
}
var js = 0, Ms = /* @__PURE__ */ Promise.resolve(), Ns = () => js ||= (Ms.then(() => js = 0), Date.now());
function Ps(e, t) {
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
	return n.value = e, n.attached = Ns(), n;
}
function Fs(e, t) {
	return h(e) || d(e) ? e : (Xo(`Wrong type passed as event handler to ${t} - did you forget @ or : in front of your prop?
Expected function or array of functions, received type ${typeof e}.`), r);
}
var Is = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Ls = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? os(e, r, c) : t === "style" ? ps(e, n, r) : a(t) ? o(t) || Ds(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Rs(e, t, r, c)) ? (Cs(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Ss(e, t, r, c, s, t !== "value")) : e._isVueCE && (zs(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? Cs(e, T(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), Ss(e, t, r, c));
};
function Rs(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && Is(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return Is(t) && g(n) ? !1 : t in e;
}
function zs(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = T(t);
	return Array.isArray(n) ? n.some((e) => T(e) === r) : Object.keys(n).some((e) => T(e) === r);
}
var Bs = [
	"ctrl",
	"shift",
	"alt",
	"meta"
], Vs = {
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
	exact: (e, t) => Bs.some((n) => e[`${n}Key`] && !t.includes(n))
}, Hs = (e, t) => {
	if (!e) return e;
	let n = e._withMods ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n, ...r) => {
		for (let e = 0; e < t.length; e++) {
			let r = Vs[t[e]];
			if (r && r(n, t)) return;
		}
		return e(n, ...r);
	}));
}, Us = /* @__PURE__ */ s({ patchProp: Ls }, is), Ws;
function Gs() {
	return Ws ||= Fa(Us);
}
var Ks = ((...e) => {
	let t = Gs().createApp(...e);
	process.env.NODE_ENV !== "production" && (Js(t), Ys(t));
	let { mount: n } = t;
	return t.mount = (e) => {
		let r = Xs(e);
		if (!r) return;
		let i = t._component;
		!h(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, qs(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function qs(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function Js(e) {
	Object.defineProperty(e.config, "isNativeTag", {
		value: (e) => be(e) || xe(e) || Se(e),
		writable: !1
	});
}
function Ys(e) {
	if (Io()) {
		let t = e.config.isCustomElement;
		Object.defineProperty(e.config, "isCustomElement", {
			get() {
				return t;
			},
			set() {
				Xo("The `isCustomElement` config option is deprecated. Use `compilerOptions.isCustomElement` instead.");
			}
		});
		let n = e.config.compilerOptions, r = "The `compilerOptions` config option is only respected when using a build of Vue.js that includes the runtime compiler (aka \"full build\"). Since you are using the runtime-only build, `compilerOptions` must be passed to `@vue/compiler-dom` in the build setup instead.\n- For vue-loader: pass it via vue-loader's `compilerOptions` loader option.\n- For vue-cli: see https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-loader\n- For vite: pass it via @vitejs/plugin-vue options. See https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue#example-for-passing-options-to-vuecompiler-sfc";
		Object.defineProperty(e.config, "compilerOptions", {
			get() {
				return Xo(r), n;
			},
			set() {
				Xo(r);
			}
		});
	}
}
function Xs(e) {
	if (g(e)) {
		let t = document.querySelector(e);
		return process.env.NODE_ENV !== "production" && !t && Xo(`Failed to mount app: mount target selector "${e}" returned null.`), t;
	}
	return process.env.NODE_ENV !== "production" && window.ShadowRoot && e instanceof window.ShadowRoot && e.mode === "closed" && Xo("mounting on a ShadowRoot with `{mode: \"closed\"}` may lead to unpredictable bugs"), e;
}
//#endregion
//#region ../../../../node_modules/vue/dist/vue.runtime.esm-bundler.js
function Zs() {
	Jo();
}
process.env.NODE_ENV !== "production" && Zs();
//#endregion
//#region src/WallpaperSettings.vue?vue&type=script&setup=true&lang.ts
var Qs = {
	class: "settings-card wallpaper-card",
	"data-settings-panel": "custom-wallpaper"
}, $s = ["aria-expanded"], ec = { class: "settings-card-copy" }, tc = { class: "settings-card-title" }, nc = { class: "muted" }, rc = {
	class: "settings-card-arrow",
	"aria-hidden": "true"
}, ic = { class: "settings-card-body" }, ac = { class: "row-actions" }, oc = ["model-value", "label"], sc = { class: "form-grid wallpaper-controls" }, cc = { class: "field" }, lc = { class: "field-label" }, uc = ["model-value", "options"], dc = { class: "field" }, fc = { class: "field-label" }, pc = ["model-value"], mc = { class: "field" }, hc = { class: "field-label" }, gc = ["model-value"], _c = { class: "field" }, vc = { class: "field-label" }, yc = ["model-value"], bc = { class: "field" }, xc = { class: "field-label" }, Sc = ["model-value"], Cc = { class: "row-actions" }, wc = ["model-value", "label"], Tc = ["label"], Ec = { class: "wallpaper-list" }, Dc = {
	key: 0,
	class: "muted wallpaper-empty"
}, Oc = ["onDragstart", "onDrop"], kc = ["src", "alt"], Ac = { class: "wallpaper-item-copy" }, jc = { class: "muted" }, Mc = ["onClick"], Nc = {
	key: 0,
	class: "req"
}, Pc = /* @__PURE__ */ Fr({
	__name: "WallpaperSettings",
	props: {
		host: {},
		context: {}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ Zt(null), r = /* @__PURE__ */ Zt(!1), i = /* @__PURE__ */ Zt(""), a = /* @__PURE__ */ Zt("muted"), o = /* @__PURE__ */ Zt(""), s = /* @__PURE__ */ Zt(""), c = null, l = qo(() => [
			{
				value: "timer",
				label: t.host.i18n.t("settings.rotation_timer", {}, "按时间随机轮换")
			},
			{
				value: "startup",
				label: t.host.i18n.t("settings.rotation_startup", {}, "每次启动 Web 随机轮换")
			},
			{
				value: "off",
				label: t.host.i18n.t("settings.rotation_off", {}, "不轮换")
			}
		]), u = qo(() => {
			let e = n.value?.assets || [], t = new Map(e.map((e) => [e.id, e]));
			return [.../* @__PURE__ */ new Set([...n.value?.order || [], ...e.map((e) => e.id)])].map((e) => t.get(e)).filter((e) => !!e);
		}), d = qo(() => n.value?.provider?.enabled === !0), f = qo(() => n.value?.effects?.applyTransparencyToSecondarySurfaces !== !1);
		function p(e, n = {}, r = "") {
			return t.host.i18n.t(e, n, r);
		}
		function m(e, t = "muted") {
			i.value = e, a.value = t;
		}
		function h() {
			let e = n.value || {};
			return {
				order: u.value.map((e) => e.id),
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
					applyTransparencyToSecondarySurfaces: f.value
				},
				provider: { enabled: d.value }
			};
		}
		async function g() {
			try {
				n.value = await t.host.appearance.wallpaperStore.get(), m(n.value.effectiveEnabled ? p("status.enabled", {}, "已启用") : p("status.disabled", {}, "未启用"), n.value.effectiveEnabled ? "ok" : "muted");
			} catch (e) {
				m(p("status.read_failed", {}, "读取失败"), "bad"), o.value = e instanceof Error ? e.message : String(e);
			}
		}
		async function _() {
			if (n.value) try {
				m(p("status.saving", {}, "保存中"), "blue"), n.value = await t.host.appearance.wallpaperStore.save(h()), m(n.value.effectiveEnabled ? p("status.enabled", {}, "已启用") : p("status.disabled", {}, "未启用"), n.value.effectiveEnabled ? "ok" : "muted");
			} catch (e) {
				m(p("status.save_failed", {}, "保存失败"), "bad"), o.value = e instanceof Error ? e.message : String(e);
			}
		}
		async function v(e = []) {
			for (let r of e) {
				if (!n.value || n.value.assets?.length && n.value.assets.length >= 32) {
					t.host.ui.toast(p("error.count", {}, "壁纸数量不能超过 32 张"), "error");
					break;
				}
				if (![
					"image/jpeg",
					"image/png",
					"image/webp"
				].includes(String(r.type).toLowerCase()) || r.size > 8388608) {
					t.host.ui.toast(p("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP，单张最大 8192 KB"), "error");
					continue;
				}
				try {
					m(p("status.uploading", { name: r.name }, `上传中：${r.name}`), "blue");
					let e = await t.host.appearance.wallpaperStore.upload(r, { name: r.name });
					if (e.asset?.id) try {
						await t.host.appearance.wallpaperStore.savePalette(e.asset.id, await t.host.appearance.derivePalette(r));
					} catch {}
					await g();
				} catch (e) {
					m(p("status.upload_failed", {}, "上传失败"), "bad"), o.value = e instanceof Error ? e.message : String(e);
				}
			}
		}
		async function y(e) {
			try {
				await t.host.appearance.wallpaperStore.remove(e), await g();
			} catch (e) {
				o.value = e instanceof Error ? e.message : String(e), m(p("status.delete_failed", {}, "删除失败"), "bad");
			}
		}
		async function b(e) {
			n.value && (e === "enabled" ? n.value.provider = {
				...n.value.provider || {},
				enabled: !d.value
			} : n.value.effects = {
				...n.value.effects || {},
				applyTransparencyToSecondarySurfaces: !f.value
			}, await _());
		}
		async function x(e, t) {
			n.value && (e === "mode" && (n.value.rotation = {
				...n.value.rotation || {},
				mode: String(t)
			}), e === "interval" && (n.value.rotation = {
				...n.value.rotation || {},
				intervalMinutes: Number(t) || 30
			}), e === "blur" && (n.value.effects = {
				...n.value.effects || {},
				blurPx: Number(t) || 0
			}), e === "dim" && (n.value.effects = {
				...n.value.effects || {},
				dimPercent: Number(t) || 0
			}), e === "transparency" && (n.value.effects = {
				...n.value.effects || {},
				surfaceTransparencyPercent: Number(t) || 0
			}), await _());
		}
		async function S(e) {
			if (!s.value || s.value === e || !n.value) return;
			let t = u.value.map((e) => e.id).filter((e) => e !== s.value), r = t.indexOf(e);
			t.splice(r < 0 ? t.length : r, 0, s.value), n.value.order = t, s.value = "", await _();
		}
		return Zr(async () => {
			await g(), c = t.host.appearance.wallpaperStore.subscribe((e) => {
				e.revision !== n.value?.revision && (n.value = e);
			});
		}), ei(() => c?.dispose()), (e, t) => (Xa(), to("section", Qs, [Z("button", {
			class: "settings-card-toggle",
			type: "button",
			"aria-expanded": r.value,
			onClick: t[0] ||= (e) => r.value = !r.value
		}, [Z("span", ec, [Z("strong", tc, k(p("card.title", {}, "自定义壁纸")), 1), Z("span", nc, k(p("card.description", {}, "同步壁纸、轮换方式和显示效果")), 1)]), Z("span", rc, k(r.value ? "⌄" : "›"), 1)], 8, $s), yr(Z("div", ic, [
			Z("div", ac, [Z("nxp-switch", {
				"model-value": d.value,
				label: p("settings.enabled", {}, "启用自定义壁纸"),
				onChange: t[1] ||= (e) => b("enabled")
			}, null, 40, oc), Z("span", { class: ge(["badge", a.value]) }, k(i.value), 3)]),
			Z("div", sc, [
				Z("label", cc, [Z("span", lc, k(p("settings.rotation", {}, "轮换方式")), 1), Z("nxp-select", {
					"model-value": n.value?.rotation?.mode || "off",
					options: l.value,
					"aria-label": "轮换方式",
					onChange: t[2] ||= (e) => x("mode", e.detail?.[0] || e.target?.modelValue || "off")
				}, null, 40, uc)]),
				Z("label", dc, [Z("span", fc, k(p("settings.interval", {}, "轮换间隔（分钟）")), 1), Z("nxp-number-input", {
					"model-value": n.value?.rotation?.intervalMinutes || 30,
					min: "1",
					max: "1440",
					step: "1",
					"aria-label": "轮换间隔（分钟）",
					onChange: t[3] ||= (e) => x("interval", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, pc)]),
				Z("label", mc, [Z("span", hc, k(p("settings.blur", {}, "模糊（像素）")), 1), Z("nxp-range", {
					"model-value": n.value?.effects?.blurPx || 0,
					min: "0",
					max: "40",
					step: "1",
					"aria-label": "模糊（像素）",
					onChange: t[4] ||= (e) => x("blur", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, gc)]),
				Z("label", _c, [Z("span", vc, k(p("settings.dim", {}, "变暗")), 1), Z("nxp-range", {
					"model-value": n.value?.effects?.dimPercent ?? 20,
					min: "0",
					max: "80",
					step: "1",
					"aria-label": "变暗",
					onChange: t[5] ||= (e) => x("dim", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, yc)]),
				Z("label", bc, [Z("span", xc, k(p("settings.transparency", {}, "卡片与侧边栏透明度")), 1), Z("nxp-range", {
					"model-value": n.value?.effects?.surfaceTransparencyPercent || 0,
					min: "0",
					max: "50",
					step: "1",
					"aria-label": "卡片与侧边栏透明度",
					onChange: t[6] ||= (e) => x("transparency", e.detail?.[0] || e.target?.modelValue)
				}, null, 40, Sc)])
			]),
			Z("div", Cc, [Z("nxp-switch", {
				"model-value": f.value,
				label: p("settings.secondary", {}, "透明度运用于非主页面"),
				onChange: t[7] ||= (e) => b("secondary")
			}, null, 40, wc), Z("nxp-file-picker", {
				accept: "image/jpeg,image/png,image/webp",
				multiple: "",
				label: p("settings.upload", {}, "添加壁纸"),
				onChange: t[8] ||= (e) => v(e.detail?.[0] || e.target?.files || [])
			}, null, 40, Tc)]),
			Z("div", Ec, [u.value.length ? go("", !0) : (Xa(), to("p", Dc, k(p("empty", {}, "尚未添加壁纸。")), 1)), (Xa(!0), to(J, null, si(u.value, (e) => (Xa(), to("div", {
				key: e.id,
				class: "wallpaper-item",
				draggable: "true",
				onDragstart: (t) => s.value = e.id,
				onDragover: t[9] ||= Hs(() => {}, ["prevent"]),
				onDrop: (t) => S(e.id)
			}, [
				t[10] ||= Z("span", {
					class: "wallpaper-drag-handle",
					"aria-hidden": "true"
				}, "⠿", -1),
				Z("img", {
					src: e.url,
					alt: e.originalName || e.id
				}, null, 8, kc),
				Z("div", Ac, [Z("strong", null, k(e.originalName || e.id), 1), Z("span", jc, k(Math.max(1, Math.round((e.sizeBytes || 0) / 1024))) + " KiB", 1)]),
				Z("nxp-button", {
					tone: "danger",
					variant: "ghost",
					size: "sm",
					onClick: (t) => y(e.id)
				}, k(p("remove", {}, "删除")), 9, Mc)
			], 40, Oc))), 128))]),
			o.value ? (Xa(), to("p", Nc, k(o.value), 1)) : go("", !0)
		], 512), [[ls, r.value]])]));
	}
});
//#endregion
//#region src/main.ts
function Fc(e) {
	return e.slots.register("settings.cards", (t) => {
		let n = Ks(Pc, {
			host: e,
			context: t.context
		});
		return n.mount(t.element), () => n.unmount();
	});
}
//#endregion
export { Fc as activate };
