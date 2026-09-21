// Synthetic grammar: TASK <stable-id> START|OK|FAIL. No real game claims.
function discover() {
  const config = configOne(), plan = createPlan(), d = config.document;
  if (ADAPTER.preset === 'json-map' || ADAPTER.preset === 'yaml') {
    requireValue(object(d.enabled));
    for (const [id, enabled] of Object.entries(d.enabled))
      addTask(plan, config.id, id, id, enabled, ['enabled', id], 'safe', 'supported');
  } else if (ADAPTER.preset === 'json-parallel-array') {
    requireValue(Array.isArray(d.pipelines) && d.pipelines.length === 1);
    const row = d.pipelines[0];
    requireValue(Array.isArray(row.ids) && unique(row.ids) && Array.isArray(row.enabled) && row.ids.length === row.enabled.length);
    row.ids.forEach((id, index) => addTask(plan, config.id, id, id, row.enabled[index], null, 'safe', 'supported'));
    plan.selectionFields.push({ resourceId: config.id, selector: ['pipelines', {index:0, guardKey:'ids', guardValue:row.ids}, 'enabled'], purpose:'selection' });
  } else {
    const instance = ADAPTER.preset === 'mxu' ? (d.instances || []).filter(i => i.id === d.activeId) : [{tasks:d.tasks}];
    requireValue(instance.length === 1 && Array.isArray(instance[0].tasks));
    const prefix = ADAPTER.preset === 'mxu' ? ['instances', {by:'id',value:d.activeId}] : [];
    for (const task of instance[0].tasks) {
      requireValue(typeof task.id === 'string' && /^[A-Za-z0-9_-]+$/.test(task.id));
      addTask(plan, config.id, task.id, task.name, task.enabled, prefix.concat(['tasks', {by:'id',value:task.id}, 'enabled']), 'safe', 'supported');
    }
  }
  plan.coverage = 'complete'; return plan;
}
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
function observe(text, tasks, emit) {
  const match = /^TASK ([A-Za-z0-9_-]+) (START|OK|FAIL)$/.exec(text);
  if (!match) return;
  const found = tasks.filter(t => t.sourceKey === match[1]);
  if (found.length !== 1) return;
  emit(found[0], { START:'running', OK:'succeeded', FAIL:'failed' }[match[2]], 'example.task.' + match[2].toLowerCase());
}
