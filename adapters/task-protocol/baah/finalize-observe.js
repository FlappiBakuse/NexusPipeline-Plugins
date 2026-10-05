function finalizeObserve(tasks, result, states, emit) {
  const abort = result.cursorState.pendingAbort;
  if (!abort || input.terminationReason !== 'process_exited') return;
  endRun(result, abort.line, 'baah.run.failed_process_exit', true);
  tasks.filter(t => Number.isInteger(abort.order) && t.order > abort.order && (states[t.id]?.status || 'pending') === 'pending')
    .forEach(t => emit(t, 'blocked', abort.line, 'baah.run.aborted_before_task'));
}
