import { allowedSlots, fail } from "../contract.mjs";

export function wallpaperTestState(overrides = {}) {
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

export function defaultTestState() {
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

export function gameCheckInTestState() {
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

export function gameCheckInTask(input, id, previous = null) {
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

export function createMockHost(pluginName, registrations, metrics, state = defaultTestState()) {
  const gameCheckInPlugin = String(pluginName).replaceAll("-", "").toLowerCase() === "gamecheckin";
  const host = {
    getCapabilities: async () => Object.freeze({ schemaVersion: 1, connectionKind: metrics.connectionKind || "local", operations: { general: { allowed: true, denyReason: null }, hostFilePicker: { allowed: !metrics.connectionKind || metrics.connectionKind === "local", denyReason: metrics.connectionKind === "remote" ? "host_file_picker_requires_local" : null }, nativeConfigEditor: { allowed: !metrics.connectionKind || metrics.connectionKind === "local", denyReason: metrics.connectionKind === "remote" ? "native_config_editor_requires_local" : null } } }),
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

export function createMetrics() {
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
