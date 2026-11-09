import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compilerContext, moduleInputs, previousBuild } from './frontend_inputs.mjs';
import { ordinaryPath, externalDirectory, disjointDirectories } from './artifact_paths.mjs';

const repository = ordinaryPath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const started = Date.now();
const allNames = ['custom-wallpaper', 'game-activities', 'game-checkin', 'live-screenshot', 'maa-framework'];
const requestedNames = process.argv.flatMap((item, index) => item === '--extension' ? [process.argv[index + 1]] : []);
if (new Set(requestedNames).size !== requestedNames.length || requestedNames.some(name => !allNames.includes(name))) throw new Error('Unknown or repeated extension');
let names = requestedNames.length ? [...requestedNames] : allNames;
const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const [key, value] = process.argv.slice(index, index + 2);
  if (!['--sdk-root', '--work-root', '--output', '--extension'].includes(key) || !value ||
      key !== '--extension' && values.has(key)) throw new Error('Unknown, missing or repeated frontend option');
  values.set(key, value);
}
let sdkRoot = values.get('--sdk-root');
let workRoot = values.get('--work-root');
let output = values.get('--output');
if (![sdkRoot, workRoot, output].every(value => value && path.isAbsolute(value)))
  throw new Error('Pass absolute --sdk-root, --work-root and --output paths');
sdkRoot = ordinaryPath(sdkRoot);
workRoot = externalDirectory(repository, workRoot);
output = externalDirectory(repository, output);
externalDirectory(sdkRoot, workRoot);
externalDirectory(sdkRoot, output);
disjointDirectories(workRoot, output);
const prior = previousBuild(output);
const previous = prior?.value ? prior : null;
if (fs.existsSync(output) && fs.readdirSync(output).length && !prior) throw new Error('Frontend output has no successful ownership receipt');
const ownerPath = path.join(workRoot, '.nexus-frontend-work.json');
const ownerBytes = JSON.stringify({ format: 'nexus.frontend.workspace', version: 1, repository, sdkRoot }) + '\n';
if (fs.existsSync(workRoot) && fs.readdirSync(workRoot).length &&
    (!fs.existsSync(ownerPath) || fs.readFileSync(ownerPath, 'utf8') !== ownerBytes))
  throw new Error('Frontend dependency workspace is not owned by these source roots');
const sdkEntry = path.join(sdkRoot, 'sdk/frontend/src/index.ts');
if (!fs.existsSync(sdkEntry)) throw new Error('SDK frontend source unavailable');
const lock = JSON.parse(fs.readFileSync(path.join(repository, 'contracts/sdk-source-lock.json')));
const identity = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'contracts/fingerprint.json')));
if (identity.sdkVersion !== lock.sdkVersion || identity.contractFingerprint !== lock.contractFingerprint)
  throw new Error('Frontend SDK identity differs from imported plugin contract lock');
fs.mkdirSync(workRoot, { recursive: true });
fs.mkdirSync(output, { recursive: true });
if (!fs.existsSync(ownerPath)) fs.writeFileSync(ownerPath, ownerBytes, { flag: 'wx' });
const responsibilities = { lint: 'NOT_RUN', typecheck: 'NOT_RUN', test: 'NOT_RUN', build: 'NOT_RUN' };
let stage = 'preparation', exitCode = 1;

function requireSuccess(result, operation) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    throw new Error(operation + ' failed');
  }
}

function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function readSdkSources() {
  const records = [];
  function record(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('SDK source cannot contain links');
      if (entry.isDirectory()) record(source);
      else if (entry.isFile()) records.push({ path: path.relative(sdkRoot, source).replaceAll('\\', '/'),
        sha256: hash(fs.readFileSync(source)) });
    }
  }
  record(path.join(sdkRoot, 'sdk/frontend/src'));
  return records.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}

