import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { runtime, preparePlugin, launchBrowser, report } from "./owned-host.mjs";
import { png } from "./synthetic-image.mjs";

let browser, page, runId;
const frameHashes = new Set(), observations = [];
try {
  await preparePlugin();
  const owned = path.join(runtime.runtimeDir, "capture-source"); fs.mkdirSync(owned);
  const frame = path.join(owned, "frame.png"), adb = path.join(owned, "adb.cmd");
  fs.writeFileSync(frame, png(230, 20, 20));
  fs.writeFileSync(adb, ["@echo off", 'echo %*>>"%~dp0calls.log"',
    'if "%~1"=="connect" (', "echo connected", "exit /b 0", ")",
    'if not "%~2"=="127.0.0.1:29999" exit /b 19',
    'if "%~3"=="exec-out" (', 'type "%~dp0frame.png"', "exit /b 0", ")",
    'if "%~4"=="dumpsys" (', "echo mCurrentFocus=Window{owned u0 com.owned.capture/.MainActivity}", "exit /b 0", ")",
    'if "%~3"=="shell" (', "echo ok", "exit /b 0", ")", "exit /b 18"].join("\r\n"));
  runtime.startRuntime(["service"], { NEXUS_ADB_EXE: adb }); await runtime.waitForService(null, 5000);
  const fixture = runtime.makeFixture("live-capture");
  const worker = path.join(fixture.dir, "worker.mjs");
  fs.writeFileSync(worker, "console.log('OWNED_CAPTURE_READY'); setInterval(() => {}, 1000);");
  runtime.writeBatch(fixture, [`"${process.execPath}" "${worker}"`]);
  const response = await runtime.api("POST", "api/scripts", { name: "Owned capture", rootPath: fixture.dir, mainExe: fixture.exe,
    configPath: fixture.cfg, logPath: fixture.log, launchGame: true, gameMode: "emulator", gameExe: "127.0.0.1:29999",
    gameArgs: "-n com.owned.capture/.MainActivity", gameWaitSeconds: 1, forceCloseGame: false,
    maxAttempts: 1, totalTimeoutMinutes: 10, logStallTimeoutMinutes: 5 });
  assert.equal(response.status, 200, await response.clone().text()); const script = await response.json();
  await runtime.createUserBinding(script.id, "Owned capture user");
  const start = await runtime.api("POST", "api/dispatch/script", { scriptId: script.id });
  assert.equal(start.status, 200, await start.clone().text()); await start.arrayBuffer();
  const deadline = Date.now() + 3000;
  let ready = false;
  while (Date.now() < deadline) {
    const status = await (await runtime.api("GET", "api/status")).json();
    runId = status.running?.[0]?.id;
    if (runId) {
      const preview = await runtime.api("GET", `api/execution-preview/${runId}?plugin=live-screenshot`);
      const bytes = Buffer.from(await preview.arrayBuffer());
      if (preview.status === 200) {
        assert.ok(bytes.length > 100, `Preview bytes=${bytes.length}; headers=${JSON.stringify(Object.fromEntries(preview.headers))}`);
        ready = true; break;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(ready, "Owned capture target must be ready before browser observation");
  browser = await launchBrowser(); page = await browser.newPage({ locale: "zh-CN" }); page.setDefaultTimeout(3000);
  for (let index = 0; index < 8; index++) {
    console.log(`LiveScreenshot lifecycle ${index}: mount`);
    fs.writeFileSync(frame, index % 2 ? png(20, 20, 230) : png(230, 20, 20));
    const captured = page.waitForResponse(response => response.url().includes("/api/execution-preview/") && response.status() === 200, { timeout: 6500 });
    await page.goto(runtime.serviceUrl() + "#/dispatch");
    const image = await captured;
    console.log(`LiveScreenshot lifecycle ${index}: received`);
    const renderedImage = page.getByAltText("当前游戏画面", { exact: true });
    await renderedImage.waitFor({ timeout: 6500 });
    const pixel = await renderedImage.evaluate(element => {
      if (!element.complete || element.naturalWidth === 0) throw new Error("Frame has not decoded");
      const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext("2d"); context.drawImage(element, 0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    });
    assert.ok(index % 2 ? pixel[2] > pixel[0] + 100 : pixel[0] > pixel[2] + 100);
    assert.equal(image.headers()["x-nexus-preview-source"], "emulator");
    const observedRun = new URL(image.url()).pathname.split("/").at(-1);
    if (runId) assert.equal(observedRun, runId); else runId = observedRun;
    frameHashes.add(createHash("sha256").update(Buffer.from(pixel)).digest("hex"));
    await page.goto(runtime.serviceUrl() + "#/settings");
    await page.locator("[data-live-screenshot-card]").waitFor({ state: "detached" });
    assert.equal(await page.locator("[data-live-screenshot-card]").count(), 0);
    observations.push({ index, runId: observedRun });
  }
  assert.equal(frameHashes.size, 2);
  const cancel = await runtime.api("POST", "api/cancel", { runId });
  assert.equal(cancel.status, 200); await cancel.arrayBuffer();
  assert.equal(await runtime.waitNoRunning(3000), true);
} catch (error) {
  console.error(error);
  if (page) fs.writeFileSync(process.env.NEXUS_PLUGIN_RESULT + ".failure.html", await page.content());
  throw error;
}
finally { await browser?.close(); await runtime.stopRuntime(); }
report({ scenarioId: "P-G03", frameHashes: [...frameHashes], observations,
  real: ["Host dispatch and target-bound capture", "PNG to JPEG encoding", "LiveScreenshot browser mount, capture and unmount"],
  substituted: ["owned ADB external capture process emitting two synthetic frames"] });
