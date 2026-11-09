"""Run managed component cases with source-bound evidence and any required SDK."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tooling"))
from sdk_inputs import verified_sdk
from source_snapshot import sha


def compiled_sources(root, project, properties, env, evidence):
    command = ["dotnet", "msbuild", str(project), "--nologo", "-getItem:Compile,ProjectReference",
               "-getProperty:MSBuildAllProjects", *properties]
    result = subprocess.run(command, cwd=root, env=env, capture_output=True,
                            encoding="utf-8", errors="replace", timeout=90)
    evidence.write_text(result.stdout, encoding="utf-8")
    evidence.with_suffix(".stderr.log").write_text(result.stderr, encoding="utf-8")
    result.check_returncode()
    evaluated = json.loads(result.stdout)
    if evaluated["Items"]["ProjectReference"]:
        raise ValueError("Compiler probe project references require an explicit transitive input owner")
    paths = {Path(item["FullPath"]).resolve(strict=True) for item in evaluated["Items"]["Compile"]}
    if not paths:
        raise ValueError("Compiler probe has no evaluated sources")
    for name in evaluated["Properties"]["MSBuildAllProjects"].split(";"):
        if name and root in Path(name).resolve().parents:
            paths.add(Path(name).resolve(strict=True))
    for path in paths:
        if root not in path.parents or path.is_symlink() or path.is_junction():
            raise ValueError("Compiler probe input escaped its repository")
    return paths


def input_fingerprints(root, paths):
    return [{"path": (file.relative_to(root) if file.is_relative_to(root) else file).as_posix(),
             "sha256": sha(file.read_bytes())} for file in sorted(paths)]


def run_command(responsibility, command, cwd, env, log, timeout=90):
    try:
        result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        result = subprocess.CompletedProcess(command, 124, error.stdout or b'', (error.stderr or b'') + b'\nmanaged_probe_timeout\n')
    except OSError as error:
        result = subprocess.CompletedProcess(command, 1, b'', str(error).encode("utf-8"))
    log.write_bytes(result.stdout + result.stderr)
    return {"responsibility": responsibility, "command": command, "cwd": str(cwd), "exitCode": result.returncode}


def record_cases(record, report, *, fields=("name", "status"), expected=None):
    record.update(status="NOT_RUN", cases=0, passed=0)
    name, status = fields
    try:
        rows = json.loads(report.read_bytes())
        if not isinstance(rows, list) or not rows or any(
                not isinstance(row, dict) or row.get(status) not in ("PASS", "FAIL") or not isinstance(row.get(name), str) for row in rows):
            raise ValueError("Invalid managed probe case results")
        names = [row[name] for row in rows]
        if expected is not None and sorted(names) != sorted(expected):
            raise ValueError("Managed probe case results differ from the selection")
        passed = sum(row[status] == "PASS" for row in rows)
        if record["exitCode"] != int(passed != len(rows)):
            raise ValueError("Managed probe case results do not match the exit status")
        record.update(status="PASS" if passed == len(rows) else "FAIL", cases=len(rows), passed=passed)
        return rows
    except (OSError, ValueError) as error:
        record["caseReportError"] = str(error)
        return []


def test_result(commands):
    statuses = {command["status"] for command in commands if command["responsibility"] == "test"}
    return "FAIL" if "FAIL" in statuses else "PASS" if statuses == {"PASS"} else "NOT_RUN"


def verify_probe(root, args, project, files, scenarios, scope, *, input_field="inputs", evaluated=False,
                 sdk_input=None, evidence=None):
    output = args.output.resolve()
    if output.is_relative_to(root):
        raise ValueError("Probe output must be outside the repository")
    files = [*files, project, Path(__file__), root / "tooling/source_snapshot.py"]
    properties = ["-p:Configuration=Release", "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}"]
    sdk_assembly, sdk_identity = None, {}
    if args.sdk_receipt:
        sdk_raw, sdk, package, package_path = sdk_input or verified_sdk(root, args.sdk_receipt)
        with ZipFile(package_path) as archive:
            sdk_assembly = archive.read("lib/net10.0/NexusPipeline.Extensibility.dll")
        properties += [f"-p:RestorePackagesPath={args.cache / 'packages' / package['sha256']}", f"-p:RestoreSources={package_path.parent}"]
        files += [root / "tooling/sdk_inputs.py", root / "contracts/sdk-source-lock.json"]
        sdk_identity = {"contractFingerprint": sdk["contractFingerprint"], "sdkReceipt": str(args.sdk_receipt),
                        "sdkReceiptSha256": sha(sdk_raw), "sdkPackage": package}
    sources = {file.resolve() for file in files}
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    env = {**os.environ, "TEMP": str(run), "TMP": str(run), "DOTNET_CLI_HOME": str(args.cache / "dotnet-home"),
           "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_CLI_UI_LANGUAGE": "en-US", "DOTNET_NOLOGO": "1"}
    commands, cases = [], []
    started = time.monotonic()

    def snapshot(log):
        observed = sources | compiled_sources(root, project, properties, env, run / log) if evaluated else sources
        return input_fingerprints(root, observed)

    inputs, input_error = [], None
    try:
        inputs = snapshot("evaluated-inputs.json")
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        input_error = str(error)
    build = ["dotnet", "build", str(project), "--nologo", "--disable-build-servers", "-m:1", *properties]
    build_code = None
    if inputs:
        commands.append(run_command("preparation", build, root, env, run / "build.log"))
        build_code = commands[-1]["exitCode"]
    probe = output / "build/bin" / project.stem / "release"
    assembly = probe / "NexusPipeline.Extensibility.dll"
    current_sdk = sdk_assembly is not None and build_code == 0 and assembly.is_file() and assembly.read_bytes() == sdk_assembly
    if build_code == 0 and (sdk_assembly is None or current_sdk):
        for label, arguments in scenarios:
            report = run / (f"{label}-cases.json" if label else "cases.json")
            command = ["dotnet", str(probe / (project.stem + ".dll")), *arguments, str(report)]
            log = run / (f"{label}.log" if label else "native.log")
            record = run_command("test", command, root, env, log)
            commands.append(record)
            cases.extend(record_cases(record, report))

    unchanged = False
    if inputs:
        try:
            unchanged = inputs == snapshot("evaluated-inputs-after.json")
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            input_error = str(error)
    test = test_result(commands)
    case_error = next((command["caseReportError"] for command in commands if "caseReportError" in command), None)
    status = "PASS" if test == "PASS" and unchanged else "FAIL"
    receipt = {"status": status, "preparation": {"probeCompilation": "NOT_RUN" if build_code is None else "FAIL" if build_code else "PASS",
                                                "sdkAssembly": "NOT_RUN" if build_code != 0 or sdk_assembly is None else "PASS" if current_sdk else "FAIL"},
               "responsibilities": {"lint": "NOT_RUN", "typecheck": "NOT_RUN", "test": test, "build": "NOT_RUN"},
               "scope": scope, "sourceMode": "local-uncommitted", "commit": None, "tree": None, input_field: inputs,
               "sourceHash": sha(json.dumps(inputs, separators=(",", ":")).encode()), "unchanged": unchanged,
               **sdk_identity, **(evidence or {}), "exactSdkAssembly": current_sdk,
               "commands": commands, "inputError": input_error, "caseReportError": case_error, "elapsedSeconds": time.monotonic() - started,
               "cases": len(cases), "passed": sum(case["status"] == "PASS" for case in cases)}
    path = run / "receipt.json"
    path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": status, "cases": receipt["cases"], "passed": receipt["passed"], "receipt": str(path)}))
    return 0 if status == "PASS" else 1
