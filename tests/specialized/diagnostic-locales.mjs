import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { configurationDiagnosticCases } from './diagnostic-cases.mjs';

const [root, output] = process.argv.slice(2);
if (![root, output].every(value => value && path.isAbsolute(value)) || output.startsWith(root + path.sep))
  throw Error('Explicit source and external output required');
const receipt = path.join(output, 'receipt.json');
if (fs.existsSync(receipt)) throw Error('Preserve previous diagnostic locale evidence');
fs.mkdirSync(output, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inputs = new Map(), cases = [];
function pin(file) { const bytes = fs.readFileSync(file); inputs.set(file, sha(bytes)); return bytes; }
pin(import.meta.filename);
pin(path.join(root, 'tests/specialized/maa-fixture.mjs'));
pin(path.join(root, 'tests/specialized/locale-fixtures.mjs'));
pin(path.join(root, 'tests/specialized/diagnostic-cases.mjs'));
const fixtureRoot = path.join(output, 'locale-fixtures');
const generated = spawnSync(process.execPath, [path.join(root, 'tests/specialized/locale-fixtures.mjs'), root, fixtureRoot], { encoding: 'utf8' });
if (generated.status !== 0) throw Error(generated.stderr || generated.stdout);
const fixtures = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'fixtures.json')));
for (const id of ['baah', 'bettergi', 'march7th', 'oknte', 'okww', 'zzzonedragon', 'maaend', 'maas']) {
  const directory = path.join(output, id);
  fs.mkdirSync(directory, { recursive: true });
  const assembled = spawnSync(process.env.NEXUS_TEST_PYTHON_EXE || 'python', ['-B',
    path.join(root, 'tests/specialized/assemble.py'), root, id, directory], { encoding: 'utf8' });
  if (assembled.status !== 0) throw Error(assembled.stderr || assembled.stdout);
  const assembly = JSON.parse(assembled.stdout), script = fs.readFileSync(path.join(directory, 'adapter.js'), 'utf8');
  for (const name of fs.readdirSync(path.join(root, 'tests/specialized', id)))
    if (name.endsWith('.mjs')) pin(path.join(root, 'tests/specialized', id, name));
  const invoke = (input, sourceFiles = {}) => {
    const context = vm.createContext({ input: structuredClone(input), nexusReadSource: name =>
      Object.hasOwn(sourceFiles, name) ? JSON.stringify(sourceFiles[name]) : 'null' }, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(script, context, { timeout: 2000 });
    return JSON.parse(JSON.stringify(vm.runInContext('nexusTaskAdapter(input)', context, { timeout: 2000 })));
  };
  const module = await import(pathToFileURL(path.join(root, 'tests/specialized', id, 'cases.mjs')).href);
  const rows = module.cases(invoke).filter(row => ['discover', 'configuration'].includes(row.input.phase) && !row.error);
  const fixture = fixtures.cases.find(row => row.extensionId === id);
  assert.ok(fixture, id + ': installed preview inputs required');
  for (const phase of ['discover', 'configuration']) rows.push({ name: 'installed preview inputs: ' + phase,
    input: { format: 'nexus.task.adapter', version: 1, direction: 'request', phase, extensionId: id,
      operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: fixture.resources }, sourceFiles: fixture.sourceFiles });
  rows.push(...configurationDiagnosticCases(id, fixture, invoke));
  assert.ok(rows.length > 0, id + ': configuration/discovery cases required');
  const localePath = path.join(root, 'plugins/specialized', id, 'locale.ts');
  pin(localePath);
  const { locales } = await import(pathToFileURL(localePath).href);
  const dictionaries = Object.fromEntries(Object.entries(locales).map(([locale, value]) => [locale, value.diagnostics]));
  const diagnostics = new Map();
  const readRefusals = [];
  for (const row of rows) {
    if (row.error) {
      assert.throws(() => invoke(row.input, row.sourceFiles), error => error.message.includes(row.error));
      readRefusals.push({ name: row.name, reason: row.error });
      continue;
    }
    const original = JSON.stringify(row.input), result = invoke(row.input, row.sourceFiles);
    if (row.expectedDiagnosticCode) assert.ok(result.diagnostics?.some(item => item.code === row.expectedDiagnosticCode), row.name);
    for (const diagnostic of result.diagnostics ?? []) {
      for (const [locale, messages] of Object.entries(dictionaries))
        assert.ok(typeof messages[diagnostic.code] === 'string' && messages[diagnostic.code].trim(), id + ':' + locale + ':' + diagnostic.code);
      const value = diagnostics.get(diagnostic.code) ?? { code: diagnostic.code, severity: diagnostic.severity, cases: [] };
      value.cases.push(row.name); diagnostics.set(diagnostic.code, value);
    }
    assert.equal(JSON.stringify(row.input), original, 'Source input changed: ' + row.name);
  }
  cases.push({ extensionId: id, caseCount: rows.length, adapterSha256: sha(script),
    sourceInputs: assembly.records, diagnostics: [...diagnostics.values()], readRefusals });
}
for (const [file, digest] of inputs) assert.equal(sha(fs.readFileSync(file)), digest, 'Input changed: ' + file);
const report = { status: 'PASS', scope: 'Source-derived synthetic configuration/discovery diagnostics and both dictionary locales; installed UI and upstream execution are separate scopes',
  command: process.argv, sourceMode: 'local-uncommitted', commit: null, tree: null,
  caseCount: cases.reduce((total, row) => total + row.caseCount, 0),
  diagnosticCodes: cases.reduce((total, row) => total + row.diagnostics.length, 0),
  inputs: Object.fromEntries(inputs), cases };
fs.writeFileSync(receipt, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, caseCount: report.caseCount, diagnosticCodes: report.diagnosticCodes, receipt }));
