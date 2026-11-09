import base64
from copy import deepcopy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import zipfile
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling'))
import test_plugin_release_plan as planning
from package_extension import archive
from plugin_release_git import PREFIX, blob_sha
from plugin_release_inputs import CATALOG, STATE
from plugin_release_publish import publish_stable
from plugin_release_check import verify_original
from release_candidate import inventory, validate
from release_provenance import POLICIES


class GitServer:
    def __init__(self, fixture, source):
        self.fixture = fixture
        self.remote = source
        self.events = []
        self.fault = None
        self.ref_reads = 0
        self.applied = False
        self.artifact = None

    def git(self, *arguments, input=None, env=None):
        return subprocess.run(['git', '-C', str(self.fixture.repo), *arguments], input=input, capture_output=True,
                              check=True, env=env).stdout

    def identity(self, *arguments):
        return self.git(*arguments).decode().strip()

    def build_tree(self, original, changes):
        index = self.fixture.scope / 'server.index'
        env = dict(os.environ, GIT_INDEX_FILE=str(index))
        self.git('read-tree', original, env=env)
        records = []
        for item in changes:
            records.append((item['mode'] + ' ' + item['sha'] if item['sha'] else '0 ' + '0' * 40) + '\t' + item['path'] + '\n')
        self.git('update-index', '--index-info', input=''.join(records).encode(), env=env)
        value = self.git('write-tree', env=env).decode().strip()
        index.unlink()
        return value

    def new_commit(self, parent, tree):
        return self.identity('-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.invalid',
                             'commit-tree', tree, '-p', parent, '-m', 'fixture publication')

    def advance(self):
        original = self.identity('rev-parse', self.remote + '^{tree}')
        value = self.git('hash-object', '-w', '--stdin', input=b'New protected source').decode().strip()
        tree = self.build_tree(original, [{'path': 'docs/advanced.md', 'mode': '100644', 'sha': value}])
        self.remote = self.new_commit(self.remote, tree)

    def fetch(self, path):
        return self.request(path)

    def alter(self, path, raw):
        original = self.identity('rev-parse', self.remote + '^{tree}')
        identity = self.git('hash-object', '-w', '--stdin', input=raw).decode().strip()
        value = self.build_tree(original, [{'path': path, 'mode': '100644', 'sha': identity}])
        self.remote = self.new_commit(self.remote, value)

    def download(self, path, destination, size, digest):
        self.events.append(('DOWNLOAD', path, None))
        if self.artifact is None or len(self.artifact) != size or hashlib.sha256(self.artifact).hexdigest() != digest:
            raise ValueError('Artifact download bytes differ')
        destination.write_bytes(self.artifact)

    def request(self, path, method='GET', data=None, **kwargs):
        self.events.append((method, path, deepcopy(data)))
        route = path.removeprefix(PREFIX + '/')
        route = route.removeprefix('repos/FlappiBakuse/NexusPipeline/')
        if method == 'GET' and route.startswith('commits/'):
            identity = route.removeprefix('commits/')
            identity = self.remote if identity == 'main' else identity
            return {'sha': identity, 'commit': {'tree': {'sha': self.identity('rev-parse', identity + '^{tree}')}}}
        if method == 'GET' and route == 'git/ref/heads/main':
            self.ref_reads += 1
            if self.fault == 'advance' and self.ref_reads == 2:
                self.advance()
            return {'ref': 'refs/heads/main', 'object': {'type': 'commit', 'sha': self.remote}}
        if method == 'GET' and route.startswith('git/commits/'):
            identity = route.removeprefix('git/commits/')
            return {'sha': identity, 'tree': {'sha': self.identity('rev-parse', identity + '^{tree}')},
                    'parents': [{'sha': value} for value in self.identity('show', '-s', '--format=%P', identity).split()]}
        if method == 'GET' and route.startswith('git/trees/'):
            identity = route.removeprefix('git/trees/').split('?')[0]
            entries = []
            for row in self.git('ls-tree', '-r', '-t', '-z', identity).split(b'\0'):
                if row:
                    header, name = row.split(b'\t')
                    mode, kind, value = header.decode().split()
                    entries.append({'path': name.decode(), 'mode': mode, 'type': kind, 'sha': value})
            return {'sha': identity, 'truncated': self.fault == 'truncated', 'tree': entries}
        if method == 'GET' and route.startswith('git/blobs/'):
            identity = route.removeprefix('git/blobs/')
            raw = self.git('cat-file', 'blob', identity)
            if self.fault == 'readback' and self.applied:
                raw = bytes([raw[0] ^ 1]) + raw[1:]
            return {'sha': identity, 'size': len(raw), 'encoding': 'base64', 'content': base64.b64encode(raw).decode()}
        if method == 'GET' and route.startswith('compare/'):
            older, newer = route.removeprefix('compare/').split('...')
            result = subprocess.run(['git', '-C', str(self.fixture.repo), 'merge-base', '--is-ancestor', older, newer], capture_output=True)
            return {'status': ('identical' if older == newer else 'ahead') if result.returncode == 0 else 'diverged',
                    'base_commit': {'sha': older}, 'merge_base_commit': {'sha': older if result.returncode == 0 else newer}}
        if method == 'POST' and route == 'git/blobs':
            value = self.git('hash-object', '-w', '--stdin', input=base64.b64decode(data['content'])).decode().strip()
            return {'sha': 'f' * 40 if self.fault == 'blob' else value}
        if method == 'POST' and route == 'git/trees':
            changes = list(data['tree'])
            if self.fault == 'tree':
                changes.append({'path': 'tooling/execute.py', 'mode': '100644', 'sha': changes[0]['sha']})
            return {'sha': self.build_tree(data['base_tree'], changes)}
        if method == 'POST' and route == 'git/commits':
            return {'sha': self.new_commit(data['parents'][0], data['tree'])}
        if method == 'PATCH' and route == 'git/refs/heads/main':
            if self.fault == 'patch':
                raise ValueError('Server rejected a non-fast-forward reference')
            assert data['force'] is False
            result = subprocess.run(['git', '-C', str(self.fixture.repo), 'merge-base', '--is-ancestor', self.remote, data['sha']], capture_output=True)
            if result.returncode:
                raise ValueError('Reference is not fast-forward')
            self.remote, self.applied = data['sha'], True
            return {'object': {'sha': self.remote}}
        raise AssertionError((method, path))


