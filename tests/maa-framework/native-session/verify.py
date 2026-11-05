"""Exercise official Maa C ABI with synthetic resources and a controller that denies input actions."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import time
import zlib
import uuid


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--runtime-receipt", type=Path, required=True)
    parser.add_argument("--resource-inventory", type=Path)
    parser.add_argument("--case", action="append", dest="selected_cases")
    args = parser.parse_args()
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
    fixtures(fixture)
    runtime = json.loads(args.runtime_receipt.read_bytes())
    runtime_root = output / "runtime/bin"
    runtime_root.mkdir(parents=True, exist_ok=True)
    required = {"MaaFramework.dll", "MaaCustomControlUnit.dll", "MaaUtils.dll", "opencv_world4_maa.dll", "fastdeploy_ppocr_maa.dll",
                "onnxruntime_maa.dll", "webgpu_dawn_maa.dll", "DirectML.dll", "dxcompiler.dll", "dxil.dll", "MaaAgentClient.dll", "MaaAgentServer.dll"}
    for item in runtime["files"]:
        if item["path"] not in {"bin/" + name for name in required}:
            continue
        original = Path(runtime["runtime"]) / item["path"]
        destination = runtime_root / original.name
        if not destination.exists():
            os.link(original, destination)
        if not os.path.samefile(original, destination) or hashlib.sha256(destination.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError("Native closure identity mismatch")
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    project = Path(__file__).with_name("NativeSession.csproj")
    source_root = root / "plugins/managed/maa-framework/src"
    names = ["Application/IMaaController.cs", "Application/IMaaOutputScope.cs", "Application/MaaScreencapPolicy.cs", "Application/MaaSessionPlan.cs",
             "Application/MaaPipelineGuard.cs", "Application/MaaTaskSession.cs", "Application/MaaTaskPayload.cs", "Infrastructure/MaaNative.cs", "Infrastructure/MaaNativePath.cs",
             "Infrastructure/MaaControllerBridge.cs", "Infrastructure/MaaNativeQueries.cs", "Infrastructure/MaaWaitBridge.cs", "Infrastructure/MaaAgentNative.cs",
             "Infrastructure/MaaInputLease.cs", "Infrastructure/MaaProgramProcess.cs", "Application/MaaAgentSession.cs", "Domain/MaaJson.cs", "Domain/MaaWaitPolicy.cs"]
    sources = [source_root / name for name in names] + sorted(Path(__file__).parent.glob("*.cs")) + [project, Path(__file__)]
    inputs = [{"path": source.relative_to(root).as_posix(), "sha256": sha(source)} for source in sources]
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(args.cache / "dotnet-home"),
               DOTNET_CLI_UI_LANGUAGE="en-US", DOTNET_CLI_TELEMETRY_OPTOUT="1")
    env.pop("NEXUS_NATIVE_CASES", None)
    if args.selected_cases:
        env["NEXUS_NATIVE_CASES"] = json.dumps(args.selected_cases)
    command = ["dotnet", "build", str(project), "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1",
               "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}", f"-p:RestorePackagesPath={args.cache / 'native-session-packages'}"]
    commands = []
    started = time.monotonic()
    result = subprocess.run(command, cwd=run, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=90)
    (run / "build.log").write_text(result.stdout + result.stderr, encoding="utf-8")
    commands.append({"command": command, "exitCode": result.returncode})
    cases = []
    if result.returncode == 0:
        command = ["dotnet", str(output / "build/bin/NativeSession/release/NativeSession.dll"), str(args.runtime_receipt.resolve()), str(fixture), str(run / "cases.json")]
        if args.resource_inventory:
            command.append(str(args.resource_inventory.resolve()))
        try:
            result = subprocess.run(command, cwd=run, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=180)
            (run / "native.log").write_text(result.stdout + result.stderr, encoding="utf-8")
            commands.append({"command": command, "exitCode": result.returncode})
        except subprocess.TimeoutExpired as failure:
            (run / "native.log").write_bytes((failure.stdout or b"") + (failure.stderr or b""))
            commands.append({"command": command, "exitCode": None, "status": "TIMEOUT"})
        if (run / "cases.json").exists():
            cases = json.loads((run / "cases.json").read_bytes())
        for mode in ([] if args.selected_cases else ["output-native-detail", "output-reject-parameters", "output-quota", "output-cancel", "output-cwd-mismatch", "output-resource-parameters", "output-no-scope"]):
            worker = run / "output-workers" / mode
            worker.mkdir(parents=True)
            nonce = uuid.uuid4().hex
            (worker / ".fresh-proof").write_text(nonce, encoding="utf-8")
            worker_env = {**env, "NEXUS_TEST_OUTPUT_PROOF": nonce}
            result_path = run / (mode + ".json")
            command = ["dotnet", str(output / "build/bin/NativeSession/release/NativeSession.dll"), str(args.runtime_receipt.resolve()), str(fixture), str(result_path), mode]
            result = subprocess.run(command, cwd=worker, env=worker_env, capture_output=True, encoding="utf-8", errors="replace", timeout=40)
            (run / (mode + ".log")).write_text(result.stdout + result.stderr, encoding="utf-8")
            commands.append({"command": command, "cwd": str(worker), "exitCode": result.returncode,
                             "qualification": "Parent-controlled synthetic child process; not actual Host Native Job/Agent-family admission"})
            if result_path.exists():
                cases.extend(json.loads(result_path.read_bytes()))
    unchanged = all(sha(root / item["path"]) == item["sha256"] for item in inputs)
    passed = sum(case["Status"] == "PASS" for case in cases)
    expected = len(args.selected_cases) if args.selected_cases else 46
    selected_match = not args.selected_cases or sorted(case["Name"] for case in cases) == sorted(args.selected_cases)
    report = {"status": "PASS" if len(cases) == expected and passed == expected and selected_match and unchanged and all(item["exitCode"] == 0 for item in commands) else "FAIL",
              "qualification": "Official native C ABI and actual owned AgentClient/AgentServer child programs; synthetic resources and NoInput controller; not actual Host worker/IPC/target/game execution",
              "sourceMode": "local-uncommitted", "commit": None, "tree": None, "inputs": inputs,
              "runtimeReceipt": str(args.runtime_receipt.resolve()), "runtimeReceiptSha256": sha(args.runtime_receipt),
              "commands": commands, "cases": len(cases), "passed": passed, "unchanged": unchanged, "expectedCases": expected,
              "selectedCases": args.selected_cases, "coverage": "partial" if args.selected_cases else "full",
              "elapsedSeconds": time.monotonic() - started}
    (run / "receipt.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "cases": len(cases), "passed": passed, "receipt": str(run / "receipt.json")}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
