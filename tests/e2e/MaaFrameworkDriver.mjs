import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { runtime, preparePlugin, report } from "./owned-host.mjs";

const nativeRoot = process.env.NEXUS_MAA_NATIVE_ROOT;
if (!nativeRoot) throw new Error("Explicit native bootstrap input NEXUS_MAA_NATIVE_ROOT required");
const nativeInputs = JSON.parse(fs.readFileSync(new URL("../inputs.lock.json", import.meta.url)));
const prepared = JSON.parse(fs.readFileSync(path.join(nativeRoot, "native-input.json")));
const locked = [nativeInputs.maaFramework, ...(nativeInputs.maaFrameworkPrevious || [])].find(item => item.version === prepared.source.version);
const pythonNativeRoot = process.env.NEXUS_MAA_PYTHON_NATIVE_ROOT;
if (!pythonNativeRoot) throw new Error("Explicit Python Agent native input required");
const pythonNative = JSON.parse(fs.readFileSync(path.join(pythonNativeRoot, "native-input.json")));
assert.deepEqual(pythonNative.source, nativeInputs.maaFrameworkPrevious.find(item => item.version === "5.14.2"));
for (const [relative, expected] of Object.entries(pythonNative.files)) {
  assert.ok(relative.startsWith("bin/") && !relative.includes(".."));
  assert.equal(createHash("sha256").update(fs.readFileSync(path.join(pythonNativeRoot, relative))).digest("hex"), expected);
}
assert.ok(locked, "Native input must match the supported official version window");
assert.deepEqual(prepared.source, locked);
for (const [relative, expected] of Object.entries(prepared.files)) {
  assert.ok(relative.startsWith("bin/") && !relative.includes(".."));
  assert.equal(createHash("sha256").update(fs.readFileSync(path.join(nativeRoot, relative))).digest("hex"), expected);
}
let target, identityFile;
const ownedWindows = [];
const histories = [], previews = [];
try {
  const manifest = await preparePlugin();
  fs.cpSync(process.env.NEXUS_PLUGIN_WORKER, path.join(runtime.runtimeDir, "plugins", manifest.artifactName, "worker"), { recursive: true });
  const project = path.join(runtime.runtimeDir, "pi"); fs.mkdirSync(path.join(project, "resource/pipeline"), { recursive: true });
  fs.cpSync(path.join(nativeRoot, "bin"), path.join(project, "native"), { recursive: true });
  const title = `Nexus owned ${runtime.runId}`;
  identityFile = path.join(project, "window.json");
  ownedWindows.push(identityFile);
  target = spawn(process.env.NEXUS_OWNED_WINDOW, [identityFile, title], { stdio: "ignore", windowsHide: false });
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(identityFile) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(fs.existsSync(identityFile), "Owned target did not publish its identity");
  const window = JSON.parse(fs.readFileSync(identityFile)); assert.equal(window.pid, target.pid);
  const pi = { interface_version: 2, name: "Owned PI", version: "1.0.0",
    controller: [{ name: "Owned", type: "Win32", display_raw: true,
      win32: { window_regex: `^${title}$`, screencap: "PrintWindow", mouse: "SendMessage", keyboard: "SendMessage" } }],
    resource: [{ name: "R", path: ["resource"] }], task: [{ name: "Finite", entry: "Entry", repeatable: true }] };
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
  let profile = { schemaVersion: 3, profileId: "owned", packageRoot: project, interfacePath: "interface.json", controller: "Owned", resource: "R",
    nativeDirectory: "native", nativeVersion: locked.version,
    taskOccurrences: [{ occurrenceId: "finite", piTaskName: "Finite", order: 0, enabled: true, repeatCount: 2 },
      { occurrenceId: "wait", piTaskName: "Owned countdown", guiAction: "CountdownAction", order: 1, enabled: true,
        pipelineOverride: { CountdownAction: { action: "Custom", custom_action: "CountdownAction", custom_action_param: { seconds: 0 } } } }], windowHandle: window.handle,
    windowProcessId: window.pid, windowExecutable: window.executable, windowStartedAtUtc: window.startedAtUtc,
    windowSelection: "exact_process", windowWaitMilliseconds: 1000 };
  for (const schemaVersion of [undefined, 1, 4]) {
    const rejected = await invoke("preview", { scriptId: "", profileId: profile.profileId,
      profile: { ...profile, schemaVersion } }, 400);
    assert.match(rejected.error, /unsupported_profile_schema/);
  }
  for (let index = 0; index < 6; index++) {
    const preview = await invoke("preview", { scriptId: "", profileId: profile.profileId,
      profile: { ...profile, language: index % 2 ? "en_us" : "zh_cn" } });
    assert.equal(preview.project.tasks.length, 3); assert.equal(preview.project.tasks[0].name, "Finite");
    assert.deepEqual(preview.project.tasks.map(task => task.id), ["finite_1", "finite_2", "wait_1"]);
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
    assert.equal(history.taskReport.logSources.native.sourceState, "complete");
    assert.ok(history.taskReport.logSources.native.byteOffset > 0);
    assert.equal(history.taskReport.logSources.native.rotationEpoch, 0);
    assert.ok(history.taskReport.structuredEvidence.some(item => item.kind === "task_event" && item.status === "succeeded"));
    assert.ok(history.taskReport.structuredEvidence.some(item => item.kind === "task_event" && item.taskId === "wait_1" && item.status === "succeeded"));
    histories.push({ id: history.id, scriptId: script.id, taskReport: history.taskReport });
  }
  fs.mkdirSync(path.join(project, "config/instances"), { recursive: true });
  fs.writeFileSync(path.join(project, "appsettings.json"), "{}");
  fs.writeFileSync(path.join(project, "config/config.json"), JSON.stringify({ CurrentControllerName: "Owned", CurrentController: 1, Resource: "R" }));
  fs.writeFileSync(path.join(project, "config/instances/owned.json"), JSON.stringify({ InstanceName: "Owned initialization",
    TaskItems: [{ name: "Finite", entry: "Entry", default_check: true, repeat_count: 2 },
      { name: "Owned countdown", entry: "CountdownAction", default_check: true,
        pipeline_override: { CountdownAction: { action: "Custom", custom_action: "CountdownAction", custom_action_param: { seconds: 0 } } } }] }));
  const operationId = `init_${Date.now()}`;
  const saveRequest = { operationId, script: { id: "", name: "Owned initialized binding", rootPath: project,
    executionProviderId: "maa-framework", executionProviderConfigId: profile.profileId, maxAttempts: 1 }, configuration: { profile: { ...profile, nativeVersion: "" } } };
  const saveResponse = await runtime.api("POST", "api/provider-configurations", saveRequest);
  assert.equal(saveResponse.status, 202, await saveResponse.clone().text());
  const startedSave = await saveResponse.json();
  let operation;
  const saveDeadline = Date.now() + 20000;
  do {
    operation = await (await runtime.api("GET", `api/provider-configurations/${operationId}`)).json();
    if (["ready", "needs_attention", "cancelled"].includes(operation.state)) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < saveDeadline);
  assert.equal(operation.state, "ready", JSON.stringify(operation));
  assert.equal(operation.cleanupConfirmed, true);
  const visible = await (await runtime.api("GET", `api/scripts/${startedSave.scriptId}`)).json();
  assert.equal(visible.executionProviderConfigRevision, operation.revision);
  const saveJournal = JSON.parse(fs.readFileSync(path.join(runtime.runtimeDir, ".nxp/provider-configurations", operationId + ".json"), "utf8").replace(/^\uFEFF/, ""));
  assert.ok(saveJournal.worker?.pid > 0);
  assert.equal(saveJournal.candidate.privateCandidate.profile.dependencyLock.native.version, locked.version);
  const replay = await runtime.api("POST", "api/provider-configurations", saveRequest);
  assert.equal(replay.status, 202); assert.equal((await replay.json()).revision, operation.revision);
  assert.equal(await runtime.waitNoRunning(1000), true);
  histories.push({ configurationOperation: operation, formalTasksSubmitted: 0, visibleRevision: visible.executionProviderConfigRevision });
  const boundUser = await runtime.createUserBinding(startedSave.scriptId, "Owned independent override");
  const bindingBody = { scriptId: startedSave.scriptId, userId: boundUser.id, profileId: profile.profileId, revision: operation.revision };
  let boundProfile = await invoke("profile", bindingBody);
  assert.equal(boundProfile.parentRevision, operation.revision); assert.equal(boundProfile.revision, "");
  boundProfile.taskOccurrences[0].repeatCount = 1;
  const bindingPreview = await invoke("preview", { ...bindingBody, profile: boundProfile });
  boundProfile = await invoke("authorize", { ...bindingBody, profile: boundProfile, expectedRevision: "",
    confirmedFingerprint: bindingPreview.project.executionFingerprint });
  assert.equal(boundProfile.taskOccurrences[0].repeatCount, 1);
  const boundDispatch = await runtime.api("POST", "api/dispatch/script", { scriptId: startedSave.scriptId });
  assert.equal(boundDispatch.status, 200, await boundDispatch.clone().text()); await boundDispatch.arrayBuffer();
  assert.equal(await runtime.waitNoRunning(20000), true);
  const boundHistory = await runtime.waitForHistory(startedSave.scriptId, 1000);
  assert.equal(boundHistory.outcomes.engineStatus, "succeeded", JSON.stringify(boundHistory));
  histories.push({ userOverride: { profileRevision: operation.revision, overrideRevision: boundProfile.revision, repeatCount: 1 },
    taskReport: boundHistory.taskReport });
  const userOperationId = `user_${Date.now()}`;
  const userResponse = await runtime.api('POST', 'api/provider-configurations', { operationId: userOperationId,
    userId: boundUser.id, expectedUserRevision: '', script: { id: startedSave.scriptId }, configuration: { profile: boundProfile } });
  assert.equal(userResponse.status, 202, await userResponse.clone().text()); await userResponse.arrayBuffer();
  let userOperation;
  const userDeadline = Date.now() + 20000;
  do {
    userOperation = await (await runtime.api('GET', `api/provider-configurations/${userOperationId}`)).json();
    if (['ready', 'cancelled', 'needs_attention'].includes(userOperation.state)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < userDeadline);
  assert.equal(userOperation.state, 'ready', JSON.stringify(userOperation));
  assert.equal(userOperation.userId, boundUser.id); assert.equal(userOperation.cleanupConfirmed, true);
  const committedUser = await (await runtime.api('GET', `api/users/${boundUser.id}`)).json();
  assert.equal(committedUser.bindings.find(item => item.scriptInstanceId === startedSave.scriptId).executionProviderConfigRevision, userOperation.revision);
  assert.equal((await (await runtime.api('GET', `api/scripts/${startedSave.scriptId}`)).json()).executionProviderConfigRevision, operation.revision);
  histories.push({ initializedUserOverride: { operationId: userOperationId, revision: userOperation.revision, formalTasksSubmitted: 0 } });
  const downloadId = `download_${Date.now()}`;
  const downloadRequest = { ...saveRequest, operationId: downloadId, script: { ...saveRequest.script, name: "Owned missing native recovery" },
    configuration: { profile: { ...profile, nativeDirectory: "missing-native", nativeVersion: locked.version } } };
  const downloadResponse = await runtime.api("POST", "api/provider-configurations", downloadRequest);
  assert.equal(downloadResponse.status, 202, await downloadResponse.clone().text());
  const downloadDeadline = Date.now() + 330000;
  let downloaded;
  do {
    downloaded = await (await runtime.api("GET", `api/provider-configurations/${downloadId}`)).json();
    if (["ready", "needs_attention", "cancelled"].includes(downloaded.state)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < downloadDeadline);
  assert.equal(downloaded.state, "ready", JSON.stringify(downloaded));
  assert.equal(downloaded.cleanupConfirmed, true);
  const downloadJournal = JSON.parse(fs.readFileSync(path.join(runtime.runtimeDir, ".nxp/provider-configurations", downloadId + ".json"), "utf8").replace(/^\uFEFF/, ""));
  const dependency = downloadJournal.candidate.privateCandidate.profile.dependencyLock;
  assert.equal(dependency.native.sha256, locked.sha256);
  assert.ok(dependency.installTarget.startsWith(".nexus/maa-framework/deps/win-x64/"));
  for (const file of dependency.native.files) {
    const actual = fs.readFileSync(path.join(project, dependency.installTarget, file.path));
    assert.equal(actual.length, file.sizeBytes); assert.equal(createHash("sha256").update(actual).digest("hex"), file.sha256);
  }
  assert.equal(fs.existsSync(path.join(project, dependency.installTarget + "." + downloadId + ".partial")), false);
  histories.push({ configurationOperation: downloaded, formalTasksSubmitted: 0, officialDependencyArchiveSha256: dependency.native.sha256 });
  const previousRevision = visible.executionProviderConfigRevision;
  const sourceFile = path.join(project, "config/instances/owned.json");
  const sourceConfiguration = JSON.parse(fs.readFileSync(sourceFile));
  sourceConfiguration.TaskItems[0].repeat_count = 3;
  fs.writeFileSync(sourceFile, JSON.stringify(sourceConfiguration));
  let synchronized;
  const synchronizationDeadline = Date.now() + 30000;
  do {
    synchronized = await (await runtime.api("GET", `api/scripts/${startedSave.scriptId}`)).json();
    if (synchronized.executionProviderConfigRevision !== previousRevision) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < synchronizationDeadline);
  assert.notEqual(synchronized.executionProviderConfigRevision, previousRevision, "Changed source must publish one initialized revision after idle admission");
  const syncJournals = fs.readdirSync(path.join(runtime.runtimeDir, ".nxp/provider-configurations"))
    .map(file => JSON.parse(fs.readFileSync(path.join(runtime.runtimeDir, ".nxp/provider-configurations", file), "utf8").replace(/^\uFEFF/, "")))
    .filter(item => item.script.id === startedSave.scriptId && item.candidate?.revision === synchronized.executionProviderConfigRevision);
  assert.equal(syncJournals.length, 1); assert.equal(syncJournals[0].cleanupConfirmed, true);
  assert.equal(syncJournals[0].candidate.privateCandidate.profile.taskOccurrences[0].repeatCount, 3);
  histories.push({ automaticSynchronization: { previousRevision, visibleRevision: synchronized.executionProviderConfigRevision, formalTasksSubmitted: 0 } });
  let rebasedUserRevision;
  const userSyncDeadline = Date.now() + 30000;
  do {
    const user = await (await runtime.api('GET', `api/users/${boundUser.id}`)).json();
    rebasedUserRevision = user.bindings.find(item => item.scriptInstanceId === startedSave.scriptId).executionProviderConfigRevision;
    if (rebasedUserRevision !== userOperation.revision) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < userSyncDeadline);
  assert.notEqual(rebasedUserRevision, userOperation.revision, 'Shared source changes must initialize and commit the rebased user override');
  const rebasedUserProfile = await invoke('profile', { ...bindingBody, revision: synchronized.executionProviderConfigRevision, userRevision: rebasedUserRevision });
  assert.equal(rebasedUserProfile.parentRevision, synchronized.executionProviderConfigRevision);
  assert.equal(rebasedUserProfile.taskOccurrences[0].repeatCount, 1, 'User repeat override must survive a source repeat change');
  histories.push({ automaticUserRebase: { previousRevision: userOperation.revision, revision: rebasedUserRevision,
    parentRevision: synchronized.executionProviderConfigRevision, repeatCount: 1 } });
  const idleDeadline = Date.now() + 20000;
  while (Date.now() < idleDeadline) {
    const operations = await (await runtime.api("GET", "api/provider-configurations")).json();
    if (operations.every(item => ["ready", "needs_attention", "cancelled", "current"].includes(item.state) && item.cleanupConfirmed)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  fs.writeFileSync(identityFile + ".stop", "stop");
  if (target.exitCode === null) await new Promise(resolve => target.once("exit", resolve));
  const launchedIdentity = path.join(project, "launched-window.json"); ownedWindows.push(launchedIdentity);
  const launchOperationId = `launch_${Date.now()}`;
  const launchRequest = { ...saveRequest, operationId: launchOperationId, script: { ...saveRequest.script, name: "Owned closed target initialization" },
    configuration: { profile: { ...profile, nativeVersion: locked.version, windowHandle: 0, windowProcessId: 0, windowStartedAtUtc: null,
      windowSelection: "executable", hostLaunchRequired: true, hostLaunchConfiguration: { launchGame: true, gameMode: "pc",
        gameExe: window.executable, gameArgs: `"${launchedIdentity}" "${title}"`, gameWaitSeconds: 10 } } } };
  const launching = await runtime.api("POST", "api/provider-configurations", launchRequest);
  assert.equal(launching.status, 202, await launching.clone().text());
  const launchDeadline = Date.now() + 30000;
  let launched;
  do {
    launched = await (await runtime.api("GET", `api/provider-configurations/${launchOperationId}`)).json();
    if (["ready", "needs_attention", "cancelled"].includes(launched.state)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < launchDeadline);
  assert.equal(launched.state, "ready", JSON.stringify(launched)); assert.equal(launched.cleanupConfirmed, true);
  const launchJournal = JSON.parse(fs.readFileSync(path.join(runtime.runtimeDir, ".nxp/provider-configurations", launchOperationId + ".json"), "utf8").replace(/^\uFEFF/, ""));
  const actualTarget = JSON.parse(fs.readFileSync(launchedIdentity));
  assert.equal(launchJournal.startedTarget.pid, actualTarget.pid);
  histories.push({ closedTargetLaunch: { operationId: launchOperationId, state: launched.state, formalTasksSubmitted: 0 } });
  {
    const pythonRoot = path.join(runtime.runtimeDir, "pi-python");
    fs.mkdirSync(path.join(pythonRoot, "resource/pipeline"), { recursive: true });
    fs.mkdirSync(path.join(pythonRoot, "agent")); fs.mkdirSync(path.join(pythonRoot, "config/instances"), { recursive: true });
    fs.cpSync(path.join(pythonNativeRoot, "bin"), path.join(pythonRoot, "native"), { recursive: true });
    fs.writeFileSync(path.join(pythonRoot, "requirements.txt"), "maafw\njson-with-comments\n");
    fs.writeFileSync(path.join(pythonRoot, "interface.json"), JSON.stringify({ ...pi, name: "MaaStellaSora", version: "1.6.0",
      global_option: ['Repair'], option: { Repair: { type: 'select', default_case: 'Before', cases: [{name:'Before'}, {name:'After'}] } },
      pretask: [{ exec: "./python/python.exe", args: ["./agent/check_environment.py"], timeout: 20000 }],
      agent: { child_exec: "./python/python.exe", child_args: ["./agent/main.py"], timeout: 20000 } }));
    fs.writeFileSync(path.join(pythonRoot, "resource/pipeline/main.json"), JSON.stringify({ Entry: { recognition: "DirectHit", action: "DoNothing" } }));
    fs.writeFileSync(path.join(pythonRoot, "appsettings.json"), "{}");
    fs.writeFileSync(path.join(pythonRoot, "config/config.json"), JSON.stringify({ CurrentControllerName: "Owned", CurrentController: 1, Resource: "R" }));
    fs.writeFileSync(path.join(pythonRoot, "config/instances/owned.json"), JSON.stringify({ InstanceName: "Owned Python initialization",
      TaskItems: [{ name: "Finite", entry: "Entry", default_check: true }] }));
    fs.writeFileSync(path.join(pythonRoot, "agent/check_environment.py"), `import sys, json, importlib.metadata\nfrom pathlib import Path\nimport maa, numpy, strenum, jsonc\np = {"executable": sys.executable, "noBytecode": sys.dont_write_bytecode, "noUserSite": sys.flags.no_user_site, "versions": {name: importlib.metadata.version(name) for name in ["maafw", "maaagentbinary", "numpy", "strenum", "json-with-comments"]}}\nPath(__file__).with_name("environment-proof.json").write_text(json.dumps(p), encoding="utf-8")\nprint("owned-python-environment-ready", flush=True)\n`);
    fs.mkdirSync(path.join(pythonRoot, 'debug/agent'), { recursive: true });
    const localDate = new Date();
    const agentLogDate = [localDate.getFullYear(), String(localDate.getMonth() + 1).padStart(2, '0'), String(localDate.getDate()).padStart(2, '0')].join('-');
    fs.writeFileSync(path.join(pythonRoot, `debug/agent/${agentLogDate}.log`), 'old-python-session-marker\n');
    fs.writeFileSync(path.join(pythonRoot, "agent/main.py"), `import sys\nfrom pathlib import Path\nfrom datetime import datetime\nfrom maa.agent.agent_server import AgentServer\np = Path(__file__).resolve().parents[1] / "debug" / "agent" / (datetime.now().strftime("%Y-%m-%d") + ".log")\np.parent.mkdir(parents=True, exist_ok=True)\nwith p.open("a", encoding="utf-8") as log: log.write("owned-python-file-current\\n")\nAgentServer.start_up(sys.argv[-1])\nprint("owned-python-agent-connected", flush=True)\nAgentServer.join()\nAgentServer.shut_down()\n`);
    const pythonOperationId = `python_${Date.now()}`;
    const pythonRequest = { operationId: pythonOperationId, script: { id: "", name: "Owned Python Agent initialization", rootPath: pythonRoot,
      executionProviderId: "maa-framework", executionProviderConfigId: "owned-python", maxAttempts: 2,
      judgeScriptEnabled: true, judgeScriptLanguage: 'javascript',
      judgeScript: `var i = JSON.parse(__NEXUS_INPUT__); var c = JSON.parse(nexus.readFile(i.script.ConfigPath)); if(c.options.Repair !== 'After') { c.options.Repair = 'After'; nexus.writeFile('configuration.json', JSON.stringify(c)); console.log(JSON.stringify({status:'failed',reason:'repair next attempt',replaceConfigs:['configuration.json']})); } else if(i.log.indexOf('owned-python-file-current') >= 0 && i.log.indexOf('old-python-session-marker') < 0) console.log(JSON.stringify({status:'success', reason:'owned file source verified'}));` },
      configuration: { profile: { ...profile, profileId: "owned-python", packageRoot: pythonRoot, nativeVersion: pythonNative.source.version,
        revision: "", parentRevision: "", sourceBinding: null, sourceSnapshot: null, dependencyLock: null, authorizedFingerprint: "",
        windowSelection: "executable", windowHandle: actualTarget.handle, windowProcessId: actualTarget.pid, windowStartedAtUtc: actualTarget.startedAtUtc } } };
    const pythonStart = await runtime.api("POST", "api/provider-configurations", pythonRequest);
    assert.equal(pythonStart.status, 202, await pythonStart.clone().text());
    const pythonDeadline = Date.now() + 330000; let initializedPython;
    do {
      initializedPython = await (await runtime.api("GET", `api/provider-configurations/${pythonOperationId}`)).json();
      if (["ready", "needs_attention", "cancelled"].includes(initializedPython.state)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < pythonDeadline);
    assert.equal(initializedPython.state, "ready", JSON.stringify(initializedPython)); assert.equal(initializedPython.cleanupConfirmed, true);
    const proof = JSON.parse(fs.readFileSync(path.join(pythonRoot, "agent/environment-proof.json")));
    assert.ok(proof.executable.includes(".nexus")); assert.equal(proof.noBytecode, true); assert.equal(proof.noUserSite, 1);
    assert.deepEqual(proof.versions, { maafw: "v5.14.2", maaagentbinary: "1.0.1", numpy: "2.5.3", strenum: "0.4.15", "json-with-comments": "1.3.0" });
    assert.ok(!fs.existsSync(path.join(pythonRoot, "python")), "Upstream interpreter directory must remain absent");
    histories.push({ pythonAgentInitialization: { operationId: pythonOperationId, state: initializedPython.state, formalTasksSubmitted: 0,
      versions: proof.versions, noBytecode: proof.noBytecode, noUserSite: proof.noUserSite } });
    await runtime.createUserBinding(initializedPython.scriptId, 'Owned Python file log user');
    const pythonDispatch = await runtime.api('POST', 'api/dispatch/script', { scriptId: initializedPython.scriptId });
    assert.equal(pythonDispatch.status, 200, await pythonDispatch.clone().text()); await pythonDispatch.arrayBuffer();
    assert.equal(await runtime.waitNoRunning(30000), true);
    const pythonHistory = await runtime.waitForHistory(initializedPython.scriptId, 1000);
    assert.equal(pythonHistory.status, 'success', JSON.stringify(pythonHistory));
    assert.equal(pythonHistory.attempts, 2);
    assert.equal(pythonHistory.attemptDetails[0].status, 'failed');
    assert.ok(!fs.existsSync(path.join(runtime.runtimeDir, 'data', initializedPython.scriptId, pythonHistory.userId, 'work/provider-effective')));
    assert.equal(pythonHistory.taskReport.logSources['agent.python.debug'].sourceState, 'complete');
    assert.ok(pythonHistory.taskReport.logSources['agent.python.debug'].startByteOffset > 0);
    histories.push({ pythonAgentFileLog: { status: pythonHistory.status, source: pythonHistory.taskReport.logSources['agent.python.debug'],
      historyExcluded: true, judge: 'owned file source verified', effectiveConfigurationRepair: 'failed then successful retry; restored and cleaned' } });
  }
} finally {
  await runtime.stopRuntime();
  for (const file of ownedWindows) fs.writeFileSync(file + ".stop", "stop");
  if (target && target.exitCode === null) {
    await Promise.race([new Promise(resolve => target.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 1500))]);
    if (target.exitCode === null) throw new Error("Owned target cleanup not confirmed");
  }
  for (const file of ownedWindows.filter(file => fs.existsSync(file))) {
    const deadline = Date.now() + 2000;
    while (!fs.existsSync(file + ".exited") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(fs.existsSync(file + ".exited"), "Launched owned target cleanup not confirmed");
  }
}
report({ scenarioId: "P-X01", nativeInput: locked, pythonNativeInput: pythonNative.source, previews, histories,
  real: ["Host direct execution provider", "MaaFrameworkDriver PI compiler and authorization", "locked native binding and runtime", "official native download, digest verification and owned installation", "fixed official Python environment, real Python Agent handshake and pretask", "two execution worker sessions, initialize-only saves and automatic source synchronization"],
  substituted: ["owned WinForms target and synthetic DirectHit/DoNothing PI project"] });
