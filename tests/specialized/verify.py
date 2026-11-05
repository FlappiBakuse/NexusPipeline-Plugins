"""Run specialized task vectors in Node and the actual bounded Host interpreter."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension', choices=['baah', 'march7th', 'oknte', 'okww', 'zzzonedragon', 'maaend', 'maas', 'maa-framework'], required=True)
    for name in ['host-root', 'jint-assembly', 'acornima-assembly', 'output', 'work-root']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    for path in [args.output, args.work_root]:
        if not path.is_absolute() or path.resolve().is_relative_to(repo):
            raise ValueError('Explicit external work and report roots required')
    run = args.output / 'runs' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    run.mkdir(parents=True)
    plugin = repo / 'plugins' / ('managed' if args.extension == 'maa-framework' else 'specialized') / args.extension
    interpreter = args.host_root / 'src/platform/Extensions/BoundedTaskScript.cs'
    probe = repo / 'tests/specialized/bettergi/NativeProbe.csproj'
    inputs = [interpreter, probe, probe.with_suffix('.cs'), Path(__file__).resolve(),
              repo / 'tests/specialized/component.mjs', repo / 'tests/specialized/assemble.py',
              repo / 'tests/specialized/maa-fixture.mjs',
              repo / 'tooling/generate_adapter.py', repo / 'tooling/localization.py',
              plugin / 'extension.json', *sorted((plugin / 'i18n').glob('*.json')), args.jint_assembly, args.acornima_assembly,
              plugin / 'adapter/sources.json', *sorted((repo / 'tests/specialized' / args.extension).glob('*.mjs'))]
    inputs += [repo / name if name.startswith('adapter-runtime/') else plugin / name
               for name in json.loads((plugin / 'adapter/sources.json').read_bytes())]
    before = {str(path): digest(path) for path in inputs}
    environment = os.environ.copy()
    environment.update(TEMP=str(args.work_root / 'tmp'), TMP=str(args.work_root / 'tmp'),
                       NUGET_PACKAGES=str(args.work_root / 'nuget'), DOTNET_CLI_HOME=str(args.work_root / 'dotnet-home'),
                       DOTNET_CLI_TELEMETRY_OPTOUT='1', DOTNET_GENERATE_ASPNET_CERTIFICATE='false')
    (args.work_root / 'tmp').mkdir(parents=True, exist_ok=True)
    commands = []

    def run_command(label, command):
        started = time.monotonic()
        try:
            result = subprocess.run(command, cwd=repo, env=environment, capture_output=True, timeout=300)
        except subprocess.TimeoutExpired as error:
            result = subprocess.CompletedProcess(command, 124, error.stdout or b'', (error.stderr or b'') + b'\ncomponent_command_timeout\n')
        log = run / (label + '.log')
        log.write_bytes(result.stdout + result.stderr)
        commands.append(dict(command=command, exitCode=result.returncode, elapsedSeconds=time.monotonic() - started,
                             log=str(log), sha256=digest(log)))
        return result.returncode

    node_code = run_command('node', ['node', str(repo / 'tests/specialized/component.mjs'), str(repo), args.extension, str(run)])
    node = json.loads((run / 'node-report.json').read_bytes())
    artifacts = {str(path): digest(path) for path in [run / 'adapter.js', run / 'cases.json']}
    native = None
    code = run_command('build', ['dotnet', 'build', str(probe), '--artifacts-path', str(args.work_root / 'build'),
            '--disable-build-servers', '-p:HostSourceRoot=' + str(args.host_root),
            '-p:JintAssemblyPath=' + str(args.jint_assembly), '-p:AcornimaAssemblyPath=' + str(args.acornima_assembly)])
    if not code:
        code = run_command('native', ['dotnet', str(args.work_root / 'build/bin/NativeProbe/debug/NativeProbe.dll'),
            str(run / 'adapter.js'), str(run / 'cases.json'), str(run / 'native-report.json'), str(interpreter)])
        if (run / 'native-report.json').is_file():
            native = json.loads((run / 'native-report.json').read_bytes())
        if not code and (native is None or native['status'] != 'PASS' or native['caseCount'] != node['caseCount'] or native['failures'] != 0 or
                [item['name'] for item in native['results']] != [item['name'] for item in node['results']] or
                any(item['status'] != 'PASS' for item in native['results']) or native['adapterSha256'] != node['adapterSha256'] or
                native['hostInterpreter']['sha256'] != before[str(interpreter)] or native['engineAssembly']['sha256'] != before[str(args.jint_assembly)]):
            code = 1
    code = code or node_code
    unchanged = before == {str(path): digest(path) for path in inputs} and artifacts == {name: digest(Path(name)) for name in artifacts}
    receipt = dict(status='PASS' if not code and unchanged else 'FAIL', commands=commands,
        sourceMode='local-uncommitted', commit=None, tree=None, caseCount=node['caseCount'],
        node=str(run / 'node-report.json'), native=str(run / 'native-report.json') if native is not None else None,
        inputs=before, inputsUnchanged=unchanged, scope='Actual bounded Host interpreter component with synthetic vectors',
        installedHost='NOT_RUN', upstreamExecution='NOT_RUN', persistentRetry='NOT_RUN')
    (run / 'receipt.json').write_bytes((json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode())
    print(json.dumps(dict(status=receipt['status'], caseCount=receipt['caseCount'], receipt=str(run / 'receipt.json'))))
    return code or (0 if unchanged else 1)


if __name__ == '__main__':
    raise SystemExit(main())
