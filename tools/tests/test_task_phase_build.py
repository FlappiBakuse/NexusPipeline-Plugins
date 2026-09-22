import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import generate_task_protocol as build


class TaskPhaseBuildTests(unittest.TestCase):
    def test_duplicate_manifest_keys_are_not_silently_overwritten(self):
        with self.assertRaises(ValueError):
            json.loads('{"module":{},"module":{}}', object_pairs_hook=build.unique_members)

    def test_closure_orders_dependencies_and_deduplicates(self):
        graph = {'modules': {
            'a': {'provides': ['a'], 'requires': ['b', 'c']},
            'b': {'provides': ['b'], 'requires': ['c']},
            'c': {'provides': ['c'], 'requires': []}}}
        self.assertEqual(['c', 'b', 'a'], build.dependency_closure(graph, ['a']))
        for change in ('missing', 'cycle', 'duplicate'):
            invalid = copy.deepcopy(graph)
            if change == 'missing': invalid['modules']['c']['requires'] = ['absent']
            if change == 'cycle': invalid['modules']['c']['requires'] = ['a']
            if change == 'duplicate': invalid['modules']['c']['provides'] = ['b']
            with self.subTest(change=change), self.assertRaises(ValueError):
                build.dependency_closure(invalid, ['a'])

    def test_production_closures_are_phase_specific(self):
        graph = json.loads((build.SOURCE / 'phase-modules.json').read_text(encoding='utf-8'))
        for adapter, phases in graph['entries'].items():
            with self.subTest(adapter=adapter):
                discover = build.dependency_closure(graph, phases['discover'])
                observe = build.dependency_closure(graph, phases['observe'])
                retry = build.dependency_closure(graph, phases['retry'])
                self.assertNotIn('core/retryPlan', discover)
                self.assertNotIn('core/observeRules', discover)
                self.assertNotIn(adapter + '/discover', observe)
                self.assertNotIn('core/retryPlan', observe)
                self.assertNotIn(adapter + '/observe', retry)
                self.assertIn(adapter + '/discover', retry)

    def test_repeat_build_is_identical_and_unknown_phase_rejected(self):
        metadata = build.load_adapters()
        for adapter in metadata.values():
            for phase in build.PHASE_FILES:
                self.assertEqual(build.bundle(adapter, phase), build.bundle(adapter, phase))
        with self.assertRaises(ValueError):
            build.bundle(next(iter(metadata.values())), 'write')

    def test_adapter_metadata_cannot_escape_index_or_hide_duplicate_members(self):
        with tempfile.TemporaryDirectory(prefix='nxp-adapter-index-') as temporary:
            root = Path(temporary)
            for location in ('../outside.json', str(root.parent / 'outside.json'), 'adapters.json'):
                (root / 'adapters.json').write_text(json.dumps({'Example': {'metadata': location}}), encoding='utf-8')
                with self.subTest(location=location), self.assertRaises(ValueError):
                    build.load_adapters(root)
            (root / 'adapters.json').write_text('{"Example":{"metadata":"example.json"}}', encoding='utf-8')
            (root / 'example.json').write_text('{"id":"first","id":"second","implementation":"example"}', encoding='utf-8')
            with self.assertRaises(ValueError):
                build.load_adapters(root)

    def test_check_preserves_output_bytes_and_timestamps(self):
        paths = list((build.ROOT / 'plugins/specialized').glob('*/data/*.js'))
        before = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in paths}
        build.generate(True)
        self.assertEqual(before, {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in paths})
