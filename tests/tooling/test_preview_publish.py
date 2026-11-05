from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import unittest
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling'))
import test_plugin_preview as preview_fixture
import test_plugin_release_publish as stable_fixture
from plugin_preview_assets import PREFIX
from plugin_preview_publish import publish_preview


class PreviewServer(stable_fixture.GitServer):
    def __init__(self, fixture, source, existing=True):
        super().__init__(fixture, source)
        self.release = dict(id=1, tag_name='plugins-develop', draft=False, prerelease=True) if existing else None
        self.records = {}
        self.next_id = 100
        self.fail = None
        self.uploaded = []
        self.writes = []
        self.old_catalog = None
        if existing:
            self.old_catalog = (json.dumps(dict(schemaVersion=2, repository='FlappiBakuse/NexusPipeline-Plugins',
                channel='develop', sourceCommit=fixture.distribution, plugins=[])) + '\n').encode()
            self.add('catalog.json', self.old_catalog)
            self.add('retained-package.zip', b'Retain old immutable preview package')

    def add(self, name, raw):
        self.next_id += 1
        record = dict(id=self.next_id, name=name, state='uploaded', size=len(raw), digest='sha256:' + hashlib.sha256(raw).hexdigest())
        self.records[record['id']] = dict(record=record, raw=raw)
        return deepcopy(record)

    def fetch(self, path):
        return self.request(path)

    def request(self, path, method='GET', data=None, **kwargs):
        if path == PREFIX + '/commits/develop':
            return dict(sha=self.remote)
        if path == PREFIX + '/releases/tags/plugins-develop':
            if self.release is None:
                raise urllib.error.HTTPError(path, 404, 'No preview', {}, None)
            return deepcopy(self.release)
        if path.startswith(PREFIX + '/releases/1/assets?'):
            return [deepcopy(item['record']) for item in self.records.values()]
        if path.startswith(PREFIX + '/releases/assets/'):
            identity = int(path.rsplit('/', 1)[1])
            if method == 'DELETE':
                self.writes.append(('delete', self.records[identity]['record']['name']))
                del self.records[identity]
                return None
            return deepcopy(self.records[identity]['record'])
        if path == PREFIX + '/releases' and method == 'POST':
            self.writes.append(('create', 'release'))
            self.release = dict(id=1, **data)
            return deepcopy(self.release)
        if path == PREFIX + '/releases/1' and method == 'PATCH':
            self.writes.append(('publish', 'release'))
            if self.fail == 'publish':
                self.fail = None
                raise ValueError('Controlled publication failure')
            self.release.update(data)
            return deepcopy(self.release)
        return super().request(path, method, data, **kwargs)

    def download(self, path, destination, size, digest):
        item = self.records[int(path.rsplit('/', 1)[1])]
        raw = item['raw']
        if size != len(raw) or digest != hashlib.sha256(raw).hexdigest():
            raise ValueError('Controlled asset bytes differ')
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open('xb') as stream:
            stream.write(raw)

    def upload(self, repository, release_id, path, name):
        self.writes.append(('upload', name))
        self.uploaded.append(name)
        if self.fail == 'package' and name.endswith('.zip'):
            self.fail = None
            raise ValueError('Controlled package failure')
        if self.fail == 'catalog' and name == 'catalog.json':
            self.fail = None
            raise ValueError('Controlled catalog failure')
        raw = path.read_bytes()
        if self.fail == 'corrupt' and name == 'catalog.json':
            self.fail = None
            raw += b'Corrupt returned catalog bytes'
        result = self.add(name, raw)
        if self.fail == 'advance' and name.endswith('.zip'):
            self.fail = None
            self.advance()
        return result

    def catalog(self):
        values = [item['raw'] for item in self.records.values() if item['record']['name'] == 'catalog.json']
        if len(values) > 1:
            raise ValueError('Multiple catalog assets')
        return values[0] if values else None


