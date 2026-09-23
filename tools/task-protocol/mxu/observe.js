function observe(text, tasks, emit, result, line, states) {
  if (line.sourceId !== 'stdout') return;
  if (input.logBatch.hasGap) { result.cursorState = {}; return; }
  // commands/state.rs log_to_stdout prefixes each physical line with local time.
  text = text.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] /, '');
  const patterns = [
    [/^任务开始: (.+)$/, 'running'], [/^任务完成: (.+)$/, 'succeeded'], [/^任务失败: (.+)$/, 'failed'],
    [/^Task started: (.+)$/, 'running'], [/^Task completed: (.+)$/, 'succeeded'], [/^Task failed: (.+)$/, 'failed'],
    [/^任務開始: (.+)$/, 'running'], [/^任務完成: (.+)$/, 'succeeded'], [/^任務失敗: (.+)$/, 'failed'],
    [/^タスクを開始: (.+)$/, 'running'], [/^タスクが完了しました: (.+)$/, 'succeeded'], [/^タスクが失敗しました: (.+)$/, 'failed'],
    [/^작업 시작: (.+)$/, 'running'], [/^작업 완료: (.+)$/, 'succeeded'], [/^작업 실패: (.+)$/, 'failed']
  ];
  for (const [pattern, status] of patterns) {
    const match = text.match(pattern); if (!match) continue;
    const aliases = mxuAliases(tasks);
    const found = tasks.filter(t => aliases[t.id].includes(match[1]));
    if (found.length !== 1 || found[0].detection === 'unsupported' || input.logBatch.hasGap) return;
    const task = found[0];
    const cursor = result.cursorState;
    if (cursor.source !== line.sourceId || cursor.epoch !== line.epoch || input.logBatch.hasGap) {
      cursor.source = line.sourceId; cursor.epoch = line.epoch; cursor.started = {}; cursor.finished = {};
    }
    if (status !== 'running' && (!cursor.started[task.id] || states[task.id]?.status !== 'running')) return;
    if (status === 'running') { cursor.started[task.id] = true; delete cursor.finished[task.id]; }
    else { delete cursor.started[task.id]; cursor.finished[task.id] = true; }
    emit(task, status, 'mxu.task.' + status);
    // All selected outer tasks have paired callbacks in this source/epoch; no process-exit option is needed.
    if (tasks.length && tasks.every(t => cursor.finished[t.id])) endRun(result, line, 'mxu.run.all_selected_terminal');
    return;
  }
}
