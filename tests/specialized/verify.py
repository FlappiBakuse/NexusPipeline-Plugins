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


def read_report(path):
    try:
        report = json.loads(path.read_bytes())
    except (OSError, ValueError) as error:
        raise ValueError(f'{path.name}: {error}') from error
    rows = report.get('results') if isinstance(report, dict) else None
    if (not isinstance(rows, list) or report.get('caseCount') != len(rows) or any(
            not isinstance(row, dict) or row.get('status') not in ('PASS', 'FAIL') or not isinstance(row.get('name'), str)
            for row in rows)):
        raise ValueError(f'{path.name}: invalid case results')
    status = 'PASS' if rows and all(row['status'] == 'PASS' for row in rows) else 'FAIL'
    if report.get('status') != status:
        raise ValueError(f'{path.name}: inconsistent result status')
    return report


def verify_component(repo, args, run, native_path):
    plugin = repo / 'plugins' / ('managed' if args.extension == 'maa-framework' else 'specialized') / args.extension
    interpreter = args.host_root / 'src/platform/Extensions/BoundedTaskScript.cs'
    scripts = repo / 'tests/specialized'
    probe = scripts / 'bettergi/NativeProbe.csproj'
    inputs = [interpreter, probe, probe.with_suffix('.cs'), Path(__file__).resolve(),
              scripts / 'assemble.py', scripts / 'maa-fixture.mjs', scripts / 'component-runner.mjs',
              repo / 'tooling/generate_adapter.py', repo / 'tooling/localization.py',
              plugin / 'extension.json', plugin / 'locale.ts', args.jint_assembly, args.acornima_assembly,
              plugin / 'adapter/sources.json', *sorted((scripts / args.extension).glob('*.mjs'))]
    if args.extension == 'bettergi':
        node_command = ['node', str(scripts / 'bettergi/verify.mjs'), '--output', str(run)]
        inputs.append(scripts / 'bettergi/native_verify.py')
    else:
        node_command = ['node', str(scripts / 'component.mjs'), str(repo), args.extension, str(run)]
        inputs.append(scripts / 'component.mjs')
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
        except OSError as error:
            result = subprocess.CompletedProcess(command, 1, b'', str(error).encode('utf-8'))
        log = native_path.parent / (label + '.log')
        log.write_bytes(result.stdout + result.stderr)
        commands.append(dict(stage=label, command=command, exitCode=result.returncode, elapsedSeconds=time.monotonic() - started,
                             log=str(log), sha256=digest(log)))
        return result.returncode

    node_path = run / 'node-report.json'
    preparation = dict(inputs='FAIL', assembly='NOT_RUN', vectors='NOT_RUN', probeCompilation='NOT_RUN', jintInputs='NOT_RUN')
    tests = dict(node='NOT_RUN', jint='NOT_RUN')
    node = None
    before, artifacts = {}, {}
    failure = None
    code = 0
    try:
        inputs += [repo / name if name.startswith('adapter-runtime/') else plugin / name
                   for name in json.loads((plugin / 'adapter/sources.json').read_bytes())]
        before = {str(path): digest(path) for path in inputs}
        preparation['inputs'] = 'PASS'
        code = run_command('node', node_command)
        node = read_report(node_path)
        assembly, vectors = (node['preparation'][name] for name in ('assembly', 'vectors'))
        node_test = node['status'] if node['results'] else 'NOT_RUN'
        if ((assembly, vectors, node_test) not in (
                ('FAIL', 'NOT_RUN', 'NOT_RUN'), ('PASS', 'FAIL', 'NOT_RUN'),
                ('PASS', 'PASS', 'PASS'), ('PASS', 'PASS', 'FAIL')) or
                node['responsibilities']['test'] != node_test or bool(code) != (node['status'] == 'FAIL')):
            raise ValueError('Node report does not match preparation, case results or exit status')
        if vectors == 'PASS':
            artifacts = {str(path): digest(path) for path in [run / 'adapter.js', run / 'cases.json']}
            if node.get('adapterSha256') != artifacts[str(run / 'adapter.js')]:
                raise ValueError('Node report does not match the adapter')
        preparation.update(assembly=assembly, vectors=vectors)
        tests['node'] = node_test
        failure = node.get('error')
        if not code:
            code = run_command('compile', ['dotnet', 'build', str(probe), '--artifacts-path', str(args.work_root / 'build'),
                '--disable-build-servers', '-p:HostSourceRoot=' + str(args.host_root),
                '-p:JintAssemblyPath=' + str(args.jint_assembly), '-p:AcornimaAssemblyPath=' + str(args.acornima_assembly)])
            preparation['probeCompilation'] = 'FAIL' if code else 'PASS'
        if not code:
            code = run_command('jint', ['dotnet', str(args.work_root / 'build/bin/NativeProbe/debug/NativeProbe.dll'),
                str(run / 'adapter.js'), str(run / 'cases.json'), str(native_path), str(interpreter)])
            native = read_report(native_path)
            rows = native['results']
            if code != int(native['status'] == 'FAIL'):
                raise ValueError('Jint report does not match case results or exit status')
            if native['preparation'] == 'FAIL' and not rows:
                preparation['jintInputs'] = 'FAIL'
                failure = native['error']
            elif (native['preparation'] != 'PASS' or
                    [item['name'] for item in rows] != [item['name'] for item in node['results']] or
                    native.get('adapterSha256') != node['adapterSha256'] or
                    native['hostInterpreter']['sha256'] != before[str(interpreter)] or native['engineAssembly']['sha256'] != before[str(args.jint_assembly)]):
                raise ValueError('Jint report does not match the Node cases or interpreter inputs')
            else:
                preparation['jintInputs'] = 'PASS'
                tests['jint'] = native['status']
    except (OSError, ValueError, KeyError, TypeError) as error:
        code, failure = code or 1, str(error)
    unchanged = all(Path(name).is_file() and digest(Path(name)) == value for name, value in {**before, **artifacts}.items()) if before else None
    receipt = dict(status='PASS' if not code and unchanged else 'FAIL', exitCode=code or (0 if unchanged else 1), commands=commands,
        sourceMode='local-uncommitted', commit=None, tree=None, caseCount=node['caseCount'] if node else 0,
        node=str(node_path) if node_path.is_file() else None, native=str(native_path) if native_path.is_file() else None,
        preparation=preparation, responsibilities=dict(lint='NOT_RUN', typecheck='NOT_RUN', test=tests, build='NOT_RUN'),
        failure=failure or (f'{commands[-1]["stage"]} exited {code}' if code else None if unchanged else 'Inputs changed'),
        casesSha256=artifacts.get(str(run / 'cases.json')), adapterSha256=artifacts.get(str(run / 'adapter.js')),
        inputs=before, inputsUnchanged=unchanged, scope='Actual bounded Host interpreter component with synthetic vectors',
        installedHost='NOT_RUN', upstreamExecution='NOT_RUN', persistentRetry='NOT_RUN')
    return receipt


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
    receipt = verify_component(repo, args, run, run / 'native-report.json')
    (run / 'receipt.json').write_bytes((json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode())
    print(json.dumps(dict(status=receipt['status'], caseCount=receipt['caseCount'], receipt=str(run / 'receipt.json'))))
    return receipt['exitCode']


if __name__ == '__main__':
    raise SystemExit(main())
