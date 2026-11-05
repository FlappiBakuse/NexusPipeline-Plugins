import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const root = options.get('--root'), modules = options.get('--modules');
const selected = process.argv.flatMap((item, index) => item === '--extension' ? [process.argv[index + 1]] : []);
const allowed = ['custom-wallpaper', 'game-activities', 'game-checkin', 'live-screenshot', 'maa-framework'];
if (new Set(selected).size !== selected.length || selected.some(name => !allowed.includes(name))) throw Error('Invalid frontend selection');
if (!root || !modules || !path.isAbsolute(root) || !path.isAbsolute(modules))
  throw Error('Pass absolute --root and --modules paths');
const ts = createRequire(path.join(modules, 'package.json'))('typescript');
if (ts.version !== '5.9.3') throw Error('Frontend naming requires the locked TypeScript compiler');
const wordCount = name => (name.replace(/^I(?=[A-Z][a-z])/, '').replaceAll('BetterGi', 'Bettergi').replaceAll('MuMu', 'Mumu')
  .match(/[A-Z]+(?=[A-Z][a-z]|[0-9]|$)|[A-Z]?[a-z]+[0-9]*|[0-9]+/g) || []).length;

function declarations(text, filename) {
  const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true,
    filename.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  if (tree.parseDiagnostics.length) throw Error(filename + ': frontend parse failed');
  const found = [];
  const visit = node => {
    const type = ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node);
    const method = ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node);
    const callable = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer));
    if ((type || method || callable) && node.name && ts.isIdentifier(node.name))
      found.push({ name: node.name.text, kind: type ? 'type' : method ? 'method' : 'function',
        line: tree.getLineAndCharacterOfPosition(node.name.getStart(tree)).line + 1 });
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

function selfTest() {
  const sample = declarations('class ClearName { fourWordMemberMethod() {} }\nfunction clearName() { function fourWordLocalFunction() {} }\nconst fourWordArrowFunction = () => {};', 'sample.ts');
  const failures = sample.filter(item => wordCount(item.name) > 3).map(item => item.name);
  if (JSON.stringify(failures) !== JSON.stringify(['fourWordMemberMethod', 'fourWordLocalFunction', 'fourWordArrowFunction']))
    throw Error('Frontend naming declaration coverage failed');
  const script = declarations('function fourWordScriptFunction() {}', 'sample.mjs');
  if (script[0]?.name !== 'fourWordScriptFunction' || wordCount(script[0].name) !== 4)
    throw Error('Frontend script declaration coverage failed');
}

const files = [], errors = [];
function inspect(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isSymbolicLink()) throw Error('Linked frontend source: ' + full);
    if (item.isDirectory()) inspect(full);
    else if (/\.(?:ts|js|mjs|cjs)$/.test(item.name)) {
      const relative = path.relative(root, full).replaceAll('\\', '/');
      const found = declarations(fs.readFileSync(full, 'utf8'), relative);
      files.push({ file: relative, declarations: found.length });
      for (const declaration of found) if (wordCount(declaration.name) > 3)
        errors.push({ file: relative, ...declaration, words: wordCount(declaration.name) });
    }
  }
}

selfTest();
for (const directory of selected.length ? ['plugins/managed/frontend-ui/src', ...selected.map(name => 'plugins/managed/' + name + '/frontend/src')]
  : ['plugins/managed', 'tests/frontend', 'tooling']) inspect(path.join(root, directory));
const result = { status: errors.length ? 'FAIL' : 'PASS', scope: 'TypeScript AST naming for frontend code, tests and tools',
  files: files.length, declarations: files.reduce((sum, file) => sum + file.declarations, 0), selfTest: 'PASS', errors };
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exitCode = errors.length ? 1 : 0;
