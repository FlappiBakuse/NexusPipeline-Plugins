from __future__ import annotations
from pathlib import Path
import tools.repository.archive as repository_archive
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import hashlib
import json
import tempfile
from typing import Any, Protocol
from tools.release.github_api import create_release, delete_asset, download_asset, get_ref, get_release, is_ancestor, list_assets, update_release, upload_asset
import tools.release.inventory as release_inventory

import re
from typing import Any

import tools.repository.catalog as repository_catalog

def validate_preview_candidate(generated_root: Path, *, expected_source_sha: str | None = None) -> dict[str, Any]:
    """在不执行候选源码的前提下，重新验证 preview JSON、ZIP 与引用关系。"""
    generated_root = generated_root.resolve()
    repository_io._require(generated_root.is_dir(), f"preview 候选目录不存在：{repository_io._display(generated_root)}")
    catalog = repository_io.read_json(generated_root / "catalog.json")
    repository_io._require(isinstance(catalog, dict), "preview catalog 必须是对象")
    repository_io._require(catalog.get("schemaVersion") == 2 and catalog.get("repository") == repository_model.REPOSITORY and catalog.get("channel") == "develop", "preview catalog 固定字段无效")
    source_commit = catalog.get("sourceCommit")
    repository_io._require(isinstance(source_commit, str) and re.fullmatch(r"[0-9a-f]{40}", source_commit) is not None, "preview sourceCommit 无效")
    if expected_source_sha is not None:
        repository_io._require(source_commit == expected_source_sha, "preview sourceCommit 与请求不一致")
    entries = catalog.get("plugins")
    repository_io._require(isinstance(entries, list) and bool(entries), "preview catalog.plugins 必须是非空数组")
    repository_io._require(entries == repository_catalog._catalog_order(entries), "preview catalog 顺序不稳定")
    packages_root = generated_root / "packages"
    repository_io._require(packages_root.is_dir(), "preview 候选缺少 packages 目录")
    referenced: set[str] = set()
    for entry in entries:
        repository_io._require(isinstance(entry, dict), "preview catalog entry 必须是对象")
        artifact = entry.get("artifactName")
        version = entry.get("version")
        digest = entry.get("sha256")
        repository_io._require(isinstance(artifact, str) and re.fullmatch(r"[A-Za-z0-9._-]+", artifact) is not None, "preview artifactName 无效")
        repository_io._require(isinstance(version, str) and re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?", version) is not None, f"preview version 无效：{artifact}")
        repository_io._require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest) is not None, f"preview SHA256 无效：{artifact}")
        package_name = f"{artifact}-{version}-{digest}.zip"
        package = packages_root / package_name
        repository_io._require(package.is_file() and package.resolve().parent == packages_root.resolve(), f"preview ZIP 缺失或越界：{artifact}")
        repository_io._require(entry.get("packageUrl") == f"{repository_model.PREVIEW_RELEASE_URL_PREFIX}/{package_name}", f"preview packageUrl 无效：{artifact}")
        repository_io._require(entry.get("sourceCommit") == source_commit, f"preview entry sourceCommit 不一致：{artifact}")
        repository_io._require(entry.get("sizeBytes") == package.stat().st_size, f"preview sizeBytes 不一致：{artifact}")
        repository_archive._validate_zip(package, mode="preview", expected_artifact=artifact, expected_version=version, expected_sha256=digest)
        repository_io._require(package_name not in referenced, f"preview ZIP 重复引用：{package_name}")
        referenced.add(package_name)
    actual = {path.name for path in packages_root.iterdir() if path.is_file()}
    repository_io._require(actual == referenced, "preview packages 含未被 catalog 引用的文件")
    return {"catalog": catalog, "sourceCommit": source_commit, "packageNames": sorted(referenced)}




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


def _require_remote_inputs(remote_write: bool, token: str | None, github_transport: GitHubTransport | None) -> tuple[str, GitHubTransport]:
    if not remote_write:
        raise repository_model.RepositoryError("内部错误：未启用 remote write")
    if not token:
        raise repository_model.RepositoryError("remote write 缺少受保护 publisher token")
    return token, github_transport or HttpGitHubTransport()


