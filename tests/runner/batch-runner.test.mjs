import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createScopePlan} from "./scope-plan.mjs";
import {loadBatch} from "./batch-runner.mjs";
const root=path.resolve(import.meta.dirname,"../..");
const host=JSON.parse(fs.readFileSync(path.join(root,"tests/gates.json"))).repository==="Host";
test("workflow exposes one bounded matrix and keeps control free of dotnet setup",()=>{
  const workflow=fs.readFileSync(path.join(root,".github/workflows/ci.yml"),"utf8").replaceAll("\r\n","\n");
  const jobs=[...workflow.slice(workflow.indexOf("jobs:\n")).matchAll(/^  ([a-z_]+):$/gm)].map(match=>match[1]);
  assert.deepEqual(jobs,["scope","control","batches","required"]);
  assert.equal([...workflow.matchAll(/^    strategy:$/gm)].length,1);
  assert.equal([...workflow.matchAll(/^    timeout-minutes:/gm)].length,0);
  const control=workflow.slice(workflow.indexOf("  control:"),workflow.indexOf("  batches:"));
  assert.ok(!control.includes("setup-dotnet"));
  assert.ok(workflow.includes("needs: [scope, control, batches]"));
  const policy=JSON.parse(fs.readFileSync(path.join(root,"tests/policy.json")));
  assert.equal(policy.ciBatchPolicy.workMs,null);
});
test("altered units, fingerprints, capacity and control manifests fail before work",()=>{
  const temporary=fs.mkdtempSync(path.join(process.env.NEXUS_TEST_ARTIFACT_ROOT||os.tmpdir(),"batch-input-"));
  const file=path.join(temporary,"plan.json");
  const partner=host?path.resolve(root,"../NexusPipeline-Plugins"):null;
  const base=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const original=createScopePlan(root,{base,includeWorkingTree:true,...(partner?{partnerRoot:partner}:{})});
  const batch=original.control.units.length?"control":original.batches[0]?.id;
  const args=["--plan",file,"--batch",batch,...(partner?["--partner-root",partner]:[])];
  try {
    fs.writeFileSync(file,JSON.stringify(original));loadBatch(root,args);
    for(const alter of [plan=>plan.units[0].provides.push("invented"),plan=>plan.controlManifest.pop(),plan=>plan.sourceFingerprint="0".repeat(64),
      plan=>plan.capacityStatus="CAPACITY_EXCEEDED",plan=>plan.batches.push({id:"batch-06",units:[]}),plan=>plan.selected.pop()]) {
      const plan=structuredClone(original);alter(plan);fs.writeFileSync(file,JSON.stringify(plan));
      assert.throws(()=>loadBatch(root,args));
    }
  } finally {fs.rmSync(temporary,{recursive:true});}
});