class PreviewPublishTests(unittest.TestCase):
    def setUp(self):
        self.fixture = preview_fixture.PluginPreviewTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.single_plugin()
        self.fixture.run_candidate()
        self.data = self.fixture.verified()
        self.base = self.fixture.fixture
        self.server = PreviewServer(self.base.fixture, self.base.args.source_commit)
        self.round = 0

    def publish(self, publish=True, server=None):
        self.round += 1
        return publish_preview(server or self.server, self.base.args.output, self.data,
            self.base.scope / ('preview-publication-' + str(self.round)), publish)

    def test_publishes_preview(self):
        result = self.publish()
        self.assertEqual('PUBLISHED', result['status'])
        self.assertTrue(result['remoteWritten'])
        self.assertEqual((self.base.args.output / 'catalog.json').read_bytes(), self.server.catalog())
        names = self.server.uploaded
        self.assertTrue(names[0].endswith('.zip'))
        self.assertTrue(names[1].startswith('preview-publisher-'))
        self.assertEqual('catalog.json', names[2])
        self.assertIn('retained-package.zip', [item['record']['name'] for item in self.server.records.values()])

    def test_preserves_readonly(self):
        original = self.server.catalog()
        self.assertEqual('VERIFIED_NOT_PUBLISHED', self.publish(False)['status'])
        self.assertEqual([], self.server.writes)
        self.assertEqual(original, self.server.catalog())

    def test_repeats_immutably(self):
        self.publish()
        before = deepcopy(self.server.writes)
        result = self.publish()
        self.assertEqual('ALREADY_PUBLISHED', result['status'])
        self.assertFalse(result['remoteWritten'])
        self.assertEqual(before, self.server.writes)

    def test_creates_release(self):
        server = PreviewServer(self.base.fixture, self.base.args.source_commit, existing=False)
        self.assertEqual('PUBLISHED', self.publish(server=server)['status'])
        self.assertFalse(server.release['draft'])
        self.assertTrue(server.release['prerelease'])

    def test_rejects_superseded(self):
        self.server.advance()
        with self.assertRaisesRegex(ValueError, 'superseded'):
            self.publish()
        self.assertEqual([], self.server.writes)

    def test_preserves_advance(self):
        self.server.fail = 'advance'
        with self.assertRaisesRegex(ValueError, 'superseded'):
            self.publish()
        self.assertEqual(self.server.old_catalog, self.server.catalog())
        self.assertNotIn(('delete', 'catalog.json'), self.server.writes)

    def test_restores_catalog(self):
        for fault in ['catalog', 'corrupt']:
            with self.subTest(fault=fault):
                server = PreviewServer(self.base.fixture, self.base.args.source_commit)
                server.fail = fault
                with self.assertRaises(ValueError):
                    self.publish(server=server)
                self.assertEqual(server.old_catalog, server.catalog())

    def test_restores_initial(self):
        server = PreviewServer(self.base.fixture, self.base.args.source_commit, existing=False)
        server.fail = 'publish'
        with self.assertRaisesRegex(ValueError, 'publication failure'):
            self.publish(server=server)
        self.assertIsNone(server.catalog())
        self.assertTrue(server.release['draft'])

    def test_preserves_immutable(self):
        fact = self.data['candidate']['release']['packageMetadata']['Alpha']
        self.server.add(Path(fact['path']).name, b'Different immutable package bytes')
        with self.assertRaisesRegex(ValueError, 'Immutable'):
            self.publish()
        self.assertEqual(self.server.old_catalog, self.server.catalog())
        self.assertEqual([], self.server.writes)

    def test_refuses_test(self):
        self.data['candidate']['profile'] = 'test'
        with self.assertRaisesRegex(ValueError, 'production'):
            self.publish()
        self.assertEqual([], self.server.writes)

    def test_binds_source(self):
        self.data['candidate']['release']['packageMetadata']['Alpha']['sourceTree'] = 'a' * 40
        with self.assertRaisesRegex(ValueError, 'subtree'):
            self.publish()
        self.assertEqual([], self.server.writes)
