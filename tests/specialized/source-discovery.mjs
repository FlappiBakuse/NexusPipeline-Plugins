import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const requested = process.argv[2] ?? '';
const output = path.resolve(requested);
const relative = path.relative(root, output);
if (!path.isAbsolute(requested) || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) || fs.existsSync(output))
  throw Error('Explicit new external output required');
fs.mkdirSync(output, { recursive: true });
const scripts = new Map(), adapters = [], results = [];
let preparationError;
try {
  for (const id of ['baah', 'bettergi', 'march7th', 'oknte', 'okww', 'zzzonedragon', 'maaend', 'maas']) {
    const directory = path.join(output, id);
    const assembly = spawnSync(process.env.NEXUS_TEST_PYTHON_EXE || 'python', ['-B',
      path.join(root, 'tests/specialized/assemble.py'), root, id, directory], { encoding: 'utf8', timeout: 30000 });
    if (assembly.status !== 0) throw Error(id + ': ' + (assembly.error || assembly.stderr || assembly.stdout));
    const script = fs.readFileSync(path.join(directory, 'adapter.js'));
    scripts.set(id, new vm.Script(script.toString('utf8'), { filename: id + '/adapter.js' }));
    adapters.push({ extensionId: id, adapterSha256: createHash('sha256').update(script).digest('hex'),
      sourceInputs: JSON.parse(assembly.stdout).records });
  }
} catch (error) {
  preparationError = String(error);
}

function discover(extension, files) {
  const entries = new Map([['', new Map()]]);
  for (const file of Object.keys(files)) {
    const parts = file.split('/');
    for (let index = 0; index < parts.length; index++) {
      const parent = parts.slice(0, index).join('/');
      if (!entries.has(parent)) entries.set(parent, new Map());
      entries.get(parent).set(parts[index], index === parts.length - 1 ? 'file' : 'directory');
    }
  }
  const context = vm.createContext({
    nexusListSource(relative) {
      let parent = '';
      for (const name of relative ? relative.split('/') : []) {
        assert.equal(entries.get(parent)?.get(name), 'directory', 'Only observed exact directory names may be listed');
        parent = parent ? parent + '/' + name : name;
      }
      return JSON.stringify([...(entries.get(relative) || [])].map(([name, kind]) => ({ name, kind })));
    },
    nexusReadSource(relative) { assert.ok(Object.hasOwn(files, relative)); return files[relative]; }
  }, { codeGeneration: { strings: false, wasm: false } });
  scripts.get(extension).runInContext(context, { timeout: 1000 });
  const result = vm.runInContext(`JSON.stringify(nexusDiscoverScript(${JSON.stringify({ format: 'nexus.script.source', version: 1,
    direction: 'request', extensionId: extension, operationId: 'cc11af43-7f60-450b-a003-3458bbd197fe' })}))`, context, { timeout: 1000 });
  return JSON.parse(result);
}
function test(name, action) {
  if (preparationError !== undefined) return;
  try {
    action();
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error) });
  }
}
function resourcePaths(candidate) {
  return candidate.resources.map(({ resourceId, path }) => [resourceId, path]).sort();
}

