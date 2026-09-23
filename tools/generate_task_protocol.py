"""Deterministically bundle reviewed task adapters; --check never modifies sources."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools' / 'task-protocol'

PHASE_FILES = {'discover': 'discover.js', 'observe': 'judge.js', 'retry': 'retry.js'}


def unique_members(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate module manifest member: ' + key)
        result[key] = value
    return result


def load_adapters(source=None):
    """Load per-adapter metadata through a bounded, declaration-only index."""
    source = (source or SOURCE).resolve()
    index = json.loads((source / 'adapters.json').read_text(encoding='utf-8'), object_pairs_hook=unique_members)
    if not isinstance(index, dict) or not index:
        raise ValueError('Empty adapter index')
    adapters = {}
    for artifact, entry in index.items():
        if not re.fullmatch(r'[A-Z][A-Za-z0-9]{1,63}', artifact) or not isinstance(entry, dict) or set(entry) != {'metadata'}:
            raise ValueError('Invalid adapter index entry: ' + artifact)
        if not isinstance(entry['metadata'], str):
            raise ValueError('Invalid adapter metadata path')
        path = (source / entry['metadata']).resolve()
        if not path.is_relative_to(source) or path.suffix != '.json' or path == source / 'adapters.json':
            raise ValueError('Unsafe adapter metadata path: ' + artifact)
        data = json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_members)
        if not isinstance(data, dict) or not isinstance(data.get('id'), str) or not isinstance(data.get('implementation'), str):
            raise ValueError('Invalid adapter metadata: ' + artifact)
        validate_adapter_metadata(data, artifact)
        adapters[artifact] = data
    return adapters


def validate_adapter_metadata(adapter, artifact):
    """Validate metadata facts consumed by generated configuration diagnostics."""
    if 'dailyTaskKeys' in adapter:
        raise ValueError(f'{artifact}: dailyTaskKeys is not an authoritative field')
    entries = adapter.get('entries', [])
    entry_ids = {
        entry.get('id') for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get('id'), str)
    }
    rules = adapter.get('configRules', [])
    if not isinstance(rules, list):
        raise ValueError(f'{artifact}: configRules must be a list')
    for rule in rules:
        if not isinstance(rule, dict):
            raise ValueError(f'{artifact}: invalid config rule')
        if rule.get('kind') != 'single_daily':
            continue
        if 'dailyTaskKeys' in rule:
            raise ValueError(f'{artifact}: single_daily must use allowedTaskKeys')
        allowed = rule.get('allowedTaskKeys')
        if (not isinstance(allowed, list) or not allowed
                or any(not isinstance(key, str) or not key for key in allowed)
                or len(set(allowed)) != len(allowed)):
            raise ValueError(f'{artifact}: single_daily allowedTaskKeys must be unique and non-empty')
        if entry_ids and not set(allowed).issubset(entry_ids):
            raise ValueError(f'{artifact}: single_daily allowedTaskKeys contains an unknown task')


def load_graph():
    graph = json.loads((SOURCE / 'phase-modules.json').read_text(encoding='utf-8'), object_pairs_hook=unique_members)
    if set(graph) != {'modules', 'entries'} or not graph['modules'] or not graph['entries']:
        raise ValueError('Invalid phase module manifest')
    for name, module in graph['modules'].items():
        if set(module) != {'file', 'requires', 'provides'} or not module['provides']:
            raise ValueError('Invalid module: ' + name)
        for field in ('requires', 'provides'):
            values = module[field]
            if not isinstance(values, list) or any(not isinstance(v, str) or not v for v in values) or len(set(values)) != len(values):
                raise ValueError('Invalid module ' + field + ': ' + name)
        path = (SOURCE / module['file']).resolve()
        if not path.is_relative_to(SOURCE.resolve()) or path.suffix != '.js':
            raise ValueError('Unsafe phase module path: ' + name)
        # Modules use an intentionally restricted source format: named top-level declarations.
        declared = re.findall(r'^(?:function|const|let) (\w+)', path.read_text(encoding='utf-8'), re.M)
        if sorted(declared) != sorted(module['provides']):
            raise ValueError('Module symbols disagree with manifest: ' + name)
    for adapter, phases in graph['entries'].items():
        if set(phases) != set(PHASE_FILES) or any(not isinstance(roots, list) or not roots for roots in phases.values()):
            raise ValueError('Missing or unknown phase entry: ' + adapter)
        for roots in phases.values():
            dependency_closure(graph, roots)
    return graph


def dependency_closure(graph, roots):
    """Validate the entire graph, then return dependencies before their consumers."""
    modules = graph['modules']
    visiting, done, ordered = set(), set(), []
    def visit(name):
        if name not in modules:
            raise ValueError('Unknown phase dependency: ' + name)
        if name in visiting:
            raise ValueError('Phase dependency cycle: ' + name)
        if name in done:
            return
        visiting.add(name)
        for dependency in modules[name]['requires']:
            visit(dependency)
        visiting.remove(name)
        done.add(name)
        ordered.append(name)
    for name in modules:
        visit(name)
    visiting.clear(); done.clear(); ordered.clear()
    for name in roots:
        visit(name)
    providers = set()
    for name in ordered:
        for symbol in modules[name]['provides']:
            if symbol in providers:
                raise ValueError('Duplicate phase symbol: ' + symbol)
            providers.add(symbol)
    return ordered


def bundle(adapter, phase, *, scaffold=False):
    if phase not in PHASE_FILES:
        raise ValueError('Unknown task phase: ' + phase)
    graph = load_graph()
    implementation = adapter.get('implementation', 'example')
    entries = graph['entries'][implementation]
    if set(entries) != set(PHASE_FILES):
        raise ValueError('Missing or unknown phase entry: ' + implementation)
    closure = dependency_closure(graph, entries[phase])
    content = '// Generated by tools/generate_task_protocol.py. Edit tools/task-protocol sources.\n'
    content += "'use strict';\n"
    content += 'const ADAPTER = ' + json.dumps(adapter, ensure_ascii=False, separators=(',', ':')) + ';\n'
    # Check outside discover's schema fallback: a wrong phase is a protocol error.
    content += 'if (input.phase !== ' + json.dumps(phase) + ') throw new Error("protocol_error: wrong phase");\n'
    content += 'if (input.protocolVersion !== ' + json.dumps(adapter.get('protocolVersion', '1.0')) + ') throw new Error("protocol_error: wrong version");\n'
    if scaffold:
        content += '// __NXP_ADAPTATION_REQUIRED__\nthrow new Error("adapter_not_implemented");\n'
        return content
    for name in closure:
        path = (SOURCE / graph['modules'][name]['file']).resolve()
        if not path.is_relative_to(SOURCE.resolve()) or path.suffix != '.js':
            raise ValueError('Unsafe phase module path: ' + name)
        content += path.read_text(encoding='utf-8') + '\n'
    if phase == 'discover':
        content += '''let result;
try { result = discover(); if (typeof finalizeAssessment === 'function') result.configAssessment = finalizeAssessment(result); delete result.slots; }
catch { result = { protocolVersion: ADAPTER.protocolVersion || '1.0', type: 'discovery', coverage: 'unsupported', tasks: [], selectionFields: [],
  diagnostics: [{ code: 'unsupported_schema', message: 'Configuration identity or schema could not be verified.' }] }; if (typeof finalizeAssessment === 'function') result.configAssessment = finalizeAssessment(result); }
console.log(result);
'''
    elif phase == 'observe':
        content += "console.log(observeRules(observe, typeof finalizeObserve === 'function' ? finalizeObserve : null));\n"
    else:
        content += 'console.log(retryPlan(discover));\n'
    return content


def generate(check: bool) -> None:
    metadata = load_adapters()
    failures = []
    for artifact, adapter in metadata.items():
        for phase, name in PHASE_FILES.items():
            content = bundle(adapter, phase)
            path = ROOT / 'plugins' / 'specialized' / artifact / 'data' / name
            if check:
                if not path.exists() or path.read_text(encoding='utf-8') != content: failures.append(str(path.relative_to(ROOT)))
            else: path.write_text(content, encoding='utf-8', newline='\n')
    if failures: raise SystemExit('Generated task adapters differ: ' + ', '.join(failures))
    print(('Checked' if check else 'Generated') + f' {len(metadata) * 3} backend scripts for {len(metadata)} task adapters')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
