from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import tools.repository.git as repository_git
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.versions as repository_versions

def load_state(root: Path) -> dict[str, Any]:
    path = root / repository_model.STATE_FILE
    repository_io._require(path.is_file(), f"缺少必需发行状态：{repository_model.STATE_FILE}")
    state = repository_io.read_json(path)
    repository_io._require(isinstance(state, dict) and state.get("schemaVersion") == repository_model.STATE_SCHEMA_VERSION, f"{repository_model.STATE_FILE} schemaVersion 必须为 {repository_model.STATE_SCHEMA_VERSION}")
    source_commit = state.get("sourceCommit")
    repository_io._require(isinstance(source_commit, str) and bool(source_commit), f"{repository_model.STATE_FILE} 缺少 sourceCommit")
    released = state.get("released")
    repository_io._require(isinstance(released, dict), f"{repository_model.STATE_FILE}.released 必须是对象")
    return state


def _state_at_commit(root: Path, commit: str) -> dict[str, Any]:
    probe = subprocess.run(
        ["git", "cat-file", "-e", f"{commit}:{repository_model.STATE_FILE}"],
        cwd=root,
        check=False,
        capture_output=True,
    )
    repository_io._require(probe.returncode == 0, f"基线缺少必需发行状态：{repository_model.STATE_FILE}")
    raw = repository_git._git(root, ["show", f"{commit}:{repository_model.STATE_FILE}"], f"读取基线 {repository_model.STATE_FILE}")
    try:
        state = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise repository_model.RepositoryError(f"基线 {repository_model.STATE_FILE} JSON 无效") from exc
    repository_io._require(isinstance(state, dict), f"基线 {repository_model.STATE_FILE} 必须是对象")
    return state


def _retention_removals(root: Path, artifact: str, current_version: str, distribution_root: Path | None = None) -> list[str]:
    package_root = (distribution_root or root).resolve()
    directory = package_root / "packages" / artifact
    if not directory.is_dir():
        return []
    versions: list[tuple[repository_versions.ParsedVersion, Path]] = []
    for package in sorted(directory.glob("*.zip")):
        version = repository_versions._version_from_package(package, artifact)
        if version is not None:
            versions.append((version, package))
    candidate = (repository_versions.parse_semver(current_version), directory / f"{artifact}-{current_version}.zip")
    if not any(path.name == candidate[1].name for _version, path in versions):
        versions.append(candidate)
    versions.sort(key=lambda item: item[0], reverse=True)
    return [repository_io._display(path.relative_to(package_root)) for _version, path in versions[repository_model.MAX_RETAINED_PACKAGES:]]
