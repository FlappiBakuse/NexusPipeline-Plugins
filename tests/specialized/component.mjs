import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const [root, extensionId, output] = process.argv.slice(2);
if (![root, output].every(value => value && path.isAbsolute(value)) || !/^[a-z][a-z0-9-]*$/.test(extensionId))
  throw Error('Explicit repository, extension and external output required');
if (output.startsWith(root + path.sep) || fs.existsSync(path.join(output, 'node-report.json'))) throw Error('Preserve source and previous reports');
fs.mkdirSync(output, { recursive: true });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plugin = path.join(root, 'plugins', extensionId === 'maa-framework' ? 'managed' : 'specialized', extensionId);
const paths = JSON.parse(fs.readFileSync(path.join(plugin, 'adapter/sources.json')));
const sources = paths.map(relative => {
  const file = path.join(relative.startsWith('adapter-runtime/') ? root : plugin, relative), bytes = fs.readFileSync(file);
  return { path: file, sha256: sha(bytes), sizeBytes: bytes.length, content: bytes.toString('utf8') };
});
const assembled = spawnSync(process.env.NEXUS_TEST_PYTHON_EXE || 'python', ['-B',
  path.join(root, 'tests/specialized/assemble.py'), root, extensionId, output], { encoding: 'utf8' });
if (assembled.status !== 0) throw new Error('Production adapter assembly failed: ' + assembled.stderr);
const assembly = JSON.parse(assembled.stdout), script = fs.readFileSync(path.join(output, 'adapter.js'), 'utf8');
const invoke = (input, sourceFiles = {}) => {
  const context = vm.createContext({ input: structuredClone(input), nexusReadSource: name =>
    Object.hasOwn(sourceFiles, name) ? JSON.stringify(sourceFiles[name]) : 'null' }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(script, context, { timeout: 2000 });
  return JSON.parse(JSON.stringify(vm.runInContext('nexusTaskAdapter(input)', context, { timeout: 2000 })));
};
const module = await import(pathToFileURL(path.join(root, 'tests/specialized', extensionId, 'cases.mjs')).href);
const rows = module.cases(invoke), results = [];
if (!rows.length) throw Error('Empty component selection');
for (const row of rows) {
  const start = performance.now(), original = JSON.stringify(row.input);
  try {
    if (row.error) assert.throws(() => invoke(row.input, row.sourceFiles), error => error.message.includes(row.error));
    else {
      const response = invoke(row.input, row.sourceFiles);
      for (const [selector, expected] of Object.entries(row.expect))
        assert.deepEqual(selector.split('.').reduce((value, key) => value[key], response), expected, row.name + ': ' + selector);
    }
    assert.equal(JSON.stringify(row.input), original, 'Adapter mutated source input');
    results.push({ name: row.name, status: 'PASS', elapsedMs: performance.now() - start });
  } catch (error) { results.push({ name: row.name, status: 'FAIL', error: String(error) }); }
}
const report = { status: results.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL', caseCount: rows.length,
  scope: 'Source-derived synthetic adapter cases; no installed Host or upstream execution', command: process.argv,
  sources: sources.map(({ content, ...item }) => item), assembledInputs: assembly.records, adapterSha256: sha(script), results };
fs.writeFileSync(path.join(output, 'adapter.js'), script);
fs.writeFileSync(path.join(output, 'cases.json'), JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'node-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, caseCount: report.caseCount, failures: results.filter(row => row.status === 'FAIL').length }));
process.exitCode = report.status === 'PASS' ? 0 : 1;
