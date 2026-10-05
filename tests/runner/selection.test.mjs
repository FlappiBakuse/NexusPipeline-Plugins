import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseArguments, selectPaths, validateInventory } from "./selection.mjs";

const policy = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url)));
test("changed plugin is exclusive; unknown runtime inputs conservatively select every plugin", () => {
  assert.deepEqual(selectPaths(["plugins/general/GameCheckIn/src/HoyoLabClient.cs"], policy).selected, ["GameCheckIn"]);
  for (const input of ["tools/verification.py", "plugins/general/Removed/plugin.json", "unknown.py"])
    assert.deepEqual(selectPaths([input], policy).selected, Object.keys(policy.plugins).sort());
  assert.deepEqual(selectPaths(["tests/run.mjs"], policy).selected, []);
  assert.deepEqual(selectPaths(["docs/README.md", "CONTRIBUTING.md"], policy).selected, []);
  assert.throws(() => selectPaths([], policy));
});
test("CLI rejects malformed selection and unregistered budget profiles", () => {
  for (const args of [[], ["daily", "--all-core", "--changed", "--host-root", "host"],
    ["plugin", "--plugin", "GameCheckIn", "--profile", "adapter", "--host-root", "host"],
    ["plugin", "--plugin", "GameCheckIn", "--host-root", "host", "--plugin", "BAAH"],
    ["daily", "--changed", "--base", "main", "--host-root", "host"], ["list", "--json", "--json"]])
    assert.throws(() => parseArguments(args, policy));
  assert.equal(parseArguments(["plugin", "--plugin", "EmulatorSupport", "--host-root", "host"], policy).command, "plugin");
});
test("policy exactly matches current plugin inventory", () => {
  validateInventory(new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), policy);
  assert.equal(policy.plugins.EmulatorSupport.profiles.core, 150000);
  assert.equal(policy.plugins.MaaFrameworkDriver.profiles.adapter, 150000);
});
test("policy cannot silently increase budgets or accept zero cases", () => {
  const root = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  for (const mutate of [value => value.invocationBudgetMs = 180001,
    value => value.qualificationMs = 150001,
    value => value.plugins.GameCheckIn.profiles.core = 150001,
    value => value.plugins.BAAH.fixtureIds = [],
    value => value.plugins.MaaFrameworkDriver.profiles.adapter = 180000]) {
    const invalid = structuredClone(policy); mutate(invalid);
    assert.throws(() => validateInventory(root, invalid));
  }
});
