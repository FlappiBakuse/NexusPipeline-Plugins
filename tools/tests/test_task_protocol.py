import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import repository_core as core
import create_task_plugin as author
import json
import io
import zipfile


class TaskProtocolTests(unittest.TestCase):
    def test_author_versions_and_blocked_daily_preset(self):
        current = author.generate('ExampleTask', 'example-task', True)
        protocol = json.loads(current['plugin.json'])['taskProtocol']
        self.assertEqual('1.1', protocol['version'])
        for path in protocol['localization']['messages'].values():
            self.assertIn('task.daily_reward', json.loads(current[path]))
        legacy = author.generate('ExampleTask', 'example-task', True, protocol_version='1.0')
        self.assertNotIn('localization', json.loads(legacy['plugin.json'])['taskProtocol'])
        self.assertFalse(any('task-text.' in path for path in legacy))
        blocked = author.generate('ExampleTask', 'example-task', preset='ok-script-daily')
        for phase in ('discover', 'judge', 'retry'):
            self.assertIn(author.MARKER, blocked['data/' + phase + '.js'])
        with self.assertRaises(ValueError):
            author.generate('ExampleTask', 'example-task', True, 'ok-script-daily')

    def test_author_version12_uses_diagnostic_assets(self):
        current = author.generate('ExampleTask', 'example-task', True, protocol_version='1.2')
        protocol = json.loads(current['plugin.json'])['taskProtocol']
        self.assertEqual('1.2', protocol['version'])
        self.assertEqual('data/i18n/zh-CN.json', protocol['localization']['messages']['zh-CN'])
        self.assertEqual(1, len(protocol['configRules']))
        self.assertEqual([], protocol['environmentChecks'])
        self.assertIn('data/i18n/zh-CN.json', current)
        self.assertNotIn('configValidator', json.loads(current['plugin.json']))
        core._task_protocol_scripts(json.loads(current['plugin.json']))

    def manifest(self):
        return {
            "kind": "data-specialized", "artifactName": "Example", "minHostVersion": "0.16.8",
            "judgeScript": "data/judge.js", "taskProtocol": {
                "version": "1.0", "discoverScript": "data/discover.js",
                "retryScript": "data/retry.js", "readResources": []}}

    def test_legacy_and_current_contract(self):
        self.assertEqual({}, core._task_protocol_scripts({}))
        self.assertEqual(2, len(core._task_protocol_scripts(self.manifest())))

    def test_text_dictionary_requires_11_and_valid_bounded_assets(self):
        manifest = self.manifest()
        protocol = manifest['taskProtocol']
        protocol['localization'] = {'defaultLocale': 'en-US', 'messages': {'en-US': 'data/texts.json'}}
        with self.assertRaises(core.RepositoryError):
            core._task_protocol_scripts(manifest)
        protocol['version'] = '1.1'
        core._task_protocol_scripts(manifest)
        core._validate_task_localization(manifest, lambda path: b'{"task.name":"Frozen name"}')
        for data in [b'{"a":"one","a":"two"}', b'{"a":null}', b'{"a":[]}', b'x' * (256 * 1024 + 1)]:
            with self.subTest(data=data[:30]), self.assertRaises(core.RepositoryError):
                core._validate_task_localization(manifest, lambda path: data)

    def test_text_dictionary_is_checked_in_source_and_zip(self):
        files = author.generate('ExampleTask', 'example-task', True)
        manifest = json.loads(files['plugin.json'])
        manifest['taskProtocol'].update(version='1.1', localization={'defaultLocale':'en-US', 'messages':{'en-US':'data/texts.json'}})
        files['plugin.json'] = json.dumps(manifest)
        with tempfile.TemporaryDirectory(prefix='nxp-text-assets-') as temporary:
            root = Path(temporary)
            for name, content in files.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding='utf-8')
            with self.assertRaises(core.RepositoryError):
                core._specialized_script_closure(root, manifest)
            (root/'data/texts.json').write_text('{"name":"Frozen"}', encoding='utf-8')
            core._specialized_script_closure(root, manifest)
        payload = io.BytesIO()
        with zipfile.ZipFile(payload, 'w') as archive:
            for name, content in files.items(): archive.writestr(name, content)
        payload.seek(0)
        with zipfile.ZipFile(payload) as archive, self.assertRaises(core.RepositoryError):
            infos = {info.filename:info for info in archive.infolist()}
            core._validate_specialized_zip_payload(archive, set(infos), manifest, Path('ExampleTask.zip'), infos)

    def test_invalid_declaration_cannot_fall_back(self):
        for field, value in [("version", "2.0"), ("discoverScript", "../secret.js"),
                             ("retryScript", "data/retry.py"), ("retryScript", "data/C:x.js"),
                             ("readResources", None)]:
            with self.subTest(field=field, value=value):
                manifest = self.manifest()
                manifest["taskProtocol"][field] = value
                with self.assertRaises(core.RepositoryError):
                    core._task_protocol_scripts(manifest)
        for key, value in [("minHostVersion", "0.16.7"), ("minHostVersion", "0.16.8-rc.1"),
                           ("kind", "managed-code"), ("taskProtocol", None)]:
            manifest = self.manifest()
            manifest[key] = value
            with self.assertRaises(core.RepositoryError):
                core._task_protocol_scripts(manifest)

    def test_declared_scripts_are_in_real_source_closure(self):
        with tempfile.TemporaryDirectory(prefix="nxp-task-protocol-") as temporary:
            root = Path(temporary)
            (root / "data").mkdir()
            for name in ("judge", "discover", "retry"):
                (root / "data" / (name + ".js")).write_text("// fixture", encoding="utf-8")
            closure = core._specialized_script_closure(root, self.manifest())
            self.assertEqual({"judge.js", "discover.js", "retry.js"}, {p.name for p in closure})
            (root / "data" / "retry.js").unlink()
            with self.assertRaises(core.RepositoryError):
                core._specialized_script_closure(root, self.manifest())

    def test_unfinished_scaffold_is_not_packagable_but_generated_example_is(self):
        for complete in (False, True):
            with self.subTest(complete=complete), tempfile.TemporaryDirectory(prefix="nxp-author-") as temporary:
                root = Path(temporary)
                files = author.generate("ExampleTask", "example-task", complete)
                for name, content in files.items():
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(content, encoding="utf-8")
                manifest = json.loads(files["plugin.json"])
                if complete:
                    self.assertEqual(3, len(core._specialized_script_closure(root, manifest)))
                else:
                    with self.assertRaises(core.RepositoryError):
                        core._specialized_script_closure(root, manifest)

    def test_author_names_cannot_escape_output(self):
        for artifact, name in [("../Escape", "test"), ("Example", "../escape"), ("Example", "MixedCase")]:
            with self.assertRaises(ValueError):
                author.generate(artifact, name)

    def test_unadapted_phase_is_rejected_from_zip_for_each_entry(self):
        for phase in ('discover', 'judge', 'retry'):
            files = author.generate('ExampleTask', 'example-task', True)
            files['data/' + phase + '.js'] += '\n// __NXP_ADAPTATION_REQUIRED__\n'
            payload = io.BytesIO()
            with zipfile.ZipFile(payload, 'w') as archive:
                for name, content in files.items(): archive.writestr(name, content)
            payload.seek(0)
            with self.subTest(phase=phase), zipfile.ZipFile(payload) as archive:
                infos = {info.filename: info for info in archive.infolist()}
                with self.assertRaisesRegex(core.RepositoryError, '未适配模板标记'):
                    core._validate_specialized_zip_payload(archive, set(infos), json.loads(files['plugin.json']), Path('ExampleTask.zip'), infos)
