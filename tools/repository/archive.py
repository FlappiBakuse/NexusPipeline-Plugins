from __future__ import annotations

import hashlib
import json
import posixpath
import re
import zipfile
from pathlib import Path
from typing import Any, Sequence

import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.source as repository_source
import tools.repository.versions as repository_versions

def _normalize_zip_name(name: str) -> str:
    return name.replace("\\", "/").removesuffix("/")


def _safe_zip_name(name: str) -> bool:
    normalized = _normalize_zip_name(name)
    if not normalized or normalized.startswith(("/", "//")):
        return False
    if re.match(r"^[A-Za-z]:", normalized) is not None:
        return False
    parts = normalized.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        return False
    for part in parts:
        if any(ord(char) < 32 or char in '<>:"|?*' for char in part) or part.endswith((" ", ".")):
            return False
        stem = part.split(".", 1)[0].upper()
        if stem in repository_model._WINDOWS_RESERVED_NAMES:
            return False
    return True


def _validate_zip_layout(infos: Sequence[zipfile.ZipInfo], package: Path) -> dict[str, zipfile.ZipInfo]:
    """Validate the raw ZIP namespace before any manifest or payload is read."""

    repository_io._require(len(infos) <= repository_model.MAX_ZIP_ENTRIES, f"ZIP 条目过多：{repository_io._display(package)}")
    total_size = 0
    by_folded_name: dict[str, zipfile.ZipInfo] = {}
    file_names: set[str] = set()
    for info in infos:
        normalized = _normalize_zip_name(info.filename)
        repository_io._require(_safe_zip_name(info.orig_filename), f"ZIP 条目路径非法：{repository_io._display(package)} -> {info.filename}")
        folded = normalized.casefold()
        repository_io._require(folded not in by_folded_name, f"ZIP 条目重复或大小写冲突：{repository_io._display(package)} -> {info.filename}")
        by_folded_name[folded] = info
        is_directory = info.filename.endswith(("/", "\\"))
        total_size += info.file_size
        repository_io._require(0 <= info.file_size <= repository_model.MAX_ZIP_UNCOMPRESSED_BYTES and total_size <= repository_model.MAX_ZIP_UNCOMPRESSED_BYTES, f"ZIP 解压后大小超过上限：{repository_io._display(package)}")
        repository_io._require(not is_directory or info.file_size == 0, f"ZIP 目录条目不得携带载荷：{info.filename}")
        if not is_directory:
            file_names.add(normalized)
        mode = (info.external_attr >> 16) & 0o170000
        repository_io._require(mode in ({0, 0o040000} if is_directory else {0, 0o100000}), f"ZIP 禁止符号链接、特殊类型或目录类型不匹配：{repository_io._display(package)} -> {info.filename}")

    folded_files = {name.casefold() for name in file_names}
    for name in by_folded_name:
        parts = name.split("/")
        for index in range(1, len(parts)):
            repository_io._require(
                "/".join(parts[:index]).casefold() not in folded_files,
                f"ZIP 文件/目录祖先冲突：{repository_io._display(package)} -> {name}",
            )
    return {_normalize_zip_name(info.filename): info for info in infos}


def _zip_json(
    archive: zipfile.ZipFile,
    name: str,
    package: Path,
    infos: dict[str, zipfile.ZipInfo] | None = None,
) -> dict[str, Any]:
    try:
        info = (infos or {item.filename.replace("\\", "/").rstrip("/"): item for item in archive.infolist()}).get(name)
        if info is None:
            raise KeyError(name)
        value = json.loads(archive.read(info).decode("utf-8-sig"))
    except (KeyError, UnicodeError, json.JSONDecodeError) as exc:
        raise repository_model.RepositoryError(f"ZIP 根目录缺少或包含无效 {name}：{repository_io._display(package)}") from exc
    repository_io._require(isinstance(value, dict), f"ZIP {name} 必须是对象：{repository_io._display(package)}")
    return value


