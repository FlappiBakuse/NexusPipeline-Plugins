from __future__ import annotations

import json
import os
import re
from pathlib import Path, PureWindowsPath
from typing import Any
from urllib.parse import urlsplit

import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.versions as repository_versions

def _validate_script_type_icon(manifest: dict[str, Any]) -> None:
    if "scriptTypeIcon" not in manifest:
        return
    icon = manifest["scriptTypeIcon"]
    repository_io._require(isinstance(icon, dict), "scriptTypeIcon 必须是对象")
    url, digest, mime = icon.get("url"), icon.get("sha256"), icon.get("contentType")
    repository_io._require(isinstance(url, str) and len(url) <= 2048, "scriptTypeIcon URL 无效")
    parsed = urlsplit(url)
    repository_io._require(parsed.scheme == "https" and parsed.hostname == "raw.githubusercontent.com"
        and parsed.port in (None, 443) and not parsed.username and not parsed.password
        and not parsed.query and not parsed.fragment, "scriptTypeIcon 必须使用 HTTPS raw 来源")
    parts = parsed.path.split("/")
    repository_io._require(len(parts) >= 5 and re.fullmatch(r"[A-Za-z0-9-]+", parts[1])
        and re.fullmatch(r"[A-Za-z0-9._-]+", parts[2]) and re.fullmatch(r"[a-fA-F0-9]{40}", parts[3])
        and all(part and part not in (".", "..") for part in parts[4:]), "scriptTypeIcon 必须固定完整源码 SHA")
    repository_io._require(isinstance(digest, str) and re.fullmatch(r"[a-fA-F0-9]{64}", digest), "scriptTypeIcon SHA-256 无效")
    repository_io._require(mime in ("image/x-icon", "image/png") and parsed.path.lower().endswith(".png" if mime == "image/png" else ".ico"), "scriptTypeIcon 图像类型不匹配")

