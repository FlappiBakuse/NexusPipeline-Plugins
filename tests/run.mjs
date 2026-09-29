import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArguments, selectChanged, validateInventory } from "./selection.mjs";

const root = path.resolve(import.meta.dirname, "..");
const policyBytes = fs.readFileSync(path.join(root, "tests/policy.json"));
const policy = JSON.parse(policyBytes);
let input;
try { input = parseArguments(process.argv.slice(2), policy); validateInventory(root, policy); }
catch (error) { console.error(error.message); process.exit(2); }
if (input.command === "list") { console.log(JSON.stringify(policy, null, 2)); process.exit(0); }
const hostRoot = path.resolve(input.options["--host-root"]);
const support = name => import(pathToFileURL(path.join(hostRoot, "tests/support", name)).href);
let Budget, runProcess, getProcessRunnerState, stageWorkspace, sha256, findAvailablePort;
try {
  ({ Budget } = await support("budget.mjs"));
  ({ runProcess, getProcessRunnerState } = await support("process-runner.mjs"));
  ({ stageWorkspace } = await support("workspace.mjs"));
  ({ sha256 } = await support("report.mjs"));
  ({ findAvailablePort } = await support("test-runtime.mjs"));
} catch (error) { console.error(`Host test input is missing required runner capabilities: ${error.message}`); process.exit(7); }
const budget = new Budget("Plugins invocation", policy.invocationBudgetMs, { reserveMs: policy.cleanupReserveMs });
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
const dotnetOptions = () => ["-c", "Release", "-p:UseSharedCompilation=false", "--disable-build-servers", "--nologo",
  `-p:NexusHostRoot=${host.directory}`];
