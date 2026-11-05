import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [repo, output, nativeProbe, interpreter, nativeReceipt] = process.argv.slice(2);
if (![repo, output, nativeProbe, interpreter, nativeReceipt].every(value => value && path.isAbsolute(value))) throw new Error('Explicit absolute inputs required');
if (!output.startsWith('D:\\Projects\\Temp\\NexusPipeline-0.18.0\\artifacts\\p3-specialized\\maa-compiler\\')) throw new Error('Output escapes assigned slot');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const native = JSON.parse(fs.readFileSync(nativeReceipt, 'utf8'));
if (native.componentSourceAndAssemblies[interpreter] !== sha(fs.readFileSync(interpreter))) throw new Error('Production interpreter changed; rebuild existing probe');
const resource = (value, resourceId) => { const content = JSON.stringify(value); return { resourceId, content, revision: 7, sha256: sha(content) }; };
const base = () => ({ name: 'MaaStellaSora', controller: [{ name: 'PC', type: 'Win32' }], resource: [{ name: 'Official' }],
  task: [{ name: '领取每日奖励', entry: '采购_入口', default_check: true }], option: {} });
const main = () => ({ TaskItems: [{ name: '领取每日奖励', entry: '采购_入口', default_check: true, progress: { counter: 7 } }],
  CurrentTasks: ['领取每日奖励<|||>采购_入口'], CurrentControllerName: 'PC', Resource: 'Official', BeforeTask: 'StartupScriptOnly', SoftwarePath: '', AfterTask: 'None' });
const input = (instance = main(), global = {}, pi = base()) => ({ format: 'nexus.task.adapter', version: 1, direction: 'request', phase: 'configuration', extensionId: 'maas',
  operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: [resource(instance, 'instance:one'), resource(global, 'global:Default'), resource({}, 'settings'), resource(pi, 'interface')] });
const cases = [];
const add = (name, request, expect, error) => cases.push({ name, input: request, expect, ...(error ? { error } : {}) });
const inherited = main(); inherited.TaskItems.push({ name: 'retired', entry: 'unknown', default_check: false, upstreamProgress: { value: 9 }, option: [{ name: 'unknown', data: { untouched: 'yes' } }] });
const local = { CurrentControllerName: 'PC', Resource: 'Official', BeforeTask: 'None', SoftwarePath: 'local-only' };
add('inherited tasks create local-only plan and preserve unknown progress/options', { mode: 'overlay', request: input(local, inherited) }, {
  'resourceId': 'instance:one', 'reads.0.exists': false, 'values.TaskItems.1.upstreamProgress.value': 9, 'values.TaskItems.1.option.0.data.untouched': 'yes', 'sources.1.resourceId': 'global:Default' });
add('null local field remains distinct from absent during CAS planning', { mode: 'overlay', request: input({ ...local, TaskItems: null }, inherited) }, { 'reads.0.exists': true, 'reads.0.before': null });
add('fully materialized local instance needs no overlay', { mode: 'overlay', request: input() }, { result: null });
const defaults = base(); defaults.task.push({ name: '领取邮箱奖励', entry: '邮箱_入口', default_check: false, option: ['Choice'] });
defaults.option = { Choice: { type: 'select', default_case: 'B', cases: [{ name: 'A' }, { name: 'B', option: ['Count'] }] },
  Count: { type: 'input', inputs: [{ name: 'number', default: '12', pipeline_type: 'int' }] } };
add('new default materialization includes selected-branch option defaults and original disabled state', { mode: 'overlay', request: input(main(), {}, defaults) }, {
  'values.TaskItems.1.default_check': false, 'values.TaskItems.1.option.0.index': 1, 'values.TaskItems.1.option.0.sub_options.0.data.number': '12' });
