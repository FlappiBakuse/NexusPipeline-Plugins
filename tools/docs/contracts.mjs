import fs from "node:fs";
import path from "node:path";

export function repositoryPath(root, base, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative))
    throw new Error(`Invalid repository path: ${relative}`);
  const target = path.resolve(root, base, relative);
  const inside = value => { const name = path.relative(fs.realpathSync(root), value); return name !== ".." && !name.startsWith(".." + path.sep) && !path.isAbsolute(name); };
  if (!inside(target) || !fs.existsSync(target) || !inside(fs.realpathSync(target)))
    throw new Error(`Missing/outside repository path: ${relative}`);
  return target;
}

export function checkContracts(root) {
  const results = [];
  const read = file => fs.readFileSync(repositoryPath(root, "", file), "utf8");
  try {
    const lock = JSON.parse(read("host.lock.json"));
    if (![lock.hostApiVersion, lock.frontendApiVersion].every(value => /^\d+\.\d+$/.test(value)))
      throw new Error("Cannot extract host.lock.json API facts");
    const file = "docs/author/FRONTEND_PLUGIN.md", text = read(file);
    for (const [expression, expected] of [
      [/^# Frontend API ([\d.]+) 插件指南$/gm, lock.frontendApiVersion],
      [/当前 Plugin API 精确为 ([\d.]+)/g, lock.hostApiVersion],
      [/Frontend API 只接受精确版本 `([\d.]+)`/g, lock.frontendApiVersion],
    ]) {
      const matches = [...text.matchAll(expression)];
      results.push(matches.length !== 1
        ? { rule: "GOV-DOC-01", status: "REVIEW", file, expected, reason: "Designated current claim is ambiguous/missing; inspect its wording" }
        : { rule: "GOV-DOC-01", status: matches[0][1] === expected ? "PASS" : "FAIL", file,
          line: text.slice(0, matches[0].index).split("\n").length, actual: matches[0][1], expected });
    }
    const examples = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
    const manifests = examples.map(match => JSON.parse(match[1])).filter(value => value.kind === "managed-code");
    if (manifests.length !== 1) throw new Error("Cannot extract unique managed manifest example");
    for (const [actual, expected] of [[manifests[0].apiVersion, lock.hostApiVersion], [manifests[0].frontend?.apiVersion, lock.frontendApiVersion]])
      results.push({ rule: "GOV-DOC-01", status: actual === expected ? "PASS" : "FAIL", file, actual, expected, reason: "Current manifest example" });
  } catch (error) {
    results.push({ rule: "GOV-DOC-01", status: "NOT_CHECKED", reason: error.message });
  }
  return results;
}
