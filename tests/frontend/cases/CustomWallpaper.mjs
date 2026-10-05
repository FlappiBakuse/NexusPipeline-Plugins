import { pathToFileURL } from "node:url";
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
}
