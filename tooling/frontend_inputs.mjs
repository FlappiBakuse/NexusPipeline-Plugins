import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function compilerContext(workRoot) {
  const modules = path.join(workRoot, 'node_modules');
  const records = [];
  function inspect(directory) {
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Compiler dependencies cannot contain links');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Compiler dependencies cannot contain links');
      if (entry.isDirectory()) inspect(file);
      else if (entry.isFile()) records.push({ path: path.relative(modules, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file)) });
    }
  }
  for (const name of ['typescript', 'esbuild', '@esbuild']) inspect(path.join(modules, name));
  records.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const environment = Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'ESBUILD_BINARY_PATH'].map(name => [name, process.env[name] ?? null]));
  return { node: process.version, nodeSha256: hash(fs.readFileSync(process.execPath)), platform: process.platform,
    architecture: process.arch, dependencyHash: hash(Buffer.from(JSON.stringify(records))),
    environmentHash: hash(Buffer.from(JSON.stringify(environment))) };
}

export function moduleInputs(repository, sdkRoot, entry, workRoot) {
  repository = path.resolve(repository);
  sdkRoot = path.resolve(sdkRoot);
  const require = createRequire(path.join(workRoot, 'package.json'));
  const ts = require('typescript');
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: repository,
    paths: { '@nexuspipeline/extension-sdk': [path.join(sdkRoot, 'sdk/frontend/src/index.ts')] } };
  const pending = [entry], visited = new Set(), source = [], sdk = [];
  while (pending.length) {
    const file = path.resolve(pending.pop());
    if (visited.has(file)) continue;
    visited.add(file);
    if (!file.startsWith(repository + path.sep) && !file.startsWith(sdkRoot + path.sep))
      throw new Error('Frontend dependency escaped its reviewed source owners');
    const raw = fs.readFileSync(file);
    const owner = file.startsWith(repository + path.sep) ? repository : sdkRoot;
    (owner === repository ? source : sdk).push({ path: path.relative(owner, file).replaceAll('\\', '/'), sha256: hash(raw) });
    if (file.endsWith('.css')) {
      for (const match of raw.toString('utf8').matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)) {
        if (!match[1].startsWith('.')) throw new Error('CSS imports need an explicit local source owner');
        pending.push(path.resolve(path.dirname(file), match[1]));
      }
      continue;
    }
    if (!file.endsWith('.ts')) continue;
    const tree = ts.createSourceFile(file, raw.toString('utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      const imported = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
      if (imported) {
        if (!ts.isStringLiteral(imported)) throw new Error('Dynamic frontend imports need an explicit dependency owner');
        const name = imported.text;
        const resolved = ts.resolveModuleName(name, file, options, ts.sys).resolvedModule?.resolvedFileName;
        const asset = name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
        if (resolved) pending.push(resolved);
        else if (asset && fs.existsSync(asset)) pending.push(asset);
        else throw new Error('Frontend input cannot be resolved: ' + name);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  const sort = values => values.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return { source: sort(source), sdk: sort(sdk) };
}

export function previousBuild(output) {
  const latest = path.join(output, 'build-receipt.json');
  if (!fs.existsSync(latest)) return null;
  const raw = fs.readFileSync(latest), original = path.join(output, 'runs', hash(raw) + '.json');
  if (!fs.existsSync(original) || !fs.readFileSync(original).equals(raw)) throw new Error('Original frontend build receipt changed');
  const value = JSON.parse(raw);
  if (value.status !== 'PASS') return null;
  if (value.artifacts.some(item => !/^[a-z0-9-]+\/(?:main\.js|main\.css)$/.test(item.path)))
    throw new Error('Frontend artifact name escaped its finite module owner');
  const expected = new Set(value.artifacts.map(item => item.path));
  const actual = new Set();
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Frontend artifacts cannot contain links');
      if (entry.isDirectory()) inspect(file);
      else if (entry.isFile()) actual.add(path.relative(output, file).replaceAll('\\', '/'));
    }
  }
  for (const name of new Set(value.artifacts.map(item => item.path.split('/')[0]))) inspect(path.join(output, name));
  if (expected.size !== value.artifacts.length || actual.size !== expected.size || [...actual].some(name => !expected.has(name)))
    throw new Error('Frontend artifact inventory changed');
  for (const artifact of value.artifacts) {
    const file = path.resolve(output, artifact.path);
    if (!file.startsWith(path.resolve(output) + path.sep) || hash(fs.readFileSync(file)) !== artifact.sha256)
      throw new Error('Frontend artifact changed');
  }
  return { value, reference: { path: original, sha256: hash(raw) } };
}
