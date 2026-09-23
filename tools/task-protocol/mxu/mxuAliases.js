function mxuAliases(tasks) {
  if (mxuAliasCache) return mxuAliasCache;
  const pi = resource('interface'), definitions = (pi.task || []).slice(), locales = [];
  const configured = tasks.length ? nexus.readConfig(tasks[0].configRef).document : { instances: [] };
  const wanted = configured.instances.flatMap(i => i.tasks || []).filter(t => tasks.some(task => task.sourceKey.endsWith('/' + t.id))).map(t => t.taskName);
  for (const path of pi.import || []) {
    const declaredTasks = ADAPTER.importTasks[path];
    if (declaredTasks && !wanted.some(name => declaredTasks.includes(name))) continue;
    const id = ADAPTER.imports[path];
    if (id) { try { definitions.push(...(resource(id).task || [])); } catch { /* unavailable imports stay unsupported */ } }
  }
  const configs = {};
  mxuAliasCache = {};
  for (const task of tasks) {
    const document = configs[task.configRef] || (configs[task.configRef] = nexus.readConfig(task.configRef).document);
    const selected = document.instances.flatMap(instance => (instance.tasks || []).filter(t => instance.id + '/' + t.id === task.sourceKey));
    const names = [task.name];
    if (selected.length === 1 && !selected[0].customName && document.settings.language === 'system') {
      if (!locales.length) for (const id of Object.values(ADAPTER.locales)) { try { locales.push(resource(id)); } catch { /* optional language */ } }
      const defs = definitions.filter(d => d.name === selected[0].taskName);
      if (defs.length === 1 && typeof defs[0].label === 'string' && defs[0].label.startsWith('$'))
        for (const locale of locales) if (typeof locale[defs[0].label.slice(1)] === 'string') names.push(locale[defs[0].label.slice(1)]);
    }
    // appStore.forwardLogToStdout removes HTML tags from the complete log message.
    mxuAliasCache[task.id] = Array.from(new Set(names.map(name => name.replace(/<[^>]*>/g, '').trimEnd())));
  }
  return mxuAliasCache;
}
