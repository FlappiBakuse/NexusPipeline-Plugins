from __future__ import annotations

import filecmp
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path, PureWindowsPath
from typing import Any, Sequence
from urllib.parse import urlsplit

import tools.repository.model as repository_model

def configure_console() -> None:
    """让 Windows 原生控制台能够安全输出仓库工具的 UTF-8 日志。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")


def _display(path: Path | str) -> str:
    return str(path).replace("\\", "/")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise repository_model.RepositoryError(message)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise repository_model.RepositoryError(f"JSON 无效：{_display(path)}；{exc}") from exc


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    os.replace(temporary, path)


def _text(value: Any, label: str, maximum: int, required: bool = True) -> str:
    _require(isinstance(value, str), f"{label}必须是字符串")
    result = value.strip()
    if required:
        _require(bool(result), f"{label}不能为空")
    _require(len(result) <= maximum, f"{label}长度超过 {maximum}")
    _require("<" not in result and ">" not in result, f"{label}不得包含 HTML 字符")
    return result


def is_https_url(value: Any) -> bool:
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value:
        return True
    if len(value) > 2048:
        return False
    parsed = urlsplit(value)
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and not parsed.username
        and not parsed.password
        and not parsed.fragment
    )


def _safe_relative(root: Path, value: Any, label: str, suffix: str | None = None) -> Path:
    _require(isinstance(value, str) and value.strip(), f"{label}不能为空")
    text = value.strip()
    normalized = text.replace("\\", "/")
    _require("\x00" not in normalized, f"{label}包含非法字符")
    _require(not os.path.isabs(text) and not PureWindowsPath(text).is_absolute(), f"{label}必须是插件目录内的相对路径：{text}")
    parts = normalized.split("/")
    _require(all(part not in {"", ".", ".."} for part in parts), f"{label}包含不安全的路径段：{text}")
    if suffix:
        _require(normalized.lower().endswith(suffix.lower()), f"{label}必须使用 {suffix} 扩展名：{text}")
    candidate = (root / Path(*parts)).resolve()
    resolved_root = root.resolve()
    _require(candidate == resolved_root or resolved_root in candidate.parents, f"{label}越出插件目录：{text}")
    _require(candidate.is_file(), f"{label}文件不存在：{_display(candidate)}")
    return candidate


def _run(command: Sequence[str], label: str, cwd: Path, *, env: dict[str, str] | None = None) -> None:
    print(f"[repository] {label}", flush=True)
    try:
        completed = subprocess.run(list(command), cwd=cwd, check=False, env=env)
    except OSError as exc:
        raise repository_model.RepositoryError(f"{label}启动失败：{exc}") from exc
    if completed.returncode != 0:
        raise repository_model.RepositoryError(f"{label}失败（exit={completed.returncode}）")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_metadata(path: Path) -> repository_model.PackageMetadata:
    return repository_model.PackageMetadata(path=path, sha256=sha256(path), size_bytes=path.stat().st_size)


def _same_package_bytes(first: Path, second: Path) -> bool:
    try:
        if first.stat().st_size != second.stat().st_size:
            return False
    except OSError:
        return False
    return filecmp.cmp(first, second, shallow=False)
