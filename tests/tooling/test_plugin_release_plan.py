from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling'))
from plugin_release_plan import make_plan, retention
from plugin_release_inputs import CATALOG, STATE, version


class PluginReleasePlanTests(unittest.TestCase):
    def setUp(self):
        self.base = Path(os.environ['NEXUS_TEST_ROOT']).resolve(strict=True)
        self.scope = Path(tempfile.mkdtemp(prefix='plugin-release-', dir=self.base))
        self.repo = self.scope / 'source'
        self.repo.mkdir()
        self.git('init', '--initial-branch=develop')
        self.git('config', 'core.autocrlf', 'false')
        self.items = [('alpha', 'Alpha', 'managed', True), ('beta', 'Beta', 'specialized', False),
                      ('gamma', 'Gamma', 'managed', False)]
        for identity, artifact, kind, frontend in self.items:
            self.write(f'plugins/{kind}/{identity}/extension.json', json.dumps({
                'extensionId': identity, 'artifactName': artifact, 'packageVersion': '0.4.0',
                'kind': 'managed-code' if kind == 'managed' else 'data-specialized',
                **({'frontend': {}} if frontend else {})}))
            self.write(f'plugins/{kind}/{identity}/owner.txt', 'Original package input\n')
        self.write('plugins/managed/alpha/Slice.csproj', '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup>'
                   '<ProjectReference Include="../SDK/Public.csproj" />'
                   '<PackageReference Include="Dependency" Version="1.0.0" /></ItemGroup></Project>')
        self.cursor = self.commit()
        entries, released = [], {}
        for identity, artifact, kind, _ in self.items:
            payload = ('Original ' + artifact + ' ZIP sentinel').encode()
            for value in ('0.3.0-beta.1', '0.3.0-rc.1', '0.4.0'):
                self.write(f'packages/{artifact}/{artifact}-{value}.zip', payload)
            fact = {'artifactName': artifact, 'name': identity, 'version': '0.4.0',
                    'sha256': hashlib.sha256(payload).hexdigest(), 'sizeBytes': len(payload)}
            entries.append(fact)
            released[artifact] = {**fact, 'sourceTree': self.git('rev-parse', self.cursor + f':plugins/{kind}/{identity}').decode().strip()}
        self.catalog = {'schemaVersion': 2, 'repository': 'FlappiBakuse/NexusPipeline-Plugins', 'plugins': entries}
        self.state = {'schemaVersion': 1, 'sourceCommit': self.cursor, 'released': released}
        self.metadata()
        self.distribution = self.commit()

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.repo), *args], capture_output=True, check=True).stdout

    def write(self, name, data):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data.encode() if isinstance(data, str) else data)
        return path

    def metadata(self):
        data = json.dumps(self.catalog)
        self.write(CATALOG, data)
        self.write('catalog.json', data)
        self.write(STATE, json.dumps(self.state))

    def commit(self):
        self.git('add', '--all')
        self.git('-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '--no-gpg-sign', '-m', 'fixture')
        return self.git('rev-parse', 'HEAD').decode().strip()

    def bump(self, identity='alpha', value='0.5.0'):
        kind = next(row[2] for row in self.items if row[0] == identity)
        path = self.repo / f'plugins/{kind}/{identity}/extension.json'
        manifest = json.loads(path.read_bytes())
        manifest['packageVersion'] = value
        path.write_text(json.dumps(manifest), encoding='utf-8')

    def plan(self, channel='stable', local=False):
        return make_plan(self.repo, self.repo, self.distribution,
                         None if local else self.git('rev-parse', 'HEAD').decode().strip(), channel)

    def test_tracks_cursor(self):
        self.bump()
        self.write('plugins/managed/alpha/owner.txt', 'First unpublished change')
        first = self.commit()
        self.bump('beta')
        self.write('plugins/specialized/beta/owner.txt', 'Second unpublished change')
        head = self.commit()
        plan = self.plan()
        self.assertEqual(['Alpha', 'Beta'], plan['requiresPackage'])
        self.assertEqual(self.cursor, plan['base'])
        self.assertNotEqual(first, plan['base'])
        self.assertEqual(head, plan['source']['sourceCommit'])
        self.assertEqual(['Alpha'], plan['managed'])
        self.assertFalse(plan['publishable'])
        self.assertIn('plugins/managed/alpha/owner.txt', plan['reasons']['Alpha'])

    def test_preserves_governance(self):
        self.write('docs/release.md', 'Review instructions')
        self.write('tooling/release.py', 'raise RuntimeError("Must never execute candidate tools")')
        self.write('plugins/managed/frontend-ui/README.md', 'Shared UI documentation')
        path = self.repo / 'plugins/managed/alpha/Slice.csproj'
        path.write_text(path.read_text().replace('../SDK/Public.csproj', '$(HostRoot)/SDK/Public.csproj'), encoding='utf-8')
        self.commit()
        self.assertEqual('NO_CHANGES', self.plan()['status'])
        path.write_text(path.read_text().replace('Version="1.0.0"', 'Version="2.0.0"'), encoding='utf-8')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'newer version'):
            self.plan()
        self.bump()
        self.commit()
        self.assertEqual(['Alpha'], self.plan()['requiresPackage'])

    def test_scopes_shared(self):
        for branch, path, selected in [('frontend', 'plugins/managed/frontend-ui/owner.ts', ['Alpha']),
                                      ('adapter', 'adapter-runtime/core/owner.js', ['Beta']),
                                      ('contract', 'contracts/schemas/public.json', ['Alpha', 'Beta', 'Gamma'])]:
            self.git('checkout', '-b', branch, self.distribution)
            self.write(path, 'Changed shared production input')
            for identity, artifact, _, _ in self.items:
                if artifact in selected:
                    self.bump(identity)
            self.commit()
            with self.subTest(branch=branch):
                self.assertEqual(selected, self.plan()['requiresPackage'])

    def test_enforces_versions(self):
        self.write('plugins/managed/alpha/owner.txt', 'Changed business input')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'newer version'):
            self.plan()
        self.assertEqual(['Alpha'], self.plan('preview')['requiresPackage'])
        self.bump('alpha', '0.3.0')
        self.commit()
        with self.assertRaises(ValueError):
            self.plan('preview')
        self.bump('alpha', '0.5.0')
        self.commit()
        self.assertEqual(['Alpha'], self.plan()['requiresPackage'])

    def test_retains_packages(self):
        self.bump()
        shutil.rmtree(self.repo / 'plugins/specialized/beta')
        self.commit()
        plan = self.plan()
        self.assertEqual(['packages/Alpha/Alpha-0.3.0-beta.1.zip'], plan['removePackages'])
        self.assertEqual(['Beta'], plan['deleted'])
        self.assertEqual(['packages/Beta'], plan['removeArtifacts'])
        self.assertNotIn('Gamma', plan['requiresPackage'])
        self.assertEqual([], self.plan('preview')['removeArtifacts'])

    def test_binds_metadata(self):
        for field in ('version', 'sha256', 'sizeBytes', 'name'):
            self.git('checkout', '-b', 'metadata-' + field, self.distribution)
            bad = deepcopy(self.state)
            bad['released']['Alpha'][field] = 'invalid'
            self.write(STATE, json.dumps(bad))
            distribution = self.commit()
            with self.subTest(field=field), self.assertRaises(ValueError):
                make_plan(self.repo, self.repo, distribution, distribution)
        self.git('checkout', '-b', 'local', self.distribution)
        self.bump()
        plan = self.plan(local=True)
        self.assertEqual('local-uncommitted', plan['source']['sourceMode'])
        self.assertIsNone(plan['source']['sourceCommit'])
        self.assertIsNone(plan['source']['sourceTree'])
        self.assertFalse(plan['publishable'])

    def test_rejects_ambiguous(self):
        path = self.repo / 'plugins/managed/gamma/extension.json'
        manifest = json.loads(path.read_bytes())
        manifest['artifactName'] = 'alpha'
        path.write_text(json.dumps(manifest), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            self.plan(local=True)
        manifest['artifactName'] = 'Gamma'
        manifest['extensionId'] = 'alpha'
        path.write_text(json.dumps(manifest), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'duplicated'):
            self.plan(local=True)

    def test_cli_preserves_paths(self):
        command = [sys.executable, '-B', str(ROOT / 'tooling/plugin_release_plan.py'), '--source-root', str(self.repo),
                   '--distribution-root', str(self.repo), '--distribution-commit', self.distribution,
                   '--source-commit', self.distribution, '--output']
        report = self.scope / 'report'
        result = subprocess.run([*command, str(report)], capture_output=True)
        self.assertEqual(0, result.returncode, result.stderr.decode())
        self.assertEqual('NO_CHANGES', json.loads((report / 'release-plan.json').read_bytes())['status'])
        before = (report / 'release-plan.json').read_bytes()
        self.assertNotEqual(0, subprocess.run([*command, str(report)], capture_output=True).returncode)
        self.assertEqual(before, (report / 'release-plan.json').read_bytes())
        self.assertNotEqual(0, subprocess.run([*command, str(self.repo / 'output')], capture_output=True).returncode)
        self.assertFalse((self.repo / 'output').exists())

    def test_legacy_cursor(self):
        current = self.repo / 'plugins/managed/alpha'
        original = self.repo / 'plugins/general/Alpha'
        original.parent.mkdir(parents=True)
        shutil.move(str(current), str(original))
        (original / 'extension.json').unlink()
        self.write('plugins/general/Alpha/plugin.json', json.dumps({'name': 'alpha', 'artifactName': 'Alpha'}))
        self.cursor = self.commit()
        self.state['sourceCommit'] = self.cursor
        self.state['released']['Alpha']['sourceTree'] = self.git('rev-parse', self.cursor + ':plugins/general/Alpha').decode().strip()
        self.metadata()
        self.distribution = self.commit()
        shutil.move(str(original), str(current))
        (current / 'plugin.json').unlink()
        self.write('plugins/managed/alpha/extension.json', json.dumps({'extensionId': 'alpha', 'artifactName': 'Alpha',
                   'packageVersion': '0.5.0', 'kind': 'managed-code', 'frontend': {}}))
        self.write('plugins/managed/alpha/README.md', 'Current packaged instructions')
        self.commit()
        plan = self.plan()
        self.assertEqual(['Alpha'], plan['requiresPackage'])
        self.assertEqual([], plan['deleted'])
        self.assertIn('plugins/general/Alpha/plugin.json', plan['reasons']['Alpha'])
        self.assertIn('plugins/managed/alpha/README.md', plan['reasons']['Alpha'])

    def test_rejects_dirty_source(self):
        self.bump()
        with self.assertRaisesRegex(ValueError, 'clean|dirty|HEAD'):
            self.plan()
        self.assertEqual(['Alpha'], self.plan(local=True)['requiresPackage'])

    def test_semver_retention(self):
        files = {f'packages/Alpha/Alpha-{value}.zip': 'blob' for value in
                 ('0.9.0', '0.10.0-beta.2', '0.10.0-beta.10', '0.10.0-rc.1', '0.10.0')}
        removed = retention(files, 'Alpha', '0.10.1')
        self.assertEqual(['packages/Alpha/Alpha-0.10.0-beta.10.zip',
                          'packages/Alpha/Alpha-0.10.0-beta.2.zip', 'packages/Alpha/Alpha-0.9.0.zip'], removed)
        with self.assertRaises(ValueError):
            retention({**files, 'packages/Alpha/foreign.zip': 'blob'}, 'Alpha', '0.10.1')
        for value in ('01.0.0', '1.0.0-rc.01', '1.0.0+metadata', '../1.0.0'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                version(value)

    def test_rejects_cursor_and_projection(self):
        for field in ('cursor', 'projection'):
            self.git('checkout', '-b', 'invalid-' + field, self.distribution)
            if field == 'cursor':
                bad = deepcopy(self.state)
                bad['sourceCommit'] = 'f' * 40
                self.write(STATE, json.dumps(bad))
            else:
                self.write('catalog.json', '{}')
            distribution = self.commit()
            with self.subTest(field=field), self.assertRaises(ValueError):
                make_plan(self.repo, self.repo, distribution, distribution)

    def tearDown(self):
        scope = self.scope.resolve(strict=True)
        if scope.parent != self.base or scope.is_symlink() or scope.is_junction():
            raise ValueError('Release fixture cleanup ownership mismatch')
        for path in scope.rglob('*'):
            if path.is_file() and not path.is_symlink():
                path.chmod(0o600)
        shutil.rmtree(scope)
