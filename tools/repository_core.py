"""增量插件发行工具的核心规则。

仓库源码是唯一的插件输入。发行状态记录上一次成功写回 main 的事实，
普通发布只处理从该状态到当前提交之间受影响的插件；全仓 ZIP/SHA 校验由
独立的 audit 命令承担。
"""

from __future__ import annotations

import copy
import datetime as dt
import filecmp
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from typing import Any, Iterable, Sequence
from urllib.parse import urlsplit


REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"
PACKAGE_URL_PREFIX = f"https://raw.githubusercontent.com/{REPOSITORY}/main/packages"
STATE_FILE = ".release-state.json"
STATE_SCHEMA_VERSION = 1
MAX_RETAINED_PACKAGES = 3
SUPPORTED_KINDS = {"managed-code", "data-specialized"}
SEMVER_PATTERN = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ARTIFACT_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,63}$")
PLUGIN_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PACKAGE_PATTERN = re.compile(
    r"^(?P<artifact>[A-Za-z][A-Za-z0-9]{0,63})-"
    r"(?P<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\.zip$"
)
TEXT_SUFFIXES = {
    ".css",
    ".csv",
    ".htm",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".svg",
    ".toml",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}
CAPABILITY_MIN_HOST = {
    "self-managed-pc-launch": (0, 14, 1),
    "no-fresh-config": (0, 14, 2),
}


class RepositoryError(ValueError):
    """仓库契约或发行状态无效。"""


@dataclass(frozen=True)
class SourcePlugin:
    category: str
    root: Path
    manifest: dict[str, Any]
    store: dict[str, Any]

    @property
    def name(self) -> str:
        return str(self.manifest["name"])

    @property
    def artifact_name(self) -> str:
        return str(self.manifest["artifactName"])

    @property
    def version(self) -> str:
        return str(self.manifest["version"])

    @property
    def kind(self) -> str:
        return str(self.manifest["kind"]).strip().lower()

    @property
    def updated_at(self) -> str:
        entries = self.store.get("changelog", [])
        return str(entries[0]["date"]) if entries else ""

    @property
    def authors(self) -> list[dict[str, str]]:
        return [
            {"name": str(item["name"]), "url": str(item.get("url", ""))}
            for item in self.store.get("authors", [])
        ]


@dataclass(frozen=True)
class PackageMetadata:
    path: Path
    sha256: str
    size_bytes: int


def _display(path: Path | str) -> str:
    return str(path).replace("\\", "/")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RepositoryError(message)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RepositoryError(f"JSON 无效：{_display(path)}；{exc}") from exc


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    os.replace(temporary, path)


def parse_semver(value: Any, label: str = "版本") -> tuple[int, int, int]:
    text = value if isinstance(value, str) else ""
    match = SEMVER_PATTERN.fullmatch(text)
    if match is None:
        raise RepositoryError(f"{label}不是三段 SemVer：{text}")
    return tuple(int(part) for part in match.groups())


def is_semver(value: Any) -> bool:
    return isinstance(value, str) and SEMVER_PATTERN.fullmatch(value) is not None


def parse_date(value: Any, label: str = "日期") -> str:
    text = value if isinstance(value, str) else ""
    if DATE_PATTERN.fullmatch(text) is None:
        raise RepositoryError(f"{label}必须使用 YYYY-MM-DD 格式：{text}")
    try:
        dt.date.fromisoformat(text)
    except ValueError as exc:
        raise RepositoryError(f"{label}不是有效日期：{text}") from exc
    return text


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


def _validate_store(store: dict[str, Any], plugin_name: str, version: str) -> None:
    _require(store.get("schemaVersion") == 1, f"插件 {plugin_name} 的 store.json schemaVersion 必须为 1")
    _text(store.get("gameName"), f"插件 {plugin_name} 的 gameName", 128)
    authors = store.get("authors")
    _require(isinstance(authors, list) and 1 <= len(authors) <= 8, f"插件 {plugin_name} 的 authors 数量必须为 1 至 8")
    for author in authors:
        _require(isinstance(author, dict), f"插件 {plugin_name} 的作者条目无效")
        _text(author.get("name"), f"插件 {plugin_name} 的作者名称", 64)
        url = author.get("url", "")
        _require(isinstance(url, str) and is_https_url(url), f"插件 {plugin_name} 的作者 URL 无效")
    tags = store.get("tags", [])
    _require(isinstance(tags, list) and len(tags) <= 16, f"插件 {plugin_name} 的 tags 数量无效")
    seen_tags: set[str] = set()
    for tag in tags:
        normalized = _text(tag, f"插件 {plugin_name} 的标签", 32)
        _require(normalized.casefold() not in seen_tags, f"插件 {plugin_name} 的标签重复：{normalized}")
        seen_tags.add(normalized.casefold())
    homepage = store.get("homepage", "")
    _require(isinstance(homepage, str) and is_https_url(homepage), f"插件 {plugin_name} 的 homepage 必须是 HTTPS 地址")
    changelog = store.get("changelog")
    _require(isinstance(changelog, list) and 1 <= len(changelog) <= 3, f"插件 {plugin_name} 的 changelog 必须包含 1 至 3 个版本")
    previous: tuple[int, int, int] | None = None
    seen_versions: set[str] = set()
    for index, entry in enumerate(changelog):
        _require(isinstance(entry, dict), f"插件 {plugin_name} 的 changelog 条目无效")
        entry_version = entry.get("version")
        parsed = parse_semver(entry_version, f"插件 {plugin_name} 的 changelog 版本")
        _require(entry_version not in seen_versions, f"插件 {plugin_name} 的 changelog 版本重复：{entry_version}")
        seen_versions.add(entry_version)
        if index == 0:
            _require(entry_version == version, f"插件 {plugin_name} 的 changelog 第一条必须对应当前版本")
        elif previous is not None:
            _require(previous > parsed, f"插件 {plugin_name} 的 changelog 必须按从新到旧排列")
        previous = parsed
        parse_date(entry.get("date"), f"插件 {plugin_name} 的 changelog 日期")
        items = entry.get("items")
        _require(isinstance(items, list) and 1 <= len(items) <= 32, f"插件 {plugin_name} 的 changelog items 数量无效")
        for item in items:
            _text(item, f"插件 {plugin_name} 的 changelog 文本", 512)


