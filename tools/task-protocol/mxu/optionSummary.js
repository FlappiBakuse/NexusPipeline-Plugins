function optionSummary(plan, task, configured, definition, options) {
  const declared = ADAPTER.optionSummaries?.[configured.taskName];
  if (!declared || !Array.isArray(definition?.option)) return;
  for (const item of declared) {
    if (!definition.option.includes(item.id)) continue;
    const option = options[item.id];
    let state = 'unknown';
    if (object(option) && option.type === 'switch' && Array.isArray(option.cases)
      && option.cases.some(c => ['Yes', 'yes', 'Y', 'y'].includes(c.name))
      && option.cases.some(c => ['No', 'no', 'N', 'n'].includes(c.name))
      && !option.controller?.length && !option.resource?.length) {
      const saved = configured.optionValues?.[item.id];
      // importConfig sanitizes mismatched types, then merges defaults with saved values.
      const value = object(saved) && saved.type === 'switch' ? saved.value
        : ['Yes', 'yes', 'Y', 'y'].includes(option.default_case || option.cases[0]?.name || 'Yes');
      if (typeof value === 'boolean') state = value ? 'enabled' : 'disabled';
    }
    plan.diagnostics.push({ code: 'mxu.option.' + item.id + '.' + state, taskId: task.id,
      message: item.id + ': ' + state + ' (configuration only; no independent outcome evidence)',
      reasonText: { kind: 'plugin', key: item.text + '.' + state, args: {},
        fallback: item.id + ': ' + state + ' (configuration only)' } });
  }
}
