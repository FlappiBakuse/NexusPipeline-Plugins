import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareProcessIdentity } from "./owned-host.mjs";

const host = process.env.NEXUS_HOST_ROOT;
const source = process.env.NEXUS_PLUGIN_SOURCE;
const runtime = await import(pathToFileURL(path.join(host, "tests/system/runtime-helper.mjs")));
const { chromium } = await import(pathToFileURL(path.join(host, "tests/e2e/node_modules/playwright/index.mjs")));
const cookies = ["ltuid=1001; ltoken=synthetic-canary-A", "ltuid=1002; ltoken=synthetic-canary-B"];
const games = {
  gi: ["https://sg-hk4e-api.hoyolab.com/event/sol/", "e202102251931481"],
  hsr: ["https://sg-public-api.hoyolab.com/event/luna/os/", "e202303301540311"],
  zzz: ["https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/", "e202406031448091"],
};
const exchanges = [];
function exchange(id, game, credential, sign, body) {
  const [base, act] = games[game];
  exchanges.push({ id, method: sign ? "POST" : "GET", url: base + (sign ? "sign" : `info?lang=en-us&act_id=${act}`),
    requestHeaders: { Cookie: cookies[credential] }, status: 200, contentType: "application/json",
    bodyBase64: Buffer.from(JSON.stringify(body)).toString("base64") });
}
exchange("gi-a-info", "gi", 0, false, { retcode: 0, data: { is_sign: false } });
exchange("gi-a-sign", "gi", 0, true, { retcode: 0 });
exchange("gi-b-rejected", "gi", 1, false, { retcode: -100 });
exchange("hsr-a-already", "hsr", 0, false, { retcode: 0, data: { is_sign: true } });
exchange("zzz-b-info", "zzz", 1, false, { retcode: 0, data: { is_sign: false } });
exchange("zzz-b-sign", "zzz", 1, true, { retcode: 0 });
const request = async (method, route, body, status = 200) => {
  const response = await runtime.api(method, `api/plugin-api/game-checkin/${route}`, body);
  const result = await response.json();
  assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(result)}`);
  for (const cookie of cookies) assert.ok(!JSON.stringify(result).includes(cookie));
  return result;
};
async function settled(ids) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const state = await request("GET", "state");
    if (ids.every(id => state.tasks.some(task => task.id === id && task.recentRun?.completedAt && !task.isRunning))) return state;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("Check-in tasks did not settle within the bounded observation window");
}
let browser;
let evidence;
try {
  await runtime.prepareRuntime();
  const payload = path.join(runtime.runtimeDir, "plugins/GameCheckIn"); fs.mkdirSync(payload, { recursive: true });
  for (const name of ["plugin.json", "i18n", "web"]) fs.cpSync(path.join(source, name), path.join(payload, name), { recursive: true });
  const dll = "NexusPipeline.Plugin.GameCheckIn.dll";
  fs.copyFileSync(path.join(source, "src/bin/Release/net8.0", dll), path.join(payload, dll));
  const settingsPath = path.join(runtime.runtimeDir, "config/settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath));
  Object.assign(settings, { UpdateCheckEnabled: false, PluginAutoUpdateEnabled: false, BrowserAutoOpen: false,
    PluginPreferences: { "game-checkin": { Enabled: true } } });
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  const plan = path.join(runtime.runtimeDir, "http-plan.json");
  fs.writeFileSync(plan, JSON.stringify({ runId: runtime.runId, exchanges }));
  prepareProcessIdentity();
  runtime.startRuntime(["service"], { NEXUS_TEST_HTTP_PLAN: plan }); await runtime.waitForService(null, 5000);
  const tasks = [];
  for (const [index, game, credential] of [[0, "gi", 0], [1, "gi", 1], [2, "hsr", 0], [3, "zzz", 1]]) {
    tasks.push(await request("POST", "tasks", { name: `Owned task ${index}`, remark: "", enabled: true,
      games: { os: [game] }, schedules: [], notification: { enabled: false, smtpTo: "" },
      secrets: { os: { action: "set", value: cookies[credential] } } }, 201));
  }
  assert.equal(new Set(tasks.map(task => task.id)).size, 4);
  assert.ok(tasks.every(task => task.credentials.os));
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ locale: "zh-CN" }); page.setDefaultTimeout(3000);
  await page.goto(runtime.serviceUrl());
  await page.getByRole("link", { name: "签到", exact: true }).click();
  let card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: tasks[0].name, exact: true }) });
  await card.getByRole("button", { name: "编辑签到", exact: true }).click();
  await page.getByRole("textbox", { name: "任务名称", exact: true }).fill("Browser edited task");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Browser edited task", exact: true }) });
  await card.getByRole("button", { name: "立即签到", exact: true }).click();
  await request("POST", "tasks/run", { taskId: tasks[1].id }, 202);
  await settled(tasks.slice(0, 2).map(task => task.id));
  await Promise.all(tasks.slice(2).map(task => request("POST", "tasks/run", { taskId: task.id }, 202)));
  const state = await settled(tasks.map(task => task.id));
  const byId = new Map(state.tasks.map(task => [task.id, task]));
  for (const [index, success] of [[0, true], [1, false], [2, true], [3, true]]) {
    const task = byId.get(tasks[index].id);
    assert.equal(task.recentRun.results.length, 1);
    assert.equal(task.recentRun.results[0].success, success);
    assert.equal(task.recentRun.results[0].gameCode, Object.values(tasks[index].games)[0][0]);
  }
  const edited = byId.get(tasks[0].id);
  assert.equal(edited.name, "Browser edited task");
  await request("PUT", "tasks", { ...edited, remark: "saved after completion", secrets: {} });
  await request("POST", "tasks/run", { taskId: edited.id }, 202);
  const repeated = await settled([edited.id]);
  assert.equal(repeated.tasks.find(task => task.id === edited.id).runs.length, 2);
  await browser.close(); browser = null;
  await runtime.stopRuntime();
  prepareProcessIdentity();
  runtime.startRuntime(["service"], { NEXUS_TEST_HTTP_PLAN: plan }); await runtime.waitForService(null, 5000);
  const persisted = await request("GET", "state");
  assert.equal(persisted.tasks.length, 4);
  assert.equal(persisted.tasks.find(task => task.id === edited.id).remark, "saved after completion");
  assert.ok(persisted.tasks.every(task => task.credentials.os));
  const receipts = fs.readFileSync(`${plan}.receipts.jsonl`, "utf8").trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(receipts.map(item => item.id).sort(), exchanges.map(item => item.id).sort());
  assert.ok(receipts.every(item => item.matched));
  for (const cookie of cookies) assert.ok(!JSON.stringify(runtime.runtimeOutput()).includes(cookie));
  evidence = { scenarioId: "P-G01", status: "PASS", cleanup: "complete", taskIds: tasks.map(task => task.id),
    runIds: persisted.tasks.flatMap(task => task.runs.map(run => run.id)), receiptIds: receipts.map(item => item.id),
    real: ["Host plugin loader and HTTP API", "GameCheckIn backend and browser frontend", "Host credential storage and restart persistence"],
    substituted: ["HoyoLab HTTPS responses with exact synthetic credential matching"] };
} finally {
  await browser?.close();
  await runtime.stopRuntime();
}
fs.writeFileSync(process.env.NEXUS_PLUGIN_RESULT, JSON.stringify(evidence, null, 2));