def _validate_data_contract(plugin: Path, manifest: dict[str, Any]) -> None:
    name = str(manifest["name"])
    _safe_relative(plugin, manifest.get("resolve"), f"数据化插件 {name} 的 resolve", ".json")
    _safe_relative(plugin, manifest.get("judgeScript"), f"数据化插件 {name} 的 judgeScript")
    for field in ("configValidator", "configEditor"):
        if field in manifest:
            _safe_relative(plugin, manifest.get(field), f"数据化插件 {name} 的 {field}", ".js")
    resolve_path = _safe_relative(plugin, manifest.get("resolve"), f"数据化插件 {name} 的 resolve", ".json")
    resolve = read_json(resolve_path)
    _require(isinstance(resolve, dict), f"数据化插件 {name} 的 resolve.json 必须是对象")
    requirements = resolve.get("require")
    paths = resolve.get("paths")
    _require(isinstance(requirements, list) and 1 <= len(requirements) <= 32, f"数据化插件 {name} 的 require 数量无效")
    _require(isinstance(paths, dict), f"数据化插件 {name} 的 resolve.json 缺少 paths")
    for item in requirements:
        _require(isinstance(item, dict), f"数据化插件 {name} 的 require 条目无效")
        _require(isinstance(item.get("var"), str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", item["var"]), f"数据化插件 {name} 的 require 变量无效")
        _require(isinstance(item.get("file"), str) and bool(item["file"].strip()), f"数据化插件 {name} 的 require 文件无效")
    for key in ("mainExe", "args", "configPath", "logPath"):
        _require(key in paths, f"数据化插件 {name} 的 paths 缺少 {key}")
    extra = paths.get("extraConfigPaths")
    if extra is not None:
        _require(isinstance(extra, list), f"数据化插件 {name} 的 extraConfigPaths 必须是数组")
        for item in extra:
            _require(isinstance(item, str) and item.strip(), f"数据化插件 {name} 的附加配置路径无效")
            normalized = item.replace("\\", "/")
            _require(not os.path.isabs(item) and not PureWindowsPath(item).is_absolute() and ".." not in normalized.split("/"), f"数据化插件 {name} 的附加配置路径不安全")


def _validate_frontend_contract(plugin: Path, manifest: dict[str, Any]) -> None:
    frontend = manifest.get("frontend")
    if frontend is None:
        return
    _require(isinstance(frontend, dict), f"插件 {manifest['artifactName']} 的 frontend 必须是对象")
    _safe_relative(plugin, frontend.get("entry"), f"插件 {manifest['artifactName']} 的 frontend.entry", ".js")
    styles = frontend.get("styles", [])
    _require(isinstance(styles, list), f"插件 {manifest['artifactName']} 的 frontend.styles 必须是数组")
    for style in styles:
        _safe_relative(plugin, style, f"插件 {manifest['artifactName']} 的 frontend.styles", ".css")


def _category_for(root: Path) -> str:
    _require(root.parent.name in {"general", "specialized"}, f"正式插件必须位于 plugins/general/ 或 plugins/specialized/：{_display(root)}")
    return root.parent.name


def validate_source_plugin(root: Path) -> SourcePlugin:
    category = _category_for(root)
    manifest_path = root / "plugin.json"
    store_path = root / "store.json"
    _require(manifest_path.is_file(), f"插件目录缺少 plugin.json：{_display(root)}")
    _require(store_path.is_file(), f"插件目录缺少 store.json：{_display(root)}")
    manifest = read_json(manifest_path)
    store = read_json(store_path)
    _require(isinstance(manifest, dict), f"plugin.json 必须是对象：{_display(manifest_path)}")
    _require(isinstance(store, dict), f"store.json 必须是对象：{_display(store_path)}")
    _require(manifest.get("schemaVersion") == 2, f"插件 {root.name} 的 plugin.json schemaVersion 必须为 2")
    artifact = manifest.get("artifactName")
    _require(isinstance(artifact, str) and ARTIFACT_PATTERN.fullmatch(artifact) and any(char.isupper() for char in artifact), f"artifactName 无效：{artifact}")
    _require(root.name == artifact, f"artifactName 与插件目录不一致：{root.name} / {artifact}")
    name = manifest.get("name")
    _require(isinstance(name, str) and len(name) <= 64 and PLUGIN_ID_PATTERN.fullmatch(name), f"插件机器 ID 无效：{name}")
    _require("supportsEmulator" not in manifest and "replaces" not in manifest, f"插件 {name} 不支持历史兼容字段")
    version = manifest.get("version")
    parse_semver(version, f"插件 {artifact} 的版本")
    kind = str(manifest.get("kind", "")).strip().lower()
    _require(kind in SUPPORTED_KINDS, f"插件 {artifact} 的类型不受支持：{kind}")
    if root.parent.name in {"general", "specialized"}:
        expected = "managed-code" if root.parent.name == "general" else "data-specialized"
        _require(kind == expected, f"插件 {artifact} 必须位于 plugins/{root.parent.name}/")
    _validate_store(store, name, version)
    min_host = manifest.get("minHostVersion", "0.0.0")
    host_version = parse_semver(min_host, f"插件 {artifact} 的 minHostVersion")
    capabilities = manifest.get("capabilities", [])
    _require(isinstance(capabilities, list), f"插件 {artifact} 的 capabilities 必须是数组")
    for capability in capabilities:
        _require(isinstance(capability, str) and bool(capability.strip()), f"插件 {artifact} 的 capability 无效")
        minimum = CAPABILITY_MIN_HOST.get(capability)
        if minimum:
            _require(host_version >= minimum, f"插件能力要求的最低宿主版本未满足：{name} -> {capability}")
    if kind == "data-specialized":
        _validate_data_contract(root, manifest)
    else:
        projects = sorted((root / "src").glob("*.csproj"))
        _require(bool(projects), f"managed-code 插件 {artifact} 缺少 src/*.csproj")
        api_version = manifest.get("apiVersion")
        _require(isinstance(api_version, str) and re.fullmatch(r"\d+\.\d+", api_version), f"managed-code 插件 {artifact} 的 apiVersion 无效")
    if "configValidator" in manifest or "configEditor" in manifest:
        _require(kind == "data-specialized", f"插件 {artifact} 的配置脚本仅支持 data-specialized")
    _validate_frontend_contract(root, manifest)
    homepage = store.get("homepage", "")
    canonical_prefix = f"https://github.com/{REPOSITORY}/tree/main/plugins/"
    if isinstance(homepage, str) and homepage.startswith(canonical_prefix):
        expected_homepage = f"{canonical_prefix}{category}/{artifact}"
        _require(homepage == expected_homepage, f"插件 {artifact} 的 homepage 必须指向当前分类源码目录：{expected_homepage}")
    return SourcePlugin(category, root, manifest, store)


def _plugin_directories(root: Path) -> list[Path]:
    plugins_root = root / "plugins"
    _require(plugins_root.is_dir(), f"缺少插件源码目录：{_display(plugins_root)}")
    categories = ("general", "specialized")
    for manifest_path in sorted(plugins_root.rglob("plugin.json")):
        relative = manifest_path.relative_to(plugins_root).parts
        _require(
            len(relative) == 3 and relative[0] in categories and relative[2] == "plugin.json",
            f"正式插件必须位于 plugins/general/ 或 plugins/specialized/：{_display(manifest_path.parent)}",
        )
    result: list[Path] = []
    for category in categories:
        category_root = plugins_root / category
        _require(category_root.is_dir(), f"缺少插件分类目录：{_display(category_root)}")
        result.extend(sorted(path for path in category_root.iterdir() if path.is_dir()))
    _require(bool(result), "plugins 目录为空")
    return result


def discover_source_plugins(root: Path) -> list[SourcePlugin]:
    result: list[SourcePlugin] = []
    names: set[str] = set()
    artifacts: set[str] = set()
    for directory in _plugin_directories(root):
        plugin = validate_source_plugin(directory)
        name_key = plugin.name.casefold()
        artifact_key = plugin.artifact_name.casefold()
        _require(name_key not in names, f"插件机器 ID 重复：{plugin.name}")
        _require(artifact_key not in artifacts, f"artifactName 重复：{plugin.artifact_name}")
        names.add(name_key)
        artifacts.add(artifact_key)
        result.append(plugin)
    return result


def validate_json_tree(root: Path) -> int:
    count = 0
    for path in sorted(root.rglob("*.json")):
        if any(part in {".git", ".generated", "bin", "obj", "__pycache__"} for part in path.parts):
            continue
        read_json(path)
        count += 1
    return count


def _run(command: Sequence[str], label: str, cwd: Path) -> None:
    print(f"[repository] {label}", flush=True)
    try:
        completed = subprocess.run(list(command), cwd=cwd, check=False)
    except OSError as exc:
        raise RepositoryError(f"{label}启动失败：{exc}") from exc
    if completed.returncode != 0:
        raise RepositoryError(f"{label}失败（exit={completed.returncode}）")


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
        raise RepositoryError(f"{label}启动失败：{exc}") from exc
    if completed.returncode != 0:
        detail = completed.stderr.strip()
        raise RepositoryError(f"{label}失败：{detail}")
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
        raise RepositoryError(f"基线 JSON 无效：{path}") from exc


def changed_paths(root: Path, base: str, head: str) -> list[tuple[str, list[str]]]:
    if base == head:
        return []
    output = _git(root, ["diff", "--name-status", "--find-renames=50%", f"{base}...{head}", "--"], "读取 Git 发行变更")
    result: list[tuple[str, list[str]]] = []
    for line in output.splitlines():
        fields = line.split("\t")
        if len(fields) < 2:
            continue
        result.append((fields[0], [field.replace("\\", "/") for field in fields[1:] if field]))
    return result


def plugin_root_from_path(path: str) -> str | None:
    parts = path.replace("\\", "/").split("/")
    if len(parts) < 3 or parts[0] != "plugins":
        return None
    if parts[1] in {"general", "specialized"}:
        return "/".join(parts[:3])
    return "/".join(parts[:2])


def release_requires_full(paths: Iterable[str]) -> bool:
    """工具、工作流、宿主锁变化只触发检查，不重建历史插件包。"""
    return False


def _release_requires_full(paths: Iterable[str]) -> bool:
    """保留测试与调用方使用的内部名称，语义与 release_requires_full 相同。"""
    return release_requires_full(paths)


def _plugin_identity_at(root: Path, commit: str, plugin_root: str) -> tuple[str, str] | None:
    try:
        manifest = git_json_at(root, commit, f"{plugin_root}/plugin.json")
    except RepositoryError:
        return None
    if not isinstance(manifest, dict):
        return None
    name = manifest.get("name")
    artifact = manifest.get("artifactName")
    if isinstance(name, str) and isinstance(artifact, str):
        return name, artifact
    return None


def _plugin_signature_at(root: Path, commit: str, plugin_root: str) -> tuple[str, str, str, str, str] | None:
    try:
        manifest = git_json_at(root, commit, f"{plugin_root}/plugin.json")
        tree = git_tree(root, commit, plugin_root)
    except RepositoryError:
        return None
    if not isinstance(manifest, dict):
        return None
    name = manifest.get("name")
    artifact = manifest.get("artifactName")
    kind = manifest.get("kind")
    version = manifest.get("version")
    if not all(isinstance(value, str) for value in (name, artifact, kind, version)):
        return None
    return name, artifact, kind.strip().lower(), version, tree


def _relocation_pairs(
    root: Path,
    base_commit: str,
    head_commit: str,
    records: list[tuple[str, list[str]]],
    current_by_root: dict[str, SourcePlugin],
) -> dict[str, tuple[str, str, bool]]:
    """Identify flat-to-categorized moves and whether each move is content-preserving."""
    old_roots: set[str] = set()
    new_roots: set[str] = set()
    for _status, paths in records:
        if len(paths) >= 2:
            old_root = plugin_root_from_path(paths[0])
            new_root = plugin_root_from_path(paths[1])
            if old_root is not None:
                old_roots.add(old_root)
            if new_root is not None:
                new_roots.add(new_root)
        elif paths:
            plugin_root = plugin_root_from_path(paths[0])
            if plugin_root is not None:
                old_roots.add(plugin_root)
                new_roots.add(plugin_root)

    old_signatures = {
        plugin_root: signature
        for plugin_root in old_roots
        if (signature := _plugin_signature_at(root, base_commit, plugin_root)) is not None
    }
    new_signatures: dict[str, tuple[str, str, str, str, str]] = {}
    for plugin_root in new_roots:
        plugin = current_by_root.get(plugin_root)
        if plugin is None:
            continue
        try:
            tree = git_tree(root, head_commit, plugin_root)
        except RepositoryError:
            continue
        new_signatures[plugin_root] = (plugin.name, plugin.artifact_name, plugin.kind, plugin.version, tree)

    candidates: dict[str, list[tuple[str, str, bool]]] = {}
    for old_root, old_signature in old_signatures.items():
        for new_root, new_signature in new_signatures.items():
            if old_root == new_root or old_signature[:3] != new_signature[:3]:
                continue
            artifact = new_signature[1]
            candidates.setdefault(artifact, []).append((old_root, new_root, old_signature[3:] == new_signature[3:]))
    relocations: dict[str, tuple[str, str, bool]] = {}
    for artifact, pairs in candidates.items():
        _require(len(pairs) == 1, f"插件 {artifact} 的源码迁移路径不唯一：{pairs}")
        relocations[artifact] = pairs[0]
    return relocations


def _version_from_package(path: Path, artifact: str) -> tuple[int, int, int] | None:
    match = PACKAGE_PATTERN.fullmatch(path.name)
    if match is None or match.group("artifact") != artifact:
        return None
    return parse_semver(match.group("version"), "发行包版本")


def _catalog_entry_by_artifact(catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    entries = catalog.get("plugins")
    _require(isinstance(entries, list), "catalog.plugins 必须是数组")
    result: dict[str, dict[str, Any]] = {}
    for entry in entries:
        _require(isinstance(entry, dict), "catalog 插件条目必须是对象")
        artifact = entry.get("artifactName")
        _require(isinstance(artifact, str), "catalog 条目缺少 artifactName")
        result[artifact] = entry
    return result


def _state_from_catalog(root: Path, catalog: dict[str, Any], source_commit: str, with_trees: bool) -> dict[str, Any]:
    plugins = {plugin.artifact_name: plugin for plugin in discover_source_plugins(root)}
    released: dict[str, dict[str, Any]] = {}
    for artifact, entry in _catalog_entry_by_artifact(catalog).items():
        _require(artifact in plugins, f"catalog 包含未知插件：{artifact}")
        _require(is_semver(entry.get("version")), f"catalog 版本无效：{artifact}")
        _require(isinstance(entry.get("sha256"), str) and re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]), f"catalog SHA256 无效：{artifact}")
        _require(isinstance(entry.get("sizeBytes"), int) and entry["sizeBytes"] >= 0, f"catalog sizeBytes 无效：{artifact}")
        plugin = plugins[artifact]
        source_tree = ""
        if with_trees:
            source_tree = git_tree(root, source_commit, _display(plugin.root.relative_to(root)).replace("\\", "/"))
        released[artifact] = {
            "name": str(entry.get("name", plugin.name)),
            "artifactName": artifact,
            "version": str(entry["version"]),
            "sha256": entry["sha256"],
            "sizeBytes": entry["sizeBytes"],
            "sourceTree": source_tree,
        }
    return {"schemaVersion": STATE_SCHEMA_VERSION, "sourceCommit": source_commit, "released": released}


def bootstrap_state(root: Path, source_commit: str | None = None) -> dict[str, Any]:
    source_commit = source_commit or git_head(root)
    return _state_from_catalog(root, read_json(root / "catalog.json"), source_commit, True)


def load_state(root: Path) -> dict[str, Any]:
    path = root / STATE_FILE
    if not path.is_file():
        return bootstrap_state(root)
    state = read_json(path)
    _require(isinstance(state, dict) and state.get("schemaVersion") == STATE_SCHEMA_VERSION, f"{STATE_FILE} schemaVersion 必须为 {STATE_SCHEMA_VERSION}")
    source_commit = state.get("sourceCommit")
    _require(isinstance(source_commit, str) and bool(source_commit), f"{STATE_FILE} 缺少 sourceCommit")
    released = state.get("released")
    _require(isinstance(released, dict), f"{STATE_FILE}.released 必须是对象")
    return state


def _state_at_commit(root: Path, commit: str) -> dict[str, Any]:
    probe = subprocess.run(
        ["git", "cat-file", "-e", f"{commit}:{STATE_FILE}"],
        cwd=root,
        check=False,
        capture_output=True,
    )
    if probe.returncode != 0:
        catalog = git_json_at(root, commit, "catalog.json")
        _require(isinstance(catalog, dict), "基线 catalog.json 必须是对象")
        # 基线状态缺失时只导入 catalog 中已有的发行事实，不读取 ZIP。
        released: dict[str, dict[str, Any]] = {}
        for artifact, entry in _catalog_entry_by_artifact(catalog).items():
            released[artifact] = {
                "name": entry.get("name", ""),
                "artifactName": artifact,
                "version": entry.get("version", ""),
                "sha256": entry.get("sha256", ""),
                "sizeBytes": entry.get("sizeBytes", 0),
                "sourceTree": "",
            }
        return {"schemaVersion": STATE_SCHEMA_VERSION, "sourceCommit": commit, "released": released}
    raw = _git(root, ["show", f"{commit}:{STATE_FILE}"], f"读取基线 {STATE_FILE}")
    try:
        state = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RepositoryError(f"基线 {STATE_FILE} JSON 无效") from exc
    _require(isinstance(state, dict), f"基线 {STATE_FILE} 必须是对象")
    return state


def _changed_root_reasons(records: list[tuple[str, list[str]]]) -> dict[str, list[str]]:
    reasons: dict[str, list[str]] = {}
    for _status, paths in records:
        for path in paths:
            plugin_root = plugin_root_from_path(path)
            if plugin_root is not None:
                reasons.setdefault(plugin_root, []).append(path)
    return reasons


def _retention_removals(root: Path, artifact: str, current_version: str) -> list[str]:
    directory = root / "packages" / artifact
    if not directory.is_dir():
        return []
    versions: list[tuple[tuple[int, int, int], Path]] = []
    for package in sorted(directory.glob("*.zip")):
        version = _version_from_package(package, artifact)
        if version is not None:
            versions.append((version, package))
    candidate = (parse_semver(current_version), directory / f"{artifact}-{current_version}.zip")
    if not any(path.name == candidate[1].name for _version, path in versions):
        versions.append(candidate)
    versions.sort(key=lambda item: item[0], reverse=True)
    return [_display(path.relative_to(root)) for _version, path in versions[MAX_RETAINED_PACKAGES:]]


def build_plan(root: Path, baseline: str = "auto", head: str | None = None) -> dict[str, Any]:
    root = root.resolve()
    head_commit = git_commit(root, head or "HEAD")
    current_plugins = discover_source_plugins(root)
    current_by_root = {
        _display(plugin.root.relative_to(root)): plugin for plugin in current_plugins
    }
    current_by_artifact = {plugin.artifact_name: plugin for plugin in current_plugins}
    if baseline == "auto":
        current_state = load_state(root)
        base_commit = git_commit(root, str(current_state["sourceCommit"]))
        previous_state = current_state
    else:
        base_commit = git_commit(root, baseline)
        previous_state = _state_at_commit(root, base_commit)
    records = changed_paths(root, base_commit, head_commit)
    reasons_by_root = _changed_root_reasons(records)
    move_pairs = _relocation_pairs(root, base_commit, head_commit, records, current_by_root)
    moved_artifacts = set(move_pairs)
    relocations = {
        artifact: (old_root, new_root)
        for artifact, (old_root, new_root, pure) in move_pairs.items()
        if pure
    }
    relocated_artifacts = set(relocations)
    changed_artifacts: set[str] = set()
    deleted_artifacts: set[str] = set()
    reasons: dict[str, list[str]] = {}
    for plugin_root, paths in reasons_by_root.items():
        if plugin_root in current_by_root:
            artifact = current_by_root[plugin_root].artifact_name
            if artifact in relocated_artifacts:
                continue
            changed_artifacts.add(artifact)
            reasons[artifact] = sorted(set(paths))
        else:
            identity = _plugin_identity_at(root, base_commit, plugin_root)
            if identity is not None and identity[1] not in moved_artifacts:
                deleted_artifacts.add(identity[1])
                reasons.setdefault(identity[1], []).extend(paths)
    previous_released = previous_state.get("released", {})
    _require(isinstance(previous_released, dict), f"{STATE_FILE}.released 必须是对象")
    previous_artifacts = set(str(key) for key in previous_released)
    for artifact, plugin in current_by_artifact.items():
        if artifact not in previous_artifacts and artifact not in relocated_artifacts:
            changed_artifacts.add(artifact)
            reasons.setdefault(artifact, []).append("new-plugin")
    for artifact in previous_artifacts - set(current_by_artifact):
        if artifact not in relocated_artifacts:
            deleted_artifacts.add(artifact)
            reasons.setdefault(artifact, []).append("deleted-plugin")

    for artifact, (old_root, new_root) in relocations.items():
        reasons[artifact] = ["repository-layout-relocation", old_root, new_root]

    requires_package: set[str] = set()
    for artifact in sorted(changed_artifacts):
        plugin = current_by_artifact[artifact]
        previous = previous_released.get(artifact)
        if isinstance(previous, dict) and is_semver(previous.get("version")):
            previous_version = parse_semver(previous["version"])
            current_version = parse_semver(plugin.version)
            _require(current_version > previous_version, f"插件 {artifact} 的发行相关源码发生变化，必须提升 SemVer：{previous['version']} -> {plugin.version}")
        requires_package.add(artifact)
    for artifact in deleted_artifacts:
        reasons.setdefault(artifact, []).append("removed-from-source")

    managed = sorted(artifact for artifact in requires_package if current_by_artifact[artifact].kind == "managed-code")
    remove_packages = sorted(
        path
        for artifact in requires_package
        for path in _retention_removals(root, artifact, current_by_artifact[artifact].version)
    )
    remove_artifacts = sorted(f"packages/{artifact}" for artifact in deleted_artifacts)
    changed_paths_flat = [path for _status, paths in records for path in paths]
    mapped_paths = {path for paths in reasons_by_root.values() for path in paths}
    return {
        "schemaVersion": 1,
        "base": base_commit,
        "head": head_commit,
        "mode": "incremental",
        "changed": sorted(changed_artifacts),
        "relocated": sorted(relocated_artifacts),
        "deleted": sorted(deleted_artifacts),
        "managed": managed,
        "requiresPackage": sorted(requires_package),
        "reasons": {key: sorted(set(value)) for key, value in sorted(reasons.items())},
        "globalChanges": sorted(set(changed_paths_flat) - mapped_paths),
        "removePackages": remove_packages,
        "removeArtifacts": remove_artifacts,
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_metadata(path: Path) -> PackageMetadata:
    return PackageMetadata(path=path, sha256=sha256(path), size_bytes=path.stat().st_size)


def _same_package_bytes(first: Path, second: Path) -> bool:
    try:
        if first.stat().st_size != second.stat().st_size:
            return False
    except OSError:
        return False
    return filecmp.cmp(first, second, shallow=False)


def _package_files(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_STORED) as archive:
        for file in sorted(path for path in source.rglob("*") if path.is_file()):
            relative = file.relative_to(source).as_posix()
            info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 0
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o644 << 16
            data = file.read_bytes()
            if file.suffix.lower() in TEXT_SUFFIXES:
                data = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
            archive.writestr(info, data)


def _find_host_root(root: Path) -> Path:
    marker = Path("src") / "NexusPipeline.Plugin.Abstractions" / "NexusPipeline.Plugin.Abstractions.csproj"
    candidates = (root.parent / "NexusPipeline", root / "NexusPipeline")
    for candidate in candidates:
        if (candidate / marker).is_file():
            return candidate.resolve()
    raise RepositoryError("未找到兄弟仓库 NexusPipeline，无法构建 managed-code 插件")


def _build_managed(plugin: SourcePlugin, output: Path, root: Path) -> None:
    projects = sorted((plugin.root / "src").glob("*.csproj"))
    _require(bool(projects), f"managed-code 插件缺少 csproj：{plugin.artifact_name}")
    _find_host_root(root)
    properties = (
        "-p:DebugType=None",
        "-p:DebugSymbols=false",
        "-p:ContinuousIntegrationBuild=true",
        "-p:Deterministic=true",
        "-p:IncludeSourceRevisionInInformationalVersion=false",
        "-p:SuppressImplicitGitSourceLink=true",
    )
    _run(("dotnet", "build", str(projects[0]), "--configuration", "Release", "--nologo", "--output", str(output), *properties), f"构建插件：{plugin.artifact_name} v{plugin.version}", root)


def _copy_tree(source: Path, destination: Path) -> None:
    _require(source.is_dir(), f"缺少目录：{_display(source)}")
    shutil.copytree(source, destination, dirs_exist_ok=True)


def build_plugin_package(plugin: SourcePlugin, destination: Path, root: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".nxp-pack-", dir=str(root)) as temporary:
        temporary_root = Path(temporary)
        payload = temporary_root / "payload"
        payload.mkdir()
        shutil.copyfile(plugin.root / "plugin.json", payload / "plugin.json")
        shutil.copyfile(plugin.root / "store.json", payload / "store.json")
        readme = plugin.root / "README.md"
        if readme.is_file():
            shutil.copyfile(readme, payload / "README.md")
        if plugin.kind == "data-specialized":
            _copy_tree(plugin.root / "data", payload / "data")
        else:
            build_output = temporary_root / "build"
            _build_managed(plugin, build_output, root)
            copied = 0
            for file in sorted(build_output.iterdir()):
                if file.is_file() and file.suffix.lower() in {".dll", ".json"} and not file.name.lower().endswith(".runtimeconfig.json"):
                    shutil.copyfile(file, payload / file.name)
                    copied += 1
            _require(copied > 0, f"managed-code 插件没有可打包构建输出：{plugin.artifact_name}")
        if plugin.manifest.get("frontend") is not None:
            _copy_tree(plugin.root / "web", payload / "web")
        temporary_zip = temporary_root / "package.zip"
        _package_files(payload, temporary_zip)
        shutil.copyfile(temporary_zip, destination)
    return destination


def catalog_entry(plugin: SourcePlugin, package: Path, metadata: PackageMetadata | None = None) -> dict[str, Any]:
    metadata = metadata or package_metadata(package)
    return {
        "name": plugin.name,
        "artifactName": plugin.artifact_name,
        "displayName": str(plugin.manifest.get("displayName", "")),
        "gameName": str(plugin.store.get("gameName", "")),
        "description": str(plugin.manifest.get("description", "")),
        "authors": plugin.authors,
        "tags": [str(tag) for tag in plugin.store.get("tags", [])],
        "homepage": str(plugin.store.get("homepage", "")),
        "updatedAt": plugin.updated_at,
        "hasReadme": (plugin.root / "README.md").is_file(),
        "version": plugin.version,
        "kind": plugin.kind,
        "apiVersion": str(plugin.manifest.get("apiVersion", "")),
        "capabilities": sorted({str(value) for value in plugin.manifest.get("capabilities", [])}, key=str.casefold),
        "minHostVersion": str(plugin.manifest.get("minHostVersion", "0.0.0")),
        "packageUrl": f"{PACKAGE_URL_PREFIX}/{plugin.artifact_name}/{package.name}",
        "sha256": metadata.sha256,
        "sizeBytes": metadata.size_bytes,
        "changelog": copy.deepcopy(plugin.store["changelog"]),
    }


def _catalog_order(entries: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(entries, key=lambda item: (0 if item.get("kind") == "managed-code" else 1, str(item.get("name", "")).casefold()))


def _validate_catalog_shape(root: Path, catalog: dict[str, Any], plugins: list[SourcePlugin], require_packages: bool) -> None:
    _require(catalog.get("schemaVersion") == 2, "catalog schemaVersion 必须为 2")
    _require(catalog.get("repository") == REPOSITORY, "catalog repository 不正确")
    entries = catalog.get("plugins")
    _require(isinstance(entries, list), "catalog.plugins 必须是数组")
    by_artifact = {plugin.artifact_name: plugin for plugin in plugins}
    _require(set(entry.get("artifactName") for entry in entries) == set(by_artifact), "catalog 与源码插件集合不一致")
    _require(entries == _catalog_order(entries), "catalog 必须按 managed-code 优先、机器 ID 稳定排序")
    seen: set[str] = set()
    for entry in entries:
        artifact = entry.get("artifactName")
        _require(artifact not in seen, f"catalog artifactName 重复：{artifact}")
        seen.add(artifact)
        plugin = by_artifact[artifact]
        _require(entry.get("name") == plugin.name, f"catalog name 与源码不一致：{artifact}")
        _require(entry.get("version") == plugin.version and entry.get("kind") == plugin.kind, f"catalog 版本或类型与源码不一致：{artifact}")
        package = root / "packages" / artifact / f"{artifact}-{entry['version']}.zip"
        if require_packages:
            _require(package.is_file(), f"缺少 catalog 指定包：{_display(package)}")
        _require(entry.get("packageUrl") == f"{PACKAGE_URL_PREFIX}/{artifact}/{package.name}", f"packageUrl 不正确：{artifact}")
        _require(isinstance(entry.get("sha256"), str) and re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]), f"catalog SHA256 无效：{artifact}")
        _require(isinstance(entry.get("sizeBytes"), int) and entry["sizeBytes"] >= 0, f"catalog sizeBytes 无效：{artifact}")


def validate_sources(root: Path) -> tuple[int, int]:
    plugins = discover_source_plugins(root)
    json_count = validate_json_tree(root)
    host_lock = read_json(root / "host.lock.json")
    _require(isinstance(host_lock, dict) and host_lock.get("repository") == "FlappiBakuse/NexusPipeline", "host.lock.json repository 不正确")
    _require(isinstance(host_lock.get("ref"), str) and re.fullmatch(r"[0-9a-f]{40}", host_lock["ref"]), "host.lock.json ref 必须是完整 commit SHA")
    return len(plugins), json_count


def validate_source_and_catalog(root: Path) -> tuple[int, int]:
    count, json_count = validate_sources(root)
    plugins = discover_source_plugins(root)
    catalog = read_json(root / "catalog.json")
    _validate_catalog_shape(root, catalog, plugins, True)
    return count, json_count


def _safe_zip_name(name: str) -> bool:
    normalized = name.replace("\\", "/").rstrip("/")
    return bool(normalized) and not normalized.startswith("/") and all(part not in {"", ".", ".."} for part in normalized.split("/"))


def _zip_json(archive: zipfile.ZipFile, name: str, package: Path) -> dict[str, Any]:
    try:
        value = json.loads(archive.read(name).decode("utf-8-sig"))
    except (KeyError, UnicodeError, json.JSONDecodeError) as exc:
        raise RepositoryError(f"ZIP 根目录缺少或包含无效 {name}：{_display(package)}") from exc
    _require(isinstance(value, dict), f"ZIP {name} 必须是对象：{_display(package)}")
    return value


def _validate_zip(package: Path, expected: SourcePlugin | None = None) -> None:
    try:
        with zipfile.ZipFile(package) as archive:
            infos = archive.infolist()
            for info in infos:
                _require(_safe_zip_name(info.filename), f"ZIP 条目路径非法：{_display(package)} -> {info.filename}")
            manifest = _zip_json(archive, "plugin.json", package)
            _require(manifest.get("schemaVersion") == 2, f"ZIP manifest schemaVersion 无效：{_display(package)}")
            match = PACKAGE_PATTERN.fullmatch(package.name)
            _require(match is not None and manifest.get("artifactName") == match.group("artifact") and manifest.get("version") == match.group("version"), f"ZIP manifest 与文件名不一致：{_display(package)}")
            names = {info.filename.replace("\\", "/") for info in infos}
            if expected is not None:
                store = _zip_json(archive, "store.json", package)
                _require(store.get("schemaVersion") == 1 and isinstance(store.get("authors"), list), f"ZIP store.json 无效：{_display(package)}")
                _require(manifest.get("name") == expected.name and manifest.get("artifactName") == expected.artifact_name and manifest.get("version") == expected.version and str(manifest.get("kind", "")).lower() == expected.kind, f"ZIP manifest 与源码不一致：{_display(package)}")
                if expected.kind == "data-specialized":
                    _require(any(name == "data" or name.startswith("data/") for name in names), f"专项插件 ZIP 缺少 data 目录：{_display(package)}")
                else:
                    _require(any(name.lower().endswith(".dll") for name in names), f"managed-code ZIP 缺少 DLL：{_display(package)}")
    except zipfile.BadZipFile as exc:
        raise RepositoryError(f"发行包不是有效 ZIP：{_display(package)}") from exc


def audit(root: Path) -> int:
    plugins = discover_source_plugins(root)
    catalog = read_json(root / "catalog.json")
    _validate_catalog_shape(root, catalog, plugins, True)
    entries = _catalog_entry_by_artifact(catalog)
    checked = 0
    for plugin in plugins:
        entry = entries[plugin.artifact_name]
        package = root / "packages" / plugin.artifact_name / f"{plugin.artifact_name}-{plugin.version}.zip"
        _require(sha256(package) == entry["sha256"], f"SHA256 不一致：{_display(package)}")
        _require(package.stat().st_size == entry["sizeBytes"], f"包大小不一致：{_display(package)}")
        _validate_zip(package, plugin)
        checked += 1
    packages_root = root / "packages"
    for directory in sorted(path for path in packages_root.iterdir() if path.is_dir()):
        _require(directory.name in entries, f"发行包目录没有对应源码插件：{directory.name}")
        packages = sorted(directory.glob("*.zip"))
        _require(len(packages) <= MAX_RETAINED_PACKAGES, f"插件发行包超过最近 {MAX_RETAINED_PACKAGES} 个版本：{directory.name}")
        for package in packages:
            _require(_version_from_package(package, directory.name) is not None, f"发行包文件名无效：{_display(package)}")
            _validate_zip(package)
            checked += 1
    print(f"[repository] Full Audit 通过：检查 {checked} 个 ZIP、{len(plugins)} 个当前 catalog 条目", flush=True)
    return checked


def check_syntax(root: Path) -> int:
    files = sorted(path for path in (root / "plugins").rglob("*.js") if "bin" not in path.parts and "obj" not in path.parts)
    files += sorted(path for path in (root / "plugins").rglob("*.mjs") if "bin" not in path.parts and "obj" not in path.parts)
    _require(bool(files), "未找到插件 JavaScript 文件")
    for path in files:
        _run(("node", "--check", str(path)), f"JavaScript 语法：{_display(path)}", root)
    for path in sorted(root.rglob("*.py")):
        if any(part in {".git", ".generated", "bin", "obj", "__pycache__"} for part in path.parts):
            continue
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except (OSError, SyntaxError) as exc:
            raise RepositoryError(f"Python 语法失败：{_display(path)}；{exc}") from exc
        print(f"[repository] Python 语法：{_display(path)}", flush=True)
        files.append(path)
    return len(files)


def check_pr(root: Path, base: str) -> int:
    records = changed_paths(root, git_commit(root, base), git_head(root))
    changed = [path for _status, paths in records for path in paths]
    generated = [path for path in changed if path == "catalog.json" or path == STATE_FILE or path.startswith("packages/")]
    _require(not generated, "PR 不得直接提交生成物：" + ", ".join(sorted(set(generated))))
    print(f"[repository] PR 生成物路径检查通过：{len(changed)} 个变更文件", flush=True)
    return len(changed)


def _managed_projects(root: Path, artifacts: Iterable[str]) -> list[tuple[SourcePlugin, Path]]:
    wanted = set(artifacts)
    result: list[tuple[SourcePlugin, Path]] = []
    for plugin in discover_source_plugins(root):
        if plugin.kind != "managed-code" or plugin.artifact_name not in wanted:
            continue
        projects = sorted((plugin.root / "src").glob("*.csproj"))
        if projects:
            result.append((plugin, projects[0]))
    return result


def cleanup_managed_build_artifacts(root: Path) -> None:
    """清理本次工具运行产生的精确 bin/obj 目录。"""
    directories = {path.parent for path in (root / "plugins").rglob("*.csproj")}
    try:
        directories.add(_find_host_root(root) / "src" / "NexusPipeline.Plugin.Abstractions")
    except RepositoryError:
        pass
    for directory in sorted(directories):
        for name in ("bin", "obj"):
            target = directory / name
            if target.is_dir():
                shutil.rmtree(target)


def test_managed(root: Path, plan: dict[str, Any] | None = None, full: bool = False) -> int:
    plugins = discover_source_plugins(root)
    artifacts = [plugin.artifact_name for plugin in plugins] if full or plan is None and full else (plan or {}).get("managed", [])
    if not artifacts:
        print("[repository] managed-code 增量测试：没有受影响的项目", flush=True)
        return 0
    total = 0
    try:
        for plugin, project in _managed_projects(root, artifacts):
            _run(("dotnet", "build", str(project), "--configuration", "Release", "--nologo", "-m:1"), f"managed-code 构建：{plugin.artifact_name}", root)
            total += 1
        for plugin in plugins:
            tests = sorted((plugin.root / "tests").glob("*.Tests.csproj"))
            if plugin.artifact_name in artifacts:
                for test in tests:
                    _run(("dotnet", "test", str(test), "--configuration", "Release", "--nologo", "-m:1"), f"managed-code 测试：{plugin.artifact_name}", root)
                    total += 1
        return total
    finally:
        cleanup_managed_build_artifacts(root)


def _prepare_output(root: Path, output: Path) -> None:
    root = root.resolve()
    output = output.resolve()
    _require(output != root and output != root.parent, "生成输出目录不能覆盖仓库根目录或其父目录")
    if root in output.parents:
        relative = output.relative_to(root)
        _require(relative.parts and relative.parts[0] == ".generated", "仓库内生成输出只能位于 .generated 目录")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)


