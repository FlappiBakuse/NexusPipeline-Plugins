"""Exercise official Maa C ABI with synthetic resources and a controller that denies input actions."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import time
import zlib
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from managed_probe import compiled_sources, input_fingerprints, record_cases, run_command, test_result
from maa_runtime_package import REQUIRED

OUTPUT_MODES = ("output-native-detail", "output-reject-parameters", "output-quota", "output-cancel",
                "output-cwd-mismatch", "output-resource-parameters", "output-no-scope")


def png():
    def chunk(kind, value):
        return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", zlib.crc32(kind + value))
    pixels = b"".join(b"\0" + bytes((x * 31 + y * 17 + c * 71) % 256 for x in range(64) for c in range(3)) for y in range(64))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 64, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b"")


def fixtures(root):
    for path in [root / "base/pipeline", root / "base/image", root / "overlay/pipeline", root / "unsafe/pipeline", root / "screenshots/pipeline", root / "unsafe-screenshots/pipeline"]:
        path.mkdir(parents=True)
    (root / "base/image/sample.png").write_bytes(png())
    pipeline = {"Success": {"recognition": "DirectHit", "action": "DoNothing"},
                "Start": {"recognition": "DirectHit", "action": "StartApp", "package": "fixture-app"},
                "Stop": {"recognition": "DirectHit", "action": "StopApp", "package": "fixture-app"},
                "Shell": {"recognition": "DirectHit", "action": "Shell", "cmd": "never-execute", "shell_timeout": 1234},
                "Overlay": {"recognition": "DirectHit", "action": "Click", "target": [1, 1, 1, 1]},
                "Click": {"recognition": "DirectHit", "action": "Click", "target": [1, 1, 1, 1]},
                "Wait": {"recognition": "DirectHit", "action": "DoNothing", "pre_delay": 250},
                "Capture": {"recognition": "TemplateMatch", "template": "sample.png", "threshold": 0.8, "action": "DoNothing", "timeout": 1000}}
    (root / "base/pipeline/main.json").write_text(json.dumps(pipeline), encoding="utf-8")
    (root / "overlay/pipeline/main.json").write_text(json.dumps({"Overlay": {"action": "DoNothing"}}), encoding="utf-8")
    (root / "unsafe/pipeline/main.jsonc").write_text('{/*must never execute*/"x":{"action":{"type":"Command","param":{"exec":"not-a-program"}}},}', encoding="utf-8")
    (root / "screenshots/pipeline/main.json").write_text(json.dumps({"Screenshot": {"recognition": "DirectHit", "action": "Screencap", "pre_delay": 0, "post_delay": 0}}), encoding="utf-8")
    (root / "unsafe-screenshots/pipeline/main.json").write_text(json.dumps({"Screenshot": {"recognition": "DirectHit", "action": {"type": "Screencap", "param": {"filename": "../outside"}}}}), encoding="utf-8")


def stage_runtime(runtime, destination, partial):
    required = {"bin/" + name for name in REQUIRED}
    allowed = required | {"bin/MaaAgentServer.dll"}
    records = [item for item in runtime["files"] if item["path"] in allowed]
    paths = {item["path"] for item in records}
    if runtime["status"] != "VERIFIED_BINARY_INPUT_ONLY" or len(paths) != len(records) or not (required if partial else allowed) <= paths:
        raise ValueError("Native runtime receipt does not cover the required closure")
    destination.mkdir(parents=True, exist_ok=True)
    for item in records:
        original = Path(runtime["runtime"]) / item["path"]
        target = destination / original.name
        if not target.exists():
            os.link(original, target)
        with target.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if not os.path.samefile(original, target) or target.stat().st_size != item["sizeBytes"] or digest != item["sha256"]:
            raise ValueError("Native closure identity mismatch: " + item["path"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--runtime-receipt", type=Path)
    mode.add_argument("--resource-inventory", type=Path)
    parser.add_argument("--case", action="append", dest="selected_cases")
    args = parser.parse_args()
    if args.selected_cases and args.resource_inventory:
        parser.error("--case requires --runtime-receipt")
    if args.selected_cases and (len(set(args.selected_cases)) != len(args.selected_cases) or
                               any(not name or name.startswith("output-") for name in args.selected_cases)):
        raise ValueError("Select distinct native cases; output workers remain a separate full-suite qualification")
    root = Path(__file__).resolve().parents[3]
    output = args.output.resolve()
    if output == root or root in output.parents:
        raise ValueError("Output must be outside source repository")
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    fixture = run / "fixture"
    receipt_path = args.runtime_receipt.resolve() if args.runtime_receipt else None
    project = Path(__file__).resolve().with_name("NativeSession.csproj")
    probe = ["dotnet", str(output / "build/bin/NativeSession/release/NativeSession.dll")]
    properties = ["-p:Configuration=Release", "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}",
                  f"-p:RestorePackagesPath={args.cache / 'native-session-packages'}"]
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(args.cache / "dotnet-home"),
               DOTNET_CLI_UI_LANGUAGE="en-US", DOTNET_CLI_TELEMETRY_OPTOUT="1", DOTNET_NOLOGO="1")
    env.pop("NEXUS_NATIVE_CASES", None)
    if args.selected_cases:
        env["NEXUS_NATIVE_CASES"] = json.dumps(args.selected_cases)
    tracked = {Path(__file__).resolve(), project, root / "tests/managed_probe.py", root / "tooling/source_snapshot.py",
               root / "tooling/maa_runtime_package.py"}
    if receipt_path and receipt_path.is_file():
        tracked.add(receipt_path)

    def snapshot(log):
        return input_fingerprints(root, tracked | compiled_sources(root, project, properties, env, run / log))

    commands, cases, inputs = [], [], []
    started = time.monotonic()
    preparation = dict.fromkeys(("runtimeClosure", "fixture", "sourceInventory", "probeCompilation"), "NOT_RUN")
    runtime_sha = preparation_error = input_error = None
    if receipt_path:
        phase = "runtimeClosure"
        try:
            raw = receipt_path.read_bytes()
            runtime_sha = hashlib.sha256(raw).hexdigest()
            stage_runtime(json.loads(raw), output / "runtime/bin", bool(args.selected_cases))
            preparation[phase] = "PASS"
            phase = "fixture"
            fixtures(fixture)
            preparation[phase] = "PASS"
        except (OSError, ValueError, KeyError, TypeError) as error:
            preparation[phase] = "FAIL"
            preparation_error = str(error)
    if preparation["fixture"] == "PASS" or args.resource_inventory:
        try:
            inputs = snapshot("evaluated-inputs.json")
            preparation["sourceInventory"] = "PASS"
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            preparation["sourceInventory"] = "FAIL"
            input_error = str(error)
    if inputs:
        build = ["dotnet", "build", str(project), "--nologo", "--disable-build-servers", "-m:1", *properties]
        commands.append(run_command("preparation", build, run, env, run / "build.log"))
        preparation["probeCompilation"] = "PASS" if commands[-1]["exitCode"] == 0 else "FAIL"

    def test(label, report, extra, cwd, process_env, timeout, expected):
        command = [*probe, str(receipt_path), str(fixture), str(report), *extra]
        record = run_command("test", command, cwd, process_env, run / (label + ".log"), timeout)
        record["scenario"] = label
        commands.append(record)
        cases.extend(record_cases(record, report, fields=("Name", "Status"), expected=expected))

    if preparation["probeCompilation"] == preparation["fixture"] == "PASS":
        test("native", run / "cases.json", [], run, env, 180, args.selected_cases)
        for mode in (() if args.selected_cases else OUTPUT_MODES):
            worker = run / "output-workers" / mode
            nonce = uuid.uuid4().hex
            try:
                worker.mkdir(parents=True)
                (worker / ".fresh-proof").write_text(nonce, encoding="utf-8")
            except OSError as error:
                commands.append({"responsibility": "test", "scenario": mode, "status": "NOT_RUN", "fixtureError": str(error)})
                continue
            worker_env = {**env, "NEXUS_TEST_OUTPUT_PROOF": nonce}
            test(mode, run / (mode + ".json"), [mode], worker, worker_env, 40, [mode])
    audit = {"status": "NOT_RUN"}
    if args.resource_inventory and preparation["probeCompilation"] == "PASS":
        audit_report = run / "native-policy-corpus.json"
        command = [*probe, "resource-audit", str(args.resource_inventory.resolve()), str(audit_report)]
        audit = run_command("evidence", command, run, env, run / "resource-audit.log", 180)
        audit["status"] = "FAIL"
        if audit["exitCode"] == 0:
            try:
                audit.update(status="PASS", report=str(audit_report), sha256=hashlib.sha256(audit_report.read_bytes()).hexdigest())
            except OSError as error:
                audit["reportError"] = str(error)
    unchanged = False
    if inputs:
        try:
            unchanged = inputs == snapshot("evaluated-inputs-after.json")
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            input_error = str(error)
    passed = sum(case["Status"] == "PASS" for case in cases)
    test_status = test_result(commands)
    unique_cases = len({case["Name"] for case in cases}) == len(cases)
    mode_status = audit["status"] if args.resource_inventory else test_status
    report = {"status": "PASS" if mode_status == "PASS" and unchanged and unique_cases else "FAIL",
              "preparation": preparation, "preparationError": preparation_error, "inputError": input_error,
              "resourceAudit": audit,
              "responsibilities": {"lint": "NOT_RUN", "typecheck": "NOT_RUN", "test": test_status, "build": "NOT_RUN"},
              "qualification": "Read-only locked resource policy audit" if args.resource_inventory else
              "Official native C ABI and owned AgentClient/AgentServer child programs with synthetic resources and a NoInput controller",
              "sourceMode": "local-uncommitted", "commit": None, "tree": None, "inputs": inputs,
              "runtimeReceipt": str(receipt_path) if receipt_path else None, "runtimeReceiptSha256": runtime_sha,
              "commands": commands, "cases": len(cases), "passed": passed, "unchanged": unchanged, "uniqueCases": unique_cases,
              "selectedCases": args.selected_cases,
              "coverage": None if args.resource_inventory else "partial" if args.selected_cases else "full",
              "elapsedSeconds": time.monotonic() - started}
    (run / "receipt.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "cases": len(cases), "passed": passed, "receipt": str(run / "receipt.json")}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
