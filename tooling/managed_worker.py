"""Compile the declared managed worker and bind its complete launch closure to the build receipt."""
import json
from pathlib import Path, PurePosixPath
import subprocess
import time
from source_snapshot import sha


def build_worker(plugin, manifest, output, packages, package_path, env, run):
    declaration = manifest.get("execution")
    configuration = plugin / "build.json"
    if declaration is None:
        if configuration.exists():
            raise ValueError("Worker build metadata has no execution declaration")
        return None
    value = json.loads(configuration.read_bytes())
    if set(value) != {"workerProject"}:
        raise ValueError("Unknown managed worker build metadata")
    relative = PurePosixPath(value["workerProject"])
    if relative.is_absolute() or any(part in {"..", "."} for part in relative.parts) or "\\" in str(relative) or ":" in str(relative):
        raise ValueError("Managed worker project escaped its plugin")
    project = plugin / relative
    if project.suffix != ".csproj" or not project.is_file():
        raise ValueError("Managed worker project is missing")
    command = ["dotnet", "build", str(project), "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1",
               "-p:UseArtifactsOutput=true", f"-p:ArtifactsPath={output / 'build'}",
               f"-p:RestorePackagesPath={packages}", f"-p:RestoreSources={package_path.parent}"]
    started = time.monotonic()
    result = subprocess.run(command, cwd=plugin, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=180)
    log = run / "worker.log"
    log.write_bytes((result.stdout + result.stderr).encode())
    evidence = {"command": command, "exitCode": result.returncode, "elapsedSeconds": time.monotonic() - started,
                "nativeLog": str(log), "nativeLogSha256": sha(log.read_bytes())}
    failure = {"status": "FAIL", "build": evidence}
    if result.returncode:
        return failure
    binary = output / "build/bin" / project.stem / "release"
    entry = PurePosixPath(declaration["workerEntry"])
    if entry.parent.as_posix() != "worker" or not (binary / entry.name).is_file():
        return {**failure, "error": "Compiled worker does not match the manifest entry"}
    files = []
    for file in sorted(binary.iterdir()):
        if file.is_file() and (file.suffix in {".dll", ".exe"} or file.name.endswith((".deps.json", ".runtimeconfig.json"))):
            files.append({"member": "worker/" + file.name, "path": str(file), "sha256": sha(file.read_bytes()), "sizeBytes": file.stat().st_size})
    required = {entry.name, entry.stem + ".dll", entry.stem + ".deps.json", entry.stem + ".runtimeconfig.json",
                manifest["managed"]["entryAssembly"], "NexusPipeline.Extensibility.dll"}
    if not required.issubset({Path(file["path"]).name for file in files}):
        return {**failure, "error": "Managed worker launch closure is incomplete"}
    return {"status": "PASS", "build": evidence, "files": files}
