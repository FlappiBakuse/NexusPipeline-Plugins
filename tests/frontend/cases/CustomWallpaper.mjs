import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { wallpaperTestState, createMetrics, createMockHost } from "../support/mock-host.mjs";
import { activationCleanup, fail } from "../contract.mjs";
import { flushDom } from "../support/dom.mjs";

export function assertWallpaperActivation(metrics) {
  const rotations = metrics.apiPostRoutes.filter(route => route === "rotation/advance-session").length;
  if (rotations !== 1) fail(`CustomWallpaper 激活时应恰好推进一次 Web 会话轮换，实际 ${rotations} 次`);
  if (metrics.appearanceSetBackground < 1) fail("CustomWallpaper 激活后未应用壁纸背景");
  if (metrics.appearanceSetTokens < 1) fail("CustomWallpaper 激活后未应用壁纸配色");
  if (!metrics.appearanceBackgroundUrl) fail("CustomWallpaper 未向宿主外观表面提供背景地址");
  return { rotations, background: metrics.appearanceClearBackground, tokens: metrics.appearanceClearTokens };
}

export function assertWallpaperRenderer(element) {
  if (!element.querySelector('[data-settings-panel="custom-wallpaper"]')) fail("CustomWallpaper renderer 未挂载设置面板");
  if (!element.querySelector("nxp-collapsible-card")) fail("CustomWallpaper renderer 未使用宿主公开折叠卡片组件");
  const missing = ["nxp-file-picker", "nxp-switch-setting", "nxp-select", "nxp-number-input", "nxp-range"]
    .filter(control => !element.querySelector(control));
  if (missing.length) fail(`CustomWallpaper renderer 缺少设置控件：${missing.join(", ")}`);
}

export function assertWallpaperSettingsReleased(metrics, before) {
  if (metrics.apiGet + metrics.apiPost < 1) fail("CustomWallpaper renderer 未通过插件 Web API 读取状态");
  if (metrics.appearanceClearBackground > before.background) fail("CustomWallpaper 设置卡片卸载时清除了全局背景");
  if (metrics.appearanceClearTokens > before.tokens) fail("CustomWallpaper 设置卡片卸载时清除了全局配色");
  if (!metrics.appearanceBackgroundUrl) fail("CustomWallpaper 离开设置页面后背景丢失");
  const rotations = metrics.apiPostRoutes.filter(route => route.includes("rotation"));
  if (rotations.length !== before.rotations) fail(`CustomWallpaper 设置页面额外触发了随机轮换：${rotations.join(", ")}`);
}

export function assertWallpaperDisposed(metrics) {
  if (metrics.appearanceClearBackground < 1) fail("CustomWallpaper 插件停用后未清除全局背景");
  if (metrics.appearanceClearTokens < 1) fail("CustomWallpaper 插件停用后未清除全局配色");
}