class PluginReleasePublishTests(unittest.TestCase):
    def setUp(self):
        self.fixture = planning.PluginReleasePlanTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        source = self.fixture.repo / 'plugins/managed/alpha/extension.json'
        manifest = json.loads(source.read_bytes())
        manifest.update(packageVersion='0.5.0', minHostVersion='0.18.0', displayName='Alpha', capabilities=[], permissions={},
                        managed={'entryAssembly': 'Alpha.dll', 'entryType': 'Fixture'},
                        frontend={'entry': 'frontend/main.js', 'styles': ['frontend/main.css'], 'sdkVersion': '0.1.0'})
        source.write_text(json.dumps(manifest), encoding='utf-8')
        self.source = self.fixture.commit()
        self.plan = self.fixture.plan()
        self.api = GitServer(self.fixture, self.source)
        self.directory = self.fixture.scope / 'candidate'
        self.manifest = {'format': 'nexus.extension.manifest', 'version': 1, 'sdkVersion': '0.1.0',
                         'contractFingerprint': 'a' * 64, **manifest}
        self.packages = {'Alpha': archive({'manifest.json': self.encode(self.manifest), 'Alpha.dll': b'Controlled package payload',
                                          'frontend/main.js': b'export const fixture = true;', 'frontend/main.css': b'.fixture {}'})}
        self.build_candidate()

    def encode(self, value):
        return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

    def write(self, name, value):
        path = self.directory / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)

    def build_candidate(self):
        facts = {}
        entries = {item['artifactName']: deepcopy(item) for item in self.fixture.catalog['plugins']}
        state = deepcopy(self.fixture.state)
        state['sourceCommit'] = self.source
        for artifact in self.plan['deleted']:
            entries.pop(artifact)
            state['released'].pop(artifact)
        for artifact, raw in self.packages.items():
            declaration = self.plan['plugins'][artifact]
            path = f"packages/{artifact}/{artifact}-{declaration['version']}.zip"
            source_tree = self.api.identity('rev-parse', self.source + ':' + declaration['path'])
            facts[artifact] = {'path': path, 'sha256': hashlib.sha256(raw).hexdigest(), 'sizeBytes': len(raw),
                               'manifestSha256': hashlib.sha256(self.encode(self.manifest)).hexdigest(), 'sourceTree': source_tree}
            record = {'name': declaration['extensionId'], 'artifactName': artifact, 'version': declaration['version'],
                      'sha256': facts[artifact]['sha256'], 'sizeBytes': len(raw)}
            entries[artifact] = {**record, 'kind': self.manifest['kind'], 'minHostVersion': '0.18.0', 'sdkVersion': '0.1.0',
                                 'manifestSha256': facts[artifact]['manifestSha256'],
                                 'packageUrl': 'https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/' + path}
            state['released'][artifact] = {**record, 'sourceTree': source_tree}
            self.write(path, raw)
        catalog = {**self.fixture.catalog, 'plugins': sorted(entries.values(), key=lambda item: (item.get('kind') != 'managed-code', item['name']))}
        self.write(CATALOG, self.encode(catalog))
        self.write('catalog.json', self.encode(catalog))
        self.write(STATE, self.encode(state))
        policy = POLICIES['stable']
        producer = {'repository': policy['repository'], 'workflow': policy['workflow'], 'workflowCommit': self.source,
                    'runId': 31, 'runAttempt': 1}
        candidate = {'format': 'nexus.release.candidate', 'version': 1, 'profile': 'production', 'kind': 'stable',
                     'producer': producer, 'source': self.plan['source'], 'partner': {'repository': 'FlappiBakuse/NexusPipeline',
                         'identity': self.plan['source']}, 'files': [], 'release': {'plan': self.plan, 'packageMetadata': facts}}
        self.verified = {'candidate': candidate, 'source': self.plan['source'], 'provenance':
                         {'kind': 'stable', **producer, 'completedJobsVerified': True}}
        self.save_candidate()

    def save_candidate(self):
        files = inventory(self.directory)
        files.pop('candidate.json', None)
        self.verified['candidate']['files'] = [files[name] for name in sorted(files)]
        self.write('candidate.json', self.encode(self.verified['candidate']))

    def test_preserves_readonly(self):
        result = publish_stable(self.api, self.directory, self.verified)
        self.assertEqual('VERIFIED_NOT_PUBLISHED', result['status'])
        self.assertFalse(result['remoteWritten'])
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))
        old = self.fixture.catalog['plugins'][2]
        old_path = f"packages/{old['artifactName']}/{old['artifactName']}-{old['version']}.zip"
        old_blob = self.api.identity('rev-parse', self.fixture.distribution + ':' + old_path)
        self.assertFalse(any(path.endswith('/git/blobs/' + old_blob) for _, path, _ in self.api.events))

    def test_publishes_exactly(self):
        original = self.api.git('ls-tree', '-r', self.source)
        result = publish_stable(self.api, self.directory, self.verified, True)
        self.assertEqual('PUBLISHED', result['status'])
        self.assertTrue(result['remoteWritten'])
        self.assertEqual(self.source, self.api.identity('rev-parse', self.api.remote + '^'))
        changed = self.api.git('diff', '--name-only', self.source, self.api.remote).decode().splitlines()
        self.assertEqual(sorted([CATALOG, STATE, 'catalog.json', 'packages/Alpha/Alpha-0.5.0.zip',
                                 'packages/Alpha/Alpha-0.3.0-beta.1.zip']), sorted(changed))
        self.assertEqual(original, self.api.git('ls-tree', '-r', self.source))
        self.assertEqual(self.source, self.fixture.git('rev-parse', 'HEAD').decode().strip())
        before = len([event for event in self.api.events if event[0] != 'GET'])
        again = publish_stable(self.api, self.directory, self.verified, True)
        self.assertEqual('ALREADY_PUBLISHED', again['status'])
        self.assertEqual(before, len([event for event in self.api.events if event[0] != 'GET']))

    def test_rejects_payloads(self):
        failures = {
            'source': 'Stable source differs from its verified Git tree',
            'package': 'Stable package bytes differ from PackageMetadata',
            'scope': 'Stable package path differs from artifactName and version',
            'projection': 'Stable catalog projection differs',
            'extra': 'Stable candidate files differ from their exact whitelist',
            'plan': 'Stable release plan must be an object',
        }
        for field, reason in failures.items():
            original = self.verified
            self.verified = deepcopy(original)
            candidate = self.verified['candidate']
            if field == 'source':
                candidate['source']['sourceMode'] = 'local-uncommitted'
                candidate['release']['plan']['source'] = candidate['source']
            elif field == 'package':
                with zipfile.ZipFile(io.BytesIO(self.packages['Alpha'])) as package:
                    members = {name: package.read(name) for name in package.namelist()}
                members['frontend/main.js'] = b'export const fixture = false;'
                self.write('packages/Alpha/Alpha-0.5.0.zip', archive(members))
            elif field == 'scope':
                candidate['release']['packageMetadata']['Alpha']['path'] = '../escape.zip'
            elif field == 'projection':
                self.write('catalog.json', b'{}')
            elif field == 'extra':
                self.write('tooling/execute.py', b'raise RuntimeError("Candidate source must never execute")')
            else:
                candidate['release']['plan'] = []
            self.save_candidate()
            server = GitServer(self.fixture, self.source)
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, reason):
                    publish_stable(server, self.directory, self.verified, True)
                self.assertTrue(all(method == 'GET' for method, _, _ in server.events))
            self.verified = original
            if field == 'extra':
                (self.directory / 'tooling/execute.py').unlink()
            elif field == 'package':
                self.write('packages/Alpha/Alpha-0.5.0.zip', self.packages['Alpha'])
            elif field == 'projection':
                self.write('catalog.json', (self.directory / CATALOG).read_bytes())
            self.save_candidate()

    def test_rejects_unselected(self):
        for name in [CATALOG, STATE]:
            before = (self.directory / name).read_bytes()
            value = json.loads(before)
            if name == CATALOG:
                next(item for item in value['plugins'] if item['artifactName'] == 'Gamma')['name'] = 'changed'
            else:
                value['released']['Gamma']['sizeBytes'] = 1
            self.write(name, self.encode(value))
            if name == CATALOG:
                self.write('catalog.json', self.encode(value))
            self.save_candidate()
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'unselected'):
                publish_stable(self.api, self.directory, self.verified, True)
            self.write(name, before)
            self.write('catalog.json', (self.directory / CATALOG).read_bytes())
            self.save_candidate()
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_rejects_source(self):
        self.api.advance()
        with self.assertRaisesRegex(ValueError, 'superseded'):
            publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_checks_server(self):
        failures = {
            'truncated': 'Git tree is missing or truncated',
            'blob': 'Uploaded Git blob identity differs',
            'tree': 'Prepared stable tree exceeds its exact whitelist',
            'advance': 'Stable main advanced before the atomic update',
            'patch': 'Server rejected a non-fast-forward reference',
            'readback': 'Git blob bytes differ from their identity',
        }
        for fault, reason in failures.items():
            with self.subTest(fault=fault):
                server = GitServer(self.fixture, self.source)
                server.fault = fault
                with self.assertRaisesRegex(ValueError, reason):
                    publish_stable(server, self.directory, self.verified, True)
                if fault == 'readback':
                    self.assertEqual((self.directory / 'catalog.json').read_bytes(), server.git('show', server.remote + ':catalog.json'))
                elif fault == 'advance':
                    self.assertEqual(b'New protected source', server.git('show', server.remote + ':docs/advanced.md'))
                    self.assertEqual(server.git('show', self.source + ':catalog.json'), server.git('show', server.remote + ':catalog.json'))
                else:
                    self.assertEqual(self.source, server.remote)

    def test_removes_deleted(self):
        self.fixture.git('checkout', '-b', 'remove-beta', self.fixture.distribution)
        self.fixture.git('rm', '-r', 'plugins/specialized/beta')
        self.source = self.fixture.commit()
        self.plan = self.fixture.plan()
        self.packages = {}
        self.api = GitServer(self.fixture, self.source)
        self.directory = self.fixture.scope / 'deleted-candidate'
        self.build_candidate()
        result = publish_stable(self.api, self.directory, self.verified, True)
        self.assertEqual('PUBLISHED', result['status'])
        paths = self.api.git('ls-tree', '-r', '--name-only', self.api.remote).decode().splitlines()
        self.assertFalse(any(name.startswith('packages/Beta/') for name in paths))
        self.assertTrue(any(name.startswith('packages/Gamma/') for name in paths))
        state = json.loads(self.api.git('show', self.api.remote + ':' + STATE))
        self.assertEqual(self.source, state['sourceCommit'])
        self.assertEqual({'Alpha', 'Gamma'}, set(state['released']))

    def test_rejects_baseline(self):
        self.api.alter('catalog.json', b'Changed distribution')
        with self.assertRaisesRegex(ValueError, 'baseline is stale'):
            publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_preserves_immutable(self):
        self.fixture.write('packages/Alpha/Alpha-0.5.0.zip', b'Published immutable package')
        self.fixture.distribution = self.fixture.commit()
        self.source = self.fixture.distribution
        self.plan = self.fixture.plan()
        self.api = GitServer(self.fixture, self.source)
        self.build_candidate()
        with self.assertRaisesRegex(ValueError, 'immutable'):
            publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_binds_manifest(self):
        self.manifest['managed']['entryAssembly'] = 'Other.dll'
        self.packages['Alpha'] = archive({'manifest.json': self.encode(self.manifest), 'Other.dll': b'Changed payload',
                                          'frontend/main.js': b'export const fixture = true;', 'frontend/main.css': b'.fixture {}'})
        self.build_candidate()
        with self.assertRaisesRegex(ValueError, 'differs from fixed source'):
            publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_requires_entries(self):
        original = {'manifest.json': self.encode(self.manifest), 'Alpha.dll': b'Controlled package payload',
                    'frontend/main.js': b'export const fixture = true;', 'frontend/main.css': b'.fixture {}'}
        for name in ['Alpha.dll', 'frontend/main.js', 'NexusPipeline.Extensibility.dll']:
            members = dict(original)
            if name == 'NexusPipeline.Extensibility.dll':
                members[name] = b'Unowned shared SDK'
            else:
                members.pop(name)
            self.packages['Alpha'] = archive(members)
            self.build_candidate()
            with self.subTest(name=name), self.assertRaises(ValueError):
                publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_rejects_empty(self):
        self.verified['candidate']['release']['plan']['status'] = 'NO_CHANGES'
        self.save_candidate()
        with self.assertRaisesRegex(ValueError, 'planned stable release'):
            publish_stable(self.api, self.directory, self.verified, True)
        self.assertEqual([], self.api.events)

    def test_verifies_original(self):
        self.api.artifact = archive({path.relative_to(self.directory).as_posix(): path.read_bytes()
                                    for path in self.directory.rglob('*') if path.is_file()})
        provenance = {**self.verified['provenance'], 'artifactId': 73, 'artifactSizeBytes': len(self.api.artifact),
                      'artifactDigest': 'sha256:' + hashlib.sha256(self.api.artifact).hexdigest(),
                      'writer': {**self.verified['candidate']['producer'], 'runId': 32}}
        args = SimpleNamespace(output=self.fixture.scope / 'original', run_id=31, writer_id=32, artifact_id=73, publish=False)
        with patch('plugin_release_check.resolve_candidate', return_value=provenance), patch('package_extension.archive', side_effect=AssertionError('Writer must not build')):
            result = verify_original(args, self.api)
        self.assertEqual('VERIFIED_NOT_PUBLISHED', result['status'])
        self.assertTrue(all(method in ['GET', 'DOWNLOAD'] for method, _, _ in self.api.events))
        args.output = self.fixture.scope / 'bad-original'
        self.api.artifact += b'Changed artifact'
        with patch('plugin_release_check.resolve_candidate', return_value=provenance), self.assertRaisesRegex(ValueError, 'download bytes differ'):
            verify_original(args, self.api)
        self.assertEqual('FAIL', json.loads((args.output / 'result.json').read_bytes())['status'])

    def test_rejects_spoofing(self):
        producer = self.verified['candidate']['producer']
        provenance = {**self.verified['provenance'], 'writer': producer}
        args = SimpleNamespace(output=self.fixture.scope / 'spoofed', run_id=31, writer_id=32, artifact_id=73, publish=True)
        env = {'GITHUB_REPOSITORY': producer['repository'], 'GITHUB_EVENT_NAME': 'workflow_dispatch',
               'GITHUB_REF': 'refs/heads/main', 'GITHUB_WORKFLOW_REF': producer['repository'] + '/' + producer['workflow'] + '@refs/heads/main',
               'GITHUB_SHA': producer['workflowCommit'], 'GITHUB_RUN_ID': str(producer['runId']), 'GITHUB_RUN_ATTEMPT': '1'}
        with patch.dict(os.environ, env), patch('plugin_release_check.resolve_candidate', return_value=provenance), self.assertRaises(ValueError):
            verify_original(args, self.api)
        self.assertFalse(args.output.exists())
        self.assertEqual([], self.api.events)

    def test_binds_frontend(self):
        self.plan['plugins']['Alpha']['frontend'] = False
        self.save_candidate()
        with self.assertRaisesRegex(ValueError, 'declaration differs'):
            publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

    def test_guards_data(self):
        self.fixture.git('checkout', '-b', 'data-package', self.fixture.distribution)
        path = self.fixture.repo / 'plugins/specialized/beta/extension.json'
        manifest = json.loads(path.read_bytes())
        manifest.update(packageVersion='0.5.0', minHostVersion='0.18.0', displayName='Beta', capabilities=[], permissions={},
                        specialized={'adapterEntry': 'adapter/main.js'})
        path.write_text(json.dumps(manifest), encoding='utf-8')
        self.source = self.fixture.commit()
        self.plan = self.fixture.plan()
        self.api = GitServer(self.fixture, self.source)
        self.directory = self.fixture.scope / 'data-candidate'
        self.manifest = {'format': 'nexus.extension.manifest', 'version': 1, 'sdkVersion': '0.1.0',
                         'contractFingerprint': 'a' * 64, **manifest}
        original = {'manifest.json': self.encode(self.manifest), 'adapter/main.js': b'globalThis.nexusDiscoverScript = () => ({});'}
        self.packages = {'Beta': archive(original)}
        self.build_candidate()
        self.assertEqual('VERIFIED_NOT_PUBLISHED', publish_stable(self.api, self.directory, self.verified)['status'])
        for name, content, reason in [
            ('worker/evil.dll', b'Undeclared payload', 'has an undeclared payload'),
            ('frontend/main.js', b'Undeclared payload', 'has an undeclared payload'),
            ('adapter/main.js', b'Invalid\0script', 'contains binary bytes'),
            ('MANIFEST.JSON', original['manifest.json'], 'has unsafe or colliding members'),
        ]:
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w') as output:
                for member, raw in (original | {name: content}).items():
                    output.writestr(member, raw)
            self.packages['Beta'] = buffer.getvalue()
            self.build_candidate()
            with self.subTest(member=name), self.assertRaisesRegex(ValueError, reason):
                publish_stable(self.api, self.directory, self.verified, True)
        self.assertTrue(all(method == 'GET' for method, _, _ in self.api.events))

