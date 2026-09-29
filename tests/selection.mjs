import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
  const names = Object.keys(policy.plugins).sort();
  const selected = new Set();
  for (const entry of paths) {
    const value = entry.replaceAll("\\", "/");
    const name = names.find(name => value.startsWith(policy.plugins[name].root + "/"));
    if (name) selected.add(name);
    else if (!/^(docs\/.*\.md|README\.md|CONTRIBUTING\.md|CHANGELOG\.md)$/.test(value))
      return { selected: names, reason: "shared, removed, renamed or unknown input" };
  }
  return { selected: [...selected].sort(), reason: selected.size ? "changed plugin inputs" : "documentation-only changes" };
}

export function selectChanged(root, base, policy, budget) {
  const git = args => execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8", windowsHide: true, timeout: Math.max(1, Math.floor(budget.remainingMs())), maxBuffer: 16 * 1024 * 1024,
  });
  const ancestor = git(["merge-base", base, "HEAD"]).trim();
  if (ancestor !== base) throw new Error("Base must be an ancestor of HEAD");
  const paths = [...git(["diff", "--name-only", "--no-renames", "-z", base, "--"]).split("\0"),
    ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0")].filter(Boolean);
  return selectPaths([...new Set(paths)], policy);
}

export function validateInventory(root, policy) {
  if (policy.invocationBudgetMs !== 180000 || policy.cleanupReserveMs < 10000
      || policy.cleanupReserveMs > 20000 || policy.pluginCleanupReserveMs !== 2000)
    throw new Error("Unregistered invocation or cleanup budget");
  const actual = [];
  for (const kind of ["general", "specialized"])
    for (const entry of fs.readdirSync(path.join(root, "plugins", kind), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugins", kind, entry.name, "plugin.json"), "utf8"));
      const item = policy.plugins[manifest.artifactName];
      if (!item || item.root !== `plugins/${kind}/${entry.name}`) throw new Error("Plugin inventory differs from test policy");
      const profiles = manifest.artifactName === "MaaFrameworkDriver" ? { core: 30000, adapter: 120000 }
        : manifest.kind === "data-specialized" ? { core: 30000, adapter: 60000 } : { core: 30000 };
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
