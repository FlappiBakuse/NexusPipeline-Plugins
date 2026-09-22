function customRetryPatches(plan, selected) {
  const groups = {};
  if (ADAPTER.preset === 'json-parallel-array') {
    const field = plan.selectionFields[0], r = nexus.readConfig(field.resourceId);
    return [{resourceId:field.resourceId,format:r.format,expectedRevision:r.revision,operations:[{
      selector:field.selector,expected:select(r.document,field.selector),value:plan.tasks.map(t=>selected.has(t.id)),purpose:'selection'}]}];
  }
  for (const task of plan.tasks) {
    const field = plan.slots[task.id], r = nexus.readConfig(field.resourceId);
    const expected = select(r.document, field.selector), value = selected.has(task.id);
    if (expected === value) continue;
    groups[field.resourceId] ||= {resourceId:field.resourceId,format:r.format,expectedRevision:r.revision,operations:[]};
    groups[field.resourceId].operations.push({selector:field.selector,expected,value,purpose:'selection'});
  }
  return Object.values(groups);
}
