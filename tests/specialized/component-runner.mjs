import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function assertResponse(row, response) {
  for (const [selector, expected] of Object.entries(row.expect)) {
    const steps = selector.split('.');
    const label = row.name + ': ' + selector;
    if (steps[0] === 'diagnostics' && steps.length === 2) {
      assert.ok(response.diagnostics?.some(item => item.code === steps[1] && item.severity === expected),
        label + ' requires severity ' + expected);
    } else {
      assert.deepEqual(steps.reduce((value, key) => value[key], response), expected, label);
    }
  }
}

export async function runComponent(root, extensionId, output, select, details) {
  const relative = path.relative(root, output);
  const receipt = path.join(output, 'node-report.json');
  if ((!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) || fs.existsSync(receipt))
    throw Error('Preserve source and previous reports');
  fs.mkdirSync(output, { recursive: true });
  const preparation = { assembly: 'NOT_RUN', vectors: 'NOT_RUN' };
  const results = [];
  let rows, invoke, error, assembledInputs, adapterSha256;
  try {
    const assembled = spawnSync(process.env.NEXUS_TEST_PYTHON_EXE || 'python', ['-B',
      path.join(root, 'tests/specialized/assemble.py'), root, extensionId, output], { encoding: 'utf8' });
    if (assembled.status !== 0) throw assembled.error ?? Error(assembled.stderr || assembled.stdout || 'Adapter assembly failed');
    assembledInputs = JSON.parse(assembled.stdout).records;
    const script = fs.readFileSync(path.join(output, 'adapter.js'));
    const program = new vm.Script(script.toString('utf8'));
    adapterSha256 = createHash('sha256').update(script).digest('hex');
    preparation.assembly = 'PASS';
    invoke = (input, sourceFiles = {}) => {
      const context = vm.createContext({ input: structuredClone(input), nexusReadSource: name =>
        Object.hasOwn(sourceFiles, name) ? JSON.stringify(sourceFiles[name]) : 'null' }, { codeGeneration: { strings: false, wasm: false } });
      program.runInContext(context, { timeout: 2000 });
      return JSON.parse(JSON.stringify(vm.runInContext('nexusTaskAdapter(input)', context, { timeout: 2000 })));
    };
    rows = await select(invoke);
    if (!Array.isArray(rows) || !rows.length || rows.some(row => typeof row?.name !== 'string'))
      throw Error('Missing or invalid component vectors');
    fs.writeFileSync(path.join(output, 'cases.json'), JSON.stringify(rows, null, 2) + '\n');
    preparation.vectors = 'PASS';
  } catch (failure) {
    preparation[preparation.assembly === 'PASS' ? 'vectors' : 'assembly'] = 'FAIL';
    error = String(failure);
  }
  if (preparation.vectors === 'PASS') for (const row of rows) {
    const start = performance.now();
    try {
      if (row.error) assert.throws(() => invoke(row.input, row.sourceFiles), failure => failure.message.includes(row.error));
      else assertResponse(row, invoke(row.input, row.sourceFiles));
      results.push({ name: row.name, status: 'PASS', elapsedMs: performance.now() - start });
    } catch (failure) { results.push({ name: row.name, status: 'FAIL', error: String(failure) }); }
  }
  const failures = results.filter(row => row.status === 'FAIL').length;
  const test = results.length ? (failures ? 'FAIL' : 'PASS') : 'NOT_RUN';
  const status = test === 'PASS' ? 'PASS' : 'FAIL';
  const responsibilities = { lint: 'NOT_RUN', typecheck: 'NOT_RUN', test, build: 'NOT_RUN' };
  const report = { status, ...details, caseCount: results.length, command: process.argv,
    assembledInputs, adapterSha256, preparation, responsibilities, error, results };
  fs.writeFileSync(receipt, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status, caseCount: results.length, failures }));
  process.exitCode = status === 'PASS' ? 0 : 1;
}
