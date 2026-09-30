import {controlManifest as readControlManifest,sourceFingerprint} from "./control-inputs.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { coreUnits, allocateUnits } from "./core-plan.mjs";

const SHA = /^[0-9a-f]{40}$/;
const normalize = value => value.replaceAll("\\", "/");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export function policyDigest(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error("Policy has a UTF-8 BOM");
  return hash(Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8"));
}

export function readRegistry(root) {
  const bytes = fs.readFileSync(path.join(root, "tests/gates.json"));
  const registry = JSON.parse(bytes);
  if (registry.schemaVersion !== 1 || !["Host", "Plugins"].includes(registry.repository)
      || registry.hardTimeoutMs !== 180000 || registry.qualificationMs !== 150000) throw new Error("Invalid gate registry");
  const ids = registry.gates.map(gate => gate.id);
  if (new Set(ids).size !== ids.length || registry.gates.some(gate => !gate.id.startsWith(registry.repository.toLowerCase() + ".")
      || !/^[a-z0-9.-]+$/.test(gate.id)
      || gate.hardTimeoutMs !== 180000 || gate.qualificationMs !== 150000)) throw new Error("Duplicate or invalid gate");
  return { registry, digest: policyDigest(bytes) };
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { windowsHide: true, timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
}

function fullSha(root, ref) {
  const sha = git(root, ["rev-parse", "--verify", `${ref}^{commit}`]).toString("utf8").trim();
  if (!SHA.test(sha)) throw new Error(`Invalid commit: ${ref}`);
  return sha;
}

export function parseNameStatus(bytes) {
  const fields = bytes.toString("utf8").split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!/^(?:[ACDMRTUXB]|R\d+|C\d+)$/.test(status)) throw new Error(`Unknown git status: ${status}`);
    const oldPath = fields[index++];
    if (!oldPath) throw new Error("Truncated git diff");
    if (/^[RC]/.test(status)) {
      const newPath = fields[index++];
      if (!newPath) throw new Error("Truncated git rename/copy");
      changes.push({ status: status[0], old: normalize(oldPath), path: normalize(newPath) });
    } else changes.push({ status: status[0], path: normalize(oldPath) });
  }
  return changes;
}

export function collectChanges(root, { base, head = "HEAD", includeWorkingTree = false } = {}) {
  if (!base) throw new Error("Explicit --base commit is required");
  const baseSha = fullSha(root, base), headSha = fullSha(root, head);
  const mergeBase = git(root, ["merge-base", baseSha, headSha]).toString("utf8").trim();
  if (!SHA.test(mergeBase)) throw new Error("Cannot determine merge base");
  const changes = parseNameStatus(git(root, ["diff", "--name-status", "-z", "--find-renames", baseSha, headSha, "--"]));
  if (includeWorkingTree) {
    changes.push(...parseNameStatus(git(root, ["diff", "--name-status", "-z", "--find-renames", "HEAD", "--"])));
    changes.push(...parseNameStatus(git(root, ["diff", "--cached", "--name-status", "-z", "--find-renames", "HEAD", "--"])));
    for (const name of git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).toString("utf8").split("\0").filter(Boolean)) {
      changes.push({ status: "A", path: normalize(name), untracked: true });
    }
  }
  return { baseSha, headSha, mergeBase, testedSha: fullSha(root, "HEAD"),
    dirty: Boolean(git(root,["status","--porcelain"]).toString("utf8").trim()),
    changes };
}

function allPluginNames(policy) { return Object.keys(policy.plugins).sort(); }

