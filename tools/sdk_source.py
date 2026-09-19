"""解析并验证 Plugins Qualification 使用的 NexusPipeline SDK 来源。

host.lock.json 只声明兼容元数据；本模块负责在一次 preflight 中解析具体
源码 SHA，并让后续 P1/P2/P3 复用同一个源码 checkout。所有远端操作都固定
到官方 Host 仓库，不接受用户提供的仓库 URL。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


OFFICIAL_REPOSITORY = "FlappiBakuse/NexusPipeline"
OFFICIAL_REMOTE = f"https://github.com/{OFFICIAL_REPOSITORY}.git"
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+$")


class SdkSourceError(ValueError):
    """SDK 来源、契约或隔离 checkout 无效。"""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SdkSourceError(message)


def _run(command: list[str], cwd: Path | None = None, *, capture: bool = True) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            check=False,
            capture_output=capture,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as exc:
        raise SdkSourceError(f"命令启动失败：{' '.join(command)}；{exc}") from exc
    if completed.returncode != 0:
        detail = completed.stderr.strip() if capture else ""
        raise SdkSourceError(f"命令失败（exit={completed.returncode}）：{' '.join(command)}；{detail}")
    return completed.stdout.strip() if capture else ""


def _sha(value: Any, label: str) -> str:
    _require(isinstance(value, str) and SHA_PATTERN.fullmatch(value) is not None, f"{label} 必须是完整小写 commit SHA")
    return value


def _validate_compatibility(compatibility: dict[str, Any]) -> dict[str, Any]:
    _require(isinstance(compatibility, dict), "Host compatibility metadata 必须是对象")
    expected = {"hostApiVersion", "frontendApiVersion", "supportedLocales"}
    _require(set(compatibility) == expected, "Host compatibility metadata 键集合不正确")
    for key in ("hostApiVersion", "frontendApiVersion"):
        _require(
            isinstance(compatibility[key], str) and VERSION_PATTERN.fullmatch(compatibility[key]) is not None,
            f"Host compatibility metadata 的 {key} 无效",
        )
    locales = compatibility["supportedLocales"]
    _require(
        isinstance(locales, list)
        and bool(locales)
        and all(isinstance(locale, str) and locale.strip() == locale and locale for locale in locales)
        and len(set(locales)) == len(locales),
        "Host compatibility metadata 的 supportedLocales 无效",
    )
    return {
        "hostApiVersion": compatibility["hostApiVersion"],
        "frontendApiVersion": compatibility["frontendApiVersion"],
        "supportedLocales": list(locales),
    }


def resolve_official_host(ref: str = "main") -> str:
    """从固定官方仓库解析 ref 的完整 SHA。"""
    _require(isinstance(ref, str) and ref and "\\" not in ref and ".." not in ref, "Host ref 无效")
    if SHA_PATTERN.fullmatch(ref):
        refs = _run(["git", "ls-remote", OFFICIAL_REMOTE], capture=True).splitlines()
        _require(any(line.split("\t", 1)[0] == ref for line in refs if "\t" in line), f"官方 Host 仓库不存在提交：{ref}")
        return ref
    query = ref if ref.startswith("refs/") else f"refs/heads/{ref}"
    _require(re.fullmatch(r"refs/(heads|tags)/[A-Za-z0-9._/-]+", query) is not None, f"Host ref 不是受支持的官方 ref：{ref}")
    output = _run(["git", "ls-remote", OFFICIAL_REMOTE, query], capture=True)
    lines = [line for line in output.splitlines() if "\t" in line]
    _require(len(lines) == 1, f"官方 Host ref 解析结果不唯一或不存在：{ref}")
    return _sha(lines[0].split("\t", 1)[0], f"官方 Host ref {ref}")


def _read_text(path: Path, label: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise SdkSourceError(f"读取 {label} 失败：{path}；{exc}") from exc


def _read_json(path: Path, label: str) -> Any:
    try:
        return json.loads(_read_text(path, label))
    except json.JSONDecodeError as exc:
        raise SdkSourceError(f"{label} JSON 无效：{path}；{exc}") from exc


def _read_locale_ids(path: Path, label: str) -> list[str]:
    value = _read_json(path, label)
    _require(isinstance(value, dict) and isinstance(value.get("supported"), list), f"{label} 缺少 supported 数组")
    result: list[str] = []
    for item in value["supported"]:
        locale = item if isinstance(item, str) else item.get("id") if isinstance(item, dict) else None
        _require(isinstance(locale, str) and locale, f"{label} locale 无效：{item}")
        result.append(locale)
    return result


def _extract_version(source: str, class_name: str, label: str) -> str:
    match = re.search(
        rf"class\s+{re.escape(class_name)}\b.*?Major\s*=\s*(\d+)\s*;.*?Minor\s*=\s*(\d+)\s*;",
        source,
        re.DOTALL,
    )
    _require(match is not None, f"{label} 缺少 {class_name}.Major/Minor")
    return f"{match.group(1)}.{match.group(2)}"


def validate_host_checkout(host_root: Path, expected_sha: str, compatibility: dict[str, Any]) -> dict[str, Any]:
    """验证 checkout 的 SHA、公开 API 版本、locale registry 和 Abstractions 工程。"""
    host_root = host_root.resolve()
    expected_sha = _sha(expected_sha, "expected_sha")
    compatibility = _validate_compatibility(compatibility)
    _require(host_root.is_dir(), f"Host checkout 不存在：{host_root}")
    actual_sha = _run(["git", "rev-parse", "HEAD"], cwd=host_root)
    _require(actual_sha == expected_sha, f"Host checkout SHA 不匹配：{actual_sha} / {expected_sha}")
    abstractions = host_root / "src" / "NexusPipeline.Plugin.Abstractions"
    _require((abstractions / "NexusPipeline.Plugin.Abstractions.csproj").is_file(), "Host checkout 缺少 Plugin Abstractions 工程")
    plugin_api = _read_text(abstractions / "PluginApi.cs", "Plugin API")
    frontend_runtime = _read_text(host_root / "frontend" / "src" / "plugin-bridge" / "runtime.ts", "Frontend API")
    actual_apis = {
        "hostApiVersion": _extract_version(plugin_api, "PluginApiVersion", "Plugin API"),
        "frontendApiVersion": re.search(r"FRONTEND_API_VERSION\s*=\s*[\"']([^\"']+)[\"']", frontend_runtime).group(1)
        if re.search(r"FRONTEND_API_VERSION\s*=\s*[\"']([^\"']+)[\"']", frontend_runtime)
        else "",
    }
    _require(actual_apis["hostApiVersion"] == compatibility["hostApiVersion"], f"Host API 兼容版本不匹配：{actual_apis['hostApiVersion']} / {compatibility['hostApiVersion']}")
    _require(actual_apis["frontendApiVersion"] == compatibility["frontendApiVersion"], f"Frontend API 兼容版本不匹配：{actual_apis['frontendApiVersion']} / {compatibility['frontendApiVersion']}")
    web_locales = _read_locale_ids(host_root / "frontend" / "public" / "i18n" / "locales.json", "Host Web locale registry")
    embedded_locales = _read_locale_ids(host_root / "src" / "Shared" / "Localization" / "Resources" / "locales.json", "Host embedded locale registry")
    _require(web_locales == embedded_locales == compatibility["supportedLocales"], "Host locale registry 与 compatibility metadata 不一致")
    return {**compatibility, "sdkSourceSha": expected_sha, "hostRoot": str(host_root)}


def prepare_workspace(
    workspace_root: Path,
    expected_sha: str,
    *,
    host_source: Path | None = None,
    destination: Path | None = None,
) -> Path:
    """创建本次资格使用的隔离 Host checkout，不改写调用方已有工作区。"""
    expected_sha = _sha(expected_sha, "expected_sha")
    workspace_root = workspace_root.resolve()
    destination = (destination or workspace_root.parent / f".nxp-sdk-{expected_sha[:12]}").resolve()
    _require(not destination.exists(), f"SDK 隔离目录已存在：{destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    source = host_source.resolve() if host_source is not None else None
    if source is not None:
        _require(source.is_dir(), f"Host source checkout 不存在：{source}")
        _run(["git", "clone", "--no-hardlinks", str(source), str(destination)], capture=True)
    else:
        _run(["git", "clone", "--filter=blob:none", OFFICIAL_REMOTE, str(destination)], capture=True)
    _run(["git", "checkout", "--detach", expected_sha], cwd=destination, capture=True)
    return destination


def cleanup_workspace(path: Path) -> None:
    """仅删除本模块明确创建的隔离 SDK 目录。"""
    path = path.resolve()
    _require(path.name.startswith(".nxp-sdk-"), f"拒绝清理非 SDK 临时目录：{path}")
    if path.exists():
        shutil.rmtree(path)


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="NexusPipeline SDK 来源校验")
    parser.add_argument("--host-root", type=Path, required=True)
    parser.add_argument("--expected-sha", required=True)
    parser.add_argument("--compatibility", type=Path, required=True)
    args = parser.parse_args(argv)
    compatibility = _read_json(args.compatibility.resolve(), "compatibility metadata")
    result = validate_host_checkout(args.host_root, args.expected_sha, compatibility)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
