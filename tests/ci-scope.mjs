import fs from "node:fs";
import path from "node:path";
import { createScopePlan, readRegistry } from "./scope-plan.mjs";

const root = path.resolve(import.meta.dirname, "..");
const base = process.env.PR_BASE_SHA;
const head = process.env.PR_HEAD_SHA;
if (!/^[a-f0-9]{40}$/.test(base ?? "") || !/^[a-f0-9]{40}$/.test(head ?? "")
    || !process.env.SCOPE_RESULT || !process.env.GITHUB_OUTPUT) throw new Error("Complete PR identity and output paths are required");
const policy = JSON.parse(fs.readFileSync(path.join(root, "tests/policy.json"), "utf8"));
const hostLock = JSON.parse(fs.readFileSync(path.join(root, "tests/inputs.lock.json"), "utf8")).host;
if (hostLock.repository !== "FlappiBakuse/NexusPipeline" || !/^[a-f0-9]{40}$/.test(hostLock.commitSha ?? ""))
  throw new Error("Fixed Host test input is missing");
const plan = createScopePlan(root, { base, head, partnerSha: hostLock.commitSha,
  runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT });
const { registry } = readRegistry(root);
const names = new Map(registry.gates.map(gate => [gate.id, gate.name]));
const active = plan.selected.filter(item => !["plugins.scope", "plugins.required"].includes(item.id));
const matrix = { include: active.map(item => {
  const [gateId, artifact] = item.id.split(":");
  if (artifact && !Object.hasOwn(policy.plugins, artifact)) throw new Error(`Unregistered plugin: ${artifact}`);
  const template = names.get(gateId);
  if (!template) throw new Error(`Unregistered gate: ${item.id}`);
  return { id: item.id, key: item.id.replaceAll(/[.:]/g, "-"), name: template.replace("${artifact}", artifact ?? ""),
    partnerRequired: registry.gates.find(gate => gate.id === gateId).partnerRequired };
}) };
fs.mkdirSync(path.dirname(path.resolve(process.env.SCOPE_RESULT)), { recursive: true });
fs.writeFileSync(process.env.SCOPE_RESULT, JSON.stringify(plan, null, 2) + "\n");
fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\ncount=${matrix.include.length}\nhostSha=${hostLock.commitSha}\n`);
