import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const external = process.env.NEXUS_TEST_ROOT;
if (!external || !path.isAbsolute(external)) throw new Error('Explicit external test root required');
for (const argument of ['--work-root', '--output', '--sdk-root']) {
  test('rejects linked ' + argument + ' before writing through it', () => {
    const root = fs.mkdtempSync(path.join(external, 'frontend-path-'));
    const target = path.join(root, 'target');
    const link = path.join(root, 'junction');
    fs.mkdirSync(target);
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      const args = new Map([['--sdk-root', path.join(root, 'sdk')], ['--work-root', path.join(root, 'work')],
        ['--output', path.join(root, 'output')]]);
      args.set(argument, path.join(link, 'uncreated'));
      const result = spawnSync(process.execPath, [path.join(repository, 'tooling/build_frontend.mjs'), ...[...args].flat()],
        { cwd: repository, encoding: 'utf8', timeout: 10000 });
      assert.ifError(result.error);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Frontend paths cannot cross links/);
      assert.deepEqual(fs.readdirSync(target), []);
      assert.equal(fs.existsSync(path.join(root, 'work')), false);
      assert.equal(fs.existsSync(path.join(root, 'output')), false);
    } finally {
      fs.unlinkSync(link);
      assert.equal(fs.realpathSync(root), root);
      fs.rmSync(root, { recursive: true });
    }
  });
}
