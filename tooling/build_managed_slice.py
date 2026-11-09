"""Compile one managed slice against an explicitly verified local SDK package."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import time
from source_snapshot import snapshot, sha, encode, external_directory
from sdk_inputs import verified_sdk
from managed_worker import build_worker
from slice_inputs import managed_inputs
from slice_cache import reusable_build, artifact_records, save_result
from localization import project_metadata
from generate_adapter import assemble_adapter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extension", choices=["custom-wallpaper", "emulator-support", "game-activities",
                                              "live-screenshot", "maa-framework", "game-checkin"], required=True)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = external_directory(root, args.output)
    sdk_bytes, sdk, package, package_path = verified_sdk(root, args.sdk_receipt)
    source = snapshot(root, output)
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True)
    (run / "sdk-consumer-receipt.json").write_bytes(sdk_bytes)
    plugin = Path(source["exportRoot"]) / "plugins/managed" / args.extension
    projects = list(plugin.glob("*.csproj"))
    if len(projects) != 1:
        raise ValueError("Managed slice must have one explicit project")
    manifest = {"format": "nexus.extension.manifest", "version": 1, "sdkVersion": "0.1.0",
                "contractFingerprint": sdk["contractFingerprint"], **json.loads((plugin / "extension.json").read_bytes())}
    manifest = project_metadata(plugin, manifest)
    if manifest["extensionId"] != args.extension or manifest["packageVersion"] != "0.5.0" or manifest["sdkVersion"] != "0.1.0" or manifest["contractFingerprint"] != sdk["contractFingerprint"]:
        raise ValueError("Managed slice identity differs from the fixed target")
    cache = output / "cache"
    env = os.environ.copy()
    env.update(TEMP=str(run), TMP=str(run), DOTNET_CLI_HOME=str(cache / "dotnet-home"),
               DOTNET_CLI_UI_LANGUAGE="en-US", DOTNET_CLI_TELEMETRY_OPTOUT="1")
    command = ["dotnet", "build", str(projects[0]), "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1",
               "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}",
               f"-p:RestorePackagesPath={cache / 'packages' / package['sha256']}", f"-p:RestoreSources={package_path.parent}"]
    start = time.monotonic()
    component = managed_inputs(Path(source['exportRoot']), plugin, source, package, manifest, env)
    previous = reusable_build(output, args.extension, component)
    if previous is None:
        result = subprocess.run(command, cwd=plugin, env=env, capture_output=True, encoding="utf-8", errors="replace")
        exit_code = result.returncode
        native_output = result.stdout + result.stderr
    else:
        exit_code = 0
        native_output = 'Managed compilation reused after component and artifact verification.\n'
    (run / "native.log").write_bytes(native_output.encode())
    responsibilities = dict(lint="NOT_RUN", typecheck="NOT_RUN", test="NOT_RUN", build="FAIL")
    receipt = {"scope": "Managed slice compilation only; not a plugin package or runtime acceptance",
               "source": source, "sdkReceiptSha256": sha(sdk_bytes), "sdkHostSource": sdk["hostSource"], "sdkPackage": package,
               "contractFingerprint": sdk["contractFingerprint"], "command": command if previous is None else None, "mainExitCode": exit_code,
               "componentInputs": component, "reusedCompilation": previous[1] if previous else None,
               "nativeLog": str(run / "native.log"), "responsibilities": responsibilities}
    worker = None
    try:
        if exit_code == 0:
            worker = previous[0].get('worker') if previous else build_worker(
                plugin, manifest, output, cache / "packages" / package["sha256"], package_path, env, run)
            if worker is not None:
                receipt["worker"] = worker
                exit_code = worker["build"]["exitCode"]
        responsibilities["typecheck"] = "FAIL" if exit_code else "PASS"
        if not exit_code and worker is not None and worker["status"] != "PASS":
            raise ValueError(worker["error"])
        if exit_code == 0:
            assembly = output / "build/bin" / projects[0].stem / "release" / manifest["managed"]["entryAssembly"]
            if not assembly.is_file():
                raise ValueError("Managed slice output assembly is missing")
            receipt["assembly"] = {"path": str(assembly), "sha256": sha(assembly.read_bytes()), "sizeBytes": assembly.stat().st_size}
            if manifest.get("specialized") is not None:
                script, inputs = assemble_adapter(plugin)
                script_path = run / "adapter.js"
                script_path.write_bytes(script)
                syntax_command = ["node", "--check", str(script_path)]
                responsibilities["lint"] = "FAIL"
                syntax = subprocess.run(syntax_command, cwd=plugin, env=env, capture_output=True)
                log = run / "adapter-syntax.log"
                log.write_bytes(syntax.stdout + syntax.stderr)
                exit_code = syntax.returncode
                receipt["adapterSyntax"] = {"command": syntax_command, "exitCode": exit_code, "nativeLog": str(log)}
                if exit_code == 0:
                    responsibilities["lint"] = "PASS"
                    receipt["script"] = {"path": str(script_path), "sha256": sha(script), "sizeBytes": len(script)}
                    receipt["generatorInputs"] = inputs
        if exit_code == 0:
            manifest_path = run / "extension.manifest.json"
            manifest_path.write_bytes(encode(manifest))
            receipt["manifest"] = {"path": str(manifest_path), "sha256": sha(manifest_path.read_bytes())}
            receipt['artifacts'] = artifact_records(output, component['projects'])
            responsibilities["build"] = "PASS"
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        exit_code = 1
        receipt["error"] = str(error)
        print(str(error), flush=True)
    receipt.update(status="FAIL" if exit_code else "PASS", exitCode=exit_code, elapsedSeconds=time.monotonic() - start)
    save_result(output, args.extension, run / 'build-receipt.json', receipt)
    print(json.dumps({"status": receipt["status"], "receipt": str(run / "build-receipt.json")}), flush=True)
    if receipt["mainExitCode"]:
        print(native_output)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
