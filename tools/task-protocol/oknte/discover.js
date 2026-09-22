function discover() {
  const plan = createPlan();
  if (!runtimeReady(plan)) return plan;
  const config = configOne(r => r.id === 'config:DailyRoutineTask.json');
  requireValue(object(config.document));
  const normalized = normalizeItems(config.document['Routine Items'], ADAPTER.entries);
  for (const item of normalized.items) {
    const entry = ADAPTER.entries.find(e => e.id === item.id);
    addTask(plan, config.id, item.id, entry.name, item.enabled,
      normalized.canPatchSelection ? ['Routine Items', { by: 'id', value: item.id }, 'enabled'] : null,
      normalized.canPatchSelection && item.id === 'daily_claim' ? 'safe' : 'unknown', 'limited');
  }
  for (const diagnostic of normalized.diagnostics) {
    plan.diagnostics.push({ code: diagnostic.code, message: 'Unrecognized routine item: ' + String(diagnostic.id) });
    if (diagnostic.id && !plan.tasks.some(t => t.sourceKey === diagnostic.id))
      addTask(plan, config.id, diagnostic.id, diagnostic.id, false, null, 'unknown', 'unsupported');
  }
  // Only the dedicated routine store governs child behavior. Standalone task pages
  // must not enter its behavior signature or receive retry selection patches.
  const stores = input.configResources.filter(r => r.id === 'config:DailyRoutineTaskConfigs.json');
  requireValue(stores.length <= 1);
  if (stores.length) {
    const store = configOne(r => r.id === stores[0].id);
    requireValue(object(store.document));
    for (const item of normalized.items.filter(i => i.enabled))
      behavior(plan, store, [item.id]);
  }
  if (!normalized.canPatchSelection) plan.diagnostics.push({ code: 'oknte.selection_not_patchable',
    message: 'Discovery includes upstream defaults. Selective retry requires every known item exactly once with an explicit boolean selection.' });
  plan.diagnostics.push({ code: 'oknte.business_evidence',
    message: 'Item results require an active daily scope and paired item logs. Launcher completion, framework completion and summary text are not item success.' });
  return plan;
}
