"""Build and validate a cumulative stable candidate from protected main."""

from __future__ import annotations

import hashlib
import json
import re
import tempfile
import shutil
import zipfile
from pathlib import Path
from typing import Any

import repository_core as core
from candidate_workspace import CandidateWorkspace
from verification import preflight


WORKFLOW_PATH = ".github/workflows/publish-stable.yml"
JOB_NAME = "stable-candidate"
PREVIEW_WORKFLOW_PATH = ".github/workflows/publish-develop.yml"
PREVIEW_JOB_NAME = "preview-build"
FULL_SHA = re.compile(r"[0-9a-f]{40}")


def _builder_fingerprint() -> str:
    repository = Path(__file__).resolve().parents[1]
    paths = [path for path in (repository / "tools").rglob("*")
             if path.is_file() and not path.is_symlink()
             and path.suffix.lower() in {".py", ".mjs", ".js", ".ps1"}
             and "__pycache__" not in path.parts]
    workflow = repository / WORKFLOW_PATH
    if workflow.is_file():
        paths.append(workflow)
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.relative_to(repository).as_posix().encode("utf-8") + b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def package_input_identities(root: Path, plan: dict[str, Any], partner_sha: str) -> dict[str, str]:
    """Identity all inputs that can affect one candidate package's bytes."""
    head = core.git_head(root)
    plugins = {plugin.artifact_name: plugin for plugin in core.discover_source_plugins(root)}
    shared = []
    for relative in ("host.lock.json", "package.json", "package-lock.json"):
        if (root / relative).exists():
            shared.append((relative, core._git(root, ["rev-parse", f"{head}:{relative}"],
                                               f"读取 package input {relative}")))
    result: dict[str, str] = {}
    for artifact in plan.get("requiresPackage", []):
        plugin = plugins.get(artifact)
        core._require(plugin is not None, f"package input 包含未知插件：{artifact}")
        relative = plugin.root.relative_to(root).as_posix()
        identity = {
            "artifact": artifact,
            "version": plugin.version,
            "kind": plugin.kind,
            "sourceTree": core.git_tree(root, head, relative),
            "shared": shared,
            "builderFingerprint": _builder_fingerprint(),
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
    candidate = core.read_json(candidate_root / "candidate.json")
    core._require(isinstance(candidate, dict) and candidate.get("schemaVersion") == 2,
                  "复用候选不含 package input identity；需要重新构建")
    declared_inputs = candidate.get("packageInputs")
    inventory = candidate.get("files")
    core._require(isinstance(declared_inputs, dict) and isinstance(inventory, list),
                  "复用候选 input/inventory 无效")
    inventory_by_path: dict[str, dict[str, Any]] = {}
    for item in inventory:
        core._require(isinstance(item, dict) and isinstance(item.get("path"), str),
                      "复用候选 inventory 条目无效")
        inventory_by_path[item["path"]] = item
    plan = core.read_json(candidate_root / "release-plan.json")
    metadata = plan.get("packageMetadata") if isinstance(plan, dict) else None
    core._require(isinstance(metadata, dict), "复用候选缺少 packageMetadata")
    reusable: dict[str, Path] = {}
    for artifact, input_sha in expected_inputs.items():
        if declared_inputs.get(artifact) != input_sha:
            continue
        item = metadata.get(artifact)
        core._require(isinstance(item, dict) and isinstance(item.get("path"), str),
                      f"复用候选缺少包路径：{artifact}")
        relative = item["path"]
        core._require(relative.startswith(f"packages/{artifact}/") and ".." not in relative.split("/"),
                      f"复用候选包路径无效：{relative}")
        path = candidate_root / relative
        declared = inventory_by_path.get(relative)
        core._require(path.is_file() and not path.is_symlink() and isinstance(declared, dict),
                      f"复用候选包文件无效：{relative}")
        core._require(_sha_file(path) == declared.get("sha256") == item.get("sha256")
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


def _inventory(root: Path, output: Path) -> list[dict[str, Any]]:
    files = core.validate_stable_candidate_layout(root, output)
    expected = set(files) - {"candidate.json"}
    core._require("stable-producer.json" not in expected, "新候选禁止旧资格 producer sidecar")
    core._require(len(expected) <= 4096, "stable candidate 文件数超限")
    total = 0
    inventory = []
    for name in sorted(expected):
        path = files[name]
        size = path.stat().st_size
        total += size
        core._require(total <= 512 * 1024 * 1024, "stable candidate 总字节数超限")
        inventory.append({"path": name, "sha256": _sha_file(path), "sizeBytes": size})
    return inventory


def write_candidate_manifest(
    root: Path,
    output: Path,
    distribution: Path,
    *,
    source_sha: str,
    distribution_sha: str,
    partner_sha: str,
    workflow_sha: str,
    run_id: int,
    run_attempt: int,
) -> dict[str, Any]:
    for value, label in ((source_sha, "source"), (distribution_sha, "distribution"),
                         (partner_sha, "partner"), (workflow_sha, "workflow")):
        core._require(isinstance(value, str) and FULL_SHA.fullmatch(value) is not None,
                      f"{label} SHA 无效")
    core._require(type(run_id) is int and run_id > 0 and type(run_attempt) is int and run_attempt > 0,
                  "candidate run/attempt 无效")
    core._require(core.git_head(root) == source_sha, "candidate source 与 HEAD 不一致")
    core._require(not (output / "candidate.json").exists(), "candidate.json 已存在，拒绝覆盖")
    inventory = _inventory(root, output)
    plan = core.read_json(output / "release-plan.json")
    candidate = {
        "schemaVersion": 2,
        "repository": core.REPOSITORY,
        "channel": "plugins-stable",
        "sourceSha": source_sha,
        "sourceTreeSha": core._git(root, ["rev-parse", f"{source_sha}^{{tree}}"], "读取 source tree"),
        "partnerSha": partner_sha,
        "producer": {"workflowPath": WORKFLOW_PATH, "workflowSha": workflow_sha,
                     "runId": run_id, "runAttempt": run_attempt, "jobName": JOB_NAME},
        "files": inventory,
        "releaseLabel": None,
        "distribution": {"headSha": distribution_sha,
                         "stateSha256": _sha_file(distribution / core.STATE_FILE),
                         "catalogSha256": _sha_file(distribution / "catalog.json")},
        "packageInputs": package_input_identities(root, plan, partner_sha),
    }
    core.write_json(output / "candidate.json", candidate)
    return candidate


def build_stable_candidate(
    root: Path,
    host_root: Path,
    output: Path,
    *,
    sdk_sha: str,
    workflow_sha: str,
    run_id: int,
    run_attempt: int,
    reuse_candidate: Path | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    host_root = host_root.resolve()
    output = output.resolve()
    core._require(not output.exists(), f"candidate 输出已存在，拒绝覆盖：{output}")
    core._require(not core._git(root, ["status", "--porcelain=v1", "--untracked-files=all"], "检查候选工作树"),
                  "candidate 源码工作树不干净")
    workspace = CandidateWorkspace.create(root, "HEAD")
    plan_path = output.parent / f"{output.name}-plan.json"
    try:
        core.validate_candidate_against_base(root, workspace.state_source_sha,
                                             head=workspace.source_sha,
                                             distribution_root=workspace.distribution_root)
        plan = core.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        if not (plan["requiresPackage"] or plan["deleted"] or plan["relocated"]):
            return {"status": "NO_CHANGES", "sourceSha": workspace.source_sha,
                    "distributionSha": workspace.base_sha, "candidate": None}
        sdk = preflight(root, host_root, sdk_sha)
        core.validate_sources(root)
        core.check_syntax(root)
        core.validate_host_locale_registry(root, host_root)
        core._run(("dotnet", "run", "--project", str(host_root / "tools" / "NexusPipeline.TaskProtocolTests"),
                   "--", "--plugin-root", str(root)), "Production task adapters through Host Jint", root)
        inputs = package_input_identities(root, plan, sdk["sdkSourceSha"])
        reuse = reusable_candidate_packages(root, reuse_candidate.resolve(), inputs) if reuse_candidate else {}
        core.write_json(plan_path, plan)
        core.release(root, plan_path, output, host_root=host_root,
                     distribution_root=workspace.distribution_root,
                     reuse_packages=reuse)
        core.validate_generated(root, output, distribution_root=workspace.distribution_root)
        core.verify_unchanged_stable(root, output, workspace.distribution_root)
        candidate = write_candidate_manifest(root, output, workspace.distribution_root,
                                             source_sha=workspace.source_sha,
                                             distribution_sha=workspace.base_sha,
                                             partner_sha=sdk["sdkSourceSha"],
                                             workflow_sha=workflow_sha,
                                             run_id=run_id, run_attempt=run_attempt)
        return {"status": "VALIDATED", "sourceSha": workspace.source_sha,
                "distributionSha": workspace.base_sha, "candidate": str(output),
                "files": len(candidate["files"]), "reusedPackages": sorted(reuse)}
    finally:
        workspace.cleanup()


def stable_candidate_scope(root: Path) -> dict[str, Any]:
    """Cheap, fail-closed main event classification before SDK checkout."""
    root = root.resolve()
    core._require(not core._git(root, ["status", "--porcelain=v1", "--untracked-files=all"], "检查候选工作树"),
                  "candidate 源码工作树不干净")
    workspace = CandidateWorkspace.create(root, "HEAD")
    try:
        core.validate_candidate_against_base(root, workspace.state_source_sha,
                                             head=workspace.source_sha,
                                             distribution_root=workspace.distribution_root)
        plan = core.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        needs_build = bool(plan["requiresPackage"] or plan["deleted"] or plan["relocated"])
        return {"status": "BUILD_REQUIRED" if needs_build else "NO_CHANGES",
                "needsBuild": needs_build, "sourceSha": workspace.source_sha,
                "distributionSha": workspace.base_sha}
    finally:
        workspace.cleanup()


def validate_inventory(root: Path, output: Path, *, expected_source_sha: str,
                       expected_partner_sha: str, expected_producer: dict[str, Any],
                       expected_distribution_sha: str) -> dict[str, Any]:
    core._require(core.git_head(root) == expected_source_sha, "writer source checkout 与 candidate 不一致")
    candidate = core.read_json(output / "candidate.json")
    v1_fields = {"schemaVersion", "repository", "channel", "sourceSha", "sourceTreeSha", "partnerSha",
                 "producer", "files", "releaseLabel", "distribution"}
    core._require(isinstance(candidate, dict) and set(candidate) in (v1_fields, v1_fields | {"packageInputs"}),
                  "candidate 字段集合无效")
    core._require(type(candidate["schemaVersion"]) is int and candidate["schemaVersion"] in {1, 2}
                  and candidate["repository"] == core.REPOSITORY and candidate["channel"] == "plugins-stable"
                  and candidate["releaseLabel"] is None, "candidate 仓库或通道无效")
    core._require((candidate["schemaVersion"] == 1 and "packageInputs" not in candidate)
                  or (candidate["schemaVersion"] == 2 and "packageInputs" in candidate),
                  "candidate schema/packageInputs 不一致")
    core._require(candidate["sourceSha"] == expected_source_sha
                  and candidate["sourceTreeSha"] == core._git(root, ["rev-parse", f"{expected_source_sha}^{{tree}}"], "读取 source tree")
                  and candidate["partnerSha"] == expected_partner_sha,
                  "candidate source/tree/partner 与可信输入不一致")
    core._require(candidate["producer"] == expected_producer, "candidate 原 producer 身份不符")
    if candidate["schemaVersion"] == 2:
        plan = core.read_json(output / "release-plan.json")
        package_inputs = candidate["packageInputs"]
        core._require(isinstance(package_inputs, dict)
                      and set(package_inputs) == set(plan.get("requiresPackage", []))
                      and all(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value)
                              for value in package_inputs.values()),
                      "candidate package input identity 无效")
    distribution = candidate["distribution"]
    core._require(isinstance(distribution, dict) and set(distribution) == {
        "headSha", "stateSha256", "catalogSha256"}
        and distribution["headSha"] == expected_distribution_sha,
        "candidate 分发基线身份不符")
    actual = _inventory(root, output)
    core._require(candidate["files"] == actual, "candidate inventory 文件摘要、大小或集合不符")
    with tempfile.TemporaryDirectory(prefix="nxp-candidate-check-") as temporary:
        distribution_root = Path(temporary)
        CandidateWorkspace._extract_distribution(root, expected_distribution_sha, distribution_root)
        core._require(distribution["stateSha256"] == _sha_file(distribution_root / core.STATE_FILE)
                      and distribution["catalogSha256"] == _sha_file(distribution_root / "catalog.json"),
                      "candidate 分发基线摘要不符")
        core.validate_generated(root, output, distribution_root=distribution_root)
        core.verify_unchanged_stable(root, output, distribution_root)
    return candidate


def inspect_candidate_identity(output: Path, *, workflow_sha: str,
                               run_id: int, run_attempt: int) -> dict[str, str]:
    """Read only the identity needed to checkout a safely extracted candidate source."""
    candidate = core.read_json(output / "candidate.json")
    core._require(isinstance(candidate, dict), "candidate.json 根节点无效")
    source_sha = candidate.get("sourceSha")
    partner_sha = candidate.get("partnerSha")
    core._require(isinstance(source_sha, str) and FULL_SHA.fullmatch(source_sha) is not None,
                  "candidate source SHA 无效")
    core._require(isinstance(partner_sha, str) and FULL_SHA.fullmatch(partner_sha) is not None,
                  "candidate partner SHA 无效")
    core._require(candidate.get("producer") == {
        "workflowPath": WORKFLOW_PATH,
        "workflowSha": workflow_sha,
        "runId": run_id,
        "runAttempt": run_attempt,
        "jobName": JOB_NAME,
    }, "candidate 原 producer 身份不符")
    return {"sourceSha": source_sha, "partnerSha": partner_sha}


def extract_candidate_artifact(archive_path: Path, output: Path, *, expected_digest: str) -> None:
    """Extract a server-identified Actions artifact as data only."""
    core._require(isinstance(expected_digest, str)
                  and re.fullmatch(r"sha256:[0-9a-f]{64}", expected_digest) is not None,
                  "candidate artifact 服务端摘要无效")
    core._require(archive_path.is_file() and not archive_path.is_symlink(), "candidate artifact ZIP 无效")
    core._require(not output.exists() and not output.is_symlink(), "candidate artifact 输出已存在")
    core._require(_sha_file(archive_path) == expected_digest.removeprefix("sha256:"),
                  "candidate artifact 与服务端 SHA256 不符")
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            core._require(1 <= len(infos) <= 4096, "candidate artifact 文件数超限")
            names: set[str] = set()
            total = 0
            for info in infos:
                name = info.filename
                parts = name.rstrip("/").split("/")
                core._require(not name.startswith("/") and "\\" not in name
                              and all(part not in {"", ".", ".."} for part in parts)
                              and not re.match(r"^[A-Za-z]:", name),
                              f"candidate artifact 路径无效：{name}")
                folded = name.rstrip("/").casefold()
                core._require(folded not in names, f"candidate artifact 重复路径：{name}")
                names.add(folded)
                mode = (info.external_attr >> 16) & 0o170000
                core._require(mode in {0, 0o040000 if info.is_dir() else 0o100000}
                              and (info.is_dir() or mode != 0o040000),
                              f"candidate artifact 禁止链接或特殊条目：{name}")
                if info.is_dir():
                    core._require(name.rstrip("/") == "packages"
                                  or (len(parts) == 2 and parts[0] == "packages"),
                                  f"candidate artifact 目录越界：{name}")
                    continue
                core._require(name in {"candidate.json", "catalog.json", core.STATE_FILE,
                                      "release-plan.json"}
                              or (len(parts) == 3 and parts[0] == "packages"
                                  and name.endswith(".zip")),
                              f"candidate artifact 文件越界：{name}")
                total += info.file_size
                core._require(0 <= info.file_size <= 512 * 1024 * 1024
                              and total <= 512 * 1024 * 1024,
                              "candidate artifact 展开字节数超限")
            core._require("candidate.json" in names, "candidate artifact 缺少清单")
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
        raise core.RepositoryError("candidate artifact ZIP 损坏") from exc


def validate_original_candidate(root: Path, output: Path, *, source_sha: str,
                                workflow_sha: str, run_id: int,
                                run_attempt: int) -> dict[str, Any]:
    manifest = core.read_json(output / "candidate.json")
    core._require(isinstance(manifest, dict), "candidate.json 必须是对象")
    partner_sha = manifest.get("partnerSha")
    distribution = manifest.get("distribution")
    core._require(isinstance(partner_sha, str) and FULL_SHA.fullmatch(partner_sha) is not None,
                  "candidate partner SHA 无效")
    core._require(isinstance(distribution, dict), "candidate distribution 无效")
    distribution_sha = distribution.get("headSha")
    core._require(isinstance(distribution_sha, str) and FULL_SHA.fullmatch(distribution_sha) is not None,
                  "candidate distribution SHA 无效")
    core._require(CandidateWorkspace._is_ancestor(root, distribution_sha, source_sha),
                  "candidate 分发快照不是 source 祖先")
    expected_producer = {"workflowPath": WORKFLOW_PATH, "workflowSha": workflow_sha,
                         "runId": run_id, "runAttempt": run_attempt, "jobName": JOB_NAME}
    return validate_inventory(root, output, expected_source_sha=source_sha,
                              expected_partner_sha=partner_sha,
                              expected_producer=expected_producer,
                              expected_distribution_sha=distribution_sha)


def _preview_files(output: Path) -> list[dict[str, Any]]:
    core._require(output.is_dir() and not output.is_symlink(), "preview candidate 目录无效")
    files = []
    total = 0
    folded: set[str] = set()
    for path in output.rglob("*"):
        relative = path.relative_to(output).as_posix()
        core._require(not path.is_symlink(), f"preview candidate 禁止链接：{relative}")
        if path.is_dir():
            core._require(relative == "packages", f"preview candidate 目录越界：{relative}")
            continue
        core._require(path.is_file(), f"preview candidate 特殊文件：{relative}")
        core._require(relative in {"catalog.json", "preview-plan.json", "candidate.json"}
                      or (relative.startswith("packages/") and relative.count("/") == 1
                          and relative.endswith(".zip")),
                      f"preview candidate 文件越界：{relative}")
        key = relative.casefold()
        core._require(key not in folded, f"preview candidate 路径大小写冲突：{relative}")
        folded.add(key)
        if relative == "candidate.json":
            continue
        size = path.stat().st_size
        total += size
        core._require(len(files) < 4096 and total <= 512 * 1024 * 1024,
                      "preview candidate 文件数或大小超限")
        files.append({"path": relative, "sha256": _sha_file(path), "sizeBytes": size})
    core._require({"catalog.json", "preview-plan.json"} <= {item["path"] for item in files},
                  "preview candidate 缺少 catalog/plan")
    return sorted(files, key=lambda item: item["path"])


def write_preview_manifest(root: Path, output: Path, *, partner_sha: str | None,
                           workflow_sha: str, run_id: int, run_attempt: int) -> dict[str, Any]:
    source_sha = core.git_head(root)
    core._require(FULL_SHA.fullmatch(workflow_sha) is not None,
                  "preview workflow SHA 无效")
    core._require(partner_sha is None or FULL_SHA.fullmatch(partner_sha) is not None,
                  "preview partner SHA 无效")
    core._require(type(run_id) is int and run_id > 0 and type(run_attempt) is int and run_attempt > 0,
                  "preview run/attempt 无效")
    core._require(not (output / "candidate.json").exists(), "preview candidate.json 已存在")
    core.validate_preview_candidate(output, expected_source_sha=source_sha)
    candidate = {
        "schemaVersion": 1, "repository": core.REPOSITORY, "channel": "plugins-preview",
        "sourceSha": source_sha,
        "sourceTreeSha": core._git(root, ["rev-parse", f"{source_sha}^{{tree}}"], "读取 preview tree"),
        "partnerSha": partner_sha,
        "producer": {"workflowPath": PREVIEW_WORKFLOW_PATH, "workflowSha": workflow_sha,
                     "runId": run_id, "runAttempt": run_attempt, "jobName": PREVIEW_JOB_NAME},
        "files": _preview_files(output), "releaseLabel": "plugins-develop", "distribution": None,
    }
    core.write_json(output / "candidate.json", candidate)
    return candidate


def validate_preview_manifest(source_root: Path, output: Path, *, source_sha: str,
                              workflow_sha: str, run_id: int, run_attempt: int) -> dict[str, Any]:
    candidate = core.read_json(output / "candidate.json")
    core._require(isinstance(candidate, dict) and set(candidate) == {
        "schemaVersion", "repository", "channel", "sourceSha", "sourceTreeSha", "partnerSha",
        "producer", "files", "releaseLabel", "distribution"}, "preview candidate 字段集合无效")
    core._require(candidate["schemaVersion"] == 1 and candidate["repository"] == core.REPOSITORY
                  and candidate["channel"] == "plugins-preview"
                  and candidate["releaseLabel"] == "plugins-develop" and candidate["distribution"] is None,
                  "preview candidate 仓库或通道无效")
    core._require(core.git_head(source_root) == source_sha
                  and candidate["sourceSha"] == source_sha
                  and candidate["sourceTreeSha"] == core._git(source_root, ["rev-parse", f"{source_sha}^{{tree}}"], "读取 preview tree"),
                  "preview candidate source/tree 不一致")
    core._require(candidate["partnerSha"] is None
                  or (isinstance(candidate["partnerSha"], str)
                      and FULL_SHA.fullmatch(candidate["partnerSha"]) is not None),
                  "preview candidate partner SHA 无效")
    core._require(candidate["producer"] == {
        "workflowPath": PREVIEW_WORKFLOW_PATH, "workflowSha": workflow_sha,
        "runId": run_id, "runAttempt": run_attempt, "jobName": PREVIEW_JOB_NAME},
        "preview candidate 原 producer 身份不符")
    core._require(candidate["files"] == _preview_files(output),
                  "preview candidate inventory 不符")
    core.validate_preview_candidate(output, expected_source_sha=source_sha)
    return candidate


def extract_preview_artifact(archive_path: Path, output: Path, *, expected_digest: str) -> None:
    """Extract only preview candidate data and its separate producer sidecar."""
    core._require(isinstance(expected_digest, str)
                  and re.fullmatch(r"sha256:[0-9a-f]{64}", expected_digest) is not None,
                  "preview artifact 服务端摘要无效")
    core._require(archive_path.is_file() and not archive_path.is_symlink(), "preview artifact ZIP 无效")
    core._require(not output.exists() and not output.is_symlink(), "preview artifact 输出已存在")
    core._require(_sha_file(archive_path) == expected_digest.removeprefix("sha256:"),
                  "preview artifact 服务端 SHA256 不符")
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            core._require(1 <= len(infos) <= 4096, "preview artifact 文件数超限")
            names: set[str] = set()
            total = 0
            for info in infos:
                name = info.filename
                parts = name.rstrip("/").split("/")
                core._require(not name.startswith("/") and "\\" not in name
                              and all(part not in {"", ".", ".."} for part in parts)
                              and not re.match(r"^[A-Za-z]:", name),
                              f"preview artifact 路径无效：{name}")
                folded = name.rstrip("/").casefold()
                core._require(folded not in names, f"preview artifact 重复路径：{name}")
                names.add(folded)
                mode = (info.external_attr >> 16) & 0o170000
                core._require(mode in {0, 0o040000 if info.is_dir() else 0o100000},
                              f"preview artifact 禁止链接或特殊条目：{name}")
                if info.is_dir():
                    core._require(name.rstrip("/") in {"preview", "preview/packages"},
                                  f"preview artifact 目录越界：{name}")
                    continue
                core._require(name == "preview-producer.json"
                              or name in {"preview/catalog.json", "preview/preview-plan.json",
                                          "preview/candidate.json"}
                              or (len(parts) == 3 and parts[:2] == ["preview", "packages"]
                                  and name.endswith(".zip")),
                              f"preview artifact 文件越界：{name}")
                total += info.file_size
                core._require(0 <= info.file_size <= 512 * 1024 * 1024
                              and total <= 512 * 1024 * 1024,
                              "preview artifact 展开字节数超限")
            core._require({"preview-producer.json", "preview/catalog.json",
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
        raise core.RepositoryError("preview artifact ZIP 损坏") from exc


def inspect_preview_candidate(output: Path, producer_path: Path, *, workflow_sha: str,
                              run_id: int, run_attempt: int) -> str:
    """Read the payload source from data after binding it to the original job."""
    candidate = core.read_json(output / "candidate.json")
    producer = core.read_json(producer_path)
    core._require(isinstance(candidate, dict) and isinstance(producer, dict),
                  "preview candidate/producer 必须是对象")
    source_sha = candidate.get("sourceSha")
    core._require(isinstance(source_sha, str) and FULL_SHA.fullmatch(source_sha) is not None,
                  "preview source SHA 无效")
    core._require(candidate.get("producer") == {
        "workflowPath": PREVIEW_WORKFLOW_PATH, "workflowSha": workflow_sha,
        "runId": run_id, "runAttempt": run_attempt, "jobName": PREVIEW_JOB_NAME},
        "preview candidate 原 producer 身份不符")
    core._require(producer == {"schemaVersion": 1, "sourceSha": source_sha,
                              "runId": run_id, "runAttempt": run_attempt,
                              "workflowSha": workflow_sha},
                  "preview producer sidecar 身份不符")
    core._require(candidate.get("files") == _preview_files(output),
                  "preview candidate inventory 不符")
    core.validate_preview_candidate(output, expected_source_sha=source_sha)
    return source_sha
