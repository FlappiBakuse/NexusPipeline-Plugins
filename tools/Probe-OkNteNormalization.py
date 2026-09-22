"""Compare the pure adapter projection with locked upstream normalization, without importing the game."""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path
import random
import subprocess
from types import SimpleNamespace

SOURCE_SHA = '555f8e49c91bd9739a177eb84807e044274f076d24782a005a534a4c5a4ed6b8'
COMMIT = '0339cfc44a9827ad8cd1ebeabe432660e87f2acb'


def run(source):
    data = source.read_bytes()
    assert hashlib.sha256(data).hexdigest() == SOURCE_SHA, 'Source identity mismatch'
    tree = ast.parse(data.decode('utf-8'))
    entries_node = next(n.value for n in tree.body if isinstance(n, ast.Assign)
                        and any(isinstance(t, ast.Name) and t.id == 'DAILY_ROUTINE_ENTRIES' for t in n.targets))
    entries = []
    for call in entries_node.elts:
        args = call.args
        entries.append(dict(id=ast.literal_eval(args[0]),
                            enabledByDefault=ast.literal_eval(args[2]) if len(args) > 2 else False,
                            exclusiveGroup=ast.literal_eval(args[3]) if len(args) > 3 else None))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'DailyRoutineTask')
    method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'normalize_items')
    upstream_entries = [SimpleNamespace(task_id=e['id'], enabled_by_default=e['enabledByDefault'],
                                       exclusive_group=e['exclusiveGroup']) for e in entries]
    namespace = dict(deepcopy=copy.deepcopy, DAILY_ROUTINE_ENTRIES=upstream_entries)
    exec(compile(ast.Module(body=[method], type_ignores=[]), str(source), 'exec'), namespace)
    all_false = [dict(id=e['id'], enabled=False) for e in entries]
    inputs = [None, {}, '', [], all_false,
              [dict(id='daily_anomaly_hunter', enabled=True), dict(id='daily_anomaly', enabled=True)],
              [dict(id='daily_claim', enabled=False), dict(id='daily_claim', enabled=True)],
              [dict(id='future_task', enabled=True)]]
    rng = random.Random(20260921)
    values = [False, True, None, 0, 1, '', 'false', [], [0], {}, {'v': False}]
    for _ in range(192):
        inputs.append([dict(id=rng.choice(entries)['id'], enabled=copy.deepcopy(rng.choice(values)))
                       for _ in range(rng.randrange(13))])
    expected = []
    for raw in inputs:
        instance = SimpleNamespace(config={'Routine Items': copy.deepcopy(raw)}, CONF_ITEMS='Routine Items',
                                   entries_by_id=lambda: {e.task_id: e for e in upstream_entries})
        expected.append(namespace['normalize_items'](instance))
    module = Path(__file__).parent/'task-protocol/oknte/normalizeItems.js'
    harness = r'''
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), context);
const original = JSON.stringify(input.inputs);
const actual = input.inputs.map(raw => context.normalizeItems(raw, input.entries));
assert.equal(JSON.stringify(input.inputs), original, 'Discovery mutated configuration');
assert.deepEqual(JSON.parse(JSON.stringify(actual.map(a => a.items))), input.expected);
assert.equal(actual[4].canPatchSelection, true);
assert.equal(actual[0].canPatchSelection, false);
assert.equal(actual[6].canPatchSelection, false);
assert.equal(actual[7].diagnostics[0].id, 'future_task');
const incomplete = input.entries.slice(1).map(e => ({id:e.id, enabled:false}));
assert.equal(context.normalizeItems(incomplete, input.entries).canPatchSelection, false);
for (const target of input.entries) {
  const selective = input.entries.map(e => ({id:e.id, enabled:e.id === target.id}));
  const result = context.normalizeItems(selective, input.entries);
  assert.equal(result.canPatchSelection, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.items.filter(i => i.enabled).map(i => i.id))), [target.id]);
}
console.log(JSON.stringify({passed:actual.length, skipped:0, selectionCases:input.entries.length}));
'''
    result = subprocess.run(['node', '-e', harness, str(module)],
                            input=json.dumps(dict(inputs=inputs, entries=entries, expected=expected)),
                            encoding='utf-8', capture_output=True, check=True)
    return dict(upstreamCommit=COMMIT, sourceSha256=SOURCE_SHA,
                basis='Original locked normalize_items AST with isolated config; compared with production JS module',
                entries=entries, **json.loads(result.stdout))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = run(args.source)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
    print(f"oknte normalization: {report['passed']} differential cases, {report['selectionCases']} selective cases, 0 skipped")