async function compileFrontend() {
  const packageFile = path.join(workRoot, 'package.json');
  const requested = { private: true, type: 'module', dependencies: { esbuild: '0.25.12', typescript: '5.9.3' } };
  if (!fs.existsSync(packageFile) || JSON.stringify(JSON.parse(fs.readFileSync(packageFile))) !== JSON.stringify(requested)) {
    fs.writeFileSync(packageFile, `${JSON.stringify(requested, null, 2)}\n`);
  }
  const installed = path.join(workRoot, 'node_modules/esbuild/package.json');
  if (!fs.existsSync(installed) || JSON.parse(fs.readFileSync(installed)).version !== '0.25.12') {
    const env = { ...process.env, npm_config_cache: path.join(workRoot, 'npm-cache') };
    const inheritedPath = Object.keys(env).find(key => key.toLowerCase() === 'path');
    if (inheritedPath) delete env[inheritedPath];
    env.Path = `${path.dirname(process.execPath)}${path.delimiter}${process.env.Path ?? process.env.PATH ?? ''}`;
    const npm = process.platform === 'win32'
      ? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js') : 'npm';
    const result = process.platform === 'win32'
      ? spawnSync(process.execPath, [npm, 'install', '--prefix', workRoot, '--no-audit', '--no-fund', '--ignore-scripts'], { stdio: 'inherit', env })
      : spawnSync(npm, ['install', '--prefix', workRoot, '--no-audit', '--no-fund', '--ignore-scripts'], { stdio: 'inherit', env });
    requireSuccess(result, 'Dependency installation');
  }
  const tsconfig = path.join(workRoot, 'frontend-tsconfig.json');
  const sdkSourceRecords = readSdkSources();
  const sharedSources = fs.readdirSync(path.join(repository, 'plugins/managed/frontend-ui/src')).map(name => {
    const file = path.join(repository, 'plugins/managed/frontend-ui/src', name);
    return { path: 'plugins/managed/frontend-ui/src/' + name, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const sharedChanged = previous && (JSON.stringify(previous.value.sdkSourceRecords) !== JSON.stringify(sdkSourceRecords) ||
    JSON.stringify(previous.value.inputs.filter(item => item.path.startsWith('plugins/managed/frontend-ui/')).sort((a, b) => a.path.localeCompare(b.path))) !== JSON.stringify(sharedSources));
  if (sharedChanged) names = allNames;
  const inputs = [...fs.readdirSync(path.join(repository, 'plugins/managed/frontend-ui/src'))
    .filter(file => file.endsWith('.ts')).map(file => path.join(repository, 'plugins/managed/frontend-ui/src', file)),
    ...names.flatMap(name => fs.readdirSync(path.join(repository, `plugins/managed/${name}/frontend/src`))
      .filter(file => file.endsWith('.ts')).map(file => path.join(repository, `plugins/managed/${name}/frontend/src`, file)))];
  const sourceFiles = [fileURLToPath(import.meta.url), path.join(repository, 'tooling/frontend_inputs.mjs'), path.join(repository, 'tooling/frontend_names.mjs'),
    path.join(repository, 'tooling/artifact_paths.mjs'), ...inputs,
    path.join(repository, 'plugins/managed/frontend-ui/src/style.css'),
    ...names.flatMap(name => fs.readdirSync(path.join(repository, `plugins/managed/${name}/frontend/src`))
      .filter(file => file.endsWith('.css')).map(file => path.join(repository, `plugins/managed/${name}/frontend/src`, file)))];
  const records = sourceFiles.map(file => ({ path: path.relative(repository, file).replaceAll('\\', '/'),
    sha256: hash(fs.readFileSync(file)) })).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const context = compilerContext(workRoot);
  const modules = Object.fromEntries(names.map(name => [name, moduleInputs(repository, sdkRoot,
    path.join(repository, `plugins/managed/${name}/frontend/src/index.ts`), workRoot)]));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const toolsUnchanged = !!previous && same(previous.value.inputs.filter(item => item.path.startsWith('tooling/')),
    records.filter(item => item.path.startsWith('tooling/')));
  const compilationReused = !!previous && same(previous.value.inputs, records)
    && same(previous.value.sdkSourceRecords, sdkSourceRecords) && same(previous.value.compilerContext, context);
  fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true,
    skipLibCheck: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    baseUrl: repository, paths: { '@nexuspipeline/extension-sdk': [sdkEntry] },
  }, files: inputs }, null, 2));
  const tsc = path.join(workRoot, 'node_modules/typescript/bin/tsc');
  stage = 'lint';
  const naming = spawnSync(process.execPath, [path.join(repository, 'tooling/frontend_names.mjs'),
    '--root', repository, '--modules', path.join(workRoot, 'node_modules'), ...names.flatMap(name => ['--extension', name])], { encoding: 'utf8' });
  if (naming.stdout) fs.writeFileSync(path.join(output, 'naming-receipt.json'), naming.stdout);
  if (naming.status !== 0) process.stderr.write((naming.stderr ?? '') + (naming.stdout ?? ''));
  requireSuccess(naming, 'Frontend lint');
  responsibilities.lint = 'PASS';
  stage = 'typecheck';
  if (!compilationReused) {
    const check = spawnSync(process.execPath, [tsc, '--project', tsconfig], { stdio: 'inherit' });
    requireSuccess(check, 'Frontend typecheck');
  }
  responsibilities.typecheck = 'PASS';
  stage = 'build';
  const esbuildPath = path.join(workRoot, 'node_modules/esbuild/lib/main.js');
  const { build } = await import(pathToFileURL(esbuildPath).href);
  const bundles = [];
  for (const name of names) {
    if (previous && toolsUnchanged && same(previous.value.compilerContext, context) && same(previous.value.moduleInputs?.[name], modules[name])) continue;
    const entry = path.join(repository, `plugins/managed/${name}/frontend/src/index.ts`);
    const destination = path.join(output, name);
    const result = await build({ write: false, entryPoints: [entry], outdir: destination, entryNames: 'main', bundle: true,
      format: 'esm', platform: 'browser', target: 'es2022', sourcemap: false, logLevel: 'info',
      plugins: [{ name: 'sdk-source', setup(plugin) {
        plugin.onResolve({ filter: /^@nexuspipeline\/extension-sdk$/ }, () => ({ path: sdkEntry }));
      } }],
    });
    const emitted = new Set(result.outputFiles.map(file => file.path));
    if (emitted.size !== 2 || !['main.js', 'main.css'].every(file => emitted.has(path.join(destination, file))))
      throw new Error('Incomplete frontend bundle for ' + name);
    bundles.push(...result.outputFiles);
  }
  for (const record of records)
    if (hash(fs.readFileSync(path.join(repository, record.path))) !== record.sha256)
      throw new Error('Frontend source changed during compilation');
  if (JSON.stringify(readSdkSources()) !== JSON.stringify(sdkSourceRecords))
    throw new Error('SDK source changed during frontend compilation');
  for (const file of bundles) {
    fs.mkdirSync(path.dirname(file.path), { recursive: true });
    fs.writeFileSync(file.path, file.contents);
  }
  const artifacts = names.flatMap(name => ['main.js', 'main.css'].map(file => {
    const artifact = path.join(output, name, file);
    return { path: `${name}/${file}`, sha256: hash(fs.readFileSync(artifact)) };
  }));
  responsibilities.build = 'PASS';
  return { sharedInputsChanged: !!sharedChanged, sourceHash: hash(Buffer.from(JSON.stringify(records))),
    compilerContext: context, moduleInputs: modules, compilationReused,
    reusedCompilation: compilationReused ? previous.reference : null, inputs: records, sdkSourceRecords, artifacts };
}

