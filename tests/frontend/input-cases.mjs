import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleInputs, previousBuild } from '../../tooling/frontend_inputs.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const workRoot = process.env.NEXUS_FRONTEND_WORK_ROOT;
const testRoot = process.env.NEXUS_TEST_ROOT;
if (!workRoot || !testRoot) throw new Error('Pass explicit frontend dependency and external test roots');

function fixture(action) {
  const root = fs.mkdtempSync(path.join(testRoot, 'frontend-inputs-'));
  const repository = path.join(root, 'repository'), sdk = path.join(root, 'sdk');
  const write = (name, text) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  write('repository/src/index.ts', "import type { Shape } from './shape.js';import './style.css';import type { Public } from '@nexuspipeline/extension-sdk';export const main: Shape = {};");
  write('repository/src/shape.ts', 'export interface Shape { value?: string }');
  write('repository/src/style.css', '@import "./detail.css";');
  write('repository/src/detail.css', 'body{color:red}');
  write('sdk/sdk/frontend/src/index.ts', 'export interface Public {}');
  const inputs = () => moduleInputs(repository, sdk, path.join(repository, 'src/index.ts'), workRoot);
  try { action({ root, repository, sdk, write, inputs }); }
  finally {
    const resolved = fs.realpathSync(root);
    if (path.dirname(resolved) !== fs.realpathSync(testRoot)) throw new Error('Fixture cleanup escaped its test root');
    fs.rmSync(resolved, { recursive: true });
  }
}

test('module closure includes type-only imports, SDK and nested CSS', () => fixture(({ inputs }) => {
  const value = inputs();
  assert.deepEqual(value.source.map(item => item.path), ['src/detail.css', 'src/index.ts', 'src/shape.ts', 'src/style.css']);
  assert.deepEqual(value.sdk.map(item => item.path), ['sdk/frontend/src/index.ts']);
}));

test('unrelated frontend changes retain the selected module identity', () => fixture(({ write, inputs }) => {
  const original = inputs();
  write('repository/other/index.ts', 'export const changed = true;');
  assert.deepEqual(original, inputs());
  write('repository/src/shape.ts', 'export interface Shape { value?: number }');
  assert.notDeepEqual(original, inputs());
}));

test('SDK or imported CSS bytes invalidate the selected module', () => fixture(({ write, inputs }) => {
  const original = inputs();
  write('sdk/sdk/frontend/src/index.ts', 'export interface Public { value: string }');
  const next = inputs(); assert.notDeepEqual(original, next);
  write('repository/src/detail.css', 'body{color:blue}');
  assert.notDeepEqual(next, inputs());
}));

test('unresolved dynamic imports refuse a guessed module closure', () => fixture(({ write, inputs }) => {
  write('repository/src/index.ts', 'const name="./shape.js";import(name);');
  assert.throws(inputs, /Dynamic frontend imports/);
}));

test('failed builds cannot claim unknown files and can reuse verified artifacts', () => fixture(({ root, write }) => {
  const output = path.join(root, 'output');
  function record(value) {
    const raw = JSON.stringify(value) + '\n', digest = hash(raw);
    write('output/runs/' + digest + '.json', raw);
    write('output/build-receipt.json', raw);
    return digest;
  }
  const failure = { status: 'FAIL', previousSuccess: null };
  record(failure);
  assert.equal(previousBuild(output).value, null);
  write('output/module/main.js', 'compiled-output');
  assert.throws(() => previousBuild(output), /unowned artifacts/);
  const success = { status: 'PASS', artifacts: [{ path: 'module/main.js', sha256: hash('compiled-output') }] };
  const previousSuccess = record(success);
  record({ ...failure, previousSuccess });
  assert.deepEqual(previousBuild(output).value, success);
  write('output/module/unowned.js', 'unexpected-output');
  assert.throws(() => previousBuild(output), /inventory changed/);
}));
