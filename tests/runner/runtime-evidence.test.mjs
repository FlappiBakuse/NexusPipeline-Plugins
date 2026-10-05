import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {collectRuntimeResult} from "./batch-runner.mjs";
test("failed runtime evidence survives while a subsequent unexecuted unit remains NOT_RUN", () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"runtime-evidence-"));
 try {
  const source=path.join(root,"source/First");fs.mkdirSync(source,{recursive:true});fs.writeFileSync(path.join(source,"summary.json"),JSON.stringify({status:"FAIL",exitCode:6}));
  const core={runRoot:path.join(root,"source"),reports:[{plugin:"First",status:"FAIL",exitCode:6,completedCaseIds:["verified-case"],boundaries:{real:["owned runtime"],substituted:[]}}]};
  const unit={id:"plugins.runtime:First",artifact:"First",provides:["plugins.plugin.capability:First"],pluginKind:"managed-code"};
  const failed=collectRuntimeResult(unit,core,path.join(root,"output"));assert.equal(failed.status,"FAIL");assert.equal(failed.exitCode,6);assert.deepEqual(failed.completedCaseIds,["verified-case"]);assert.equal(failed.rawEvidence.length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,"output",failed.rawEvidence[0]))),{status:"FAIL",exitCode:6});
  const next=collectRuntimeResult({...unit,id:"plugins.runtime:Next",artifact:"Next"},core,path.join(root,"output"));assert.equal(next.status,"NOT_RUN");assert.equal(next.exitCode,4);assert.deepEqual(next.rawEvidence,[]);assert.deepEqual(next.completedCaseIds,[]);
 } finally {fs.rmSync(root,{recursive:true});}
});
test("a claimed executed runtime with missing raw directory fails", () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"runtime-evidence-"));
 try {assert.throws(()=>collectRuntimeResult({id:"plugins.runtime:Missing",artifact:"Missing",provides:[],pluginKind:"managed-code"},{runRoot:root,reports:[{plugin:"Missing",status:"PASS",exitCode:0,boundaries:{real:[],substituted:[]}}]},path.join(root,"output")),{code:"ENOENT"});}
 finally {fs.rmSync(root,{recursive:true});}
});
