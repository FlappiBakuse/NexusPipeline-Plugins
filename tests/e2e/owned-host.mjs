import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const runtime = await import(pathToFileURL(path.join(process.env.NEXUS_HOST_ROOT, "tests/system/runtime-helper.mjs")));
export async function preparePlugin() {
  const source = process.env.NEXUS_PLUGIN_SOURCE;
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "plugin.json")));
  await runtime.prepareRuntime();
  if (process.platform === "win32") {
    const probe = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$null = Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.pid}' -ErrorAction Stop`],
      { encoding: "utf8", windowsHide: true, timeout: 10000 });
    if (probe.status !== 0) throw new Error(`Windows process identity preparation failed: ${probe.error?.message || probe.stderr}`);
  }
  const target = path.join(runtime.runtimeDir, "plugins", manifest.artifactName); fs.mkdirSync(target, { recursive: true });
  for (const name of ["plugin.json", "i18n", "web"])
    if (fs.existsSync(path.join(source, name))) fs.cpSync(path.join(source, name), path.join(target, name), { recursive: true });
  fs.copyFileSync(path.join(source, "src/bin/Release/net8.0", manifest.entryAssembly), path.join(target, manifest.entryAssembly));
  const settingsPath = path.join(runtime.runtimeDir, "config/settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath));
  Object.assign(settings, { UpdateCheckEnabled: false, PluginAutoUpdateEnabled: false, BrowserAutoOpen: false,
    PluginPreferences: { [manifest.name]: { Enabled: true } } });
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  return manifest;
}
export async function launchBrowser() {
  const { chromium } = await import(pathToFileURL(path.join(process.env.NEXUS_HOST_ROOT, "tests/e2e/node_modules/playwright/index.mjs")));
  return chromium.launch({ channel: "msedge", headless: true });
}
export function report(evidence) {
  fs.writeFileSync(process.env.NEXUS_PLUGIN_RESULT, JSON.stringify({ status: "PASS", cleanup: "complete", ...evidence }, null, 2));
}
