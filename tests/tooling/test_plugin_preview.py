import hashlib
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling'))
import test_plugin_candidate as candidate_fixture
from plugin_preview_assemble import assemble
from plugin_preview_payload import RELEASE, read_payload
from plugin_release_inputs import CATALOG, STATE


class PluginPreviewTests(unittest.TestCase):
    def setUp(self):
        self.fixture = candidate_fixture.PluginCandidateTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.args = self.fixture.args

    def single_plugin(self):
        f = self.fixture
        for root in (f.root, f.consumer):
            self.assertTrue(root.resolve().is_relative_to(f.scope.resolve()))
            f.git(root, 'rm', '-r', '--', 'plugins/specialized/beta', 'plugins/managed/gamma')
        f.args.source_commit = f.fixture.commit()
        f.make_package('production')

    def run_candidate(self):
        environment = self.fixture.environment() if self.args.profile == 'production' else {}
        if environment:
            environment['GITHUB_WORKFLOW_REF'] = 'FlappiBakuse/NexusPipeline-Plugins/.github/workflows/publish-develop.yml@refs/heads/main'
        with patch.dict(os.environ, environment):
            return assemble(self.args)

    def verified(self):
        candidate = json.loads((self.args.output / 'candidate.json').read_bytes())
        return {'candidate': candidate, 'provenance': {'kind': 'preview', **candidate['producer'], 'completedJobsVerified': True},
            'source': {key: candidate['source'][key] for key in ('sourceCommit', 'sourceTree')}}

    def test_builds_preview(self):
        self.single_plugin()
        f = self.fixture
        before = {name: (f.root / name).read_bytes() for name in [CATALOG, STATE, 'catalog.json']}
        self.assertEqual('CANDIDATE_CREATED_NOT_QUALIFIED', self.run_candidate()['status'])
        receipt = json.loads(f.package_receipt.read_bytes())
        package = Path(receipt['artifact']['path']).read_bytes()
        filename = f"Alpha-0.5.0-{hashlib.sha256(package).hexdigest()}.zip"
        _, _, entries, actual, _ = read_payload(self.args.output, self.verified())
        self.assertEqual({'catalog.json', 'packages/' + filename}, set(actual))
        self.assertEqual(RELEASE + filename, entries['Alpha']['packageUrl'])
        self.assertEqual(self.args.source_commit, entries['Alpha']['sourceCommit'])
        self.assertEqual(before, {name: (f.root / name).read_bytes() for name in before})
        self.assertEqual(package, (self.args.output / 'packages' / filename).read_bytes())

    def test_requires_complete_packages(self):
        with self.assertRaisesRegex(ValueError, 'every current plugin'):
            self.run_candidate()
        self.assertFalse(self.args.output.exists())

    def test_rejects_changed_payload(self):
        self.single_plugin()
        self.run_candidate()
        verified = self.verified()
        fact = verified['candidate']['release']['packageMetadata']['Alpha']
        path = self.args.output / fact['path']
        path.write_bytes(path.read_bytes() + b'Changed original bytes')
        with self.assertRaisesRegex(ValueError, 'whitelist'):
            read_payload(self.args.output, verified)

    def test_rejects_catalog_change(self):
        self.single_plugin()
        self.run_candidate()
        verified = self.verified()
        path = self.args.output / 'catalog.json'
        catalog = json.loads(path.read_bytes())
        catalog['plugins'][0]['packageUrl'] = RELEASE + 'Alpha-0.5.0.zip'
        raw = (json.dumps(catalog) + '\n').encode()
        path.write_bytes(raw)
        for row in verified['candidate']['files']:
            if row['path'] == 'catalog.json':
                row.update(sizeBytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
        with self.assertRaisesRegex(ValueError, 'package binding'):
            read_payload(self.args.output, verified)

    def test_keeps_no_changes(self):
        f = self.fixture
        f.fixture.git('checkout', '-b', 'preview-unchanged', f.fixture.distribution)
        self.args.source_commit = f.fixture.distribution
        self.args.package_receipt = []
        self.args.sdk_receipt = self.args.host_build_receipt = None
        self.assertEqual('NO_CHANGES', self.run_candidate()['status'])
        self.assertFalse(self.args.output.exists())

    def test_keeps_local_identity(self):
        self.single_plugin()
        self.fixture.notes(None)
        self.fixture.make_package('test')
        self.args.profile, self.args.source_commit, self.args.partner_commit = 'test', None, None
        self.assertEqual('CANDIDATE_CREATED_NOT_QUALIFIED', self.run_candidate()['status'])
        candidate = json.loads((self.args.output / 'candidate.json').read_bytes())
        self.assertIsNone(candidate['producer'])
        self.assertIsNone(candidate['source']['sourceCommit'])
        self.assertIsNone(candidate['release']['packageMetadata']['Alpha']['sourceTree'])
        with self.assertRaisesRegex(ValueError, 'production'):
            read_payload(self.args.output, {'candidate': candidate, 'provenance': {}})

    def test_preserves_output(self):
        self.single_plugin()
        self.args.output = self.fixture.root / 'preview'
        with self.assertRaises(ValueError):
            self.run_candidate()
        self.assertFalse(self.args.output.exists())
        self.args.output = self.fixture.scope / 'occupied'
        self.fixture.write(self.args.output / 'sentinel', b'Preserved output')
        with self.assertRaises(ValueError):
            self.run_candidate()
        self.assertEqual(b'Preserved output', (self.args.output / 'sentinel').read_bytes())
