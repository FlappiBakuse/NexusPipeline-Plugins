import { assertCapture } from "./cases/LiveScreenshot.mjs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isFile, fail, FRONTEND_API_VERSION, safeRelative, assertPluginFrontendBoundaries, allowedSlots, activationCleanup } from "./contract.mjs";
import { gameCheckInTestState, wallpaperTestState, defaultTestState, createMetrics, createMockHost } from "./support/mock-host.mjs";
import { installDom, installLifecycleProbe, flushDom } from "./support/dom.mjs";
import { assertGameCheckInRoute } from "./cases/GameCheckIn.mjs";
import { assertMaaRenderer } from "./cases/MaaFrameworkDriver.mjs";
import { assertWallpaperTimerRotation, assertWallpaperStateOrdering, assertWallpaperActivation, assertWallpaperRenderer, assertWallpaperSettingsReleased, assertWallpaperDisposed } from "./cases/CustomWallpaper.mjs";
import { resolvePublicElements } from "./contract.mjs";

export function parseArguments(args) {
  const result = { repositoryRoot: process.env.NEXUS_OFFICIAL_PLUGINS_ROOT || "", hostRoot: process.env.NEXUS_HOST_ROOT || "" };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    if (!["--root", "--host-root"].includes(option) || seen.has(option) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error("Expected unique --root / --host-root values");
    seen.add(option);
    result[option === "--root" ? "repositoryRoot" : "hostRoot"] = args[index + 1];
  }
  if (!result.hostRoot) throw new Error("An explicit Host checkout is required");
  return result;
}

export async function findManifests(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".generated" || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await findManifests(fullPath));
    else if (entry.isFile() && entry.name === "plugin.json") result.push(fullPath);
  }
  return result;
}

export async function runPlugin(repositoryRoot, manifestPath, publicElements) {
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

    const wallpaperBefore = wallpaperPlugin ? assertWallpaperActivation(metrics) : null;

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
          if (wallpaperPlugin) assertWallpaperRenderer(element);
          if (manifest.artifactName === "LiveScreenshot" && !element.querySelector("[data-live-screenshot-card]")) {
            fail("LiveScreenshot renderer 未挂载实时截图面板");
          }
        }
        if (manifest.artifactName === "LiveScreenshot") assertCapture(metrics);
      } finally {
        for (const rendererCleanup of rendererCleanups.reverse()) await rendererCleanup();
      }
      await flushDom();

      if (wallpaperPlugin) assertWallpaperSettingsReleased(metrics, wallpaperBefore);

      await disposePlugin();

      if (wallpaperPlugin) assertWallpaperDisposed(metrics);
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
        await assertWallpaperStateOrdering(path.join(plugin, 'frontend/src/wallpaperRuntime.ts'));
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) try {
  const options = parseArguments(process.argv.slice(2));
  const repositoryRoot = path.resolve(options.repositoryRoot || path.join(import.meta.dirname, "../.."));
  const pluginRoot = path.join(repositoryRoot, "plugins");
  const publicElements = await resolvePublicElements(options.hostRoot);
  const manifests = (await findManifests(pluginRoot)).sort();
  let checked = 0;
  for (const manifestPath of manifests) {
    const result = await runPlugin(repositoryRoot, manifestPath, publicElements);
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
