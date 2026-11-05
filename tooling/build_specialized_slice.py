"""Freeze and syntax-check the independently authored specialized SDK slice."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time
from sdk_inputs import verified_sdk
from source_snapshot import snapshot, sha, encode, external_directory
from generate_adapter import assemble_adapter
from localization import project_metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extension", choices=["baah", "bettergi", "maaend", "maas", "march7th", "oknte", "okww", "zzzonedragon"], required=True)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = external_directory(root, args.output)
    raw, sdk, package, _ = verified_sdk(root, args.sdk_receipt)
    source = snapshot(root, output)
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    (run / "sdk-consumer-receipt.json").write_bytes(raw)
    plugin = Path(source["exportRoot"]) / "plugins/specialized" / args.extension
    manifest = {"format": "nexus.extension.manifest", "version": 1, "sdkVersion": "0.1.0",
        "contractFingerprint": sdk["contractFingerprint"], **json.loads((plugin / "extension.json").read_bytes())}
    manifest = project_metadata(plugin, manifest)
    if manifest["extensionId"] != args.extension or manifest["packageVersion"] != "0.5.0" or manifest["kind"] != "data-specialized" or manifest["sdkVersion"] != "0.1.0" or manifest["contractFingerprint"] != sdk["contractFingerprint"]:
        raise ValueError("Specialized slice differs from the fixed target or SDK")
    entry = manifest["specialized"]["adapterEntry"]
    if entry != "adapter/main.js": raise ValueError("Unknown specialized slice entry")
    script_bytes, inputs = assemble_adapter(plugin)
    script = run / "adapter.js"
    script.write_bytes(script_bytes)
    command = ["node", "--check", str(script)]
    started = time.monotonic()
    result = subprocess.run(command, cwd=plugin, capture_output=True, encoding="utf-8", errors="replace")
    (run / "native.log").write_bytes((result.stdout + result.stderr).encode())
    manifest_path, script_path = run / "extension.manifest.json", run / "adapter.js"
    manifest_path.write_bytes(encode(manifest))
    script_path.write_bytes(script_bytes)
    receipt = {"status": "PASS" if result.returncode == 0 else "FAIL",
        "scope": "Source-bound specialized SDK slice syntax check; actual Host interpreter and business validation are separate",
        "source": source, "sdkReceiptSha256": sha(raw), "sdkHostSource": sdk["hostSource"], "sdkPackage": package,
        "contractFingerprint": sdk["contractFingerprint"], "command": command, "exitCode": result.returncode,
        "generatorInputs": inputs,
        "elapsedSeconds": time.monotonic() - started, "nativeLog": str(run / "native.log"),
        "manifest": {"path": str(manifest_path), "sha256": sha(manifest_path.read_bytes())},
        "script": {"path": str(script_path), "sha256": sha(script_path.read_bytes()), "sizeBytes": script_path.stat().st_size}}
    (run / "build-receipt.json").write_bytes(encode(receipt))
    print(json.dumps({"status": receipt["status"], "receipt": str(run / "build-receipt.json")}))
    return result.returncode


if __name__ == "__main__": raise SystemExit(main())
