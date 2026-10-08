"""Plan and run actual affected plugin packages without running project tests."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tools.build_source import changed_paths, fingerprint, full_sha, git, snapshot, source_entries, tree_sha
from tools.repository.source import discover_source_plugins


def scope(root: Path, paths: list[str]) -> dict:
    plugins = discover_source_plugins(root)
    selected = set()
    reasons = []
    deleted = set()
    production_helpers = {'tests/architecture/check.py', 'tests/support/managed_build.py'}
    for path in paths:
        if path.startswith(('catalog.json', '.release-state.json', 'packages/')):
            raise ValueError('PR source changes may not write stable distribution files')
        match = re.match(r'plugins/(general|specialized)/([^/]+)/', path)
        if match:
            artifact = match[2]
            if any(plugin.artifact_name == artifact for plugin in plugins):
                selected.add(artifact)
            else:
                deleted.add(artifact)
        elif ((path.startswith(('docs/', 'tests/')) and path not in production_helpers)
                or path.endswith('.md') or path == '.github/workflows/final-budget.yml'):
            continue
        elif path.startswith('adapters/') or path == 'tests/architecture/check.py':
            selected.update(plugin.artifact_name for plugin in plugins if plugin.kind == 'data-specialized')
        elif path == 'tests/support/managed_build.py':
            selected.update(plugin.artifact_name for plugin in plugins if plugin.kind == 'managed-code')
        else:
            selected.update(plugin.artifact_name for plugin in plugins)
        reasons.append(path)
    managed = any(plugin.kind == 'managed-code' and plugin.artifact_name in selected for plugin in plugins)
    return {'artifacts': sorted(selected), 'deletedArtifacts': sorted(deleted), 'reasons': reasons,
            'nodeRequired': bool(selected), 'dotnetRequired': managed, 'partnerRequired': managed}


def plan(root: Path, base: str, head: str, checkout: str, partner_sha: str | None = None) -> dict:
    full_sha(root, checkout)
    if git(root, 'rev-parse', 'HEAD') != checkout:
        raise ValueError('Actual checkout does not match the declared SHA')
    paths = sorted(set(changed_paths(root, base, head))
                   | set(filter(None, git(root, 'diff', '--name-only', '-z', 'HEAD').split('\0')))
                   | set(filter(None, git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0'))))
    selected = scope(root, paths)
    deleted = []
    for artifact in selected['deletedArtifacts']:
        directories = {str(Path(path).parent).replace('\\', '/') for path in paths
                       if path in (f'plugins/general/{artifact}/plugin.json', f'plugins/specialized/{artifact}/plugin.json')}
        if len(directories) != 1:
            raise ValueError('Deleted plugin manifest identity is missing or ambiguous')
        previous = json.loads(git(root, 'show', f'{base}:{next(iter(directories))}/plugin.json'))
        if previous.get('artifactName') != artifact or previous.get('kind') not in ('managed-code', 'data-specialized'):
            raise ValueError('Deleted plugin identity does not match its source directory')
        deleted.append({'artifactName': artifact, 'name': previous['name'], 'kind': previous['kind']})
    if selected['partnerRequired']:
        partner_sha = partner_sha or subprocess.check_output(
            ['git', 'ls-remote', 'https://github.com/FlappiBakuse/NexusPipeline.git', 'refs/heads/main'],
            encoding='utf-8').split()[0]
    else:
        partner_sha = partner_sha or checkout
    if not re.fullmatch('[0-9a-f]{40}', partner_sha):
        raise ValueError('Invalid fixed Host SDK SHA')
    entries = source_entries(root)
    return {'schemaVersion': 1, 'baseSha': base, 'headSha': head, 'checkoutSha': checkout,
            'sourceFingerprint': fingerprint(entries), 'sourceTreeSha': tree_sha(root, entries),
            'partnerSha': partner_sha, 'paths': paths, 'deletedIdentities': deleted, **selected}


def run(root: Path, selected: dict, output: Path, host: Path | None) -> None:
    if selected != plan(root, selected['baseSha'], selected['headSha'], selected['checkoutSha'], selected['partnerSha']):
        raise ValueError('Package plan or source inputs changed')
    if output.exists() or output.is_symlink() or output.resolve().is_relative_to(root.resolve()):
        raise ValueError('Use a new external package-check directory')
    output.mkdir(parents=True)
    report = {'schemaVersion': 1, 'status': 'FAIL', 'plan': selected, 'packages': []}
    started = time.monotonic()
    temporary = output / 'tmp'
    temporary.mkdir()
    cache = output.parent / 'cache'
    os.environ.update(TEMP=str(temporary), TMP=str(temporary), NUGET_PACKAGES=str(cache / 'nuget'),
                      NUGET_HTTP_CACHE_PATH=str(cache / 'nuget-http'), NUGET_PLUGINS_CACHE_PATH=str(cache / 'nuget-plugins'),
                      npm_config_cache=str(cache / 'npm'), DOTNET_CLI_HOME=str(cache / 'dotnet'),
                      DOTNET_ADD_GLOBAL_TO_PATH='false', DOTNET_GENERATE_ASPNET_CERTIFICATE='false',
                      DOTNET_CLI_TELEMETRY_OPTOUT='1', DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE='true',
                      PYTHONDONTWRITEBYTECODE='1', PYTHONUTF8='1')
    import tempfile
    tempfile.tempdir = str(temporary)
    try:
        if selected['partnerRequired']:
            if host is None or git(host, 'rev-parse', 'HEAD') != selected['partnerSha'] or git(host, 'status', '--porcelain'):
                raise ValueError('Managed packages require the fixed clean Host SDK checkout')
        if not selected['artifacts']:
            print('[production] 无需生产打包: documentation/local-test inputs only', flush=True)
        else:
            source = output / 'source'
            snapshot(root, source, source_entries(root))
            for artifact in selected['artifacts']:
                plugin = next(item for item in discover_source_plugins(source) if item.artifact_name == artifact)
                before = time.monotonic()
                for file in plugin.root.rglob('*'):
                    if file.suffix in ('.js', '.mjs'):
                        subprocess.run(['node', '--check', str(file)], check=True)
                    elif file.suffix == '.py':
                        compile(file.read_text(encoding='utf-8'), str(file), 'exec')
                arguments = [sys.executable, str(source / 'tools/repo.py'), 'package', '--root', str(source),
                             '--artifact', artifact, '--output', str(output / 'packages' / artifact),
                             '--report', str(output / f'{artifact}.json')]
                if host is not None:
                    arguments.extend(('--host-root', str(host)))
                with (output / f'{artifact}.log').open('w', encoding='utf-8') as log:
                    child = subprocess.Popen(arguments, cwd=source, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                             encoding='utf-8', errors='replace')
                    for line in child.stdout:
                        print(line, end='', flush=True)
                        log.write(line)
                    code = child.wait()
                if code:
                    raise subprocess.CalledProcessError(code, arguments)
                result = json.loads((output / f'{artifact}.json').read_bytes())
                result['command'] = arguments
                report['packages'].append({**result, 'elapsedSeconds': time.monotonic() - before})
        report['status'] = 'PASS'
    finally:
        report['elapsedSeconds'] = time.monotonic() - started
        (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(allow_abbrev=False)
    sub = parser.add_subparsers(dest='operation', required=True)
    planning = sub.add_parser('plan', allow_abbrev=False)
    for name in ('base', 'head', 'checkout'):
        planning.add_argument('--' + name, required=True)
    planning.add_argument('--partner-sha')
    planning.add_argument('--report', type=Path, required=True)
    running = sub.add_parser('run', allow_abbrev=False)
    running.add_argument('--plan', type=Path, required=True)
    running.add_argument('--output', type=Path, required=True)
    running.add_argument('--host-root', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    try:
        if args.operation == 'plan':
            selected = plan(root, args.base, args.head, args.checkout, args.partner_sha)
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(selected, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            if os.environ.get('GITHUB_OUTPUT'):
                with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
                    for key in ('nodeRequired', 'dotnetRequired', 'partnerRequired', 'partnerSha'):
                        stream.write(f'{key}={str(selected[key]).lower() if isinstance(selected[key], bool) else selected[key]}\n')
            print(json.dumps(selected, ensure_ascii=False), flush=True)
        else:
            run(root, json.loads(args.plan.read_bytes()), args.output.resolve(), args.host_root)
        return 0
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f'Package check failed: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
