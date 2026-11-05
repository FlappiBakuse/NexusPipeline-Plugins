import { resource, request, events, intent } from '../maa-fixture.mjs';

const name = '领取每日奖励', entry = '采购_入口', key = name + '<|||>' + entry;
const metadata = () => ({ 'interface.json': { name: 'MaaStellaSora', controller: [{ name: 'Win32', type: 'Win32' }],
  resource: [{ name: 'Default' }], task: [{ name, entry, repeatable: true }], option: {} } });
const item = (extra = {}) => ({ name, entry, default_check: true, repeat_count: 1, ...extra });
const document = (tasks = [item()]) => ({ TaskItems: tasks, CurrentTasks: [key], AfterTask: 'None' });
const input = (phase, doc = document(), global = {}, extra = {}) => request('maas', phase,
  [resource('main', doc, 'config/instances/stable.json'), resource('global', global, 'config/config.json'), resource('settings', { DefaultConfig: 'Default' })], extra);
const logs = (texts, instance = 'stable', first = 1) => events(texts, 'file:0', '[INF] [cfg=Default][inst=' + instance + '][src=Monitor][op=MonitorLog] ', first);

export function cases(invoke) {
  const rows = [], sources = metadata();
  const add = (name, value, expect, error, sourceFiles = sources) => rows.push({ name, input: value, sourceFiles, expect, ...(error ? { error } : {}) });
  add('stable file id owns configuration', input('discover'), { 'tasks.0.taskId': 'maas:stable/0', 'tasks.0.isSelected': true });
  for (const phase of ['discover', 'retry']) {
    const value = input(phase, document(), {}, phase === 'retry' ? {
      tasks: invoke(input('discover'), sources).tasks, idempotencyKey: 'file-source',
      observations: [{ taskId: 'maas:stable/0', state: 'failed' }]
    } : {});
    value.resources = value.resources.map(row => ({ ...row, ...(row.relativePath ? { sourcePath: row.relativePath } : {}), relativePath: '' }));
    if (value.tasks) value.tasks = value.tasks.map(task => ({ ...task,
      ...(task.projection ? { projection: { ...task.projection, relativePath: '' } } : {}) }));
    add('file snapshots retain stable source identity ' + phase, value, phase === 'retry'
      ? { selectedTaskIds: ['maas:stable/0'] }
      : { 'tasks.0.taskId': 'maas:stable/0', 'tasks.0.projection.relativePath': '' });
  }
  add('custom name and duplicate occurrences retained', input('discover', document([item({ remark: 'My name' }), item()])),
    { 'tasks.0.title': 'My name', 'tasks.1.taskId': 'maas:stable/1' });
  for (const enabled of [false, true]) add('unknown ' + enabled + ' remains unselected with warning',
    input('discover', document([item(), item({ name: 'Future', entry: 'Future', default_check: enabled, unknown: { keep: 9 } })])),
    { 'tasks.1.title': 'Future', 'tasks.1.isEnabled': enabled, 'tasks.1.isSelected': false, 'tasks.1.retrySafety': 'unknown' });
  for (const [label, doc, globals] of [
    ['local', { TaskItems: [item({ remark: 'local' })], CurrentTasks: [key] }, { ['Instance.stable.TaskItems']: [item({ remark: 'stable' })] }],
    ['stable', {}, { ['Instance.stable.TaskItems']: [item({ remark: 'stable' })], ['Instance.default.TaskItems']: [item({ remark: 'default' })] }],
    ['default', {}, { ['Instance.default.TaskItems']: [item({ remark: 'default' })], TaskItems: [item({ remark: 'global' })] }],
    ['global', {}, { TaskItems: [item({ remark: 'global' })] }],
  ]) add('configuration inheritance ' + label, input('discover', doc, globals), { 'tasks.0.title': label });
  const frozen = invoke(input('discover'), sources).tasks;
  const observe = (lines, extra = {}) => input('observe', document(), {}, { tasks: frozen, logEvents: lines, logComplete: true, ...extra });
  add('ordered task and terminal success', observe(logs(['Starting task: ' + name, 'All tasks have been completed!'])), { 'observations.0.state': 'succeeded' });
  add('official GUI display name and stable id own Chinese task progress',
    observe(logs(['开始任务：' + name, '任务已全部完成！'], 'D isolated/stable')), { 'observations.0.state': 'succeeded' });
  for (const [source, operation] of [['MonitorLog', 'Monitor'], ['Worker', 'MonitorLog']]) {
    const wrong = logs(['Starting task: ' + name, 'All tasks have been completed!']).map(event => ({ ...event,
      text: event.text.replace('[src=Monitor][op=MonitorLog]', '[src=' + source + '][op=' + operation + ']') }));
    add('unbound source and operation ignored ' + source, observe(wrong), { 'observations.0.state': 'unknown' });
  }
  add('other instance ignored', observe(logs(['Starting task: ' + name, 'All tasks have been completed!'], 'foreign')), { 'observations.0.state': 'unknown' });
  add('terminal alone cannot invent progress', observe(logs(['All tasks have been completed!'])), { 'observations.0.state': 'unknown' });
  add('async named failure wins after terminal', observe(logs(['Starting task: ' + name, 'All tasks have been completed!', 'Task failed: ' + name])),
    { 'observations.0.state': 'failed' });
  add('drain incomplete does not publish success', observe(logs(['Starting task: ' + name, 'All tasks have been completed!']), { logComplete: false }),
    { 'observations.0.state': 'unknown' });
  add('gap invalidates order proof', observe([...logs(['Starting task: ' + name]), ...logs(['All tasks have been completed!'], 'stable', 3)]),
    { 'observations.0.state': 'unknown' });
  add('retry known failed local task', input('retry', document(), {}, { tasks: frozen, idempotencyKey: 'bounded',
    observations: [{ taskId: 'maas:stable/0', state: 'failed' }] }), { selectedTaskIds: ['maas:stable/0'] });
  const repeated = document([item({ repeat_count: 3 })]), repeatedTasks = invoke(input('discover', repeated), sources).tasks;
  for (const completed of [0, 2, 3]) add('retry finite repeated task completed ' + completed,
    input('retry', repeated, {}, { tasks: repeatedTasks, idempotencyKey: 'repeat',
      observations: [{ taskId: 'maas:stable/0', state: 'failed', completedRepetitions: completed }] }),
    { selectedTaskIds: completed < 3 ? ['maas:stable/0'] : [] });
  const disabled = document([item({ default_check: false })]);
  add('retry does not enable disabled task', input('retry', disabled, {}, { tasks: invoke(input('discover', disabled), sources).tasks,
    idempotencyKey: 'disabled', observations: [{ taskId: 'maas:stable/0', state: 'failed' }] }), { selectedTaskIds: [] });
  for (const [purpose, expected] of [['editPrepare', 'True'], ['editCommit', 'False']]) add('editor hook ' + purpose,
    input('configuration', document(), {}, { purpose }), { 'configPatches.0.resourceId': 'settings', 'configPatches.0.edits.0.value': expected });
  const edit = input('configuration'); edit.configurationIntents = [intent(edit, [{ selector: ['TaskItems', 0, 'default_check'], expected: true, value: false }])];
  add('local selection edit is exact CAS patch', edit, { configPatches: edit.configurationIntents });
  add('stale user field refuses edit', { ...edit, configurationIntents: [intent(edit, [{ selector: ['TaskItems', 0, 'default_check'], expected: false, value: false }])] }, {}, 'edit_conflict');
  add('repeat limit rejected at boundary', input('discover', document([item({ repeat_count: 0 })])), {}, 'repeat_count_finite_required');
  add('wrong project rejected', input('discover'), {}, 'project_unbound', { 'interface.json': { ...sources['interface.json'], name: 'Foreign' } });
  add('missing interface rejected', input('discover'), {}, 'ambiguous_or_missing', {});
  return rows;
}
