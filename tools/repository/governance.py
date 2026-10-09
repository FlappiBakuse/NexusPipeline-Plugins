"""Explain source ownership using the existing Git selector and plugin validators."""
from __future__ import annotations

import json
import re
from pathlib import Path
import subprocess

from tools.build_source import source_entries, fingerprint
from tools.repository.git import _git, plugin_root_from_path
from tools.repository.model import RepositoryError
from tools.repository.source import validate_source_plugin


def safe_path(root: Path, base: str, relative: str) -> Path:
    target = (root / base / relative).resolve()
    if not relative or Path(relative).is_absolute() or not target.is_relative_to(root.resolve()) or not target.exists():
        raise RepositoryError(f'Missing/outside repository path: {relative}')
    return target


def owner_of(file: str) -> str:
    plugin = plugin_root_from_path(file)
    if plugin:
        return 'Plugin/' + plugin.split('/')[-1]
    if '/' not in file and file.endswith('.md') and file != 'AGENTS.md':
        return 'Docs'
    return {'adapters': 'Adapters', 'contracts': 'Contracts', 'docs': 'Docs', 'tests': 'Tests',
            'tools': 'Tools', 'examples': 'Examples', 'packages': 'Distribution'}.get(file.split('/')[0],
            'Distribution' if file in ('catalog.json', '.release-state.json') else 'Repository')


def path_rule(root: Path, change: dict) -> dict:
    file = change['path']
    result = {'rule': 'GOV-FS-02', 'status': 'PASS', 'file': file, 'old': change.get('old'), 'owner': owner_of(file)}
    if Path(file).is_absolute() or '..' in file.split('/') or file.split('/')[0] in ('config', 'data', 'history', 'logs', '.nxp', 'release', '.generated'):
        return {**result, 'status': 'FAIL', 'reason': 'Runtime/output or outside-repository source path'}
    plugin_root = plugin_root_from_path(file)
    if plugin_root:
        try:
            plugin = validate_source_plugin(safe_path(root, '', plugin_root))
            return {**result, 'artifactName': plugin.artifact_name, 'name': plugin.name, 'kind': plugin.kind,
                    'reason': 'Existing source/manifest/script boundary validator'}
        except (RepositoryError, ValueError, OSError) as error:
            return {**result, 'status': 'FAIL', 'reason': str(error)}
    json_role = not file.endswith('.json') or file.startswith(('tests/fixtures/', 'contracts/', 'adapters/', 'examples/')) or file == 'docs/map.json'
    if result['owner'] == 'Repository' or not json_role:
        return {**result, 'status': 'REVIEW', 'reason': 'Confirm new resource role/Owner using docs/map.json and adjacent source'}
    return result


def context_for(root: Path, paths=(), keywords=(), owners=(), host_root: Path | None = None) -> dict:
    navigation = json.loads(safe_path(root, '', 'docs/map.json').read_bytes())
    terms = [value.casefold() for value in (*keywords, *owners)]
    topics = [topic for topic in navigation['topics'] if any(
        file == code or file.startswith(code + '/') or code.startswith(file + '/')
        for file in paths for code in topic.get('codePaths', [])) or any(
        term in json.dumps(topic, ensure_ascii=False).casefold() for term in terms)]
    for topic in topics:
        safe_path(root, 'docs', topic['path'])
    agents = safe_path(root, '', 'AGENTS.md').read_text(encoding='utf-8')
    sections = [section for section in re.split(r'(?=^## )', agents, flags=re.MULTILINE)
                if re.match(r'^## [234]\.', section)]
    result = {'agents': {'file': 'AGENTS.md', 'headings': [line for line in agents.splitlines() if line.startswith('#')], 'sections': sections},
              'topics': topics, 'testDomains': sorted({domain for topic in topics for domain in topic.get('testDomains', [])}),
              'lock': json.loads(safe_path(root, '', 'host.lock.json').read_bytes()),
              'partner': {'status': 'NOT_CHECKED', 'reason': 'No explicit Host path; public UI candidates/paired API not checked'}}
    if host_root is not None:
        host_root = host_root.resolve()
        tool = safe_path(host_root, '', 'tools/governance.mjs')
        command = ['node', str(tool), 'preflight', '--root', str(host_root), '--partner-root', str(root)]
        for keyword in keywords:
            command.extend(['--keyword', keyword])
        host = json.loads(subprocess.check_output(command, encoding='utf-8'))
        result['partner'] = {'root': str(host_root), 'headSha': host['headSha'], 'sourceFingerprint': host['sourceFingerprint'],
                             'context': host['context']}
    return result


