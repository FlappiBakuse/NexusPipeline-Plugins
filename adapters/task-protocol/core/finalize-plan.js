function finalizePlan(plan) {
  if (ADAPTER.protocolVersion !== '0.3.0') return plan;
  if (!plan.verification) plan.verification = { opaqueScopes: [] };
  if (!plan.tasks.length && !plan.verification.opaqueScopes.length && plan.coverage === 'unsupported')
    plan.verification.opaqueScopes = (input.configResources || []).map(resource => ({
      id: ADAPTER.id + ':scope:' + resource.id, resourceId: resource.id, enabled: true, reasonCode: 'unsupported_structure'
    }));
  for (const field of plan.selectionFields) {
    if (!field.taskIds) field.taskIds = Object.entries(plan.slots)
      .filter(([, slot]) => slot === field).map(([id]) => id.replace(/:controller$/, ''));
  }
  plan.selectionFields = plan.selectionFields.filter(field => field.taskIds.length > 0
    && field.taskIds.every(id => plan.tasks.some(task => task.id === id && task.recognition === 'known')));
  const opaque = plan.tasks.some(task => task.recognition === 'opaque') || plan.verification.opaqueScopes.length > 0;
  plan.coverage = opaque ? plan.tasks.some(task => task.recognition === 'known') ? 'partial' : 'opaque' : 'complete';
  return plan;
}
