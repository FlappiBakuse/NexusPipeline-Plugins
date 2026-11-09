import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { request } from './maa-fixture.mjs';

const selections = {
  baah: 'discover 咖啡馆', bettergi: 'discover 领取邮件', march7th: 'discover 每日实训',
  oknte: 'unknown row retained read only', okww: 'unknown addition kept and blocks safe retry',
  zzzonedragon: 'all registered application identities charge_plan',
  maaend: 'repeated entries retain separate stable ids and custom titles', maas: 'custom name and duplicate occurrences retained'
};
async function prepareFixture(root, output, extensionId, selection) {
  const directory = path.join(output, extensionId);
  const built = spawnSync(process.env.NEXUS_TEST_PYTHON_EXE || 'python', ['-B', path.join(root, 'tests/specialized/assemble.py'),
    root, extensionId, directory], { encoding: 'utf8' });
  if (built.status !== 0) throw built.error ?? Error(built.stderr || built.stdout);
  const assembly = JSON.parse(built.stdout);
  const script = fs.readFileSync(path.join(directory, 'adapter.js'), 'utf8');
  const program = new vm.Script(script);
  const invoke = (input, sources = {}) => {
    const context = vm.createContext({ input: structuredClone(input), nexusReadSource: name =>
      Object.hasOwn(sources, name) ? JSON.stringify(sources[name]) : 'null' }, { codeGeneration: { strings: false, wasm: false } });
    program.runInContext(context, { timeout: 2000 });
    return JSON.parse(JSON.stringify(vm.runInContext('nexusTaskAdapter(input)', context, { timeout: 2000 })));
  };
  const module = await import(pathToFileURL(path.join(root, 'tests/specialized', extensionId, 'cases.mjs')).href);
  const rows = module.cases(invoke);
  const row = structuredClone(rows.find(item => item.name === selection));
  if (!row) throw Error('Missing explicit fixture: ' + extensionId);
  if (extensionId === 'bettergi') {
    const document = module.configuration([...module.builtins, 'Future 用户组 Ω']);
    row.input = module.request('discover', document);
  }
  if (extensionId === 'maaend') {
    const document = JSON.parse(row.input.resources[0].content);
    document.instances.find(item => item.id === 'stable').tasks.push({ id: 'future', taskName: 'Future 用户任务 Ω', enabled: true });
    row.input.resources[0].content = JSON.stringify(document);
  }
  if (extensionId === 'zzzonedragon') {
    const document = JSON.parse(row.input.resources[0].content);
    document.app_list.push({ app_id: 'Future 用户任务 Ω', enabled: true });
    row.input.resources[0].content = JSON.stringify(document);
  }
  if (extensionId === 'maas') {
    const document = JSON.parse(row.input.resources[0].content);
    document.TaskItems.push({ name: 'Future 用户任务 Ω', entry: 'future-entry', default_check: true });
    row.input.resources[0].content = JSON.stringify(document);
  }
  const resources = row.input.resources.map((resource, index) => ({ ...resource,
    revision: 1, sourcePath: resource.relativePath || ('resource-' + index + '.json'), relativePath: '',
    sha256: crypto.createHash('sha256').update(resource.content).digest('hex') }));
  const response = invoke(request(extensionId, 'discover', resources), row.sourceFiles);
  if (!response.tasks.some(task => task.titleLocales?.['zh-CN'] && task.titleLocales?.['en-US']))
    throw Error('No bilingual task in fixture: ' + extensionId);
  if (response.diagnostics?.some(item => item.severity === 'blocking')) throw Error('Blocked fixture: ' + extensionId);
  const fixture = { extensionId, name: selection, adapterSha256: crypto.createHash('sha256').update(script).digest('hex'),
    resources, sourceFiles: row.sourceFiles ?? {}, tasks: response.tasks,
    diagnostics: response.diagnostics ?? [], sourceInputs: assembly.records };
  return { fixture, rows, invoke };
}

export async function* prepareLocaleFixtures(root, output) {
  for (const [extensionId, selection] of Object.entries(selections))
    yield await prepareFixture(root, output, extensionId, selection);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [root, output] = process.argv.slice(2);
  if (![root, output].every(value => value && path.isAbsolute(value)) || output.startsWith(root + path.sep))
    throw Error('Explicit source and external output required');
  const target = path.join(output, 'fixtures.json');
  if (fs.existsSync(target)) throw Error('Preserve previous fixture identity');
  const cases = [];
  for await (const { fixture } of prepareLocaleFixtures(root, output)) cases.push(fixture);
  fs.writeFileSync(target, JSON.stringify({ format: 'nexus.specialized-locale-fixtures', version: 1,
    scope: 'Synthetic source-derived inputs; original packaged adapters and actual Host/UI remain separate verification', cases }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PREPARED', cases: cases.length, output: target }));
}
