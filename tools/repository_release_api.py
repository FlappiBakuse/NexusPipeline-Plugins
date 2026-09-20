"""固定 api.github.com 的 GitHub Release 只读/受保护写入适配器。"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


class ReleaseApiError(RuntimeError):
    """Release API 请求失败。"""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


API_ORIGIN = "https://api.github.com"
UPLOAD_ORIGIN = "https://uploads.github.com"


class AssetRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlsplit(newurl)
        if (req.get_method() != "GET" or target.scheme != "https"
                or target.hostname not in {"api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}
                or target.username or target.password or target.port not in (None, 443)):
            raise ReleaseApiError("Release asset redirect target is not allowed")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None and target.hostname != "api.github.com":
            redirected.remove_header("Authorization")
        return redirected


def _request(
    method: str,
    path: str,
    token: str,
    *,
    body: bytes | None = None,
    content_type: str = "application/json",
    timeout: float = 30.0,
    accept: str = "application/vnd.github+json",
    upload: bool = False,
) -> tuple[int, bytes]:
    if not path.startswith("/repos/") or "?" in path and "=" not in path:
        raise ReleaseApiError("Release API path 必须是固定 GitHub 仓库 API 路径")
    if not token:
        raise ReleaseApiError("缺少 Release API token")
    if upload and (method != "POST" or not re.fullmatch(r"/repos/[^/?]+/[^/?]+/releases/[0-9]+/assets\?name=.+", path)):
        raise ReleaseApiError("Invalid Release asset upload endpoint")
    request = urllib.request.Request(
        f"{UPLOAD_ORIGIN if upload else API_ORIGIN}{path}",
        data=body,
        headers={
            "Accept": accept,
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
            "User-Agent": "NexusPipeline-Plugins-publisher",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method=method,
    )
    for attempt in range(3):
        try:
            with urllib.request.build_opener(AssetRedirectHandler()).open(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            payload = error.read()
            if error.code == 429 or error.code >= 500:
                if attempt < 2:
                    time.sleep(2**attempt)
                    continue
            detail = payload.decode("utf-8", errors="replace")[:500]
            raise ReleaseApiError(f"GitHub Release API HTTP {error.code}: {detail}", status_code=error.code) from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < 2:
                time.sleep(2**attempt)
                continue
            raise ReleaseApiError(f"GitHub Release API 网络失败：{error}") from error
    raise ReleaseApiError("GitHub Release API 请求失败")


def get_release(repository: str, tag: str, token: str) -> dict[str, Any] | None:
    try:
        status, payload = _request("GET", f"/repos/{repository}/releases/tags/{tag}", token)
    except ReleaseApiError as exc:
        if exc.status_code == 404:
            matches = []
            page = 1
            while True:
                _, listing = _request("GET", f"/repos/{repository}/releases?per_page=100&page={page}", token)
                releases = json.loads(listing.decode("utf-8"))
                if not isinstance(releases, list) or not all(isinstance(item, dict) for item in releases):
                    raise ReleaseApiError("Release listing response is invalid")
                matches.extend(item for item in releases if item.get("tag_name") == tag)
                if len(releases) < 100:
                    break
                page += 1
                if page > 100:
                    raise ReleaseApiError("Release listing exceeds bounded lookup")
            if len(matches) > 1:
                raise ReleaseApiError("Multiple releases have the requested tag; refusing to guess")
            return matches[0] if matches else None
        raise
    if status != 200:
        raise ReleaseApiError(f"读取 Release 返回非 200：{status}")
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ReleaseApiError("Release 响应不是对象")
    return value


def get_ref(repository: str, branch: str, token: str) -> str:
    """读取固定仓库分支的完整 commit SHA。"""

    status, payload = _request("GET", f"/repos/{repository}/git/ref/heads/{branch}", token)
    if status != 200:
        raise ReleaseApiError(f"读取 Git ref 返回非 200：{status}", status_code=status)
    value = json.loads(payload.decode("utf-8"))
    sha = ((value if isinstance(value, dict) else {}).get("object") or {}).get("sha")
    if not isinstance(sha, str):
        raise ReleaseApiError("Git ref 响应缺少 commit SHA")
    return sha


def create_release(repository: str, tag: str, token: str, *, name: str, body: str, target_commitish: str) -> dict[str, Any]:
    status, payload = _request(
        "POST",
        f"/repos/{repository}/releases",
        token,
        body=json.dumps({"tag_name": tag, "name": name, "body": body, "draft": True, "prerelease": True, "target_commitish": target_commitish}, ensure_ascii=False).encode("utf-8"),
    )
    if status not in (200, 201):
        raise ReleaseApiError(f"创建 Release 返回非成功状态：{status}", status_code=status)
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ReleaseApiError("创建 Release 响应不是对象")
    return value


def update_release(repository: str, release_id: int, token: str, **fields: Any) -> dict[str, Any]:
    status, payload = _request(
        "PATCH",
        f"/repos/{repository}/releases/{release_id}",
        token,
        body=json.dumps(fields, ensure_ascii=False).encode("utf-8"),
    )
    if status != 200:
        raise ReleaseApiError(f"更新 Release 返回非成功状态：{status}", status_code=status)
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ReleaseApiError("更新 Release 响应不是对象")
    return value


def list_assets(repository: str, release_id: int, token: str) -> list[dict[str, Any]]:
    status, payload = _request("GET", f"/repos/{repository}/releases/{release_id}/assets?per_page=100", token)
    if status != 200:
        raise ReleaseApiError(f"读取 Release assets 返回非成功状态：{status}", status_code=status)
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise ReleaseApiError("Release assets 响应不是对象数组")
    return value


def delete_asset(repository: str, asset_id: int, token: str) -> None:
    status, _payload = _request("DELETE", f"/repos/{repository}/releases/assets/{asset_id}", token)
    if status != 204:
        raise ReleaseApiError(f"删除 Release asset 返回非成功状态：{status}", status_code=status)


def download_asset(repository: str, asset_id: int, token: str) -> bytes:
    status, payload = _request("GET", f"/repos/{repository}/releases/assets/{asset_id}", token, accept="application/octet-stream")
    if status != 200:
        raise ReleaseApiError(f"下载 Release asset 返回非成功状态：{status}", status_code=status)
    return payload


def upload_asset(repository: str, release_id: int, asset: Path, token: str, *, name: str) -> dict[str, Any]:
    data = asset.read_bytes()
    status, payload = _request(
        "POST",
        f"/repos/{repository}/releases/{release_id}/assets?name={urllib.parse.quote(name, safe='')}",
        token,
        body=data,
        content_type="application/zip",
        upload=True,
    )
    if status not in (200, 201):
        raise ReleaseApiError(f"上传 Release asset 返回非成功状态：{status}")
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ReleaseApiError("上传 asset 响应不是对象")
    return value