export async function assertWallpaperTimerRotation(entry, manifest, probe) {
  const secondId = "b".repeat(64);
  const state = wallpaperTestState({
    rotation: {
      mode: "timer",
      intervalMinutes: 1,
      epochUnixMs: Date.now(),
      nextSwitchAt: new Date(Date.now() + 40).toISOString(),
    },
  });
  const metrics = createMetrics();
  const registrations = [];
  const module = await import(`${pathToFileURL(entry).href}?contract=${encodeURIComponent(manifest.artifactName)}&case=timer`);
  const host = createMockHost(manifest.artifactName, registrations, metrics, state);
  const cleanup = activationCleanup(await module.activate(host));
  if (!cleanup) fail(`插件 ${manifest.artifactName} 的 activate(host) 未返回 cleanup/dispose`);
  try {
    await flushDom();
    if (metrics.appearanceSetBackground < 1) fail("CustomWallpaper 定时轮换实例启动时未应用壁纸背景");
    const appliedBefore = metrics.appearanceSetBackground;
    const backgroundBefore = metrics.appearanceBackgroundUrl;
    // 轮换到点前服务端当前壁纸已变化；计时触发时必须重新读取状态并应用新壁纸。
    state.assets = [...state.assets, { ...state.assets[0], id: secondId, originalName: "second.png", paletteVersion: 0, palette: {} }];
    state.order = [...state.order, secondId];
    state.currentId = secondId;
    state.revision = 2;
    state.rotation = { mode: "off", intervalMinutes: 30, epochUnixMs: Date.now(), nextSwitchAt: null };
    await new Promise(resolve => setTimeout(resolve, 1400));
    await flushDom();
    if (metrics.appearanceSetBackground <= appliedBefore) {
      fail("CustomWallpaper 定时轮换到点后未重新应用背景");
    }
    if (metrics.appearanceBackgroundUrl === backgroundBefore) {
      fail("CustomWallpaper 定时轮换后背景地址未更新");
    }
  } finally {
    await cleanup();
    await flushDom();
  }
  if (metrics.appearanceClearBackground < 1) fail("CustomWallpaper 定时轮换实例停用后未清除全局背景");
  if (probe.intervals.size > 0) {
    fail(`CustomWallpaper 定时轮换实例停用后仍有 ${probe.intervals.size} 个定时器未释放`);
  }
  for (const connectionKind of ['remote','unknown']) {
    const readMetrics = createMetrics(); readMetrics.connectionKind = connectionKind;
    const readState = wallpaperTestState({rotation: {mode:'startup',intervalMinutes:30,epochUnixMs:Date.now(),nextSwitchAt:null}});
    const remote = await import(`${pathToFileURL(entry).href}?case=${connectionKind}`);
    const dispose = activationCleanup(await remote.activate(createMockHost(manifest.artifactName, [], readMetrics, readState)));
    try {
      await flushDom();
      if (readMetrics.apiPost || readMetrics.apiPut) fail(`CustomWallpaper ${connectionKind} activation mutated shared wallpaper state`);
      if (!readMetrics.appearanceBackgroundUrl) fail(`CustomWallpaper ${connectionKind} activation did not project the saved wallpaper`);
    } finally { await dispose(); await flushDom(); }
  }
}

