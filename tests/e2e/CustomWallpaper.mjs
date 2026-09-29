import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { png } from "./synthetic-image.mjs";
import { runtime, preparePlugin, launchBrowser, report } from "./owned-host.mjs";

const resources = [png(220, 30, 30), png(30, 220, 30), png(30, 30, 220)];
const ids = resources.map(bytes => createHash("sha256").update(bytes).digest("hex"));
let browser;
let final;
try {
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
  await card.getByRole("button", { name: /自定义壁纸/ }).click();
  await card.getByText("owned-0.png", { exact: true }).waitFor();
  const enabled = card.getByRole("button", { name: "启用自定义壁纸", exact: true });
  await Promise.all([page.waitForResponse(response => response.url().endsWith(base + "settings") && response.request().method() === "PUT"), enabled.click()]);
  assert.equal((await json("GET", "state")).effectiveEnabled, true);
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
  real: ["Host asset storage and binary transport", "CustomWallpaper backend", "browser enable and apply of selected wallpaper"],
  substituted: ["three synthetic 1x1 PNG inputs"] });
