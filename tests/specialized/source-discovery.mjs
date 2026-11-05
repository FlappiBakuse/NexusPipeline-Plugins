import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let cases = 0;
function discover(extension, files) {
  const directory = path.join(root, 'plugins/specialized', extension);
  const sources = JSON.parse(fs.readFileSync(path.join(directory, 'adapter/sources.json')));
  const script = sources.map(name => fs.readFileSync(path.join(name.startsWith('adapter-runtime/') ? root : directory, name), 'utf8')).join('\n');
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
  });
  vm.runInContext(script, context, { timeout: 1000 });
  const result = vm.runInContext(`JSON.stringify(nexusDiscoverScript(${JSON.stringify({ format: 'nexus.script.source', version: 1,
    direction: 'request', extensionId: extension, operationId: 'cc11af43-7f60-450b-a003-3458bbd197fe' })}))`, context, { timeout: 1000 });
  return JSON.parse(result);
}
function test(name, action) { action(); cases++; console.log('PASS ' + name); }

const baah = { 'BAAH.exe': '', 'DATA/CONFIGS/software_config.json': '{}', 'BAAH_CONFIGS/one.json': '{}' };
test('BAAH single config uses its explicit filename and software config', () => {
  const result = discover('baah', baah); assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].arguments, ['one.json']);
  assert.equal(result.candidates[0].resources[0].path, 'BAAH_CONFIGS/one.json');
});
test('BAAH multiple configs remain distinct and no storage file is treated as a task config', () => {
  const result = discover('baah', { ...baah, 'BAAH_CONFIGS/two.json': '{}', 'DATA/USER_STORAGE/STORAGEabcd.json': '{}' });
  assert.deepEqual(result.candidates.map(item => item.candidateId), ['BAAH_CONFIGS/one.json', 'BAAH_CONFIGS/two.json']);
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
  assert.throws(() => discover('bettergi', { ...bettergi, 'User/OneDragon/broken.json': 'not-json' }));
});
test('March7th uses launcher and requires separate worker', () => {
  const files = { 'March7th Launcher.exe': '', 'March7th Assistant.exe': '', 'config.yaml': '{}' };
  assert.equal(discover('march7th', files).candidates[0].executable, 'March7th Launcher.exe');
  delete files['March7th Assistant.exe']; assert.equal(discover('march7th', files).candidates.length, 0);
});
for (const [extension, app, task] of [['oknte', 'ok-nte', 'DailyRoutineTask'], ['okww', 'ok-ww', 'DailyTask']]) {
  test(extension + ' binds installed working directory and single account task', () => {
    const directory = 'data/apps/' + app + '/working/configs/';
    const files = { [app + '.exe']: '', [directory + task + '.json']: '{}', [directory + 'devices.json']: '{}' };
    if (extension === 'oknte') files[directory + 'DailyRoutineTaskConfigs.json'] = '{}';
    const result = discover(extension, files); assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].arguments, ['-t', '1', '-e']);
    delete files[directory + task + '.json']; assert.equal(discover(extension, files).candidates.length, 0);
  });
}
test('ZZZ explicit two digit instances retain account and group together', () => {
  const files = { 'OneDragon-Launcher.exe': '', 'config/one_dragon.yml': '{}' };
  for (const id of ['01', '02', '3', 'active']) {
    files['config/' + id + '/one_dragon/_group.yml'] = '{}'; files['config/' + id + '/game_account.yml'] = '{}';
  }
  const result = discover('zzzonedragon', files); assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map(row => row.arguments), [['-o', '-i', '01'], ['-o', '-i', '02']]);
});
test('MaaEnd duplicate instance IDs are rejected', () => {
  const result = discover('maaend', { 'MaaEnd.exe': '', 'interface.json': '{}',
    'config/mxu-MaaEnd.json': '{"version":"1.0","instances":[{"id":"one"},{"id":"one"}]}' });
  assert.equal(result.candidates.length, 0); assert.deepEqual(result.diagnostics, ['maaend_source_instance_ambiguous']);
});
test('MaaEnd offers every explicit file instance and interface combination', () => {
  const result = discover('maaend', { 'MaaEnd.exe': '', 'interface.json': '{}', 'assets/interface.json': '{}',
    'config/mxu-MaaEnd.json': '{"version":"1.0","instances":[{"id":"one"},{"id":"two"}]}' });
  assert.equal(result.candidates.length, 4); assert.equal(new Set(result.candidates.map(row => row.candidateId)).size, 4);
});
test('MaaS independent instances ignore active GUI selection and bind named shared config', () => {
  const result = discover('maas', { 'MFAAvalonia.exe': '', 'interface.json': '{}',
    'appsettings.json': '{"DefaultConfig":"saved","Instances.LastActive":"foreign"}', 'config/mfa_saved.json': '{}',
    'config/instances/first.json': '{}', 'config/instances/second.json': '{}' });
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map(row => row.projectSelection.Source.InstanceId), ['first', 'second']);
  assert.equal(result.candidates[0].resources[1].path, 'config/mfa_saved.json');
});
test('MaaS unrelated Assets directory is not probed through a lowercase alias', () => {
  const result = discover('maas', { 'MFAAvalonia.exe': '', 'interface.json': '{}', 'Assets/icon.png': '',
    'appsettings.json': '{}', 'config/config.json': '{}', 'config/instances/one.json': '{}' });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].projectSelection.InterfacePath, 'interface.json');
});
console.log(JSON.stringify({ status: 'PASS', cases, scope: 'Plugin source discovery components; Host filesystem authority and UI integration separate' }));
