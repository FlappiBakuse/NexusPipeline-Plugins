import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {selectChanged} from "./selection.mjs";
import {discoverCases} from "./component-discovery.mjs";
export async function runPluginCore({root,policyBytes,input,batch=null,parentBudget=null}) {
const policy=JSON.parse(policyBytes);
const hostRoot = path.resolve(input.options["--host-root"]);
const units=batch?.batch.units.filter(unit=>unit.kind==="plugin");
const dimensions=name=>units?.find(unit=>unit.artifact===name)?.provides.map(id=>id.split(".").at(-1).split(":")[0]);
const wants=(name,dimension)=>!batch || dimensions(name)?.includes(dimension);
const capability=name=>wants(name,"capability")||wants(name,"adapter");
const support = name => import(pathToFileURL(path.join(hostRoot, "tests/support", name)).href);
let Budget, runProcess, getProcessRunnerState, stageWorkspace, sha256, findAvailablePort;
try {
  ({ Budget } = await support("budget.mjs"));
  ({ runProcess, getProcessRunnerState } = await support("process-runner.mjs"));
  ({ stageWorkspace } = await support("workspace.mjs"));
  ({ sha256 } = await support("report.mjs"));
  ({ findAvailablePort } = await support("test-runtime.mjs"));
} catch (error) { console.error(`Host test input is missing required runner capabilities: ${error.message}`); throw Object.assign(error,{exitCode:7}); }
const budget = parentBudget ?? new Budget("Plugins invocation", policy.invocationBudgetMs,
  { reserveMs: policy.cleanupReserveMs, qualificationMs: policy.qualificationMs,
    inheritedWorkMs:process.env.NEXUS_TEST_PARENT_WORK_DEADLINE_MS?Number(process.env.NEXUS_TEST_PARENT_WORK_DEADLINE_MS)-Date.now():Infinity,
    inheritedHardMs:process.env.NEXUS_TEST_PARENT_HARD_DEADLINE_MS?Number(process.env.NEXUS_TEST_PARENT_HARD_DEADLINE_MS)-Date.now():Infinity });
const artifact = path.resolve(process.env.NEXUS_TEST_ARTIFACT_ROOT || path.join(process.env.RUNNER_TEMP || os.tmpdir(), "NexusPipeline.Tests"));
const marker = path.join(artifact, ".nxp-test-artifact-root.json");
if (!fs.existsSync(artifact)) {
  fs.mkdirSync(artifact, { recursive: true });
  fs.writeFileSync(marker, JSON.stringify({ schemaVersion: 1, owner: "NexusPipeline.Tests", directory: artifact }), { flag: "wx" });
}
process.env.NEXUS_TEST_ARTIFACT_ROOT = artifact;
const { resolveTestRunRoot } = await support("test-runtime.mjs");
const runId = process.env.NEXUS_TEST_RUN_ID || `plugins-${Date.now()}-${process.pid}`;
const runRoot = resolveTestRunRoot(root, runId);
fs.mkdirSync(runRoot, { recursive: true });
const log = fs.openSync(path.join(runRoot, "commands.log"), "wx");
const cancel = new AbortController();
const abort = () => cancel.abort();
process.once("SIGINT", abort); process.once("SIGTERM", abort);
const temporary = path.join(artifact, "tmp"); fs.mkdirSync(temporary, { recursive: true });
const env = { ...process.env, TEMP: temporary, TMP: temporary,
  NUGET_PACKAGES: process.env.NUGET_PACKAGES || path.join(artifact, "cache/nuget"),
  npm_config_cache: process.env.npm_config_cache || path.join(artifact, "cache/npm"),
  DOTNET_CLI_HOME: process.env.DOTNET_CLI_HOME || path.join(artifact, "cache/dotnet"),
  DOTNET_GENERATE_ASPNET_CERTIFICATE: "false", DOTNET_CLI_USE_MSBUILD_SERVER: "0", DOTNET_CLI_UI_LANGUAGE: "en",
  DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE: "true", DOTNET_NOLOGO: "1",
  PYTHONDONTWRITEBYTECODE: "1", PYTHONUTF8: "1" };
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const python = process.platform === "win32" ? "python" : "python3";
let host, plugins, code = 0, failure = null, selection;
const reports = [];
const phases = [];
const cleaned = new Set();
async function step(label, command, args, { cwd = plugins?.directory || root, activeBudget = budget, extraEnv = {}, capture = null } = {}) {
  activeBudget.check(); const started = budget.elapsedMs;
  console.error(`[Plugins] ${label}`); fs.writeSync(log, `${label}\n${JSON.stringify([command, ...args])}\n`);
  const exitCode = await runProcess(command, args, { cwd, budget: activeBudget, signal: cancel.signal,
    env: { ...env, ...extraEnv }, onOutput: text => { fs.writeSync(log, text); capture?.(text); } });
  phases.push({ label, elapsedMs: budget.elapsedMs - started, exitCode });
  if (exitCode) throw Object.assign(new Error(`${label}: exit ${exitCode}`), { exitCode });
}
const dotnetOptions = () => ["-c", "Release", "-p:UseSharedCompilation=false", "--disable-build-servers", "--nologo", "-m:1",
  `-p:NexusHostRoot=${host.directory}`];
try {
  selection = batch ? {selected:units.map(unit=>unit.artifact),reason:"planned runtime units"} : input.command === "plugin" ? { selected: [input.options["--plugin"]], reason: "explicit plugin" }
    : input.options["--all-core"] ? { selected: Object.keys(policy.plugins).sort(), reason: "explicit all core" }
      : selectChanged(root, input.options["--base"], policy, budget);
  host = stageWorkspace(hostRoot, artifact, budget);
  plugins = stageWorkspace(root, artifact, budget, "Plugins");
  if (process.env.CI && host.source.workingTreeDirty) throw Object.assign(new Error("CI requires a clean fixed Host test input"), { exitCode: 7 });
  if (process.env.CI) {
    const locked = JSON.parse(fs.readFileSync(path.join(root, "tests/inputs.lock.json"))).host;
    if (locked.repository !== "FlappiBakuse/NexusPipeline" || host.source.commitSha !== (batch?.plan.inputPair?.sources[0].testedSha ?? locked.commitSha))
      throw Object.assign(new Error("Host input differs from the test lock"), { exitCode: 7 });
  }
  const managed = selection.selected.some(name => policy.plugins[name].kind === "managed-code" && capability(name));
  const withUi = selection.selected.some(name => policy.plugins[name].kind === "managed-code" && capability(name)
    && !["EmulatorSupport", "MaaFrameworkDriver"].includes(name));
  const specialized = selection.selected.some(name => policy.plugins[name].kind === "data-specialized");
  const hostBuild = path.join(runRoot, "test-host");
  const managedNames = selection.selected.filter(name => policy.plugins[name].kind === "managed-code");
  const frontendNames = managedNames.filter(name => (!batch || wants(name,"frontend") || wants(name,"capability"))
    && fs.existsSync(path.join(plugins.directory,policy.plugins[name].root,"frontend")));
  const componentNames = managedNames.filter(name => !batch || wants(name,"component") || capability(name));
  const bootstrapNative = managedNames.includes("MaaFrameworkDriver") && capability("MaaFrameworkDriver")
    && (batch ? "adapter" : input.options["--profile"] || policy.plugins.MaaFrameworkDriver.defaultProfile) === "adapter"
    && !env.NEXUS_MAA_NATIVE_ROOT;
  if (bootstrapNative) env.NEXUS_MAA_NATIVE_ROOT = path.join(runRoot,"maa-native");
  const preparation = await Promise.allSettled([
    (async () => {
      if (!managed) return;
      const frontend = path.join(host.directory,"frontend");
      const frontendReady = (async () => {
          if (!withUi) return;
          if (!fs.existsSync(path.join(frontend,"node_modules/.package-lock.json")))
            await step("Host frontend dependencies",npm,["ci","--no-audit","--no-fund"],{cwd:frontend});
          await step("Host frontend build",npm,["run","build"],{cwd:frontend});
          const browser = path.join(host.directory,"tests/e2e");
          if (!fs.existsSync(path.join(browser,"node_modules/playwright/package.json")))
            await step("shared browser bindings",npm,["ci","--no-audit","--no-fund"],{cwd:browser});
        })();
      const hostSteps = await Promise.allSettled([
        frontendReady,
        (async () => {
          await frontendReady;
          const embedded = path.join(runRoot,"embedded-frontend");
          if (withUi) await step("embedded frontend",python,["tools/embed_frontend.py","--source",path.join(frontend,"dist"),"--output",embedded],{cwd:host.directory});
          await step("shared Test Host","dotnet",["publish","src/NexusPipeline.csproj",...dotnetOptions(),"-r","win-x64",
            "--self-contained","false","-p:NexusTestHost=true",...(withUi?[`-p:NexusFrontendProps=${path.join(embedded,"embedded-frontend.props")}`]:[]),"-p:PublishSingleFile=true","-p:DebugType=none","-p:DebugSymbols=false","-o",hostBuild],{cwd:host.directory});
          await step("Test Host manifest",python,["tools/pe_manifest.py","--exe",path.join(hostBuild,"NexusPipeline.exe"),"--expected-level","asInvoker"],{cwd:host.directory});
        })(),
      ]);
      const failed = hostSteps.find(outcome => outcome.status === "rejected");
      if (failed) throw failed.reason;
    })(),
    (async () => {
      if (!frontendNames.length) return;
      await step("shared plugin frontend dependencies",npm,["ci",...frontendNames.map(name=>`--workspace=${policy.plugins[name].root}/frontend`),
        "--include-workspace-root","--no-audit","--no-fund"]);
      for (const name of frontendNames) {
        const frontend = path.join(plugins.directory,policy.plugins[name].root,"frontend");
        await step(`${name}: frontend typecheck`,npm,["run","typecheck"],{cwd:frontend});
        await step(`${name}: frontend build`,npm,["run","build"],{cwd:frontend});
      }
    })(),
    (async () => {
      if (!componentNames.length) return;
      const solution = path.join(runRoot,"components.slnx");
      const escape = value => value.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
      fs.writeFileSync(solution,`<Solution>\n${componentNames.map(name=>`<Project Path="${escape(path.join(plugins.directory,policy.plugins[name].testProject))}" />`).join("\n")}\n</Solution>\n`,{flag:"wx"});
      // Dependencies outside the solution must retain the selected Release configuration.
      await step("shared component graph","dotnet",["build",solution,...dotnetOptions(),"-p:ShouldUnsetParentConfigurationAndPlatform=false"]);
    })(),
    (async () => {
      if (bootstrapNative)
        await step("Maa native inputs",python,["tests/bootstrap-native.py","--output",env.NEXUS_MAA_NATIVE_ROOT]);
    })(),
  ]);
  const preparationFailure = preparation.find(outcome => outcome.status === "rejected");
  if (preparationFailure) throw preparationFailure.reason;
  if (specialized) await step("shared Jint test engine", "dotnet", ["build", "tools/NexusPipeline.TaskProtocolTests", ...dotnetOptions(), "-p:NexusTestHost=true"], { cwd: host.directory });
  for (const name of selection.selected) {
    const item = policy.plugins[name];
    const profile = input.options["--profile"] || (batch&&name==="MaaFrameworkDriver" ? "adapter" : item.defaultProfile);
    const pluginBudget = budget.child(name, item.profiles[profile], policy.pluginCleanupReserveMs);
    const directory = path.join(runRoot, name); fs.mkdirSync(directory);
    const result = { plugin: name, profile, budgetMs: item.profiles[profile], status: "NOT_RUN", exitCode: 4,
      expectedScenarioIds: capability(name) ? [item.realScenario] : [], completedScenarioIds: [], expectedCaseIds: [], completedCaseIds: [],
      counts: { passed: 0, failed: 0, skipped: 0 }, artifacts: [], boundaries: { real: [], substituted: [] } };
    reports.push(result);
    const run = (label, command, args, options = {}) => step(`${name}: ${label}`, command, args, { ...options, activeBudget: pluginBudget });
    try {
      if (item.kind === "managed-code") {
        const frontend = path.join(plugins.directory, item.root, "frontend");
        const raw = path.join(directory, "native.trx"), normalized = path.join(directory, "native.json");
        const runCapability = async () => {
          const scenario = path.join(plugins.directory, "tests/e2e", `${name}.mjs`);
          if (!fs.existsSync(scenario)) throw Object.assign(new Error(`Real capability scenario is not implemented: ${item.realScenario}`), { exitCode: 7 });
          await run("real Host capability", process.execPath, [scenario], { extraEnv: {
            NEXUS_HOST_ROOT: host.directory, NEXUS_PLUGIN_SOURCE: path.join(plugins.directory, item.root),
            NEXUS_TEST_HOST_DIR: hostBuild, NEXUS_TEST_RUN_ID: `${runId}-${name}`, NEXUS_TEST_MODE: "test-host", NEXUS_TEST_HOST: "1",
            NEXUS_TEST_ARTIFACT_ROOT: artifact, NEXUS_SYSTEM_RUNTIME_NAME: "runtime", NEXUS_SYSTEM_WEB_PORT: String(await findAvailablePort()),
            NEXUS_PLUGIN_RESULT: path.join(directory, "capability.json"),
            NEXUS_TEST_HOST_UI: withUi ? "true" : "false",
            NEXUS_PLUGIN_WORKER: path.join(directory, "worker"), NEXUS_OWNED_WINDOW: path.join(directory, "owned-window/OwnedWindow.exe") } });
          const capability = JSON.parse(fs.readFileSync(path.join(directory, "capability.json"), "utf8"));
          if (capability.scenarioId !== item.realScenario || capability.status !== "PASS" || capability.cleanup !== "complete") throw Object.assign(new Error("Invalid capability evidence"), { exitCode: 4 });
          result.completedScenarioIds = [item.realScenario]; result.artifacts.push(path.join(directory, "capability.json"));
          result.boundaries.real.push(...capability.real); result.boundaries.substituted.push(...capability.substituted);
        };
        const componentWork = (async()=>{
          if(batch&&!wants(name,"component")&&!capability(name)) return;
          let listing="";
          await run("component discovery", "dotnet", ["test",item.testProject,...dotnetOptions(),"--no-build","--no-restore","--list-tests"],{capture:text=>{listing+=text;}});
          const expected=discoverCases(listing,item.expectedMethods);
          result.expectedCaseIds=expected;
          fs.writeFileSync(path.join(directory,"discovery.txt"),listing);
          fs.writeFileSync(path.join(directory,"discovery.json"),JSON.stringify({expectedCaseIds:expected,expectedMethods:item.expectedMethods},null,2));
          await run("component rules", "dotnet", ["test", item.testProject, ...dotnetOptions(),"--no-build","--no-restore",
            "--logger", "trx;LogFileName=native.trx", "--results-directory", directory]);
        await run("native counts", python, [path.join(host.directory, "tests/support/native-report.py"), "trx", raw, normalized]);
        const native = JSON.parse(fs.readFileSync(normalized, "utf8"));
        const methodOf = id => id.split("(")[0];
        if (!native.caseIds.length || new Set(native.caseIds).size !== native.caseIds.length
          || JSON.stringify([...new Set(native.caseIds.map(methodOf))].sort()) !== JSON.stringify([...item.expectedMethods].sort()))
          throw Object.assign(new Error("Executed component method set differs from policy"), { exitCode: 4 });
        if(JSON.stringify([...result.expectedCaseIds].sort())!==JSON.stringify([...native.caseIds].sort())) throw Object.assign(new Error("Native instances differ from pre-run discovery"),{exitCode:4});
        result.completedCaseIds = native.caseIds; result.counts = { passed: native.passed, failed: native.failed, skipped: native.skipped };
        result.artifacts.push(raw, normalized); result.boundaries.real.push("current plugin component implementation");
        })();
        const capabilityWork = (async()=>{
        if(batch&&!capability(name)) return;
        if (name === "MaaFrameworkDriver" && profile === "core") {
          result.expectedScenarioIds = ["P-X01.protocol-only"]; result.completedScenarioIds = [...result.expectedScenarioIds];
          result.boundaries.substituted.push("no native execution claimed");
        } else {
          if (name === "MaaFrameworkDriver") {
            await run("native worker build", "dotnet", ["publish", `${item.root}/worker/NexusPipeline.MaaWorker.csproj`, ...dotnetOptions(),
              "-p:RestoreLockedMode=true", "--self-contained", "false", "-o", path.join(directory, "worker")]);
            await run("owned native target", "dotnet", ["publish", "tests/fixtures/OwnedWindow/OwnedWindow.csproj", ...dotnetOptions(),
              "-r", "win-x64", "--self-contained", "false", "-o", path.join(directory, "owned-window")]);
          }
          await runCapability();
        }
        })();
        const work=await Promise.allSettled([componentWork,capabilityWork]);
        const failed=work.find(outcome=>outcome.status==="rejected");
        if(failed) throw failed.reason;
      } else {
        result.expectedCaseIds = item.fixtureIds;
        result.expectedEditorCaseIds = ["BetterGI", "ZenlessZoneZeroOneDragon", "MaaStellaSora"].includes(name)
          ? [`${name}.editor-select-and-preserve`, `${name}.editor-repeat`] : [];
        result.completedEditorCaseIds = [];
        for (const [index, fixture] of item.fixtureIds.entries()) {
          const reportPath = path.join(directory, `${fixture}.json`);
          const args = [path.join(host.directory, "bin/test-host/NexusPipeline.TaskProtocolTests/Release/net10.0-windows/NexusPipeline.TaskProtocolTests.dll"),
            "--plugin-root", plugins.directory, "--plugin", name, "--scenario", fixture, "--report", reportPath];
          if (index === 0) args.push("--observe-count", "12");
          await run(`trajectory ${fixture}`, "dotnet", args);
          const native = JSON.parse(fs.readFileSync(reportPath, "utf8"));
          if (native.artifact !== name || native.passed !== 1 || native.failed !== 0 || native.skipped !== 0
            || JSON.stringify(native.completedCaseIds) !== JSON.stringify([fixture])
            || (index === 0 && (native.observeCount !== 12 || !native.isolatedRunChecked)))
            throw Object.assign(new Error("Invalid adapter native evidence"), { exitCode: 4 });
          result.completedCaseIds.push(fixture); result.counts.passed++;
          if (index === 0) {
            if (JSON.stringify(native.editorCaseIds) !== JSON.stringify(result.expectedEditorCaseIds))
              throw Object.assign(new Error("Missing production editor evidence"), { exitCode: 4 });
            result.completedEditorCaseIds = native.editorCaseIds;
          }
          result.artifacts.push(reportPath);
          result.boundaries.real = native.real; result.boundaries.substituted = native.substituted;
        }
        result.completedScenarioIds = [item.realScenario];
      }
      pluginBudget.check(); result.status = "PASS"; result.exitCode = 0;
    } catch (error) {
      result.exitCode = error.exitCode ?? 1; result.status = result.exitCode === 7 ? "BLOCKED" : result.exitCode === 5 ? "TIMEOUT" : "FAIL";
      result.failure = error.message; throw error;
    } finally {
      const childRun = `${runId}-${name}`, childRoot = path.join(artifact, "runs", childRun);
      if (fs.existsSync(path.join(childRoot, "runtime/.nxp/test-run-marker.json"))) {
        const remaining = pluginBudget.remainingMs({ cleanup: true });
        const cleanupCode = remaining > 1000 ? await runProcess(process.execPath, [path.join(hostRoot, "tests/support/cleanup-runtime.mjs"), childRoot, childRun],
          { env, timeoutMs: Math.min(12000, remaining - 1000), timeoutCleanupMs: 1000, onOutput: text => fs.writeSync(log, text) }) : 6;
        result.cleanup = cleanupCode ? "incomplete" : "complete";
        if (!cleanupCode) cleaned.add(name);
        if (cleanupCode) { result.exitCode ||= 6; result.status = "FAIL"; code ||= 6; }
      } else result.cleanup = "complete";
      if (pluginBudget.remainingMs({ cleanup: true }) <= 0) { result.exitCode = 5; result.status = "TIMEOUT"; code ||= 5; }
      result.exclusivePluginMs = pluginBudget.elapsedMs;
      fs.writeFileSync(path.join(directory, "summary.json"), JSON.stringify(result, null, 2));
    }
    if (result.exitCode) throw Object.assign(new Error(`${name}: ${result.status}`), { exitCode: result.exitCode });
  }
} catch (error) { code = error.exitCode ?? 3; failure = error.message; console.error(error.message); }
finally {
  for (const name of selection?.selected ?? []) {
    if (cleaned.has(name)) continue;
    const childRun = `${runId}-${name}`, childRoot = path.join(artifact, "runs", childRun);
    if (fs.existsSync(path.join(childRoot, "runtime/.nxp/test-run-marker.json"))) {
      const remaining = budget.remainingMs({ cleanup: true });
      const cleanupCode = remaining > 1000 ? await runProcess(process.execPath, [path.join(hostRoot, "tests/support/cleanup-runtime.mjs"), childRoot, childRun],
        { env, timeoutMs: Math.min(12000, remaining - 1000), timeoutCleanupMs: 1000, onOutput: text => fs.writeSync(log, text) }) : 6;
      if (cleanupCode) code ||= 6;
    }
  }
  const cleanup = getProcessRunnerState(); if (!cleanup.cleanupComplete) code ||= 6;
  if (budget.elapsedMs > policy.qualificationMs) code ||= 5;
  if (budget.remainingMs({ cleanup: true }) <= 0) code ||= 5;
  if (cleanup.cleanupComplete) { plugins?.release(); host?.release(); }
  if (budget.elapsedMs > policy.qualificationMs) code ||= 5;
  fs.writeFileSync(path.join(runRoot, "summary.json"), JSON.stringify({ evidenceType: "actual", repository: "FlappiBakuse/NexusPipeline-Plugins",
    runId, inputPair:batch?.plan.inputPair??null, source: plugins?.source ?? null, partner: host?.source ?? null, policySha256: sha256(policyBytes.toString("utf8").replaceAll("\r\n", "\n")), selection,
    localDevelopmentInput: Boolean(host?.source.workingTreeDirty), status: code ? "FAIL" : selection.selected.length ? "PASS" : "NOT_APPLICABLE",
    exitCode: code, failure, budgetMs: policy.invocationBudgetMs, qualificationMs: policy.qualificationMs,
    elapsedMs: budget.elapsedMs, phases, plugins: reports, cleanup }, null, 2));
  fs.closeSync(log); process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
}
return {code,reports,runRoot,host,plugins,phases,cleanup:getProcessRunnerState()};

}
