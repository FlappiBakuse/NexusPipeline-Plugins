import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const options = parseArguments(process.argv.slice(2));
const repositoryRoot = path.resolve(options.repositoryRoot || path.join(import.meta.dirname, ".."));
const pluginRoot = path.join(repositoryRoot, "plugins");
const FRONTEND_API_VERSION = "1.5";
const allowedSlots = new Set([
  "dashboard.cards",
  "dashboard.after-running",
  "users.list.badges",
  "users.binding.sections",
  "users.global.sections",
  "scripts.list.badges",
  "scripts.editor.sections",
  "queues.list.badges",
  "queues.editor.sections",
  "dispatch.cards",
  "dispatch.running.badges",
  "dispatch.running.sidecar",
  "dispatch.run.sections",
  "history.list.badges",
  "history.detail.sections",
  "settings.sections",
  "settings.cards",
  "shell.nav",
]);

/** 宿主私有结构 class；官方插件只能使用自己的命名空间 class 与公开元素。 */
const hostPrivateClasses = new Set([
  "badge",
  "content-card",
  "eyebrow",
  "field",
  "field-label",
  "form-grid",
  "ghost",
  "muted",
  "page-head",
  "page-head-actions",
  "page-head-copy",
  "page-kicker",
  "plugin-surface",
  "primary",
  "req",
  "secondary-surface",
  "section-surface",
  "settings-card",
  "settings-card-arrow",
  "settings-card-body",
  "settings-card-copy",
  "settings-card-title",
  "settings-card-toggle",
  "settings-list",
  "switch-copy",
  "switch-row",
  "tertiary",
]);

const scannableExtensions = new Set([".css", ".html", ".js", ".ts", ".vue"]);

function parseArguments(args) {
  const result = {
    repositoryRoot: process.env.NEXUS_OFFICIAL_PLUGINS_ROOT || "",
    hostRoot: process.env.NEXUS_HOST_ROOT || "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--host-root") {
      result.hostRoot = args[index + 1] || "";
      index += 1;
      continue;
    }
    if (!result.repositoryRoot) result.repositoryRoot = value;
  }
  return result;
}

function fail(message) {
  throw new Error(message);
}

function safeRelative(root, value, label, suffix) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} 不能为空`);
  const normalized = value.trim().replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)
    || parts.some(part => !part || part === "." || part === "..")) {
    fail(`${label} 必须是插件目录内的安全相对路径：${value}`);
  }
  if (!normalized.toLowerCase().endsWith(suffix)) fail(`${label} 必须使用 ${suffix} 扩展名：${value}`);
  const candidate = path.resolve(root, ...parts);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} 越出插件目录：${value}`);
  return candidate;
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function findManifests(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".generated" || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await findManifests(fullPath));
    else if (entry.isFile() && entry.name === "plugin.json") result.push(fullPath);
  }
  return result;
}

async function collectSourceFiles(directory) {
  const result = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectSourceFiles(fullPath));
    else if (entry.isFile() && scannableExtensions.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
  }
  return result;
}

/** 宿主公开元素集合：宿主检出可用时从注册表读取，保证与 NEXUS_PUBLIC_ELEMENTS 同源。 */
async function resolvePublicElements(hostRoot) {
  const candidates = [
    hostRoot ? path.join(hostRoot, "frontend", "src", "ui", "register.ts") : "",
    path.join(repositoryRoot, "..", "NexusPipeline", "frontend", "src", "ui", "register.ts"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!await isFile(candidate)) continue;
    const text = await readFile(candidate, "utf8");
    const block = /NEXUS_PUBLIC_ELEMENTS\s*=\s*\{([\s\S]*?)\}/.exec(text);
    if (!block) continue;
    const names = [...block[1].matchAll(/"([a-z0-9-]+)"\s*:/g)].map(match => match[1]);
    if (names.length) return new Set(names);
  }
  fail("缺少宿主公共元素注册表；请检出锁定或候选宿主并传入 --host-root。");
}

function cssClassTokens(text) {
  return new Set([...text.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(match => match[1]));
}

function markupClassTokens(text) {
  const tokens = new Set();
  const patterns = [
    /class\s*[:=]\s*"([^"]*)"/g,
    /class\s*[:=]\s*'([^']*)'/g,
    /className\s*[:=]\s*"([^"]*)"/g,
    /classList\.(?:add|remove|toggle)\(\s*"([^"]*)"/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      for (const token of match[1].split(/\s+/)) {
        if (token) tokens.add(token);
      }
    }
  }
  return tokens;
}

