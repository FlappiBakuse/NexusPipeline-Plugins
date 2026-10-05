function customRetryPatches(current, selected) {
  const patches = {};
  for (const task of current.tasks) {
    const slot = current.slots[task.id];
    requireValue(slot || !task.enabled || selected.has(task.id));
    if (!slot) continue;
    const r = nexus.readConfig(slot.resourceId), expected = select(r.document, slot.selector);
    requireValue(expected === null || typeof expected === 'boolean');
    const value = selected.has(task.id);
    if (expected === value) continue;
    if (!patches[slot.resourceId]) patches[slot.resourceId] = {resourceId:slot.resourceId, format:r.format,
      expectedRevision:r.revision, operations:[]};
    patches[slot.resourceId].operations.push({selector:slot.selector,expected,value,purpose:'selection'});
  }
  return Object.values(patches);
}
