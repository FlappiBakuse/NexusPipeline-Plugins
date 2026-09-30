import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { runtime, preparePlugin, report } from "./owned-host.mjs";

const nativeRoot = process.env.NEXUS_MAA_NATIVE_ROOT;
if (!nativeRoot) throw new Error("Explicit native bootstrap input NEXUS_MAA_NATIVE_ROOT required");
const locked = JSON.parse(fs.readFileSync(new URL("../inputs.lock.json", import.meta.url))).maaFramework;
const prepared = JSON.parse(fs.readFileSync(path.join(nativeRoot, "native-input.json")));
assert.deepEqual(prepared.source, locked);
for (const [relative, expected] of Object.entries(prepared.files)) {
  assert.ok(relative.startsWith("bin/") && !relative.includes(".."));
  assert.equal(createHash("sha256").update(fs.readFileSync(path.join(nativeRoot, relative))).digest("hex"), expected);
}
let target, identityFile;
const histories = [], previews = [];
try {
  const manifest = await preparePlugin();
  fs.cpSync(process.env.NEXUS_PLUGIN_WORKER, path.join(runtime.runtimeDir, "plugins", manifest.artifactName, "worker"), { recursive: true });
  const project = path.join(runtime.runtimeDir, "pi"); fs.mkdirSync(path.join(project, "resource/pipeline"), { recursive: true });
  fs.cpSync(path.join(nativeRoot, "bin"), path.join(project, "native"), { recursive: true });
  const title = `Nexus owned ${runtime.runId}`;
  identityFile = path.join(project, "window.json");
  target = spawn(process.env.NEXUS_OWNED_WINDOW, [identityFile, title], { stdio: "ignore", windowsHide: false });
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(identityFile) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(fs.existsSync(identityFile), "Owned target did not publish its identity");
  const window = JSON.parse(fs.readFileSync(identityFile)); assert.equal(window.pid, target.pid);
  const pi = { interface_version: 2, name: "Owned PI", version: "1.0.0",
    controller: [{ name: "Owned", type: "Win32", display_raw: true,
      win32: { window_regex: `^${title}$`, screencap: "PrintWindow", mouse: "SendMessage", keyboard: "SendMessage" } }],
    resource: [{ name: "R", path: ["resource"] }], task: [{ name: "Finite", entry: "Entry" }] };
  fs.writeFileSync(path.join(project, "interface.json"), JSON.stringify(pi));
  fs.writeFileSync(path.join(project, "resource/pipeline/main.json"), JSON.stringify({ Entry: { recognition: "DirectHit", action: "DoNothing" } }));
  runtime.startRuntime(["service"]); await runtime.waitForService(null, 5000);
  if (process.env.NEXUS_TEST_HOST_UI === "false") {
    assert.ok(!fs.existsSync(path.join(runtime.runtimeDir, "wwwroot/index.html")));
    assert.equal((await runtime.api("GET", "index.html")).status, 404);
  }
  const invoke = async (route, body, status = 200) => {
    const response = await runtime.api("POST", `api/plugin-api/${manifest.name}/${route}`, body);
    const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
  };
  let profile = { profileId: "owned", packageRoot: project, interfacePath: "interface.json", controller: "Owned", resource: "R",
    nativeDirectory: "native", nativeVersion: locked.version, selectedTasks: ["Finite"], windowHandle: window.handle,
    windowProcessId: window.pid, windowExecutable: window.executable, windowStartedAtUtc: window.startedAtUtc,
    windowSelection: "exact_process", windowWaitMilliseconds: 1000 };
  for (let index = 0; index < 6; index++) {
    const preview = await invoke("preview", { scriptId: "", profileId: profile.profileId,
      profile: { ...profile, language: index % 2 ? "en_us" : "zh_cn" } });
    assert.equal(preview.project.tasks.length, 1); assert.equal(preview.project.tasks[0].name, "Finite");
    assert.equal(preview.authorized, false); previews.push(preview.project.executionFingerprint);
  }
  await invoke("authorize", { scriptId: "", profileId: profile.profileId, profile, confirmedFingerprint: "different-identity" }, 409);
  profile = await invoke("authorize", { scriptId: "", profileId: profile.profileId, profile,
    confirmedFingerprint: previews[0], expectedRevision: "" });
  for (let index = 0; index < 2; index++) {
    const response = await runtime.api("POST", "api/scripts", { name: `Owned native ${index}`, rootPath: project,
      executionProviderId: "maa-framework", executionProviderConfigId: profile.profileId,
      maxAttempts: 1, totalTimeoutMinutes: 10, logStallTimeoutMinutes: 5 });
    assert.equal(response.status, 200, await response.clone().text()); const script = await response.json();
    await runtime.createUserBinding(script.id, `Owned native user ${index}`);
    const started = await runtime.api("POST", "api/dispatch/script", { scriptId: script.id });
    assert.equal(started.status, 200, await started.clone().text()); await started.arrayBuffer();
    assert.equal(await runtime.waitNoRunning(20000), true);
    const history = await runtime.waitForHistory(script.id, 1000);
    assert.equal(history.outcomes.engineStatus, "succeeded", JSON.stringify(history));
    assert.equal(history.status, "unverified");
    assert.ok(history.taskReport.structuredEvidence.some(item => item.kind === "task_event" && item.status === "succeeded"));
    histories.push({ id: history.id, scriptId: script.id, taskReport: history.taskReport });
  }
} finally {
  await runtime.stopRuntime();
  if (identityFile) fs.writeFileSync(identityFile + ".stop", "stop");
  if (target && target.exitCode === null) {
    await Promise.race([new Promise(resolve => target.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 1500))]);
    if (target.exitCode === null) throw new Error("Owned target cleanup not confirmed");
  }
}
report({ scenarioId: "P-X01", nativeInput: locked, previews, histories,
  real: ["Host direct execution provider", "MaaFrameworkDriver PI compiler and authorization", "locked native binding and runtime", "two actual worker sessions"],
  substituted: ["owned WinForms target and synthetic DirectHit/DoNothing PI project"] });
