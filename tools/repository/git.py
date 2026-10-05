from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Sequence

import tools.repository.io as repository_io
import tools.repository.model as repository_model

def _git(root: Path, args: Sequence[str], label: str) -> str:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as exc:
        raise repository_model.RepositoryError(f"{label}启动失败：{exc}") from exc
    if completed.returncode != 0:
        detail = completed.stderr.strip()
        raise repository_model.RepositoryError(f"{label}失败：{detail}")
    return completed.stdout.strip()


def git_head(root: Path) -> str:
    return _git(root, ["rev-parse", "HEAD"], "读取当前提交")


def git_commit(root: Path, ref: str) -> str:
    return _git(root, ["rev-parse", f"{ref}^{{commit}}"], "解析 Git 基线")


def git_tree(root: Path, commit: str, plugin_root: str) -> str:
    return _git(root, ["rev-parse", f"{commit}:{plugin_root}"], f"读取插件源码树：{plugin_root}")


def git_json_at(root: Path, commit: str, path: str) -> Any:
    raw = _git(root, ["show", f"{commit}:{path}"], f"读取基线文件：{path}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise repository_model.RepositoryError(f"基线 JSON 无效：{path}") from exc


def changed_paths(root: Path, base: str, head: str) -> list[tuple[str, list[str]]]:
    if base == head:
        return []
    output = _git(root, ["diff", "--name-status", "--find-renames=50%", "-z", f"{base}...{head}", "--"], "读取 Git 发行变更")
    result: list[tuple[str, list[str]]] = []
    tokens = output.split("\0")
    index = 0
    while index < len(tokens):
        status = tokens[index]
        index += 1
        if not status:
            continue
        count = 2 if status.startswith(("R", "C")) else 1
        paths = tokens[index:index + count]
        repository_io._require(len(paths) == count and all(paths), "Git 变更列表不完整")
        index += count
        result.append((status, [file.replace("\\", "/") for file in paths]))
    return result


def plugin_root_from_path(path: str) -> str | None:
    parts = path.replace("\\", "/").split("/")
    if len(parts) < 3 or parts[0] != "plugins":
        return None
    if parts[1] in {"general", "specialized"}:
        return "/".join(parts[:3])
    return None


def _plugin_identity_at(root: Path, commit: str, plugin_root: str) -> tuple[str, str] | None:
    try:
        manifest = git_json_at(root, commit, f"{plugin_root}/plugin.json")
    except repository_model.RepositoryError:
        return None
    if not isinstance(manifest, dict):
        return None
    name = manifest.get("name")
    artifact = manifest.get("artifactName")
    if isinstance(name, str) and isinstance(artifact, str):
        return name, artifact
    return None


def _plugin_roots_at(root: Path, commit: str) -> dict[str, tuple[str, dict[str, Any]]]:
    output = _git(root, ["ls-tree", "-r", "--name-only", commit, "--", "plugins"], f"读取插件基线树：{commit}")
    result: dict[str, tuple[str, dict[str, Any]]] = {}
    for path in output.splitlines():
        normalized = path.replace("\\", "/")
        if not normalized.endswith("/plugin.json"):
            continue
        parts = normalized.split("/")
        if len(parts) != 4 or parts[0] != "plugins" or parts[1] not in {"general", "specialized"}:
            continue
        plugin_root = "/".join(parts[:3])
        manifest = git_json_at(root, commit, normalized)
        if isinstance(manifest, dict) and isinstance(manifest.get("artifactName"), str):
            result[manifest["artifactName"]] = (plugin_root, manifest)
    return result


def _is_plugin_build_metadata_path(path: str, plugin_root: str | None = None) -> bool:
    """Return whether a plugin path is build metadata rather than package input.

    Managed project files are required to build a plugin but are never copied to
    its ZIP.  In particular, changing a ProjectReference from a repository-
    relative path to the explicit NexusHostRoot property must not force an
    otherwise identical stable package to receive a new plugin version.  The
    resulting build is still covered by the managed verification gate.
    """
    normalized = path.replace("\\", "/").strip("/")
    if plugin_root is not None:
        prefix = plugin_root.replace("\\", "/").rstrip("/") + "/"
        if not normalized.startswith(prefix):
            return False
        normalized = normalized[len(prefix):]
    name = normalized.rsplit("/", 1)[-1].casefold()
    return name.endswith((".csproj", ".fsproj", ".vbproj", ".sln"))


def _release_payload_tree_at(root: Path, commit: str, plugin_root: str) -> dict[str, str]:
    output = _git(root, ["ls-tree", "-r", commit, "--", plugin_root], f"读取插件发行树：{plugin_root}")
    result: dict[str, str] = {}
    prefix = plugin_root.rstrip("/") + "/"
    for line in output.splitlines():
        if "\t" not in line:
            continue
        header, path = line.split("\t", 1)
        fields = header.split()
        if len(fields) < 3 or not path.startswith(prefix):
            continue
        relative = path[len(prefix):]
        if (
            relative == ""
            or relative.startswith("tests/")
            or "/tests/" in relative
            or _is_plugin_build_metadata_path(relative)
        ):
            continue
        result[relative] = fields[2]
    return result
