import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { readRegistry } from "./scope-plan.mjs";
import { validateInventory } from "./selection.mjs";
import {coreUnits} from "./core-plan.mjs";
import {runPluginCore} from "./plugin-core.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const root = path.resolve(import.meta.dirname, "../..");
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
  if(artifact&&["frontend","component","adapter","capability"].includes(templateId.split(".").at(-1))) {
    const units=coreUnits([{id}],registry,policy);
    const bytes=fs.readFileSync(path.join(root,"tests/policy.json"));
    const outcome=await runPluginCore({root,policyBytes:bytes,input:{command:"plugin",options:{"--plugin":artifact,"--host-root":hostRoot,
      ...(artifact==="MaaFrameworkDriver"?{"--profile":"adapter"}:{})}},batch:{batch:{units}}});
    const item=outcome.reports[0];
    fs.writeFileSync(path.join(outcome.runRoot,"gate-report.json"),JSON.stringify({schemaVersion:1,scope:"LOCAL_GATE",gateId:id,kind:gate.kind,
      source:outcome.plugins?.source,partner:outcome.host?.source,policyDigest:digest,status:outcome.code?"FAIL":"PASS",exitCode:outcome.code,
      selectedCases:item?.expectedCaseIds??[],completedCases:item?.completedCaseIds??[],scenarios:item?.completedScenarioIds??[],counts:item?.counts??null,cleanup:outcome.cleanup},null,2));
    return outcome.code;
  }
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
  let cases = null, expectedCases = null, counts = null, scenarios = null;
  const artifacts = [];
  async function run(label, command, args, cwd = plugins?.directory || root, extraEnv = {}) {
    budget.check();
    console.error(`[${id}] ${label}`);
    const result = await runProcess(command, args, { cwd, budget, env: { ...env, ...extraEnv } });
    if (result) throw Object.assign(new Error(`${label}: exit ${result}`), { exitCode: result });
  }
  const stagePlugins = () => { plugins ??= stageWorkspace(root, artifactRoot, budget, "Plugins"); return plugins.directory; };
  const stageHost = () => { host ??= stageWorkspace(hostRoot, artifactRoot, budget, "Host"); return host.directory; };
  async function runPythonSuite(suite) {
    const report = path.join(runRoot, `python-${suite}.json`);
    await run(`Python ${suite}`, python, ["-m", "tests.tooling.unittest_runner", "--root", plugins.directory,
      "--suite", suite, "--report", report]);
    const native = JSON.parse(fs.readFileSync(report, "utf8"));
    if(native.status!=="PASS" || native.suite!==suite || native.counts?.testsRun<=0
      || ["failures","errors","skipped","unexpectedSuccesses"].some(key=>native.counts?.[key]!==0))
      throw new Error(`Invalid native unittest result: ${suite}`);
    counts = native.counts; artifacts.push(report);
  }
  try {
    if (id === "plugins.ci-policy") {
      stagePlugins();
      await run("选择与预算夹具", process.execPath, ["--test", "tests/runner/selection.test.mjs", "tests/runner/scope-plan.test.mjs"]);
      await runPythonSuite("ci");
    } else if (id === "plugins.inventory") {
      stagePlugins(); validateInventory(plugins.directory, policy);
      await run("验证插件源码清单", python, ["tools/repo.py", "check", "source"]);
      const report = path.join(runRoot, "architecture-plugins.json");
      await run("检查插件包边界", python, ["tests/architecture/check.py", "--root", plugins.directory, "--report", report]);
      await runPythonSuite("architecture");
      artifacts.push(report);
    } else if (id === "plugins.release-contract") {
      stagePlugins();
      await runPythonSuite("tooling");
    } else if (id === "plugins.docs") {
      stagePlugins();
      if (!["README.md", "docs"].every(name => fs.existsSync(path.join(plugins.directory, name))))
        throw new Error("Required plugin documentation is missing");
      await run("核验文档相对链接与片段",process.execPath,["tools/docs/check-links.mjs"]);
    } else if (artifact) {
      const item = policy.plugins[artifact];
      const dimension = templateId.replace(/^plugins\.plugin\./, "");
      if (["contract", "package"].includes(dimension)) {
        stagePlugins();
        await run("验证插件源码契约", python, ["tools/repo.py", "check", "source"]);
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
          await run("构建并核验单插件包", python, ["tools/repo.py", "package", "--root", plugins.directory,
            "--host-root", host.directory, "--artifact", artifact, "--output", packageDirectory,
            "--report", packageReport]);
          const built = JSON.parse(fs.readFileSync(packageReport, "utf8"));
          if (!/^[A-Za-z0-9.-]+\.zip$/.test(built.fileName)) throw new Error("Unsafe package filename");
          const archive = path.join(packageDirectory, built.fileName);
          if (built.status !== "PASS" || built.artifactName !== artifact
              || built.sha256 !== sha256(fs.readFileSync(archive))) throw new Error("Built package identity mismatch");
          artifacts.push(archive, packageReport);
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
      digestFormat: "utf8-lf-v1", selectedCases: expectedCases, completedCases: cases, counts, scenarios,
      status: exitCode ? "FAIL" : "PASS", exitCode, failure,
      timing: { qualificationMs: 150000, hardTimeoutMs: 180000, localElapsedMs: budget.elapsedMs, actualJobMs: null },
      cleanup, artifacts: artifacts.map(file => ({ file: path.relative(runRoot, file).replaceAll("\\", "/"),
        sha256: sha256(fs.readFileSync(file)) })) };
    fs.writeFileSync(path.join(runRoot, "gate-report.json"), JSON.stringify(report, null, 2) + "\n");
  }
  return exitCode;
}