def _state_entry(plugin: SourcePlugin, catalog_entry_value: dict[str, Any], source_tree: str) -> dict[str, Any]:
    return {
        "name": plugin.name,
        "artifactName": plugin.artifact_name,
        "version": plugin.version,
        "sha256": catalog_entry_value["sha256"],
        "sizeBytes": catalog_entry_value["sizeBytes"],
        "sourceTree": source_tree,
    }


def release(root: Path, plan_path: Path, output: Path) -> dict[str, Any]:
    root = root.resolve()
    plan = read_json(plan_path.resolve())
    _require(isinstance(plan, dict) and plan.get("schemaVersion") == 1, "release plan 无效")
    head = git_head(root)
    _require(plan.get("head") == head, f"release plan 与当前 HEAD 不一致：{plan.get('head')} / {head}")
    plugins = discover_source_plugins(root)
    by_artifact = {plugin.artifact_name: plugin for plugin in plugins}
    old_catalog = read_json(root / "catalog.json")
    old_entries = _catalog_entry_by_artifact(old_catalog)
    state = load_state(root)
    require = set(plan.get("requiresPackage", []))
    relocated = set(plan.get("relocated", []))
    deleted = set(plan.get("deleted", []))
    _require(require <= set(by_artifact), "release plan 包含未知插件：" + ", ".join(sorted(require - set(by_artifact))))
    _require(relocated.isdisjoint(require | deleted), "release plan 的 relocation 与 package/delete 计划重叠")
    _prepare_output(root, output)
    generated_packages = output / "packages"
    generated_packages.mkdir()
    generated_entries: dict[str, dict[str, Any]] = {}
    generated_metadata: dict[str, PackageMetadata] = {}
    for artifact in sorted(require):
        plugin = by_artifact[artifact]
        package = generated_packages / artifact / f"{artifact}-{plugin.version}.zip"
        build_plugin_package(plugin, package, root)
        existing = root / "packages" / artifact / package.name
        if existing.is_file():
            _require(_same_package_bytes(existing, package), f"同一 SemVer 的发行包已存在且内容不同，拒绝覆盖：{_display(existing)}")
        metadata = package_metadata(package)
        generated_metadata[artifact] = metadata
        generated_entries[artifact] = catalog_entry(plugin, package, metadata)
        print(f"[repository] 增量包：{artifact} v{plugin.version}，SHA 仅计算 1 次", flush=True)

    final_entries: list[dict[str, Any]] = []
    for plugin in plugins:
        artifact = plugin.artifact_name
        if artifact in generated_entries:
            final_entries.append(generated_entries[artifact])
        elif artifact in old_entries:
            final_entries.append(copy.deepcopy(old_entries[artifact]))
        else:
            raise RepositoryError(f"插件缺少发行 entry，且计划没有生成包：{artifact}")
    final_entries = _catalog_order(final_entries)
    catalog_changed = bool(require or deleted)
    timestamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    catalog = {
        "schemaVersion": 2,
        "repository": REPOSITORY,
        "generatedAt": timestamp if catalog_changed else old_catalog.get("generatedAt", timestamp),
        "plugins": final_entries,
    }
    _validate_catalog_shape(root, catalog, plugins, False)
    write_json(output / "catalog.json", catalog)

    released = copy.deepcopy(state.get("released", {}))
    _require(isinstance(released, dict), f"{STATE_FILE}.released 必须是对象")
    for artifact in deleted:
        released.pop(artifact, None)
    for plugin in plugins:
        artifact = plugin.artifact_name
        if artifact in generated_entries:
            plugin_root = _display(plugin.root.relative_to(root))
            released[artifact] = _state_entry(plugin, generated_entries[artifact], git_tree(root, head, plugin_root))
        elif artifact in relocated:
            plugin_root = _display(plugin.root.relative_to(root))
            released[artifact] = _state_entry(plugin, _catalog_entry_by_artifact(catalog)[artifact], git_tree(root, head, plugin_root))
        elif artifact not in released:
            entry = _catalog_entry_by_artifact(catalog)[artifact]
            released[artifact] = _state_entry(plugin, entry, git_tree(root, head, _display(plugin.root.relative_to(root))))
    new_state = {"schemaVersion": STATE_SCHEMA_VERSION, "sourceCommit": head, "released": {key: released[key] for key in sorted(released)}}
    plan["packageMetadata"] = {
        artifact: {
            "path": _display(metadata.path.relative_to(output)),
            "sha256": metadata.sha256,
            "sizeBytes": metadata.size_bytes,
        }
        for artifact, metadata in sorted(generated_metadata.items())
    }
    write_json(output / STATE_FILE, new_state)
    write_json(output / "release-plan.json", plan)
    validate_generated(root, output)
    cleanup_managed_build_artifacts(root)
    print(f"[repository] 增量发行候选物完成：{len(require)} 个包，删除 {len(deleted)} 个插件 entry", flush=True)
    return {"catalog": catalog, "state": new_state, "plan": plan}


