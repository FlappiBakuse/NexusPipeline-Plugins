import fs from "node:fs";
import path from "node:path";
import { parseArguments, validateInventory } from "./selection.mjs";
import { runScopeCommand } from "./scope-cli.mjs";
import { runPluginGate } from "./gate-runner.mjs";

import {runPluginCore} from "./plugin-core.mjs";
import {runBatch} from "./batch-runner.mjs";

const root = path.resolve(import.meta.dirname, "..");
if (process.argv[2] === "plan") {
  try { runScopeCommand(root, process.argv.slice(3)); process.exit(0); }
  catch (error) { console.error(error.stack || error.message); process.exit(2); }
}
if (process.argv[2] === "gate") {
  if (process.argv.length !== 7 || process.argv[3] !== "--id" || process.argv[5] !== "--host-root")
    throw new Error("Usage: node tests/run.mjs gate --id <gateId> --host-root <fixed Host checkout>");
  try { process.exit(await runPluginGate(process.argv[4], path.resolve(process.argv[6]))); }
  catch (error) { console.error(error.stack || error.message); process.exit(1); }
}
if(process.argv[2]==="batch") {
  try {process.exitCode=await runBatch(root,process.argv.slice(3));}
  catch(error) {console.error(error.stack||error.message);process.exitCode=error.exitCode??1;}
} else {
const policyBytes = fs.readFileSync(path.join(root, "tests/policy.json"));
const policy = JSON.parse(policyBytes);
let input;
try { input = parseArguments(process.argv.slice(2), policy); validateInventory(root, policy); }
catch (error) { console.error(error.message); process.exit(2); }
if (input.command === "list") { console.log(JSON.stringify(policy, null, 2)); process.exit(0); }
process.exitCode=(await runPluginCore({root,policyBytes,input})).code;
}
