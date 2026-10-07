import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
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
  let now = 1_000_000, nextId = 1;
  const timers = new Map(), intervals = new Map();
  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => { const id = nextId++; timers.set(id, { callback, at: now + delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.setInterval = (callback, delay) => { const id = nextId++; intervals.set(id, { callback, delay }); return id; };
  globalThis.clearInterval = id => intervals.delete(id);
  const settle = async () => { for (let index = 0; index < 24; index++) await Promise.resolve(); };
  const tick = async milliseconds => {
    now += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
    await settle();
  };
  const metrics = createMetrics(); metrics.connectionKind = 'remote';
  const server = wallpaperTestState({ rotation: { mode: 'timer', nextSwitchAt: new Date(now + 1000).toISOString() } });
  const host = createMockHost('CustomWallpaper', [], metrics, server);
  const runtime = createWallpaperRuntime(host);
  try {
    await Promise.all([runtime.start(), runtime.start()]);
    assert.equal(metrics.apiGet, 1); assert.equal(metrics.apiPost, 0); assert.equal(intervals.size, 1);
    await tick(1000);
    assert.equal(metrics.apiGet, 2); assert.equal(timers.size, 1, 'early unchanged read must schedule catch-up');
    const second = 'b'.repeat(64);
    server.assets.push({ ...server.assets[0], id: second }); server.currentId = second;
    server.rotation.nextSwitchAt = new Date(now + 60_000).toISOString();
    await tick(1000);
    assert.equal(runtime.snapshot().state.currentId, second, 'timer commit with unchanged config revision must appear');
    assert.equal(metrics.apiGet, 3);
    let resolveOld;
    const oldState = structuredClone(server);
    host.api.get = async () => new Promise(resolve => { resolveOld = resolve; });
    const oldRead = runtime.refresh();
    const saved = { ...structuredClone(server), revision: 2, currentId: server.assets[0].id };
    await runtime.apply(saved);
    const backgroundCount = metrics.appearanceSetBackground;
    resolveOld({ ...oldState, revision: 1 }); await oldRead;
    assert.equal(runtime.snapshot().state.revision, 2); assert.equal(runtime.snapshot().state.currentId, saved.currentId);
    assert.equal(metrics.appearanceSetBackground, backgroundCount, 'stale GET must not undo a confirmed save');
    host.api.get = async () => structuredClone(saved);
    await runtime.apply({ ...saved, rotation: { mode: 'timer', nextSwitchAt: new Date(now - 1000).toISOString() } });
    const expired = structuredClone(runtime.snapshot().state);
    let reads = 0; host.api.get = async () => { reads++; return structuredClone(expired); };
    for (let index = 0; index < 12; index++) await tick(1000);
    assert.equal(timers.size, 0); assert.ok(reads <= 8, 'overdue projection must stop high-frequency retry');
    await runtime.apply({ ...saved, rotation: { mode: 'timer', nextSwitchAt: 'invalid' } });
    assert.equal(timers.size, 0);
    let resolveDisposed; host.api.get = async () => new Promise(resolve => { resolveDisposed = resolve; });
    const pending = runtime.refresh(); runtime.dispose(); const afterDispose = metrics.appearanceSetBackground;
    resolveDisposed(saved); await pending;
    assert.equal(metrics.appearanceSetBackground, afterDispose); assert.equal(runtime.snapshot().state, null);
    assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
  } finally {
    runtime.dispose(); Date.now = original.now;
    for (const key of ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) globalThis[key] = original[key];
  }
}