def _canonical_locale(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace("_", "-")
    if not repository_model.BCP47_LOCALE_PATTERN.fullmatch(normalized):
        return None
    parts = normalized.split("-")
    canonical = [parts[0].lower()]
    for part in parts[1:]:
        if len(part) == 4 and part.isalpha():
            canonical.append(part.title())
        elif len(part) == 2 and part.isalpha():
            canonical.append(part.upper())
        else:
            canonical.append(part.lower())
    return "-".join(canonical)


def _normalize_locale_list(raw_locales: Any, label: str) -> list[str]:
    repository_io._require(isinstance(raw_locales, list) and raw_locales, f"{label} 必须是非空数组")
    locales: list[str] = []
    for raw_locale in raw_locales:
        locale = _canonical_locale(raw_locale)
        repository_io._require(locale is not None, f"{label} 包含无效 locale：{raw_locale}")
        repository_io._require(str(raw_locale).strip().replace("_", "-") == locale, f"{label} 必须使用规范化 BCP 47 大小写：{raw_locale}")
        locales.append(locale)
    repository_io._require(len(set(locales)) == len(locales), f"{label} 不得重复")
    return locales


def _read_locale_registry(path: Path, label: str) -> tuple[str, list[str]]:
    data = repository_io.read_json(path)
    repository_io._require(isinstance(data, dict), f"{label} 必须是对象：{repository_io._display(path)}")
    default = _canonical_locale(data.get("default"))
    repository_io._require(default is not None, f"{label}.default 无效：{data.get('default')}")
    supported = data.get("supported")
    repository_io._require(isinstance(supported, list) and supported, f"{label}.supported 必须是非空数组")
    raw_locales = []
    for item in supported:
        raw_locales.append(item if isinstance(item, str) else item.get("id") if isinstance(item, dict) else None)
    locales = _normalize_locale_list(raw_locales, f"{label}.supported")
    repository_io._require(default in locales, f"{label}.default 不在 supported 中：{default}")
    return default, locales


def _read_locked_host_locales(root: Path) -> list[str]:
    return list(read_host_compatibility(root)["supportedLocales"])


def read_host_compatibility(root: Path) -> dict[str, Any]:
    """读取并严格校验本仓库声明的 Host/Frontend 兼容元数据。

    该文件只表达公开契约版本与 locale 集合，不再承担 SDK 源码或 Git 提交
    锁定职责。SDK 的具体源码 SHA 由验证和候选任务单独固定。
    """
    lock_path = root / "host.lock.json"
    data = repository_io.read_json(lock_path)
    repository_io._require(isinstance(data, dict), f"host.lock.json 必须是对象：{repository_io._display(lock_path)}")
    repository_io._require(set(data) == repository_model.HOST_COMPATIBILITY_KEYS, "host.lock.json 只能包含 hostApiVersion、frontendApiVersion、supportedLocales")
    for key in ("hostApiVersion", "frontendApiVersion"):
        value = data.get(key)
        repository_io._require(
            isinstance(value, str) and repository_model.HOST_API_VERSION_PATTERN.fullmatch(value) is not None,
            f"host.lock.json 的 {key} 必须是 major.minor 字符串",
        )
    locales = _normalize_locale_list(data.get("supportedLocales"), "host.lock.json 的 supportedLocales")
    return {
        "hostApiVersion": data["hostApiVersion"],
        "frontendApiVersion": data["frontendApiVersion"],
        "supportedLocales": locales,
    }


def validate_host_locale_registry(root: Path, host_root: Path) -> int:
    """验证插件锁定语言集合与宿主当前正式注册表及资源文件一致。"""
    from tools.sdk.source import SdkSourceError, resolve_localization_root

    try:
        localization_root = resolve_localization_root(host_root)
    except SdkSourceError as exc:
        raise repository_model.RepositoryError(str(exc)) from exc
    locked_locales = _read_locked_host_locales(root)
    web_default, web_locales = _read_locale_registry(
        host_root / "frontend" / "public" / "i18n" / "locales.json",
        "宿主 Web locale registry",
    )
    embedded_default, embedded_locales = _read_locale_registry(
        localization_root / "locales.json",
        "宿主 embedded locale registry",
    )
    repository_io._require(web_default == embedded_default, "宿主 Web 与 embedded 的默认 locale 不一致")
    repository_io._require(web_locales == embedded_locales, "宿主 Web 与 embedded 的 supported locale 顺序不一致")
    repository_io._require(web_locales == locked_locales, "host.lock.json 的 supportedLocales 与宿主当前 locale registry 不一致")
    for locale in locked_locales:
        web_resource = host_root / "frontend" / "public" / "i18n" / f"{locale}.json"
        embedded_resource = localization_root / f"{locale}.json"
        repository_io._require(web_resource.is_file(), f"宿主缺少 Web locale 资源：{repository_io._display(web_resource)}")
        repository_io._require(embedded_resource.is_file(), f"宿主缺少 embedded locale 资源：{repository_io._display(embedded_resource)}")
        repository_io._require(isinstance(repository_io.read_json(web_resource), dict), f"宿主 Web locale 资源必须是对象：{repository_io._display(web_resource)}")
        repository_io._require(isinstance(repository_io.read_json(embedded_resource), dict), f"宿主 embedded locale 资源必须是对象：{repository_io._display(embedded_resource)}")
    return len(locked_locales)


def _validate_localized_metadata(
    locales: Any,
    plugin_name: str,
    version: str,
    display_name: str,
    description: str,
    base_changelog: list[dict[str, Any]],
    supported_locales: frozenset[str],
) -> None:
    if locales is None:
        return
    repository_io._require(isinstance(locales, dict), f"插件 {plugin_name} 的 locales 必须是对象")
    expected_versions = [str(entry["version"]) for entry in base_changelog]
    seen_locales: set[str] = set()
    for raw_locale, value in locales.items():
        locale = _canonical_locale(raw_locale)
        repository_io._require(locale is not None, f"插件 {plugin_name} 的 locale 不受支持：{raw_locale}")
        repository_io._require(locale in supported_locales, f"插件 {plugin_name} 的 locale 尚未被当前宿主支持：{locale}")
        repository_io._require(locale not in seen_locales, f"插件 {plugin_name} 的 locale 重复：{locale}")
        seen_locales.add(locale)
        repository_io._require(isinstance(value, dict), f"插件 {plugin_name} 的 locales.{raw_locale} 必须是对象")
        repository_io._text(value.get("displayName"), f"插件 {plugin_name} 的 locales.{locale}.displayName", 128)
        repository_io._text(value.get("gameName"), f"插件 {plugin_name} 的 locales.{locale}.gameName", 128)
        repository_io._text(value.get("description"), f"插件 {plugin_name} 的 locales.{locale}.description", 2048)
        tags = value.get("tags")
        repository_io._require(isinstance(tags, list) and len(tags) <= 16, f"插件 {plugin_name} 的 locales.{locale}.tags 数量无效")
        seen_tags: set[str] = set()
        for tag in tags:
            normalized_tag = repository_io._text(tag, f"插件 {plugin_name} 的 locales.{locale}.tags 文本", 32)
            repository_io._require(normalized_tag.casefold() not in seen_tags, f"插件 {plugin_name} 的 locales.{locale}.tags 重复：{normalized_tag}")
            seen_tags.add(normalized_tag.casefold())
        changelog = value.get("changelog")
        repository_io._require(isinstance(changelog, list) and len(changelog) == len(expected_versions), f"插件 {plugin_name} 的 locales.{locale}.changelog 版本数量不一致")
        localized_versions: list[str] = []
        for index, entry in enumerate(changelog):
            repository_io._require(isinstance(entry, dict), f"插件 {plugin_name} 的 locales.{locale}.changelog 条目无效")
            entry_version = entry.get("version")
            repository_versions.parse_semver(entry_version, f"插件 {plugin_name} 的 locales.{locale}.changelog 版本")
            localized_versions.append(str(entry_version))
            items = entry.get("items")
            repository_io._require(isinstance(items, list) and 1 <= len(items) <= 32, f"插件 {plugin_name} 的 locales.{locale}.changelog items 数量无效")
            base_items = base_changelog[index].get("items")
            repository_io._require(
                isinstance(base_items, list) and len(items) == len(base_items),
                f"插件 {plugin_name} 的 locales.{locale}.changelog items 数量必须与基础记录一致",
            )
            for item in items:
                repository_io._text(item, f"插件 {plugin_name} 的 locales.{locale}.changelog 文本", 512)
        repository_io._require(localized_versions == expected_versions, f"插件 {plugin_name} 的 locales.{locale}.changelog 版本必须与基础记录一致")


def _validate_store(
    store: dict[str, Any],
    plugin_name: str,
    version: str,
    display_name: str,
    description: str,
    supported_locales: frozenset[str],
) -> None:
    repository_io._require(store.get("schemaVersion") == 1, f"插件 {plugin_name} 的 store.json schemaVersion 必须为 1")
    repository_io._text(store.get("gameName"), f"插件 {plugin_name} 的 gameName", 128)
    authors = store.get("authors")
    repository_io._require(isinstance(authors, list) and 1 <= len(authors) <= 8, f"插件 {plugin_name} 的 authors 数量必须为 1 至 8")
    for author in authors:
        repository_io._require(isinstance(author, dict), f"插件 {plugin_name} 的作者条目无效")
        repository_io._text(author.get("name"), f"插件 {plugin_name} 的作者名称", 64)
        url = author.get("url", "")
        repository_io._require(isinstance(url, str) and repository_io.is_https_url(url), f"插件 {plugin_name} 的作者 URL 无效")
    tags = store.get("tags", [])
    repository_io._require(isinstance(tags, list) and len(tags) <= 16, f"插件 {plugin_name} 的 tags 数量无效")
    seen_tags: set[str] = set()
    for tag in tags:
        normalized = repository_io._text(tag, f"插件 {plugin_name} 的标签", 32)
        repository_io._require(normalized.casefold() not in seen_tags, f"插件 {plugin_name} 的标签重复：{normalized}")
        seen_tags.add(normalized.casefold())
    homepage = store.get("homepage", "")
    repository_io._require(isinstance(homepage, str) and repository_io.is_https_url(homepage), f"插件 {plugin_name} 的 homepage 必须是 HTTPS 地址")
    changelog = store.get("changelog")
    repository_io._require(isinstance(changelog, list) and 1 <= len(changelog) <= 3, f"插件 {plugin_name} 的 changelog 必须包含 1 至 3 个版本")
    previous: repository_versions.ParsedVersion | None = None
    seen_versions: set[str] = set()
    for index, entry in enumerate(changelog):
        repository_io._require(isinstance(entry, dict), f"插件 {plugin_name} 的 changelog 条目无效")
        entry_version = entry.get("version")
        parsed = repository_versions.parse_semver(entry_version, f"插件 {plugin_name} 的 changelog 版本")
        repository_io._require(entry_version not in seen_versions, f"插件 {plugin_name} 的 changelog 版本重复：{entry_version}")
        seen_versions.add(entry_version)
        if index == 0:
            repository_io._require(entry_version == version, f"插件 {plugin_name} 的 changelog 第一条必须对应当前版本")
        elif previous is not None:
            repository_io._require(previous > parsed, f"插件 {plugin_name} 的 changelog 必须按从新到旧排列")
        previous = parsed
        repository_versions.parse_date(entry.get("date"), f"插件 {plugin_name} 的 changelog 日期")
        items = entry.get("items")
        repository_io._require(isinstance(items, list) and 1 <= len(items) <= 32, f"插件 {plugin_name} 的 changelog items 数量无效")
        for item in items:
            repository_io._text(item, f"插件 {plugin_name} 的 changelog 文本", 512)
    _validate_localized_metadata(
        store.get("locales"),
        plugin_name,
        version,
        display_name,
        description,
        changelog,
        supported_locales,
    )


def _validate_data_contract(plugin: Path, manifest: dict[str, Any]) -> None:
    name = str(manifest["name"])
    repository_io._safe_relative(plugin, manifest.get("resolve"), f"数据化插件 {name} 的 resolve", ".json")
    judge_path = repository_io._safe_relative(plugin, manifest.get("judgeScript"), f"数据化插件 {name} 的 judgeScript")
    _validate_judge_locale_contract(plugin, manifest, judge_path)
    for field in ("configEditor",):
        if field in manifest:
            repository_io._safe_relative(plugin, manifest.get(field), f"数据化插件 {name} 的 {field}", ".js")
    resolve_path = repository_io._safe_relative(plugin, manifest.get("resolve"), f"数据化插件 {name} 的 resolve", ".json")
    resolve = repository_io.read_json(resolve_path)
    repository_io._require(isinstance(resolve, dict), f"数据化插件 {name} 的 resolve.json 必须是对象")
    requirements = resolve.get("require")
    paths = resolve.get("paths")
    repository_io._require(isinstance(requirements, list) and 1 <= len(requirements) <= 32, f"数据化插件 {name} 的 require 数量无效")
    repository_io._require(isinstance(paths, dict), f"数据化插件 {name} 的 resolve.json 缺少 paths")
    output_encoding = resolve.get("outputEncoding")
    if output_encoding is not None:
        repository_io._require(output_encoding in ("utf-8", "windows-936", "system-default"),
                 f"数据化插件 {name} 的 outputEncoding 无效")
    process_contract = resolve.get("process")
    if process_contract is not None:
        repository_io._require(isinstance(process_contract, dict), f"数据化插件 {name} 的 process 必须是对象")
        repository_io._require(set(process_contract) == {"rootRole", "writesManagedConfig"}, f"数据化插件 {name} 的 process 字段无效")
        repository_io._require(process_contract["rootRole"] == "game_launcher", f"数据化插件 {name} 的 rootRole 无效")
        repository_io._require(process_contract["writesManagedConfig"] is False, f"数据化插件 {name} 的启动器不能声明为配置写入者")
        repository_io._require(isinstance(manifest.get("taskProtocol"), dict), f"数据化插件 {name} 的启动器角色需要任务终态协议")
    for item in requirements:
        repository_io._require(isinstance(item, dict), f"数据化插件 {name} 的 require 条目无效")
        repository_io._require(isinstance(item.get("var"), str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", item["var"]), f"数据化插件 {name} 的 require 变量无效")
        repository_io._require(isinstance(item.get("file"), str) and bool(item["file"].strip()), f"数据化插件 {name} 的 require 文件无效")
    for key in ("mainExe", "args", "configPath", "logPath"):
        repository_io._require(key in paths, f"数据化插件 {name} 的 paths 缺少 {key}")
    inputs = resolve.get("inputs")
    if inputs is not None:
        repository_io._require(isinstance(inputs, list) and len(inputs) <= 64, f"数据化插件 {name} 的 inputs 数量无效")
        input_names: set[str] = set()
        localization_keys = _localization_key_sets(plugin, manifest)
        for item in inputs:
            repository_io._require(isinstance(item, dict), f"数据化插件 {name} 的 inputs 条目无效")
            input_name = item.get("name")
            repository_io._require(
                isinstance(input_name, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", input_name),
                f"数据化插件 {name} 的输入变量名无效：{input_name}",
            )
            repository_io._require(input_name.casefold() not in input_names, f"数据化插件 {name} 的输入变量重复：{input_name}")
            input_names.add(input_name.casefold())
            for field in ("label", "description"):
                if field in item:
                    repository_io._text(item[field], f"数据化插件 {name} 的 inputs.{field}", 8192, required=False)
            for key_field in ("labelKey", "descriptionKey"):
                key = item.get(key_field, "")
                if key is None:
                    key = ""
                repository_io._require(
                    isinstance(key, str)
                    and (not key or (
                        len(key) <= 128
                        and repository_model.LOCALIZATION_KEY_PATTERN.fullmatch(key) is not None
                        and not any(char.isspace() for char in key)
                        and not key.startswith("legacy.")
                        and all(char.isascii() and (char.isalnum() or char in "-_.") for char in key)
                    )),
                    f"数据化插件 {name} 的 {key_field} 无效：{key}",
                )
                if key:
                    repository_io._require(
                        localization_keys and all(key in keys for keys in localization_keys),
                        f"数据化插件 {name} 的 {key_field} 未在全部插件词典中声明：{key}",
                    )
    extra = paths.get("extraConfigPaths")
    if extra is not None:
        repository_io._require(isinstance(extra, list), f"数据化插件 {name} 的 extraConfigPaths 必须是数组")
        for item in extra:
            repository_io._require(isinstance(item, str) and item.strip(), f"数据化插件 {name} 的附加配置路径无效")
            normalized = item.replace("\\", "/")
            repository_io._require(not os.path.isabs(item) and not PureWindowsPath(item).is_absolute() and ".." not in normalized.split("/"), f"数据化插件 {name} 的附加配置路径不安全")


def _validate_judge_locale_contract(plugin: Path, manifest: dict[str, Any], judge_path: Path) -> None:
    """Judge 使用宿主注入字段时，manifest 必须声明对应的最低宿主版本。"""
    source = judge_path.read_text(encoding="utf-8")
    if re.search(r"\binput\s*\.\s*locale\b", source) is None:
        return
    name = str(manifest.get("name", manifest.get("artifactName", plugin.name)))
    minimum = repository_versions.parse_semver(repository_model.JUDGE_LOCALE_MIN_HOST_VERSION, "judge locale 契约版本")
    actual = repository_versions.parse_semver(manifest.get("minHostVersion", "0.0.0"), f"插件 {name} 的 minHostVersion")
    repository_io._require(
        actual >= minimum,
        f"数据化插件 {name} 的 judgeScript 使用 input.locale 时 minHostVersion 必须至少为 {repository_model.JUDGE_LOCALE_MIN_HOST_VERSION}",
    )


def _validate_task_protocol_selector(selector: Any) -> None:
    repository_io._require(isinstance(selector, list) and 0 < len(selector) <= 32, "taskProtocol environment selector invalid")
    for token in selector:
        if isinstance(token, str):
            repository_io._require(0 < len(token) <= 256, "taskProtocol selector property invalid")
            continue
        repository_io._require(isinstance(token, dict), "taskProtocol selector token invalid")
        if "by" in token:
            repository_io._require(set(token) == {"by", "value"} and isinstance(token.get("by"), str) and bool(token["by"]), "taskProtocol identity selector invalid")
        else:
            repository_io._require(
                set(token) == {"index", "guardKey", "guardValue"}
                and isinstance(token.get("index"), int)
                and token["index"] >= 0
                and isinstance(token.get("guardKey"), str)
                and bool(token["guardKey"]),
                "taskProtocol guard selector invalid",
            )


def _validate_task_protocol_config_rules(value: Any) -> None:
    repository_io._require(isinstance(value, list) and 0 < len(value) <= 32, "taskProtocol.configRules must contain 1..32 rules")
    identifiers: set[str] = set()
    for rule in value:
        repository_io._require(isinstance(rule, dict) and set(rule) == {"id", "required", "criticality"}, "taskProtocol config rule fields invalid")
        identifier = rule.get("id")
        repository_io._require(isinstance(identifier, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,160}", identifier) and identifier not in identifiers, "taskProtocol config rule id invalid")
        identifiers.add(identifier)
        repository_io._require(type(rule.get("required")) is bool and rule.get("criticality") in {"critical_when_applicable", "advisory_or_contextual"}, "taskProtocol config rule invalid")


def _validate_task_protocol_environment_checks(value: Any) -> None:
    repository_io._require(isinstance(value, list) and len(value) <= 32, "taskProtocol.environmentChecks must contain at most 32 checks")
    identifiers: set[str] = set()
    for check in value:
        repository_io._require(
            isinstance(check, dict)
            and set(check).issubset({"id", "source", "expectedKind", "relativeBase", "networkAccess", "followReparsePoints", "comparison", "secondarySelector", "defaultValue", "secondaryDefaultValue"})
            and {"id", "source", "expectedKind", "relativeBase", "networkAccess", "followReparsePoints"}.issubset(check),
            "taskProtocol environment check fields invalid",
        )
        identifier = check.get("id")
        repository_io._require(isinstance(identifier, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,160}", identifier) and identifier not in identifiers, "taskProtocol environment check id invalid")
        identifiers.add(identifier)
        repository_io._require(
            check.get("expectedKind") in {"file", "directory", "file_or_directory", "adb_endpoint"}
            and check.get("relativeBase") in {"script_root", "config_directory", "none"}
            and check.get("networkAccess") is False
            and check.get("followReparsePoints") is False,
            "taskProtocol environment check policy invalid",
        )
        source = check.get("source")
        repository_io._require(isinstance(source, dict) and isinstance(source.get("kind"), str), "taskProtocol environment check source invalid")
        kind = source["kind"]
        if kind in {"config", "resource"}:
            repository_io._require(set(source) == {"kind", "resourceId", "selector"} and isinstance(source.get("resourceId"), str) and bool(source["resourceId"]), "taskProtocol environment resource source invalid")
            _validate_task_protocol_selector(source["selector"])
        elif kind == "mainConfig":
            repository_io._require(set(source) == {"kind", "selector"}, "taskProtocol main config source invalid")
            _validate_task_protocol_selector(source["selector"])
        elif kind == "host":
            repository_io._require(set(source) == {"kind", "field"} and source.get("field") in {"gameTarget", "scriptExecutable"}, "taskProtocol environment host source invalid")
        else:
            raise repository_model.RepositoryError("taskProtocol environment source kind invalid")
        comparison = check.get("comparison", "exact")
        repository_io._require(comparison in {"exact", "path_or_executable_parent", "adb_endpoint_with_port"}, "taskProtocol environment comparison invalid")
        repository_io._require(
            comparison != "path_or_executable_parent" or check.get("expectedKind") == "file_or_directory",
            "taskProtocol path comparison requires file_or_directory",
        )
        if comparison == "adb_endpoint_with_port":
            repository_io._require(
                kind in {"resource", "config", "mainConfig"}
                and check.get("expectedKind") == "adb_endpoint"
                and isinstance(check.get("secondarySelector"), list),
                "taskProtocol adb endpoint comparison invalid",
            )
            _validate_task_protocol_selector(check["secondarySelector"])
        else:
            repository_io._require("secondarySelector" not in check, "taskProtocol secondary selector invalid")
        for field in ("defaultValue", "secondaryDefaultValue"):
            if field in check:
                selector = source.get("selector") if field == "defaultValue" else check.get("secondarySelector")
                repository_io._require(kind != "host" and isinstance(selector, list) and len(selector) == 1 and isinstance(selector[0], str)
                         and isinstance(check[field], str) and 0 < len(check[field]) <= 512, "taskProtocol target default invalid")


def _validate_task_protocol_repair_rules(value: Any, config_rules: list[dict[str, Any]]) -> None:
    repository_io._require(isinstance(value, list) and len(value) <= 8, "taskProtocol.repairRules invalid")
    declared = {rule["id"] for rule in config_rules}
    identifiers: set[str] = set()
    required = {"id", "ruleId", "resourceId", "selector", "source", "format", "kind",
                "fromValues", "toValue", "preconditions", "explanation"}
    for rule in value:
        repository_io._require(isinstance(rule, dict) and required <= set(rule) <= required | {"skipWhen"}, "repair rule fields invalid")
        identifier = rule["id"]
        repository_io._require(isinstance(identifier, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,160}", identifier)
                 and identifier not in identifiers and rule["ruleId"] in declared, "repair rule id invalid")
        identifiers.add(identifier)
        resource = rule["resourceId"]
        repository_io._require(isinstance(resource, str) and (resource in ("config:$main", "extra:0") or re.fullmatch(r"config:[A-Za-z0-9_.{}/-]+", resource))
                 and ".." not in resource and "\\" not in resource
                 and rule["source"] == "user_snapshot" and rule["format"] in ("json", "yaml")
                 and rule["kind"] in ("replace_enum", "normalize_enum", "bind_game_path", "mxu_tasks", "mxu_preactions", "mfa_tasks", "enable_boolean")
                 and isinstance(rule["selector"], list) and 0 < len(rule["selector"]) <= 8
                 and all(isinstance(s, str) and s.strip() for s in rule["selector"])
                 and isinstance(rule["toValue"], str) and len(rule["toValue"]) <= 512, "invalid repair scope")
        if rule["kind"] in ("mxu_tasks", "mxu_preactions", "mfa_tasks"):
            repository_io._require(rule["format"] == "json" and rule["selector"] == (["TaskItems"] if rule["kind"] == "mfa_tasks" else ["instances"]), "invalid framework repair scope")
        pre = rule["preconditions"]
        repository_io._require(isinstance(pre, dict) and set(pre) == {"snapshotKind", "exclusiveResource", "noExtraConfig"}
                 and pre["snapshotKind"] in ("file", "any") and pre["exclusiveResource"] is True
                 and isinstance(pre["noExtraConfig"], bool), "repair preconditions invalid")
        if "skipWhen" in rule:
            skip = rule["skipWhen"]
            repository_io._require(isinstance(skip, dict) and set(skip) == {"selector", "equals"}
                     and isinstance(skip["selector"], list) and len(skip["selector"]) == 1
                     and isinstance(skip["selector"][0], str) and isinstance(skip["equals"], bool), "invalid repair skip condition")
        values = rule["fromValues"]
        repository_io._require(isinstance(values, list) and len(values) <= 32
                 and all(isinstance(item, str) and len(item) <= 64 for item in values)
                 and len(set(values)) == len(values), "repair source values invalid")
        repository_io._require(isinstance(rule["explanation"], str) and 0 < len(rule["explanation"]) <= 512,
                 "repair explanation invalid")


def _task_protocol_scripts(manifest: dict[str, Any]) -> dict[str, Any]:
    if "taskProtocol" not in manifest:
        return {}
    protocol = manifest["taskProtocol"]
    repository_io._require(manifest.get("kind") == "data-specialized", "taskProtocol requires data-specialized")
    repository_io._require(isinstance(protocol, dict) and protocol.get("version") == "0.2.0", "unsupported taskProtocol.version")
    fields = {"version", "discoverScript", "retryScript", "readResources", "localization", "configRules", "environmentChecks"}
    fields.add("repairRules")
    repository_io._require("configValidator" not in manifest, "taskProtocol cannot declare configValidator")
    repository_io._require(set(protocol) == fields, "taskProtocol fields invalid")
    required_host = "0.16.15"
    repository_io._require(repository_versions.is_semver(manifest.get("minHostVersion", "")) and repository_versions.parse_semver(manifest["minHostVersion"]) >= repository_versions.parse_semver(required_host), f"taskProtocol requires minHostVersion >= {required_host}")

    def safe_path(value: Any) -> bool:
        return isinstance(value, str) and 0 < len(value) <= 512 and not any(c in value for c in "\\:*?\0") and all(p not in {"", ".", ".."} for p in value.split("/"))

    localization = protocol["localization"]
    repository_io._require(isinstance(localization, dict) and set(localization) == {"defaultLocale", "messages"}, "task localization fields invalid")
    messages = localization["messages"]
    repository_io._require(isinstance(messages, dict) and 0 < len(messages) <= 16 and localization["defaultLocale"] in messages, "task localization locales invalid")
    repository_io._require(len({locale.lower() for locale in messages}) == len(messages), "duplicate task locale")
    for locale, path in messages.items():
        repository_io._require(re.fullmatch(r"[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*", locale) is not None, "task locale invalid")
        repository_io._require(safe_path(path) and path.startswith("data/i18n/") and path.endswith(".json"), "task localization requires safe data/i18n/*.json")
    _validate_task_protocol_config_rules(protocol["configRules"])
    _validate_task_protocol_environment_checks(protocol["environmentChecks"])
    _validate_task_protocol_repair_rules(protocol["repairRules"], protocol["configRules"])

    scripts = {key: protocol[key] for key in ("discoverScript", "retryScript")}
    for value in [*scripts.values(), manifest.get("judgeScript")]:
        repository_io._require(safe_path(value) and value.startswith("data/") and value.lower().endswith(".js"), "taskProtocol scripts require safe data/*.js paths")
    resources = protocol["readResources"]
    repository_io._require(isinstance(resources, list) and len(resources) <= 128, "taskProtocol.readResources invalid")
    ids: set[str] = set()
    for resource in resources:
        fields = {"id", "source", "path", "format", "required"}
        repository_io._require(isinstance(resource, dict), "taskProtocol resource fields invalid")
        if "sha256" in resource:
            fields.add("sha256")
            repository_io._require(isinstance(resource["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", resource["sha256"]) is not None
                     and resource.get("source") == "root" and resource.get("format") == "text", "taskProtocol resource.sha256 invalid")
        if "operationalFields" in resource:
            fields.add("operationalFields")
            operational = resource["operationalFields"]
            reserved = {"name", "installed", "current_profile", "current_version", "current_version_missing",
                        "available_versions", "update_state", "update_target_version", "update_error"}
            repository_io._require(resource.get("source") == "root"
                     and resource.get("format") == "json" and isinstance(operational, dict)
                     and 0 < len(operational) <= 2, "taskProtocol operationalFields invalid")
            for field_name, field_type in operational.items():
                repository_io._require(re.fullmatch(r"[a-z][a-z0-9_]{0,39}", field_name) is not None
                         and field_name not in reserved and field_type in {"boolean", "timestamp"},
                         "taskProtocol operational field invalid")
        repository_io._require(set(resource) == fields, "taskProtocol resource fields invalid")
        identity = resource["id"]
        repository_io._require(isinstance(identity, str) and 0 < len(identity) <= 512 and not identity.startswith("config:") and identity not in ids, "taskProtocol resource id invalid")
        ids.add(identity)
        repository_io._require(resource["source"] in ("root", "extraConfig") and resource["format"] in ("json", "yaml", "text") and type(resource["required"]) is bool and safe_path(resource["path"]), "taskProtocol resource invalid")
    return scripts


def _validate_task_localization(manifest: dict[str, Any], read) -> None:
    declaration = manifest.get("taskProtocol", {}).get("localization")
    if declaration is None:
        return
    def unique(pairs):
        result = {}
        for key, value in pairs:
            repository_io._require(key not in result, "duplicate task localization message")
            result[key] = value
        return result
    budget = 0
    for path in declaration["messages"].values():
        try:
            data = read(path)
            budget += len(data)
            repository_io._require(budget <= 256 * 1024, "task localization budget exceeded")
            messages = json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique)
        except (OSError, KeyError, UnicodeError, ValueError) as exc:
            raise repository_model.RepositoryError("cannot read task localization: " + path) from exc
        repository_io._require(isinstance(messages, dict) and len(messages) <= 4096, "task localization messages invalid")
        for key, value in messages.items():
            repository_io._require(re.fullmatch(r"[A-Za-z0-9_.-]{1,160}", key) is not None and isinstance(value, str) and 0 < len(value) <= 2048, "task localization message invalid")


def _validate_specialized_manifest_contract(manifest: dict[str, Any], label: str) -> None:
    """校验专项插件的声明面；源码与 ZIP 复用同一份白名单。"""
    _task_protocol_scripts(manifest)
    _validate_script_type_icon(manifest)
    artifact = str(manifest.get("artifactName", label))
    repository_io._require(str(manifest.get("kind", "")).strip().lower() == "data-specialized", f"专项插件 {artifact} 的 kind 必须为 data-specialized")
    repository_io._require("frontend" not in manifest, f"专项插件 {artifact} 禁止声明 frontend 字段（包括 null）")
    capabilities = manifest.get("capabilities", [])
    repository_io._require(isinstance(capabilities, list), f"专项插件 {artifact} 的 capabilities 必须是数组")
    seen: set[str] = set()
    for capability in capabilities:
        repository_io._require(isinstance(capability, str) and bool(capability.strip()), f"专项插件 {artifact} 的 capability 无效：{capability}")
        normalized = capability.strip()
        repository_io._require(normalized in repository_model.SPECIALIZED_CAPABILITIES, f"专项插件 {artifact} 的 capability 不受支持：{normalized}")
        repository_io._require(normalized not in seen, f"专项插件 {artifact} 的 capability 重复：{normalized}")
        seen.add(normalized)


def _resolve_specialized_script_reference(root: Path, source: Path, reference: str, label: str) -> Path | None:
    """解析专项后端脚本中的相对 import/require，只允许 data 闭包。"""
    if not reference.startswith("."):
        return None
    base = source.parent / Path(*reference.replace("\\", "/").split("/"))
    candidates = [base]
    if not base.suffix:
        candidates.extend(base.with_suffix(suffix) for suffix in (".js", ".mjs", ".py", ".json"))
    for candidate in candidates:
        resolved = candidate.resolve()
        data_root = (root / "data").resolve()
        if resolved != data_root and data_root not in resolved.parents:
            raise repository_model.RepositoryError(f"专项插件脚本引用越出 data 闭包：{label} -> {reference}")
        if resolved.is_file():
            return resolved
    raise repository_model.RepositoryError(f"专项插件脚本引用文件不存在：{label} -> {reference}")


def _specialized_script_closure(root: Path, manifest: dict[str, Any]) -> set[Path]:
    closure: set[Path] = set()
    queue: list[Path] = []
    artifact = str(manifest.get("artifactName", root.name))
    declarations = {**manifest, **_task_protocol_scripts(manifest)}
    def read_text_asset(path):
        asset = repository_io._safe_relative(root, path, "task localization")
        repository_io._require(not asset.is_symlink() and not any(parent.is_symlink() for parent in asset.parents if parent != root.parent), "task localization cannot use symlinks")
        repository_io._require(asset.stat().st_size <= 256 * 1024, "task localization asset too large")
        return asset.read_bytes()
    _validate_task_localization(manifest, read_text_asset)
    for field in ("judgeScript", "configEditor", "discoverScript", "retryScript"):
        if field not in declarations:
            continue
        script = repository_io._safe_relative(root, declarations.get(field), f"专项插件 {artifact} 的 {field}")
        data_root = (root / "data").resolve()
        resolved = script.resolve()
        repository_io._require(resolved == data_root or data_root in resolved.parents, f"专项插件 {artifact} 的 {field} 必须位于 data/ 内")
        repository_io._require(resolved.suffix.lower() in {".js", ".mjs", ".py"}, f"专项插件 {artifact} 的 {field} 必须是 JS/MJS/Python 后端脚本")
        queue.append(resolved)

    import_pattern = re.compile(
        r"(?:import\s+(?:[^;]*?\s+from\s+)?|import\s*\(|require\s*\()\s*['\"]([^'\"]+)['\"]"
    )
    while queue:
        source = queue.pop()
        if source in closure:
            continue
        closure.add(source)
        if source.suffix.lower() not in {".js", ".mjs"}:
            continue
        try:
            text = source.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            raise repository_model.RepositoryError(f"专项插件脚本无法读取：{repository_io._display(source)}；{exc}") from exc
        repository_io._require("__NXP_ADAPTATION_REQUIRED__" not in text, f"专项插件仍有未适配模板标记：{repository_io._display(source)}")
        for reference in import_pattern.findall(text):
            target = _resolve_specialized_script_reference(root, source, reference, f"{artifact}/{source.name}")
            if target is not None:
                queue.append(target)
    return closure


def validate_specialized_contract(plugin_or_root: repository_model.SourcePlugin | Path, manifest: dict[str, Any] | None = None) -> None:
    """验证 data-specialized 源码/载荷不能携带任意浏览器或 managed 代码。"""
    if isinstance(plugin_or_root, repository_model.SourcePlugin):
        root = plugin_or_root.root
        manifest = plugin_or_root.manifest
    else:
        root = Path(plugin_or_root)
    repository_io._require(isinstance(manifest, dict), f"专项插件 manifest 无效：{repository_io._display(root)}")
    _validate_specialized_manifest_contract(manifest, root.name)
    closure = _specialized_script_closure(root, manifest)
    artifact = str(manifest.get("artifactName", root.name))
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        parts = [part.casefold() for part in relative.parts]
        name = path.name.casefold()
        suffix = path.suffix.casefold()
        repository_io._require(
            "frontend" not in parts and "web" not in parts,
            f"专项插件 {artifact} 禁止浏览器目录：{repository_io._display(relative)}",
        )
        repository_io._require(name not in repository_model.SPECIALIZED_FORBIDDEN_NAMES, f"专项插件 {artifact} 禁止浏览器工程文件：{repository_io._display(relative)}")
        repository_io._require(
            not name.startswith(("vite.config.", "webpack.config.", "rollup.config."))
            and not (name.startswith("tsconfig") and suffix == ".json"),
            f"专项插件 {artifact} 禁止前端构建配置：{repository_io._display(relative)}",
        )
        repository_io._require(suffix not in repository_model.SPECIALIZED_FORBIDDEN_SUFFIXES, f"专项插件 {artifact} 禁止浏览器或 managed 载荷：{repository_io._display(relative)}")
        if suffix in {".js", ".mjs", ".py"} and "data" in parts:
            repository_io._require(path.resolve() in closure, f"专项插件 {artifact} 的后端脚本未被声明执行闭包引用：{repository_io._display(relative)}")


def _validate_frontend_contract(plugin: Path, manifest: dict[str, Any]) -> None:
    frontend = manifest.get("frontend")
    if frontend is None:
        return
    repository_io._require(isinstance(frontend, dict), f"插件 {manifest['artifactName']} 的 frontend 必须是对象")
    capabilities = manifest.get("capabilities", [])
    repository_io._require("frontend-module" in capabilities, f"插件 {manifest['artifactName']} 声明 frontend 时必须声明 frontend-module capability")
    api_version = frontend.get("apiVersion")
    repository_io._require(api_version == "1.6", f"插件 {manifest['artifactName']} 的 frontend.apiVersion 必须为 1.6")
    repository_io._safe_relative(plugin, frontend.get("entry"), f"插件 {manifest['artifactName']} 的 frontend.entry", ".js")
    styles = frontend.get("styles", [])
    repository_io._require(isinstance(styles, list), f"插件 {manifest['artifactName']} 的 frontend.styles 必须是数组")
    for style in styles:
        repository_io._safe_relative(plugin, style, f"插件 {manifest['artifactName']} 的 frontend.styles", ".css")


def _validate_localization_contract(plugin: Path, manifest: dict[str, Any], supported_locales: frozenset[str]) -> None:
    localization = manifest.get("localization")
    if localization is None:
        return
    repository_io._require(isinstance(localization, dict), f"插件 {manifest['artifactName']} 的 localization 必须是对象")
    default_locale = _canonical_locale(localization.get("defaultLocale", "zh-CN"))
    repository_io._require(default_locale is not None, f"插件 {manifest['artifactName']} 的 localization.defaultLocale 不受支持")
    repository_io._require(default_locale in supported_locales, f"插件 {manifest['artifactName']} 的 localization.defaultLocale 尚未被当前宿主支持：{default_locale}")
    entries = localization.get("locales", localization.get("resources"))
    repository_io._require(isinstance(entries, dict) and entries, f"插件 {manifest['artifactName']} 的 localization.locales 必须是非空对象")
    seen: set[str] = set()
    key_sets: list[set[str]] = []
    placeholders_by_key: dict[str, set[str]] | None = None
    for raw_locale, relative_path in entries.items():
        locale = _canonical_locale(raw_locale)
        repository_io._require(locale is not None and locale in supported_locales and locale not in seen, f"插件 {manifest['artifactName']} 的 localization locale 无效、未被当前宿主支持或重复：{raw_locale}")
        seen.add(locale)
        normalized = str(relative_path).replace("\\", "/") if isinstance(relative_path, str) else ""
        repository_io._require(normalized.startswith("i18n/") and normalized.lower().endswith(".json"), f"插件 {manifest['artifactName']} 的 localization 资源路径无效：{relative_path}")
        resource = repository_io._safe_relative(plugin, relative_path, f"插件 {manifest['artifactName']} 的 localization.{locale}", ".json")
        repository_io._require(resource.stat().st_size <= repository_model.MAX_LOCALIZATION_FILE_BYTES, f"插件 {manifest['artifactName']} 的 localization 资源文件过大：{relative_path}")
        value = repository_io.read_json(resource)
        repository_io._require(isinstance(value, dict) and len(value) <= repository_model.MAX_LOCALIZATION_KEYS, f"插件 {manifest['artifactName']} 的 localization 资源必须是有限对象")
        keys: set[str] = set()
        for key, item in value.items():
            repository_io._require(
                isinstance(key, str)
                and 0 < len(key) <= repository_model.MAX_LOCALIZATION_KEY_LENGTH
                and repository_model.LOCALIZATION_KEY_PATTERN.fullmatch(key) is not None
                and not any(char.isspace() for char in key)
                and not key.startswith("legacy."),
                f"插件 {manifest['artifactName']} 的 localization key 无效：{key}",
            )
            repository_io._require(
                isinstance(item, str)
                and bool(item.strip())
                and len(item) <= repository_model.MAX_LOCALIZATION_VALUE_LENGTH
                and not any(ord(char) < 32 for char in item),
                f"插件 {manifest['artifactName']} 的 localization value 无效：{key}",
            )
            keys.add(key)
        placeholders = {
            key: set(repository_model.PLACEHOLDER_PATTERN.findall(str(value)))
            for key, value in value.items()
        }
        if placeholders_by_key is None:
            placeholders_by_key = placeholders
        else:
            repository_io._require(
                placeholders == placeholders_by_key,
                f"插件 {manifest['artifactName']} 的 localization 占位符集合必须一致：{raw_locale}",
            )
        key_sets.append(keys)
    repository_io._require(default_locale in seen, f"插件 {manifest['artifactName']} 的 localization.defaultLocale 缺少资源")
    repository_io._require(all(keys == key_sets[0] for keys in key_sets[1:]), f"插件 {manifest['artifactName']} 的 localization 资源 key 集合必须一致")


def _localization_key_sets(plugin: Path, manifest: dict[str, Any]) -> list[set[str]]:
    localization = manifest.get("localization")
    if not isinstance(localization, dict):
        return []
    entries = localization.get("locales", localization.get("resources"))
    if not isinstance(entries, dict):
        return []
    result: list[set[str]] = []
    for relative_path in entries.values():
        resource = repository_io._safe_relative(plugin, relative_path, f"插件 {manifest['artifactName']} 的 localization 资源", ".json")
        value = repository_io.read_json(resource)
        result.append(set(value) if isinstance(value, dict) else set())
    return result


def _category_for(root: Path) -> str:
    repository_io._require(root.parent.name in {"general", "specialized"}, f"正式插件必须位于 plugins/general/ 或 plugins/specialized/：{repository_io._display(root)}")
    return root.parent.name


def validate_source_plugin(root: Path, *, supported_locales: frozenset[str] = repository_model.DEFAULT_SUPPORTED_LOCALES) -> repository_model.SourcePlugin:
    category = _category_for(root)
    manifest_path = root / "plugin.json"
    store_path = root / "store.json"
    repository_io._require(manifest_path.is_file(), f"插件目录缺少 plugin.json：{repository_io._display(root)}")
    repository_io._require(store_path.is_file(), f"插件目录缺少 store.json：{repository_io._display(root)}")
    manifest = repository_io.read_json(manifest_path)
    store = repository_io.read_json(store_path)
    repository_io._require(isinstance(manifest, dict), f"plugin.json 必须是对象：{repository_io._display(manifest_path)}")
    repository_io._require("configValidator" not in manifest, f"插件 {root.name} 声明已退役的 configValidator；请升级到 taskProtocol 配置诊断")
    repository_io._require(isinstance(store, dict), f"store.json 必须是对象：{repository_io._display(store_path)}")
    _task_protocol_scripts(manifest)
    _validate_script_type_icon(manifest)
    repository_io._require(manifest.get("schemaVersion") == 2, f"插件 {root.name} 的 plugin.json schemaVersion 必须为 2")
    artifact = manifest.get("artifactName")
    repository_io._require(isinstance(artifact, str) and repository_model.ARTIFACT_PATTERN.fullmatch(artifact) and any(char.isupper() for char in artifact), f"artifactName 无效：{artifact}")
    repository_io._require(root.name == artifact, f"artifactName 与插件目录不一致：{root.name} / {artifact}")
    name = manifest.get("name")
    repository_io._require(isinstance(name, str) and len(name) <= 64 and repository_model.PLUGIN_ID_PATTERN.fullmatch(name), f"插件机器 ID 无效：{name}")
    repository_io._require("supportsEmulator" not in manifest and "replaces" not in manifest, f"插件 {name} 不支持历史兼容字段")
    version = manifest.get("version")
    repository_versions.parse_semver(version, f"插件 {artifact} 的版本")
    kind = str(manifest.get("kind", "")).strip().lower()
    repository_io._require(kind in repository_model.SUPPORTED_KINDS, f"插件 {artifact} 的类型不受支持：{kind}")
    if root.parent.name in {"general", "specialized"}:
        expected = "managed-code" if root.parent.name == "general" else "data-specialized"
        repository_io._require(kind == expected, f"插件 {artifact} 必须位于 plugins/{root.parent.name}/")
    _validate_store(
        store,
        name,
        version,
        str(manifest.get("displayName", "")),
        str(manifest.get("description", "")),
        supported_locales,
    )
    min_host = manifest.get("minHostVersion")
    host_version = repository_versions.parse_semver(min_host, f"插件 {artifact} 的 minHostVersion")
    repository_io._require(host_version >= repository_versions.parse_semver("0.16.15"), f"插件 {artifact} 的 minHostVersion 必须至少为 0.16.15")
    capabilities = manifest.get("capabilities", [])
    repository_io._require(isinstance(capabilities, list), f"插件 {artifact} 的 capabilities 必须是数组")
    for capability in capabilities:
        repository_io._require(isinstance(capability, str) and bool(capability.strip()), f"插件 {artifact} 的 capability 无效")
        minimum = repository_model.CAPABILITY_MIN_HOST.get(capability)
        if minimum:
            repository_io._require(
                host_version >= repository_versions.parse_semver(minimum, "插件能力最低宿主版本"),
                f"插件能力要求的最低宿主版本未满足：{name} -> {capability}",
            )
    _validate_localization_contract(root, manifest, supported_locales)
    if "configurationRevision" in manifest:
        revision = manifest["configurationRevision"]
        repository_io._require(kind == "data-specialized" and isinstance(revision, str)
                 and re.fullmatch(r"[A-Za-z0-9._-]{1,96}", revision),
                 f"插件 {artifact} 的 configurationRevision 必须是专项插件的稳定配置修订标识")
        repository_io._require(host_version >= repository_versions.parse_semver("0.16.14", "配置修订最低宿主版本"),
                 f"插件 {artifact} 的 configurationRevision 要求 Host 0.16.14")
    if kind == "data-specialized":
        validate_specialized_contract(root, manifest)
        _validate_data_contract(root, manifest)
    else:
        projects = sorted((root / "src").glob("*.csproj"))
        repository_io._require(bool(projects), f"managed-code 插件 {artifact} 缺少 src/*.csproj")
        repository_io._require(host_version >= repository_versions.parse_semver("0.17.0"), f"managed-code 插件 {artifact} 的 minHostVersion 必须至少为 0.17.0")
        api_version = manifest.get("apiVersion")
        repository_io._require(api_version == "2.1", f"managed-code 插件 {artifact} 必须使用 Plugin API 2.1")
    if "configEditor" in manifest:
        repository_io._require(kind == "data-specialized", f"插件 {artifact} 的配置脚本仅支持 data-specialized")
    _validate_frontend_contract(root, manifest)
    homepage = store.get("homepage", "")
    canonical_prefix = f"https://github.com/{repository_model.REPOSITORY}/tree/main/plugins/"
    if isinstance(homepage, str) and homepage.startswith(canonical_prefix):
        expected_homepage = f"{canonical_prefix}{category}/{artifact}"
        repository_io._require(homepage == expected_homepage, f"插件 {artifact} 的 homepage 必须指向当前分类源码目录：{expected_homepage}")
    return repository_model.SourcePlugin(category, root, manifest, store)


def _plugin_directories(root: Path) -> list[Path]:
    plugins_root = root / "plugins"
    repository_io._require(plugins_root.is_dir(), f"缺少插件源码目录：{repository_io._display(plugins_root)}")
    categories = ("general", "specialized")
    for manifest_path in sorted(plugins_root.rglob("plugin.json")):
        relative = manifest_path.relative_to(plugins_root).parts
        repository_io._require(
            len(relative) == 3 and relative[0] in categories and relative[2] == "plugin.json",
            f"正式插件必须位于 plugins/general/ 或 plugins/specialized/：{repository_io._display(manifest_path.parent)}",
        )
    result: list[Path] = []
    for category in categories:
        category_root = plugins_root / category
        repository_io._require(category_root.is_dir(), f"缺少插件分类目录：{repository_io._display(category_root)}")
        result.extend(sorted(path for path in category_root.iterdir() if path.is_dir()))
    repository_io._require(bool(result), "plugins 目录为空")
    return result


def discover_source_plugins(root: Path) -> list[repository_model.SourcePlugin]:
    result: list[repository_model.SourcePlugin] = []
    names: set[str] = set()
    artifacts: set[str] = set()
    supported_locales = frozenset(read_host_compatibility(root)["supportedLocales"])
    for directory in _plugin_directories(root):
        plugin = validate_source_plugin(directory, supported_locales=supported_locales)
        name_key = plugin.name.casefold()
        artifact_key = plugin.artifact_name.casefold()
        repository_io._require(name_key not in names, f"插件机器 ID 重复：{plugin.name}")
        repository_io._require(artifact_key not in artifacts, f"artifactName 重复：{plugin.artifact_name}")
        names.add(name_key)
        artifacts.add(artifact_key)
        result.append(plugin)
    return result


def validate_json_tree(root: Path) -> int:
    count = 0
    for path in sorted(root.rglob("*.json")):
        if any(part in {".git", ".generated", "bin", "obj", "__pycache__"} for part in path.parts):
            continue
        repository_io.read_json(path)
        count += 1
    return count


def validate_sources(root: Path) -> tuple[int, int]:
    plugins = discover_source_plugins(root)
    json_count = validate_json_tree(root)
    read_host_compatibility(root)
    return len(plugins), json_count


def check_syntax(root: Path) -> int:
    files = sorted(path for path in (root / "plugins").rglob("*.js") if "bin" not in path.parts and "obj" not in path.parts)
    files += sorted(path for path in (root / "plugins").rglob("*.mjs") if "bin" not in path.parts and "obj" not in path.parts)
    repository_io._require(bool(files), "未找到插件 JavaScript 文件")
    for path in files:
        repository_io._run(("node", "--check", str(path)), f"JavaScript 语法：{repository_io._display(path)}", root)
    for path in sorted(root.rglob("*.py")):
        if any(part in {".git", ".generated", "bin", "obj", "__pycache__"} for part in path.parts):
            continue
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except (OSError, SyntaxError) as exc:
            raise repository_model.RepositoryError(f"Python 语法失败：{repository_io._display(path)}；{exc}") from exc
        print(f"[repository] Python 语法：{repository_io._display(path)}", flush=True)
        files.append(path)
    return len(files)
