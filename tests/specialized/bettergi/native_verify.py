"""Run source-derived BetterGI cases through the exact production bounded Host interpreter."""
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
    parser.add_argument('--host-root', type=Path, required=True)
    parser.add_argument('--jint-assembly', type=Path, required=True)
    parser.add_argument('--acornima-assembly', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    output, host = args.output.resolve(), args.host_root.resolve()
    repo = source.parents[2]
    if output.is_relative_to(repo) or not args.output.is_absolute():
        raise ValueError('Explicit external output directory required')
    output.mkdir(parents=True, exist_ok=True)
    native = output / 'native'
    native.mkdir(exist_ok=True)
    interpreter = host / 'src/platform/Extensions/BoundedTaskScript.cs'
    inputs = [interpreter, args.jint_assembly.resolve(strict=True), args.acornima_assembly.resolve(strict=True),
              source / 'NativeProbe.cs', source / 'NativeProbe.csproj', source / 'verify.mjs',
              source / 'cases.mjs', source / 'stream-cases.mjs', source.parent / 'assemble.py',
              repo / 'tooling/generate_adapter.py', repo / 'tooling/localization.py']
    before = {str(path): digest(path) for path in inputs}
    environment = os.environ.copy()
    environment.update(DOTNET_CLI_HOME=str(native / 'dotnet-home'), DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1',
                       DOTNET_GENERATE_ASPNET_CERTIFICATE='false', DOTNET_CLI_TELEMETRY_OPTOUT='1',
                       NUGET_PACKAGES=str(native / 'nuget'), TEMP=str(output / 'tmp'), TMP=str(output / 'tmp'))
    (output / 'tmp').mkdir(exist_ok=True)
    commands = []

    def run(label, command):
        started = time.monotonic()
        result = subprocess.run(command, cwd=repo, capture_output=True, env=environment)
        log = native / (label + '.log')
        log.write_bytes(result.stdout + result.stderr)
        commands.append({'command': command, 'exitCode': result.returncode, 'elapsedSeconds': time.monotonic() - started,
                         'nativeLog': str(log), 'nativeLogSha256': digest(log)})
        return result.returncode

    code = run('node-cases', ['node', str(source / 'verify.mjs'), '--output', str(output)])
    if not code:
        code = run('build', ['dotnet', 'build', str(source / 'NativeProbe.csproj'), '--artifacts-path', str(native / 'build'),
                            '--disable-build-servers', '-p:HostSourceRoot=' + str(host),
                            '-p:JintAssemblyPath=' + str(inputs[1]), '-p:AcornimaAssemblyPath=' + str(inputs[2]),
                            '-p:UseSharedCompilation=false'])
    if not code:
        code = run('probe', ['dotnet', str(native / 'build/bin/NativeProbe/debug/NativeProbe.dll'),
                            str(output / 'adapter.js'), str(output / 'cases.json'), str(native / 'report.json'), str(interpreter)])
    unchanged = before == {str(path): digest(path) for path in inputs}
    status = 'PASS' if not code and unchanged else 'FAIL'
    receipt = {'status': status, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'commands': commands,
               'componentSourceAndAssemblies': before, 'inputsUnchanged': unchanged,
               'casesSha256': digest(output / 'cases.json'), 'adapterSha256': digest(output / 'adapter.js'),
               'scope': 'Actual production Host interpreter component; synthetic four-phase requests; no installed/runtime qualification',
               'installedHost': 'NOT_RUN', 'upstreamBinary': 'NOT_RUN', 'persistentRetry': 'NOT_RUN'}
    (native / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': status, 'receipt': str(native / 'receipt.json')}))
    return code or (0 if unchanged else 1)


if __name__ == '__main__':
    raise SystemExit(main())
