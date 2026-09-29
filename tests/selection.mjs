import fs from "node:fs";
import path from "node:path";
import { collectChanges, planForChanges, readRegistry } from "./scope-plan.mjs";

export function parseArguments(args, policy) {
  const [command, ...rest] = args;
  if (!["plugin", "daily", "list"].includes(command)) throw new Error("Unknown command");
  const options = {};
  const flags = new Set(["--changed", "--all-core", "--json"]);
  const values = new Set(["--plugin", "--profile", "--host-root", "--base"]);
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index];
    if (Object.hasOwn(options, key) || (!flags.has(key) && !values.has(key))) throw new Error("Unknown or duplicate option");
    if (flags.has(key)) options[key] = true;
    else {
      const value = rest[++index];
      if (!value || value.startsWith("--")) throw new Error("Missing option value");
      options[key] = value;
    }
  }
  if (command === "list") {
    if (Object.keys(options).length !== 1 || !options["--json"]) throw new Error("Use list --json");
    return { command };
  }
  if (!options["--host-root"] || options["--json"]) throw new Error("Explicit --host-root required");
  if (command === "plugin") {
    if (!Object.hasOwn(policy.plugins, options["--plugin"] ?? "") || options["--changed"] || options["--all-core"] || options["--base"])
      throw new Error("Known single plugin required");
    const plugin = policy.plugins[options["--plugin"]];
    if (options["--profile"] && !Object.hasOwn(plugin.profiles, options["--profile"])) throw new Error("Unregistered profile");
  } else if (Boolean(options["--changed"]) === Boolean(options["--all-core"])
      || options["--plugin"] || options["--profile"] || (options["--changed"] && !/^[a-f0-9]{40}$/.test(options["--base"] ?? ""))
      || (options["--all-core"] && options["--base"])) throw new Error("Use daily --changed --base <full SHA> or --all-core");
  return { command, options };
}

export function selectPaths(paths, policy) {
  if (!paths.length) throw new Error("Empty change set");
  const root = path.resolve(import.meta.dirname, "..");
  const { registry } = readRegistry(root);
  const planned = planForChanges(root, paths.map(value => ({ status: "M", path: value })), registry, policy);
  const selected = [...new Set(planned.selected.flatMap(item => {
    const match = item.id.match(/^plugins\.plugin\.[^:]+:(.+)$/);
    return match ? [match[1]] : [];
  }))].sort();
  return { selected, reason: selected.length ? "affected plugin gates" : "no plugin runtime gate" };
}

export function selectChanged(root, base, policy, budget) {
  budget.check?.();
  const { registry } = readRegistry(root);
  const identity = collectChanges(root, { base, includeWorkingTree: true });
  if (!identity.changes.length) throw new Error("Empty change set");
  const planned = planForChanges(root, identity.changes, registry, policy);
  const selected = [...new Set(planned.selected.flatMap(item => {
    const match = item.id.match(/^plugins\.plugin\.[^:]+:(.+)$/);
    return match ? [match[1]] : [];
  }))].sort();
  return { selected, reason: selected.length ? "affected plugin gates" : "no plugin runtime gate" };
}

export function validateInventory(root, policy) {
  if (policy.invocationBudgetMs !== 180000 || policy.qualificationMs !== 150000 || policy.cleanupReserveMs < 10000
      || policy.cleanupReserveMs > 20000 || policy.pluginCleanupReserveMs !== 5000)
    throw new Error("Unregistered invocation or cleanup budget");
  const actual = [];
  for (const kind of ["general", "specialized"])
    for (const entry of fs.readdirSync(path.join(root, "plugins", kind), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugins", kind, entry.name, "plugin.json"), "utf8"));
      const item = policy.plugins[manifest.artifactName];
      if (!item || item.root !== `plugins/${kind}/${entry.name}`) throw new Error("Plugin inventory differs from test policy");
      const profiles = manifest.kind === "data-specialized" || manifest.artifactName === "MaaFrameworkDriver"
        ? { core: 150000, adapter: 150000 } : { core: 150000 };
      if (item.kind !== manifest.kind || Object.keys(item.profiles).length !== Object.keys(profiles).length
          || Object.entries(profiles).some(([name, limit]) => item.profiles[name] !== limit)
          || !Object.hasOwn(profiles, item.defaultProfile)) throw new Error("Unregistered plugin budget profile");
      const cases = manifest.kind === "data-specialized" ? item.fixtureIds : item.expectedMethods;
      if (!Array.isArray(cases) || !cases.length || new Set(cases).size !== cases.length)
        throw new Error("Empty or duplicate case policy");
      actual.push(manifest.artifactName);
    }
  if (actual.length !== Object.keys(policy.plugins).length || new Set(actual).size !== actual.length) throw new Error("Incomplete plugin inventory");
}
