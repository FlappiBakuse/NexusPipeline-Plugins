import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { readRegistry } from "./scope-plan.mjs";
import { validateInventory } from "./selection.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const root = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "tests/policy.json"), "utf8"));

export async function runPluginGate(id, hostRoot) {
  const [templateId, artifact] = id.split(":");
  const { registry, digest } = readRegistry(root);
  const gate = registry.gates.find(item => item.id === templateId);
  if (!gate || gate.kind === "scope" || gate.kind === "aggregate" || gate.kind === "release"
      || artifact && (!Object.hasOwn(policy.plugins, artifact) || gate.kind !== "matrix-template")
      || !artifact && gate.kind === "matrix-template") throw new Error(`Unknown executable gate: ${id}`);
  if (!hostRoot || !path.isAbsolute(hostRoot)) throw new Error("Fixed Host checkout is required for gate control");
  const hostSha = execFileSync("git", ["-C", hostRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const hostDirty = Boolean(execFileSync("git", ["-C", hostRoot, "status", "--porcelain"], { encoding: "utf8" }).trim());
  const lock = JSON.parse(fs.readFileSync(path.join(root, "tests/inputs.lock.json"), "utf8")).host;
  if (hostSha !== lock.commitSha) throw new Error("Host test input differs from lock");
  const support = name => import(pathToFileURL(path.join(hostRoot, "tests/support", name)).href);
  const { Budget } = await support("budget.mjs");
  const { runProcess, getProcessRunnerState } = await support("process-runner.mjs");
  const { stageWorkspace } = await support("workspace.mjs");
  const artifactRoot = path.resolve(process.env.NEXUS_TEST_ARTIFACT_ROOT
    || path.join(process.env.RUNNER_TEMP || os.tmpdir(), "NexusPipeline.Tests"));
  const marker = path.join(artifactRoot, ".nxp-test-artifact-root.json");
  if (!fs.existsSync(artifactRoot)) {
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(marker, JSON.stringify({ schemaVersion: 1, owner: "NexusPipeline.Tests", directory: artifactRoot }), { flag: "wx" });
  }
  if (!fs.existsSync(marker)) throw new Error("External test artifact root has no ownership marker");
  const runId = process.env.NEXUS_TEST_RUN_ID || `plugins-gate-${Date.now()}-${process.pid}`;
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error("Invalid gate run identity");
  const runRoot = path.join(artifactRoot, "runs", runId);
  fs.mkdirSync(runRoot, { recursive: true });
  const budget = new Budget(id, 180000, { qualificationMs: 150000, reserveMs: 10000 });
  const temporary = path.join(artifactRoot, "tmp"); fs.mkdirSync(temporary, { recursive: true });
  const env = { ...process.env, NEXUS_TEST_ARTIFACT_ROOT: artifactRoot, TEMP: temporary, TMP: temporary,
    NUGET_PACKAGES: process.env.NUGET_PACKAGES || path.join(artifactRoot, "cache/nuget"),
    npm_config_cache: process.env.npm_config_cache || path.join(artifactRoot, "cache/npm"),
    DOTNET_CLI_HOME: process.env.DOTNET_CLI_HOME || path.join(artifactRoot, "cache/dotnet"),
    PYTHONDONTWRITEBYTECODE: "1", PYTHONUTF8: "1", DOTNET_CLI_USE_MSBUILD_SERVER: "0" };
  const python = process.platform === "win32" ? "python" : "python3";
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const sourceSha = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sourceDirty = Boolean(execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).trim());
  let plugins = null, host = null, exitCode = 0, failure = null;
  let cases = null, counts = null, scenarios = null;
  const artifacts = [];
  async function run(label, command, args, cwd = plugins?.directory || root, extraEnv = {}) {
    budget.check();
    console.error(`[${id}] ${label}`);
    const result = await runProcess(command, args, { cwd, budget, env: { ...env, ...extraEnv } });
    if (result) throw Object.assign(new Error(`${label}: exit ${result}`), { exitCode: result });
  }
  const stagePlugins = () => { plugins ??= stageWorkspace(root, artifactRoot, budget, "Plugins"); return plugins.directory; };
  const stageHost = () => { host ??= stageWorkspace(hostRoot, artifactRoot, budget, "Host"); return host.directory; };
  try {
    if (id === "plugins.ci-policy") {
      stagePlugins();
      await run("选择与预算夹具", process.execPath, ["--test", "tests/selection.test.mjs", "tests/scope-plan.test.mjs"]);
      await run("完成后预算与汇总夹具", python, ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"]);
    } else if (id === "plugins.inventory") {
      stagePlugins(); validateInventory(plugins.directory, policy);
      await run("验证插件源码清单", python, ["tools/repository.py", "validate-source"]);
      const report = path.join(runRoot, "architecture-plugins.json");
      await run("检查插件包边界", python, ["tests/architecture-check.py", "--root", plugins.directory, "--report", report]);
      await run("验证插件包正反例", python, ["-m", "unittest", "discover", "-s", "tests", "-p", "test_architecture_check.py", "-v"]);
      artifacts.push(report);
    } else if (id === "plugins.release-contract") {
      stagePlugins();
      await run("验证发布契约", python, ["-m", "unittest", "tools.tests.test_repository",
        "tools.tests.test_repository_candidate_source",
        "tools.tests.test_repository_preview_source", "-v"]);
    } else if (id === "plugins.docs") {
      stagePlugins();
      if (!["README.md", "docs"].every(name => fs.existsSync(path.join(plugins.directory, name))))
        throw new Error("Required plugin documentation is missing");
    } else if (artifact) {
      const item = policy.plugins[artifact];
      const dimension = templateId.replace(/^plugins\.plugin\./, "");
      if (["contract", "package"].includes(dimension)) {
        stagePlugins();
        await run("验证插件源码契约", python, ["tools/repository.py", "validate-source"]);
        const entry = path.join(plugins.directory, item.root);
        const files = ["plugin.json", "store.json", "README.md"].filter(name => fs.existsSync(path.join(entry, name)));
        const inputs = files.map(name => ({ file: name, sha256: sha256(fs.readFileSync(path.join(entry, name))) }));
        const manifest = path.join(runRoot, "package-input.json");
        fs.writeFileSync(manifest, JSON.stringify({ artifact, dimension, inputs }, null, 2));
        artifacts.push(manifest);
        if (dimension === "package") {
          stageHost();
          const packageDirectory = path.join(runRoot, "package");
          const packageReport = path.join(runRoot, "package-report.json");
          await run("构建并核验单插件包", python, ["tests/package-one.py", "--root", plugins.directory,
            "--host-root", host.directory, "--artifact", artifact, "--output", packageDirectory,
            "--report", packageReport]);
          const built = JSON.parse(fs.readFileSync(packageReport, "utf8"));
          if (!/^[A-Za-z0-9.-]+\.zip$/.test(built.fileName)) throw new Error("Unsafe package filename");
          const archive = path.join(packageDirectory, built.fileName);
          if (built.status !== "PASS" || built.artifactName !== artifact
              || built.sha256 !== sha256(fs.readFileSync(archive))) throw new Error("Built package identity mismatch");
          artifacts.push(archive, packageReport);
        }
      } else if (dimension === "frontend") {
        stagePlugins();
        const directory = path.join(plugins.directory, item.root, "frontend");
        if (!fs.existsSync(path.join(directory, "package.json"))) throw new Error("Selected frontend is missing");
        await run("准备锁定前端依赖", npm, ["ci", "--workspace", `${item.root}/frontend`, "--include-workspace-root", "--no-audit", "--no-fund"]);
        await run("检查插件前端类型", npm, ["run", "typecheck"], directory);
        await run("构建插件前端", npm, ["run", "build"], directory);
        const output = path.join(plugins.directory, item.root, "web", "main.js");
        if (!fs.existsSync(output)) throw new Error("Plugin frontend build output is missing");
        const saved = path.join(runRoot, "frontend-main.js");
        fs.copyFileSync(output, saved); artifacts.push(saved);
      } else if (dimension === "component" && item.kind === "managed-code") {
        stagePlugins(); stageHost();
        const raw = path.join(runRoot, "native.trx"), normalized = path.join(runRoot, "native.json");
        await run("运行组件验证", "dotnet", ["test", item.testProject, "-c", "Release",
          `-p:NexusHostRoot=${host.directory}`, "-p:UseSharedCompilation=false", "--disable-build-servers", "--nologo",
          "--logger", "trx;LogFileName=native.trx", "--results-directory", runRoot]);
        await run("读取原生用例", python, [path.join(host.directory, "tests/support/native-report.py"), "trx", raw, normalized]);
        const native = JSON.parse(fs.readFileSync(normalized, "utf8"));
        const methods = [...new Set(native.caseIds.map(value => value.split("(")[0]))].sort();
        if (!native.caseIds.length || native.failed || native.skipped
            || JSON.stringify(methods) !== JSON.stringify([...item.expectedMethods].sort()))
          throw new Error("Component native case set differs from policy");
        cases = native.caseIds; counts = { passed: native.passed, failed: native.failed, skipped: native.skipped };
        artifacts.push(raw, normalized);
      } else if (dimension === "adapter" || dimension === "capability") {
        const innerId = `${runId}-inner`;
        const profile = artifact === "MaaFrameworkDriver" && dimension === "adapter" ? ["--profile", "adapter"] : [];
        await run("验证实际插件能力", process.execPath, ["tests/run.mjs", "plugin", "--plugin", artifact,
          ...profile, "--host-root", hostRoot], root, { NEXUS_TEST_RUN_ID: innerId });
        const inner = path.join(artifactRoot, "runs", innerId);
        const summary = JSON.parse(fs.readFileSync(path.join(inner, "summary.json"), "utf8"));
        if (summary.status !== "PASS" || summary.exitCode !== 0 || !summary.cleanup.cleanupComplete
            || summary.plugins.length !== 1 || summary.plugins[0].plugin !== artifact)
          throw new Error("Inner capability evidence failed");
        const result = summary.plugins[0];
        if (result.status !== "PASS" || result.counts.failed || result.counts.skipped)
          throw new Error("Capability did not pass");
        if (dimension === "capability" && JSON.stringify(result.completedScenarioIds) !== JSON.stringify([item.realScenario]))
          throw new Error("Real capability scenario is missing");
        cases = result.completedCaseIds; counts = result.counts; scenarios = result.completedScenarioIds;
        const copied = path.join(runRoot, "native"); fs.mkdirSync(copied);
        for (const file of [path.join(inner, "summary.json"), path.join(inner, artifact, "summary.json"),
          path.join(inner, artifact, "native.trx"), path.join(inner, artifact, "native.json"),
          path.join(inner, artifact, "capability.json"),
          ...fs.readdirSync(path.join(inner, artifact)).filter(name => name.endsWith(".json")
            && !["summary.json", "native.json", "capability.json"].includes(name))
            .map(name => path.join(inner, artifact, name))]) {
          if (fs.existsSync(file)) {
            const target = path.join(copied, path.basename(path.dirname(file)) + "-" + path.basename(file));
            fs.copyFileSync(file, target); artifacts.push(target);
          }
        }
      } else throw new Error(`Unsupported plugin gate dimension: ${id}`);
    } else throw new Error(`Gate has no execution contract: ${id}`);
  } catch (error) {
    exitCode = error.exitCode ?? 1; failure = error.message;
    console.error(error.stack || error.message);
  } finally {
    const cleanup = getProcessRunnerState();
    if (!cleanup.cleanupComplete) exitCode ||= 6;
    if (cleanup.cleanupComplete) { plugins?.release(); host?.release(); }
    if (budget.elapsedMs > 150000) exitCode ||= 5;
    const report = { schemaVersion: 1, scope: "LOCAL_GATE", gateId: id, kind: gate.kind, runId,
      source: plugins?.source ?? { commitSha: sourceSha, workingTreeDirty: sourceDirty },
      partner: gate.partnerRequired ? host?.source ?? { commitSha: hostSha, workingTreeDirty: hostDirty } : null,
      policyDigest: digest,
      digestFormat: "utf8-lf-v1", selectedCases: cases, completedCases: cases, counts, scenarios,
      status: exitCode ? "FAIL" : "PASS", exitCode, failure,
      timing: { qualificationMs: 150000, hardTimeoutMs: 180000, localElapsedMs: budget.elapsedMs, actualJobMs: null },
      cleanup, artifacts: artifacts.map(file => ({ file: path.relative(runRoot, file).replaceAll("\\", "/"),
        sha256: sha256(fs.readFileSync(file)) })) };
    fs.writeFileSync(path.join(runRoot, "gate-report.json"), JSON.stringify(report, null, 2) + "\n");
  }
  return exitCode;
}
