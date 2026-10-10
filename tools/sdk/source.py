"""验证 Plugins 检查和候选使用的 Host checkout、SDK SHA、API 与 locale 契约。"""

from __future__ import annotations

import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+$")


class SdkSourceError(ValueError):
    """SDK checkout、源码 SHA 或契约无效。"""


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
    _require(compatibility["hostApiVersion"] == "2.2" and compatibility["frontendApiVersion"] == "1.7", "仅接受 Plugin API 2.2 与 Frontend API 1.7")
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
    project = ET.parse(abstractions / "NexusPipeline.Plugin.Abstractions.csproj").getroot()
    for field, expected in {"TargetFramework": "net10.0", "Version": "2.0.0",
                            "AssemblyVersion": "2.0.0.0", "FileVersion": "2.0.0.0"}.items():
        values = [node.text for node in project.findall(f"./PropertyGroup/{field}")]
        _require(values == [expected], f"SDK {field} 必须为当前契约 {expected}")
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
    localization_root = resolve_localization_root(host_root, tracked=True)
    embedded_locales = _read_locale_ids(localization_root / "locales.json", "Host embedded locale registry")
    _require(web_locales == embedded_locales == compatibility["supportedLocales"], "Host locale registry 与 compatibility metadata 不一致")
    dirty = bool(_run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=host_root))
    return {
        **compatibility,
        "sdkSourceSha": expected_sha,
        "hostRoot": str(host_root),
        "localizationRoot": localization_root.relative_to(host_root).as_posix(),
        "workingTreeDirty": dirty,
    }


def resolve_localization_root(host_root: Path, *, tracked: bool = False) -> Path:
    relative = Path("src/Shared/Localization/Resources")
    exists = (_git_tree_file_exists(host_root, relative / "locales.json")
              if tracked else (host_root / relative / "locales.json").is_file())
    _require(exists, "Host checkout 缺少当前 Shared/Localization/Resources")
    return host_root / relative


def _git_tree_file_exists(root: Path, relative: Path) -> bool:
    completed = subprocess.run(
        ["git", "cat-file", "-e", f"HEAD:{relative.as_posix()}"],
        cwd=root,
        check=False,
        capture_output=True,
    )
    return completed.returncode == 0


def preflight(root: Path, host_root: Path, sdk_sha: str | None) -> dict[str, Any]:
    from tools.repository import source as repository_source, git as repository_git
    compatibility = repository_source.read_host_compatibility(root)
    resolved_sha = sdk_sha or repository_git.git_head(host_root)
    result = validate_host_checkout(host_root, resolved_sha, compatibility)
    if result.get("workingTreeDirty"):
        raise SdkSourceError("正式验证不接受 dirty Host SDK checkout；请提供固定的干净 Host checkout")
    print(f"[verify] SDK preflight 通过：{resolved_sha}", flush=True)
    return result
