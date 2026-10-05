from __future__ import annotations
from pathlib import Path
import tools.repository.archive as repository_archive
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import re
import zipfile
from typing import Any

import tools.repository.git as repository_git
import tools.repository.source as repository_source
import hashlib
import json
import shutil

WORKFLOW_PATH = ".github/workflows/publish-stable.yml"


PREVIEW_WORKFLOW_PATH = ".github/workflows/publish-develop.yml"


def _builder_fingerprint(source_root: Path, kind: str) -> str:
    controller = Path(__file__).resolve().parents[2]
    entries: dict[str, Path] = {}
    for directory in ("tools/repository", "tools/release", "tools/sdk", "tools/generate"):
        for file in (controller / directory).rglob("*"):
            if file.is_file() and "__pycache__" not in file.parts:
                entries["controller/" + file.relative_to(controller).as_posix()] = file
    for relative in (WORKFLOW_PATH, PREVIEW_WORKFLOW_PATH):
        file = controller / relative
        if file.is_file():
            entries["controller/" + relative] = file
    for relative in ("Directory.Build.props", "Directory.Build.targets", "global.json", "host.lock.json",
                     "package.json", "package-lock.json"):
        file = source_root / relative
        if file.is_file():
            entries["source/" + relative] = file
    if kind == "data-specialized":
        for file in (source_root / "adapters").rglob("*"):
            if file.is_file() and file.suffix in {".js", ".json"}:
                entries["source/" + file.relative_to(source_root).as_posix()] = file
    digest = hashlib.sha256()
    for name, file in sorted(entries.items()):
        repository_io._require(not file.is_symlink(), f"Linked package input: {name}")
        digest.update(name.encode("utf-8") + b"\0")
        digest.update(file.read_bytes())
    return digest.hexdigest()


