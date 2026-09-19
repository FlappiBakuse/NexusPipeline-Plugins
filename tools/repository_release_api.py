"""固定 api.github.com 的 GitHub Release 只读/受保护写入适配器。"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


class ReleaseApiError(RuntimeError):
    """Release API 请求失败。"""


API_ORIGIN = "https://api.github.com"


def _request(
    method: str,
    path: str,
    token: str,
    *,
    body: bytes | None = None,
    content_type: str = "application/json",
    timeout: float = 30.0,
) -> tuple[int, bytes]:
    if not path.startswith("/repos/") or "?" in path and "=" not in path:
        raise ReleaseApiError("Release API path 必须是固定 GitHub 仓库 API 路径")
    if not token:
        raise ReleaseApiError("缺少 Release API token")
    request = urllib.request.Request(
        f"{API_ORIGIN}{path}",
        data=body,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
            "User-Agent": "NexusPipeline-Plugins-publisher",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method=method,
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            payload = error.read()
            if error.code == 429 or error.code >= 500:
                if attempt < 2:
                    time.sleep(2**attempt)
                    continue
            detail = payload.decode("utf-8", errors="replace")[:500]
            raise ReleaseApiError(f"GitHub Release API HTTP {error.code}: {detail}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < 2:
                time.sleep(2**attempt)
                continue
            raise ReleaseApiError(f"GitHub Release API 网络失败：{error}") from error
    raise ReleaseApiError("GitHub Release API 请求失败")


def get_release(repository: str, tag: str, token: str) -> dict[str, Any]:
    status, payload = _request("GET", f"/repos/{repository}/releases/tags/{tag}", token)
    if status != 200:
        raise ReleaseApiError(f"读取 Release 返回非 200：{status}")
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ReleaseApiError("Release 响应不是对象")
    return value


def upload_asset(repository: str, release_id: int, asset: Path, token: str, *, name: str) -> dict[str, Any]:
    data = asset.read_bytes()
    status, payload = _request(
        "POST",
        f"/repos/{repository}/releases/{release_id}/assets?name={urllib.parse.quote(name)}",
        token,
        body=data,
        content_type="application/zip",
    )
    if status not in (200, 201):
        raise ReleaseApiError(f"上传 Release asset 返回非成功状态：{status}")
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ReleaseApiError("上传 asset 响应不是对象")
    return value