try {
  selection = input.command === "plugin" ? { selected: [input.options["--plugin"]], reason: "explicit plugin" }
    : input.options["--all-core"] ? { selected: Object.keys(policy.plugins).sort(), reason: "explicit all core" }
      : selectChanged(root, input.options["--base"], policy, budget);
  host = stageWorkspace(hostRoot, artifact, budget);
  plugins = stageWorkspace(root, artifact, budget, "Plugins");
  if (process.env.CI && host.source.workingTreeDirty) throw Object.assign(new Error("CI requires a clean fixed Host test input"), { exitCode: 7 });
  if (process.env.CI) {
    const locked = JSON.parse(fs.readFileSync(path.join(root, "tests/inputs.lock.json"))).host;
    if (locked.repository !== "FlappiBakuse/NexusPipeline" || host.source.commitSha !== locked.commitSha)
      throw Object.assign(new Error("Host input differs from the test lock"), { exitCode: 7 });
  }
  const managed = selection.selected.some(name => policy.plugins[name].kind === "managed-code");
  const specialized = selection.selected.some(name => policy.plugins[name].kind === "data-specialized");
  const hostBuild = path.join(runRoot, "test-host");
  if (managed) {
    const frontend = path.join(host.directory, "frontend");
    if (!fs.existsSync(path.join(frontend, "node_modules/.package-lock.json"))) await step("Host frontend dependencies", npm, ["ci", "--no-audit", "--no-fund"], { cwd: frontend });
    await step("Host frontend build", npm, ["run", "build"], { cwd: frontend });
    await step("shared Test Host", "dotnet", ["publish", "src/NexusPipeline.csproj", ...dotnetOptions(), "-r", "win-x64",
      "--self-contained", "false", "-p:NexusTestHost=true", "-p:PublishSingleFile=true", "-p:DebugType=none", "-p:DebugSymbols=false", "-o", hostBuild], { cwd: host.directory });
    await step("Test Host manifest", python, ["tools/pe_manifest.py", "--exe", path.join(hostBuild, "nexus-pipeline.exe"), "--expected-level", "asInvoker"], { cwd: host.directory });
    fs.cpSync(path.join(frontend, "dist"), path.join(hostBuild, "wwwroot"), { recursive: true });
    const browser = path.join(host.directory, "tests/e2e");
    if (!fs.existsSync(path.join(browser, "node_modules/playwright/package.json"))) await step("shared browser bindings", npm, ["ci", "--no-audit", "--no-fund"], { cwd: browser });
  }
  if (specialized) await step("shared Jint test engine", "dotnet", ["build", "tools/NexusPipeline.TaskProtocolTests", ...dotnetOptions(), "-p:NexusTestHost=true"], { cwd: host.directory });
  for (const name of selection.selected) {
    const item = policy.plugins[name];
    const profile = input.options["--profile"] || item.defaultProfile;
    const pluginBudget = budget.child(name, item.profiles[profile], policy.pluginCleanupReserveMs);
    const directory = path.join(runRoot, name); fs.mkdirSync(directory);
    const result = { plugin: name, profile, budgetMs: item.profiles[profile], status: "NOT_RUN", exitCode: 4,
      expectedScenarioIds: [item.realScenario], completedScenarioIds: [], expectedCaseIds: [], completedCaseIds: [],
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
            NEXUS_PLUGIN_WORKER: path.join(directory, "worker"), NEXUS_OWNED_WINDOW: path.join(directory, "owned-window/OwnedWindow.exe") } });
          const capability = JSON.parse(fs.readFileSync(path.join(directory, "capability.json"), "utf8"));
          if (capability.scenarioId !== item.realScenario || capability.status !== "PASS" || capability.cleanup !== "complete") throw Object.assign(new Error("Invalid capability evidence"), { exitCode: 4 });
          result.completedScenarioIds = [item.realScenario]; result.artifacts.push(path.join(directory, "capability.json"));
          result.boundaries.real.push(...capability.real); result.boundaries.substituted.push(...capability.substituted);
        };
        const frontendWork = (async () => {
          if (!fs.existsSync(frontend)) return;
          await run("frontend dependencies", npm, ["ci", "--workspace", `${item.root}/frontend`, "--include-workspace-root", "--no-audit", "--no-fund"]);
          await run("frontend typecheck", npm, ["run", "typecheck"], { cwd: frontend });
          await run("frontend build", npm, ["run", "build"], { cwd: frontend });
        })();
        const componentWork = run("component rules", "dotnet", ["test", item.testProject, ...dotnetOptions(),
          "--logger", "trx;LogFileName=native.trx", "--results-directory", directory]);
        const outcomes = await Promise.allSettled([frontendWork, componentWork]);
        const failed = outcomes.find(outcome => outcome.status === "rejected");
        if (failed) throw failed.reason;
        await run("native counts", python, [path.join(host.directory, "tests/support/native-report.py"), "trx", raw, normalized]);
        const native = JSON.parse(fs.readFileSync(normalized, "utf8"));
        const methodOf = id => id.split("(")[0];
        if (!native.caseIds.length || new Set(native.caseIds).size !== native.caseIds.length
          || JSON.stringify([...new Set(native.caseIds.map(methodOf))].sort()) !== JSON.stringify([...item.expectedMethods].sort()))
          throw Object.assign(new Error("Executed component method set differs from policy"), { exitCode: 4 });
        result.expectedCaseIds = native.caseIds;
        result.completedCaseIds = native.caseIds; result.counts = { passed: native.passed, failed: native.failed, skipped: native.skipped };
        result.artifacts.push(raw, normalized); result.boundaries.real.push("current plugin component implementation");
        if (name === "MaaFrameworkDriver" && profile === "core") {
          result.expectedScenarioIds = ["P-X01.protocol-only"]; result.completedScenarioIds = [...result.expectedScenarioIds];
          result.boundaries.substituted.push("no native execution claimed");
        } else {
          if (name === "MaaFrameworkDriver") {
            await run("native worker build", "dotnet", ["publish", `${item.root}/worker/NexusPipeline.MaaWorker.csproj`, ...dotnetOptions(),
              "-p:RestoreLockedMode=true", "--self-contained", "true", "-o", path.join(directory, "worker")]);
            await run("owned native target", "dotnet", ["publish", "tests/fixtures/OwnedWindow/OwnedWindow.csproj", ...dotnetOptions(),
              "-r", "win-x64", "--self-contained", "false", "-o", path.join(directory, "owned-window")]);
          }
          await runCapability();
        }
      } else {
        result.expectedCaseIds = item.fixtureIds;
        result.expectedEditorCaseIds = ["BetterGI", "ZenlessZoneZeroOneDragon"].includes(name)
          ? [`${name}.editor-select-and-preserve`, `${name}.editor-repeat`] : [];
        result.completedEditorCaseIds = [];
        for (const [index, fixture] of item.fixtureIds.entries()) {
          const reportPath = path.join(directory, `${fixture}.json`);
          const args = [path.join(host.directory, "bin/test-host/NexusPipeline.TaskProtocolTests/Release/net8.0-windows/NexusPipeline.TaskProtocolTests.dll"),
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
          { env, timeoutMs: Math.min(4000, remaining - 1000), timeoutCleanupMs: 1000, onOutput: text => fs.writeSync(log, text) }) : 6;
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
        { env, timeoutMs: Math.min(4000, remaining - 1000), timeoutCleanupMs: 1000, onOutput: text => fs.writeSync(log, text) }) : 6;
      if (cleanupCode) code ||= 6;
    }
  }
  const cleanup = getProcessRunnerState(); if (!cleanup.cleanupComplete) code ||= 6;
  if (budget.remainingMs({ cleanup: true }) <= 0) code ||= 5;
  if (cleanup.cleanupComplete) { plugins?.release(); host?.release(); }
  fs.writeFileSync(path.join(runRoot, "summary.json"), JSON.stringify({ evidenceType: "actual", repository: "FlappiBakuse/NexusPipeline-Plugins",
    runId, source: plugins?.source ?? null, partner: host?.source ?? null, policySha256: sha256(policyBytes), selection,
    localDevelopmentInput: Boolean(host?.source.workingTreeDirty), status: code ? "FAIL" : selection.selected.length ? "PASS" : "NOT_APPLICABLE",
    exitCode: code, failure, budgetMs: policy.invocationBudgetMs, elapsedMs: budget.elapsedMs, phases, plugins: reports, cleanup }, null, 2));
  fs.closeSync(log); process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
}
process.exitCode = code;
