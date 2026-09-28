import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import generate_task_protocol as build


class TaskPhaseBuildTests(unittest.TestCase):
    def test_oknte_china_cnb_origin_is_exact_and_restricted(self):
        driver = r'''
const fs=require('node:fs'),vm=require('node:vm');
const adapter=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const app={name:'ok-nte',installed:true,current_profile:process.argv[3],
  current_version:'v1.4.2',update_state:'idle',update_target_version:null,
  update_error:null,running:process.argv[5]==='running',available_versions:['v1.4.2']};
const origin='[remote "origin"]\nurl = '+process.argv[4]+'\n';
const context={ADAPTER:adapter,nexus:{readResource:()=>{throw new Error('unexpected advanced check');}}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
process.stdout.write(JSON.stringify(context.runtimeIdentity(app,'a'.repeat(40),'',origin)));
'''
        source = build.SOURCE / 'core/runtimeIdentity.js'
        metadata = build.SOURCE / 'oknte/OkNTE.metadata.json'
        cnb = 'https://cnb.cool/BnanZ0/ok-nte-update.git'
        github = 'https://github.com/BnanZ0/ok-nte.git'
        cases = [('China', cnb, 'idle', True), ('Global', cnb, 'idle', False),
                 ('China', cnb + '.invalid', 'idle', False), ('China', github, 'idle', True),
                 ('China', cnb, 'running', False)]
        for channel, origin, state, valid in cases:
            with self.subTest(channel=channel, origin=origin, state=state):
                result = subprocess.run(['node', '-e', driver, str(source), str(metadata), channel,
                                         origin, state], text=True, encoding='utf-8',
                                        capture_output=True, check=True)
                actual = json.loads(result.stdout)
                self.assertEqual(valid, actual['ready'])
                if valid:
                    self.assertTrue(actual['restricted'])
                else:
                    self.assertEqual('diagnostic.runtime.' + ('busy' if state == 'running' else 'base_unqualified'),
                                     actual['reasonText']['key'])

    def test_mxu_import_only_interface_discovers_selected_task(self):
        driver = r'''
const fs=require('node:fs'),vm=require('node:vm');
const manifest=JSON.parse(process.argv[2]);
const config={settings:{autoStartInstanceId:'selected',language:'zh-CN'},instances:[{
  id:'selected',controllerName:'Win32-Front',resourceName:'official',
  tasks:[{id:'reward',taskName:'领取每日奖励',enabled:true,optionValues:{}}]}]};
const resources={interface:manifest,'interface-part-13':{task:[{name:'领取每日奖励',label:'Daily reward'}]}};
const output=[];
const nexus={readConfig:()=>({document:config,revision:'r1'}),
  readResource:id=>({format:'text',document:JSON.stringify(resources[id]||{})})};
const input={phase:'discover',protocolVersion:'0.1.0',locale:'zh-CN',
  configResources:[{id:'config:mxu-MaaStellaSora.json',format:'json'}]};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),
  {input,nexus,console:{log:result=>output.push(result)}});
process.stdout.write(JSON.stringify({coverage:output[0].coverage,
  names:output[0].tasks.map(task=>task.name),diagnostics:output[0].diagnostics.map(d=>d.code)}));
'''
        source = build.ROOT / 'plugins/specialized/MaaStellaSora/data/discover.js'
        base = {'name': 'MaaStellaSora', 'controller': [{'name': 'Win32-Front'}],
                'resource': [{'name': 'official'}], 'import': ['resource/tasks/shop.json']}
        for shape, valid in [({}, True), ({'task': []}, True), ({'task': {}}, False), ({'import': []}, False)]:
            with self.subTest(shape=shape):
                interface = {**base, **shape}
                result = subprocess.run(['node', '-e', driver, str(source), json.dumps(interface, ensure_ascii=False)],
                                        text=True, encoding='utf-8', capture_output=True, check=True)
                output = json.loads(result.stdout)
                if valid:
                    self.assertNotEqual('unsupported', output['coverage'])
                    self.assertEqual(['Daily reward'], output['names'])
                else:
                    self.assertEqual('unsupported', output['coverage'])
                    self.assertIn('unsupported_schema', output['diagnostics'])

    def test_generated_bettergi_daily_retry_leaves_mail_success_and_teapot_unknown_off(self):
        config = {'TaskDefinitions': {'mail': '领取邮件', 'daily': '领取每日奖励',
                                      'teapot': '领取尘歌壶奖励'},
                  'TaskOrder': ['mail', 'daily', 'teapot'],
                  'TaskEnabledList': {'mail': True, 'daily': True, 'teapot': True},
                  'NextTaskId': ''}
        driver = """
const fs=require('node:fs'),vm=require('node:vm');
const config=JSON.parse(process.argv[3]);
const resource={document:config,revision:'r1',format:'json'};
const output=[];
const nexus={readConfig:()=>resource,readResource:()=>({document:null})};
const common={protocolVersion:'0.1.0',configResources:[{id:'config:config.json',format:'json'}]};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),
  {input:{...common,phase:'discover'},nexus,console:{log:v=>output.push(v)}});
const plan=output.pop();
const states={'bettergi:mail':'succeeded','bettergi:daily':'failed','bettergi:teapot':'unknown'};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),
  {input:{...common,phase:'retry',originalPlan:plan,taskStates:states,
    attemptsUsed:1,maxAttempts:3,cancelled:false,budgetExhausted:false},
   nexus,console:{log:v=>output.push(v)}});
process.stdout.write(JSON.stringify({plan:plan.tasks.map(t=>({id:t.id,risk:t.retryRisk})),retry:output.pop()}));
"""
        root = build.ROOT / 'plugins/specialized/BetterGI/data'
        result = subprocess.run(['node', '-e', driver, str(root / 'discover.js'), str(root / 'retry.js'),
                                 json.dumps(config, ensure_ascii=False)],
                                text=True, encoding='utf-8', capture_output=True, check=True)
        output = json.loads(result.stdout)
        self.assertEqual('safe', next(t['risk'] for t in output['plan'] if t['id'] == 'bettergi:daily'))
        self.assertEqual('selective', output['retry']['decision'])
        self.assertEqual(['bettergi:daily'], output['retry']['includedTaskIds'])
        values = [operation['value'] for patch in output['retry']['filePatches']
                  for operation in patch['operations']]
        self.assertEqual([False, False], values)

    def test_generated_bettergi_retry_keeps_independent_unsafe_failure_out(self):
        source = (build.ROOT / 'plugins/specialized/BetterGI/data/retry.js').read_text(encoding='utf-8')
        safe = 'bettergi:领取邮件'
        unsafe = 'bettergi:每日委托'
        tasks = [dict(id=safe, enabled=True, role='business', retryUnitId=safe, retryRisk='safe', dependencies=[], order=0),
                 dict(id=unsafe, enabled=True, role='business', retryUnitId=unsafe, retryRisk='unknown', dependencies=[], order=1)]
        request = dict(phase='retry', protocolVersion='0.1.0', originalPlan=dict(tasks=tasks),
                       taskStates={safe: 'failed', unsafe: 'failed'}, attemptsUsed=1, maxAttempts=3,
                       cancelled=False, budgetExhausted=False, configResources=[dict(id='main', format='json')])
        driver = """
const vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(process.argv[1],'utf8'),input=JSON.parse(process.argv[2]);
const results=[],document={TaskEnabledList:{'领取邮件':true,'每日委托':true}};
vm.runInNewContext(source,{input,nexus:{readConfig:()=>({document,revision:'r1'})},
  console:{log:result=>results.push(result)}});
process.stdout.write(JSON.stringify(results));
"""
        result = subprocess.run(['node', '-e', driver, str(build.ROOT / 'plugins/specialized/BetterGI/data/retry.js'),
                                 json.dumps(request, ensure_ascii=False)], text=True, encoding='utf-8', capture_output=True, check=True)
        selected = json.loads(result.stdout)
        self.assertEqual(1, len(selected))
        self.assertEqual('selective', selected[0]['decision'])
        self.assertEqual([safe], selected[0]['includedTaskIds'])
        self.assertEqual([False], [operation['value'] for patch in selected[0]['filePatches']
                                   for operation in patch['operations']])

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

    def test_single_daily_metadata_has_one_authoritative_allowlist(self):
        metadata = build.load_adapters()
        for artifact, adapter in metadata.items():
            for rule in adapter.get('configRules', []):
                if rule.get('kind') == 'single_daily':
                    self.assertTrue(rule.get('allowedTaskKeys'), artifact)
                    self.assertEqual(len(rule['allowedTaskKeys']), len(set(rule['allowedTaskKeys'])), artifact)
                    self.assertNotIn('dailyTaskKeys', adapter)

    def test_single_daily_metadata_rejects_legacy_allowlist_shape(self):
        adapter = {
            'id': 'example', 'implementation': 'example', 'protocolVersion': '0.1.0',
            'entries': [{'id': 'daily'}],
            'configRules': [{
                'kind': 'single_daily', 'dailyTaskKeys': ['daily'],
            }],
        }
        with self.assertRaises(ValueError):
            build.validate_adapter_metadata(adapter, 'Example')

    def test_adapter_metadata_rejects_unreleased_versions(self):
        for version in ('1.0', '1.1', '1.2'):
            with self.subTest(version=version), self.assertRaises(ValueError):
                build.validate_adapter_metadata({'protocolVersion': version}, 'Example')

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
