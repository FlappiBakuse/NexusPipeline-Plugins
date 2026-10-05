from __future__ import annotations

from pathlib import Path
from typing import Any

import tools.repository.git as repository_git
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.source as repository_source
import tools.repository.state as repository_state
import tools.repository.versions as repository_versions

def _changed_root_reasons(records: list[tuple[str, list[str]]]) -> dict[str, list[str]]:
    reasons: dict[str, list[str]] = {}
    for _status, paths in records:
        for path in paths:
            plugin_root = repository_git.plugin_root_from_path(path)
            normalized = path.replace("\\", "/")
            plugin_tests_prefix = f"{plugin_root}/tests/" if plugin_root is not None else ""
            if (
                plugin_root is not None
                and not normalized.startswith(plugin_tests_prefix)
                and not repository_git._is_plugin_build_metadata_path(normalized, plugin_root)
            ):
                reasons.setdefault(plugin_root, []).append(path)
    return reasons


def build_plan(
    root: Path,
    baseline: str = "auto",
    head: str | None = None,
    *,
    distribution_root: Path | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    distribution_root = (distribution_root or root).resolve()
    head_commit = repository_git.git_commit(root, head or "HEAD")
    current_plugins = repository_source.discover_source_plugins(root)
    current_by_root = {
        repository_io._display(plugin.root.relative_to(root)): plugin for plugin in current_plugins
    }
    current_by_artifact = {plugin.artifact_name: plugin for plugin in current_plugins}
    if baseline == "auto":
        current_state = repository_state.load_state(distribution_root)
        base_commit = repository_git.git_commit(root, str(current_state["sourceCommit"]))
        previous_state = current_state
    else:
        base_commit = repository_git.git_commit(root, baseline)
        previous_state = repository_state._state_at_commit(root, base_commit)
    records = repository_git.changed_paths(root, base_commit, head_commit)
    reasons_by_root = _changed_root_reasons(records)
    changed_artifacts: set[str] = set()
    deleted_artifacts: set[str] = set()
    reasons: dict[str, list[str]] = {}
    for plugin_root, paths in reasons_by_root.items():
        if plugin_root in current_by_root:
            artifact = current_by_root[plugin_root].artifact_name
            changed_artifacts.add(artifact)
            reasons[artifact] = sorted(set(paths))
        else:
            identity = repository_git._plugin_identity_at(root, base_commit, plugin_root)
            if identity is not None and identity[1] not in current_by_artifact:
                deleted_artifacts.add(identity[1])
                reasons.setdefault(identity[1], []).extend(paths)
    previous_released = previous_state.get("released", {})
    repository_io._require(isinstance(previous_released, dict), f"{repository_model.STATE_FILE}.released 必须是对象")
    previous_artifacts = set(str(key) for key in previous_released)
    for artifact, plugin in current_by_artifact.items():
        if artifact not in previous_artifacts:
            changed_artifacts.add(artifact)
            reasons.setdefault(artifact, []).append("new-plugin")
    for artifact in previous_artifacts - set(current_by_artifact):
        deleted_artifacts.add(artifact)
        reasons.setdefault(artifact, []).append("deleted-plugin")

    requires_package: set[str] = set()
    for artifact in sorted(changed_artifacts):
        plugin = current_by_artifact[artifact]
        previous = previous_released.get(artifact)
        if isinstance(previous, dict) and repository_versions.is_semver(previous.get("version")):
            previous_version = repository_versions.parse_semver(previous["version"])
            current_version = repository_versions.parse_semver(plugin.version)
            repository_io._require(current_version > previous_version, f"插件 {artifact} 的发行相关源码发生变化，必须提升 SemVer：{previous['version']} -> {plugin.version}")
        requires_package.add(artifact)
    for artifact in deleted_artifacts:
        reasons.setdefault(artifact, []).append("removed-from-source")

    managed = sorted(artifact for artifact in requires_package if current_by_artifact[artifact].kind == "managed-code")
    remove_packages = sorted(
        path
        for artifact in requires_package
        for path in repository_state._retention_removals(root, artifact, current_by_artifact[artifact].version, distribution_root)
    )
    remove_artifacts = sorted(f"packages/{artifact}" for artifact in deleted_artifacts)
    changed_paths_flat = [path for _status, paths in records for path in paths]
    mapped_paths = {path for paths in reasons_by_root.values() for path in paths}
    return {
        "schemaVersion": 1,
        "base": base_commit,
        "head": head_commit,
        "mode": "incremental",
        "changed": sorted(changed_artifacts),
        "deleted": sorted(deleted_artifacts),
        "managed": managed,
        "requiresPackage": sorted(requires_package),
        "reasons": {key: sorted(set(value)) for key, value in sorted(reasons.items())},
        "globalChanges": sorted(set(changed_paths_flat) - mapped_paths),
        "removePackages": remove_packages,
        "removeArtifacts": remove_artifacts,
    }


def check_pr(root: Path, base: str) -> int:
    records = repository_git.changed_paths(root, repository_git.git_commit(root, base), repository_git.git_head(root))
    changed = [path for _status, paths in records for path in paths]
    generated = [path for path in changed if path == "catalog.json" or path == repository_model.STATE_FILE or path.startswith("packages/")]
    repository_io._require(not generated, "PR 不得直接提交生成物：" + ", ".join(sorted(set(generated))))
    print(f"[repository] PR 生成物路径检查通过：{len(changed)} 个变更文件", flush=True)
    return len(changed)


def validate_candidate_against_base(
    root: Path,
    base: str,
    head: str | None = None,
    *,
    distribution_root: Path | None = None,
) -> dict[str, Any]:
    """校验 PR base 与当前 head 的发行版本纪律，不修改源码或发行状态。"""
    root = root.resolve()
    base_commit = repository_git.git_commit(root, base)
    head_commit = repository_git.git_commit(root, head or "HEAD")
    base_plugins = repository_git._plugin_roots_at(root, base_commit)
    head_plugins = repository_git._plugin_roots_at(root, head_commit)
    released = repository_state.load_state((distribution_root or root).resolve()).get("released", {})
    repository_io._require(isinstance(released, dict), f"{repository_model.STATE_FILE}.released 必须是对象")
    checked: list[str] = []
    for artifact, (head_root, head_manifest) in sorted(head_plugins.items()):
        old = base_plugins.get(artifact)
        changed = False
        if old is not None:
            old_root, old_manifest = old
            changed = repository_git._release_payload_tree_at(root, base_commit, old_root) != repository_git._release_payload_tree_at(root, head_commit, head_root)
            if changed:
                old_version = old_manifest.get("version")
                new_version = head_manifest.get("version")
                repository_io._require(repository_versions.is_semver(old_version) and repository_versions.is_semver(new_version), f"插件 {artifact} 的 base/head 版本无效")
                repository_io._require(
                    repository_versions.parse_semver(new_version) > repository_versions.parse_semver(old_version),
                    f"插件 {artifact} 的发行相关源码相对 base 必须提升 SemVer：{old_version} -> {new_version}",
                )
        published = released.get(artifact)
        if isinstance(published, dict) and repository_versions.is_semver(published.get("version")) and repository_versions.is_semver(head_manifest.get("version")):
            if repository_versions.parse_semver(head_manifest["version"]) < repository_versions.parse_semver(published["version"]):
                raise repository_model.RepositoryError(f"插件 {artifact} 的源码版本低于已发布游标：{head_manifest['version']} < {published['version']}")
            if changed and head_manifest["version"] == published["version"]:
                raise repository_model.RepositoryError(f"插件 {artifact} 已发布版本不可变，但当前源码仍使用 {published['version']}")
        checked.append(artifact)

    for artifact, published in sorted(released.items()):
        if artifact in head_plugins or not isinstance(published, dict):
            continue
        repository_io._require(repository_versions.is_semver(published.get("version")), f"已发布插件 {artifact} 的版本无效")
    result = {"base": base_commit, "head": head_commit, "checkedArtifacts": checked}
    print(f"[repository] candidate base/head 版本纪律通过：{base_commit} -> {head_commit}，{len(checked)} 个插件", flush=True)
    return result
