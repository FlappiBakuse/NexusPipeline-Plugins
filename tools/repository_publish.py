"""发布候选的本地安全编排。

本模块只生成和验证数据候选。真正的 GitHub Release/catalog/state 写入必须在
受保护 publisher runner 使用独立适配器执行，并显式传入 remote-write；本地
开发工具不会因为误运行而产生远端副作用。
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Protocol

from repository_release_api import (
    create_release,
    delete_asset,
    download_asset,
    get_release,
    list_assets,
    update_release,
    upload_asset,
)

import repository_core as core


OFFICIAL_REPOSITORY = core.REPOSITORY
PREVIEW_TAG = "plugins-develop"


class GitHubTransport(Protocol):
    def get_release(self, repository: str, tag: str, token: str) -> dict[str, Any] | None: ...
    def create_release(self, repository: str, tag: str, token: str, *, name: str, body: str, target_commitish: str) -> dict[str, Any]: ...
    def update_release(self, repository: str, release_id: int, token: str, **fields: Any) -> dict[str, Any]: ...
    def list_assets(self, repository: str, release_id: int, token: str) -> list[dict[str, Any]]: ...
    def download_asset(self, repository: str, asset_id: int, token: str) -> bytes: ...
    def delete_asset(self, repository: str, asset_id: int, token: str) -> None: ...
    def upload_asset(self, repository: str, release_id: int, asset: Path, token: str, *, name: str) -> dict[str, Any]: ...


class HttpGitHubTransport:
    """真实 GitHub Release transport；远端写入只由显式 publisher 调用。"""

    get_release = staticmethod(get_release)
    create_release = staticmethod(create_release)
    update_release = staticmethod(update_release)
    list_assets = staticmethod(list_assets)
    download_asset = staticmethod(download_asset)
    delete_asset = staticmethod(delete_asset)
    upload_asset = staticmethod(upload_asset)


class GitTransport(Protocol):
    """稳定 writer 的隔离 Git 写入端口；不得由候选源码实现。"""

    def publish_stable_candidate(self, root: Path, generated_root: Path, source_sha: str, *, remote_write: bool, token: str) -> dict[str, Any]: ...


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

    def publish_stable_candidate(self, root: Path, generated_root: Path, source_sha: str, *, remote_write: bool, token: str) -> dict[str, Any]:
        core._require(remote_write and bool(token), "stable remote write 必须有 publisher token")
        generated_root = generated_root.resolve()
        plan = core.read_json(generated_root / "release-plan.json")
        expected_paths = {"catalog.json", core.STATE_FILE}
        packages = generated_root / "packages"
        if packages.is_dir():
            for path in packages.rglob("*"):
                if path.is_file():
                    expected_paths.add(path.relative_to(generated_root).as_posix())
        for key in ("removePackages", "removeArtifacts"):
            values = plan.get(key, [])
            core._require(isinstance(values, list), f"stable plan {key} 必须是数组")
            for value in values:
                core._require(isinstance(value, str) and value.startswith("packages/"), f"stable plan 路径不在白名单：{value}")
                expected_paths.add(value)
        source_sha = core._require(source_sha, "stable source SHA")
        with tempfile.TemporaryDirectory(prefix=".nxp-stable-writer-") as temporary:
            checkout = Path(temporary) / "checkout"
            env = os.environ.copy()
            env.update({
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: bearer {token}",
            })
            self._run(["git", "clone", "--no-hardlinks", self.remote, str(checkout)], Path(temporary), env=env)
            self._run(["git", "fetch", "origin", "main"], checkout, env=env)
            current = self._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
            self._run(["git", "checkout", "-B", "publisher-stable", current], checkout, env=env)
            for relative in ("catalog.json", core.STATE_FILE):
                shutil.copyfile(generated_root / relative, checkout / relative)
            for path in sorted(path for path in packages.rglob("*") if path.is_file()):
                relative = path.relative_to(generated_root)
                destination = checkout / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
            for relative in plan.get("removePackages", []):
                target = checkout / relative
                if target.exists():
                    target.unlink()
            for relative in plan.get("removeArtifacts", []):
                target = checkout / relative
                if target.exists():
                    core._require(target.is_dir() and not target.is_symlink(), f"stable 删除目标不是普通目录：{relative}")
                    shutil.rmtree(target)
            self._run(["git", "add", "--all", "--", "catalog.json", core.STATE_FILE, "packages"], checkout, env=env)
            raw = self._run(["git", "diff", "--cached", "--name-status", "--find-renames", "-z"], checkout, env=env)
            tokens = raw.split("\x00") if raw else []
            changed: list[str] = []
            index = 0
            while index < len(tokens) and tokens[index]:
                status = tokens[index]
                index += 1
                count = 2 if status.startswith(("R", "C")) else 1
                names = [tokens[index + offset] for offset in range(count)]
                index += count
                changed.extend(names)
            remove_directories = tuple(value for value in plan.get("removeArtifacts", []) if isinstance(value, str))
            unexpected = [path for path in changed if path not in expected_paths and not any(path.startswith(directory.rstrip("/") + "/") for directory in remove_directories)]
            core._require(changed and not unexpected, f"stable 生成物 diff 超出白名单：{sorted(set(unexpected))}")
            core._require(not any((checkout / path).is_symlink() for path in changed if (checkout / path).exists()), "stable 生成物不得包含 symlink")
            self._run(["git", "commit", "--no-verify", "-m", "chore: 更新稳定插件生成物"], checkout, env=env)
            published = self._run(["git", "rev-parse", "HEAD"], checkout, env=env)
            self._run(["git", "push", "origin", "HEAD:refs/heads/main"], checkout, env=env)
            remote_head = self._run(["git", "ls-remote", "origin", "refs/heads/main"], checkout, env=env).split("\t", 1)[0]
            core._require(remote_head == published, "stable push 后远端 main SHA 不一致")
            return {"sourceCommit": source_sha, "publishedCommit": published, "parent": current, "remoteWritten": True}


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


def _upload_or_reuse_asset(transport: GitHubTransport, repository: str, release: dict[str, Any], token: str, asset: Path, *, name: str, assets: dict[str, dict[str, Any]]) -> None:
    release_id = release["id"]
    existing = assets.get(name)
    if existing is not None:
        asset_id = existing.get("id")
        if not isinstance(asset_id, int) or transport.download_asset(repository, asset_id, token) != asset.read_bytes():
            raise core.RepositoryError(f"同名 preview asset 内容不同，拒绝覆盖：{name}")
        return
    transport.upload_asset(repository, release_id, asset, token, name=name)


def _publish_preview_remote(result: dict[str, Any], *, token: str, transport: GitHubTransport, run_id: str | None) -> dict[str, Any]:
    generated_root = Path(result["output"]).resolve()
    source_sha = core._require(result.get("sourceCommit"), "preview sourceCommit")
    catalog_path = generated_root / "catalog.json"
    packages = sorted((generated_root / "packages").glob("*.zip"))
    catalog_bytes = catalog_path.read_bytes()
    catalog_hash = hashlib.sha256(catalog_bytes).hexdigest()
    release = transport.get_release(OFFICIAL_REPOSITORY, PREVIEW_TAG, token)
    if release is None:
        release = transport.create_release(
            OFFICIAL_REPOSITORY,
            PREVIEW_TAG,
            token,
            name="Plugins develop preview",
            body=f"sourceCommit={source_sha}\ncatalogSha256={catalog_hash}\nrunId={run_id or ''}",
            target_commitish=source_sha,
        )
    release_id = release.get("id")
    if not isinstance(release_id, int):
        raise core.RepositoryError("preview Release 缺少合法 id")
    assets = _release_asset_map(transport, OFFICIAL_REPOSITORY, release, token)
    for package in packages:
        core._validate_zip(package, mode="preview")
        _upload_or_reuse_asset(transport, OFFICIAL_REPOSITORY, release, token, package, name=package.name, assets=assets)
    metadata_path = generated_root / f"preview-publisher-{source_sha}.json"
    metadata_path.write_text(json.dumps({"schemaVersion": 1, "sourceSha": source_sha, "catalogSha256": catalog_hash, "runId": run_id or ""}, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    _upload_or_reuse_asset(transport, OFFICIAL_REPOSITORY, release, token, metadata_path, name=metadata_path.name, assets=assets)
    old_catalog: bytes | None = None
    old_catalog_asset = assets.get("catalog.json")
    if old_catalog_asset is not None:
        old_id = old_catalog_asset.get("id")
        if not isinstance(old_id, int):
            raise core.RepositoryError("旧 catalog asset 缺少 id")
        old_catalog = transport.download_asset(OFFICIAL_REPOSITORY, old_id, token)
        if old_catalog != catalog_bytes:
            transport.delete_asset(OFFICIAL_REPOSITORY, old_id, token)
            try:
                transport.upload_asset(OFFICIAL_REPOSITORY, release_id, catalog_path, token, name="catalog.json")
            except Exception:
                restore = generated_root / ".restore-catalog.json"
                restore.write_bytes(old_catalog)
                try:
                    transport.upload_asset(OFFICIAL_REPOSITORY, release_id, restore, token, name="catalog.json")
                finally:
                    restore.unlink(missing_ok=True)
                raise
    else:
        transport.upload_asset(OFFICIAL_REPOSITORY, release_id, catalog_path, token, name="catalog.json")
    refreshed = transport.get_release(OFFICIAL_REPOSITORY, PREVIEW_TAG, token)
    if refreshed is None:
        raise core.RepositoryError("preview Release 在写入后不可读")
    refreshed_assets = _release_asset_map(transport, OFFICIAL_REPOSITORY, refreshed, token)
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
) -> dict[str, Any]:
    result = core.build_preview(root, source_ref, output, host_root=host_root)
    if run_id is not None:
        core.write_json(Path(result["output"]) / "preview-producer.json", {"schemaVersion": 1, "sourceSha": result["sourceCommit"], "runId": int(run_id), "runAttempt": int(run_attempt or "1"), "workflowSha": workflow_sha or ""})
    if remote_write:
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
    remote_write: bool = False,
    token: str | None = None,
    github_transport: GitHubTransport | None = None,
) -> dict[str, Any]:
    """独立 publisher 只读取已生成候选数据，不执行候选源码。"""
    generated_root = generated_root.resolve()
    candidate = core.validate_preview_candidate(generated_root, expected_source_sha=source_sha)
    producer = core.read_json(generated_root / "preview-producer.json")
    core._require(isinstance(producer, dict) and producer.get("schemaVersion") == 1, "preview producer metadata 无效")
    core._require(producer.get("sourceSha") == source_sha and producer.get("runId") == int(run_id) and producer.get("runAttempt") == int(run_attempt) and producer.get("workflowSha") == workflow_sha, "preview producer identity 不匹配")
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
) -> dict[str, Any]:
    generated_root = generated_root.resolve()
    core.validate_generated(root, generated_root, distribution_root=distribution_root)
    plan = core.read_json(generated_root / "release-plan.json")
    core._require(plan.get("head") == source_sha, f"stable 候选 source SHA 不一致：{plan.get('head')} / {source_sha}")
    result = {"sourceCommit": source_sha, "generatedRoot": str(generated_root), "remoteWritten": False}
    if remote_write:
        if git_transport is None:
            raise core.RepositoryError("remote publish-stable 必须注入受保护 GitTransport")
        result.update(git_transport.publish_stable_candidate(root, generated_root, source_sha, remote_write=True, token=token or ""))
        result["remoteWritten"] = True
    print(f"[publisher] stable 候选校验通过（未写远端）：{generated_root}", flush=True)
    return result
