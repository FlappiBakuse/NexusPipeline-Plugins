"""Run source-derived GameActivities components against one verified production SDK package."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-fields", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    output = args.output.resolve()
    if output == root or root in output.parents:
        raise ValueError("Probe output must be outside the repository")
    receipt = json.loads(args.sdk_receipt.read_bytes())
    # The producer receipt owns both independently exercised consumers and the exact package bytes.
    package = next((item for item in receipt.get("packages", []) if item["path"].endswith(".nupkg")), None)
    if package is None:
        raise ValueError("SDK producer package descriptor unavailable")
    package_path = Path(package["path"])
    if receipt["status"] != "PASS" or sha(package_path.read_bytes()) != package["sha256"]:
        raise ValueError("SDK package qualification differs")
    lock = json.loads((root / "contracts/sdk-source-lock.json").read_bytes())
    if lock["contractFingerprint"] != receipt["contractFingerprint"]:
        raise ValueError("SDK mirror differs from producer")
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(args.cache / "dotnet-home"),
               DOTNET_CLI_UI_LANGUAGE="en-US", DOTNET_CLI_TELEMETRY_OPTOUT="1")
    command = ["dotnet", "build", str(root / "tests/game-activities/ActivityProbe.csproj"), "--configuration", "Release",
               "--nologo", "--disable-build-servers", "-m:1", "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}",
               f"-p:RestorePackagesPath={args.cache / 'packages' / package['sha256']}", f"-p:RestoreSources={package_path.parent}"]
    started = time.monotonic()
    results = []
    built = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace")
    (run / "build.log").write_text(built.stdout + built.stderr, encoding="utf-8")
    results.append({"command": command, "exitCode": built.returncode})
    if built.returncode == 0:
        sources = [("fixtures", root / "tests/game-activities/fixtures")]
        if args.source_fields:
            sources.append(("actual-source-fields", args.source_fields))
        for label, directory in sources:
            command = ["dotnet", str(output / "build/bin/ActivityProbe/release/ActivityProbe.dll"), str(directory), str(run / f"{label}-cases.json")]
            result = subprocess.run(command, cwd=root, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=60)
            (run / f"{label}.log").write_text(result.stdout + result.stderr, encoding="utf-8")
            cases = json.loads((run / f"{label}-cases.json").read_bytes()) if (run / f"{label}-cases.json").exists() else []
            results.append({"command": command, "exitCode": result.returncode, "cases": len(cases),
                            "passed": sum(case["status"] == "PASS" for case in cases)})
    files = sorted(file for folder in [root / "plugins/managed/game-activities", root / "tests/game-activities"]
                   for file in folder.rglob("*") if file.is_file())
    inputs = [{"path": file.relative_to(root).as_posix(), "sha256": sha(file.read_bytes())} for file in files]
    report = {"status": "PASS" if len(results) > 1 and all(item["exitCode"] == 0 and ("cases" not in item or item["cases"] > 0 and item["passed"] == item["cases"]) for item in results) else "FAIL",
              "scope": "Source-derived business and actual SDK DTO/dispatch components with fake Host ports; not installed Host/real HTTP qualification",
              "sourceMode": "local-uncommitted", "commit": None, "tree": None, "inputs": inputs,
              "sourceHash": sha(json.dumps(inputs, separators=(",", ":")).encode()), "contractFingerprint": lock["contractFingerprint"],
              "sdkReceipt": str(args.sdk_receipt), "sdkReceiptSha256": sha(args.sdk_receipt.read_bytes()), "sdkPackage": package,
              "commands": results, "elapsedSeconds": time.monotonic() - started}
    (run / "receipt.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "receipt": str(run / "receipt.json"), "commands": results}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
