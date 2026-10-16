function addTask(plan, resourceId, key, name, enabled, selector, risk, detection, role, parentId) {
  const id = ADAPTER.id + ':' + key;
  requireValue(typeof enabled === 'boolean' && typeof name === 'string' && name.length > 0 && !plan.tasks.some(t => t.id === id));
  const task = { id, sourceKey: key, name, parentId: parentId || null, role: role || 'business', enabled,
    order: plan.tasks.length, countsAsUnit: !parentId && (!role || role === 'business'), requiredForParent: true,
    retryUnitId: parentId || id, retryRisk: risk || 'unknown', dependencies: [], detection: detection || 'limited', configRef: resourceId };
  requireValue(ADAPTER.dailyPolicy);
  Object.assign(task, JSON.parse(JSON.stringify(ADAPTER.dailyPolicy)));
  if (role && role !== 'business') task.workflowRole = 'technical';
  if (ADAPTER.protocolVersion === '0.3.0') {
    task.recognition = detection === 'unsupported' ? 'opaque' : 'known';
    task.lifecycleRole = ADAPTER.lifecycleRoles?.[key] || (role === 'cleanup' ? 'finalize' : role === 'technical' ? 'prepare' : 'business');
    task.selectionPolicy = task.recognition === 'known' ? 'managed' : 'preserve';
    if (task.recognition === 'opaque') {
      task.countsAsUnit = false; task.requiredForParent = false;
      delete task.configRef;
      for (const field of ['completionPolicy', 'workflowRole', 'observationContract', 'retryPolicy']) delete task[field];
    }
  }
  const textKey = ADAPTER.taskTextKeys?.[key];
  task.nameText = textKey
    ? { kind: 'plugin', key: textKey, args: {}, fallback: name } : { kind: 'literal', value: name };
  plan.tasks.push(task);
  if (selector && task.recognition !== 'opaque') {
    const field = { resourceId, selector, purpose: 'selection' };
    if (ADAPTER.protocolVersion === '0.3.0') field.taskIds = [id];
    if (!plan.selectionFields.some(f => JSON.stringify(f) === JSON.stringify(field))) plan.selectionFields.push(field);
    plan.slots[id] = field;
  }
  return task;
}
