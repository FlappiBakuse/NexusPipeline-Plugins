import sys
import json
import shutil
import subprocess
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
        self.assertEqual('data/task-text.zh-CN.json', protocol['localization']['messages']['zh-CN'])
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

    def test_pinned_resource_requires_12_and_root_text(self):
        for version, source, fmt, digest, valid in [
            ('1.0', 'root', 'text', 'a' * 64, False),
            ('1.1', 'root', 'text', 'a' * 64, False),
            ('1.2', 'root', 'text', 'a' * 64, True),
            ('1.2', 'extraConfig', 'text', 'a' * 64, False),
            ('1.2', 'root', 'json', 'a' * 64, False),
            ('1.2', 'root', 'text', 'A' * 64, False),
            ('1.2', 'root', 'text', None, False),
        ]:
            with self.subTest(version=version, source=source, fmt=fmt, digest=digest):
                manifest = self.manifest()
                protocol = manifest['taskProtocol']
                protocol['version'] = version
                if version != '1.0':
                    protocol['localization'] = {'defaultLocale': 'en-US', 'messages': {'en-US': 'data/i18n/en.json'}}
                if version == '1.2':
                    protocol.update(configRules=[dict(id='runtime', required=True, criticality='critical_when_applicable')], environmentChecks=[])
                protocol['readResources'] = [dict(id='code', source=source, path='main.py', format=fmt, required=False, sha256=digest)]
                if valid:
                    core._task_protocol_scripts(manifest)
                else:
                    with self.assertRaises(core.RepositoryError):
                        core._task_protocol_scripts(manifest)

    def test_main_config_target_defaults_remain_bounded(self):
        check = dict(id='adb', source=dict(kind='mainConfig', selector=['ip']), expectedKind='adb_endpoint',
                     relativeBase='none', networkAccess=False, followReparsePoints=False,
                     comparison='adb_endpoint_with_port', secondarySelector=['port'], defaultValue='127.0.0.1', secondaryDefaultValue='5555')
        core._validate_task_protocol_environment_checks([check])
        for fields in [dict(defaultValue=None), dict(defaultValue=''), dict(defaultValue=123),
                       dict(source=dict(kind='mainConfig', selector=['parent', 'ip'])),
                       dict(source=dict(kind='mainConfig', selector=['ip'], resourceId='other')),
                       dict(comparison='exact'), dict(networkAccess=True)]:
            with self.subTest(fields=fields), self.assertRaises(core.RepositoryError):
                core._validate_task_protocol_environment_checks([dict(check, **fields)])

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

    @unittest.skipUnless(shutil.which('node'), 'node is required for generated runtime assessment coverage')
    def test_generated_finish_action_assessment_covers_bettergi_and_mxu(self):
        cases = [
            (
                'BetterGI',
                'config:fixture.json',
                {'TaskEnabledList': {'daily': True}, 'CompletionAction': '关机'},
                {},
                'bettergi.finish_action',
            ),
            (
                'MaaEnd',
                'config:mxu-MaaEnd.json',
                {
                    'settings': {'autoStartInstanceId': 'instance-1'},
                    'instances': [{
                        'id': 'instance-1', 'controllerName': 'Win32-Front', 'resourceName': '官服',
                        'tasks': [{
                            'id': 'power', 'taskName': '__MXU_POWER__', 'enabled': True,
                            'optionValues': {'__MXU_POWER_OPTION__': {'caseName': 'shutdown'}},
                        }],
                    }],
                },
                {'interface': '{"name":"MaaEnd","task":[]}'},
                'mxu.finish_action',
            ),
            (
                'ZenlessZoneZeroOneDragon',
                'config:one_dragon/_group.yml',
                {'app_list': []},
                {
                    'zzz-extra-config': {
                        'instance_list': [{
                            'idx': 1, 'name': '01', 'active': True, 'active_in_od': True,
                            'force_login_before_run': False,
                        }],
                        'after_done': '关机',
                        'instance_run': '仅运行当前',
                    },
                },
                'zzz.finish_action',
            ),
        ]
        for artifact, config_id, config, resources, rule_id in cases:
            with self.subTest(artifact=artifact):
                script_path = Path(__file__).resolve().parents[2] / 'plugins' / 'specialized' / artifact / 'data' / 'discover.js'
                js = f"""
const fs = require('fs');
const vm = require('vm');
const captured = [];
const input = {{ phase: 'discover', protocolVersion: '1.2',
  configResources: [{{ id: {json.dumps(config_id, ensure_ascii=False)}, format: 'json' }}],
  executionContext: {{ mode: 'pc', queue: {{ hasFollowingWork: 'yes' }} }} }};
const config = {json.dumps(config, ensure_ascii=False)};
const resources = {json.dumps(resources, ensure_ascii=False)};
const nexus = {{
  readConfig: id => ({{ document: id === input.configResources[0].id ? config : undefined }}),
  readResource: id => ({{ document: resources[id], format: 'text' }}),
  inspectDeclaredTarget: () => ({{ status: 'present', matchesContext: true }})
}};
vm.runInNewContext(fs.readFileSync({json.dumps(str(script_path), ensure_ascii=False)}, 'utf8'),
  {{ input, nexus, console: {{ log: value => captured.push(value) }} }});
const check = captured.at(-1).configAssessment.checks.find(value => value.ruleId === {json.dumps(rule_id)});
if (!check || check.evaluation !== 'violated' || check.executionEffect !== 'block')
  throw new Error(JSON.stringify(check));
console.log(JSON.stringify(check));
"""
                completed = subprocess.run(
                    ['node', '--input-type=commonjs', '-e', js],
                    cwd=Path(__file__).resolve().parents[2],
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    check=False,
                )
                self.assertEqual(0, completed.returncode, completed.stderr or completed.stdout)

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
