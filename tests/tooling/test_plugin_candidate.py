from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling'))
import test_plugin_release_plan as planning
import test_plugin_release_publish as publishing
from import_sdk import import_sdk
from package_extension import archive
from package_inputs import inputs
from plugin_release_assemble import assemble
from plugin_release_inputs import CATALOG, STATE
from plugin_release_publish import publish_stable
from release_candidate import validate
from source_snapshot import encode, sha, snapshot, source_files


class PluginCandidateTests(unittest.TestCase):
    def setUp(self):
        self.fixture = planning.PluginReleasePlanTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.root = self.fixture.repo
        self.scope = self.fixture.scope
        self.host = self.scope / 'host'
        self.host.mkdir()
        self.git(self.host, 'init', '--initial-branch=develop')
        self.git(self.host, 'config', 'core.autocrlf', 'false')
        self.fingerprint = 'a' * 64
        self.write(self.host / 'contracts/fingerprint.json', {'contractFingerprint': self.fingerprint})
        self.write(self.host / 'README.md', b'Controlled Host source\n')
        self.host_commit = self.commit(self.host)
        self.host_source = snapshot(self.host, self.scope / 'host-export', self.host_commit)
        self.sdk_receipt = self.scope / 'sdk-receipt.json'
        self.host_receipt = self.scope / 'host-build.json'
        self.sdk_archive = self.scope / 'sdk.nupkg'
        with zipfile.ZipFile(self.sdk_archive, 'w') as package:
            package.writestr('contracts/fingerprint.json', (self.host / 'contracts/fingerprint.json').read_bytes())
        self.sdk('production')
        import_sdk(self.root, self.sdk_receipt)
        old = self.root / 'contracts/fingerprint.json'
        self.write(old, {'contractFingerprint': self.fingerprint, 'description': 'Earlier generated projection'})
        lock_path = self.root / 'contracts/sdk-source-lock.json'
        lock = json.loads(lock_path.read_bytes())
        lock['exportedContracts']['contracts/fingerprint.json'] = sha(old.read_bytes())
        lock['dotnetPackageSha256'] = 'b' * 64
        self.write(lock_path, lock)
        self.fixture.cursor = self.fixture.commit()
        self.fixture.state['sourceCommit'] = self.fixture.cursor
        for item in self.fixture.catalog['plugins']:
            kind = next(row[2] for row in self.fixture.items if row[1] == item['artifactName'])
            item['kind'] = 'managed-code' if kind == 'managed' else 'data-specialized'
            item['changelog'] = [{'version': '0.4.0', 'date': '2026-10-30', 'items': ['Published notes']}]
        self.fixture.catalog['plugins'][0]['metadata'] = {'createdAt': '2026-01-01T00:00:00Z'}
        self.fixture.metadata()
        self.fixture.distribution = self.fixture.commit()
        self.plugin = self.root / 'plugins/managed/alpha'
        manifest = json.loads((self.plugin / 'extension.json').read_bytes())
        manifest.pop('frontend')
        manifest.update(packageVersion='0.5.0', displayName='Alpha', gameName='Fixture game', summary='Fixture summary',
                        author='Fixture', tags=['Fixture'], minHostVersion='0.18.0', capabilities=[], permissions={},
                        managed={'entryAssembly': 'Alpha.dll', 'entryType': 'Fixture'},
                        localization={'defaultLocale': 'zh-CN', 'locales': {'zh-CN': 'i18n/zh-CN.json', 'en-US': 'i18n/en-US.json'}})
        self.write(self.plugin / 'extension.json', manifest)
        for locale in ['zh-CN', 'en-US']:
            self.write(self.plugin / f'i18n/{locale}.json', {'manifest': {key: manifest[key] for key in ['displayName', 'gameName', 'summary']},
                                                          'tasks': {}, 'diagnostics': {}})
        self.write(self.plugin / 'README.md', b'Current packaged instructions\n')
        self.notes('2026-11-01')
        self.source_commit = self.fixture.commit()
        self.consumer = self.scope / 'consumer'
        self.git(self.scope, '-c', 'core.autocrlf=false', 'clone', '--no-hardlinks', str(self.root), str(self.consumer))
        self.package_receipt = self.scope / 'package.json'
        self.make_package('production')
        self.args = SimpleNamespace(source_root=self.root, source_commit=self.source_commit, partner_root=self.host,
            partner_commit=self.host_commit, distribution_root=self.root, distribution_commit=self.fixture.distribution,
            output=self.scope / 'candidate', profile='production', sdk_receipt=self.sdk_receipt,
            host_build_receipt=self.host_receipt, package_receipt=[self.package_receipt])

    def git(self, root, *arguments):
        result = subprocess.run(['git', '-C', str(root), *arguments], capture_output=True)
        if result.returncode:
            raise ValueError('Fixture Git failed: ' + result.stderr.decode('utf-8', errors='replace'))
        return result.stdout

    def commit(self, root):
        self.git(root, 'add', '--all')
        self.git(root, '-c', 'user.name=Candidate Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '--no-gpg-sign', '-m', 'fixture')
        return self.git(root, 'rev-parse', 'HEAD').decode().strip()

    def write(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value if isinstance(value, bytes) else encode(value))

    def notes(self, released):
        header = '## 0.5.0' + (' - ' + released if released else '')
        for name in ['CHANGELOG.md', 'CHANGELOG.en.md']:
            self.write(self.plugin / name, (header + '\n\n- Current authored release note.\n').encode())

    def sdk(self, profile):
        build = {'exitCode': 0, 'profile': profile, 'sdkApi': {'exitCode': 0}, 'source': self.host_source,
                 'componentInputs': {'projectNames': ['NexusPipeline.Extensibility', 'NexusPipeline.Boundaries']}}
        self.write(self.host_receipt, build)
        sdk = {'status': 'PASS', 'hostSource': self.host_source, 'contractFingerprint': self.fingerprint,
               'hostBuildReceiptSha256': sha(self.host_receipt.read_bytes()), 'packages': [{'path': str(self.sdk_archive),
               'sha256': sha(self.sdk_archive.read_bytes()), 'sizeBytes': self.sdk_archive.stat().st_size}]}
        self.write(self.sdk_receipt, sdk)

    def make_package(self, profile):
        self.sdk(profile)
        for item in source_files(self.root):
            if not item['path'].startswith('contracts/'):
                self.write(self.consumer / item['path'], (self.root / item['path']).read_bytes())
        import_sdk(self.consumer, self.sdk_receipt)
        source = snapshot(self.consumer, self.scope / 'package-build')
        frozen = Path(source['exportRoot'])
        from localization import project_metadata
        declaration = json.loads((frozen / 'plugins/managed/alpha/extension.json').read_bytes())
        manifest = project_metadata(frozen / 'plugins/managed/alpha', {'format': 'nexus.extension.manifest', 'version': 1,
            'sdkVersion': '0.1.0', 'contractFingerprint': self.fingerprint, **declaration})
        manifest_path, assembly = self.scope / 'manifest.json', self.scope / 'Alpha.dll'
        self.write(manifest_path, manifest)
        self.write(assembly, b'Controlled compiled fixture payload')
        build = {'status': 'PASS', 'source': source, 'sdkReceiptSha256': sha(self.sdk_receipt.read_bytes()),
                 'contractFingerprint': self.fingerprint, 'manifest': {'path': str(manifest_path), 'sha256': sha(manifest_path.read_bytes())},
                 'assembly': {'path': str(assembly), 'sha256': sha(assembly.read_bytes())}}
        build_path = self.scope / 'plugin-build.json'
        self.write(build_path, build)
        manifest, members, binding = inputs(self.consumer, build_path, self.sdk_receipt)
        data = archive(members)
        target = self.scope / 'Alpha-0.5.0.zip'
        self.write(target, data)
        package = {'status': 'PASS', 'createdAt': '1999-01-01T00:00:00Z', 'extensionId': 'alpha', 'packageVersion': '0.5.0',
            'manifestSha256': sha(members['manifest.json']), 'artifact': {'path': str(target), 'sha256': sha(data), 'sizeBytes': len(data)},
            'members': [{'path': name, 'sha256': sha(raw), 'sizeBytes': len(raw)} for name, raw in sorted(members.items())], **binding}
        self.write(self.package_receipt, package)

    def environment(self):
        repository = 'FlappiBakuse/NexusPipeline-Plugins'
        workflow = '.github/workflows/publish-stable.yml'
        return {'GITHUB_REPOSITORY': repository, 'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_REF': 'refs/heads/main',
                'GITHUB_WORKFLOW_REF': repository + '/' + workflow + '@refs/heads/main', 'GITHUB_SHA': self.args.source_commit,
                'GITHUB_RUN_ID': '31', 'GITHUB_RUN_ATTEMPT': '1'}

    def run_candidate(self):
        with patch.dict(os.environ, self.environment() if self.args.profile == 'production' else {}):
            return assemble(self.args)

    def test_builds_candidate(self):
        before = {name: (self.root / name).read_bytes() for name in [CATALOG, STATE, 'catalog.json']}
        result = self.run_candidate()
        self.assertEqual('CANDIDATE_CREATED_NOT_QUALIFIED', result['status'])
        candidate = json.loads((self.args.output / 'candidate.json').read_bytes())
        fact = candidate['release']['packageMetadata']['Alpha']
        catalog = json.loads((self.args.output / CATALOG).read_bytes())
        state = json.loads((self.args.output / STATE).read_bytes())
        entry = next(item for item in catalog['plugins'] if item['artifactName'] == 'Alpha')
        self.assertEqual('packages/Alpha/Alpha-0.5.0.zip', fact['path'])
        self.assertEqual(fact['sha256'], entry['sha256'])
        self.assertEqual(fact['sha256'], state['released']['Alpha']['sha256'])
        self.assertEqual('2026-11-01', entry['updatedAt'])
        self.assertEqual('2026-11-01T00:00:00Z', entry['metadata']['updatedAt'])
        self.assertEqual('2026-01-01T00:00:00Z', entry['metadata']['createdAt'])
        self.assertEqual(self.source_commit, state['sourceCommit'])
        self.assertEqual(before, {name: (self.root / name).read_bytes() for name in before})
        package = json.loads(self.package_receipt.read_bytes())
        self.assertNotEqual(candidate['source']['sourceSnapshotHash'], package['source']['sourceSnapshotHash'])
        self.assertEqual(sha(self.sdk_receipt.read_bytes()), candidate['release']['plan']['packageInputs']['sdkReceiptSha256'])

    def test_roundtrips_writer(self):
        self.run_candidate()
        candidate = json.loads((self.args.output / 'candidate.json').read_bytes())
        provenance = {'kind': 'stable', **candidate['producer'], 'completedJobsVerified': True}
        server = publishing.GitServer(self.fixture, self.source_commit)

        def fetch(path):
            prefix = 'repos/FlappiBakuse/NexusPipeline/'
            if not path.startswith(prefix):
                return server.fetch(path)
            route = path.removeprefix(prefix)
            if route.startswith('commits/'):
                identity = route.removeprefix('commits/')
                identity = self.host_commit if identity == 'main' else identity
                tree = self.git(self.host, 'rev-parse', identity + '^{tree}').decode().strip()
                return {'sha': identity, 'commit': {'tree': {'sha': tree}}}
            if route.startswith('compare/'):
                return {'status': 'identical', 'base_commit': {'sha': self.host_commit}, 'merge_base_commit': {'sha': self.host_commit}}
            raise AssertionError(path)

        verified = validate(self.args.output, provenance, fetch)
        result = publish_stable(server, self.args.output, verified, True)
        self.assertEqual('PUBLISHED', result['status'])
        self.assertEqual(self.source_commit, json.loads(server.git('show', server.remote + ':' + STATE))['sourceCommit'])

    def test_rejects_receipts(self):
        for case in ['missing', 'duplicate', 'profile', 'package']:
            args = deepcopy(self.args)
            if case == 'missing':
                self.args.package_receipt = []
            elif case == 'duplicate':
                self.args.package_receipt *= 2
            elif case == 'profile':
                self.args.profile = 'test'
            else:
                value = json.loads(self.package_receipt.read_bytes())
                self.write(Path(value['artifact']['path']), b'Changed artifact')
            with self.subTest(case=case), self.assertRaises(ValueError):
                self.run_candidate()
            self.assertFalse(self.args.output.exists())
            self.args = args

    def test_rejects_changed_source(self):
        self.write(self.plugin / 'README.md', b'Changed after package generation\n')
        self.args.source_commit = self.fixture.commit()
        with self.assertRaisesRegex(ValueError, 'different source inputs'):
            self.run_candidate()
        self.assertFalse(self.args.output.exists())

    def test_rejects_forged_package(self):
        receipt = json.loads(self.package_receipt.read_bytes())
        target = Path(receipt['artifact']['path'])
        with zipfile.ZipFile(target) as package:
            members = {name: package.read(name) for name in package.namelist()}
        members['Alpha.dll'] = b'Payload outside the compiler receipt'
        raw = archive(members)
        self.write(target, raw)
        receipt['artifact'].update(sha256=sha(raw), sizeBytes=len(raw))
        receipt['members'] = [{'path': name, 'sha256': sha(value), 'sizeBytes': len(value)} for name, value in sorted(members.items())]
        self.write(self.package_receipt, receipt)
        with self.assertRaisesRegex(ValueError, 'member changed'):
            self.run_candidate()
        self.assertFalse(self.args.output.exists())

    def test_keeps_no_changes(self):
        self.fixture.git('checkout', '-b', 'no-changes', self.fixture.distribution)
        self.args.source_commit = self.fixture.distribution
        self.args.package_receipt = []
        self.args.sdk_receipt = self.args.host_build_receipt = None
        self.assertEqual('NO_CHANGES', self.run_candidate()['status'])
        self.assertFalse(self.args.output.exists())

    def test_builds_deletion(self):
        self.fixture.git('checkout', '-b', 'deleted', self.fixture.distribution)
        self.fixture.git('rm', '-r', 'plugins/specialized/beta')
        self.args.source_commit = self.fixture.commit()
        self.args.package_receipt = []
        self.args.sdk_receipt = self.args.host_build_receipt = None
        self.run_candidate()
        state = json.loads((self.args.output / STATE).read_bytes())
        self.assertEqual({'Alpha', 'Gamma'}, set(state['released']))
        candidate = json.loads((self.args.output / 'candidate.json').read_bytes())
        self.assertEqual({}, candidate['release']['packageMetadata'])
        self.assertEqual(['packages/Beta'], candidate['release']['plan']['removeArtifacts'])

    def test_preserves_paths(self):
        self.args.output = self.root / 'candidate'
        with self.assertRaises(ValueError):
            self.run_candidate()
        self.assertFalse(self.args.output.exists())
        self.args.output = self.scope / 'occupied'
        self.write(self.args.output / 'sentinel', b'Original')
        with self.assertRaises(ValueError):
            self.run_candidate()
        self.assertEqual(b'Original', (self.args.output / 'sentinel').read_bytes())

    def test_requires_release_date(self):
        self.notes(None)
        self.args.source_commit = self.fixture.commit()
        self.make_package('production')
        with self.assertRaisesRegex(ValueError, 'authored current release date'):
            self.run_candidate()
        self.assertFalse(self.args.output.exists())

    def test_keeps_local_identity(self):
        self.notes(None)
        self.make_package('test')
        self.args.profile, self.args.source_commit, self.args.partner_commit = 'test', None, None
        self.run_candidate()
        candidate = json.loads((self.args.output / 'candidate.json').read_bytes())
        self.assertEqual('test', candidate['profile'])
        self.assertIsNone(candidate['source']['sourceCommit'])
        self.assertIsNone(candidate['source']['sourceTree'])
        self.assertIsNone(candidate['release']['packageMetadata']['Alpha']['sourceTree'])
        entry = next(item for item in json.loads((self.args.output / CATALOG).read_bytes())['plugins'] if item['artifactName'] == 'Alpha')
        self.assertIsNone(entry['updatedAt'])
        self.assertIsNone(entry['metadata']['updatedAt'])
        self.assertIsNone(candidate['producer'])

