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
if (ts.version !== '5.9.3') throw Error('Frontend syntax check requires the locked TypeScript compiler');
let files = 0;

function inspect(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) throw Error('Linked frontend source: ' + full);
    if (entry.isDirectory()) inspect(full);
    else if (/\.(?:ts|js|mjs|cjs)$/.test(entry.name)) {
      const relative = path.relative(root, full).replaceAll('\\', '/');
      const kind = relative.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
      const tree = ts.createSourceFile(relative, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, false, kind);
      if (tree.parseDiagnostics.length) throw Error(relative + ': frontend parse failed');
      files++;
    }
  }
}

for (const directory of selected.length ? ['plugins/managed/frontend-ui/src', ...selected.map(name => 'plugins/managed/' + name + '/frontend/src')]
  : ['plugins/managed', 'tests/frontend', 'tooling']) inspect(path.join(root, directory));
process.stdout.write(JSON.stringify({ status: 'PASS', scope: 'TypeScript and JavaScript syntax', files }, null, 2) + '\n');