def validate_generated(root: Path, generated_root: Path) -> None:
    generated_root = generated_root.resolve()
    plan = read_json(generated_root / "release-plan.json")
    catalog = read_json(generated_root / "catalog.json")
    state = read_json(generated_root / STATE_FILE)
    plugins = discover_source_plugins(root)
    _validate_catalog_shape(root, catalog, plugins, False)
    old_catalog = read_json(root / "catalog.json")
    old_entries = _catalog_entry_by_artifact(old_catalog)
    requires = set(plan.get("requiresPackage", []))
    relocated = set(plan.get("relocated", []))
    deleted = set(plan.get("deleted", []))
    package_metadata_by_artifact = plan.get("packageMetadata", {})
    _require(isinstance(package_metadata_by_artifact, dict), "release plan packageMetadata 必须是对象")
    _require(set(package_metadata_by_artifact) == requires, "release plan packageMetadata 与 requiresPackage 不一致")
    _require(relocated.isdisjoint(requires | deleted), "release plan 的 relocation 与 package/delete 计划重叠")
    generated_packages_root = generated_root / "packages"
    if generated_packages_root.is_dir():
        for directory in generated_packages_root.iterdir():
            _require(directory.name in requires, f"生成目录包含未计划的插件包：{directory.name}")
    by_artifact = {plugin.artifact_name: plugin for plugin in plugins}
    generated_entries = _catalog_entry_by_artifact(catalog)
    for artifact in requires:
        package = generated_packages_root / artifact / f"{artifact}-{by_artifact[artifact].version}.zip"
        _require(package.is_file(), f"生成物缺少变更插件包：{_display(package)}")
        metadata = package_metadata_by_artifact[artifact]
        _require(isinstance(metadata, dict), f"生成物 packageMetadata 无效：{artifact}")
        _require(metadata.get("path") == _display(package.relative_to(generated_root)), f"生成物 packageMetadata 路径不一致：{artifact}")
        _require(metadata.get("sha256") == generated_entries[artifact]["sha256"], f"生成物 SHA256 metadata 不一致：{_display(package)}")
        _require(metadata.get("sizeBytes") == generated_entries[artifact]["sizeBytes"], f"生成物 sizeBytes metadata 不一致：{_display(package)}")
        _require(package.stat().st_size == metadata.get("sizeBytes"), f"生成物 sizeBytes 不一致：{_display(package)}")
        _validate_zip(package, by_artifact[artifact])
    for artifact, entry in old_entries.items():
        if artifact not in requires and artifact not in deleted:
            _require(generated_entries.get(artifact) == entry, f"未变更 catalog entry 被修改：{artifact}")
    _require(not (set(old_entries) & deleted & set(generated_entries)), "删除插件仍存在于 catalog")
    _require(state.get("sourceCommit") == plan.get("head"), "生成 state sourceCommit 不一致")
    state_entries = state.get("released", {})
    _require(isinstance(state_entries, dict), "生成 state.released 必须是对象")
    _require(set(state_entries) == set(generated_entries), "生成 state 与 catalog 插件集合不一致")
    for artifact, entry in generated_entries.items():
        state_entry = state_entries[artifact]
        _require(
            state_entry.get("artifactName") == artifact
            and state_entry.get("version") == entry.get("version")
            and state_entry.get("sha256") == entry.get("sha256")
            and state_entry.get("sizeBytes") == entry.get("sizeBytes"),
            f"生成 state 与 catalog 发行事实不一致：{artifact}",
        )


