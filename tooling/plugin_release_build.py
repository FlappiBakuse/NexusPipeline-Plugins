"""Build fixed release inputs through the existing SDK and package producers."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from types import SimpleNamespace

from ci_build import external, package_plugins
from ci_plan import source_identity
from plugin_release_check import writer_control
from plugin_release_plan import make_plan
from release_github import GitHub
from release_provenance import require, sha, verify_source


def build(args):
    root = args.source_root.resolve(strict=True)
    host = args.host_root.resolve(strict=True)
    distribution = args.distribution_root.resolve(strict=True)
    control = writer_control(args.channel)
    api = GitHub()
    source = source_identity(root, sha(args.source_commit))
    partner = source_identity(host, sha(args.host_commit))
    verify_source(api.fetch, control['repository'], source, 'develop' if args.channel == 'preview' else 'main')
    verify_source(api.fetch, 'FlappiBakuse/NexusPipeline', partner)
    baseline = source_identity(distribution, sha(args.distribution_commit))
    verify_source(api.fetch, control['repository'], baseline)
    plan = make_plan(root, distribution, args.distribution_commit, args.source_commit, args.channel)
    output = external(root, host, args.output)
    require(distribution not in output.parents and output not in distribution.parents, 'Output overlaps distribution source')
    report = dict(status='RUNNING', source=source, partner=partner, plan=plan, commands=[])
    environment = os.environ.copy()
    temporary = output / 'tmp'
    temporary.mkdir()
    environment.update(TEMP=str(temporary), TMP=str(temporary), PYTHONDONTWRITEBYTECODE='1',
                       npm_config_cache=str(output / 'cache/npm'))

    def save():
        (output / 'build.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    def run(label, command, cwd):
        start = time.monotonic()
        log = output / (label + '.log')
        with log.open('w', encoding='utf-8') as stream:
            completed = subprocess.run(command, cwd=cwd, env=environment, stdout=stream, stderr=subprocess.STDOUT)
        report['commands'].append(dict(label=label, command=command, cwd=str(cwd), exitCode=completed.returncode,
                                       seconds=time.monotonic() - start, log=str(log)))
        save()
        require(completed.returncode == 0, 'Release input failed: ' + label)
        return log.read_text(encoding='utf-8')

    def python(label, repository, script, *arguments):
        return run(label, [sys.executable, '-B', str(repository / script), *map(str, arguments)], repository)

    try:
        if plan['status'] == 'NO_CHANGES':
            report['status'] = 'NO_CHANGES'
            return report
        selected = sorted(plan['plugins'] if args.channel == 'preview' else plan['requiresPackage'])
        consumer = output / 'consumer'
        run('consumer-clone', ['git', 'clone', '--no-hardlinks', '--no-checkout', str(root), str(consumer)], output)
        run('consumer-source', ['git', '-c', 'core.autocrlf=false', 'checkout', '--detach', args.source_commit], consumer)
        require(source_identity(consumer, args.source_commit) == source, 'Consumer source differs')
        build_root = output / 'host-build'
        if selected:
            python('host-sdk', host, 'tooling/nexus.py', 'build', '--profile', 'production', '--output', build_root,
                   '--project', 'NexusPipeline.Extensibility', '--project', 'NexusPipeline.Boundaries')
            package_plugins(python, run, host, consumer, build_root, output,
                            [plan['plugins'][name]['extensionId'] for name in selected], report)
        assembler = __import__('plugin_preview_assemble' if args.channel == 'preview' else 'plugin_release_assemble')
        result = assembler.assemble(SimpleNamespace(source_root=root, partner_root=host, distribution_root=distribution,
            source_commit=args.source_commit, partner_commit=args.host_commit, distribution_commit=args.distribution_commit,
            profile='production', output=output / 'candidate', sdk_receipt=Path(report['sdkReceipt']) if selected else None,
            host_build_receipt=build_root / 'build-receipt.json' if selected else None,
            package_receipt=[Path(item['receipt']) for item in report.get('packages', [])]))
        require(source_identity(root, args.source_commit) == source and source_identity(host, args.host_commit) == partner,
                'Release source changed')
        report.update(result)
        return report
    except Exception as error:
        report.update(status='FAIL', error=str(error))
        raise
    finally:
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        save()
        if os.environ.get('GITHUB_OUTPUT'):
            with Path(os.environ['GITHUB_OUTPUT']).open('a', encoding='utf-8') as stream:
                stream.write('candidate=' + str(report['status'] == 'CANDIDATE_CREATED_NOT_QUALIFIED').lower() + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--channel', choices=('stable', 'preview'), required=True)
    for name in ('source-root', 'host-root', 'distribution-root', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    for name in ('source-commit', 'host-commit', 'distribution-commit'):
        parser.add_argument('--' + name, required=True)
    print(json.dumps(build(parser.parse_args()), indent=2))


if __name__ == '__main__':
    main()
