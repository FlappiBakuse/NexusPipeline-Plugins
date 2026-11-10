import { resource, request, events, intent } from '../maa-fixture.mjs';
import { localizedTasks } from './title-cases.mjs';

const metadata = () => ({ 'interface.json': { name: 'MaaEnd', controller: [{ name: 'Win32', type: 'Win32' }],
  resource: [{ name: 'Default' }], task: [{ name: 'SellProduct', entry: 'OutpostTradingSchedule' }], option: {} } });
const task = (id = 't', extra = {}) => ({ id, taskName: 'SellProduct', enabled: true, optionValues: {}, ...extra });
const document = (tasks = [task()]) => ({ version: '1.0', settings: { autoStartInstanceId: 'stable', selectedInstanceId: 'other' },
  instances: [{ id: 'other', controllerName: 'Win32', resourceName: 'Default', tasks: [] },
    { id: 'stable', controllerName: 'Win32', resourceName: 'Default', tasks }], unknown: { nested: ['preserve', 42] } });
const input = (phase, doc = document(), extra = {}) => request('maaend', phase, [resource('main', doc)], extra);
const selector = field => ['instances', { match: { property: 'id', value: 'stable' } }, 'tasks', { match: { property: 'id', value: 't' } }, field];

export function cases(invoke) {
  const rows = [], sources = metadata();
  const add = (name, value, expect, error, sourceFiles = sources) => rows.push({ name, input: value, sourceFiles, expect, ...(error ? { error } : {}) });
  const current = localizedTasks.filter(([name]) => !['DevTest', 'WebEvent202605'].includes(name));
  const localizedMetadata = metadata();
  localizedMetadata['interface.json'].task = current.map(([name, entry]) => ({ name, entry }));
  add('all supported task identities carry both frozen title locales',
    input('discover', document(current.map(([taskName], index) => task('localized-' + index, { taskName })))),
    Object.fromEntries(current.map(([, , chinese, english], index) => ['tasks.' + index + '.titleLocales',
      { 'zh-CN': chinese, 'en-US': english }])), undefined, localizedMetadata);
  const technicalTitles = [
    ['__MXU_SLEEP__', '⏳ 倒计时', '⏳ Countdown'], ['__MXU_WAITUNTIL__', '⏰ 定时等待', '⏰ Wait Until'],
    ['__MXU_LAUNCH__', '▶️ 自定义程序', '▶️ Custom Program'], ['__MXU_NOTIFY__', '💬 系统通知', '💬 System Notification'],
    ['__MXU_WEBHOOK__', '🔔 Webhook', '🔔 Webhook'], ['__MXU_KILLPROC__', '⛔ 结束进程', '⛔ Kill Process'],
    ['__MXU_POWER__', '⚡ 电脑操作', '⚡ Power Action']
  ];
  add('built-in technical identities retain localized titles outside business tasks',
    input('discover', document(technicalTitles.map(([taskName], index) => task('technical-' + index, { taskName })))),
    Object.fromEntries(technicalTitles.flatMap(([, chinese, english], index) => [
      ['tasks.' + index + '.workflowRole', index >= 5 ? 'cleanup' : 'technical'],
      ['tasks.' + index + '.titleLocales', { 'zh-CN': chinese, 'en-US': english }]])));
  const pretaskMetadata = metadata();
  pretaskMetadata['interface.json'].pretask = { name: 'LaunchGamePC', exec: 'agent/go-service', args: ['--pretask', 'LaunchGamePC'] };
  add('program preparation retains its localized title and technical role',
    input('discover', document([task('launch', { taskName: '__MXU_PRETASK__LaunchGamePC' })])),
    { 'tasks.0.titleLocales': { 'zh-CN': '启动游戏', 'en-US': 'Launch game' }, 'tasks.0.workflowRole': 'technical' }, undefined, pretaskMetadata);
  const importedMetadata = metadata(), launchImport = 'tasks/pretasks/LaunchGamePC.json';
  importedMetadata['interface.json'].import = [launchImport];
  importedMetadata[launchImport] = {
    pretask: { ...pretaskMetadata['interface.json'].pretask, controller: ['Win32'], option: ['LaunchGamePCLauncherPath', 'LaunchGamePCGameSetting'] },
    option: {
      LaunchGamePCLauncherPath: { type: 'select', default_case: 'Auto', cases: [{ name: 'Auto' }] },
      LaunchGamePCGameSetting: { type: 'select', default_case: 'No', cases: [{ name: 'No' }] }
    }
  };
  const launchProfile = document([task(), task('launch', { taskName: '__MXU_PRETASK__LaunchGamePC' })]);
  add('declared PC launch import supplies the technical task and business prerequisites', input('discover', launchProfile),
    { 'tasks.0.taskId': 'maaend:stable/launch', 'tasks.0.isSelected': true, 'tasks.0.workflowRole': 'technical',
      'tasks.0.retrySafety': 'safe', 'tasks.1.dependencies': ['maaend:stable/launch'],
      'tasks.1.retryPrerequisites': ['maaend:stable/launch'] }, undefined, importedMetadata);
  add('imported PC launch options satisfy configuration checks', input('configuration', launchProfile),
    { diagnostics: [], configPatches: [] }, undefined, importedMetadata);
  const duplicatePretasks = structuredClone(importedMetadata);
  duplicatePretasks['interface.json'].pretask = [importedMetadata[launchImport].pretask];
  add('repeated PC launch definitions do not grant selection', input('discover', launchProfile),
    { 'tasks.0.dependencies': [], 'tasks.1.isSelected': false, 'diagnostics.maaend_unknown_task_preserved': 'warning' },
    undefined, duplicatePretasks);
  add('automatic stable instance wins over active page', input('discover'), { 'tasks.0.taskId': 'maaend:stable/t', 'tasks.0.isSelected': true });
  const large = document(); large.unknown.text = '中文\\\"\n'.repeat(8000);
  const largeInput = input('discover', large);
  largeInput.resources[0].content = JSON.stringify(large, null, 4);
  add('large formatted profile retains escaped strings within interpreter budget', largeInput,
    { 'tasks.0.taskId': 'maaend:stable/t' });
  const duplicate = input('discover');
  duplicate.resources[0].content = duplicate.resources[0].content.replace('"version":', '"\\u0076ersion":"1.0","version":');
  add('escaped duplicate member rejected', duplicate, {}, 'configuration_duplicate_key');
  add('repeated entries retain separate stable ids and custom titles', input('discover', document([task(), task('second', { customName: 'My title' })])),
    { 'tasks.1.taskId': 'maaend:stable/second', 'tasks.1.title': 'My title' });
  for (const enabled of [false, true]) {
    const doc = document([task(), task('unknown', { taskName: 'FutureTask', enabled, nested: { retain: true } })]);
    add('unknown ' + enabled + ' retained without projection', input('discover', doc),
      { 'tasks.1.title': 'FutureTask', 'tasks.1.isEnabled': enabled, 'tasks.1.isSelected': false,
        'tasks.1.retrySafety': 'unknown', 'diagnostics.maaend_unknown_task_preserved': 'warning' });
  }
  const frozen = invoke(input('discover'), sources).tasks;
  for (const [start, end] of [['任务开始', '任务完成'], ['Task started', 'Task completed'], ['任務開始', '任務完成'],
    ['タスクを開始', 'タスクが完了しました'], ['작업 시작', '작업 완료']]) {
    add('paired outer result ' + start, input('observe', document(), { tasks: frozen, logComplete: true,
      logEvents: events([start + ': SellProduct', end + ': SellProduct'], 'stdout', ' ') }), { 'observations.0.state': 'succeeded' });
  }
  add('terminal alone cannot prove success', input('observe', document(), { tasks: frozen, logComplete: true,
    logEvents: events(['Task completed: SellProduct'], 'stdout', ' ') }), { 'observations.0.state': 'unknown' });
  add('gap loses active scope', input('observe', document(), { tasks: frozen, logComplete: true,
    logEvents: [...events(['Task started: SellProduct'], 'stdout', ' '), ...events(['Task completed: SellProduct'], 'stdout', ' ', 3)] }),
    { 'observations.0.state': 'unknown' });
  add('incomplete stream does not finalize success', input('observe', document(), { tasks: frozen, logComplete: false,
    logEvents: events(['Task started: SellProduct', 'Task completed: SellProduct'], 'stdout', ' ') }), { 'observations.0.state': 'unknown' });
  add('late failure wins over successful terminal', input('observe', document(), { tasks: frozen, logComplete: true,
    logEvents: events(['Task started: SellProduct', 'Task completed: SellProduct', 'Task failed: SellProduct'], 'stdout', ' ') }),
    { 'observations.0.state': 'failed' });
  const repeated = document([task(), task('second')]);
  add('same-name ambiguity never attributes success', input('observe', repeated, { tasks: invoke(input('discover', repeated), sources).tasks,
    logComplete: true, logEvents: events(['Task started: SellProduct', 'Task completed: SellProduct'], 'stdout', ' ') }),
    { 'observations.0.state': 'unknown', 'observations.1.state': 'unknown' });
  add('retry selects known failure only', input('retry', document(), { tasks: frozen, idempotencyKey: 'bounded',
    observations: [{ taskId: 'maaend:stable/t', state: 'failed' }] }), { selectedTaskIds: ['maaend:stable/t'] });
  const disabled = document([task('t', { enabled: false })]);
  add('retry never enables originally disabled task', input('retry', disabled, { tasks: invoke(input('discover', disabled), sources).tasks,
    idempotencyKey: 'disabled', observations: [{ taskId: 'maaend:stable/t', state: 'failed' }] }), { selectedTaskIds: [] });
  const edit = input('configuration'); edit.configurationIntents = [intent(edit, [{ selector: selector('enabled'), expected: true, value: false }])];
  add('configuration selection patch preserves stable selector and CAS', edit, { configPatches: edit.configurationIntents });
  add('stale user field refuses edit', { ...edit, configurationIntents: [intent(edit, [{ selector: selector('enabled'), expected: false, value: false }])] }, {}, 'edit_conflict');
  add('unbound readonly project rejected', input('discover'), {}, 'project_unbound', { 'interface.json': { ...sources['interface.json'], name: 'Foreign' } });
  add('missing readonly metadata rejected', input('discover'), {}, 'ambiguous_or_missing', {});
  add('ambiguous interface roots rejected', input('discover'), {}, 'ambiguous_or_missing', { ...sources, 'assets/interface.json': sources['interface.json'] });
  const wrong = document(); wrong.settings.autoStartInstanceId = 'missing';
  add('missing automatic instance has a blocking discovery diagnostic without guessing', input('discover', wrong),
    { tasks: [], 'diagnostics.mxu_autostart_invalid': 'blocking' });
  add('missing automatic instance does not propose a configuration rewrite', input('configuration', wrong),
    { configPatches: [], 'diagnostics.mxu_autostart_invalid': 'blocking' });
  for (const phase of ['observe', 'retry'])
    add('missing automatic instance cannot enter ' + phase, input(phase, wrong), {}, 'auto_start_instance_required');
  add('duplicate saved identity rejected', input('discover', document([task(), task()])), {}, 'task_identity_invalid');
  const importSources = metadata(); importSources['interface.json'].import = ['../../outside.json'];
  add('unknown import warning preserves available tasks', input('discover'),
    { 'tasks.0.taskId': 'maaend:stable/t', 'diagnostics.maaend_unknown_import_preserved': 'warning' }, undefined, importSources);
  return rows;
}
