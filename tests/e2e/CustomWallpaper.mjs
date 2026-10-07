import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { png } from "./synthetic-image.mjs";
import { runtime, preparePlugin, launchBrowser, report } from "./owned-host.mjs";
import path from "node:path";
import { assertWallpaperStateOrdering } from "../frontend/cases/CustomWallpaper.mjs";

const resources = [png(220, 30, 30), png(30, 220, 30), png(30, 30, 220)];
const ids = resources.map(bytes => createHash("sha256").update(bytes).digest("hex"));
let browser;
let final;
try {
  await assertWallpaperStateOrdering(path.join(process.env.NEXUS_PLUGIN_SOURCE, 'frontend/src/wallpaperRuntime.ts'));
  const manifest = await preparePlugin();
  runtime.startRuntime(["service"]); await runtime.waitForService(null, 5000);
  const base = `api/plugin-api/${manifest.name}/`;
  const json = async (method, route, body) => {
    const response = await runtime.api(method, base + route, body);
    const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
  };
  for (const [index, bytes] of resources.entries()) {
    const response = await runtime.fetchWithTimeout(runtime.serviceUrl() + base + `assets?name=owned-${index}.png`,
      { method: "POST", headers: { "Content-Type": "image/png" }, body: bytes }, 3000);
    const value = await response.json(); assert.equal(response.status, 200); assert.equal(value.asset.id, ids[index]);
  }
  await json("PUT", "settings", { selectedId: ids[1], enabled: false, rotation: { mode: "off" } });
  browser = await launchBrowser();
  const page = await browser.newPage({ locale: "zh-CN" }); page.setDefaultTimeout(3000);
  await page.goto(runtime.serviceUrl() + "#/settings");
  const card = page.getByTestId("custom-wallpaper-card");
  const toggle = page.getByRole("navigation", { name: "设置分类" }).getByRole("button", { name: "自定义壁纸", exact: true });
  // 插件模块在导航完成后异步挂载；就绪等待仍受父 runner 预算约束。
  await toggle.waitFor({ state: "visible", timeout: 10000 });
  await toggle.click();
  const cardOrder = await page.locator("[data-settings-panel]").evaluateAll(cards => cards.map(card =>
    card.querySelector("button[aria-expanded] strong")?.textContent?.trim() || card.title.trim()));
  const categoryOrder = await page.getByRole("navigation", { name: "设置分类" }).getByRole("button").allTextContents();
  assert.deepEqual(categoryOrder.map(label => label.trim()), cardOrder, "settings categories follow the displayed card order");
  await card.getByText("owned-0.png", { exact: true }).waitFor();
  const enabled = card.getByRole("button", { name: "启用自定义壁纸", exact: true });
  await Promise.all([page.waitForResponse(response => response.url().endsWith(base + "settings") && response.request().method() === "PUT"), enabled.click()]);
  assert.equal((await json("GET", "state")).effectiveEnabled, true);
  for (const [index, label, key, value, unit] of [
    [0, "模糊（像素）", "blurPx", 13, "px"],
    [1, "变暗", "dimPercent", 37, "%"],
    [2, "卡片与侧边栏透明度", "surfaceTransparencyPercent", 35, "%"],
  ]) {
    const slider = card.getByRole("slider", { name: label, exact: true });
    const beforeInput = await json("GET", "state");
    await slider.evaluate((input, next) => {
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await page.waitForFunction(({ index, text }) => document.querySelector('[data-testid="custom-wallpaper-card"]')?.querySelectorAll("output")[index]?.textContent === text, { index, text: `${value}${unit}` });
    assert.equal((await json("GET", "state")).effects[key], beforeInput.effects[key], "input preview must not persist before change");
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith(base + "settings") && response.request().method() === "PUT"),
      slider.evaluate(input => input.dispatchEvent(new Event("change", { bubbles: true }))),
    ]);
    assert.equal((await json("GET", "state")).effects[key], value);
  }
  let releaseSave;
  let holdSave = true;
  const heldSave = new Promise(resolve => { releaseSave = resolve; });
  await page.route("**/" + base + "settings", async route => {
    if (route.request().method() === "PUT" && holdSave) {
      holdSave = false;
      await heldSave;
    }
    await route.continue();
  });
  try {
    await Promise.all([
      page.waitForRequest(request => request.url().endsWith(base + "settings") && request.method() === "PUT"),
      card.getByRole("slider", { name: "模糊（像素）", exact: true }).evaluate(input => {
        input.value = "14";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }),
    ]);
    for (const [label, value] of [["变暗", 38], ["卡片与侧边栏透明度", 36]]) {
      await card.getByRole("slider", { name: label, exact: true }).evaluate((input, next) => {
        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    }
    releaseSave();
    assert.equal(await runtime.waitFor(async () => {
      const effects = (await json("GET", "state")).effects;
      return effects.blurPx === 14 && effects.dimPercent === 38 && effects.surfaceTransparencyPercent === 36;
    }, 3000, 25), true, "consecutive slider changes must preserve every committed value");
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-testid="custom-wallpaper-card"] output'), element => element.textContent).join(",") === "14px,38%,36%");
  } finally {
    releaseSave();
    await page.unroute("**/" + base + "settings");
  }
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith(base + "settings") && response.request().method() === "PUT"),
    card.getByRole("button", { name: "透明度运用于非主页面", exact: true }).click(),
  ]);
  assert.equal((await json("GET", "state")).effects.applyTransparencyToSecondarySurfaces, false);
  for (let index = 0; index < 8; index++) {
    const id = ids[index % 2];
    const value = await json("PUT", "settings", { selectedId: id, effects: { blurPx: index } });
    assert.equal(value.selectedId, id); assert.equal(value.currentId, id);
  }
  const before = await json("GET", "state");
  const invalid = await runtime.fetchWithTimeout(runtime.serviceUrl() + base + "assets?name=invalid.png",
    { method: "POST", headers: { "Content-Type": "image/png" }, body: Buffer.from("not an image") }, 3000);
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).code, "invalid_image");
  assert.deepEqual(await json("GET", "state"), before);
  final = await json("POST", "assets/delete", { id: ids[2] });
  assert.equal(final.assets.length, 2); assert.equal(final.currentId, ids[1]);
  for (const index of [0, 1]) {
    const response = await runtime.api("GET", base + `asset?id=${ids[index]}`);
    assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), resources[index]);
  }
  const deleted = await runtime.api("GET", base + `asset?id=${ids[2]}`);
  assert.equal(deleted.status, 400); await deleted.arrayBuffer();
} finally { await browser?.close(); await runtime.stopRuntime(); }
report({ scenarioId: "P-G02", assetHashes: ids, finalCurrentId: final.currentId,
  real: ["Host asset storage and binary transport", "CustomWallpaper backend", "settings category opens the plugin panel", "browser enable and apply of selected wallpaper", "slider input previews before committed persistence", "consecutive slider saves preserve all values", "secondary transparency preference persistence", "wallpaper runtime overdue reads and stale response isolation"],
  substituted: ["three synthetic 1x1 PNG inputs", "first settings request held to verify consecutive saves", "clock and HTTP responses for deterministic wallpaper runtime assertions"] });
