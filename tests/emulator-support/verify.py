"""Compile and execute vendor policies with synthetic Host resources; no vendor program is launched."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tooling"))
from sdk_inputs import verified_sdk


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    sdk_raw, sdk, package, package_path = verified_sdk(root, args.sdk_receipt)
    output = args.output.resolve()
    if output == root or root in output.parents:
        raise ValueError("Output must be outside the repository")
    files = sorted([*root.joinpath("plugins/managed/emulator-support/src").rglob("*.cs"),
                    *root.joinpath("tests/emulator-support").glob("*.cs"), root / "tests/emulator-support/EmulatorProbe.csproj"])
    digest = lambda data: hashlib.sha256(data).hexdigest()
    inputs = [{"path": str(file.relative_to(root)).replace("\\", "/"), "sha256": digest(file.read_bytes())} for file in files]
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(args.cache / "dotnet-home"),
               DOTNET_CLI_TELEMETRY_OPTOUT="1", DOTNET_CLI_UI_LANGUAGE="en-US")
    commands, cases = [], []
    started = time.monotonic()
    build = ["dotnet", "build", str(root / "tests/emulator-support/EmulatorProbe.csproj"), "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1",
             "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}",
             f"-p:RestorePackagesPath={args.cache / 'packages' / package['sha256']}", f"-p:RestoreSources={package_path.parent}"]
    for command, log in [(build, "build.log"), (["dotnet", str(output / "build/bin/EmulatorProbe/release/EmulatorProbe.dll"), str(run / "cases.json")], "native.log")]:
        result = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=60)
        (run / log).write_text(result.stdout + result.stderr, encoding="utf-8", newline="\n")
        commands.append({"command": command, "exitCode": result.returncode})
        if result.returncode:
            break
    if (run / "cases.json").is_file():
        cases = json.loads((run / "cases.json").read_bytes())
    unchanged = all(digest((root / item["path"]).read_bytes()) == item["sha256"] for item in inputs)
    assembly = output / "build/bin/EmulatorProbe/release/NexusPipeline.Extensibility.dll"
    with zipfile.ZipFile(package_path) as archive:
        current_sdk = assembly.is_file() and digest(assembly.read_bytes()) == digest(archive.read("lib/net10.0/NexusPipeline.Extensibility.dll"))
    receipt = {"status": "PASS" if cases and all(case["status"] == "PASS" for case in cases) and all(command["exitCode"] == 0 for command in commands) and unchanged and current_sdk else "FAIL",
               "scope": "Current production vendor parsing, selection and session code compiled against the exact packaged SDK, using synthetic Host inventory, tool, ADB and media scopes; not installed-provider or actual vendor qualification",
               "sdkReceiptSha256": digest(sdk_raw), "sdkPackage": package, "contractFingerprint": sdk["contractFingerprint"],
               "exactSdkAssembly": current_sdk, "elapsedSeconds": time.monotonic() - started,
               "sourceMode": "local-uncommitted", "commit": None, "tree": None, "compiledInputs": inputs,
               "sourceHash": digest(json.dumps(inputs, separators=(",", ":")).encode()), "commands": commands,
               "cases": len(cases), "passed": sum(case["status"] == "PASS" for case in cases), "unchanged": unchanged}
    (run / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": receipt["status"], "cases": receipt["cases"], "passed": receipt["passed"], "receipt": str(run / "receipt.json")}))
    return 0 if receipt["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
