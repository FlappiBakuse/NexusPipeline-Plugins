function customRetryPatches(plan, selected) {
  const field = plan.selectionFields.find(f => f.selector.at(-1) === 'TASK_ONOFF'), current = nexus.readConfig(field.resourceId);
  const expected = select(current.document, field.selector);
  const value = expected.map((enabled, index) => selected.has(plan.tasks[index].id));
  const operations = [{ selector: field.selector, expected, value, purpose: 'selection' }];
  for (const task of plan.tasks.filter(t => t.sourceKey.startsWith('automatic-'))) {
    const slot = plan.slots[task.id], old = select(current.document, slot.selector), next = selected.has(task.id);
    if (old !== next) operations.push({ selector: slot.selector, expected: old, value: next, purpose: 'selection' });
  }
  return [{ resourceId: field.resourceId, format: current.format, expectedRevision: current.revision, operations }];
}
