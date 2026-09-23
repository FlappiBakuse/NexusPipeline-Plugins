function addTask(plan, resourceId, key, name, enabled, selector, risk, detection, role, parentId) {
  const id = ADAPTER.id + ':' + key;
  requireValue(typeof enabled === 'boolean' && typeof name === 'string' && name.length > 0 && !plan.tasks.some(t => t.id === id));
  const task = { id, sourceKey: key, name, parentId: parentId || null, role: role || 'business', enabled,
    order: plan.tasks.length, countsAsUnit: !parentId && (!role || role === 'business'), requiredForParent: true,
    retryUnitId: parentId || id, retryRisk: risk || 'unknown', dependencies: [], detection: detection || 'limited', configRef: resourceId };
  const textKey = ADAPTER.taskTextKeys?.[key];
  task.nameText = textKey
    ? { kind: 'plugin', key: textKey, args: {}, fallback: name } : { kind: 'literal', value: name };
  plan.tasks.push(task);
  if (selector) {
    const field = { resourceId, selector, purpose: 'selection' };
    if (!plan.selectionFields.some(f => JSON.stringify(f) === JSON.stringify(field))) plan.selectionFields.push(field);
    plan.slots[id] = field;
  }
  return task;
}
