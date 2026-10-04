function observeDaily(text, tasks, emit, result, line, states) {
  if (line.sourceId !== 'file') return;
  const envelope = logEnvelope(line, result.cursorState);
  if (!envelope || envelope.continuation) return;
  const key = line.sourceId + ':' + line.epoch + ':' + envelope.context;
  const cursor = result.cursorState;
  cursor.scopes ||= {};
  if (!cursor.scopes[key] && Object.keys(cursor.scopes).length >= 16) throw new Error('resource_limit: log scopes');
  const scope = cursor.scopes[key] ||= { next: 0, active: null, failed: false, started: false };
  text = envelope.text;
  const task = () => tasks.find(t => t.id === scope.active);
  const outer = envelope.logger.endsWith('.OneDragonFlowViewModel');
  const runner = envelope.logger.endsWith('.TaskRunner');
  const ordered = tasks.filter(t => t.enabled).slice().sort((a, b) => a.order - b.order);
  const marker = outer && text.match(/^(一条龙|配置组)任务执行: (\d+)\/(\d+)$/);
  if (marker) {
    const pool = ordered.filter(t => ADAPTER.builtInNames.includes(t.name) === (marker[1] === '一条龙'));
    const next = pool[Number(marker[2]) - 1];
    scope.next = next ? ordered.indexOf(next) + 1 : ordered.length;
    scope.active = next?.id || null; scope.failed = false; scope.started = false;
    if (next) { emit(next, 'running', 'bettergi.scope.start'); scope.started = true; }
    return;
  }
  if (outer && text === '一条龙和配置组任务结束') {
    endRun(result, line, 'bettergi.run.end'); return;
  }
  if (outer && /^(?:任务被取消，退出执行|一条龙在启动阶段被取消)$/.test(text)) {
    if (task()) emit(task(), 'failed', 'bettergi.scope.cancelled');
    for (const later of ordered.slice(scope.next)) emit(later, 'blocked', 'bettergi.scope.not_executed');
    endRun(result, line, 'bettergi.run.cancelled', true); return;
  }
  if (!task() || !scope.started) return;
  if (envelope.level === 'ERR' || envelope.level === 'ERROR'
      || outer && text === '执行配置组任务时失败'
      || runner && text === '任务中断:任务被取消') scope.failed = true;
  const builtinEnd = runner && /^→\s*["“]?任务结束["”]?$/.test(text);
  const groupEnd = envelope.logger.endsWith('.ScriptService') && /^配置组 .+ 执行结束(?:，.*)?$/.test(text);
  if (builtinEnd || groupEnd) {
    emit(task(), scope.failed ? 'failed' : 'succeeded', scope.failed ? 'bettergi.scope.failed' : 'bettergi.scope.end');
    scope.started = false;
  }
}
