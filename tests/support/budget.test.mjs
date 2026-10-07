import test from "node:test";
import assert from "node:assert/strict";
import {Budget} from "./budget.mjs";
test("nested cleanup preserves the original130 work/150 qualification/180 hard deadlines",()=>{
 let time=0;const root=new Budget("batch",180000,{reserveMs:50000,qualificationMs:150000,clock:()=>time});time=120000;const child=root.child("plugin",150000,5000);assert.equal(child.remainingMs(),10000);time=130000;assert.equal(child.remainingMs(),0);assert.throws(()=>child.child("late",10000));assert.equal(child.remainingMs({cleanup:true}),50000);time=150000;child.assertWithinBudget();time=150001;assert.throws(()=>child.assertWithinBudget());time=180000;assert.equal(child.remainingMs({cleanup:true}),0);
});
test("short child limits still cap cleanup before the parent hard deadline",()=>{
 let time=0;const root=new Budget("batch",180000,{reserveMs:50000,qualificationMs:150000,clock:()=>time});time=100000;const child=root.child("short",20000,5000);time=115000;assert.equal(child.remainingMs(),0);assert.equal(child.remainingMs({cleanup:true}),5000);time=120000;assert.equal(child.remainingMs({cleanup:true}),0);
});

test("unlimited timing records elapsed work and imposes no child deadline",()=>{
 let time=0;const root=new Budget("invocation",null,{clock:()=>time});
 const child=root.child("desktop",null);time=3_600_000;
 assert.equal(root.elapsedMs,3_600_000);assert.equal(child.remainingMs(),Infinity);
 root.check();child.assertWithinBudget();
});

test("unlimited command preserves the real child result past a supplied execution timeout",async()=>{
 const {runProcess}=await import("./process-runner.mjs");
 assert.equal(await runProcess(process.execPath,["-e","setTimeout(()=>process.exit(7),40)"],{
  budget:new Budget("desktop build",null),timeoutMs:1
 }),7);
});
