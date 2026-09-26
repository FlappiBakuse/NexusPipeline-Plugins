"""Locked inputs for the existing managed verification runner's Maa native cases."""
from __future__ import annotations

import hashlib
import json
import os
import stat
import tempfile
import urllib.request
import zipfile
from pathlib import Path


def validate_members(archive: zipfile.ZipFile, require_bin: bool = True) -> list[zipfile.ZipInfo]:
    entries = archive.infolist()
    if len(entries) > 20000 or sum(item.file_size for item in entries) > 1024 * 1024 * 1024:
        raise ValueError("Maa native archive exceeds limits")
    names: set[str] = set()
    selected = []
    for item in entries:
        name = item.filename.replace("\\", "/")
        parts = name.rstrip("/").split("/")
        reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
        if (not name or name.startswith("/") or ":" in name
            or any(not part or part in {"..", "."} or part.endswith((" ", "."))
                   or part.split(".")[0].upper() in reserved for part in parts)):
            raise ValueError("Maa native archive unsafe path")
        if stat.S_ISLNK(item.external_attr >> 16) or name.rstrip("/").casefold() in names:
            raise ValueError("Maa native archive link or duplicate")
        names.add(name.rstrip("/").casefold())
        if not item.is_dir() and name.startswith("bin/"):
            selected.append(item)
    if require_bin and not selected:
        raise ValueError("Maa native archive has no bin assets")
    return selected


def reject_links(path: Path) -> None:
    """Refuse existing junctions/symlinks before writing or trusting a cache."""
    for current in (path, *path.parents):
        if current.exists() and (current.is_symlink()
            or getattr(current.stat(follow_symlinks=False), "st_file_attributes", 0) & 0x400):
            raise ValueError("Maa native input/cache contains a reparse point")


