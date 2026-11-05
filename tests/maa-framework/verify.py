"""Compile the current frozen-memory Maa compiler; no native process, device or game is started."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def compiled_sources(root, project, properties, env, evidence):
    command = ["dotnet", "msbuild", str(project), "--nologo", "-getItem:Compile,ProjectReference",
               "-getProperty:MSBuildAllProjects", *properties]
    result = subprocess.run(command, cwd=root, env=env, capture_output=True,
                            encoding="utf-8", errors="replace", timeout=90)
    evidence.write_text(result.stdout, encoding="utf-8")
    evidence.with_suffix('.stderr.log').write_text(result.stderr, encoding="utf-8")
    result.check_returncode()
    evaluated = json.loads(result.stdout)
    if evaluated["Items"]["ProjectReference"]:
        raise ValueError("Compiler probe project references require an explicit transitive input owner")
    paths = {Path(item["FullPath"]).resolve(strict=True) for item in evaluated["Items"]["Compile"]}
    if not paths:
        raise ValueError("Compiler probe has no evaluated sources")
    paths.update([project, Path(__file__).resolve()])
    for name in evaluated["Properties"]["MSBuildAllProjects"].split(";"):
        if name and root in Path(name).resolve().parents:
            paths.add(Path(name).resolve(strict=True))
    for path in paths:
        if root not in path.parents or path.is_symlink() or path.is_junction():
            raise ValueError("Compiler probe input escaped its repository")
    return sorted(paths)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    parser.add_argument("--corpus", type=Path, help="Optional explicitly supplied local data corpus; never required by the source build or normal fixture tests")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(root / "tooling"))
    from sdk_inputs import verified_sdk
    sdk_bytes, sdk, package, package_path = verified_sdk(root, args.sdk_receipt)
    output = args.output.resolve()
    if output == root or root in output.parents:
        raise ValueError("Output must be outside source repository")
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(args.cache / "dotnet-home"),
               DOTNET_CLI_UI_LANGUAGE="en-US", DOTNET_CLI_TELEMETRY_OPTOUT="1", DOTNET_NOLOGO="1")
    project = root / "tests/maa-framework/CompilerProbe.csproj"
    properties = ["-p:Configuration=Release", "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}",
                  f"-p:RestorePackagesPath={args.cache / 'packages' / package['sha256']}", f"-p:RestoreSources={package_path.parent}"]
    sources = compiled_sources(root, project, properties, env, run / 'evaluated-inputs.json')
    inputs = [{"path": source.relative_to(root).as_posix(), "sha256": sha(source)} for source in sources]
    commands = []
    started = time.monotonic()
    command = ["dotnet", "build", str(project), "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1",
               *properties]
    result = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=90)
    (run / "build.log").write_bytes((result.stdout + result.stderr).encode())
    commands.append({"command": command, "exitCode": result.returncode})
    cases = []
    if result.returncode == 0:
        command = ["dotnet", str(output / "build/bin/CompilerProbe/release/CompilerProbe.dll"), str(run / "cases.json")]
        if args.corpus:
            command.append(str(args.corpus.resolve()))
        result = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=90)
        (run / "native.log").write_bytes((result.stdout + result.stderr).encode())
        commands.append({"command": command, "exitCode": result.returncode})
        if (run / "cases.json").exists():
            cases = json.loads((run / "cases.json").read_bytes())
    unchanged = compiled_sources(root, project, properties, env, run / 'evaluated-inputs-after.json') == sources and all(sha(root / item["path"]) == item["sha256"] for item in inputs)
    status = "PASS" if cases and all(case["status"] == "PASS" for case in cases) and unchanged and all(command["exitCode"] == 0 for command in commands) else "FAIL"
    report = {"status": status, "qualification": "Pure frozen-memory PI/import compiler with synthetic source fixtures; not Host/Jint/native/Agent/GUI qualification",
              "sourceMode": "local-uncommitted", "commit": None, "tree": None, "compiledInputs": inputs, "commands": commands,
              "sdkReceipt": str(args.sdk_receipt.resolve()), "sdkReceiptSha256": sha(args.sdk_receipt), "sdkFingerprint": sdk["contractFingerprint"],
              "cases": len(cases), "passed": sum(case["status"] == "PASS" for case in cases), "elapsedSeconds": time.monotonic() - started}
    (run / "receipt.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "cases": report["cases"], "passed": report["passed"], "receipt": str(run / "receipt.json")}))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