def _validate_specialized_zip_payload(
    archive: zipfile.ZipFile,
    names: set[str],
    manifest: dict[str, Any],
    package: Path,
    infos: dict[str, zipfile.ZipInfo],
) -> None:
    artifact = str(manifest.get("artifactName", package.stem))
    repository_source._validate_specialized_manifest_contract(manifest, f"ZIP {repository_io._display(package)}")
    data_names = {name for name in names if name.startswith("data/") and not name.endswith("/")}
    repository_io._require(data_names, f"专项插件 ZIP 缺少 data 载荷：{repository_io._display(package)}")
    for name in names:
        normalized = name.replace("\\", "/")
        parts = [part.casefold() for part in normalized.split("/")]
        file_name = parts[-1]
        suffix = Path(file_name).suffix.casefold()
        repository_io._require("frontend" not in parts and "web" not in parts, f"专项插件 ZIP 禁止浏览器目录：{name}")
        repository_io._require(file_name not in repository_model.SPECIALIZED_FORBIDDEN_NAMES, f"专项插件 ZIP 禁止浏览器工程文件：{name}")
        repository_io._require(
            not file_name.startswith(("vite.config.", "webpack.config.", "rollup.config."))
            and not (file_name.startswith("tsconfig") and suffix == ".json"),
            f"专项插件 ZIP 禁止前端构建配置：{name}",
        )
        repository_io._require(suffix not in repository_model.SPECIALIZED_FORBIDDEN_SUFFIXES, f"专项插件 ZIP 禁止浏览器或 managed 载荷：{name}")

    import_pattern = re.compile(
        r"(?:import\s+(?:[^;]*?\s+from\s+)?|import\s*\(|require\s*\()\s*['\"]([^'\"]+)['\"]"
    )
    closure: set[str] = set()
    queue: list[str] = []
    declarations = {**manifest, **repository_source._task_protocol_scripts(manifest)}
    def read_text_asset(path):
        repository_io._require(path in infos and infos[path].file_size <= 256 * 1024, "task localization asset missing or too large")
        return archive.read(infos[path])
    repository_source._validate_task_localization(manifest, read_text_asset)
    fields = ("judgeScript", "configEditor", "discoverScript", "retryScript")
    for field in fields:
        value = declarations.get(field)
        if value is None:
            continue
        repository_io._require(isinstance(value, str) and value.startswith("data/"), f"专项插件 ZIP 的 {field} 必须位于 data/：{value}")
        normalized = value.replace("\\", "/")
        repository_io._require(normalized in names, f"专项插件 ZIP 缺少 {field}：{value}")
        repository_io._require(Path(normalized).suffix.casefold() in {".js", ".mjs", ".py"}, f"专项插件 ZIP 的 {field} 不是后端脚本：{value}")
        queue.append(normalized)
    while queue:
        current = queue.pop()
        if current in closure:
            continue
        closure.add(current)
        if Path(current).suffix.casefold() not in {".js", ".mjs"}:
            continue
        try:
            source = archive.read(infos[current]).decode("utf-8")
        except (KeyError, UnicodeError) as exc:
            raise repository_model.RepositoryError(f"专项插件 ZIP 脚本无法读取：{current} -> {repository_io._display(package)}") from exc
        repository_io._require("__NXP_ADAPTATION_REQUIRED__" not in source, f"专项插件 ZIP 仍有未适配模板标记：{current}")
        for reference in import_pattern.findall(source):
            if not reference.startswith("."):
                continue
            candidate = posixpath.normpath(posixpath.join(posixpath.dirname(current), reference))
            candidates = [candidate]
            if not Path(candidate).suffix:
                candidates.extend(candidate + suffix for suffix in (".js", ".mjs", ".py", ".json"))
            target = next((item for item in candidates if item in names), None)
            repository_io._require(target is not None and target.startswith("data/"), f"专项插件 ZIP 脚本引用不存在或越出 data：{current} -> {reference}")
            queue.append(target)
    for name in data_names:
        if Path(name).suffix.casefold() in {".js", ".mjs", ".py"}:
            repository_io._require(name in closure, f"专项插件 {artifact} 的 ZIP 后端脚本未被声明执行闭包引用：{name}")


