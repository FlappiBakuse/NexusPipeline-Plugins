'use strict';

function baahObserve(input, config, tasks) {
  const selected = tasks.filter(task => task.isSelected && task.isEnabled);
  const ids = input.selectedTaskIds ?? selected.map(task => task.taskId);
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !selected.some(task => task.taskId === id)))
    throw new Error('baah_observation_selection_unbound');
  const pool = selected.filter(task => ids.includes(task.taskId)), checkpoint = input.observationCheckpoint;
  const selection = pool.map(task => task.taskId);
  const state = checkpoint ? strictConfigurationJson(checkpoint, 'baah') : { version: 1, runId: input.runId,
    attemptId: input.attemptId, planDigest: input.planDigest, epoch: -1, sequence: 0, ordered: false,
    next: 0, stack: [], results: [], incidents: [], generation: 0, resume: null, selection };
  if (state.version !== 1 || ['runId', 'attemptId', 'planDigest'].some(key => state[key] !== input[key]) ||
      !Array.isArray(state.stack) || !Array.isArray(state.results) || !Array.isArray(state.incidents) || JSON.stringify(state.selection) !== JSON.stringify(selection))
    throw new Error('baah_observation_checkpoint_unbound');
  if (!Array.isArray(input.logEvents) || input.logEvents.length > 256) throw new Error('baah_structured_logs_required');
  for (const event of input.logEvents) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.epoch) || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string')
      throw new Error('baah_log_event_invalid');
    if (event.epoch < state.epoch || event.epoch === state.epoch && event.sequence <= state.sequence) continue;
    if (event.epoch !== state.epoch || event.sequence !== state.sequence + 1) {
      state.stack = []; state.ordered = false; state.resume = null;
    }
    state.epoch = event.epoch; state.sequence = event.sequence;
    const envelope = event.text.match(/^2\.5\.1 - \d{2}:\d{2} - (INFO|WARN|WARNING|ERROR) : (.*)$/);
    if (!envelope) continue;
    const [, level, text] = envelope;
    const activation = text.match(/^(?:当前激活: pipeline |Now activated pipeline )(\d+)$/);
    if (activation) {
      state.ordered = !state.stack.length && Number(activation[1]) === config.index + 1;
      state.stack = []; state.next = 0; state.resume = null;
      if (state.ordered) { state.generation++; state.pendingAbort = false; }
      continue;
    }
    const root = state.stack[0], top = state.stack[state.stack.length - 1];
    if (/^(运行出错: |Error occurred: )/.test(text)) {
      baahFail(state, root, 'baah_unhandled_exception'); state.stack = []; state.ordered = false; state.pendingAbort = true; continue;
    }
    if (state.pendingAbort && ['10秒后自动关闭', 'Auto close in 10 seconds'].includes(text)) {
      for (const task of pool.slice(state.next)) if (!state.results.some(item => item.taskId === task.taskId))
        baahResult(state, task.taskId, 'unknown', 'baah_not_executed_after_error_close', state.generation);
      continue;
    }
    if (!state.ordered) continue;
    const resume = text.match(/^CURRENT_PERIOD_TASK_INDEX = (\d+)(?:，继续运行|, continue run)$/);
    if (resume) {
      const index = Number(resume[1]);
      if (state.stack.length || index >= pool.length) { state.ordered = false; continue; }
      state.resume = pool.filter((task, position) => position >= index || baahClass(task) === 'EnterGame').map(task => task.taskId);
      state.next = 0; continue;
    }
    const before = text.match(/^(?:判断任务([^\s]+)是否可以执行|Judge whether the task ([^\s]+) can be executed)$/);
    if (before) {
      const name = before[1] || before[2];
      if (state.stack.length >= 32) throw new Error('baah_nested_scope_limit');
      let taskId = root?.taskId || null;
      if (!state.stack.length) {
        const candidates = state.resume ? state.resume.map(id => pool.find(task => task.taskId === id)) : pool;
        const expected = candidates[state.next];
        if (!expected || baahClass(expected) !== name) { state.ordered = false; continue; }
        taskId = expected.taskId; state.next++;
      }
      state.stack.push({ name, taskId, stage: 'pre', failed: false, normal: false, generation: state.generation });
      continue;
    }
    if (!root || !top) continue;
    if (level === 'ERROR' || BAAH_FAILURE_TEXTS[top.name]?.includes(text) ||
        top.name === 'InFreeAward' && /^(免费奖励领取失败\(|Free award collection failed \()/.test(text))
      baahFail(state, root, 'baah_business_failed');
    if (state.stack.length === 1 && top.stage === 'run' && BAAH_NORMAL_TEXTS[top.name]?.includes(text)) root.normal = true;
    const skipped = text.match(/^(?:任务([^\s]+)执行前条件不成立或超时，跳过此任务|The condition before the task ([^\s]+) is not met or timed out, skip this task)$/);
    if (skipped && (skipped[1] || skipped[2]) === top.name) {
      const optional = state.stack.length === 2 && root.name === 'EnterGame' && top.name === 'CloseInform';
      if (!optional && !root.normal) baahFail(state, root, 'baah_precondition_failed');
      if (state.stack.length === 1 && root.normal && !root.failed)
        baahResult(state, root.taskId, 'succeeded', 'baah_condition_inapplicable', state.generation);
      state.stack.pop(); continue;
    }
    const running = text.match(/^(?:执行任务([^\s]+)|Run task ([^\s]+))$/);
    if (running && (running[1] || running[2]) === top.name && top.stage === 'pre') { top.stage = 'run'; continue; }
    const post = text.match(/^(?:判断任务([^\s]+)执行结果是否可控|Judge whether the task ([^\s]+) execution result is controllable)$/);
    if (post && (post[1] || post[2]) === top.name && top.stage === 'run') { top.stage = 'post'; continue; }
    const postFail = text.match(/^(?:任务([^\s]+)执行后条件不成立或超时|The condition after the task ([^\s]+) is not met or timed out)$/);
    if (postFail && (postFail[1] || postFail[2]) === top.name) {
      baahFail(state, root, 'baah_postcondition_failed'); top.stage = 'post-failed'; continue;
    }
    if (['返回主页成功', 'Successfully returned to the home page'].includes(text) && top.stage === 'post-failed') {
      state.stack.pop(); continue;
    }
    const end = text.match(/^(?:任务([^\s]+)执行结束|Task ([^\s]+) execution completed)$/);
    if (end && (end[1] || end[2]) === top.name) {
      if (state.stack.length === 1 && top.stage === 'post' && !root.failed) {
        const prior = state.results.find(item => item.taskId === root.taskId);
        const recovered = prior?.state === 'failed' && state.generation > prior.generation;
        baahResult(state, root.taskId, 'succeeded', recovered ? 'baah_recovered_after_pipeline_restart' :
          root.normal ? 'baah_condition_inapplicable' : 'baah_outer_scope_completed', state.generation, recovered);
      }
      state.stack.pop();
    }
  }
  const observations = pool.map(task => {
    const result = state.results.find(item => item.taskId === task.taskId);
    if (!result) return { taskId: task.taskId, state: 'unknown', reasonCode: 'baah_terminal_missing' };
    const outcome = result.state === 'succeeded' && !input.logComplete ? 'unknown' : result.state;
    const completionKind = result.reasonCode === 'baah_not_executed_after_error_close' ? 'notExecuted' : outcome !== 'succeeded' ? undefined :
      result.reasonCode === 'baah_condition_inapplicable' ? baahClass(task) === 'InMomotalk' ? 'satisfied' : 'inapplicable' : 'completed';
    return { taskId: result.taskId, state: outcome,
      reasonCode: result.state === 'succeeded' && !input.logComplete ? 'baah_log_stream_not_complete' : result.reasonCode,
      ...(completionKind ? { completionKind } : {}) };
  });
  const serialized = JSON.stringify(state);
  if (serialized.length > 65536) throw new Error('baah_observation_checkpoint_limit');
  return { observations, observationCheckpoint: serialized };
}
