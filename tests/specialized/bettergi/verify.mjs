import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cases, sha } from './cases.mjs';
import { streamCases, configurationCases } from './stream-cases.mjs';

const flags = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, values) =>
  value.startsWith('--') ? [...rows, [value.slice(2), values[index + 1]]] : rows, []));
if (!flags.output || !path.isAbsolute(flags.output)) throw new Error('--output must be an explicit absolute external directory');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = path.resolve(flags.output), plugin = path.join(root, 'plugins/specialized/bettergi');
if (output.startsWith(root + path.sep)) throw new Error('Test output must stay outside product source');
fs.mkdirSync(output, { recursive: true });
const inputs = JSON.parse(fs.readFileSync(path.join(plugin, 'adapter/sources.json'), 'utf8'));
const sources = inputs.map(relativePath => {
  const owner = relativePath.startsWith('adapter-runtime/') ? root : plugin;
  const content = fs.readFileSync(path.join(owner, relativePath), 'utf8');
  return { relativePath, sha256: sha(content), content };
});
const assembled = spawnSync(process.env.NEXUS_TEST_PYTHON_EXE || 'python', ['-B',
  path.join(root, 'tests/specialized/assemble.py'), root, 'bettergi', output], { encoding: 'utf8' });
if (assembled.status !== 0) throw new Error('Production adapter assembly failed: ' + assembled.stderr);
const assembly = JSON.parse(assembled.stdout), script = fs.readFileSync(path.join(output, 'adapter.js'), 'utf8');
const invoke = input => {
  const context = vm.createContext({ input: structuredClone(input) }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(script, context, { timeout: 2000 });
  return JSON.parse(JSON.stringify(vm.runInContext('nexusTaskAdapter(input)', context, { timeout: 2000 })));
};
const rows = [...cases(invoke), ...streamCases(invoke), ...configurationCases(invoke)], results = [];
for (const row of rows) {
  const started = performance.now();
  try {
    if (row.error) assert.throws(() => invoke(row.input), error => error.message.includes(row.error));
    else {
      const before = JSON.stringify(row.input), response = invoke(row.input);
      for (const [selector, expected] of Object.entries(row.expect))
        assert.deepEqual(selector.split('.').reduce((value, key) => value[key], response), expected, row.name + ': ' + selector);
      assert.equal(JSON.stringify(row.input), before, 'Adapter cannot mutate caller resource snapshots');
    }
    results.push({ name: row.name, status: 'PASS', elapsedMs: performance.now() - started });
  } catch (error) {
    results.push({ name: row.name, status: 'FAIL', error: error.message, elapsedMs: performance.now() - started });
  }
}
fs.writeFileSync(path.join(output, 'adapter.js'), script, 'utf8');
fs.writeFileSync(path.join(output, 'cases.json'), JSON.stringify(rows, null, 2) + '\n', 'utf8');
const receipt = { status: results.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL',
  scope: 'Source-derived synthetic four-phase cases in Node VM; not installed Host or upstream binary qualification',
  command: process.argv, sources: sources.map(({ content, ...item }) => item), assembledInputs: assembly.records, adapterSha256: sha(script),
  caseCount: rows.length, results, upstreamBinary: 'NOT_RUN', actualHost: 'NOT_RUN' };
fs.writeFileSync(path.join(output, 'node-report.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, caseCount: receipt.caseCount, failures: results.filter(row => row.status === 'FAIL') }));
if (receipt.status !== 'PASS') process.exitCode = 1;
