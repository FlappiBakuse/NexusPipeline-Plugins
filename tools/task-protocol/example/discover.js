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
      const created = addTask(plan, config.id, task.id, task.customName || task.name, task.enabled,
        prefix.concat(['tasks', {by:'id',value:task.id}, 'enabled']), 'safe', 'supported');
      if (task.builtin !== true || task.customName)
        created.nameText = { kind: 'literal', value: created.name };
    }
  }
  plan.coverage = 'complete'; return plan;
}
