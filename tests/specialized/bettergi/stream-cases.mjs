import { configuration, request, resource, builtinFlow, outer, runner, message } from './cases.mjs';

const events = (lines, first = 1, epoch = 0, sourceId = 'file:0') =>
  lines.map((text, index) => ({ sourceId, epoch, sequence: first + index, text }));

export function streamCases(invoke) {
  const rows = [], document = configuration(), tasks = invoke(request('discover', document)).tasks;
  const add = (name, input, expect, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  const observe = (records, checkpoint, extras = {}) => request('observe', document,
    { tasks, logEvents: records, logComplete: true, ...(checkpoint ? { observationCheckpoint: checkpoint } : {}), ...extras });
  const lines = builtinFlow(), first = observe(events(lines.slice(0, 1)), undefined, { logComplete: false });
  add('split Serilog header pending', first, { 'observations.0.state': 'unknown' });
  const headerState = invoke(first).observationCheckpoint;
  add('split header and body resumes exact scope', observe(events(lines.slice(1), 2), headerState), { 'observations.0.state': 'succeeded' });
  const start = observe(events(lines.slice(0, 4)), undefined, { logComplete: false });
  const startState = invoke(start).observationCheckpoint;
  add('pending scope survives observation batches', observe(events(lines.slice(4), 5), startState), { 'observations.0.state': 'succeeded' });
  const complete = observe(events(lines)), completeState = invoke(complete).observationCheckpoint;
  add('duplicate sequence does not repeat scope', observe(events(lines), completeState), { 'observations.0.state': 'succeeded' });
  add('completed scope waits for stream closure', observe(events(lines), undefined, { logComplete: false }), { 'observations.0.state': 'unknown' });
  add('final empty batch exposes verified terminal', observe([], completeState), { 'observations.0.state': 'succeeded' });
  const failedLines = builtinFlow(1, 1, message('GameTask.TaskRunner', '业务错误', 'ERR'));
  const failed = observe(events(failedLines)), failedState = invoke(failed).observationCheckpoint;
  add('late success cannot overwrite failure across batches', observe(events(lines, failedLines.length + 1), failedState), { 'observations.0.state': 'failed' });
  add('late error cannot leave success', observe(events(message('GameTask.TaskRunner', '迟到错误', 'ERR'), lines.length + 1), completeState),
    { 'observations.0.state': 'unknown' });
  add('epoch change cannot join header body', observe(events(lines.slice(1), 2, 1), headerState), { 'observations.0.state': 'unknown' });
  add('sequence gap cannot certify terminal', observe(events(lines.slice(4), 9), startState), { 'observations.0.state': 'unknown' });
  const rotated = observe(events(outer('一条龙任务执行: 1/1'), 1, 2), undefined, { logComplete: false });
  const rotatedState = invoke(rotated).observationCheckpoint;
  add('older epoch records ignored', observe(events(lines, 1, 1), rotatedState), { 'observations.0.state': 'unknown' });
  add('stdout cannot impersonate file envelope', observe(events(lines, 1, 0, 'stdout')), { 'observations.0.state': 'unknown' });
  add('other declared file cannot impersonate primary', observe(events(lines, 1, 0, 'file:1')), { 'observations.0.state': 'unknown' });
  const foreign = lines.map(line => line.replaceAll('P4401:', 'P4402:'));
  add('unique foreign process still rejected', observe(events(foreign)), { 'observations.0.state': 'unknown' });
  const missingPid = observe(events(lines)); delete missingPid.upstreamProcessId;
  add('missing upstream PID cannot infer unique context', missingPid, { 'observations.0.state': 'unknown',
    'observations.0.reasonCode': 'bettergi_upstream_process_identity_required' });
  add('checkpoint cannot cross attempt', observe([], completeState, { attemptId: '29849c01-72e7-4cf1-9501-e77b8b12cdd9' }), {}, 'bettergi_observation_checkpoint_unbound');
  add('checkpoint cannot cross upstream process', observe([], completeState, { upstreamProcessId: 4402 }), {}, 'bettergi_observation_checkpoint_unbound');
  add('raw and structured logs cannot mix', observe(events(lines), undefined, { logLines: lines }), {}, 'bettergi_log_inputs_ambiguous');
  add('invalid log sequence rejected', observe([{ sourceId: 'file:0', epoch: 0, sequence: 0, text: 'invalid' }]), {}, 'bettergi_log_event_invalid');
  add('split quoted script cannot forge scope boundary', observe(events([...outer('一条龙任务执行: 1/1'), ...runner('→ "任务启动！"'),
    ...message('GameTask.TaskRunner', '日志正文第一行'), '→ "任务结束"'])), { 'observations.0.state': 'unknown' });
  const multiple = configuration(['领取邮件', '合成树脂']), multiTasks = invoke(request('discover', multiple)).tasks;
  const retry = request('observe', multiple, { tasks: multiTasks, selectedTaskIds: ['bettergi:id-1'],
    logEvents: events(builtinFlow()), logComplete: true });
  add('retry ordinal belongs to actual subset', retry, { observations: [
    { taskId: 'bettergi:id-1', state: 'succeeded', reasonCode: 'bettergi_outer_scope_completed' }] });
  const retryCheckpoint = invoke(retry).observationCheckpoint;
  add('retry checkpoint cannot cross selected scope', { ...retry, selectedTaskIds: ['bettergi:id-0'],
    observationCheckpoint: retryCheckpoint, logEvents: [] }, {}, 'bettergi_observation_checkpoint_unbound');
  for (const selectedTaskIds of [['bettergi:missing'], ['bettergi:id-1', 'bettergi:id-1']])
    add('reject unbound retry selection ' + selectedTaskIds.join(','), { ...retry, selectedTaskIds }, {},
      'bettergi_observation_selection_unbound');
  add('retry projection binds original configuration', request('discover', multiple), {
    'tasks.1.projection': { resourceId: 'one-dragon', relativePath: '', selector: ['TaskEnabledList', 'id-1'] } });
  const initial = request('observe', multiple, { tasks: multiTasks, logEvents: events(builtinFlow(1, 2)), logComplete: false });
  const completedFirst = invoke(initial).observationCheckpoint;
  add('closed tasks survive primary file rotation', request('observe', multiple, { tasks: multiTasks,
    logEvents: events(builtinFlow(2, 2), 1, 1), logComplete: true, observationCheckpoint: completedFirst }),
    { 'observations.0.state': 'succeeded', 'observations.1.state': 'succeeded' });
  return rows;
}

export function configurationCases(invoke) {
  const rows = [], add = (name, input, expect, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  function intent(input, resourceId, edits) {
    const source = input.resources.find(item => item.resourceId === resourceId);
    return { format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId,
      sourceSha256: source.sha256, expectedRevision: source.revision, edits };
  }
  const document = configuration(['领取邮件', '用户组']), input = request('configuration', document);
  input.configurationIntents = [intent(input, 'one-dragon', [{ selector: ['TaskEnabledList', 'id-1'], expected: true, value: false },
    { selector: ['TaskOrder'], expected: ['id-0', 'id-1'], value: ['id-1', 'id-0'] }])];
  add('explicit task flags and order produce exact CAS proposal', input,
    { 'configPatches.0.edits.0.selector': ['TaskEnabledList', 'id-1'], 'configPatches.0.edits.0.value': false,
      'configPatches.0.edits.1.value': ['id-1', 'id-0'], 'configPatches.0.sourceSha256': input.resources[0].sha256 });
  const extra = request('configuration', document, { resources: [resource(document), resource({ selectedOneDragonFlowConfigName: '其他',
    genshinStartConfig: { installPath: 'D:\\Games\\GenshinImpact.exe' }, accountData: { opaque: 'preserved' } }, 'extra-user-config')] });
  extra.configurationIntents = [intent(extra, 'extra-user-config', [{ selector: ['selectedOneDragonFlowConfigName'], expected: '其他', value: '日常' }])];
  add('select explicitly bound existing configuration', extra, { 'configPatches.0.resourceId': 'extra-user-config',
    'configPatches.0.edits.0.value': '日常', 'diagnostics.bettergi_selected_configuration_mismatch': 'warning' });
  const desiredUnknown = structuredClone(extra); desiredUnknown.configurationIntents[0].edits[0].value = '未绑定的配置';
  add('configuration selection cannot invent unbound profile', desiredUnknown, {}, 'bettergi_configuration_edit_not_supported');
  for (const [name, mutate, error] of [
    ['stale source digest', value => { value.configurationIntents[0].sourceSha256 = 'f'.repeat(64); }, 'bettergi_configuration_intent_unbound'],
    ['stale source revision', value => { value.configurationIntents[0].expectedRevision = 8; }, 'bettergi_configuration_intent_unbound'],
    ['foreign operation', value => { value.configurationIntents[0].operationId = 'bd4ae4d6-e7af-4f8d-a4b0-d1594871f188'; }, 'bettergi_configuration_intent_unbound'],
    ['changed expected value', value => { value.configurationIntents[0].edits[0].expected = false; }, 'bettergi_configuration_edit_conflict'],
    ['progress counter write', value => { value.configurationIntents[0].edits = [{ selector: ['AutoBossCompletedRunCount'], expected: 3, value: 0 }]; }, 'bettergi_configuration_edit_not_supported'],
    ['unknown configuration write', value => { value.configurationIntents[0].edits = [{ selector: ['UnknownExtension', 'counter'], expected: 9, value: 0 }]; }, 'bettergi_configuration_edit_not_supported'],
    ['duplicate selector writes', value => { value.configurationIntents[0].edits.push(value.configurationIntents[0].edits[0]); }, 'bettergi_configuration_edit_not_supported'],
    ['new task label without group evidence', value => { value.configurationIntents[0].edits = [{ selector: ['TaskDefinitions', 'id-1'], expected: '用户组', value: '新文件组' }]; }, 'bettergi_configuration_edit_not_supported']
  ]) {
    const changed = structuredClone(input); mutate(changed); add('reject ' + name, changed, {}, error);
  }
  const resumed = structuredClone(input), resumeDocument = structuredClone(document); resumeDocument.NextTaskId = 'id-1';
  resumed.resources = [resource(resumeDocument)]; resumed.configurationIntents[0] = intent(resumed, 'one-dragon', input.configurationIntents[0].edits);
  add('resume cursor prevents order mutation', resumed, {}, 'bettergi_configuration_edit_not_supported');
  const disabled = configuration(['领取邮件', '合成树脂']); disabled.TaskEnabledList['id-1'] = false;
  const tasks = invoke(request('discover', disabled)).tasks;
  add('disabled frozen task remains outside retry', request('retry', disabled, { tasks, idempotencyKey: 'finite',
    observations: [{ taskId: 'bettergi:id-1', state: 'failed', reasonCode: 'synthetic' }] }), { selectedTaskIds: [] });
  return rows;
}
