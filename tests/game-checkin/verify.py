"""Compile current pure CheckIn policies and memory editors; no real platform request is executed."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--sdk-receipt", type=Path)
    parser.add_argument("--package-receipt", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    output = args.output.resolve()
    if output == root or root in output.parents:
        raise ValueError("Output must be outside the repository")
    project = root / ("tests/game-checkin/sdk/CheckInSdkProbe.csproj" if args.sdk_receipt else "tests/game-checkin/PolicyProbe.csproj")
    sdk_arguments = []
    sdk_identity = {}
    if args.package_receipt and not args.sdk_receipt:
        raise ValueError("An actual package probe requires its verified SDK producer")
    if args.sdk_receipt:
        sys.path.insert(0, str(root / "tooling"))
        from sdk_inputs import verified_sdk
        sdk_bytes, sdk, package, package_path = verified_sdk(root, args.sdk_receipt)
        sdk_arguments = [f"-p:RestorePackagesPath={args.cache / 'packages' / package['sha256']}", f"-p:RestoreSources={package_path.parent}"]
        sdk_identity = {"contractFingerprint": sdk["contractFingerprint"], "sdkReceipt": str(args.sdk_receipt),
                        "sdkReceiptSha256": hashlib.sha256(sdk_bytes).hexdigest(), "sdkPackage": package}
    sources = list(project.parent.glob("*.cs")) + [project]
    for item in ET.parse(project).iter("Compile"):
        if "Include" not in item.attrib:
            continue
        include = (project.parent / item.attrib["Include"]).as_posix()
        if "**" in include:
            prefix, suffix = include.split("**", 1)
            sources.extend(Path(prefix).rglob("*" + suffix.split("*")[-1]))
        else:
            sources.append(Path(include))
    sources = sorted(set(path.resolve() for path in sources if path.is_file()))
    sha = lambda data: hashlib.sha256(data).hexdigest()
    inputs = [{"path": source.relative_to(root).as_posix(), "sha256": sha(source.read_bytes())} for source in sources]
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    package_argument = []
    if args.package_receipt:
        package_raw = args.package_receipt.read_bytes()
        packed = json.loads(package_raw)
        artifact = Path(packed["artifact"]["path"])
        if packed["status"] != "PASS" or packed["extensionId"] != "game-checkin" or packed["contractFingerprint"] != sdk["contractFingerprint"] or sha(artifact.read_bytes()) != packed["artifact"]["sha256"]:
            raise ValueError("Original package identity differs from the requested producer")
        with zipfile.ZipFile(artifact) as archive:
            members = {item["path"]: item["sha256"] for item in packed["members"]}
            names = archive.namelist()
            if len(names) != len(set(names)) or set(names) != set(members) or any(sha(archive.read(name)) != digest for name, digest in members.items()):
                raise ValueError("Original package member bytes differ")
            manifest = json.loads(archive.read("manifest.json"))
            name = manifest["managed"]["entryAssembly"]
            if manifest["extensionId"] != "game-checkin" or manifest["packageVersion"] != "0.5.0" or manifest["contractFingerprint"] != sdk["contractFingerprint"] or name != "NexusPipeline.Extensions.GameCheckIn.dll":
                raise ValueError("Original entry declaration differs")
            assembly_sha = sha(archive.read(name))
        package_argument = [str(artifact), assembly_sha]
        sdk_identity["originalPackage"] = {"receipt": str(args.package_receipt), "receiptSha256": sha(package_raw), "artifact": packed["artifact"], "assemblySha256": assembly_sha}
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(args.cache / "dotnet-home"),
               DOTNET_CLI_UI_LANGUAGE="en-US", DOTNET_CLI_TELEMETRY_OPTOUT="1")
    commands = []
    command = ["dotnet", "build", str(project), "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1",
               "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}", *sdk_arguments]
    started = time.monotonic()
    result = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=60)
    (run / "build.log").write_bytes((result.stdout + result.stderr).encode())
    commands.append({"command": command, "exitCode": result.returncode})
    cases = []
    if result.returncode == 0:
        assembly = "CheckInSdkProbe" if args.sdk_receipt else "PolicyProbe"
        command = ["dotnet", str(output / f"build/bin/{assembly}/release/{assembly}.dll"), str(run / "cases.json")]
        command.extend(package_argument)
        if not args.sdk_receipt:
            command.append(str(run / "view-fixture.json"))
        result = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=60)
        (run / "native.log").write_bytes((result.stdout + result.stderr).encode())
        commands.append({"command": command, "exitCode": result.returncode})
        if (run / "cases.json").exists():
            cases = json.loads((run / "cases.json").read_bytes())
    unchanged = all(sha((root / item["path"]).read_bytes()) == item["sha256"] for item in inputs)
    report = {"status": "PASS" if cases and all(item["status"] == "PASS" for item in cases) and unchanged and all(item["exitCode"] == 0 for item in commands) else "FAIL",
              "scope": "Actual SDK components and original ZIP assembly entry with fake Host ports; not installed Host, actual DPAPI, login or check-in qualification" if args.package_receipt else "Actual SDK DTO/persistence adapter components with fake Host ports; not installed Host, actual DPAPI, login or check-in qualification" if args.sdk_receipt else "Pure platform/task/editor/HTTP-format policies with synthetic responses and fake network; not SDK, installed assembly, login or check-in qualification",
              "sourceMode": "local-uncommitted", "commit": None, "tree": None, "compiledInputs": inputs,
              "sourceHash": sha(json.dumps(inputs, separators=(",", ":")).encode()), "commands": commands,
              "runner": {"path": Path(__file__).relative_to(root).as_posix(), "sha256": sha(Path(__file__).read_bytes()), "command": [sys.executable, *sys.argv]},
              "cases": len(cases), "passed": sum(item["status"] == "PASS" for item in cases), "elapsedSeconds": time.monotonic() - started, **sdk_identity}
    (run / "receipt.json").write_bytes((json.dumps(report, indent=2) + "\n").encode())
    print(json.dumps({"status": report["status"], "cases": report["cases"], "passed": report["passed"], "receipt": str(run / "receipt.json")}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
