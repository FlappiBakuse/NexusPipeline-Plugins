function customRetryPatches(current, selected) {
  const patches = {};
  for (const task of current.tasks) {
    for (const key of [task.id, task.id + ':controller']) {
      const slot = current.slots[key];
      if (!slot) continue;
      const r = nexus.readConfig(slot.resourceId), expected = select(r.document, slot.selector);
      requireValue(typeof expected === 'boolean');
      const value = selected.has(task.id);
      if (value === expected) continue;
      if (!patches[slot.resourceId]) patches[slot.resourceId] = {resourceId:slot.resourceId, format:r.format,
        expectedRevision:r.revision, operations:[]};
      patches[slot.resourceId].operations.push({selector:slot.selector, expected, value, purpose:'selection'});
    }
  }
  return Object.values(patches);
}
