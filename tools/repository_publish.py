"""发布候选的本地安全编排。

本模块只生成和验证数据候选。真正的 GitHub Release/catalog/state 写入必须在
受保护 publisher runner 使用独立适配器执行，并显式传入 remote-write；本地
开发工具不会因为误运行而产生远端副作用。
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Protocol

from repository_release_api import (
    create_release,
    delete_asset,
    download_asset,
    get_ref,
    get_release,
    is_ancestor,
    list_assets,
    update_release,
    upload_asset,
)

import repository_core as core


OFFICIAL_REPOSITORY = core.REPOSITORY
PREVIEW_TAG = "plugins-develop"
FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
MAX_CANDIDATE_FILES = 4096
MAX_CANDIDATE_BYTES = 512 * 1024 * 1024
MAX_ZIP_ENTRIES = core.MAX_ZIP_ENTRIES
MAX_ZIP_UNCOMPRESSED_BYTES = core.MAX_ZIP_UNCOMPRESSED_BYTES


class GitHubTransport(Protocol):
    def get_source_head(self, repository: str, branch: str, token: str) -> str: ...
    def is_ancestor(self, repository: str, older: str, newer: str, token: str) -> bool: ...
    def get_release(self, repository: str, tag: str, token: str) -> dict[str, Any] | None: ...
    def create_release(self, repository: str, tag: str, token: str, *, name: str, body: str, target_commitish: str) -> dict[str, Any]: ...
    def update_release(self, repository: str, release_id: int, token: str, **fields: Any) -> dict[str, Any]: ...
    def list_assets(self, repository: str, release_id: int, token: str) -> list[dict[str, Any]]: ...
    def download_asset(self, repository: str, asset_id: int, token: str) -> bytes: ...
    def delete_asset(self, repository: str, asset_id: int, token: str) -> None: ...
    def upload_asset(self, repository: str, release_id: int, asset: Path, token: str, *, name: str) -> dict[str, Any]: ...


class HttpGitHubTransport:
    """真实 GitHub Release transport；远端写入只由显式 publisher 调用。"""

    get_source_head = staticmethod(get_ref)
    is_ancestor = staticmethod(is_ancestor)
    get_release = staticmethod(get_release)
    create_release = staticmethod(create_release)
    update_release = staticmethod(update_release)
    list_assets = staticmethod(list_assets)
    download_asset = staticmethod(download_asset)
    delete_asset = staticmethod(delete_asset)
    upload_asset = staticmethod(upload_asset)


def _full_sha(value: Any, label: str) -> str:
    core._require(isinstance(value, str) and FULL_SHA.fullmatch(value) is not None, f"{label} 必须是完整 40 位小写 SHA")
    return value


def _positive_int(value: Any, label: str) -> int:
    core._require(isinstance(value, int) and not isinstance(value, bool) and value > 0, f"{label} 必须是正整数")
    return value


def _parse_positive_int(value: Any, label: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise core.RepositoryError(f"{label} 必须是正整数") from exc
    return _positive_int(parsed, label)


def _safe_relative(value: Any, label: str) -> str:
    core._require(isinstance(value, str), f"{label} 必须是字符串")
    normalized = value.replace("\\", "/")
    parts = normalized.split("/")
    core._require(
        normalized.startswith("packages/")
        and len(parts) > 1
        and all(part not in {"", ".", ".."} for part in parts),
        f"{label} 路径越界：{value}",
    )
    return normalized


def _ordinary_directory(value: Path, label: str) -> Path:
    path = Path(value)
    core._require(path.is_dir() and not path.is_symlink(), f"{label} 必须是普通目录")
    return path.resolve()


def _validate_zip_limits(package: Path) -> None:
    try:
        with zipfile.ZipFile(package) as archive:
            infos = archive.infolist()
            core._validate_zip_layout(infos, package)
    except zipfile.BadZipFile as exc:
        raise core.RepositoryError(f"候选 ZIP 无效：{package}") from exc


def _candidate_inventory(source_root: Path, generated_root: Path) -> tuple[dict[str, Path], int]:
    """Enumerate only candidate payload files and reject links/special files."""

    generated_root = _ordinary_directory(generated_root, "候选目录")
    core.validate_stable_candidate_layout(source_root, generated_root)
    files: dict[str, Path] = {}
    total_bytes = 0
    for path in generated_root.rglob("*"):
        relative = path.relative_to(generated_root).as_posix()
        if path.is_symlink():
            raise core.RepositoryError(f"候选目录禁止 symlink：{relative}")
        if path.is_dir():
            continue
        core._require(path.is_file(), f"候选目录包含特殊文件：{relative}")
        if relative in {"release-plan.json", "stable-producer.json", "candidate.json"}:
            continue
        core._require(relative in {"catalog.json", core.STATE_FILE} or relative.startswith("packages/"), f"候选文件不在发布白名单：{relative}")
        if relative.startswith("packages/"):
            core._require(path.suffix.lower() == ".zip", f"stable 候选 packages 只能包含 ZIP：{relative}")
        files[relative] = path
        total_bytes += path.stat().st_size
        core._require(len(files) <= MAX_CANDIDATE_FILES, "候选文件数量超过上限")
        core._require(total_bytes <= MAX_CANDIDATE_BYTES, "候选文件总大小超过上限")
    for package in sorted(path for relative, path in files.items() if relative.startswith("packages/") and path.suffix.lower() == ".zip"):
        _validate_zip_limits(package)
    core._require("catalog.json" in files and core.STATE_FILE in files, "候选缺少 catalog/state")
    return files, total_bytes


def _preview_inventory(generated_root: Path) -> None:
    generated_root = _ordinary_directory(generated_root, "preview 候选目录")
    files = 0
    total_bytes = 0
    for path in generated_root.rglob("*"):
        relative = path.relative_to(generated_root).as_posix()
        if path.is_symlink():
            raise core.RepositoryError(f"preview 候选目录禁止 symlink：{relative}")
        if path.is_dir():
            continue
        core._require(path.is_file(), f"preview 候选目录包含特殊文件：{relative}")
        core._require(relative in {"catalog.json", "preview-plan.json", "candidate.json"} or (relative.startswith("packages/") and "/" not in relative[len("packages/"):]), f"preview 候选路径不在白名单：{relative}")
        if relative.startswith("packages/"):
            core._require(path.suffix.lower() == ".zip", f"preview packages 只能包含 ZIP：{relative}")
            _validate_zip_limits(path)
        files += 1
        total_bytes += path.stat().st_size
        core._require(files <= MAX_CANDIDATE_FILES, "preview 候选文件数量超过上限")
        core._require(total_bytes <= MAX_CANDIDATE_BYTES, "preview 候选文件总大小超过上限")
    core._require((generated_root / "catalog.json").is_file(), "preview 候选缺少 catalog")


def _read_stable_producer(generated_root: Path, *, source_sha: str, base_sha: str, run_id: str, run_attempt: str, workflow_sha: str, app_id: str, check_id: str) -> dict[str, Any]:
    producer = core.read_json(generated_root / "stable-producer.json")
    core._require(isinstance(producer, dict), "stable producer metadata 必须是对象")
    expected = {
        "schemaVersion": 1,
        "sourceSha": _full_sha(source_sha, "source SHA"),
        "baseSha": _full_sha(base_sha, "base SHA"),
        "runId": _parse_positive_int(run_id, "qualification runId"),
        "runAttempt": _parse_positive_int(run_attempt, "qualification runAttempt"),
        "workflowSha": _full_sha(workflow_sha, "qualification workflow SHA"),
        "qualificationAppId": _parse_positive_int(app_id, "qualification App ID"),
        "qualificationCheckId": _parse_positive_int(check_id, "qualification check id"),
    }
    core._require(producer == expected, "stable producer identity 与 writer 请求不一致")
    return producer


class GitTransport(Protocol):
    """稳定 writer 的隔离 Git 写入端口；不得由候选源码实现。"""

    def publish_stable_candidate(
        self,
        root: Path,
        generated_root: Path,
        source_sha: str,
        base_sha: str,
        *,
        remote_write: bool,
        token: str,
        run_id: int,
        run_attempt: int,
        workflow_sha: str,
    ) -> dict[str, Any]: ...


class GitHubGitTransport:
    """在一次性 checkout 中执行 stable 生成物白名单提交和普通 push。"""

    def __init__(self, remote: str = f"https://github.com/{OFFICIAL_REPOSITORY}.git") -> None:
        self.remote = remote

    @staticmethod
    def _run(command: list[str], cwd: Path, *, env: dict[str, str]) -> str:
        completed = subprocess.run(command, cwd=cwd, env=env, check=False, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if completed.returncode != 0:
            raise core.RepositoryError(f"stable Git 操作失败（exit={completed.returncode}）：{completed.stderr.strip()[:500]}")
        return completed.stdout.strip()

    @staticmethod
    def _safe_candidate_file(path: Path, generated_root: Path) -> str:
        resolved = path.resolve()
        root = generated_root.resolve()
        core._require(path.is_file() and not path.is_symlink() and root in resolved.parents, f"stable 候选文件无效：{path}")
        relative = resolved.relative_to(root).as_posix()
        core._require(relative in {"catalog.json", core.STATE_FILE} or relative.startswith("packages/"), f"stable 候选路径不在白名单：{relative}")
        return relative

    def publish_stable_candidate(
        self,
        root: Path,
        generated_root: Path,
        source_sha: str,
        base_sha: str,
        *,
        remote_write: bool,
        token: str,
        run_id: int,
        run_attempt: int,
        workflow_sha: str,
    ) -> dict[str, Any]:
        core._require(remote_write and bool(token), "stable remote write 必须有 publisher token")
        source_sha = _full_sha(source_sha, "stable source SHA")
        _full_sha(base_sha, "stable base SHA")
        _positive_int(run_id, "qualification runId")
        _positive_int(run_attempt, "qualification runAttempt")
        _full_sha(workflow_sha, "qualification workflow SHA")
        generated_root = _ordinary_directory(generated_root, "stable 候选目录")
        plan = core.read_json(generated_root / "release-plan.json")
        core._require(isinstance(plan, dict) and plan.get("head") == source_sha, "stable 候选 plan/source SHA 不一致")
        core.validate_generated(root.resolve(), generated_root, distribution_root=root.resolve())
        files, _total = _candidate_inventory(root.resolve(), generated_root)
        expected_paths = set(files)
        for key in ("removePackages", "removeArtifacts"):
            values = plan.get(key, [])
            core._require(isinstance(values, list), f"stable plan {key} 必须是数组")
            for value in values:
                normalized = _safe_relative(value, f"stable plan {key}")
                if key == "removeArtifacts":
                    core._require(len(normalized.split("/")) == 2, f"stable 删除目录路径无效：{value}")
                expected_paths.add(normalized)
        packages = generated_root / "packages"
        with tempfile.TemporaryDirectory(prefix=".nxp-stable-writer-") as temporary:
            checkout = Path(temporary) / "checkout"
            env = os.environ.copy()
            env.update({
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                "GIT_CONFIG_VALUE_0": "AUTHORIZATION: basic " + base64.b64encode(f"x-access-token:{token}".encode("utf-8")).decode("ascii"),
                "GIT_TERMINAL_PROMPT": "0",
            })
            self._run(["git", "-c", "core.autocrlf=false", "clone", "--no-hardlinks", self.remote, str(checkout)], Path(temporary), env=env)
            self._run(["git", "config", "core.autocrlf", "false"], checkout, env=env)
            self._run(["git", "fetch", "origin", "main"], checkout, env=env)
            current = self._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
            self._assert_checkout_modes(checkout, env)
            self._run(["git", "checkout", "-B", "publisher-stable", current], checkout, env=env)
            if self._matches_candidate(checkout, generated_root, plan, source_sha, current, expected_paths, env):
                verification = self._verify_published_tree(checkout, generated_root, plan, source_sha, current, files, env)
                return {"sourceCommit": source_sha, "publishedCommit": current, "parent": current, "remoteWritten": True, "idempotent": True, **verification}
            core._require(current == source_sha, "stable main 已前进且尚未包含当前候选，拒绝覆盖")
            self._assert_checkout_modes(checkout, env)
            for relative, candidate in sorted(files.items()):
                if not relative.startswith("packages/"):
                    continue
                destination = checkout / relative
                if destination.exists() or destination.is_symlink():
                    core._require(destination.is_file() and not destination.is_symlink(), f"stable 目标包不是普通文件：{relative}")
                    core._require(core._same_package_bytes(destination, candidate), f"同一 SemVer 的远端发行包字节不同，拒绝覆盖：{relative}")
            for relative in ("catalog.json", core.STATE_FILE):
                source = files[relative]
                destination = checkout / relative
                core._require(not destination.is_symlink(), f"stable 目标不得是 symlink：{relative}")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)
            for relative, path in sorted(files.items()):
                if not relative.startswith("packages/"):
                    continue
                destination = checkout / relative
                self._require_no_symlink_parents(checkout, destination)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
            for relative in plan.get("removePackages", []):
                target = checkout / _safe_relative(relative, "stable plan removePackages")
                if target.exists() or target.is_symlink():
                    core._require(target.is_file() and not target.is_symlink(), f"stable 删除包目标无效：{relative}")
                    target.unlink()
            for relative in plan.get("removeArtifacts", []):
                target = checkout / _safe_relative(relative, "stable plan removeArtifacts")
                if target.exists() or target.is_symlink():
                    core._require(target.is_dir() and not target.is_symlink(), f"stable 删除目标不是普通目录：{relative}")
                    shutil.rmtree(target)
            latest = self._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
            core._require(latest == current, "stable main 在写入前发生竞争，拒绝使用旧父提交")
            self._run(["git", "add", "--all", "--", "catalog.json", core.STATE_FILE, "packages"], checkout, env=env)
            raw = self._run(["git", "diff", "--cached", "--name-status", "--find-renames", "-z"], checkout, env=env)
            changed = self._parse_changed_paths(raw)
            remove_directories = tuple(_safe_relative(value, "stable plan removeArtifacts") for value in plan.get("removeArtifacts", []))
            unexpected = [path for path in changed if path not in expected_paths and not any(path.startswith(directory.rstrip("/") + "/") for directory in remove_directories)]
            core._require(not unexpected, f"stable 生成物 diff 超出白名单：{sorted(set(unexpected))}")
            core._require(not any((checkout / path).is_symlink() for path in changed if (checkout / path).exists()), "stable 生成物不得包含 symlink")
            if not changed:
                verification = self._verify_published_tree(checkout, generated_root, plan, source_sha, current, files, env)
                return {"sourceCommit": source_sha, "publishedCommit": current, "parent": current, "remoteWritten": True, "idempotent": True, **verification}
            self._run(["git", "-c", "user.name=NexusPipeline Stable Publisher", "-c", "user.email=noreply@nexuspipeline.invalid", "commit", "--no-verify", "-m", "chore: 更新稳定插件生成物"], checkout, env=env)
            published = self._run(["git", "rev-parse", "HEAD"], checkout, env=env)
            self._run(["git", "push", "origin", "HEAD:refs/heads/main"], checkout, env=env)
            verification = self._verify_published_tree(
                checkout,
                generated_root,
                plan,
                source_sha,
                published,
                files,
                env,
            )
            return {"sourceCommit": source_sha, "publishedCommit": published, "parent": current, "remoteWritten": True, "idempotent": False, **verification}

    @staticmethod
    def _parse_changed_paths(raw: str) -> list[str]:
        tokens = raw.split("\x00") if raw else []
        changed: list[str] = []
        index = 0
        while index < len(tokens) and tokens[index]:
            status = tokens[index]
            index += 1
            count = 2 if status.startswith(("R", "C")) else 1
            core._require(index + count <= len(tokens), "stable Git diff 输出不完整")
            changed.extend(tokens[index:index + count])
            index += count
        return changed

    @staticmethod
    def _read_tree_blob(checkout: Path, revision: str, relative: str, env: dict[str, str]) -> bytes | None:
        completed = subprocess.run(
            ["git", "show", f"{revision}:{relative}"],
            cwd=checkout,
            env=env,
            check=False,
            capture_output=True,
        )
        if completed.returncode == 0:
            return completed.stdout
        return None

    @classmethod
    def _verify_published_tree(
        cls,
        checkout: Path,
        generated_root: Path,
        plan: dict[str, Any],
        source_sha: str,
        published: str,
        files: dict[str, Path],
        env: dict[str, str],
    ) -> dict[str, Any]:
        cls._run(["git", "fetch", "origin", "main"], checkout, env=env)
        fetched_head = cls._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
        cls._run(["git", "merge-base", "--is-ancestor", published, fetched_head], checkout, env=env)

        catalog_bytes = cls._read_tree_blob(checkout, published, "catalog.json", env)
        state_bytes = cls._read_tree_blob(checkout, published, core.STATE_FILE, env)
        core._require(catalog_bytes is not None and state_bytes is not None, "stable push 后 catalog/state 不可读取")
        try:
            catalog = json.loads(catalog_bytes.decode("utf-8"))
            state = json.loads(state_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise core.RepositoryError("stable push 后 catalog/state 不是有效 UTF-8 JSON") from exc
        core._require(isinstance(catalog, dict) and isinstance(state, dict), "stable push 后 catalog/state 根节点无效")
        core._require(state.get("sourceCommit") == source_sha, "stable push 后 state sourceCommit 不一致")

        package_hashes: dict[str, str] = {}
        for entry in catalog.get("plugins", []):
            core._require(isinstance(entry, dict), "stable push 后 catalog.plugins 条目无效")
            artifact = entry.get("artifactName")
            version = entry.get("version")
            core._require(isinstance(artifact, str) and isinstance(version, str), "stable push 后 catalog 包身份无效")
            relative = f"packages/{artifact}/{artifact}-{version}.zip"
            package_bytes = cls._read_tree_blob(checkout, published, relative, env)
            core._require(package_bytes is not None, f"stable push 后缺少 catalog 指定包：{relative}")
            digest = hashlib.sha256(package_bytes).hexdigest()
            core._require(digest == entry.get("sha256") and len(package_bytes) == entry.get("sizeBytes"), f"stable push 后包字节与 catalog 不一致：{relative}")
            package_hashes[relative] = digest

        for relative, candidate in files.items():
            remote_bytes = cls._read_tree_blob(checkout, published, relative, env)
            core._require(remote_bytes is not None and remote_bytes == candidate.read_bytes(), f"stable push 后候选字节不一致：{relative}")

        tree_paths = cls._run(["git", "ls-tree", "-r", "--name-only", published, "--", "packages"], checkout, env=env).splitlines()
        for relative in plan.get("removePackages", []):
            normalized = _safe_relative(relative, "stable plan removePackages")
            core._require(normalized not in tree_paths, f"stable push 后删除包仍存在：{normalized}")
        for relative in plan.get("removeArtifacts", []):
            normalized = _safe_relative(relative, "stable plan removeArtifacts")
            core._require(not any(path == normalized or path.startswith(normalized.rstrip("/") + "/") for path in tree_paths), f"stable push 后删除目录仍存在：{normalized}")
        return {
            "catalogSha256": hashlib.sha256(catalog_bytes).hexdigest(),
            "stateSha256": hashlib.sha256(state_bytes).hexdigest(),
            "packageSha256": package_hashes,
        }

    @classmethod
    def _require_no_symlink_parents(cls, checkout: Path, target: Path) -> None:
        relative = target.relative_to(checkout)
        current = checkout
        for part in relative.parts:
            current = current / part
            core._require(not current.is_symlink(), f"stable 目标路径包含 symlink：{relative}")

    @classmethod
    def _assert_checkout_modes(cls, checkout: Path, env: dict[str, str]) -> None:
        for relative in ("catalog.json", core.STATE_FILE, "packages"):
            target = checkout / relative
            if target.is_symlink():
                raise core.RepositoryError(f"stable checkout 白名单路径不得是 symlink：{relative}")
        packages = checkout / "packages"
        if packages.is_dir():
            for path in packages.rglob("*"):
                core._require(not path.is_symlink(), f"stable checkout packages 不得包含 symlink：{path.relative_to(checkout)}")
        index = cls._run(["git", "ls-files", "-s", "--", "catalog.json", core.STATE_FILE, "packages"], checkout, env=env)
        core._require(not any(line.startswith("160000 ") for line in index.splitlines()), "stable checkout 禁止 submodule")

    @classmethod
    def _matches_candidate(cls, checkout: Path, generated_root: Path, plan: dict[str, Any], source_sha: str, current: str, expected_paths: set[str], env: dict[str, str]) -> bool:
        if current != source_sha:
            try:
                merge_base = cls._run(["git", "merge-base", source_sha, current], checkout, env=env)
            except core.RepositoryError:
                return False
            if merge_base != source_sha:
                return False
            changed = cls._parse_changed_paths(cls._run(["git", "diff", "--name-status", "--find-renames", "-z", f"{source_sha}..{current}"], checkout, env=env))
            removed = tuple(_safe_relative(value, "stable plan removeArtifacts") for value in plan.get("removeArtifacts", []))
            if any(path not in expected_paths and not any(path.startswith(directory.rstrip("/") + "/") for directory in removed) for path in changed):
                return False
        for relative in ("catalog.json", core.STATE_FILE):
            current_path = checkout / relative
            candidate_path = generated_root / relative
            if not current_path.is_file() or current_path.read_bytes() != candidate_path.read_bytes():
                return False
        for relative in sorted(path for path in expected_paths if path.startswith("packages/")):
            if not (generated_root / relative).is_file():
                continue
            current_path = checkout / relative
            if not current_path.is_file() or current_path.read_bytes() != (generated_root / relative).read_bytes():
                return False
        for relative in plan.get("removePackages", []):
            target = checkout / _safe_relative(relative, "stable plan removePackages")
            if target.exists() or target.is_symlink():
                return False
        for relative in plan.get("removeArtifacts", []):
            target = checkout / _safe_relative(relative, "stable plan removeArtifacts")
            if target.exists() or target.is_symlink():
                return False
        try:
            state = core.read_json(checkout / core.STATE_FILE)
        except core.RepositoryError:
            return False
        return isinstance(state, dict) and state.get("sourceCommit") == source_sha


def _require_remote_inputs(remote_write: bool, token: str | None, github_transport: GitHubTransport | None) -> tuple[str, GitHubTransport]:
    if not remote_write:
        raise core.RepositoryError("内部错误：未启用 remote write")
    if not token:
        raise core.RepositoryError("remote write 缺少受保护 publisher token")
    return token, github_transport or HttpGitHubTransport()


def _release_asset_map(transport: GitHubTransport, repository: str, release: dict[str, Any], token: str) -> dict[str, dict[str, Any]]:
    release_id = release.get("id")
    if not isinstance(release_id, int):
        raise core.RepositoryError("Release 响应缺少合法 id")
    assets = transport.list_assets(repository, release_id, token)
    result: dict[str, dict[str, Any]] = {}
    for asset in assets:
        name = asset.get("name")
        if isinstance(name, str):
            if name in result:
                raise core.RepositoryError(f"Release asset 名称重复：{name}")
            result[name] = asset
    return result


def _upload_or_reuse_asset(
    transport: GitHubTransport,
    repository: str,
    release: dict[str, Any],
    token: str,
    asset: Path,
    *,
    name: str,
    assets: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    release_id = release["id"]
    existing = assets.get(name)
    if existing is not None:
        asset_id = existing.get("id")
        if not isinstance(asset_id, int):
            raise core.RepositoryError(f"preview asset 缺少合法 id：{name}")
        if transport.download_asset(repository, asset_id, token) != asset.read_bytes():
            raise core.RepositoryError(f"同名 preview asset 内容不同，拒绝覆盖：{name}")
        return existing
    uploaded = transport.upload_asset(repository, release_id, asset, token, name=name)
    asset_id = uploaded.get("id") if isinstance(uploaded, dict) else None
    if not isinstance(asset_id, int):
        raise core.RepositoryError(f"preview asset 上传响应缺少合法 id：{name}")
    if transport.download_asset(repository, asset_id, token) != asset.read_bytes():
        raise core.RepositoryError(f"preview asset 上传后立即复核失败：{name}")
    result = {"id": asset_id, "name": name}
    assets[name] = result
    return result


def _restore_catalog_asset(
    transport: GitHubTransport,
    release: dict[str, Any],
    token: str,
    old_catalog: bytes | None,
) -> None:
    release_id = release.get("id")
    if not isinstance(release_id, int):
        raise core.RepositoryError("catalog 恢复缺少 Release id")
    assets = _release_asset_map(transport, OFFICIAL_REPOSITORY, release, token)
    current = assets.get("catalog.json")
    if current is not None:
        current_id = current.get("id")
        core._require(isinstance(current_id, int), "catalog 恢复的当前 asset 缺少 id")
        if old_catalog is not None and transport.download_asset(OFFICIAL_REPOSITORY, current_id, token) == old_catalog:
            return
        transport.delete_asset(OFFICIAL_REPOSITORY, current_id, token)
    if old_catalog is None:
        return
    with tempfile.TemporaryDirectory(prefix=".nxp-preview-restore-") as temporary:
        restore = Path(temporary) / "catalog.json"
        restore.write_bytes(old_catalog)
        _upload_or_reuse_asset(transport, OFFICIAL_REPOSITORY, release, token, restore, name="catalog.json", assets={})


def _publish_preview_remote(result: dict[str, Any], *, token: str, transport: GitHubTransport, run_id: str | None) -> dict[str, Any]:
    generated_root = _ordinary_directory(Path(result["output"]), "preview 候选目录")
    source_sha = result.get("sourceCommit")
    core._require(isinstance(source_sha, str), "preview sourceCommit")
    _full_sha(source_sha, "preview source SHA")
    _preview_inventory(generated_root)
    core.validate_preview_candidate(generated_root, expected_source_sha=source_sha)
    current_source = transport.get_source_head(OFFICIAL_REPOSITORY, "develop", token)
    _full_sha(current_source, "远端 develop source SHA")
    core._require(current_source == source_sha, f"SUPERSEDED：develop 已前进到 {current_source}，未发布旧 preview {source_sha}")
    catalog_path = generated_root / "catalog.json"
    packages = sorted((generated_root / "packages").glob("*.zip"))
    core._require(catalog_path.is_file() and not catalog_path.is_symlink(), "preview catalog 候选无效")
    catalog_bytes = catalog_path.read_bytes()
    catalog_hash = hashlib.sha256(catalog_bytes).hexdigest()
    release = transport.get_release(OFFICIAL_REPOSITORY, PREVIEW_TAG, token)
    if release is None:
        release = transport.create_release(
            OFFICIAL_REPOSITORY,
            PREVIEW_TAG,
            token,
            name="Plugins develop preview",
            body=f"sourceCommit={source_sha}\ncatalogSha256={catalog_hash}",
            target_commitish=source_sha,
        )
    release_id = release.get("id")
    if not isinstance(release_id, int):
        raise core.RepositoryError("preview Release 缺少合法 id")
    assets = _release_asset_map(transport, OFFICIAL_REPOSITORY, release, token)
    old_catalog_asset = assets.get("catalog.json")
    if old_catalog_asset is not None:
        old_id = old_catalog_asset.get("id")
        core._require(isinstance(old_id, int), "旧 preview catalog asset id 无效")
        try:
            old_catalog_data = json.loads(transport.download_asset(OFFICIAL_REPOSITORY, old_id, token).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise core.RepositoryError("旧 preview catalog 不是有效 JSON") from exc
        old_source = old_catalog_data.get("sourceCommit") if isinstance(old_catalog_data, dict) else None
        _full_sha(old_source, "旧 preview source SHA")
        if old_source != source_sha:
            core._require(transport.is_ancestor(OFFICIAL_REPOSITORY, old_source, source_sha, token),
                          f"SUPERSEDED：已发布 preview source {old_source} 不允许回退到 {source_sha}")
    for package in packages:
        core._validate_zip(package, mode="preview")
        _upload_or_reuse_asset(transport, OFFICIAL_REPOSITORY, release, token, package, name=package.name, assets=assets)
    with tempfile.TemporaryDirectory(prefix=".nxp-preview-publisher-") as temporary:
        metadata_path = Path(temporary) / f"preview-publisher-{source_sha}-{catalog_hash}.json"
        metadata_path.write_text(
            json.dumps(
                {"schemaVersion": 1, "sourceSha": source_sha, "catalogSha256": catalog_hash},
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        _upload_or_reuse_asset(transport, OFFICIAL_REPOSITORY, release, token, metadata_path, name=metadata_path.name, assets=assets)

    current_source = transport.get_source_head(OFFICIAL_REPOSITORY, "develop", token)
    _full_sha(current_source, "catalog 切换前远端 develop source SHA")
    core._require(current_source == source_sha, f"SUPERSEDED：catalog 切换前 develop 已前进到 {current_source}，未发布旧 preview {source_sha}")
    old_catalog: bytes | None = None
    catalog_mutated = False
    try:
        old_catalog_asset = assets.get("catalog.json")
        if old_catalog_asset is not None:
            old_id = old_catalog_asset.get("id")
            if not isinstance(old_id, int):
                raise core.RepositoryError("旧 catalog asset 缺少 id")
            old_catalog = transport.download_asset(OFFICIAL_REPOSITORY, old_id, token)
            if old_catalog != catalog_bytes:
                catalog_mutated = True
                transport.delete_asset(OFFICIAL_REPOSITORY, old_id, token)
                uploaded = transport.upload_asset(OFFICIAL_REPOSITORY, release_id, catalog_path, token, name="catalog.json")
                uploaded_id = uploaded.get("id") if isinstance(uploaded, dict) else None
                core._require(isinstance(uploaded_id, int), "preview catalog 上传响应缺少合法 id")
                core._require(transport.download_asset(OFFICIAL_REPOSITORY, uploaded_id, token) == catalog_bytes, "preview catalog 上传后立即复核失败")
        else:
            catalog_mutated = True
            uploaded = transport.upload_asset(OFFICIAL_REPOSITORY, release_id, catalog_path, token, name="catalog.json")
            uploaded_id = uploaded.get("id") if isinstance(uploaded, dict) else None
            core._require(isinstance(uploaded_id, int), "preview catalog 上传响应缺少合法 id")
            core._require(transport.download_asset(OFFICIAL_REPOSITORY, uploaded_id, token) == catalog_bytes, "preview catalog 上传后立即复核失败")
        # Drafts need not be addressable by tag until published. Verify all
        # assets through the immutable release ID before making it public.
        refreshed_assets = _release_asset_map(transport, OFFICIAL_REPOSITORY, release, token)
        catalog_asset = refreshed_assets.get("catalog.json")
        if catalog_asset is None or not isinstance(catalog_asset.get("id"), int) or transport.download_asset(OFFICIAL_REPOSITORY, catalog_asset["id"], token) != catalog_bytes:
            raise core.RepositoryError("preview catalog 上传后复核失败")
        for package in packages:
            asset = refreshed_assets.get(package.name)
            if asset is None or not isinstance(asset.get("id"), int) or transport.download_asset(OFFICIAL_REPOSITORY, asset["id"], token) != package.read_bytes():
                raise core.RepositoryError(f"preview 包上传后复核失败：{package.name}")
        transport.update_release(OFFICIAL_REPOSITORY, release_id, token, draft=False, prerelease=True)
        final_release = transport.get_release(OFFICIAL_REPOSITORY, PREVIEW_TAG, token)
        if final_release is None or final_release.get("draft") is True or final_release.get("prerelease") is not True:
            raise core.RepositoryError("preview Release 未以可下载 prerelease 状态完成")
    except Exception as exc:
        if catalog_mutated:
            try:
                _restore_catalog_asset(transport, release, token, old_catalog)
            except Exception as restore_exc:
                raise core.RepositoryError(f"preview catalog 失败且恢复失败：{restore_exc}") from exc
        raise
    return {"sourceCommit": source_sha, "catalogSha256": catalog_hash, "releaseId": release_id, "remoteWritten": True}


def publish_develop(
    root: Path,
    source_ref: str = "develop",
    output: Path | None = None,
    *,
    remote_write: bool = False,
    host_root: Path | None = None,
    token: str | None = None,
    github_transport: GitHubTransport | None = None,
    run_id: str | None = None,
    run_attempt: str | None = None,
    workflow_sha: str | None = None,
    producer_output: Path | None = None,
) -> dict[str, Any]:
    if host_root is not None:
        from verification import preflight

        preflight(root, host_root, core.git_head(host_root))
    result = core.build_preview(root, source_ref, output, host_root=host_root)
    if run_id is not None:
        from repository_candidate import write_preview_manifest

        producer_path = (producer_output or (Path(result["output"]).parent / "preview-producer.json")).resolve()
        candidate_root = Path(result["output"]).resolve()
        core._require(candidate_root not in producer_path.parents, "preview producer sidecar 必须位于候选目录之外")
        core.write_json(
            producer_path,
            {
                "schemaVersion": 1,
                "sourceSha": result["sourceCommit"],
                "runId": int(run_id),
                "runAttempt": int(run_attempt or "1"),
                "workflowSha": workflow_sha or "",
            },
        )
        write_preview_manifest(root, candidate_root,
                               partner_sha=core.git_head(host_root) if host_root is not None else None,
                               workflow_sha=workflow_sha or "", run_id=int(run_id),
                               run_attempt=int(run_attempt or "1"))
        result["producer"] = str(producer_path)
    if remote_write:
        core._require(run_id and run_attempt and workflow_sha, "preview remote write 缺少 producer workflow/run/attempt 身份")
        write_token, transport = _require_remote_inputs(True, token, github_transport)
        result.update(_publish_preview_remote(result, token=write_token, transport=transport, run_id=run_id))
    else:
        result["remoteWritten"] = False
    print(f"[publisher] develop preview 候选已生成（{'已写远端' if result.get('remoteWritten') else '未写远端'}）：{result['output']}", flush=True)
    return result


def publish_preview(
    generated_root: Path,
    *,
    source_sha: str,
    run_id: str,
    run_attempt: str,
    workflow_sha: str,
    producer_path: Path | None = None,
    remote_write: bool = False,
    token: str | None = None,
    github_transport: GitHubTransport | None = None,
    source_root: Path | None = None,
) -> dict[str, Any]:
    """独立 publisher 只读取已生成候选数据，不执行候选源码。"""
    generated_root = _ordinary_directory(generated_root, "preview 候选目录")
    candidate = core.validate_preview_candidate(generated_root, expected_source_sha=source_sha)
    producer_file = (producer_path or (generated_root.parent / "preview-producer.json")).resolve()
    core._require(generated_root not in producer_file.parents, "preview producer sidecar 必须位于候选目录之外")
    producer = core.read_json(producer_file)
    core._require(isinstance(producer, dict) and producer.get("schemaVersion") == 1, "preview producer metadata 无效")
    _full_sha(source_sha, "preview source SHA")
    _full_sha(workflow_sha, "preview workflow SHA")
    expected_run_id = _parse_positive_int(run_id, "preview runId")
    expected_run_attempt = _parse_positive_int(run_attempt, "preview runAttempt")
    core._require(producer.get("sourceSha") == source_sha and producer.get("runId") == expected_run_id and producer.get("runAttempt") == expected_run_attempt and producer.get("workflowSha") == workflow_sha, "preview producer identity 不匹配")
    if (generated_root / "candidate.json").exists():
        from repository_candidate import validate_preview_manifest

        core._require(source_root is not None, "preview candidate 清单需要原源码 checkout")
        validate_preview_manifest(source_root.resolve(), generated_root, source_sha=source_sha,
                                  workflow_sha=workflow_sha, run_id=expected_run_id,
                                  run_attempt=expected_run_attempt)
    result = {"output": str(generated_root), "sourceCommit": candidate["sourceCommit"], "remoteWritten": False}
    if remote_write:
        write_token, transport = _require_remote_inputs(True, token, github_transport)
        result.update(_publish_preview_remote(result, token=write_token, transport=transport, run_id=run_id))
    print(f"[publisher] preview 候选校验通过（{'已写远端' if result.get('remoteWritten') else '未写远端'}）：{generated_root}", flush=True)
    return result


def publish_stable(
    root: Path,
    source_sha: str,
    generated_root: Path,
    *,
    remote_write: bool = False,
    host_root: Path | None = None,
    distribution_root: Path | None = None,
    token: str | None = None,
    git_transport: GitTransport | None = None,
    base_sha: str | None = None,
    run_id: str | None = None,
    run_attempt: str | None = None,
    workflow_sha: str | None = None,
    qualification_app_id: str | None = None,
    qualification_check_id: str | None = None,
) -> dict[str, Any]:
    generated_root = _ordinary_directory(generated_root, "stable 候选目录")
    core.validate_generated(root, generated_root, distribution_root=distribution_root)
    plan = core.read_json(generated_root / "release-plan.json")
    core._require(plan.get("head") == source_sha, f"stable 候选 source SHA 不一致：{plan.get('head')} / {source_sha}")
    result = {"sourceCommit": source_sha, "generatedRoot": str(generated_root), "remoteWritten": False}
    if remote_write:
        if git_transport is None:
            raise core.RepositoryError("remote publish-stable 必须注入受保护 GitTransport")
        core._require(base_sha and run_id and run_attempt and workflow_sha and qualification_app_id and qualification_check_id, "stable remote write 缺少资格/候选身份")
        producer = _read_stable_producer(
            generated_root,
            source_sha=source_sha,
            base_sha=base_sha or "",
            run_id=run_id or "",
            run_attempt=run_attempt or "",
            workflow_sha=workflow_sha or "",
            app_id=qualification_app_id or "",
            check_id=qualification_check_id or "",
        )
        result.update(
            git_transport.publish_stable_candidate(
                root,
                generated_root,
                source_sha,
                base_sha or "",
                remote_write=True,
                token=token or "",
                run_id=producer["runId"],
                run_attempt=producer["runAttempt"],
                workflow_sha=producer["workflowSha"],
            )
        )
        result["remoteWritten"] = True
    print(f"[publisher] stable 候选校验通过（{'已写远端' if result.get('remoteWritten') else '未写远端'}）：{generated_root}", flush=True)
    return result


def write_stable_producer(
    generated_root: Path,
    *,
    source_sha: str,
    base_sha: str,
    run_id: str,
    run_attempt: str,
    workflow_sha: str,
    qualification_app_id: str,
    qualification_check_id: str,
) -> Path:
    """在构建 runner 中写入候选与资格运行的不可变关联元数据。"""

    generated_root = _ordinary_directory(generated_root, "stable 候选目录")
    _full_sha(source_sha, "source SHA")
    _full_sha(base_sha, "base SHA")
    _full_sha(workflow_sha, "qualification workflow SHA")
    producer = {
        "schemaVersion": 1,
        "sourceSha": source_sha,
        "baseSha": base_sha,
        "runId": _parse_positive_int(run_id, "qualification runId"),
        "runAttempt": _parse_positive_int(run_attempt, "qualification runAttempt"),
        "workflowSha": workflow_sha,
        "qualificationAppId": _parse_positive_int(qualification_app_id, "qualification App ID"),
        "qualificationCheckId": _parse_positive_int(qualification_check_id, "qualification check id"),
    }
    plan = core.read_json(generated_root / "release-plan.json")
    core._require(isinstance(plan, dict) and plan.get("head") == source_sha, "stable producer source SHA 与候选 plan 不一致")
    path = generated_root / "stable-producer.json"
    core.write_json(path, producer)
    return path