def _release_asset_map(transport: GitHubTransport, repository: str, release: dict[str, Any], token: str) -> dict[str, dict[str, Any]]:
    release_id = release.get("id")
    if not isinstance(release_id, int):
        raise repository_model.RepositoryError("Release 响应缺少合法 id")
    assets = transport.list_assets(repository, release_id, token)
    result: dict[str, dict[str, Any]] = {}
    for asset in assets:
        name = asset.get("name")
        if isinstance(name, str):
            if name in result:
                raise repository_model.RepositoryError(f"Release asset 名称重复：{name}")
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
            raise repository_model.RepositoryError(f"preview asset 缺少合法 id：{name}")
        if transport.download_asset(repository, asset_id, token) != asset.read_bytes():
            raise repository_model.RepositoryError(f"同名 preview asset 内容不同，拒绝覆盖：{name}")
        return existing
    uploaded = transport.upload_asset(repository, release_id, asset, token, name=name)
    asset_id = uploaded.get("id") if isinstance(uploaded, dict) else None
    if not isinstance(asset_id, int):
        raise repository_model.RepositoryError(f"preview asset 上传响应缺少合法 id：{name}")
    if transport.download_asset(repository, asset_id, token) != asset.read_bytes():
        raise repository_model.RepositoryError(f"preview asset 上传后立即复核失败：{name}")
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
        raise repository_model.RepositoryError("catalog 恢复缺少 Release id")
    assets = _release_asset_map(transport, release_inventory.OFFICIAL_REPOSITORY, release, token)
    current = assets.get("catalog.json")
    if current is not None:
        current_id = current.get("id")
        repository_io._require(isinstance(current_id, int), "catalog 恢复的当前 asset 缺少 id")
        if old_catalog is not None and transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, current_id, token) == old_catalog:
            return
        transport.delete_asset(release_inventory.OFFICIAL_REPOSITORY, current_id, token)
    if old_catalog is None:
        return
    with tempfile.TemporaryDirectory(prefix=".nxp-preview-restore-") as temporary:
        restore = Path(temporary) / "catalog.json"
        restore.write_bytes(old_catalog)
        _upload_or_reuse_asset(transport, release_inventory.OFFICIAL_REPOSITORY, release, token, restore, name="catalog.json", assets={})