export function planForChanges(root, changes, registry, policy, lockChanges = null) {
  const owner = registry.repository.toLowerCase();
  const selected = new Map();
  const add = (id, reason) => {
    if (!selected.has(id)) selected.set(id, []);
    selected.get(id).push(reason);
  };
  const host = (suffix, reason) => add(`host.${suffix}`, reason);
  const plugin = (suffix, artifact, reason) => add(`plugins.plugin.${suffix}:${artifact}`, reason);
  const names = owner === "plugins" ? allPluginNames(policy) : [];
  const classifyPlugins = (name, status) => {
    const reason = `${status} ${name}`;
    if (name.startsWith("tests/support/") || name === "tests/batch-runner.mjs") {
      fullCore(`execution adapter: ${reason}`); return;
    }
    if (/^(catalog\.json|\.release-state\.json|packages\/)/.test(name)) { add("plugins.release-contract", reason); return; }
    if (name === "tools/repository_core.py" || name === "tests/package-one.py") {
      add("plugins.release-contract", reason); add("plugins.ci-policy", reason);
      for (const item of names) plugin("package", item, reason);
      return;
    }
    if (/^(tools\/repository|tools\/.*release|\.github\/workflows\/(?:stable|develop|release))/.test(name)) {
      add("plugins.release-contract", reason); add("plugins.ci-policy", reason); return;
    }
    if (/^(tests\/(?:core-plan|batch-plan|scope-plan|scope-cli|selection|selection-cases|ci-scope|gate-runner|gate-required|test_gate_required|policy|gates|run|ci-gate|audit-jobs|test_audit_jobs|final-budget|test_final_budget|inputs\.lock)|\.github\/workflows\/(?:ci|final-budget)\.yml)/.test(name)) {
      add("plugins.ci-policy", reason);
      if (name === "tests/inputs.lock.json") {
        add("plugins.inventory", reason);
        if (lockChanges === null || lockChanges.host) for (const item of names) {
          plugin("contract", item, reason);
          plugin(policy.plugins[item].kind === "data-specialized" ? "adapter" : "component", item, reason);
          if (policy.plugins[item].kind === "managed-code") plugin("capability", item, reason);
        }
        if (lockChanges === null || lockChanges.maaFramework) plugin("adapter", "MaaFrameworkDriver", reason);
      }
      return;
    }
    if (name.startsWith("tests/architecture-check") || name === "tests/test_architecture_check.py") {
      add("plugins.inventory", reason); return;
    }
    if (name === "host.lock.json") {
      add("plugins.inventory", reason);
      fullCore(reason);
      return;
    }
    if (/^(docs\/.*\.(md|png|jpg|svg|webp)|README\.md|CONTRIBUTING\.md|CHANGELOG\.md)$/i.test(name)) {
      add("plugins.docs", reason); return;
    }
  const retired = Object.entries(policy.retiredPlugins ?? {}).find(([,item])=>name===item.root || name.startsWith(item.root+"/"));
  if (retired) { add("plugins.inventory",reason);add("plugins.release-contract",`removed plugin ${retired[0]}: ${reason}`);return; }
  const artifact = names.find(item => name === policy.plugins[item].root || name.startsWith(policy.plugins[item].root + "/"));
    if (artifact) {
      add("plugins.inventory", reason);
      const rootName = policy.plugins[artifact].root;
      const relative = name.slice(rootName.length + 1);
      const kind = policy.plugins[artifact].kind;
      const manifestPath = path.join(root, rootName, "plugin.json");
      const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
      if (relative === "plugin.json" || status === "D" && name === rootName) {
        add("plugins.inventory", reason); add("plugins.release-contract", reason);
        for (const dimension of ["contract", "package", "adapter", "component", "frontend", "capability"])
          if (kind === "data-specialized" ? !["component", "frontend", "capability"].includes(dimension)
            : dimension !== "adapter" || artifact === "MaaFrameworkDriver")
            if (dimension !== "frontend" || manifest?.frontend) plugin(dimension, artifact, reason);
      } else if (/\.md$/i.test(relative)) {
        add("plugins.docs", reason); plugin("package", artifact, reason);
      } else if (relative === "store.json" || relative.startsWith("changelog")) {
        plugin("contract", artifact, reason); plugin("package", artifact, reason);
      } else if (kind === "data-specialized") {
        plugin("contract", artifact, reason); plugin("adapter", artifact, reason); plugin("package", artifact, reason);
      } else if (relative.startsWith("frontend/")) {
        plugin("frontend", artifact, reason); plugin("capability", artifact, reason);
      } else {
        plugin("contract", artifact, reason); plugin("component", artifact, reason); plugin("capability", artifact, reason); plugin("package", artifact, reason);
      }
      return;
    }
    if (!/\.(md|png|jpg|svg|webp)$/i.test(name)) {
      fullCore(`unknown shared input: ${reason}`);
      return;
    }
    add("plugins.docs", reason);
  };
  const fullCore = reason => {
    for (const gate of registry.gates) {
      if (["scope", "aggregate", "release"].includes(gate.kind)) continue;
      if (gate.kind === "matrix-template") {
        for (const artifact of names) {
          const kind = policy.plugins[artifact].kind;
          const dimension = gate.id.split(".").at(-1);
          const manifestFile = path.join(root, policy.plugins[artifact].root, "plugin.json");
          const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile,"utf8")) : null;
          if (kind === "data-specialized" ? ["contract","package","adapter"].includes(dimension)
            : (dimension !== "adapter" || artifact === "MaaFrameworkDriver") && (dimension !== "frontend" || manifest?.frontend))
            add(`${gate.id}:${artifact}`, reason);
        }
      } else add(gate.id,reason);
    }
  };
  if (!changes.length) fullCore("empty diff: conservative complete core");
  for (const change of changes) {
    for (const name of [change.old, change.path].filter(Boolean))
      classifyPlugins(normalize(name), change.status);
  }
  add(`${owner}.scope`, "always"); add(`${owner}.required`, "always");
  const declared = new Set(registry.gates.filter(gate => gate.kind !== "matrix-template").map(gate => gate.id));
  if (owner === "plugins") for (const gate of registry.gates.filter(gate => gate.kind === "matrix-template"))
    for (const artifact of names) declared.add(`${gate.id}:${artifact}`);
  for (const id of selected.keys()) if (!declared.has(id)) throw new Error(`Undeclared gate: ${id}`);
  return { selected: [...selected].sort().map(([id, reasons]) => ({ id, reasons: [...new Set(reasons)] })),
    notApplicable: [...declared].filter(id => !selected.has(id)).sort().map(id => ({ id, reason: "No affected input" })) };
}

