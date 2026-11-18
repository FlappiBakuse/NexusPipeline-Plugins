import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const [root, output] = process.argv.slice(2);
if (![root, output].every(value => value && path.isAbsolute(value)) || output.startsWith(root + path.sep))
  throw Error('Explicit repository and external output required');
fs.mkdirSync(output, { recursive: true });
const tasks = [{ taskId: 'selected', isEnabled: true, isSelected: true },
  { taskId: 'unselected', isEnabled: true, isSelected: false }, { taskId: 'disabled', isEnabled: false, isSelected: true }];
const vectors = [{ name: 'omitted', input: {}, selected: [true, false, true] },
  { name: 'empty', input: { selectedTaskIds: [] }, selected: [false, false, false] },
  { name: 'subset', input: { selectedTaskIds: ['selected'] }, selected: [true, false, false] },
  ...[['selected', 'selected'], ['foreign'], ['unselected'], ['disabled'], 'selected'].map((ids, index) =>
    ({ name: 'rejected-' + index, input: { selectedTaskIds: ids }, error: true }))];
const results = [];
for (const id of ['maaend', 'maas', 'maa-framework']) {
  const directory = path.join(output, id);
  const assembled = spawnSync('python', ['-B', path.join(root, 'tests/specialized/assemble.py'), root, id, directory], { encoding: 'utf8' });
  if (assembled.status !== 0) throw Error(assembled.stderr || assembled.stdout);
  const program = new vm.Script(fs.readFileSync(path.join(directory, 'adapter.js'), 'utf8'));
  for (const vector of vectors) {
    const context = vm.createContext({ tasks: structuredClone(tasks), input: vector.input }, { codeGeneration: { strings: false, wasm: false } });
    program.runInContext(context, { timeout: 2000 });
    const invoke = () => vm.runInContext("maaObservationTasks(input, tasks, 'fixture')", context, { timeout: 2000 });
    if (vector.error) assert.throws(invoke, /fixture_observation_selection_unbound/);
    else assert.deepEqual(JSON.parse(JSON.stringify(invoke())).map(task => task.isSelected), vector.selected);
    assert.deepEqual(JSON.parse(JSON.stringify(context.tasks)), tasks);
    results.push({ extension: id, vector: vector.name, status: 'PASS' });
  }
  fs.writeFileSync(path.join(directory, 'inputs.json'), JSON.stringify(JSON.parse(assembled.stdout).records, null, 2) + '\n');
}
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify({ status: 'PASS', scope: 'Shared protocol vectors on the three production-assembled scripts',
  sourceMode: 'local-uncommitted', sourceCommit: null, sourceTree: null, results }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', cases: results.length }));