def _publish_preview_remote(result: dict[str, Any], *, token: str, transport: GitHubTransport, run_id: str | None) -> dict[str, Any]:
    generated_root = release_inventory._ordinary_directory(Path(result["output"]), "preview 候选目录")
    source_sha = result.get("sourceCommit")
    repository_io._require(isinstance(source_sha, str), "preview sourceCommit")
    release_inventory._full_sha(source_sha, "preview source SHA")
    release_inventory._preview_inventory(generated_root)
    validate_preview_candidate(generated_root, expected_source_sha=source_sha)
    current_source = transport.get_source_head(release_inventory.OFFICIAL_REPOSITORY, "develop", token)
    release_inventory._full_sha(current_source, "远端 develop source SHA")
    repository_io._require(current_source == source_sha, f"SUPERSEDED：develop 已前进到 {current_source}，未发布旧 preview {source_sha}")
    catalog_path = generated_root / "catalog.json"
    packages = sorted((generated_root / "packages").glob("*.zip"))
    repository_io._require(catalog_path.is_file() and not catalog_path.is_symlink(), "preview catalog 候选无效")
    catalog_bytes = catalog_path.read_bytes()
    catalog_hash = hashlib.sha256(catalog_bytes).hexdigest()
    release = transport.get_release(release_inventory.OFFICIAL_REPOSITORY, release_inventory.PREVIEW_TAG, token)
    if release is None:
        release = transport.create_release(
            release_inventory.OFFICIAL_REPOSITORY,
            release_inventory.PREVIEW_TAG,
            token,
            name="Plugins develop preview",
            body=f"sourceCommit={source_sha}\ncatalogSha256={catalog_hash}",
            target_commitish=source_sha,
        )
    release_id = release.get("id")
    if not isinstance(release_id, int):
        raise repository_model.RepositoryError("preview Release 缺少合法 id")
    assets = _release_asset_map(transport, release_inventory.OFFICIAL_REPOSITORY, release, token)
    old_catalog_asset = assets.get("catalog.json")
    if old_catalog_asset is not None:
        old_id = old_catalog_asset.get("id")
        repository_io._require(isinstance(old_id, int), "旧 preview catalog asset id 无效")
        try:
            old_catalog_data = json.loads(transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, old_id, token).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise repository_model.RepositoryError("旧 preview catalog 不是有效 JSON") from exc
        old_source = old_catalog_data.get("sourceCommit") if isinstance(old_catalog_data, dict) else None
        release_inventory._full_sha(old_source, "旧 preview source SHA")
        if old_source != source_sha:
            repository_io._require(transport.is_ancestor(release_inventory.OFFICIAL_REPOSITORY, old_source, source_sha, token),
                          f"SUPERSEDED：已发布 preview source {old_source} 不允许回退到 {source_sha}")
    for package in packages:
        repository_archive._validate_zip(package, mode="preview")
        _upload_or_reuse_asset(transport, release_inventory.OFFICIAL_REPOSITORY, release, token, package, name=package.name, assets=assets)
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
        _upload_or_reuse_asset(transport, release_inventory.OFFICIAL_REPOSITORY, release, token, metadata_path, name=metadata_path.name, assets=assets)

    current_source = transport.get_source_head(release_inventory.OFFICIAL_REPOSITORY, "develop", token)
    release_inventory._full_sha(current_source, "catalog 切换前远端 develop source SHA")
    repository_io._require(current_source == source_sha, f"SUPERSEDED：catalog 切换前 develop 已前进到 {current_source}，未发布旧 preview {source_sha}")
    old_catalog: bytes | None = None
    catalog_mutated = False
    try:
        old_catalog_asset = assets.get("catalog.json")
        if old_catalog_asset is not None:
            old_id = old_catalog_asset.get("id")
            if not isinstance(old_id, int):
                raise repository_model.RepositoryError("旧 catalog asset 缺少 id")
            old_catalog = transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, old_id, token)
            if old_catalog != catalog_bytes:
                catalog_mutated = True
                transport.delete_asset(release_inventory.OFFICIAL_REPOSITORY, old_id, token)
                uploaded = transport.upload_asset(release_inventory.OFFICIAL_REPOSITORY, release_id, catalog_path, token, name="catalog.json")
                uploaded_id = uploaded.get("id") if isinstance(uploaded, dict) else None
                repository_io._require(isinstance(uploaded_id, int), "preview catalog 上传响应缺少合法 id")
                repository_io._require(transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, uploaded_id, token) == catalog_bytes, "preview catalog 上传后立即复核失败")
        else:
            catalog_mutated = True
            uploaded = transport.upload_asset(release_inventory.OFFICIAL_REPOSITORY, release_id, catalog_path, token, name="catalog.json")
            uploaded_id = uploaded.get("id") if isinstance(uploaded, dict) else None
            repository_io._require(isinstance(uploaded_id, int), "preview catalog 上传响应缺少合法 id")
            repository_io._require(transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, uploaded_id, token) == catalog_bytes, "preview catalog 上传后立即复核失败")
        # Drafts need not be addressable by tag until published. Verify all
        # assets through the immutable release ID before making it public.
        refreshed_assets = _release_asset_map(transport, release_inventory.OFFICIAL_REPOSITORY, release, token)
        catalog_asset = refreshed_assets.get("catalog.json")
        if catalog_asset is None or not isinstance(catalog_asset.get("id"), int) or transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, catalog_asset["id"], token) != catalog_bytes:
            raise repository_model.RepositoryError("preview catalog 上传后复核失败")
        for package in packages:
            asset = refreshed_assets.get(package.name)
            if asset is None or not isinstance(asset.get("id"), int) or transport.download_asset(release_inventory.OFFICIAL_REPOSITORY, asset["id"], token) != package.read_bytes():
                raise repository_model.RepositoryError(f"preview 包上传后复核失败：{package.name}")
        transport.update_release(release_inventory.OFFICIAL_REPOSITORY, release_id, token, draft=False, prerelease=True)
        final_release = transport.get_release(release_inventory.OFFICIAL_REPOSITORY, release_inventory.PREVIEW_TAG, token)
        if final_release is None or final_release.get("draft") is True or final_release.get("prerelease") is not True:
            raise repository_model.RepositoryError("preview Release 未以可下载 prerelease 状态完成")
    except Exception as exc:
        if catalog_mutated:
            try:
                _restore_catalog_asset(transport, release, token, old_catalog)
            except Exception as restore_exc:
                raise repository_model.RepositoryError(f"preview catalog 失败且恢复失败：{restore_exc}") from exc
        raise
    return {"sourceCommit": source_sha, "catalogSha256": catalog_hash, "releaseId": release_id, "remoteWritten": True}


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
    generated_root = release_inventory._ordinary_directory(generated_root, "preview 候选目录")
    candidate = validate_preview_candidate(generated_root, expected_source_sha=source_sha)
    repository_io._require(producer_path is not None, "preview publisher 必须提供 producer sidecar")
    producer_file = producer_path.resolve()
    repository_io._require(generated_root not in producer_file.parents, "preview producer sidecar 必须位于候选目录之外")
    producer = repository_io.read_json(producer_file)
    repository_io._require(isinstance(producer, dict) and producer.get("schemaVersion") == 1, "preview producer metadata 无效")
    release_inventory._full_sha(source_sha, "preview source SHA")
    release_inventory._full_sha(workflow_sha, "preview workflow SHA")
    expected_run_id = release_inventory._parse_positive_int(run_id, "preview runId")
    expected_run_attempt = release_inventory._parse_positive_int(run_attempt, "preview runAttempt")
    repository_io._require(producer.get("sourceSha") == source_sha and producer.get("runId") == expected_run_id and producer.get("runAttempt") == expected_run_attempt and producer.get("workflowSha") == workflow_sha, "preview producer identity 不匹配")
    from tools.release.candidate import validate_preview_manifest

    repository_io._require(source_root is not None, "preview candidate 清单需要原源码 checkout")
    validate_preview_manifest(source_root.resolve(), generated_root, source_sha=source_sha,
                              workflow_sha=workflow_sha, run_id=expected_run_id,
                              run_attempt=expected_run_attempt)
    result = {"output": str(generated_root), "sourceCommit": candidate["sourceCommit"], "remoteWritten": False}
    if remote_write:
        write_token, transport = _require_remote_inputs(True, token, github_transport)
        result.update(_publish_preview_remote(result, token=write_token, transport=transport, run_id=run_id))
    print(f"[publisher] preview 候选校验通过（{'已写远端' if result.get('remoteWritten') else '未写远端'}）：{generated_root}", flush=True)
    return result