const baah = { 'BAAH.exe': '', 'DATA/CONFIGS/software_config.json': '{}', 'BAAH_CONFIGS/one.json': '{}' };
test('BAAH single config uses its explicit filename and software config', () => {
  const result = discover('baah', baah); assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].arguments, ['one.json']);
  assert.deepEqual(resourcePaths(result.candidates[0]), [
    ['main', 'BAAH_CONFIGS/one.json'], ['software-config', 'DATA/CONFIGS/software_config.json']]);
  assert.deepEqual(result.candidates[0].logPaths, ['DATA/LOGS/log_*.txt']);
});
test('BAAH multiple configs remain distinct and no storage file is treated as a task config', () => {
  const result = discover('baah', { ...baah, 'BAAH_CONFIGS/two.json': '{}', 'DATA/USER_STORAGE/STORAGEabcd.json': '{}' });
  assert.deepEqual(result.candidates.map(item => item.candidateId).sort(), ['BAAH_CONFIGS/one.json', 'BAAH_CONFIGS/two.json']);
});
test('Missing BAAH executable yields no runnable source', () => {
  const { 'BAAH.exe': ignored, ...files } = baah; assert.equal(discover('baah', files).candidates.length, 0);
});
test('BAAH retains only the selected filename-derived progress storage including Unicode filenames', () => {
  for (const name of ['one.json', '账号 一.json', 'x'.repeat(100) + '.json']) {
    const selected = 'DATA/USER_STORAGE/STORAGE' + createHash('sha1').update(name).digest('hex').slice(0, 8) + '.json';
    const result = discover('baah', { 'BAAH.exe': '', 'DATA/CONFIGS/software_config.json': '{}',
      ['BAAH_CONFIGS/' + name]: '{}', [selected]: '{}', 'DATA/USER_STORAGE/STORAGEffffffff.json': '{}' });
    assert.deepEqual(result.candidates[0].resources.filter(row => row.resourceId === 'progress').map(row => row.path), [selected]);
  }
});
const bettergi = { 'BetterGI.exe': '', 'User/config.json': '{}', 'User/OneDragon/file.json': '{"Name":"显式配置"}' };
test('BetterGI command uses saved config name instead of filename', () => {
  assert.deepEqual(discover('bettergi', bettergi).candidates[0].arguments, ['startOneDragon', '显式配置']);
});
test('BetterGI duplicate names refuse ambiguous command line selection', () => {
  const result = discover('bettergi', { ...bettergi, 'User/OneDragon/duplicate.json': '{"Name":"显式配置"}' });
  assert.equal(result.candidates.length, 0); assert.deepEqual(result.diagnostics, ['bettergi_source_name_ambiguous']);
});
test('BetterGI malformed config is rejected without falling back to another config', () => {
  assert.throws(() => discover('bettergi', { ...bettergi, 'User/OneDragon/broken.json': '{' }), /bettergi_configuration_incomplete/);
});
test('March7th uses launcher and requires separate worker', () => {
  const files = { 'March7th Launcher.exe': '', 'March7th Assistant.exe': '', 'config.yaml': '{}' };
  assert.equal(discover('march7th', files).candidates[0].executable, 'March7th Launcher.exe');
  delete files['March7th Assistant.exe']; assert.equal(discover('march7th', files).candidates.length, 0);
});
for (const [extension, app, task, launchNumber] of [
  ['oknte', 'ok-nte', 'DailyRoutineTask', '2'],
  ['okww', 'ok-ww', 'DailyTask', '1']
]) {
  test(extension + ' binds installed working directory and single account task', () => {
    const directory = 'data/apps/' + app + '/working/configs/';
    const bindings = { main: directory + task + '.json', devices: directory + 'devices.json' };
    if (extension === 'oknte') bindings['routine-configs'] = directory + 'DailyRoutineTaskConfigs.json';
    const files = Object.fromEntries(Object.values(bindings).map(file => [file, '{}']));
    files[app + '.exe'] = '';
    if (extension === 'oknte') files[directory + 'CoffeeTask.json'] = '{}';
    const result = discover(extension, files); assert.equal(result.candidates.length, 1);
    const [candidate] = result.candidates;
    assert.deepEqual(candidate.arguments, ['-t', launchNumber, '-e']);
    assert.deepEqual(resourcePaths(candidate), Object.entries(bindings).sort());
    for (const file of Object.values(bindings)) {
      const incomplete = { ...files };
      delete incomplete[file];
      assert.deepEqual(discover(extension, incomplete).candidates, [], file);
    }
  });
}
test('ZZZ explicit two digit instances retain account and group together', () => {
  const files = { 'OneDragon-Launcher.exe': '', 'config/one_dragon.yml': '{}' };
  for (const id of ['01', '02', '3', 'active']) {
    files['config/' + id + '/one_dragon/_group.yml'] = '{}'; files['config/' + id + '/game_account.yml'] = '{}';
  }
  const result = discover('zzzonedragon', files);
  for (const candidate of result.candidates) {
    const id = candidate.candidateId;
    assert.deepEqual(candidate.arguments, ['-o', '-i', id]);
    assert.equal(candidate.resources.find(row => row.resourceId === 'group:' + id)?.path, 'config/' + id + '/one_dragon/_group.yml');
    assert.equal(candidate.resources.find(row => row.resourceId === 'account:' + id)?.path, 'config/' + id + '/game_account.yml');
  }
  assert.deepEqual(result.candidates.map(row => row.candidateId).sort(), ['01', '02']);
});
test('MaaEnd duplicate instance IDs are rejected', () => {
  const result = discover('maaend', { 'MaaEnd.exe': '', 'interface.json': '{}',
    'config/mxu-MaaEnd.json': '{"version":"1.0","settings":{"autoStartInstanceId":"one"},"instances":[{"id":"one"},{"id":"two"},{"id":"two"}]}' });
  assert.equal(result.candidates.length, 0); assert.deepEqual(result.diagnostics, ['maaend_source_instance_ambiguous']);
});
test('MaaEnd offers the configured auto-start instance for each declared interface', () => {
  const result = discover('maaend', { 'MaaEnd.exe': '', 'interface.json': '{}', 'assets/interface.json': '{}',
    'config/mxu-MaaEnd.json': '{"version":"1.0","settings":{"autoStartInstanceId":"one"},"instances":[{"id":"one"},{"id":"two"}]}' });
  assert.deepEqual(result.candidates.map(row => row.candidateId).sort(), ['assets/interface.json:config/mxu-MaaEnd.json:one', 'interface.json:config/mxu-MaaEnd.json:one']);
  for (const row of result.candidates) assert.deepEqual(row.arguments, ['--autostart', '--quit-after-run']);
});
test('MaaS independent instances ignore active GUI selection and bind named shared config', () => {
  const result = discover('maas', { 'MFAAvalonia.exe': '', 'interface.json': '{}',
    'appsettings.json': '{"DefaultConfig":"saved","Instances.LastActive":"foreign"}', 'config/mfa_saved.json': '{}',
    'config/instances/first.json': '{}', 'config/instances/second.json': '{}' });
  assert.deepEqual(result.candidates.map(row => row.arguments).sort(), [['--instance', 'first'], ['--instance', 'second']]);
  for (const row of result.candidates) {
    assert.deepEqual(row.resources.filter(item => item.resourceId === 'global').map(item => item.path), ['config/mfa_saved.json']);
  }
});
test('MaaS unrelated Assets directory is not probed through a lowercase alias', () => {
  const result = discover('maas', { 'MFAAvalonia.exe': '', 'interface.json': '{}', 'Assets/icon.png': '',
    'appsettings.json': '{}', 'config/config.json': '{}', 'config/instances/one.json': '{}' });
  assert.deepEqual(result.candidates.map(row => row.candidateId), ['interface.json:config/instances/one.json']);
});
const prepared = preparationError === undefined;
const passed = prepared && results.length > 0 && results.every(item => item.status === 'PASS');
const receipt = path.join(output, 'receipt.json');
const report = { status: passed ? 'PASS' : 'FAIL', caseCount: results.length,
  scope: 'Source discovery using the production assembler and synthetic source listings',
  preparation: { status: prepared ? 'PASS' : 'FAIL', adapters, ...(prepared ? {} : { error: preparationError }) },
  responsibilities: { lint: 'NOT_RUN', typecheck: 'NOT_RUN', test: prepared ? (passed ? 'PASS' : 'FAIL') : 'NOT_RUN', build: 'NOT_RUN' },
  command: process.argv, results };
fs.writeFileSync(receipt, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, caseCount: report.caseCount, receipt }));
process.exitCode = passed ? 0 : 1;