def apply_generated(root: Path, generated_root: Path) -> None:
    generated_root = generated_root.resolve()
    validate_generated(root, generated_root)
    plan = read_json(generated_root / "release-plan.json")
    generated_packages = generated_root / "packages"
    if generated_packages.is_dir():
        for artifact_dir in sorted(path for path in generated_packages.iterdir() if path.is_dir()):
            destination = root / "packages" / artifact_dir.name
            destination.mkdir(parents=True, exist_ok=True)
            for package in sorted(artifact_dir.glob("*.zip")):
                shutil.copyfile(package, destination / package.name)
    for relative in plan.get("removePackages", []):
        target = (root / relative).resolve()
        packages_root = (root / "packages").resolve()
        _require(target.parent != packages_root or target.suffix.lower() == ".zip", f"清理路径无效：{relative}")
        _require(target.is_file() and packages_root in target.parents, f"待清理发行包不存在：{relative}")
        target.unlink()
    for relative in plan.get("removeArtifacts", []):
        target = (root / relative).resolve()
        packages_root = (root / "packages").resolve()
        _require(target.parent == packages_root and packages_root in target.parents, f"清理目录无效：{relative}")
        if target.is_dir():
            shutil.rmtree(target)
    shutil.copyfile(generated_root / "catalog.json", root / "catalog.json")
    shutil.copyfile(generated_root / STATE_FILE, root / STATE_FILE)
    print("[repository] 已应用增量发行候选物：未变更 packages 未被复制或读取", flush=True)
