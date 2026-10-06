import { fail } from "../contract.mjs";
import { flushDom } from "../support/dom.mjs";

export function clickPluginButton(container, label) {
  const button = [...container.querySelectorAll("nxp-button")]
    .find(item => item.getAttribute("label") === label);
  if (!button) fail(`GameCheckIn 页面缺少“${label}”操作`);
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

export function changePublicControl(container, selector, value) {
  const control = container.querySelector(selector);
  if (!control) fail(`GameCheckIn 页面缺少公开控件：${selector}`);
  control.dispatchEvent(new window.CustomEvent("change", { bubbles: true, detail: [value] }));
}

export async function assertGameCheckInRoute(host, metrics, state) {
  const route = metrics.routeRegistrations.find(item => item.route === "tasks");
  const navigation = metrics.navRegistrations.find(item => item.id === "check-in-tasks");
  if (!route || !navigation) fail("GameCheckIn 必须注册签到页面 route 和侧边栏导航项");
  if (navigation.title !== "签到" || navigation.route !== "tasks") fail("GameCheckIn 侧边栏导航必须打开签到任务页面");

  const view = document.createElement("main");
  document.body.append(view);
  const controller = new AbortController();
  const cleanup = await route.handler(Object.freeze({ element: view, token: 1, segments: Object.freeze(["plugin", "game-checkin", "tasks"]), signal: controller.signal }), host);
  if (typeof cleanup !== "function") fail("GameCheckIn route 必须返回 cleanup");
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

  controller.abort(); cleanup();
  for (const registration of metrics.lifecycleHandlers) registration.handler();
  await flushDom();
  if (view.querySelector("[data-game-check-in-page]")) fail("离开签到页面时没有卸载页面组件");
  const nextController = new AbortController();
  const nextCleanup = await route.handler(Object.freeze({ element: view, token: 2, segments: Object.freeze(["plugin", "game-checkin", "tasks"]), signal: nextController.signal }), host);
  await flushDom();
  if (!view.querySelector("[data-game-check-in-page]")) fail("再次进入签到 route 后没有重新挂载页面");
  nextController.abort(); nextCleanup();
  return { route: route.route, nav: navigation.id, apiCalls: metrics.apiCalls.filter(call => call.route !== "state").length };
}