/** 只把元素位置的 `nxp-*` 视作宿主元素；同前缀的自定义事件名不属于元素使用。 */
function usedElementNames(text) {
  const names = new Set();
  const patterns = [
    /<(nxp-[a-z0-9-]+)/g,
    /createElement[A-Za-z]*\(\s*["'](nxp-[a-z0-9-]+)["']/g,
    /querySelector(?:All)?\(\s*["'](nxp-[a-z0-9-]+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

/** 扫描插件自有源码与发行产物：宿主私有 class、公开元素白名单、Nexus UI SFC 复制。 */
async function assertPluginFrontendBoundaries(pluginDirectory, artifactName, publicElements) {
  const scanned = [
    ...await collectSourceFiles(path.join(pluginDirectory, "frontend", "src")),
    ...await collectSourceFiles(path.join(pluginDirectory, "web")),
  ];
  for (const file of scanned) {
    const relative = path.relative(repositoryRoot, file).replaceAll("\\", "/");
    const name = path.basename(file);
    if (file.includes(`${path.sep}frontend${path.sep}`) && /^Nxp[A-Z].*\.vue$/.test(name)) {
      fail(`${artifactName} 复制了宿主 Nexus UI 组件：${relative}`);
    }
    const text = await readFile(file, "utf8");
    const tokens = path.extname(file).toLowerCase() === ".css" ? cssClassTokens(text) : markupClassTokens(text);
    const violations = [...tokens].filter(token => hostPrivateClasses.has(token));
    if (violations.length) {
      fail(`${artifactName} 使用了宿主私有 class：${relative} -> ${violations.join(", ")}`);
    }
    const unknownElements = [...usedElementNames(text)].filter(name => !publicElements.has(name));
    if (unknownElements.length) {
      fail(`${artifactName} 使用了非公开宿主元素：${relative} -> ${unknownElements.join(", ")}`);
    }
  }
}

/** 自定义壁纸生命周期回归使用的插件状态；用例按需改写字段后再触发运行时刷新。 */
function wallpaperTestState(overrides = {}) {
  const assetId = "a".repeat(64);
  return {
    revision: 1,
    enabled: true,
    effectiveEnabled: true,
    assets: [{
      id: assetId,
      originalName: "wallpaper.png",
      mimeType: "image/png",
      sizeBytes: 4096,
      createdAt: "2026-09-12T00:00:00.000Z",
      paletteVersion: 3,
      palette: { "--accent": "hsl(210 60% 42%)" },
    }],
    order: [assetId],
    selectedId: assetId,
    currentId: assetId,
    rotation: { mode: "off", intervalMinutes: 30, epochUnixMs: Date.now(), nextSwitchAt: null },
    effects: { blurPx: 4, dimPercent: 20, surfaceTransparencyPercent: 10, applyTransparencyToSecondarySurfaces: true },
    limits: { maxAssetBytes: 8 * 1024 * 1024, maxAssets: 32, maxTotalBytes: 256 * 1024 * 1024 },
    ...overrides,
  };
}

function defaultTestState() {
  return {
    revision: 1,
    enabled: false,
    effectiveEnabled: false,
    assets: [],
    order: [],
    selectedId: "",
    currentId: "",
    rotation: { mode: "off", intervalMinutes: 30, epochUnixMs: Date.now(), nextSwitchAt: null },
    effects: { blurPx: 0, dimPercent: 20, surfaceTransparencyPercent: 0, applyTransparencyToSecondarySurfaces: true },
    limits: { maxAssetBytes: 8 * 1024 * 1024, maxAssets: 32, maxTotalBytes: 256 * 1024 * 1024 },
  };
}

function gameCheckInTestState() {
  return {
    tasks: [],
    platforms: [
      { id: "cn", name: "米游社", games: [{ id: "gi", name: "原神" }] },
      { id: "os", name: "HoYoLAB", games: [{ id: "gi", name: "Genshin Impact" }] },
      { id: "skland", name: "森空岛", games: [{ id: "ak", name: "明日方舟" }] },
      { id: "skport", name: "SKPORT", games: [{ id: "endfield", name: "Arknights: Endfield" }] },
      { id: "kuro", name: "库街区", games: [{ id: "ww", name: "鸣潮" }] },
    ],
    timeZoneId: "Asia/Shanghai",
    localTime: "2026-09-16T09:00:00+08:00",
  };
}

function gameCheckInTask(input, id, previous = null) {
  input = JSON.parse(JSON.stringify(input || {}));
  const actions = input.secrets || {};
  const configured = (key, old) => actions[key]?.action === "set"
    ? true
    : actions[key]?.action === "clear" ? false : old === true;
  const run = previous?.runs?.[0] || null;
  return {
    id,
    name: input.name,
    remark: input.remark || "",
    enabled: input.enabled,
    games: structuredClone(input.games || {}),
    schedules: structuredClone(input.schedules || []),
    notification: structuredClone(input.notification || { enabled: false, smtpTo: "" }),
    runs: structuredClone(previous?.runs || []),
    credentials: {
      cn: configured("cn", previous?.credentials?.cn),
      os: configured("os", previous?.credentials?.os),
      skland: configured("skland", previous?.credentials?.skland),
      skport: configured("skport", previous?.credentials?.skport),
      kuro: configured("kuro", previous?.credentials?.kuro),
    },
    isRunning: false,
    nextRunAt: input.enabled && input.schedules?.some(schedule => schedule.enabled)
      ? "2026-09-16T09:00:00+08:00"
      : null,
    recentRun: run,
  };
}

function createMockHost(pluginName, registrations, metrics, state = defaultTestState()) {
  const gameCheckInPlugin = String(pluginName).replaceAll("-", "").toLowerCase() === "gamecheckin";
  const host = {
    plugin: Object.freeze({ name: pluginName }),
    i18n: {
      t(_key, _args, fallback = "") { return fallback || _key; },
      formatTime(value) { return value; },
    },
    ui: { toast() {} },
    appearance: {
      registerTheme() { return { dispose() {} }; },
      applyTheme() { return "system"; },
      setTokens() { metrics.appearanceSetTokens += 1; },
      clearTokens() { metrics.appearanceClearTokens += 1; metrics.appearanceTokens = null; },
      setBackground(surface) {
        metrics.appearanceSetBackground += 1;
        if (metrics.appearanceBackgroundUrl) URL.revokeObjectURL(metrics.appearanceBackgroundUrl);
        metrics.appearanceBackgroundUrl = String(surface?.url || "");
      },
      clearBackground() {
        metrics.appearanceClearBackground += 1;
        if (metrics.appearanceBackgroundUrl) URL.revokeObjectURL(metrics.appearanceBackgroundUrl);
        metrics.appearanceBackgroundUrl = "";
      },
    },
    api: {
      async get(route) {
        metrics.apiGet += 1;
        metrics.apiCalls.push({ method: "GET", route: String(route) });
        return gameCheckInPlugin ? structuredClone(state) : { ...structuredClone(state), route };
      },
      async put(route, body) {
        metrics.apiPut += 1;
        const copiedBody = JSON.parse(JSON.stringify(body || {}));
        metrics.apiCalls.push({ method: "PUT", route: String(route), body: copiedBody });
        if (gameCheckInPlugin && route === "tasks") {
          const index = state.tasks.findIndex(task => task.id === copiedBody?.id);
          if (index < 0) throw Object.assign(new Error("task_not_found"), { code: "task_not_found" });
          state.tasks[index] = gameCheckInTask(copiedBody, copiedBody.id, state.tasks[index]);
          return structuredClone(state.tasks[index]);
        }
        if (gameCheckInPlugin && route === "tasks/order") {
          const ordered = copiedBody?.taskIds || [];
          if (ordered.length !== state.tasks.length || new Set(ordered).size !== ordered.length
            || ordered.some(id => !state.tasks.some(task => task.id === id))) {
            throw Object.assign(new Error("task_order_invalid"), { code: "task_order_invalid" });
          }
          const tasks = new Map(state.tasks.map(task => [task.id, task]));
          state.tasks = ordered.map(id => tasks.get(id));
          return { taskIds: ordered };
        }
        return structuredClone(state);
      },
      async post(route, body) {
        metrics.apiPost += 1;
        metrics.apiPostRoutes.push(String(route));
        const copiedBody = JSON.parse(JSON.stringify(body || {}));
        metrics.apiCalls.push({ method: "POST", route: String(route), body: copiedBody });
        if (gameCheckInPlugin && route === "tasks") {
          const task = gameCheckInTask(copiedBody, "task-check-in-1");
          state.tasks.push(task);
          return structuredClone(task);
        }
        if (gameCheckInPlugin && route === "tasks/run") {
          const task = state.tasks.find(item => item.id === copiedBody?.taskId);
          if (!task) throw Object.assign(new Error("task_not_found"), { code: "task_not_found" });
          const run = {
            id: "run-check-in-1",
            trigger: "manual",
            startedAt: "2026-09-16T09:00:00+08:00",
            completedAt: "2026-09-16T09:00:01+08:00",
            status: "success",
            results: [{ platform: "cn", gameCode: "gi", code: "success", message: "签到成功", success: true }],
          };
          task.runs.unshift(run);
          task.recentRun = run;
          return { runId: run.id, status: "running" };
        }
        return structuredClone(state);
      },
      async delete(route, body) {
        metrics.apiDelete += 1;
        const copiedBody = JSON.parse(JSON.stringify(body || {}));
        metrics.apiCalls.push({ method: "DELETE", route: String(route), body: copiedBody });
        if (gameCheckInPlugin && route === "tasks") {
          const index = state.tasks.findIndex(task => task.id === copiedBody?.taskId);
          if (index < 0) throw Object.assign(new Error("task_not_found"), { code: "task_not_found" });
          state.tasks.splice(index, 1);
          return { deleted: true };
        }
        return { deleted: true };
      },
      async blob() { metrics.apiBlob += 1; return new Blob(); },
      async upload() {
        metrics.apiUpload += 1;
        return {
          ok: true,
          duplicate: false,
          asset: { id: "a".repeat(64), originalName: "upload.png", mimeType: "image/png", sizeBytes: 12 },
          state: structuredClone(state),
        };
      },
    },
    executionPreview: {
      async capture() {
        metrics.screenshotCapture += 1;
        return { state: "ready", url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", source: "pc_game", capturedAt: "2026-09-11T00:00:00.000Z" };
      },
    },
    slots: {
      register(slot, renderer) {
        if (typeof slot !== "string" || !allowedSlots.has(slot)) fail(`插件 ${pluginName} 注册了未知 UI slot：${slot}`);
        if (typeof renderer !== "function") fail(`插件 ${pluginName} 的 UI slot renderer 无效：${slot}`);
        const registration = { slot, renderer, disposed: false };
        registrations.push(registration);
        return {
          dispose() { registration.disposed = true; },
        };
      },
    },
    routes: {
      register(route, handler) {
        if (typeof route !== "string" || !route.trim() || typeof handler !== "function") fail(`插件 ${pluginName} 的 page route 无效`);
        const registration = { route, handler, disposed: false };
        metrics.routeRegistrations.push(registration);
        return { dispose() { registration.disposed = true; } };
      },
    },
    nav: {
      register(item) {
        if (!item?.title || !item?.route) fail(`插件 ${pluginName} 的导航项缺少标题或 route`);
        const registration = { ...item, disposed: false };
        metrics.navRegistrations.push(registration);
        return { dispose() { registration.disposed = true; } };
      },
    },
    lifecycle: {
      onDispose(handler) {
        if (typeof handler !== "function") fail(`插件 ${pluginName} 的 onDispose handler 无效`);
        const registration = { handler, disposed: false };
        metrics.lifecycleHandlers.push(registration);
        return { dispose() { registration.disposed = true; } };
      },
    },
  };
  return host;
}

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  const names = ["window", "document", "navigator", "location", "Element", "HTMLElement", "SVGElement", "Node", "Text", "Comment", "Event", "CustomEvent", "MutationObserver", "getComputedStyle", "Blob", "AbortController", "AbortSignal", "DOMException", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = new Map();
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    previous.set(name, descriptor);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      writable: true,
      value: dom.window[name] ?? dom.window,
    });
  }
  // jsdom 不实现 Blob URL；插件托管的壁纸地址需要一个可计数的等价实现来验证创建与释放。
  const createdUrls = new Set();
  let urlCounter = 0;
  const nativeCreateObjectUrl = URL.createObjectURL;
  const nativeRevokeObjectUrl = URL.revokeObjectURL;
  URL.createObjectURL = () => {
    const value = `blob:nexus-plugin-test/${++urlCounter}`;
    createdUrls.add(value);
    return value;
  };
  URL.revokeObjectURL = value => {
    createdUrls.delete(String(value));
  };
  return {
    createdUrls,
    restore() {
      URL.createObjectURL = nativeCreateObjectUrl;
      URL.revokeObjectURL = nativeRevokeObjectUrl;
      for (const name of names) {
        const descriptor = previous.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
      dom.window.close();
    },
    dom,
  };
}

/**
 * 记录插件渲染期间的定时器与 window 事件监听，用于验证卸载后不残留。
 * 只统计调用栈来自插件发行目录的注册，避免把 jsdom 与 Vue 运行时自身的监听误判为插件泄漏。
 */
function installLifecycleProbe(window, pluginRoot) {
  const attribute = pluginRoot.replaceAll("\\", "/").toLowerCase();
  const fromPlugin = () => {
    const stack = new Error().stack;
    return typeof stack === "string" && stack.replaceAll("\\", "/").toLowerCase().includes(attribute);
  };
  const probe = { intervals: new Set(), timeouts: new Set(), listeners: new Map() };
  const nativeSetInterval = globalThis.setInterval;
  const nativeClearInterval = globalThis.clearInterval;
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  globalThis.setInterval = (handler, delay, ...rest) => {
    const attributeCall = fromPlugin();
    const handle = nativeSetInterval(handler, delay, ...rest);
    if (attributeCall) probe.intervals.add(handle);
    return handle;
  };
  globalThis.clearInterval = handle => {
    probe.intervals.delete(handle);
    return nativeClearInterval(handle);
  };
  globalThis.setTimeout = (handler, delay, ...rest) => {
    const attributeCall = fromPlugin();
    const handle = nativeSetTimeout((...args) => {
      probe.timeouts.delete(handle);
      handler(...args);
    }, delay, ...rest);
    if (attributeCall) probe.timeouts.add(handle);
    return handle;
  };
  globalThis.clearTimeout = handle => {
    probe.timeouts.delete(handle);
    return nativeClearTimeout(handle);
  };
  window.addEventListener = (type, listener, options) => {
    if (fromPlugin()) {
      const list = probe.listeners.get(type) || [];
      list.push(listener);
      probe.listeners.set(type, list);
    }
    return nativeAdd(type, listener, options);
  };
  window.removeEventListener = (type, listener, options) => {
    const list = probe.listeners.get(type) || [];
    const index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
    if (!list.length) probe.listeners.delete(type);
    return nativeRemove(type, listener, options);
  };
  probe.restore = () => {
    globalThis.setInterval = nativeSetInterval;
    globalThis.clearInterval = nativeClearInterval;
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
    window.addEventListener = nativeAdd;
    window.removeEventListener = nativeRemove;
  };
  return probe;
}

async function flushDom() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

function createMetrics() {
  return {
    apiGet: 0,
    apiPut: 0,
    apiPost: 0,
    apiDelete: 0,
    apiBlob: 0,
    apiUpload: 0,
    apiPostRoutes: [],
    apiCalls: [],
    routeRegistrations: [],
    navRegistrations: [],
    lifecycleHandlers: [],
    appearanceSetBackground: 0,
    appearanceClearBackground: 0,
    appearanceSetTokens: 0,
    appearanceClearTokens: 0,
    appearanceBackgroundUrl: "",
    screenshotCapture: 0,
  };
}

function activationCleanup(result) {
  if (typeof result === "function") return result;
  if (result && typeof result.dispose === "function") return () => result.dispose();
  if (result && typeof result.deactivate === "function") return () => result.deactivate();
  return null;
}

function clickPluginButton(container, label) {
  const button = [...container.querySelectorAll("nxp-button")]
    .find(item => item.getAttribute("label") === label);
  if (!button) fail(`GameCheckIn 页面缺少“${label}”操作`);
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function changePublicControl(container, selector, value) {
  const control = container.querySelector(selector);
  if (!control) fail(`GameCheckIn 页面缺少公开控件：${selector}`);
  control.dispatchEvent(new window.CustomEvent("change", { bubbles: true, detail: [value] }));
}

async function assertGameCheckInRoute(host, metrics, state) {
  const route = metrics.routeRegistrations.find(item => item.route === "tasks");
  const navigation = metrics.navRegistrations.find(item => item.id === "check-in-tasks");
  if (!route || !navigation) fail("GameCheckIn 必须注册签到页面 route 和侧边栏导航项");
  if (navigation.title !== "签到" || navigation.route !== "tasks") fail("GameCheckIn 侧边栏导航必须打开签到任务页面");

  const view = document.createElement("main");
  view.id = "view";
  document.body.append(view);
  await route.handler(1, ["plugin", "game-checkin", "tasks"], host);
  await flushDom();
  await flushDom();
  if (!view.querySelector("[data-game-check-in-page]")) fail("GameCheckIn route 未挂载签到任务页面");
  if (!view.querySelector("nxp-empty-state")) fail("空任务状态没有展示添加任务入口");
  const expectedControls = ["nxp-text-input", "nxp-text-area", "nxp-select", "nxp-switch-setting", "nxp-collapsible-card"];

  clickPluginButton(view, "添加签到任务");
  await flushDom();
  if (!expectedControls.every(name => view.querySelector(name))) fail("签到任务编辑器缺少公开 NXP 输入控件");
  changePublicControl(view, "nxp-text-input#gci-task-name", "晨间签到");
  changePublicControl(view, "nxp-text-area#gci-task-remark", "周末也检查活动状态");
  changePublicControl(view, "nxp-select#gci-games-cn", ["gi"]);
  changePublicControl(view, "nxp-switch-setting#gci-notification-enabled", true);
  changePublicControl(view, "nxp-text-input#gci-secret-cn", "task-cookie-secret");
  changePublicControl(view, "nxp-text-input#gci-smtp-to", "task@example.test");
  const previousCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { randomUUID: undefined },
  });
  try {
    clickPluginButton(view, "+ 添加定时");
    await flushDom();
  } finally {
    if (previousCrypto) Object.defineProperty(globalThis, "crypto", previousCrypto);
    else delete globalThis.crypto;
  }
  if (!view.querySelector("nxp-time-picker")) fail("无法在不支持 randomUUID 的环境中添加计划");
  const scheduleDays = [...view.querySelectorAll(".gci-day-button")];
  if (scheduleDays.length !== 7 || scheduleDays.some(button => !button.closest("nxp-button"))) {
    fail("签到计划的星期按钮必须统一使用宿主公开 nxp-button 元件");
  }
  if (!view.querySelector("nxp-schedule-card nxp-switch") || !view.querySelector("nxp-schedule-card nxp-button")) {
    fail("签到计划的启用和删除操作必须统一使用宿主公开 nxp-* 元件");
  }
  changePublicControl(view, "nxp-time-picker", "06:30");
  clickPluginButton(view, "保存");
  await flushDom();
  await flushDom();

  const created = metrics.apiCalls.find(call => call.method === "POST" && call.route === "tasks");
  if (!created?.body || created.body.name !== "晨间签到") {
    fail(`新增签到任务没有提交名称和核心设置：${JSON.stringify(created)}；${view.textContent}`);
  }
  if (created.body.remark !== "周末也检查活动状态") fail("新增任务没有提交备注");
  if (created.body.games?.cn?.[0] !== "gi") fail("新增任务没有提交所选平台游戏");
  if (created.body.schedules?.[0]?.time !== "06:30") fail("新增任务没有提交固定时间设置");
  if (!created.body.schedules?.[0]?.id) fail("新增任务没有提交计划标识");
  if (created.body.secrets?.cn?.action !== "set") fail("新增任务没有提交平台凭据");
  if (!created.body.notification?.enabled || created.body.notification?.smtpTo !== "task@example.test") fail("新增任务没有提交宿主通知设置和 SMTP 收件人");
  if ("cnDeviceId" in created.body || "kuroDevCode" in created.body || "kuroDistinctId" in created.body) fail("任务保存请求暴露了内部设备标识");
  if ("notifications" in created.body || "webhookUrl" in (created.body.secrets || {}) || "smtpPassword" in (created.body.secrets || {})) fail("任务保存请求仍包含旧版独立通知字段");
  if (!view.textContent.includes("晨间签到")) fail(`新建任务保存后没有显示在签到任务列表：${JSON.stringify(state.tasks)}；${view.textContent}`);
  if (view.textContent.includes("task-cookie-secret") || view.textContent.includes("cnDeviceId")) fail("任务列表泄露了任务凭据或内部设备标识");

  clickPluginButton(view, "立即签到");
  await flushDom();
  await flushDom();
  if (!metrics.apiCalls.some(call => call.method === "POST" && call.route === "tasks/run" && call.body?.taskId === "task-check-in-1")) {
    fail("立即签到没有调用任务手动运行 API");
  }
  if (!view.textContent.includes("成功")) fail("页面没有反馈本次签到结果");

  clickPluginButton(view, "编辑签到");
  await flushDom();
  changePublicControl(view, "nxp-text-input#gci-task-name", "晨间签到（更新）");
  clickPluginButton(view, "保存");
  await flushDom();
  await flushDom();
  const updated = metrics.apiCalls.findLast(call => call.method === "PUT" && call.route === "tasks");
  if (!updated?.body || updated.body.name !== "晨间签到（更新）") fail("编辑任务没有提交修改后的设置");
  if (updated.body.secrets?.cn?.action !== "keep") fail("编辑时留空凭据没有提交保留动作");
  const saved = state.tasks.find(task => task.id === "task-check-in-1");
  if (!saved?.credentials?.cn || saved.notification?.smtpTo !== "task@example.test") fail("留空凭据保留或 SMTP 收件人保存语义不正确");

  clickPluginButton(view, "删除签到");
  await flushDom();
  clickPluginButton(view, "确定");
  await flushDom();
  await flushDom();
  const deleted = metrics.apiCalls.find(call => call.method === "DELETE" && call.route === "tasks");
  if (deleted?.body?.taskId !== "task-check-in-1" || state.tasks.length !== 0) fail("删除任务没有调用对应的任务 API");
  if (state.tasks.length !== 0 || !view.querySelector("nxp-empty-state")) fail("删除最后一个任务后没有反馈空状态");

  for (const registration of metrics.lifecycleHandlers) registration.handler();
  await flushDom();
  if (view.querySelector("[data-game-check-in-page]")) fail("离开签到页面时没有卸载页面组件");
  await route.handler(2, ["plugin", "game-checkin", "tasks"], host);
  await flushDom();
  if (!view.querySelector("[data-game-check-in-page]")) fail("再次进入签到 route 后没有重新挂载页面");
  return { route: route.route, nav: navigation.id, apiCalls: metrics.apiCalls.filter(call => call.route !== "state").length };
}

/**
 * 用例 D：轮换方式已经配置为按时间随机轮换时，不进入设置页面也必须在到点后重新读取并应用壁纸。
 * 用独立的插件前端实例运行，避免与前一个实例的计时器相互影响。
 */
async function assertWallpaperTimerRotation(entry, manifest, probe) {
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

async function assertMaaRenderer(host, registrations) {
  const originalPost = host.api.post;
  let resolveProfile;
  host.api.post = async route => route === "profile"
    ? await new Promise(resolve => { resolveProfile = resolve; })
    : { projectName: "Owned PI", projectVersion: "1", controller: [], resource: [], task: [], option: {} };
  const section = registrations.find(item => item.slot === "scripts.editor.sections");
  const element = document.createElement("div"); document.body.append(element);
  const context = { executionProviderId: "maa-framework", executionProviderConfigId: "owned-profile",
    primaryId: "owned-script", packageRoot: "C:/owned/fixture", mode: "edit" };
  let cleanup;
  try {
    cleanup = section.renderer({ element, context });
    if (typeof cleanup !== "function" || !resolveProfile) fail("Maa profile renderer lifecycle missing");
    const pathInput = [...element.querySelectorAll("nxp-text-input")].find(item => item.modelValue === "interface.json");
    if (!pathInput) fail("Maa interface input missing");
    pathInput.dispatchEvent(new CustomEvent("update:modelValue", { detail: ["edited.json"] }));
    resolveProfile({ profileId: "owned-profile", interfacePath: "stale.json" });
    await flushDom();
    if (pathInput.modelValue !== "edited.json" || !pathInput.isConnected) fail("Maa delayed profile load overwrote the edited draft");
    const inspect = [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "读取项目");
    inspect.dispatchEvent(new Event("click")); await flushDom();
    if (!element.textContent.includes("Owned PI")) fail("Maa readonly inspect did not render its result");
    cleanup(); cleanup = null;
    if (element.childElementCount !== 0) fail("Maa renderer did not remove its card");
    cleanup = section.renderer({ element, context });
    cleanup(); cleanup = null;
    resolveProfile({ profileId: "owned-profile", interfacePath: "late.json" });
    await flushDom();
    if (element.childElementCount !== 0) fail("Maa disposed renderer applied a delayed response");
  } finally {
    cleanup?.(); element.remove(); host.api.post = originalPost;
  }
}

async function runPlugin(manifestPath, publicElements) {
  const plugin = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const frontend = manifest.frontend;
  if (!frontend) return null;
  if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.includes("frontend-module")) {
    fail(`插件 ${manifest.artifactName || plugin} 声明 frontend 但缺少 frontend-module capability`);
  }
  if (frontend.apiVersion !== FRONTEND_API_VERSION) {
    fail(`插件 ${manifest.artifactName || plugin} 的 frontend.apiVersion 必须为 ${FRONTEND_API_VERSION}`);
  }
  const entry = safeRelative(plugin, frontend.entry, `${manifest.artifactName}.frontend.entry`, ".js");
  if (!await isFile(entry)) fail(`插件 ${manifest.artifactName} 的 frontend.entry 文件不存在：${entry}`);
  const styles = frontend.styles ?? [];
  if (!Array.isArray(styles)) fail(`插件 ${manifest.artifactName} 的 frontend.styles 必须是数组`);
  for (const style of styles) {
    const stylePath = safeRelative(plugin, style, `${manifest.artifactName}.frontend.styles`, ".css");
    if (!await isFile(stylePath)) fail(`插件 ${manifest.artifactName} 的 frontend.styles 文件不存在：${stylePath}`);
  }
  await assertPluginFrontendBoundaries(plugin, manifest.artifactName, publicElements);

  // 这些页面型插件使用 route/nav 生命周期；其他插件则接入公开 UI slot。
  const wallpaperPlugin = manifest.artifactName === "CustomWallpaper";
  const gameCheckInPlugin = manifest.artifactName === "GameCheckIn";
  const state = gameCheckInPlugin ? gameCheckInTestState() : wallpaperPlugin ? wallpaperTestState() : defaultTestState();
  const restoreDom = installDom();
  const metrics = createMetrics();
  const probe = installLifecycleProbe(globalThis.window, path.dirname(entry));
  try {
    const module = await import(`${pathToFileURL(entry).href}?contract=${encodeURIComponent(manifest.artifactName)}`);
    if (typeof module.activate !== "function") fail(`插件 ${manifest.artifactName} 缺少 activate(host)`);
    const registrations = [];
    const host = createMockHost(manifest.artifactName, registrations, metrics, state);
    const result = await module.activate(host);
    if (!registrations.length && !gameCheckInPlugin) fail(`插件 ${manifest.artifactName} 未注册任何 UI slot`);
    for (const registration of registrations) {
      if (!allowedSlots.has(registration.slot)) fail(`插件 ${manifest.artifactName} 注册了未知 UI slot：${registration.slot}`);
    }
    const cleanup = activationCleanup(result);
    if (!cleanup) fail(`插件 ${manifest.artifactName} 的 activate(host) 未返回 cleanup/dispose`);
    await flushDom();

    const sessionRotationRequests = wallpaperPlugin
      ? metrics.apiPostRoutes.filter(route => route === "rotation/advance-session")
      : [];
    if (wallpaperPlugin && sessionRotationRequests.length !== 1) {
      fail(`CustomWallpaper 激活时应恰好推进一次 Web 会话轮换，实际 ${sessionRotationRequests.length} 次`);
    }

    let disposed = false;
    const disposePlugin = async () => {
      if (disposed) return;
      disposed = true;
      await cleanup();
      await flushDom();
    };
    try {
      const pageResult = gameCheckInPlugin
        ? await assertGameCheckInRoute(host, metrics, state)
        : null;
      // 用例 A：路由直接停在任意页面（没有渲染任何设置卡片）时，插件也必须已经应用背景与配色。
      if (wallpaperPlugin) {
        if (metrics.appearanceSetBackground < 1) fail("CustomWallpaper 未在插件激活后应用壁纸背景（缺少设置页面时失效）");
        if (metrics.appearanceSetTokens < 1) fail("CustomWallpaper 未在插件激活后应用壁纸配色（缺少设置页面时失效）");
        if (!metrics.appearanceBackgroundUrl) fail("CustomWallpaper 未向宿主外观表面提供背景地址");
      }
      const clearsBeforeSettings = { background: metrics.appearanceClearBackground, tokens: metrics.appearanceClearTokens };

      const rendererCleanups = [];
      try {
        if (manifest.artifactName === "MaaFrameworkDriver") await assertMaaRenderer(host, registrations);
        for (const registration of registrations) {
          const element = document.createElement("div");
          document.body.append(element);
          const context = { mode: "test", primaryId: manifest.artifactName === "LiveScreenshot" ? "run-test" : "" };
          const rendererCleanup = await registration.renderer({ element, context });
          if (typeof rendererCleanup !== "function") fail(`插件 ${manifest.artifactName} 的 ${registration.slot} renderer 未返回 cleanup`);
          rendererCleanups.push(rendererCleanup);
          await flushDom();
          if (manifest.artifactName === "CustomWallpaper") {
            if (!element.querySelector('[data-settings-panel="custom-wallpaper"]')) {
              fail("CustomWallpaper renderer 未挂载设置面板");
            }
            if (!element.querySelector("nxp-collapsible-card")) {
              fail("CustomWallpaper renderer 未使用宿主公开折叠卡片组件");
            }
            const requiredControls = [
              "nxp-file-picker",
              "nxp-switch-setting",
              "nxp-select",
              "nxp-number-input",
              "nxp-range",
            ];
            const missingControls = requiredControls.filter(control => !element.querySelector(control));
            if (missingControls.length) {
              fail(`CustomWallpaper renderer 缺少设置控件：${missingControls.join(", ")}`);
            }
          }
          if (manifest.artifactName === "LiveScreenshot" && !element.querySelector("[data-live-screenshot-card]")) {
            fail("LiveScreenshot renderer 未挂载实时截图面板");
          }
        }
        if (manifest.artifactName === "CustomWallpaper" && metrics.apiGet + metrics.apiPost < 1) {
          fail("CustomWallpaper renderer 未通过插件 Web API 读取状态");
        }
        if (manifest.artifactName === "LiveScreenshot" && metrics.screenshotCapture < 1) {
          fail("LiveScreenshot renderer 未调用 executionPreview.capture");
        }
      } finally {
        for (const rendererCleanup of rendererCleanups.reverse()) await rendererCleanup();
      }
      await flushDom();

      if (wallpaperPlugin) {
        // 用例 B：离开设置页面后背景与配色必须保留，设置卡片只释放自己的缩略图与计时。
        if (metrics.appearanceClearBackground > clearsBeforeSettings.background) {
          fail("CustomWallpaper 设置卡片卸载时清除了全局背景");
        }
        if (metrics.appearanceClearTokens > clearsBeforeSettings.tokens) {
          fail("CustomWallpaper 设置卡片卸载时清除了全局配色");
        }
        if (!metrics.appearanceBackgroundUrl) {
          fail("CustomWallpaper 离开设置页面后背景丢失");
        }
        // 用例 C：进入或离开设置页面不得额外触发 Web 会话轮换。
        const rotationRequests = metrics.apiPostRoutes.filter(route => route.includes("rotation"));
        if (rotationRequests.length !== sessionRotationRequests.length) {
          fail(`CustomWallpaper 的设置页面额外触发了随机轮换：${rotationRequests.join(", ")}`);
        }
      }

      await disposePlugin();

      // 用例 E：只有插件前端停用才清理全局外观、槽位与计时器。
      if (wallpaperPlugin) {
        if (metrics.appearanceClearBackground < 1) fail("CustomWallpaper 插件停用后未清除全局背景");
        if (metrics.appearanceClearTokens < 1) fail("CustomWallpaper 插件停用后未清除全局配色");
      }
      if (registrations.some(registration => !registration.disposed)) {
        fail(`插件 ${manifest.artifactName} 的 cleanup 未释放全部 UI slot`);
      }
      if (gameCheckInPlugin && (
        metrics.routeRegistrations.some(registration => !registration.disposed)
        || metrics.navRegistrations.some(registration => !registration.disposed)
        || metrics.lifecycleHandlers.some(registration => !registration.disposed)
      )) {
        fail("GameCheckIn cleanup 未释放 route、nav 或页面生命周期订阅");
      }
      if (probe.intervals.size > 0) {
        fail(`插件 ${manifest.artifactName} 卸载后仍有 ${probe.intervals.size} 个定时器未释放`);
      }
      if (probe.listeners.size > 0) {
        fail(`插件 ${manifest.artifactName} 卸载后仍有未移除的 window 事件监听：${[...probe.listeners.keys()].join(", ")}`);
      }
      if (wallpaperPlugin) {
        await assertWallpaperTimerRotation(entry, manifest, probe);
      }
      return {
        artifactName: manifest.artifactName,
        entry: path.relative(repositoryRoot, entry).replaceAll("\\", "/"),
        slots: registrations.map(registration => registration.slot),
        rendered: registrations.length,
        ...(pageResult ? { route: pageResult.route, nav: pageResult.nav, apiCalls: pageResult.apiCalls } : {}),
      };
    } finally {
      await disposePlugin();
    }
  } finally {
    probe.restore();
    restoreDom.restore();
  }
}

export { createMockHost, createMetrics, wallpaperTestState, gameCheckInTestState, defaultTestState, activationCleanup };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) try {
  const publicElements = await resolvePublicElements(options.hostRoot);
  const manifests = (await findManifests(pluginRoot)).sort();
  let checked = 0;
  for (const manifestPath of manifests) {
    const result = await runPlugin(manifestPath, publicElements);
    if (!result) continue;
    checked += 1;
    console.log(`[frontend] ${result.artifactName}: activate -> render(${result.rendered}) -> cleanup`);
  }
  if (!checked) fail("未找到声明 frontend 的插件");
  console.log(`[frontend] conformance 通过：${checked} 个插件，公开元素 ${publicElements.size} 个`);
} catch (error) {
  console.error(`[frontend] conformance 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
