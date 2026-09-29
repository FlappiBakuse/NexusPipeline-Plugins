import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { collectChanges, planForChanges, readRegistry } from "./scope-plan.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { registry } = readRegistry(root);
const policy = JSON.parse(fs.readFileSync(path.join(root, "tests/policy.json"), "utf8"));
const ids = changes => planForChanges(root, changes, registry, policy).selected.map(item => item.id);
const change = name => [{ status: "M", path: name }];

test("plugin scope separates specialized behavior, package text and metadata", () => {
  const specialized = ids(change("plugins/specialized/BetterGI/data/editor.js"));
  assert.ok(specialized.includes("plugins.plugin.contract:BetterGI"));
  assert.ok(specialized.includes("plugins.plugin.adapter:BetterGI"));
  assert.ok(!specialized.some(id => id.endsWith(":GameCheckIn")));
  const readme = ids(change("plugins/general/GameCheckIn/README.md"));
  assert.ok(readme.includes("plugins.docs"));
  assert.ok(readme.includes("plugins.plugin.package:GameCheckIn"));
  assert.ok(!readme.some(id => id.includes(".component:") || id.includes(".capability:")));
  const metadata = ids(change("plugins/specialized/BetterGI/store.json"));
  assert.ok(metadata.includes("plugins.plugin.contract:BetterGI") && metadata.includes("plugins.plugin.package:BetterGI"));
  assert.ok(!metadata.some(id => id.includes(".adapter:")));
});

test("rename selects both plugin owners and manifest deletion retains inventory", () => {
  const renamed = ids([{ status: "R", old: "plugins/specialized/BetterGI/data/a.js", path: "plugins/specialized/BAAH/data/a.js" }]);
  assert.ok(renamed.includes("plugins.plugin.adapter:BetterGI"));
  assert.ok(renamed.includes("plugins.plugin.adapter:BAAH"));
  const deleted = ids([{ status: "D", path: "plugins/specialized/BetterGI/plugin.json" }]);
  assert.ok(deleted.includes("plugins.inventory") && deleted.includes("plugins.release-contract"));
});

test("publisher outputs select only release contract", () => {
  const selected = ids([...change("catalog.json"), ...change(".release-state.json"), ...change("packages/BetterGI/example.zip")]);
  assert.deepEqual(selected, ["plugins.release-contract", "plugins.required", "plugins.scope"]);
});

test("scope disposition contains only executable gates", () => {
  const plan = planForChanges(root, change("docs/TESTING.md"), registry, policy);
  const actual = new Set([...plan.selected, ...plan.notApplicable].map(item => item.id));
  const expected = new Set(registry.gates.filter(gate => gate.kind !== "matrix-template").map(gate => gate.id));
  for (const gate of registry.gates.filter(gate => gate.kind === "matrix-template"))
    for (const artifact of Object.keys(policy.plugins)) expected.add(`${gate.id}:${artifact}`);
  assert.deepEqual(actual, expected);
});

test("locked native input selects only Maa adapter while Host identity reaches its consumers", () => {
  const changed = change("tests/inputs.lock.json");
  const native = planForChanges(root, changed, registry, policy,
    { host: false, maaFramework: true }).selected.map(item => item.id);
  assert.ok(native.includes("plugins.plugin.adapter:MaaFrameworkDriver"));
  assert.ok(!native.some(id => id.endsWith(":GameCheckIn")));
  const host = planForChanges(root, changed, registry, policy,
    { host: true, maaFramework: false }).selected.map(item => item.id);
  assert.ok(host.includes("plugins.plugin.component:GameCheckIn"));
  assert.ok(host.includes("plugins.plugin.adapter:BetterGI"));
});

test("real git fixture reports rename, deletion and dirty input", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(process.env.NEXUS_TEST_ARTIFACT_ROOT || os.tmpdir(), "plugins-scope-"));
  const git = (...args) => execFileSync("git", ["-C", fixtureRoot, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "-q"); git("config", "user.name", "Scope Test"); git("config", "user.email", "scope@example.invalid");
    fs.writeFileSync(path.join(fixtureRoot, "old.json"), "{\"identity\":\"renamed\"}\n");
    fs.writeFileSync(path.join(fixtureRoot, "gone.json"), "{\"identity\":\"removed\"}\n");
    git("add", "."); git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    git("mv", "old.json", "new.json"); git("rm", "gone.json"); git("commit", "-qm", "change");
    fs.writeFileSync(path.join(fixtureRoot, "untracked.json"), "{}\n");
    const plan = collectChanges(fixtureRoot, { base, includeWorkingTree: true });
    assert.equal(plan.mergeBase, base);
    assert.equal(plan.dirty, true);
    assert.ok(plan.changes.some(item => item.old === "old.json" && item.path === "new.json"));
    assert.ok(plan.changes.some(item => item.status === "D" && item.path === "gone.json"));
    assert.ok(plan.changes.some(item => item.untracked));
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
});

const selectionCases = JSON.parse(fs.readFileSync(path.join(root, "tests/selection-cases.json"), "utf8")).cases;
const matches = (id, expected) => new RegExp(`^${expected.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*")}$`).test(id);
for (const scenario of selectionCases) {
  test(`${scenario.id} ${scenario.reason}`, () => {
    const changes = scenario.changes.map(input => typeof input === "string" ? { status: "M", path: input }
      : { status: input.status, old: input.old, path: input.new ?? input.path });
    const selected = ids(changes);
    for (const expected of scenario.mustInclude)
      assert.ok(selected.some(id => matches(id, expected)), `${scenario.id}: missing ${expected}`);
    for (const excluded of scenario.mustExclude)
      assert.ok(!selected.some(id => matches(id, excluded)), `${scenario.id}: unexpectedly selected ${excluded}`);
  });
}