def _hash(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare_native_tests(plugin: Path, repository: Path, host: Path, run) -> dict[str, str]:
    lock = json.loads((plugin / "native-tests.lock.json").read_text(encoding="utf-8"))
    if (lock.get("schemaVersion") != 1 or lock.get("version") != "v5.14.0"
        or lock.get("url") != "https://github.com/MaaXYZ/MaaFramework/releases/download/v5.14.0/MAA-win-x86_64-v5.14.0.zip"
        or not isinstance(lock.get("sha256"), str) or len(lock["sha256"]) != 64):
        raise ValueError("Maa native test lock is invalid")
    cache = repository / ".generated" / "maa-native-tests"
    reject_links(cache)
    cache.mkdir(parents=True, exist_ok=True)
    supplied = os.environ.get("NEXUS_MAA_NATIVE_ARCHIVE")
    archive = Path(supplied).absolute() if supplied else cache / (lock["sha256"] + ".zip")
    reject_links(archive)
    if not archive.exists():
        if supplied:
            raise ValueError("Explicit Maa native archive missing")
        with tempfile.NamedTemporaryFile(dir=cache, prefix="download-", delete=False) as temporary:
            temporary_path = Path(temporary.name)
            with urllib.request.urlopen(lock["url"], timeout=60) as response:
                size = 0
                while block := response.read(1024 * 1024):
                    size += len(block)
                    if size > lock["sizeBytes"]:
                        raise ValueError("Maa native download exceeds locked size")
                    temporary.write(block)
        if _hash(temporary_path) != lock["sha256"]:
            raise ValueError("Maa native download hash mismatch; evidence retained")
        temporary_path.replace(archive)
    if archive.is_symlink() or archive.stat().st_size != lock["sizeBytes"] or _hash(archive) != lock["sha256"]:
        raise ValueError("Maa native archive size/hash mismatch")
    # Never execute an unverified extracted cache; each verification owns a fresh
    # directory extracted directly from the hash-verified upstream archive.
    native = Path(tempfile.mkdtemp(prefix="native-", dir=cache))
    (native / ".nxp-native-owned").write_text(lock["sha256"], encoding="ascii")
    inventory = []
    with zipfile.ZipFile(archive) as source:
        for item in validate_members(source):
            name = item.filename.replace("\\", "/")
            target = native / name.removeprefix("bin/")
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(item) as reader, target.open("xb") as writer:
                while block := reader.read(1024 * 1024):
                    writer.write(block)
            digest = _hash(target)
            if name in lock["members"] and digest != lock["members"][name]:
                raise ValueError("Maa native member hash mismatch")
            inventory.append({"path": name, "sha256": digest, "bytes": item.file_size})
    if not all((native / Path(name).name).is_file() for name in ("MaaFramework.dll", "MaaToolkit.dll", "MaaAgentClient.dll")):
        raise ValueError("Maa native required ABI libraries missing")
    worker = Path(tempfile.mkdtemp(prefix="worker-", dir=cache))
    run(("dotnet", "publish", str(plugin / "worker" / "NexusPipeline.MaaWorker.csproj"),
         "--configuration", "Release", "--nologo", "--output", str(worker),
         "-p:RestoreLockedMode=true", f"-p:NexusHostRoot={host}"),
        "准备 Maa 真实原生测试 worker", repository)
    report = repository / ".generated" / "test-results" / "maa-native"
    report.mkdir(parents=True, exist_ok=True)
    (report / ("inputs-" + native.name + ".json")).write_text(json.dumps({
        "archiveSha256": lock["sha256"], "version": lock["version"], "source": lock["url"],
        "nativeRoot": str(native), "workerRoot": str(worker), "files": inventory,
        "workerFiles": [{"path": str(path.relative_to(worker)), "sha256": _hash(path)}
                        for path in sorted(worker.rglob("*")) if path.is_file()]
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    environment = dict(os.environ)
    environment.update(NEXUS_MAA_NATIVE_ROOT=str(native), NEXUS_MAA_WORKER_ROOT=str(worker),
                       NEXUS_MAA_REPORT_ROOT=str(report))
    environment["NEXUS_MAA_OFFICIAL_PROJECTS"] = str(prepare_official_projects(plugin, cache, report))
    return environment


def prepare_official_projects(plugin: Path, cache: Path, report: Path) -> Path:
    """Read-only qualification inputs, never execute the upstream GUI/Agent."""
    lock = json.loads((plugin / "official-projects.lock.json").read_text(encoding="utf-8"))
    if lock.get("schemaVersion") != 1 or len(lock.get("projects", [])) != 2:
        raise ValueError("Maa official project lock invalid")
    output = Path(tempfile.mkdtemp(prefix="projects-", dir=cache))
    (output / ".nxp-project-test-owned").write_text("locked-read-only-project-fixtures", encoding="ascii")
    supplied = os.environ.get("NEXUS_MAA_PROJECT_ARCHIVES")
    inputs = []
    for project in lock["projects"]:
        name, version = project["name"], project["version"]
        if name not in {"MaaEnd", "MaaStellaSora"} or project["url"] != (
            f"https://github.com/{name}/{name}/releases/download/{version}/{project['asset']}"
        ):
            raise ValueError("Maa official project source invalid")
        archive = Path(supplied) / project["asset"] if supplied else cache / project["asset"]
        reject_links(archive)
        if not archive.exists():
            if supplied:
                raise ValueError("Explicit official project archive missing")
            with tempfile.NamedTemporaryFile(dir=cache, prefix="project-download-", delete=False) as temporary:
                temporary_path = Path(temporary.name)
                with urllib.request.urlopen(project["url"], timeout=60) as response:
                    size = 0
                    while block := response.read(1024 * 1024):
                        size += len(block)
                        if size > project["sizeBytes"]:
                            raise ValueError("Official project download exceeds lock")
                        temporary.write(block)
            if _hash(temporary_path) != project["sha256"]:
                raise ValueError("Official project hash mismatch; retained for diagnosis")
            temporary_path.replace(archive)
        if archive.stat().st_size != project["sizeBytes"] or _hash(archive) != project["sha256"]:
            raise ValueError("Official project archive size/hash mismatch")
        root = output / name
        root.mkdir()
        with zipfile.ZipFile(archive) as source:
            validate_members(source, require_bin=False)
            for item in source.infolist():
                target = root / item.filename.replace("\\", "/")
                if os.name == "nt":
                    # Official image names can exceed legacy MAX_PATH once
                    # placed below a verification checkout. Scope was validated above.
                    target = Path("\\\\?\\" + str(target.absolute()))
                if item.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with source.open(item) as reader, target.open("xb") as writer:
                        while block := reader.read(1024 * 1024):
                            writer.write(block)
        if _hash(root / project["nativeDirectory"] / "MaaFramework.dll") != project["nativeSha256"]:
            raise ValueError("Official project native member mismatch")
        inputs.append({**project, "root": str(root)})
    (output / "inputs.json").write_text(json.dumps(inputs, indent=2), encoding="utf-8")
    (report / (output.name + "-inputs.json")).write_text(json.dumps(inputs, indent=2), encoding="utf-8")
    return output