def package_input_identities(root: Path, plan: dict[str, Any], partner_sha: str) -> dict[str, str]:
    """Identity all inputs that can affect one candidate package's bytes."""
    head = repository_git.git_head(root)
    plugins = {plugin.artifact_name: plugin for plugin in repository_source.discover_source_plugins(root)}
    shared = []
    for relative in ("host.lock.json", "package.json", "package-lock.json"):
        if (root / relative).exists():
            shared.append((relative, repository_git._git(root, ["rev-parse", f"{head}:{relative}"],
                                               f"读取 package input {relative}")))
    result: dict[str, str] = {}
    for artifact in plan.get("requiresPackage", []):
        plugin = plugins.get(artifact)
        repository_io._require(plugin is not None, f"package input 包含未知插件：{artifact}")
        relative = plugin.root.relative_to(root).as_posix()
        identity = {
            "artifact": artifact,
            "version": plugin.version,
            "kind": plugin.kind,
            "sourceTree": repository_git.git_tree(root, head, relative),
            "shared": shared,
            "builderFingerprint": _builder_fingerprint(root, plugin.kind),
            "sdkSha": partner_sha if plugin.kind == "managed-code" else None,
            "platform": "windows-x64" if plugin.kind == "managed-code" else "portable-data",
        }
        result[artifact] = hashlib.sha256(
            json.dumps(identity, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
    return result


def reusable_candidate_packages(root: Path, candidate_root: Path,
                                expected_inputs: dict[str, str]) -> dict[str, Path]:
    """Treat an older candidate as data and return only byte-verified reusable packages."""
    candidate = repository_io.read_json(candidate_root / "candidate.json")
    repository_io._require(isinstance(candidate, dict) and candidate.get("schemaVersion") == 2,
                  "复用候选不含 package input identity；需要重新构建")
    declared_inputs = candidate.get("packageInputs")
    inventory = candidate.get("files")
    repository_io._require(isinstance(declared_inputs, dict) and isinstance(inventory, list),
                  "复用候选 input/inventory 无效")
    inventory_by_path: dict[str, dict[str, Any]] = {}
    for item in inventory:
        repository_io._require(isinstance(item, dict) and isinstance(item.get("path"), str),
                      "复用候选 inventory 条目无效")
        inventory_by_path[item["path"]] = item
    plan = repository_io.read_json(candidate_root / "release-plan.json")
    metadata = plan.get("packageMetadata") if isinstance(plan, dict) else None
    repository_io._require(isinstance(metadata, dict), "复用候选缺少 packageMetadata")
    reusable: dict[str, Path] = {}
    for artifact, input_sha in expected_inputs.items():
        if declared_inputs.get(artifact) != input_sha:
            continue
        item = metadata.get(artifact)
        repository_io._require(isinstance(item, dict) and isinstance(item.get("path"), str),
                      f"复用候选缺少包路径：{artifact}")
        relative = item["path"]
        repository_io._require(relative.startswith(f"packages/{artifact}/") and ".." not in relative.split("/"),
                      f"复用候选包路径无效：{relative}")
        path = candidate_root / relative
        declared = inventory_by_path.get(relative)
        repository_io._require(path.is_file() and not path.is_symlink() and isinstance(declared, dict),
                      f"复用候选包文件无效：{relative}")
        repository_io._require(_sha_file(path) == declared.get("sha256") == item.get("sha256")
                      and path.stat().st_size == declared.get("sizeBytes") == item.get("sizeBytes"),
                      f"复用候选包摘要或大小不符：{relative}")
        reusable[artifact] = path
    return reusable


def _sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def extract_candidate_artifact(archive_path: Path, output: Path, *, expected_digest: str) -> None:
    """Extract a server-identified Actions artifact as data only."""
    repository_io._require(isinstance(expected_digest, str)
                  and re.fullmatch(r"sha256:[0-9a-f]{64}", expected_digest) is not None,
                  "candidate artifact 服务端摘要无效")
    repository_io._require(archive_path.is_file() and not archive_path.is_symlink(), "candidate artifact ZIP 无效")
    repository_io._require(not output.exists() and not output.is_symlink(), "candidate artifact 输出已存在")
    repository_io._require(_sha_file(archive_path) == expected_digest.removeprefix("sha256:"),
                  "candidate artifact 与服务端 SHA256 不符")
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            repository_io._require(1 <= len(infos) <= 4096, "candidate artifact 文件数超限")
            names: set[str] = set()
            total = 0
            for info in infos:
                name = info.filename
                parts = name.rstrip("/").split("/")
                repository_io._require(not name.startswith("/") and "\\" not in name
                              and all(part not in {"", ".", ".."} for part in parts)
                              and not re.match(r"^[A-Za-z]:", name),
                              f"candidate artifact 路径无效：{name}")
                folded = name.rstrip("/").casefold()
                repository_io._require(folded not in names, f"candidate artifact 重复路径：{name}")
                names.add(folded)
                mode = (info.external_attr >> 16) & 0o170000
                repository_io._require(mode in {0, 0o040000 if info.is_dir() else 0o100000}
                              and (info.is_dir() or mode != 0o040000),
                              f"candidate artifact 禁止链接或特殊条目：{name}")
                if info.is_dir():
                    repository_io._require(name.rstrip("/") == "packages"
                                  or (len(parts) == 2 and parts[0] == "packages"),
                                  f"candidate artifact 目录越界：{name}")
                    continue
                repository_io._require(name in {"candidate.json", "catalog.json", repository_model.STATE_FILE,
                                      "release-plan.json"}
                              or (len(parts) == 3 and parts[0] == "packages"
                                  and name.endswith(".zip")),
                              f"candidate artifact 文件越界：{name}")
                total += info.file_size
                repository_io._require(0 <= info.file_size <= 512 * 1024 * 1024
                              and total <= 512 * 1024 * 1024,
                              "candidate artifact 展开字节数超限")
            repository_io._require("candidate.json" in names, "candidate artifact 缺少清单")
            output.mkdir(parents=True)
            for info in infos:
                target = output / info.filename
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as source, target.open("xb") as destination:
                    shutil.copyfileobj(source, destination, 1024 * 1024)
    except zipfile.BadZipFile as exc:
        raise repository_model.RepositoryError("candidate artifact ZIP 损坏") from exc


def _preview_files(output: Path) -> list[dict[str, Any]]:
    repository_io._require(output.is_dir() and not output.is_symlink(), "preview candidate 目录无效")
    files = []
    total = 0
    folded: set[str] = set()
    for path in output.rglob("*"):
        relative = path.relative_to(output).as_posix()
        repository_io._require(not path.is_symlink(), f"preview candidate 禁止链接：{relative}")
        if path.is_dir():
            repository_io._require(relative == "packages", f"preview candidate 目录越界：{relative}")
            continue
        repository_io._require(path.is_file(), f"preview candidate 特殊文件：{relative}")
        repository_io._require(relative in {"catalog.json", "preview-plan.json", "candidate.json"}
                      or (relative.startswith("packages/") and relative.count("/") == 1
                          and relative.endswith(".zip")),
                      f"preview candidate 文件越界：{relative}")
        key = relative.casefold()
        repository_io._require(key not in folded, f"preview candidate 路径大小写冲突：{relative}")
        folded.add(key)
        if relative == "candidate.json":
            continue
        size = path.stat().st_size
        total += size
        repository_io._require(len(files) < 4096 and total <= 512 * 1024 * 1024,
                      "preview candidate 文件数或大小超限")
        files.append({"path": relative, "sha256": _sha_file(path), "sizeBytes": size})
    repository_io._require({"catalog.json", "preview-plan.json"} <= {item["path"] for item in files},
                  "preview candidate 缺少 catalog/plan")
    return sorted(files, key=lambda item: item["path"])


def extract_preview_artifact(archive_path: Path, output: Path, *, expected_digest: str) -> None:
    """Extract only preview candidate data and its separate producer sidecar."""
    repository_io._require(isinstance(expected_digest, str)
                  and re.fullmatch(r"sha256:[0-9a-f]{64}", expected_digest) is not None,
                  "preview artifact 服务端摘要无效")
    repository_io._require(archive_path.is_file() and not archive_path.is_symlink(), "preview artifact ZIP 无效")
    repository_io._require(not output.exists() and not output.is_symlink(), "preview artifact 输出已存在")
    repository_io._require(_sha_file(archive_path) == expected_digest.removeprefix("sha256:"),
                  "preview artifact 服务端 SHA256 不符")
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            repository_io._require(1 <= len(infos) <= 4096, "preview artifact 文件数超限")
            names: set[str] = set()
            total = 0
            for info in infos:
                name = info.filename
                parts = name.rstrip("/").split("/")
                repository_io._require(not name.startswith("/") and "\\" not in name
                              and all(part not in {"", ".", ".."} for part in parts)
                              and not re.match(r"^[A-Za-z]:", name),
                              f"preview artifact 路径无效：{name}")
                folded = name.rstrip("/").casefold()
                repository_io._require(folded not in names, f"preview artifact 重复路径：{name}")
                names.add(folded)
                mode = (info.external_attr >> 16) & 0o170000
                repository_io._require(mode in {0, 0o040000 if info.is_dir() else 0o100000},
                              f"preview artifact 禁止链接或特殊条目：{name}")
                if info.is_dir():
                    repository_io._require(name.rstrip("/") in {"preview", "preview/packages"},
                                  f"preview artifact 目录越界：{name}")
                    continue
                repository_io._require(name == "preview-producer.json"
                              or name in {"preview/catalog.json", "preview/preview-plan.json",
                                          "preview/candidate.json"}
                              or (len(parts) == 3 and parts[:2] == ["preview", "packages"]
                                  and name.endswith(".zip")),
                              f"preview artifact 文件越界：{name}")
                total += info.file_size
                repository_io._require(0 <= info.file_size <= 512 * 1024 * 1024
                              and total <= 512 * 1024 * 1024,
                              "preview artifact 展开字节数超限")
            repository_io._require({"preview-producer.json", "preview/catalog.json",
                           "preview/preview-plan.json", "preview/candidate.json"} <= names,
                          "preview artifact 缺少元数据")
            output.mkdir(parents=True)
            for info in infos:
                target = output / info.filename
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as source, target.open("xb") as destination:
                    shutil.copyfileobj(source, destination, 1024 * 1024)
    except zipfile.BadZipFile as exc:
        raise repository_model.RepositoryError("preview artifact ZIP 损坏") from exc


OFFICIAL_REPOSITORY = repository_model.REPOSITORY


PREVIEW_TAG = "plugins-develop"


FULL_SHA = re.compile(r"^[0-9a-f]{40}$")


MAX_CANDIDATE_FILES = 4096


MAX_CANDIDATE_BYTES = 512 * 1024 * 1024


MAX_ZIP_ENTRIES = repository_model.MAX_ZIP_ENTRIES


MAX_ZIP_UNCOMPRESSED_BYTES = repository_model.MAX_ZIP_UNCOMPRESSED_BYTES


def _full_sha(value: Any, label: str) -> str:
    repository_io._require(isinstance(value, str) and FULL_SHA.fullmatch(value) is not None, f"{label} 必须是完整 40 位小写 SHA")
    return value


def _positive_int(value: Any, label: str) -> int:
    repository_io._require(isinstance(value, int) and not isinstance(value, bool) and value > 0, f"{label} 必须是正整数")
    return value


def _parse_positive_int(value: Any, label: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise repository_model.RepositoryError(f"{label} 必须是正整数") from exc
    return _positive_int(parsed, label)


def _safe_relative(value: Any, label: str) -> str:
    repository_io._require(isinstance(value, str), f"{label} 必须是字符串")
    normalized = value.replace("\\", "/")
    parts = normalized.split("/")
    repository_io._require(
        normalized.startswith("packages/")
        and len(parts) > 1
        and all(part not in {"", ".", ".."} for part in parts),
        f"{label} 路径越界：{value}",
    )
    return normalized


def _ordinary_directory(value: Path, label: str) -> Path:
    path = Path(value)
    repository_io._require(path.is_dir() and not path.is_symlink(), f"{label} 必须是普通目录")
    return path.resolve()


def _validate_zip_limits(package: Path) -> None:
    try:
        with zipfile.ZipFile(package) as archive:
            infos = archive.infolist()
            repository_archive._validate_zip_layout(infos, package)
    except zipfile.BadZipFile as exc:
        raise repository_model.RepositoryError(f"候选 ZIP 无效：{package}") from exc


def _preview_inventory(generated_root: Path) -> None:
    generated_root = _ordinary_directory(generated_root, "preview 候选目录")
    files = 0
    total_bytes = 0
    for path in generated_root.rglob("*"):
        relative = path.relative_to(generated_root).as_posix()
        if path.is_symlink():
            raise repository_model.RepositoryError(f"preview 候选目录禁止 symlink：{relative}")
        if path.is_dir():
            continue
        repository_io._require(path.is_file(), f"preview 候选目录包含特殊文件：{relative}")
        repository_io._require(relative in {"catalog.json", "preview-plan.json", "candidate.json"} or (relative.startswith("packages/") and "/" not in relative[len("packages/"):]), f"preview 候选路径不在白名单：{relative}")
        if relative.startswith("packages/"):
            repository_io._require(path.suffix.lower() == ".zip", f"preview packages 只能包含 ZIP：{relative}")
            _validate_zip_limits(path)
        files += 1
        total_bytes += path.stat().st_size
        repository_io._require(files <= MAX_CANDIDATE_FILES, "preview 候选文件数量超过上限")
        repository_io._require(total_bytes <= MAX_CANDIDATE_BYTES, "preview 候选文件总大小超过上限")
    repository_io._require((generated_root / "catalog.json").is_file(), "preview 候选缺少 catalog")
