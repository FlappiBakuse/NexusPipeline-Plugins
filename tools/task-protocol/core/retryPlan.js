function retryPlan(discover) {
  const stop = reason => ({ protocolVersion: ADAPTER.protocolVersion, type: 'retry', decision: 'stop', reasonCode: reason,
    includedTaskIds: [], prerequisiteTaskIds: [], expandedUnitIds: [], filePatches: [] });
  if (input.cancelled || input.budgetExhausted || input.attemptsUsed >= input.maxAttempts) return stop('retry.budget_exhausted');
  const tasks = input.originalPlan.tasks, candidates = tasks.filter(t => t.enabled && ['failed', 'blocked'].includes(input.taskStates[t.id]));
  if (!candidates.length) return stop('retry.no_verified_candidate');
  const selected = new Set();
  const prerequisites = new Set(), expanded = new Set();
  for (const candidate of candidates) {
    const unitSelection = new Set([candidate.id]), unitPrerequisites = new Set(), unitExpanded = new Set();
    let changed = true;
    while (changed) {
      const count = unitSelection.size;
      for (const id of Array.from(unitSelection)) {
        const task = tasks.find(t => t.id === id); requireValue(task);
        const unit = tasks.filter(t => t.enabled && t.retryUnitId === task.retryUnitId).map(t => t.id).concat(task.retryUnitId);
        if (unit.some(id => !unitSelection.has(id))) unitExpanded.add(task.retryUnitId);
        unit.forEach(id => unitSelection.add(id)); task.dependencies.forEach(id => { unitSelection.add(id); unitPrerequisites.add(id); });
      }
      changed = unitSelection.size !== count;
    }
    if (tasks.some(t => unitSelection.has(t.id) && (t.retryRisk !== 'safe' || (!t.enabled && t.role === 'business')))
        || Array.from(unitSelection).some(id => !tasks.some(t => t.id === id))) continue;
    unitSelection.forEach(id => selected.add(id));
    unitPrerequisites.forEach(id => prerequisites.add(id));
    unitExpanded.forEach(id => expanded.add(id));
  }
  if (!selected.size) return stop('retry.risk_not_verified');
  const included = [], remaining = new Set(selected);
  while (remaining.size) {
    const ready = tasks.filter(t => remaining.has(t.id) && !t.dependencies.some(d => remaining.has(d))).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    requireValue(ready.length > 0); ready.forEach(t => { included.push(t.id); remaining.delete(t.id); });
  }
  const current = discover(), patches = {};
  if (typeof customRetryPatches === 'function') {
    const custom = customRetryPatches(current, selected);
    return { protocolVersion: ADAPTER.protocolVersion, type: 'retry', decision: 'selective', reasonCode: 'retry.unfinished', includedTaskIds: included,
      prerequisiteTaskIds: included.filter(id => prerequisites.has(id)), expandedUnitIds: Array.from(expanded).sort(), filePatches: custom };
  }
  for (const task of tasks) {
    const slot = current.slots[task.id];
    if (!slot) { if (selected.has(task.id) && !task.enabled) return stop('retry.no_selection_field'); continue; }
    const r = nexus.readConfig(slot.resourceId), expected = select(r.document, slot.selector);
    if (typeof expected !== 'boolean') return stop('retry.unsupported_selection');
    const value = selected.has(task.id);
    if (expected === value) continue;
    if (!patches[slot.resourceId]) patches[slot.resourceId] = { resourceId: slot.resourceId, format: r.format, expectedRevision: r.revision, operations: [] };
    patches[slot.resourceId].operations.push({ selector: slot.selector, expected, value, purpose: 'selection' });
  }
  return { protocolVersion: ADAPTER.protocolVersion, type: 'retry', decision: 'selective', reasonCode: 'retry.unfinished', includedTaskIds: included,
    prerequisiteTaskIds: included.filter(id => prerequisites.has(id)), expandedUnitIds: Array.from(expanded).sort(), filePatches: Object.values(patches) };
}
