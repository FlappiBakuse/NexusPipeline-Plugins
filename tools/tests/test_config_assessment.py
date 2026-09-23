"""Behavior tests for malformed inputs to the production assessment module."""
import json
from pathlib import Path
import subprocess
import unittest


class ConfigAssessmentTests(unittest.TestCase):
    def test_rule_exception_retains_critical_admission_policy(self):
        source = Path(__file__).resolve().parents[1] / 'task-protocol/core/configAssessment.js'
        script = r'''
const fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(process.argv[1], 'utf8');
for (const critical of [true, false]) {
  const rule = { id: 'fixture', kind: 'routine_schema', required: true,
    criticality: critical ? 'critical_when_applicable' : 'advisory_or_contextual',
    resourceId: 'config:daily.json', fallback: 'Malformed adapter data' };
  const context = vm.createContext({
    ADAPTER: { configRules: [rule], entries: 42 },
    input: { configResources: [{ id: 'config:daily.json' }] },
    nexus: { readConfig: () => ({ document: { 'Routine Items': [] } }) }
  });
  vm.runInContext(fs.readFileSync(require('path').join(require('path').dirname(process.argv[1]), '../oknte/normalizeItems.js'), 'utf8'), context);
  vm.runInContext(source, context);
  const check = vm.runInContext('finalizeAssessment({ tasks: [] }).checks[0]', context);
  if (check.evaluation !== 'unknown' || check.executionEffect !== (critical ? 'block' : 'warn')
      || check.severity !== (critical ? 'error' : 'warning')) throw Error(JSON.stringify(check));
}
console.log('PASS critical and advisory rule exceptions');
'''
        completed = subprocess.run(['node', '-e', script, str(source)], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(0, completed.returncode, completed.stderr)

    def test_missing_config_location_does_not_erase_the_check(self):
        root = Path(__file__).resolve().parents[2]
        fixture = json.loads((root / 'tools/task-protocol/fixtures/r2-okww-4c-missing.json').read_text(encoding='utf-8'))
        script = r'''
const fs = require('fs'), vm = require('vm');
const fixture = JSON.parse(fs.readFileSync(0, 'utf8'));
const data = Object.fromEntries(fixture.resources.map(r => [r.id,
  { document: r.format === 'json' ? JSON.parse(r.text) : r.text }]));
let result;
vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), {
  input: { phase: 'discover', protocolVersion: '1.2', configResources: fixture.resources.filter(r => r.id.startsWith('config:')) },
  nexus: { readConfig: id => data[id], readResource: id => data[id] },
  console: { log: value => { result = value; } }
});
const check = result.configAssessment.checks.find(c => c.ruleId === 'okww.finite_additions');
if (check.evaluation !== 'unknown' || check.executionEffect !== 'block' || check.locations.length !== 0)
  throw Error(JSON.stringify(check));
if (!check.actions.some(a => a.kind === 'refresh_plan')) throw Error('Missing refresh action');
'''
        completed = subprocess.run(['node', '-e', script, str(root / 'plugins/specialized/OkWutheringWaves/data/discover.js')],
                                   input=json.dumps(fixture), capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(0, completed.returncode, completed.stderr)