export function createScopePlan(root, options = {}) {
  const { registry, digest } = readRegistry(root);
  const policy = JSON.parse(fs.readFileSync(path.join(root, "tests/policy.json"), "utf8"));
  const identity = collectChanges(root, options);
  const basePolicy = JSON.parse(git(root,["show",`${identity.baseSha}:tests/policy.json`]).toString("utf8"));
  policy.retiredPlugins = Object.fromEntries(Object.entries(basePolicy.plugins).filter(([name])=>!Object.hasOwn(policy.plugins,name)));
  let lockChanges = null;
  if (registry.repository === "Plugins" && identity.changes.some(item => item.path === "tests/inputs.lock.json" || item.old === "tests/inputs.lock.json")) {
    try {
      const before = JSON.parse(git(root, ["show", `${identity.baseSha}:tests/inputs.lock.json`]).toString("utf8"));
      const after = identity.dirty ? JSON.parse(fs.readFileSync(path.join(root, "tests/inputs.lock.json"), "utf8"))
        : JSON.parse(git(root, ["show", `${identity.headSha}:tests/inputs.lock.json`]).toString("utf8"));
      lockChanges = { host: JSON.stringify(before.host) !== JSON.stringify(after.host),
        maaFramework: JSON.stringify(before.maaFramework) !== JSON.stringify(after.maaFramework) };
    } catch { lockChanges = null; }
  }
  const routing = planForChanges(root, identity.changes, registry, policy, lockChanges);
  const controlManifest=readControlManifest(root);
  const batchIdentity = {...identity, partnerSha:options.partnerSha ?? null, controlManifest};
  const allocation = allocateUnits(coreUnits(routing.selected,registry,policy),batchIdentity,policy.ciBatchPolicy);
  return { schemaVersion: 2, repository: registry.repository, policyDigest: hash(JSON.stringify(controlManifest)), digestFormat: "utf8-lf-v1",
    ...identity, partnerSha: options.partnerSha ?? null, runId: options.runId ?? null, attempt: options.attempt ?? null,
    prNumber: options.prNumber ?? null, sourceFingerprint:sourceFingerprint(root), controlManifest, ...routing, ...allocation };
}
