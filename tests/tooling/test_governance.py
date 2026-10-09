from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from tools.repository.governance import check_changes, collect_changes, context_for, path_rule, safe_path


SOURCE = Path(__file__).resolve().parents[2]


class GovernanceTests(unittest.TestCase):
    def setUp(self):
        external = Path(os.environ['NEXUS_TEST_ARTIFACT_ROOT']).resolve()
        self.temporary = tempfile.TemporaryDirectory(prefix='plugin-governance-', dir=external)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / 'docs').mkdir()
        (self.root / 'docs/map.json').write_text(json.dumps({'schemaVersion': 1, 'topics': []}), encoding='utf-8')
        for file in ('AGENTS.md', 'host.lock.json', 'docs/author/FRONTEND_PLUGIN.md'):
            target = self.root / file
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / file, target)

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], encoding='utf-8').strip()

    def contracts(self):
        module = (SOURCE / 'tools/docs/contracts.mjs').as_uri()
        program = "const {checkContracts}=await import(process.argv[1]);console.log(JSON.stringify(checkContracts(process.argv[2])));"
        return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', program, module, str(self.root)], encoding='utf-8'))

    def test_current_contract_drift_history_ambiguity_and_missing_facts(self):
        self.assertTrue(all(rule['status'] == 'PASS' for rule in self.contracts()))
        (self.root / 'docs/history.md').write_text('Frontend API 1.5', encoding='utf-8')
        self.assertTrue(all(rule['status'] == 'PASS' for rule in self.contracts()))
        file = self.root / 'docs/author/FRONTEND_PLUGIN.md'
        current = file.read_text(encoding='utf-8')
        file.write_text(current.replace('只接受精确版本 `1.6`', '只接受精确版本 `1.5`'), encoding='utf-8')
        self.assertTrue(any(rule['status'] == 'FAIL' and rule['expected'] == '1.6' for rule in self.contracts()))
        file.write_text(current.replace('只接受精确版本 `1.6`', '接受当前精确版本'), encoding='utf-8')
        self.assertTrue(any(rule['status'] == 'REVIEW' for rule in self.contracts()))
        (self.root / 'host.lock.json').write_text('{}', encoding='utf-8')
        self.assertEqual(self.contracts()[-1]['status'], 'NOT_CHECKED')

    def test_parent_navigation_and_outside_missing_paths(self):
        (self.root / 'CONTRIBUTING.md').write_text('# Guide', encoding='utf-8')
        self.assertEqual(safe_path(self.root, 'docs', '../CONTRIBUTING.md'), self.root / 'CONTRIBUTING.md')
        for relative in ('../../outside.md', 'missing.md'):
            with self.assertRaises(ValueError):
                safe_path(self.root, 'docs', relative)

    def test_specialized_source_boundary_and_legal_fixture(self):
        target = self.root / 'plugins/specialized/BetterGI'
        shutil.copytree(SOURCE / 'plugins/specialized/BetterGI', target)
        valid = path_rule(self.root, {'status': 'A', 'path': 'plugins/specialized/BetterGI/data/editor.js'})
        self.assertEqual(valid['status'], 'PASS')
        self.assertEqual(valid['name'], json.loads((target / 'plugin.json').read_bytes())['name'])
        (target / 'frontend').mkdir()
        (target / 'frontend/main.js').write_text('export {};', encoding='utf-8')
        invalid = path_rule(self.root, {'status': 'A', 'path': 'plugins/specialized/BetterGI/frontend/main.js'})
        self.assertEqual(invalid['status'], 'FAIL')
        self.assertEqual(path_rule(self.root, {'status': 'A', 'path': 'tests/fixtures/task-protocol/input.json'})['status'], 'PASS')
        self.assertEqual(path_rule(self.root, {'status': 'A', 'path': 'unknown.json'})['status'], 'REVIEW')

    def test_existing_publisher_restriction_and_scope_review(self):
        target = self.root / 'plugins/specialized/BetterGI'
        shutil.copytree(SOURCE / 'plugins/specialized/BetterGI', target)
        evidence = {'changes': [{'status': 'M', 'path': 'catalog.json'}]}
        self.assertEqual(check_changes(self.root, evidence)['status'], 'FAIL')
        evidence['changes'] = [{'status': 'M', 'path': f'tools/helper-{index}.py'} for index in range(150)]
        self.assertEqual(check_changes(self.root, evidence, owners=['Tools'])['status'], 'PASS')
        evidence['changes'].append({'status': 'M', 'path': 'docs/new.md'})
        self.assertEqual(check_changes(self.root, evidence, owners=['Tools'])['status'], 'REVIEW')
        evidence['changes'] = [{'status': 'M', 'path': 'host.lock.json'}]
        self.assertEqual(check_changes(self.root, evidence)['status'], 'REVIEW')
        self.assertEqual(check_changes(self.root, evidence, governance_only=True)['status'], 'FAIL')

    def test_real_rename_and_untracked_selector_and_missing_host(self):
        self.git('init', '--quiet')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid', 'commit', '--quiet', '-m', 'fixture baseline')
        base = self.git('rev-parse', 'HEAD')
        (self.root / 'logs').mkdir()
        self.git('mv', 'docs/map.json', 'logs/map.json')
        (self.root / 'new.json').write_text('{}', encoding='utf-8')
        evidence = collect_changes(self.root, base, True)
        self.assertTrue(any(item['status'] == 'R' and item['path'] == 'logs/map.json' for item in evidence['changes']))
        self.assertTrue(any(item.get('untracked') and item['path'] == 'new.json' for item in evidence['changes']))
        self.assertEqual(path_rule(self.root, {'status': 'R', 'old': 'docs/map.json', 'path': 'logs/map.json'})['status'], 'FAIL')
        (self.root / 'docs/map.json').write_text(json.dumps({'topics': []}), encoding='utf-8')
        self.assertEqual(context_for(self.root)['partner']['status'], 'NOT_CHECKED')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid', 'commit', '--quiet', '-m', 'historical fixture paths')
        base = self.git('rev-parse', 'HEAD')
        command = [sys.executable, str(SOURCE / 'tools/repo.py'), 'check', 'governance', '--root', str(self.root),
                   '--base', base, '--owner', 'Tools', 'Docs', 'Tests']
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['status'], 'PASS')


if __name__ == '__main__':
    unittest.main()
