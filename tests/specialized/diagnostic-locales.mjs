import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { configurationDiagnosticCases } from './diagnostic-cases.mjs';
import { prepareLocaleFixtures } from './locale-fixtures.mjs';
import { request } from './maa-fixture.mjs';

const [root, output] = process.argv.slice(2);
if (![root, output].every(value => value && path.isAbsolute(value)) || output.startsWith(root + path.sep))
  throw Error('Explicit source and external output required');
const receipt = path.join(output, 'receipt.json');
if (fs.existsSync(receipt)) throw Error('Preserve previous diagnostic locale evidence');
fs.mkdirSync(output, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inputs = new Map(), cases = [];
function pin(file) {
  const digest = sha(fs.readFileSync(file));
  if (inputs.has(file)) assert.equal(digest, inputs.get(file), 'Input changed: ' + file);
  inputs.set(file, digest);
  return digest;
}
function verifyLocales({ fixture, rows, invoke, locales }) {
  const id = fixture.extensionId;
  const diagnostics = new Map();
  const readRefusals = [];
  for (const row of rows) {
    if (row.error) {
      assert.throws(() => invoke(row.input, row.sourceFiles), error => error.message.includes(row.error));
      readRefusals.push({ name: row.name, reason: row.error });
      continue;
    }
    const observed = row.diagnostics ?? invoke(row.input, row.sourceFiles).diagnostics ?? [];
    if (row.expectedDiagnosticCode) assert.ok(observed.some(item => item.code === row.expectedDiagnosticCode), row.name);
    for (const diagnostic of observed) {
      for (const locale of ['zh-CN', 'en-US']) {
        const message = locales[locale]?.diagnostics[diagnostic.code];
        assert.ok(typeof message === 'string' && message.trim(), id + ':' + locale + ':' + diagnostic.code);
      }
      const value = diagnostics.get(diagnostic.code) ?? { code: diagnostic.code, severity: diagnostic.severity, cases: [] };
      value.cases.push(row.name); diagnostics.set(diagnostic.code, value);
    }
  }
  assert.ok(diagnostics.size, id + ': diagnostic locale coverage required');
  return { extensionId: id, caseCount: rows.length, adapterSha256: fixture.adapterSha256,
    sourceInputs: fixture.sourceInputs, diagnostics: [...diagnostics.values()], readRefusals };
}

const prepared = [];
const preparation = { status: 'NOT_RUN' };
const responsibilities = { lint: 'NOT_RUN', typecheck: 'NOT_RUN', test: 'NOT_RUN', build: 'NOT_RUN' };
let failure;
let inputsUnchanged = null;
try {
  pin(import.meta.filename);
  for (const file of ['assemble.py', 'maa-fixture.mjs', 'locale-fixtures.mjs', 'diagnostic-cases.mjs'])
    pin(path.join(root, 'tests/specialized', file));
  for await (const { fixture, rows: componentRows, invoke } of prepareLocaleFixtures(root, output)) {
    const id = fixture.extensionId;
    const plugin = path.join(root, 'plugins/specialized', id);
    for (const name of fs.readdirSync(path.join(root, 'tests/specialized', id)))
      if (name.endsWith('.mjs')) pin(path.join(root, 'tests/specialized', id, name));
    for (const { path: relative, sha256 } of fixture.sourceInputs) {
      const file = path.join(relative.startsWith('adapter-runtime/') ? root : plugin, relative);
      assert.equal(pin(file), sha256, 'Adapter source changed: ' + relative);
    }
    const rows = componentRows.filter(row => ['discover', 'configuration'].includes(row.input.phase) && !row.error);
    rows.push({ name: 'installed preview inputs: discover', diagnostics: fixture.diagnostics },
      { name: 'installed preview inputs: configuration', input: request(id, 'configuration', fixture.resources),
        sourceFiles: fixture.sourceFiles }, ...configurationDiagnosticCases(id, fixture, componentRows));
    const { locales } = await import(pathToFileURL(path.join(plugin, 'locale.ts')).href);
    prepared.push({ fixture, rows, invoke, locales });
  }
  assert.ok(prepared.length, 'No diagnostic fixtures prepared');
  preparation.status = 'PASS';
  for (const item of prepared) cases.push(verifyLocales(item));
  responsibilities.test = 'PASS';
  inputsUnchanged = false;
  for (const [file, digest] of inputs) assert.equal(sha(fs.readFileSync(file)), digest, 'Input changed: ' + file);
  inputsUnchanged = true;
} catch (error) {
  failure = String(error);
  if (preparation.status !== 'PASS') preparation.status = 'FAIL';
  else if (responsibilities.test === 'NOT_RUN') responsibilities.test = 'FAIL';
}
const failed = failure !== undefined;
const report = { status: failed ? 'FAIL' : 'PASS', ...(failed ? { error: failure } : {}),
  scope: 'Source-derived synthetic configuration/discovery diagnostics and both dictionary locales; installed UI and upstream execution are separate scopes',
  preparation: { ...preparation, adapters: prepared.map(item => item.fixture.extensionId) }, responsibilities,
  command: process.argv, sourceMode: 'local-uncommitted', commit: null, tree: null,
  caseCount: cases.reduce((total, row) => total + row.caseCount, 0),
  diagnosticCodes: cases.reduce((total, row) => total + row.diagnostics.length, 0),
  inputs: Object.fromEntries(inputs), inputsUnchanged, cases };
fs.writeFileSync(receipt, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, caseCount: report.caseCount, diagnosticCodes: report.diagnosticCodes, receipt }));
if (failed) console.error(failure);
process.exitCode = failed ? 1 : 0;