export async function assertWallpaperStateOrdering(source) {
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('./') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  } });
  let createWallpaperRuntime;
  try { ({ createWallpaperRuntime } = await import(pathToFileURL(source).href)); }
  finally { hook.deregister(); }
  const original = { now: Date.now, setTimeout, clearTimeout, setInterval, clearInterval };
  const contract = JSON.parse(readFileSync(new URL('../../../plugins/general/CustomWallpaper/tests/fixtures/timer-contract.json', import.meta.url)));
  let now = contract.boundaryUnixMs - 1000, nextId = 1;
  const timers = new Map(), intervals = new Map();
  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => { const id = nextId++; timers.set(id, { callback, at: now + delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.setInterval = (callback, delay) => { const id = nextId++; intervals.set(id, { callback, delay, at: now + delay }); return id; };
  globalThis.clearInterval = id => intervals.delete(id);
  const settle = async () => { for (let index = 0; index < 24; index++) await Promise.resolve(); };
  const tick = async milliseconds => {
    const end = now + milliseconds;
    while (true) {
      const next = Math.min(...[...timers.values(), ...intervals.values()].map(timer => timer.at));
      if (next > end) break;
      now = next;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
      for (const timer of intervals.values()) if (timer.at <= now) { timer.at += timer.delay; timer.callback(); }
      await settle();
    }
    now = end;
    await settle();
  };
  const response = frame => {
    const state = wallpaperTestState(frame);
    const ids = [...new Set([contract.before.currentId, contract.committed.currentId])];
    state.assets = ids.map(id => ({ ...state.assets[0], id }));
    state.order = ids;
    state.selectedId = ids[0];
    return state;
  };
  const runtimes = [];
  try {
    for (const [before, committed] of [[contract.before, contract.committed], [contract.singleBefore, contract.singleCommitted]]) {
      now = contract.boundaryUnixMs - 1000;
      const metrics = createMetrics(); metrics.connectionKind = 'remote';
      const host = createMockHost('CustomWallpaper', [], metrics, response(before));
      host.api.get = async () => { metrics.apiGet++; return response(now < contract.commitUnixMs ? before : committed); };
      const runtime = createWallpaperRuntime(host); runtimes.push(runtime);
      const unsubscribe = runtime.subscribe(() => {});
      await Promise.all([runtime.start(), runtime.start()]);
      unsubscribe();
      assert.equal(metrics.apiGet, 1); assert.equal(metrics.apiPost, 0); assert.equal(intervals.size, 1);
      for (let index = 0; index < 4; index++) {
        await tick(1000);
        assert.equal(runtime.snapshot().state.currentId, before.currentId);
        assert.equal(runtime.snapshot().state.rotation.nextSwitchAt, before.rotation.nextSwitchAt);
        assert.equal(timers.size, 1, 'pending committed cursor must retain one catch-up timer');
      }
      await tick(1000);
      assert.equal(now, contract.commitUnixMs);
      assert.equal(metrics.apiGet, 6, 'four-second backend delay must resolve before the 30-second poll');
      assert.equal(runtime.snapshot().state.currentId, committed.currentId);
      assert.equal(runtime.snapshot().state.revision, committed.revision);
      assert.equal(runtime.snapshot().state.rotation.nextSwitchAt, committed.rotation.nextSwitchAt);
      assert.equal([...timers.values()][0].at, Date.parse(committed.rotation.nextSwitchAt));
      assert.equal(metrics.appearanceSetBackground, before.currentId === committed.currentId ? 1 : 2);
      runtime.dispose(); assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
    }
    now = contract.boundaryUnixMs;
    const metrics = createMetrics(); metrics.connectionKind = 'remote';
    const host = createMockHost('CustomWallpaper', [], metrics, response(contract.before));
    const runtime = createWallpaperRuntime(host); runtimes.push(runtime);
    await runtime.start();
    let reads = 0;
    host.api.get = async () => { reads++; throw new Error('temporarily unavailable'); };
    await tick(12_000);
    assert.equal(reads, 8, 'failed overdue reads must stop at eight retries');
    assert.equal(timers.size, 0); assert.equal(intervals.size, 1);
    host.api.get = async () => response(contract.committed);
    await tick(18_000);
    assert.equal(runtime.snapshot().state.currentId, contract.committed.currentId, 'low-frequency poll must recover after catch-up exhaustion');
    assert.equal(runtime.snapshot().error, '');
    let resolveOld;
    const oldState = response(contract.committed);
    host.api.get = async () => new Promise(resolve => { resolveOld = resolve; });
    const oldRead = runtime.refresh();
    const saved = { ...response(contract.before), revision: oldState.revision + 1 };
    await runtime.apply(saved);
    const backgroundCount = metrics.appearanceSetBackground;
    resolveOld(oldState); await oldRead;
    assert.equal(runtime.snapshot().state.revision, saved.revision);
    assert.equal(runtime.snapshot().state.currentId, saved.currentId);
    assert.equal(metrics.appearanceSetBackground, backgroundCount, 'stale GET must not undo a confirmed save');
    host.api.get = async () => structuredClone(saved);
    for (const patch of [{effectiveEnabled:false}, {rotation:{mode:'off',nextSwitchAt:null}}, {assets:[],order:[],currentId:''}]) {
      await runtime.apply({ ...saved, ...patch });
      assert.equal(timers.size, 0, 'disabled or empty wallpaper must release its rotation timer');
    }
    await runtime.apply({ ...saved, rotation: { mode: 'timer', nextSwitchAt: 'invalid' } });
    assert.equal(timers.size, 0);
    let resolveBlob;
    host.api.blob = async () => new Promise(resolve => { resolveBlob = resolve; });
    const applying = runtime.apply(saved);
    await settle();
    let resolveDisposed; host.api.get = async () => new Promise(resolve => { resolveDisposed = resolve; });
    const pending = runtime.refresh(); runtime.dispose();
    const afterDispose = [metrics.appearanceSetBackground, metrics.appearanceSetTokens];
    resolveBlob(new Blob(['late wallpaper'])); resolveDisposed(saved);
    await Promise.all([pending, applying]);
    assert.deepEqual([metrics.appearanceSetBackground, metrics.appearanceSetTokens], afterDispose);
    assert.equal(runtime.snapshot().state, null);
    assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
  } finally {
    runtimes.forEach(runtime => runtime.dispose()); Date.now = original.now;
    for (const key of ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) globalThis[key] = original[key];
  }
}
