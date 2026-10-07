import { createHash } from "node:crypto";

export const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unique = values => [...new Set(values)].sort();
const controlKinds = new Set(["docs", "contract", "architecture"]);

export function coreUnits(selected, registry, policy) {
  const units = new Map();
  function unit(id, kind, obligation, details = {}) {
    if (!units.has(id)) units.set(id, { id, kind, provides: [], expectedCaseIds: [], expectedMethodIds: [],
      expectedScenarioIds: [], expectedEditorCaseIds: [], preparations: [], groups: [], ...details });
    const item = units.get(id);
    item.provides.push(obligation);
    return item;
  }
  for (const { id } of selected) {
    const [template, artifact] = id.split(":");
    const gate = registry.gates.find(item => item.id === template);
    if (!gate) throw new Error(`Unregistered obligation: ${id}`);
    if (["scope", "aggregate", "release"].includes(gate.kind)) continue;
    if (id.startsWith("host.backend.")) {
      const group = id.slice(5), expected = policy.groups[group];
      if (!expected?.caseIds?.length) throw new Error(`Missing expected cases: ${id}`);
      const item = unit("host.backend", "backend", id);
      item.groups.push(group);
      item.expectedCaseIds.push(...expected.caseIds);
      item.expectedScenarioIds.push(...expected.scenarioIds);
      item.preparations.push("host.backend.test-build");
    } else if (id.startsWith("host.frontend.")) {
      const item = unit("host.frontend", "frontend", id);
      item.preparations.push("host.frontend.dependencies");
      if (id === "host.frontend.state") {
        item.expectedCaseIds.push(...policy.groups.frontend.caseIds);
        item.expectedScenarioIds.push(...policy.groups.frontend.scenarioIds);
      }
    } else if (artifact) {
      const plugin = policy.plugins[artifact];
      if (!plugin) throw new Error(`Unregistered plugin: ${artifact}`);
      const dimension = template.split(".").at(-1);
      const runtime = ["component", "frontend", "capability", "adapter"].includes(dimension);
      const item = unit(dimension === "contract" ? "plugins.inventory" : runtime ? `plugins.runtime:${artifact}` : id,
        runtime ? "plugin" : "gate", id, dimension === "contract" ? {control:true} : { artifact, pluginKind: plugin.kind });
      if (dimension === "contract") item.preparations.push("plugins.source-validation");
      if (runtime && plugin.kind === "data-specialized") {
        item.expectedCaseIds.push(...plugin.fixtureIds);
        item.observationFixtureId = plugin.fixtureIds[0];
        item.expectedScenarioIds.push(plugin.realScenario);
        item.preparations.push("host.jint.test-build");
        if (["BetterGI", "ZenlessZoneZeroOneDragon", "MaaStellaSora"].includes(artifact))
          item.expectedEditorCaseIds.push(`${artifact}.editor-select-and-preserve`, `${artifact}.editor-repeat`);
        item.observeCount = 12;
        item.isolatedRunRequired = true;
      } else if (runtime) {
        if (["component", "capability", "adapter"].includes(dimension)) {
          item.expectedMethodIds.push(...plugin.expectedMethods);
          item.preparations.push(`plugin.component:${artifact}`);
        }
        if (["capability", "adapter"].includes(dimension)) {
          item.expectedScenarioIds.push(plugin.realScenario);
          item.preparations.push("host.runtime.test-build");
          if (artifact === "MaaFrameworkDriver") item.preparations.push("maa.native");
          else if (artifact !== "EmulatorSupport") item.preparations.push("host.browser", "host.frontend.dependencies");
        }
        if (["frontend", "capability"].includes(dimension)) item.preparations.push(`plugin.frontend:${artifact}`);
      } else if (dimension === "package" && plugin.kind === "managed-code") {
        item.preparations.push(`plugin.production-package:${artifact}`);
      }
    } else {
      const item = unit(id, "gate", id);
      item.control = controlKinds.has(gate.kind) && !id.includes("architecture") && !gate.partnerRequired;
      if (id === "plugins.inventory") item.control = true;
      item.preparations.push(id.startsWith("host.integration.") || id === "host.build.test-host"
        ? "host.runtime.test-build" : "source");
    }
  }
  for (const item of units.values()) {
    for (const field of ["provides", "expectedCaseIds", "expectedMethodIds", "expectedScenarioIds", "expectedEditorCaseIds", "preparations", "groups"])
      item[field] = unique(item[field]);
    item.replacementEvidence = item.provides.length > 1 ? {
      input: "same source/partner/policy/toolchain/build mode within one batch",
      obligations: item.provides, raw: item.kind === "backend" ? "TRX union of policy case IDs"
        : item.kind === "frontend" ? "Vitest policy cases plus typecheck/build receipts"
        : "one TRX discovery/instance set, build receipts and per-plugin capability/trajectory evidence",
    } : null;
  }
  const result = [...units.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const obligations = result.flatMap(item => item.provides);
  if (new Set(obligations).size !== obligations.length) throw new Error("Duplicate obligation provider");
  return result;
}

export function allocateUnits(units, identity, limits = {}) {
  if (limits.workMs !== undefined && limits.workMs !== null) throw new Error("Execution time caps are disabled");
  const prepareCost = name => limits.preparationMs?.[name] ?? (name === "source" ? 500 : 10000);
  const executionCost = unit => limits.unitMs?.[unit.id] ?? (unit.kind === "plugin" ? unit.artifact === "MaaFrameworkDriver" ? 45000
    : unit.pluginKind === "data-specialized" ? 6000 : 15000 : unit.kind === "backend" ? 6000 : unit.kind === "frontend" ? 8000
    : unit.id.endsWith("schedule") ? 70000 : unit.id.includes("integration") ? 30000 : unit.id.includes("architecture") ? 30000 : 10000);
  const enriched = units.map(unit => ({ ...unit, estimatedMs: executionCost(unit),
    prepareKey: digest({ identity, preparations: unit.preparations, mode: "explicit production/test build keys" }) }))
    .sort((a,b) => a.id.localeCompare(b.id,"en"));
  const control = enriched.filter(unit => unit.control);
  const batches = [];
  const cost = items => items.reduce((sum, item) => sum + item.estimatedMs, 0)
    + unique(items.flatMap(item => item.preparations)).reduce((sum, name) => sum + prepareCost(name), 0);
  const unplaced = [];
  const lane = unit => unit.pluginKind === "data-specialized" ? "specialized"
    : unit.artifact === "MaaFrameworkDriver" ? "native"
    : unit.pluginKind === "managed-code" || unit.kind === "plugin" ? "managed"
    : ["host.integration.desktop","host.integration.restart-update","host.integration.store"].includes(unit.id) ? "desktop"
    : unit.kind === "frontend" || unit.id === "host.architecture.frontend" ? "frontend" : "backend";
  const groups = new Map();
  for (const unit of enriched.filter(unit => !unit.control)) {
    if (!Number.isSafeInteger(unit.estimatedMs) || unit.estimatedMs <= 0) throw new Error("Missing positive unit cost");
    const name = lane(unit);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(unit);
  }
  for (const [, items] of [...groups].sort(([a],[b]) => a.localeCompare(b,"en")))
    batches.push({id:"batch-"+String(batches.length+1).padStart(2,"0"),units:items,estimatedMs:cost(items)});
  for (const batch of batches) batch.units.sort((a,b) => a.id.localeCompare(b.id,"en"));
  return {control: {id:"control",units:control,estimatedMs:cost(control)}, batches,
    requiredObligations: unique(units.flatMap(unit => unit.provides)), units:enriched,
    estimatedTotalJobs: 5 + batches.length, unplacedUnits:unplaced,
    capacityStatus: "PLANNED",
    costBasis:"observational estimates; preparation lanes have no execution time cap"};
}