def collect_changes(root: Path, base: str, working_tree: bool) -> dict:
    # Reuse the local runner's NUL-delimited rename/copy and staged/untracked semantics.
    program = """import {pathToFileURL} from 'node:url';
const root=process.argv[1], options=JSON.parse(process.argv[2]);
const {collectChanges}=await import(pathToFileURL(process.argv[3]));
process.stdout.write(JSON.stringify(collectChanges(root,options)));"""
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', program, str(root),
                       json.dumps({'base': base, 'includeWorkingTree': working_tree}),
                       str(Path(__file__).resolve().parents[2] / 'tests/runner/scope-plan.mjs')], encoding='utf-8'))


def check_changes(root: Path, evidence: dict, owners=(), host_root: Path | None = None, working_tree=False, governance_only=False) -> dict:
    rules = []
    changes = list({json.dumps(item, sort_keys=True): item for item in evidence['changes']}.values())
    actual_owners = set()
    for change in changes:
        file = change['path']
        for identity in filter(None, (file, change.get('old'))):
            actual_owners.add(owner_of(identity))
            if owners and owner_of(identity) not in owners:
                rules.append({'rule': 'GOV-SCOPE-01', 'status': 'REVIEW', 'file': identity,
                              'owner': owner_of(identity), 'reason': 'Owner outside declared task scope'})
            if owner_of(identity) == 'Distribution':
                from tools.ci_check import scope
                try:
                    scope(root, [identity])
                except ValueError as error:
                    rules.append({'rule': 'GOV-FS-02', 'status': 'FAIL', 'file': identity, 'reason': str(error)})
        if change['status'] in ('A', 'R', 'C'):
            rules.append(path_rule(root, change))
        if file == 'host.lock.json' or file.endswith('/plugin.json'):
            rules.append({'rule': 'GOV-VER-01', 'status': 'REVIEW', 'file': file,
                          'reason': 'Verify explicit version/contract authorization; tool cannot infer it'})
        if governance_only and (file.startswith(('plugins/', 'adapters/', 'contracts/')) or file == 'host.lock.json'):
            rules.append({'rule': 'GOV-VER-01', 'status': 'FAIL', 'file': file,
                          'reason': 'Explicit governance-only scope excludes product/contract/version source changes'})
    context = context_for(root, paths=[change['path'] for change in changes], host_root=host_root)
    if host_root is not None:
        facts = context['partner']['context']['apiFacts']
        for actual, expected in ((context['lock']['hostApiVersion'], facts.get('pluginApi')),
                                 (context['lock']['frontendApiVersion'], facts.get('frontendApi'))):
            rules.append({'rule': 'GOV-DOC-01', 'status': 'NOT_CHECKED' if not expected else 'PASS' if actual == expected else 'FAIL',
                          'file': 'host.lock.json', 'actual': actual, 'expected': expected})
    status = next((value for value in ('FAIL', 'NOT_CHECKED', 'REVIEW') if any(rule['status'] == value for rule in rules)), 'PASS')
    return {'schemaVersion': 1, 'repository': 'Plugins', **evidence, 'changes': changes,
            'workingTreeIncluded': working_tree, 'sourceFingerprint': fingerprint(source_entries(root)) if working_tree else None,
            'owners': sorted(actual_owners), 'rules': rules, 'status': status, 'context': context,
            'notChecked': ['GOV-DOC-01: run existing check docs for local claims; no semantic dependency delta for Plugins']}


def run(root: Path, args) -> None:
    if args.route == 'check_governance':
        if not re.fullmatch('[a-f0-9]{40}', args.base):
            raise RepositoryError('Supply complete base commit SHA')
        evidence = collect_changes(root, args.base, args.working_tree)
        if evidence['dirty'] and not args.working_tree:
            raise RepositoryError('Use --working-tree or a clean checkout; current validators cannot represent an excluded dirty tree')
        report = check_changes(root, evidence, args.owner, args.host_root, args.working_tree, args.governance_only)
    else:
        report = {'schemaVersion': 1, 'repository': 'Plugins', 'headSha': _git(root, ['rev-parse', 'HEAD'], 'HEAD'),
                  'workingTree': _git(root, ['status', '--short'], 'Status'), 'sourceFingerprint': fingerprint(source_entries(root)),
                  'context': context_for(root, args.path, args.keyword, args.owner, args.host_root)}
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.report:
        output = args.report.resolve()
        if output.is_relative_to(root):
            raise RepositoryError('Report must be outside repository')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(encoded, encoding='utf-8')
    else:
        print(encoded, end='')
    if report.get('status') == 'FAIL' or any(rule['rule'] == 'GOV-DOC-01' and rule['status'] == 'NOT_CHECKED' for rule in report.get('rules', [])):
        raise RepositoryError('Governance found deterministic violations; see report')
