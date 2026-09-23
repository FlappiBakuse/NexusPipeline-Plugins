import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--source-root' || args[2] !== '--host-root' || args[4] !== '--output')
  throw new Error('Usage: --source-root <locked MXU source> --host-root <Host checkout> --output <new report>');
const sourceRoot = path.resolve(args[1]);
const require = createRequire(path.join(path.resolve(args[3]), 'frontend', 'package.json'));
const ts = require('typescript');
const lock = JSON.parse(fs.readFileSync(new URL('./task-protocol/source-lock.json', import.meta.url))).mxu;
const cases = [], files = {};
const sandbox = { logToStdout: message => sandbox.logs.push(message), logs: [] };
vm.createContext(sandbox);
function load(relative, names) {
  const bytes = fs.readFileSync(path.join(sourceRoot, relative));
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, lock.files[relative], `Locked source: ${relative}`);
  files[relative] = digest;
  const ast = ts.createSourceFile(relative, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
    || ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 && names.includes(node.declarationList.declarations[0].name?.text));
  assert.equal(declarations.length, names.length);
  const source = declarations.map(node => node.getText(ast)).join('\n');
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  sandbox.exports = {};
  vm.runInContext(javascript, sandbox, { timeout: 1000 });
  Object.assign(sandbox, sandbox.exports);
}
function check(name, action) { action(); cases.push({ name, status: 'PASS' }); }
load('src/services/contentResolver.ts', ['resolveI18nText']);
check('translated label', () => assert.equal(sandbox.resolveI18nText('$task.key', { 'task.key': 'Translated' }), 'Translated'));
check('missing dictionary preserves key', () => assert.equal(sandbox.resolveI18nText('$task.key'), 'task.key'));
check('empty translation preserves key', () => assert.equal(sandbox.resolveI18nText('$task.key', { 'task.key': '' }), 'task.key'));
check('custom literal preserved', () => assert.equal(sandbox.resolveI18nText('<b>Custom</b>'), '<b>Custom</b>'));
load('src/utils/taskRunFilter.ts', ['isTaskSelectedForRun', 'filterTasksForRun']);
check('runtime runOnce selection', () => assert.equal(sandbox.isTaskSelectedForRun({ enabled: false, runOnce: true }), true));
check('disabled persisted selection', () => assert.equal(sandbox.isTaskSelectedForRun({ enabled: false }), false));
check('normal startup excludes disabled', () => assert.equal(sandbox.filterTasksForRun([{ id: 'a', enabled: true }, { id: 'b', enabled: false }]).map(t => t.id).join(','), 'a'));
load('src/stores/appStore.ts', ['isTaskControllerCompatible', 'resolveTaskEnabledForController', 'forwardLogToStdout']);
check('cache applies on controller switch', () => assert.equal(sandbox.resolveTaskEnabledForController({ enabled: false }, {}, 'old', 'new', { new: true }), true));
check('incompatible controller remains disabled', () => assert.equal(sandbox.resolveTaskEnabledForController({ enabled: true }, { controller: ['old'] }, 'old', 'new', { new: true }), false));
check('compatible switch inherits enabled', () => assert.equal(sandbox.resolveTaskEnabledForController({ enabled: true }, {}, 'old', 'new', {}), true));
check('stdout strips markup and trims whole line', () => {
  sandbox.forwardLogToStdout('  任务开始: <b>Custom</b>  ');
  assert.equal(sandbox.logs[0], '任务开始: Custom');
});
load('src/stores/helpers.ts', ['createDefaultOptionValue', 'sanitizeOptionValue']);
check('switch defaults to first Yes case', () => assert.equal(sandbox.createDefaultOptionValue({ type: 'switch', cases: [{ name: 'Yes' }, { name: 'No' }] }).value, true));
check('explicit No default wins', () => assert.equal(sandbox.createDefaultOptionValue({ type: 'switch', default_case: 'No', cases: [{ name: 'Yes' }, { name: 'No' }] }).value, false));
check('reversed switch order defaults off', () => assert.equal(sandbox.createDefaultOptionValue({ type: 'switch', cases: [{ name: 'No' }, { name: 'Yes' }] }).value, false));
check('mismatched saved option type resets to defaults', () => assert.equal(sandbox.sanitizeOptionValue('mail', { type: 'select', caseName: 'No' }, { mail: { type: 'switch', cases: [{ name: 'Yes' }, { name: 'No' }] } }), null));
check('explicit saved false is preserved', () => assert.equal(sandbox.sanitizeOptionValue('mail', { type: 'switch', value: false }, { mail: { type: 'switch', cases: [{ name: 'Yes' }, { name: 'No' }] } }).value, false));
// Execute the original async focus dispatch with controlled content resolution;
// no React hook, network, image decoder, or target task is executed.
load('src/utils/useMaaCallbackLogger.ts', ['parseFocusEntry', 'handleCallback']);
sandbox.useAppStore = { getState: () => ({}) };
sandbox.getTaskDisplayName = (_instance, taskId) => ({ 11: 'First', 22: 'Second' })[taskId];
const pendingFocus = new Map(), focusLogs = [];
sandbox.resolveFocusContent = (template, details) => new Promise(resolve => pendingFocus.set(details.task_id, () => resolve({ message: template })));
const translation = (key, values) => key + ': ' + values.name;
const append = (instance, entry) => { focusLogs.push({ instance, ...entry }); sandbox.forwardLogToStdout(entry.message); };
sandbox.logs.length = 0;
sandbox.handleCallback('instance', 'Node.Action.Failed', { task_id: 11, focus: { 'Node.Action.Failed': 'Synthetic delayed focus failure' } }, translation, append);
sandbox.handleCallback('instance', 'Tasker.Task.Starting', { task_id: 22 }, translation, append);
check('focus resolution is not ordered with next task callback', () => {
  assert.equal(focusLogs.length, 1);
  assert.equal(focusLogs[0].message, 'logs.messages.taskStarting: Second');
});
pendingFocus.get(11)();
await Promise.resolve();
await Promise.resolve();
check('resolved focus drops originating task id from log entry', () => {
  assert.equal(focusLogs.length, 2);
  assert.equal(focusLogs[1].type, 'focus');
  assert.equal(Object.hasOwn(focusLogs[1], 'task_id'), false);
  assert.equal(focusLogs[1].message, 'Synthetic delayed focus failure');
});
check('stdout focus cannot identify originating task', () => {
  assert.equal(sandbox.logs.join('\n'), 'logs.messages.taskStarting: Second\nSynthetic delayed focus failure');
});
const focusExperiment = { logs: focusLogs, stdout: [...sandbox.logs],
  limitation: 'Controlled resolver timing proves anonymous focus may arrive after a later task starts. No latest-task attribution is justified.' };
const output = { repository: lock.repository, commit: lock.commit, files, cases, focusExperiment,
  method: 'SHA-guarded original TypeScript function declarations transpiled without rewriting function bodies; pure dependencies and stdout capture only.' };
fs.writeFileSync(path.resolve(args[5]), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(`PASS ${cases.length} locked original MXU branches`);