add('history tombstone prevents deleted task revival', { mode: 'overlay', request: input({ ...local, CurrentTasks: ['领取每日奖励:采购_入口'] }, { TaskItems: [] }) }, {
  'values.TaskItems': [], 'values.CurrentTasks': ['领取每日奖励<|||>采购_入口'] });
const other = { ...inherited, 'Instance.other.TaskItems': [{ name: 'other-account', entry: 'other-account', default_check: false }] };
add('other instance never replaces selected inherited values', { mode: 'overlay', request: input(local, other) }, { 'values.TaskItems.0.name': '领取每日奖励' });
for (const ready of [false, null]) add('not ready/unknown retains launch block ' + ready, { mode: 'readiness', ready, request: input() }, {
  'diagnostics.0.code': 'maas_launch_owner_required' });
add('verified ready skips launch without synthesizing a software path', { mode: 'readiness', ready: true, request: input() }, { diagnostics: [], configPatches: [] });
add('public adapter does not trust payload readiness without Host contract', { mode: 'wire', request: { ...input(), targetReady: true } }, { 'diagnostics.0.code': 'maas_launch_owner_required' });

fs.mkdirSync(output, { recursive: true });
const plugin = path.join(repo, 'plugins/specialized/maas');
const files = JSON.parse(fs.readFileSync(path.join(plugin, 'adapter/sources.json'), 'utf8')).map(relative => path.join(relative.startsWith('adapter-runtime/') ? repo : plugin, relative));
const sources = files.map(file => ({ path: file, bytes: fs.readFileSync(file) }));
const wrapper = `const officialAdapter = nexusTaskAdapter;
globalThis.nexusTaskAdapter = input => {
  if (input.mode === 'wire') return officialAdapter(input.request);
  const config = maasRead(input.request);
  if (input.mode === 'readiness') return maasConfiguration(input.request, config, input.ready);
  const overlay = maasOverlayPlan(config);
  return overlay ?? { result: null };
};`;
const script = sources.map(source => source.bytes.toString('utf8')).join('\n') + '\n' + wrapper;
const results = [];
for (const row of cases) {
  const before = JSON.stringify(row.input);
  try {
    const context = vm.createContext({ input: structuredClone(row.input) }, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(script, context, { timeout: 2000 });
    const actual = JSON.parse(JSON.stringify(vm.runInContext('nexusTaskAdapter(input)', context, { timeout: 2000 })));
    for (const [selector, expected] of Object.entries(row.expect)) assert.deepEqual(selector.split('.').reduce((value, key) => value[key], actual), expected);
    assert.equal(JSON.stringify(row.input), before); results.push({ name: row.name, status: 'PASS' });
  } catch (error) { results.push({ name: row.name, status: 'FAIL', error: error.message }); }
}
fs.writeFileSync(path.join(output, 'adapter.js'), script);
fs.writeFileSync(path.join(output, 'cases.json'), JSON.stringify(cases, null, 2) + '\n');
const command = ['dotnet', nativeProbe, path.join(output, 'adapter.js'), path.join(output, 'cases.json'), path.join(output, 'native-report.json'), interpreter];
const result = results.every(row => row.status === 'PASS') ? spawnSync(command[0], command.slice(1), { encoding: 'utf8' }) : { status: 1, stdout: '', stderr: '' };
fs.writeFileSync(path.join(output, 'native.log'), (result.stdout ?? '') + (result.stderr ?? ''));
const report = { status: result.status === 0 ? 'PASS' : 'FAIL', scope: 'Pure internal materialization/readiness policy via Node and actual production BoundedTaskScript; not new wire fields, Host CAS, TargetProbe or installed qualification',
  cases: cases.length, results, command, exitCode: result.status, sources: sources.map(source => ({ path: source.path, sha256: sha(source.bytes) })), wrapperSha256: sha(wrapper), nativeReceipt };
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, cases: cases.length, failed: results.filter(row => row.status === 'FAIL'), output }));
process.exitCode = report.status === 'PASS' ? 0 : 1;
