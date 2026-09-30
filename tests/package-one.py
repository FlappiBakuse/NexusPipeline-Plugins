import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from repository_core import (build_plugin_package, discover_source_plugins,
                             package_metadata, _validate_zip, read_json, git_head)
from repository_candidate import package_input_identities


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--host-root", type=Path)
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--plan-phase", type=Path)
    parser.add_argument("--sdk-sha")
    args = parser.parse_args()
    root, host = args.root.resolve(), args.host_root.resolve() if args.host_root else None
    phase = read_json(args.plan_phase) if args.plan_phase else None
    if phase is not None:
        if (not isinstance(phase, dict) or phase.get("schemaVersion") != 1
                or phase.get("sourceSha") != git_head(root)
                or phase.get("partnerSha") != args.sdk_sha
                or git_head(host) != args.sdk_sha
                or args.artifact not in phase.get("plan", {}).get("requiresPackage", [])
                or phase.get("packageInputs") != package_input_identities(
                    root, phase["plan"], args.sdk_sha)):
            raise ValueError("Plugin package phase input identity mismatch")
    plugin = next((item for item in discover_source_plugins(root)
                   if item.artifact_name == args.artifact), None)
    if plugin is None or args.output.exists():
        raise ValueError("Unknown plugin or existing package output")
    if plugin.kind == "managed-code" and host is None:
        raise ValueError("Managed package requires an explicit Host SDK input")
    args.output.mkdir(parents=True)
    output = args.output.resolve()
    if os.name == "nt":
        output = Path("\\\\?\\" + str(output))
    temporary = output / "package.build.zip"
    build_plugin_package(plugin, temporary, root, host_root=host)
    preliminary = package_metadata(temporary)
    package = output / f"{plugin.artifact_name}-{plugin.version}-{preliminary.sha256}.zip"
    temporary.rename(package)
    metadata = package_metadata(package)
    _validate_zip(package, mode="preview", expected_artifact=plugin.artifact_name,
                  expected_version=plugin.version, expected_sha256=metadata.sha256)
    spec = importlib.util.spec_from_file_location("plugin_architecture", root / "tests" / "architecture-check.py")
    architecture = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(architecture)
    violations = architecture.check_specialized_zip(package, plugin.artifact_name) if plugin.kind == "data-specialized" else []
    if violations:
        raise ValueError(f"A06 package boundary failed: {violations}")
    report = {"schemaVersion": 2 if phase is not None else 1, "artifactName": plugin.artifact_name,
              "version": plugin.version, "kind": plugin.kind, "fileName": package.name,
              "sha256": metadata.sha256,
              "sizeBytes": metadata.size_bytes, "status": "PASS"}
    if phase is not None:
        report.update({"sourceSha": phase["sourceSha"], "partnerSha": args.sdk_sha,
                       "inputSha": phase["packageInputs"][args.artifact]})
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