def _validate_zip(
    package: Path,
    expected: repository_model.SourcePlugin | None = None,
    *,
    mode: str = "stable",
    expected_artifact: str | None = None,
    expected_version: str | None = None,
    expected_sha256: str | None = None,
) -> None:
    try:
        with zipfile.ZipFile(package) as archive:
            infos = archive.infolist()
            info_by_name = _validate_zip_layout(infos, package)
            manifest = _zip_json(archive, "plugin.json", package, info_by_name)
            repository_source._validate_script_type_icon(manifest)
            repository_io._require("configValidator" not in manifest, f"ZIP 声明已退役的 configValidator：{repository_io._display(package)}")
            repository_io._require(repository_versions.parse_semver(manifest.get("minHostVersion")) >= repository_versions.parse_semver("0.16.15"), "当前 ZIP minHostVersion 必须至少为 0.16.15")
            if manifest.get("kind") == "managed-code":
                repository_io._require(manifest.get("apiVersion") == "2.1", "当前 managed ZIP 必须使用 Plugin API 2.1")
            if manifest.get("kind") == "managed-code":
                repository_io._require(repository_versions.parse_semver(manifest.get("minHostVersion")) >= repository_versions.parse_semver("0.17.0"), "managed ZIP minHostVersion 必须至少为 0.17.0")
                frontend = manifest.get("frontend")
                repository_io._require(frontend is None or isinstance(frontend, dict) and frontend.get("apiVersion") == "1.6", "managed ZIP Frontend API 必须为 1.6")
            repository_source._task_protocol_scripts(manifest)
            repository_io._require(manifest.get("schemaVersion") == 2, f"ZIP manifest schemaVersion 无效：{repository_io._display(package)}")
            repository_io._require(mode in {"stable", "preview"}, f"ZIP 校验模式无效：{mode}")
            match = (repository_model.PACKAGE_PATTERN if mode == "stable" else repository_model.PREVIEW_PACKAGE_PATTERN).fullmatch(package.name)
            repository_io._require(match is not None and manifest.get("artifactName") == match.group("artifact") and manifest.get("version") == match.group("version"), f"ZIP manifest 与文件名不一致：{repository_io._display(package)}")
            artifact = expected_artifact or (expected.artifact_name if expected is not None else None)
            version = expected_version or (expected.version if expected is not None else None)
            if artifact is not None:
                repository_io._require(match is not None and match.group("artifact") == artifact, f"ZIP artifactName 与预期不一致：{repository_io._display(package)}")
            if version is not None:
                repository_io._require(match is not None and match.group("version") == version, f"ZIP version 与预期不一致：{repository_io._display(package)}")
            if mode == "preview":
                repository_io._require(match is not None and match.group("sha256") == repository_io.sha256(package), f"Preview ZIP 文件名 SHA256 不一致：{repository_io._display(package)}")
                if expected_sha256 is not None:
                    repository_io._require(match.group("sha256") == expected_sha256, f"Preview ZIP SHA256 与 catalog 不一致：{repository_io._display(package)}")
            elif expected_sha256 is not None:
                repository_io._require(repository_io.sha256(package) == expected_sha256, f"Stable ZIP SHA256 与 catalog 不一致：{repository_io._display(package)}")
            names = set(info_by_name)
            if expected is not None:
                store = _zip_json(archive, "store.json", package, info_by_name)
                repository_io._require(store.get("schemaVersion") == 1 and isinstance(store.get("authors"), list), f"ZIP store.json 无效：{repository_io._display(package)}")
                repository_io._require(
                    manifest.get("name") == expected.name
                    and manifest.get("artifactName") == expected.artifact_name
                    and manifest.get("version") == expected.version
                    and str(manifest.get("kind", "")).lower() == expected.kind
                    and manifest.get("minHostVersion", "0.0.0") == expected.manifest.get("minHostVersion", "0.0.0"),
                    f"ZIP manifest 与源码不一致：{repository_io._display(package)}",
                )
                if expected.kind == "data-specialized":
                    _validate_specialized_zip_payload(archive, names, manifest, package, info_by_name)
                else:
                    repository_io._require(any(name.lower().endswith(".dll") for name in names), f"managed-code ZIP 缺少 DLL：{repository_io._display(package)}")
            elif str(manifest.get("kind", "")).strip().lower() == "data-specialized":
                _validate_specialized_zip_payload(archive, names, manifest, package, info_by_name)
            elif str(manifest.get("kind", "")).strip().lower() == "managed-code":
                repository_io._require(any(name.lower().endswith(".dll") for name in names), f"managed-code ZIP 缺少 DLL：{repository_io._display(package)}")
    except zipfile.BadZipFile as exc:
        raise repository_model.RepositoryError(f"发行包不是有效 ZIP：{repository_io._display(package)}") from exc


def _validate_historical_archive(package: Path, original: bytes) -> None:
    repository_io._require(repository_model.PACKAGE_PATTERN.fullmatch(package.name) is not None, f"历史包名无效：{package.name}")
    repository_io._require(package.stat().st_size == len(original) and repository_io.sha256(package) == hashlib.sha256(original).hexdigest(),
             f"历史包与分发基线字节不一致：{package.name}")
    try:
        with zipfile.ZipFile(package) as archive:
            _validate_zip_layout(archive.infolist(), package)
            repository_io._require(archive.testzip() is None, f"历史 ZIP 内容损坏：{package.name}")
    except zipfile.BadZipFile as exc:
        raise repository_model.RepositoryError(f"历史包不是有效 ZIP：{package.name}") from exc
