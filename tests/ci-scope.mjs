import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { selectChanged, validateInventory } from "./selection.mjs";
const root = process.cwd(), policy = JSON.parse(fs.readFileSync("tests/policy.json"));
const start = performance.now();
validateInventory(root, policy);
const selection = selectChanged(root, process.env.PR_BASE_SHA, policy, { remainingMs: () => Math.max(1, 15000 - (performance.now() - start)) });
const lock = JSON.parse(fs.readFileSync("tests/inputs.lock.json")).host;
if (selection.selected.length && (lock.repository !== "FlappiBakuse/NexusPipeline" || !/^[a-f0-9]{40}$/.test(lock.commitSha ?? "")))
  throw new Error("A real merged Host implementation SHA must be locked before CI activation");
const sha = execFileSync("git", ["rev-parse","HEAD"], { encoding: "utf8", timeout: 2000 }).trim();
const scope = { ...selection, sha, hostSha: lock.commitSha, run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT };
fs.writeFileSync(process.env.SCOPE_RESULT, JSON.stringify(scope, null, 2));
fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({plugin: selection.selected})}\ncount=${selection.selected.length}\nhostSha=${lock.commitSha ?? ""}\n`);
