"""Prepare actual Maa inputs for the existing Host system runner (never publish)."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from maa_native_tests import prepare_native_tests, reject_links, _hash


def prepare(root: Path, host: Path, output: Path) -> None:
    import repository_core as core

    reject_links(output)
    if output.exists():
        raise core.RepositoryError("Maa integration output must be a new owned directory")
    output.mkdir(parents=True)
    (output / ".nxp-maa-integration-owned").write_text("local-test-inputs", encoding="ascii")
    plugin = next((item for item in core.discover_source_plugins(root)
                   if item.artifact_name == "MaaFrameworkDriver"), None)
    if plugin is None:
        raise core.RepositoryError("MaaFrameworkDriver source missing")
    environment = prepare_native_tests(plugin.root, root, host, core._run)
    for fixture in ("NativeWindow", "NativeAgent", "NativeAdb"):
        project = next((plugin.root / "tests" / fixture).glob("*.csproj"))
        core._run(("dotnet", "publish", str(project), "--configuration", "Release", "--nologo",
                   "--output", str(output / fixture)), "Maa Host controlled fixture: " + fixture, root)
    shutil.copytree(plugin.root / "tests" / "fixtures" / "standard-pi", output / "standard-pi")
    package = output / "MaaFrameworkDriver-0.1.0.zip"
    core.build_plugin_package(plugin, package, root, host_root=host)
    catalog = {"schemaVersion": 2, "repository": core.REPOSITORY,
               "generatedAt": "2026-09-26T00:00:00Z",
               "plugins": [core.catalog_entry(plugin, package)]}
    (output / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    inventory = [{"path": str(file.relative_to(output)), "sha256": _hash(file), "bytes": file.stat().st_size}
                 for file in sorted(output.rglob("*")) if file.is_file()]
    (output / "inputs.json").write_text(json.dumps({
        "schemaVersion": 1, "remoteWrites": False, "pluginsRoot": str(root), "hostRoot": str(host),
        "nativeRoot": environment["NEXUS_MAA_NATIVE_ROOT"], "package": str(package),
        "packageSha256": _hash(package), "files": inventory,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
