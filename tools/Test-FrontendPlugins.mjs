import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const repositoryRoot = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));
const pluginRoot = path.join(repositoryRoot, "plugins");
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

function createMockHost(pluginName, registrations) {
  const metrics = {
    wallpaperGet: 0,
    wallpaperSubscribe: 0,
    wallpaperDispose: 0,
    screenshotCapture: 0,
  };
  const wallpaperSnapshot = {
    revision: 1,
    effectiveEnabled: false,
    provider: { enabled: false },
    rotation: { mode: "off", intervalMinutes: 30, epochUnixMs: Date.now() },
    effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 0, applyTransparencyToSecondarySurfaces: true },
    assets: [],
    order: [],
  };
  const wallpaperStore = {
    async get() {
      metrics.wallpaperGet += 1;
      return structuredClone(wallpaperSnapshot);
    },
    async save(settings) {
      return { ...structuredClone(wallpaperSnapshot), ...settings, effectiveEnabled: settings.provider?.enabled === true };
    },
    async upload() { return {}; },
    async remove() {},
    async savePalette() {},
    subscribe() {
      metrics.wallpaperSubscribe += 1;
      return { dispose() { metrics.wallpaperDispose += 1; } };
    },
  };
  const host = {
    plugin: Object.freeze({ name: pluginName }),
    i18n: {
      t(_key, _args, fallback = "") { return fallback || _key; },
      formatTime(value) { return value; },
    },
    ui: { toast() {} },
    appearance: {
      wallpaperStore,
      async derivePalette() { return {}; },
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
  };
  return { host, metrics };
}

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const names = ["window", "document", "navigator", "location", "Element", "HTMLElement", "SVGElement", "Node", "Text", "Comment", "Event", "CustomEvent", "MutationObserver", "getComputedStyle"];
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
  return () => {
    for (const name of names) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  };
}

async function flushDom() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function runPlugin(manifestPath) {
  const plugin = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const frontend = manifest.frontend;
  if (!frontend) return null;
  if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.includes("frontend-module")) {
    fail(`插件 ${manifest.artifactName || plugin} 声明 frontend 但缺少 frontend-module capability`);
  }
  if (frontend.apiVersion !== "1.4") {
    fail(`插件 ${manifest.artifactName || plugin} 的 frontend.apiVersion 必须为 1.4`);
  }
  const entry = safeRelative(plugin, frontend.entry, `${manifest.artifactName}.frontend.entry`, ".js");
  if (!await isFile(entry)) fail(`插件 ${manifest.artifactName} 的 frontend.entry 文件不存在：${entry}`);
  const styles = frontend.styles ?? [];
  if (!Array.isArray(styles)) fail(`插件 ${manifest.artifactName} 的 frontend.styles 必须是数组`);
  for (const style of styles) {
    const stylePath = safeRelative(plugin, style, `${manifest.artifactName}.frontend.styles`, ".css");
    if (!await isFile(stylePath)) fail(`插件 ${manifest.artifactName} 的 frontend.styles 文件不存在：${stylePath}`);
  }

  const restoreDom = installDom();
  try {
    const module = await import(`${pathToFileURL(entry).href}?contract=${encodeURIComponent(manifest.artifactName)}`);
    if (typeof module.activate !== "function") fail(`插件 ${manifest.artifactName} 缺少 activate(host)`);
    const registrations = [];
    const mock = createMockHost(manifest.artifactName, registrations);
    const result = await module.activate(mock.host);
    if (!registrations.length) fail(`插件 ${manifest.artifactName} 未注册任何 UI slot`);
    for (const registration of registrations) {
      if (!allowedSlots.has(registration.slot)) fail(`插件 ${manifest.artifactName} 注册了未知 UI slot：${registration.slot}`);
    }
    const cleanup = typeof result === "function"
      ? result
      : result && typeof result.dispose === "function"
        ? () => result.dispose()
        : result && typeof result.deactivate === "function"
          ? () => result.deactivate()
          : null;
    if (!cleanup) fail(`插件 ${manifest.artifactName} 的 activate(host) 未返回 cleanup/dispose`);

    const rendererCleanups = [];
    try {
      for (const registration of registrations) {
        const element = document.createElement("div");
        document.body.append(element);
        const context = { mode: "test", primaryId: manifest.artifactName === "LiveScreenshot" ? "run-test" : "" };
        const rendererCleanup = await registration.renderer({ element, context });
        if (typeof rendererCleanup !== "function") fail(`插件 ${manifest.artifactName} 的 ${registration.slot} renderer 未返回 cleanup`);
        rendererCleanups.push(rendererCleanup);
        await flushDom();
        if (manifest.artifactName === "CustomWallpaper" && !element.querySelector('[data-settings-panel="custom-wallpaper"]')) {
          fail("CustomWallpaper renderer 未挂载设置面板");
        }
        if (manifest.artifactName === "LiveScreenshot" && !element.querySelector("[data-live-screenshot-card]")) {
          fail("LiveScreenshot renderer 未挂载实时截图面板");
        }
      }
      if (manifest.artifactName === "CustomWallpaper" && (mock.metrics.wallpaperGet < 1 || mock.metrics.wallpaperSubscribe < 1)) {
        fail("CustomWallpaper renderer 未读取 wallpaperStore 或建立订阅");
      }
      if (manifest.artifactName === "LiveScreenshot" && mock.metrics.screenshotCapture < 1) {
        fail("LiveScreenshot renderer 未调用 executionPreview.capture");
      }
    } finally {
      for (const rendererCleanup of rendererCleanups.reverse()) await rendererCleanup();
    }
    await cleanup();
    if (registrations.some(registration => !registration.disposed)) {
      fail(`插件 ${manifest.artifactName} 的 cleanup 未释放全部 UI slot`);
    }
    if (manifest.artifactName === "CustomWallpaper" && mock.metrics.wallpaperDispose < 1) {
      fail("CustomWallpaper renderer 卸载时未释放 wallpaperStore 订阅");
    }
    return {
      artifactName: manifest.artifactName,
      entry: path.relative(repositoryRoot, entry).replaceAll("\\", "/"),
      slots: registrations.map(registration => registration.slot),
      rendered: registrations.length,
    };
  } finally {
    restoreDom();
  }
}

try {
  const manifests = (await findManifests(pluginRoot)).sort();
  let checked = 0;
  for (const manifestPath of manifests) {
    const result = await runPlugin(manifestPath);
    if (!result) continue;
    checked += 1;
    console.log(`[frontend] ${result.artifactName}: activate -> render(${result.rendered}) -> cleanup`);
  }
  if (!checked) fail("未找到声明 frontend 的插件");
  console.log(`[frontend] conformance 通过：${checked} 个插件`);
} catch (error) {
  console.error(`[frontend] conformance 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
