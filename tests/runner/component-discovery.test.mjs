import test from "node:test";
import assert from "node:assert/strict";
import {discoverCases} from "./component-discovery.mjs";
import fs from "node:fs";
import path from "node:path";
import {validateInventory} from "./selection.mjs";
test("native discovery preserves every theory instance before execution",()=>{
  const methods=["Namespace.Tests.Theory","Namespace.Tests.Fact"];
  assert.deepEqual(discoverCases("Discovered:\n    Namespace.Tests.Theory(value: 1)\n    Namespace.Tests.Theory(value: 2)\n    Namespace.Tests.Fact",methods),["Namespace.Tests.Fact","Namespace.Tests.Theory(value: 1)","Namespace.Tests.Theory(value: 2)"]);
});
test("empty, duplicate and wrong discovery methods fail closed",()=>{
  for(const input of ["", "Namespace.Tests.Fact\nNamespace.Tests.Fact", "Namespace.Tests.Other"])
    assert.throws(()=>discoverCases(input,["Namespace.Tests.Fact"]));
});
test("case-colliding policy identities fail before inventory execution",()=>{
  const root=path.resolve(import.meta.dirname,"../..");
  const policy=JSON.parse(fs.readFileSync(path.join(root,"tests/policy.json")));
  policy.plugins.bettergi=policy.plugins.BetterGI;
  assert.throws(()=>validateInventory(root,policy),/Case-colliding/);
});
