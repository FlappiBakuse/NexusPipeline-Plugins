function optionSummary(plan, task, configured, definition, options) {
  const declared = ADAPTER.optionSummaries?.[configured.taskName];
  if (!declared || !Array.isArray(definition?.option)) return;
  const summaries = [];
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
    summaries.push({item, state});
  }
  if (summaries.length) {
    const args = {enabled:summaries.filter(s => s.state === 'enabled').length, disabled:summaries.filter(s => s.state === 'disabled').length, unknown:summaries.filter(s => s.state === 'unknown').length};
    plan.diagnostics.push({code:'mxu.options.' + configured.taskName, taskId:task.id,
      message: '日常奖励领取选项：' + summaries.map(({item,state}) => item.id + '=' + state).join('、') + '；配置选项无独立完成证据。',
      reasonText:{kind:'plugin',key:'option.summary.' + configured.taskName,args,
        fallback:'日常奖励领取包含多个配置选项，无独立完成证据。'}});
  }
}
