from __future__ import annotations

import copy
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable

import tools.repository.archive as repository_archive
import tools.repository.git as repository_git
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.source as repository_source
import tools.repository.versions as repository_versions

def _catalog_entry_by_artifact(catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    entries = catalog.get("plugins")
    repository_io._require(isinstance(entries, list), "catalog.plugins 必须是数组")
    result: dict[str, dict[str, Any]] = {}
    for entry in entries:
        repository_io._require(isinstance(entry, dict), "catalog 插件条目必须是对象")
        artifact = entry.get("artifactName")
        repository_io._require(isinstance(artifact, str), "catalog 条目缺少 artifactName")
        result[artifact] = entry
    return result


def catalog_entry(plugin: repository_model.SourcePlugin, package: Path, metadata: repository_model.PackageMetadata | None = None) -> dict[str, Any]:
    metadata = metadata or repository_io.package_metadata(package)
    entry = {
        "name": plugin.name,
        "artifactName": plugin.artifact_name,
        "displayName": str(plugin.manifest.get("displayName", "")),
        "gameName": str(plugin.store.get("gameName", "")),
        "description": str(plugin.manifest.get("description", "")),
        "authors": plugin.authors,
        "tags": [str(tag) for tag in plugin.store.get("tags", [])],
        "homepage": str(plugin.store.get("homepage", "")),
        "updatedAt": plugin.updated_at,
        "hasReadme": (plugin.root / "README.md").is_file(),
        "version": plugin.version,
        "kind": plugin.kind,
        "apiVersion": str(plugin.manifest.get("apiVersion", "")),
        "capabilities": sorted({str(value) for value in plugin.manifest.get("capabilities", [])}, key=str.casefold),
        "minHostVersion": str(plugin.manifest.get("minHostVersion", "0.0.0")),
        "packageUrl": f"{repository_model.PACKAGE_URL_PREFIX}/{plugin.artifact_name}/{package.name}",
        "sha256": metadata.sha256,
        "sizeBytes": metadata.size_bytes,
        "changelog": copy.deepcopy(plugin.store["changelog"]),
    }
    if plugin.store.get("locales"):
        entry["locales"] = copy.deepcopy(plugin.store["locales"])
    return entry


def preview_catalog_entry(
    plugin: repository_model.SourcePlugin,
    package: Path,
    source_commit: str,
    metadata: repository_model.PackageMetadata | None = None,
) -> dict[str, Any]:
    """创建 develop preview 的平面资产引用；不触碰 stable catalog/state。"""
    metadata = metadata or repository_io.package_metadata(package)
    entry = catalog_entry(plugin, package, metadata)
    entry["packageUrl"] = f"{repository_model.PREVIEW_RELEASE_URL_PREFIX}/{package.name}"
    entry["sourceCommit"] = source_commit
    return entry


def _catalog_order(entries: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(entries, key=lambda item: (0 if item.get("kind") == "managed-code" else 1, str(item.get("name", "")).casefold()))


def _validate_catalog_shape(root: Path, catalog: dict[str, Any], plugins: list[repository_model.SourcePlugin], require_packages: bool) -> None:
    repository_io._require(catalog.get("schemaVersion") == 2, "catalog schemaVersion 必须为 2")
    repository_io._require(catalog.get("repository") == repository_model.REPOSITORY, "catalog repository 不正确")
    entries = catalog.get("plugins")
    repository_io._require(isinstance(entries, list), "catalog.plugins 必须是数组")
    by_artifact = {plugin.artifact_name: plugin for plugin in plugins}
    repository_io._require(set(entry.get("artifactName") for entry in entries) == set(by_artifact), "catalog 与源码插件集合不一致")
    repository_io._require(entries == _catalog_order(entries), "catalog 必须按 managed-code 优先、机器 ID 稳定排序")
    seen: set[str] = set()
    for entry in entries:
        artifact = entry.get("artifactName")
        repository_io._require(artifact not in seen, f"catalog artifactName 重复：{artifact}")
        seen.add(artifact)
        plugin = by_artifact[artifact]
        repository_io._require(entry.get("name") == plugin.name, f"catalog name 与源码不一致：{artifact}")
        repository_io._require(
            entry.get("version") == plugin.version
            and entry.get("kind") == plugin.kind
            and entry.get("minHostVersion", "0.0.0") == plugin.manifest.get("minHostVersion", "0.0.0"),
            f"catalog 版本、类型或最低宿主版本与源码不一致：{artifact}",
        )
        package = root / "packages" / artifact / f"{artifact}-{entry['version']}.zip"
        if require_packages:
            repository_io._require(package.is_file(), f"缺少 catalog 指定包：{repository_io._display(package)}")
        repository_io._require(entry.get("packageUrl") == f"{repository_model.PACKAGE_URL_PREFIX}/{artifact}/{package.name}", f"packageUrl 不正确：{artifact}")
        repository_io._require(isinstance(entry.get("sha256"), str) and re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]), f"catalog SHA256 无效：{artifact}")
        repository_io._require(isinstance(entry.get("sizeBytes"), int) and entry["sizeBytes"] >= 0, f"catalog sizeBytes 无效：{artifact}")


def audit(root: Path, baseline: str | None = None) -> int:
    base = repository_git.git_commit(root, baseline or "HEAD")
    if baseline is not None:
        repository_io._require(re.fullmatch(r"[0-9a-f]{40}", baseline) is not None, "审计基线必须是完整分发 SHA")
    print(f"[repository] 原始 stable 字节基线：{base}", flush=True)
    plugins = repository_source.discover_source_plugins(root)
    catalog = repository_io.read_json(root / "catalog.json")
    _validate_catalog_shape(root, catalog, plugins, True)
    entries = _catalog_entry_by_artifact(catalog)
    checked = 0
    for plugin in plugins:
        entry = entries[plugin.artifact_name]
        package = root / "packages" / plugin.artifact_name / f"{plugin.artifact_name}-{plugin.version}.zip"
        repository_io._require(repository_io.sha256(package) == entry["sha256"], f"SHA256 不一致：{repository_io._display(package)}")
        repository_io._require(package.stat().st_size == entry["sizeBytes"], f"包大小不一致：{repository_io._display(package)}")
        repository_archive._validate_zip(package, plugin)
        checked += 1
    packages_root = root / "packages"
    for directory in sorted(path for path in packages_root.iterdir() if path.is_dir()):
        repository_io._require(directory.name in entries, f"发行包目录没有对应源码插件：{directory.name}")
        packages = sorted(directory.glob("*.zip"))
        repository_io._require(len(packages) <= repository_model.MAX_RETAINED_PACKAGES, f"插件发行包超过最近 {repository_model.MAX_RETAINED_PACKAGES} 个版本：{directory.name}")
        for package in packages:
            repository_io._require(repository_versions._version_from_package(package, directory.name) is not None, f"发行包文件名无效：{repository_io._display(package)}")
            relative = package.relative_to(root).as_posix()
            original = subprocess.run(["git", "show", f"{base}:{relative}"], cwd=root, capture_output=True, check=False)
            repository_io._require(original.returncode == 0, f"分发基线缺少历史包：{relative}")
            repository_archive._validate_historical_archive(package, original.stdout)
            checked += 1
    print(f"[repository] Full Audit 通过：检查 {checked} 个 ZIP、{len(plugins)} 个当前 catalog 条目", flush=True)
    return checked