let result;
try {
  result = { ...await compileFrontend(), status: 'PASS', exitCode: 0 };
} catch (error) {
  if (stage !== 'preparation') responsibilities[stage] = 'FAIL';
  console.error(error);
  result = { status: 'FAIL', exitCode, error: error.message, previousSuccess: previous?.reference.sha256 ?? null };
}
const receipt = { ...result, preparation: stage === 'preparation' ? 'FAIL' : 'PASS', responsibilities,
  scope: 'contract-only frontend build', artifactRoot: path.resolve(output), sourceMode: 'local-uncommitted',
  requestedExtensions: requestedNames, selectedExtensions: names, sourceCommit: null, sourceTree: null,
  sdkVersion: identity.sdkVersion, contractFingerprint: identity.contractFingerprint,
  command: process.argv.join(' '), milliseconds: Date.now() - started };
const receiptBytes = `${JSON.stringify(receipt, null, 2)}\n`;
const immutableReceipt = path.join(output, 'runs', hash(Buffer.from(receiptBytes)) + '.json');
fs.mkdirSync(path.dirname(immutableReceipt), { recursive: true });
if (fs.existsSync(immutableReceipt)) {
  if (fs.readFileSync(immutableReceipt, 'utf8') !== receiptBytes) throw new Error('Immutable frontend receipt changed');
} else fs.writeFileSync(immutableReceipt, receiptBytes, { flag: 'wx' });
fs.writeFileSync(path.join(output, 'build-receipt.json'), receiptBytes);
process.exitCode = receipt.exitCode;
console.log(JSON.stringify({ status: receipt.status, scope: 'Selected frontend typecheck and bundles', selectedExtensions: names, output, immutableReceipt }));
