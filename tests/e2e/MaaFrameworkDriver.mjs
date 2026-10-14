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
const pythonRoot = process.env.NEXUS_MAA_PYTHON_ROOT;
if (!pythonRoot) throw new Error("Explicit official local Python test input required");
const pythonInput = JSON.parse(fs.readFileSync(path.join(pythonRoot, "python-input.json")));
assert.deepEqual(pythonInput.source, nativeInputs.maaPythonBundle);
for (const [relative, expected] of Object.entries(pythonInput.files)) {
  assert.ok(relative.startsWith("python/") && !relative.includes(".."));
  assert.equal(createHash("sha256").update(fs.readFileSync(path.join(pythonRoot, relative))).digest("hex"), expected);
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
  let project = path.join(runtime.runtimeDir, "pi"); fs.mkdirSync(path.join(project, "resource/pipeline"), { recursive: true });
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
  for (const route of ['save', 'authorize']) {
    const removed = await runtime.api('POST', `api/plugin-api/${manifest.name}/${route}`, { profile });
    assert.equal(removed.status, 404); await removed.arrayBuffer();
  }
  fs.mkdirSync(path.join(project, 'config/instances'), { recursive: true });
  fs.writeFileSync(path.join(project, 'appsettings.json'), '{}');
  fs.writeFileSync(path.join(project, 'config/config.json'), JSON.stringify({ CurrentControllerName: 'Owned', CurrentController: 1, Resource: 'R' }));
  let sourceFile = path.join(project, 'config/instances/owned.json');
  fs.writeFileSync(sourceFile, JSON.stringify({ InstanceName: 'Owned configuration', TaskItems: [
    { name: 'Finite', entry: 'Entry', default_check: true, repeat_count: 2 }] }));
  const waitOperation = async id => {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const response = await runtime.api('GET', `api/provider-configurations/${id}`);
      assert.equal(response.status, 200); const operation = await response.json();
      if (['ready', 'needs_attention', 'cancelled'].includes(operation.state)) return operation;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Configuration operation did not terminate');
  };
  const save = async (name, configured = profile, overrides = {}) => {
    const request = { operationId: crypto.randomUUID().replaceAll('-', ''), script: { id: '', name, rootPath: project,
      executionProviderId: 'maa-framework', executionProviderConfigId: configured.profileId, maxAttempts: 2, ...overrides },
      configuration: { profile: configured } };
    const response = await runtime.api('POST', 'api/provider-configurations', request);
    assert.equal(response.status, 202, await response.clone().text()); await response.arrayBuffer();
    return { request, operation: await waitOperation(request.operationId) };
  };
  const journal = id => JSON.parse(fs.readFileSync(path.join(runtime.runtimeDir, '.nxp/provider-configurations/completed', id + '.json'), 'utf8').replace(/^\uFEFF/, ''));
  const first = await save('Owned native configuration');
  assert.equal(first.operation.state, 'ready', JSON.stringify(first.operation));
  assert.equal(first.operation.cleanupConfirmed, true);
  const receipt = journal(first.request.operationId);
  assert.ok(receipt.worker.pid > 0);
  assert.equal(receipt.candidate.privateCandidate.profile.runtimeInputs.schemaVersion, 1);
  assert.equal(receipt.candidate.privateCandidate.profile.dependencyLock, null);
  const replay = await runtime.api('POST', 'api/provider-configurations', first.request);
  assert.equal(replay.status, 202); assert.equal((await replay.json()).revision, first.operation.revision);
  await runtime.createUserBinding(first.operation.scriptId, 'Owned native user');
  const dispatch = async (scriptId, timeout = 45000) => {
    let response;
    const admissionDeadline = Date.now() + 30000;
    do {
      response = await runtime.api('POST', 'api/dispatch/script', { scriptId });
      if (response.status !== 409) break;
      const conflict = await response.clone().json();
      if (conflict.code !== 'execution_resource_in_use') break;
      await response.arrayBuffer(); await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < admissionDeadline);
    assert.equal(response.status, 200, await response.clone().text()); await response.arrayBuffer();
    assert.equal(await runtime.waitNoRunning(timeout), true);
    return runtime.waitForHistory(scriptId, 2000);
  };
  const succeeded = await dispatch(first.operation.scriptId);
  assert.equal(succeeded.status, 'success', JSON.stringify(succeeded));
  assert.equal(succeeded.taskReport.resultBasis, 'framework-task-v1');
  assert.equal(succeeded.outcomes.businessVerification, 'unverified');
  assert.equal(succeeded.taskReport.finalTaskResults.length, 2);
  assert.ok(succeeded.taskReport.finalTaskResults.every(item => item.status === 'succeeded'));
  histories.push(succeeded);
  const missing = await save('Owned missing native', { ...profile, nativeDirectory: 'missing-native' });
  assert.equal(missing.operation.state, 'needs_attention');
  assert.equal(fs.existsSync(path.join(project, '.nexus')), false);

  const retryProject = path.join(runtime.runtimeDir, 'retry-pi');
  fs.cpSync(project, retryProject, { recursive: true });
  project = retryProject;
  sourceFile = path.join(project, 'config/instances/owned.json');
  profile = { ...profile, packageRoot: project };
  fs.cpSync(path.join(pythonRoot, 'python'), path.join(project, 'python'), { recursive: true });
  fs.mkdirSync(path.join(project, 'agent'));
  fs.writeFileSync(path.join(project, 'agent/pre.py'), `from pathlib import Path
p=Path('initializations.txt')
with p.open('a') as f: f.write('initialized\\n')
`);
  fs.writeFileSync(path.join(project, 'agent/main.py'), `import os, sys, json
from pathlib import Path
os.environ['MAAFW_BINARY_PATH']=str(Path('native').resolve())
from maa.agent.agent_server import AgentServer
from maa.custom_action import CustomAction
class Owned(CustomAction):
 def run(self, context, argv):
  name=json.loads(argv.custom_action_param)['name']
  p=Path('submitted.txt')
  previous=p.read_text().splitlines() if p.exists() else []
  with p.open('a') as f: f.write(name+'\\n')
  return name != 'B' or 'B' in previous
assert AgentServer.register_custom_action('Owned', Owned())
assert AgentServer.start_up(sys.argv[-1])
AgentServer.join()
AgentServer.shut_down()
`);
  const retryPi = { ...pi, name: 'Arbitrary local distribution', version: 'different-version',
    pretask: [{ exec: './python/python.exe', args: ['-u', './agent/pre.py'], timeout: 20000 }],
    agent: { child_exec: './python/python.exe', child_args: ['-u', './agent/main.py'], timeout: 20000 },
    task: ['A','B','C'].map(name => ({ name, entry: name })) };
  fs.writeFileSync(path.join(project, 'interface.json'), JSON.stringify(retryPi));
  fs.writeFileSync(path.join(project, 'resource/pipeline/main.json'), JSON.stringify(Object.fromEntries(['A','B','C'].map(name => [name,
    { recognition: 'DirectHit', action: 'Custom', custom_action: 'Owned', custom_action_param: { name } }]))));
  fs.writeFileSync(sourceFile, JSON.stringify({ InstanceName: 'Owned retry', TaskItems: ['A','B','C'].map(name => ({name, entry:name, default_check:true})) }));
  const retried = await save('Owned native retry', { ...profile, profileId: 'retry-local', runtimeInputs: null, sourceBinding: null, sourceSnapshot: null });
  assert.equal(retried.operation.state, 'ready', JSON.stringify(retried.operation));
  assert.equal(fs.existsSync(path.join(project, 'submitted.txt')), false, 'Initialization cannot submit formal tasks');
  await runtime.createUserBinding(retried.operation.scriptId, 'Owned retry user');
  const result = await dispatch(retried.operation.scriptId);
  assert.equal(result.status, 'success', JSON.stringify(result));
  assert.equal(result.attempts, 2);
  assert.deepEqual(fs.readFileSync(path.join(project, 'submitted.txt'), 'utf8').trim().split(/\r?\n/), ['A','B','B','C']);
  const attempts = result.taskReport.attemptReports;
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[1].selectedTaskIds, attempts[0].selectedTaskIds.slice(1));
  assert.equal(attempts[0].taskResults[2].status, 'pending');
  assert.ok(result.taskReport.finalTaskResults.every(item => item.status === 'succeeded'));
  assert.equal(result.taskReport.summary.recovered, true);
  assert.equal(result.outcomes.businessVerification, 'unverified');
  histories.push(result);
  const beforeSync = fs.readFileSync(path.join(project, 'initializations.txt'), 'utf8');
  const changed = JSON.parse(fs.readFileSync(sourceFile)); changed.TaskItems[2].default_check = false;
  fs.writeFileSync(sourceFile, JSON.stringify(changed));
  const syncDeadline = Date.now() + 30000;
  let visible;
  do {
    visible = await (await runtime.api('GET', `api/scripts/${retried.operation.scriptId}`)).json();
    if (visible.executionProviderConfigRevision !== retried.operation.revision) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < syncDeadline);
  assert.notEqual(visible.executionProviderConfigRevision, retried.operation.revision);
  assert.equal(fs.readFileSync(path.join(project, 'initializations.txt'), 'utf8'), beforeSync, 'Passive synchronization cannot replay pretasks');
  histories.push({ sourceSynchronization: { before: retried.operation.revision, after: visible.executionProviderConfigRevision, projectProcessesStarted: 0 } });
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
report({ scenarioId: "P-X01", nativeInput: locked, pythonInput: pythonInput.source, previews, histories,
  real: ["Host authenticated provider worker", "native task job results and exact failed suffix retry", "local official Python interpreter and Agent handshake", "configuration transaction and passive source synchronization"],
  substituted: ["owned WinForms target and controlled PI/Agent actions; no game or account"] });
