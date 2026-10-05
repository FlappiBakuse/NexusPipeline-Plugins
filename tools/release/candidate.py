from __future__ import annotations
from pathlib import Path
import tools.release.preview as release_preview
import tools.repository.catalog as repository_catalog
import tools.repository.git as repository_git
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.plan as repository_plan
import tools.repository.source as repository_source
import re
import tempfile
import shutil
from typing import Any
from tools.release.workspace import CandidateWorkspace
from tools.sdk.source import preflight
import tools.release.inventory as release_inventory

import copy
import datetime as dt

import tests.support.managed_build as support_managed_build
import tools.repository.archive as repository_archive
import tools.repository.package as repository_package
import tools.repository.state as repository_state

def _prepare_output(root: Path, output: Path) -> None:
    root = root.resolve()
    output = output.resolve()
    repository_io._require(output != root and output != root.parent, "生成输出目录不能覆盖仓库根目录或其父目录")
    if root in output.parents:
        relative = output.relative_to(root)
        repository_io._require(relative.parts and relative.parts[0] == ".generated", "仓库内生成输出只能位于 .generated 目录")
    repository_io._require(not output.exists() and not output.is_symlink(), f"候选输出已存在，拒绝覆盖：{output}")
    output.mkdir(parents=True)


def _state_entry(plugin: repository_model.SourcePlugin, catalog_entry_value: dict[str, Any], source_tree: str) -> dict[str, Any]:
    return {
        "name": plugin.name,
        "artifactName": plugin.artifact_name,
        "version": plugin.version,
        "sha256": catalog_entry_value["sha256"],
        "sizeBytes": catalog_entry_value["sizeBytes"],
        "sourceTree": source_tree,
    }


def release(
    root: Path,
    plan_path: Path,
    output: Path,
    *,
    host_root: Path | None = None,
    distribution_root: Path | None = None,
    reuse_packages: dict[str, Path] | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    distribution_root = (distribution_root or root).resolve()
    plan = repository_io.read_json(plan_path.resolve())
    repository_io._require(isinstance(plan, dict) and plan.get("schemaVersion") == 1, "release plan 无效")
    head = repository_git.git_head(root)
    repository_io._require(plan.get("head") == head, f"release plan 与当前 HEAD 不一致：{plan.get('head')} / {head}")
    plugins = repository_source.discover_source_plugins(root)
    by_artifact = {plugin.artifact_name: plugin for plugin in plugins}
    old_catalog = repository_io.read_json(distribution_root / "catalog.json")
    old_entries = repository_catalog._catalog_entry_by_artifact(old_catalog)
    state = repository_state.load_state(distribution_root)
    repository_io._require("relocated" not in plan, "不支持旧 release plan 格式")
    require = set(plan.get("requiresPackage", []))
    deleted = set(plan.get("deleted", []))
    repository_io._require(require <= set(by_artifact), "release plan 包含未知插件：" + ", ".join(sorted(require - set(by_artifact))))
    _prepare_output(root, output)
    owned_build_paths = support_managed_build.capture_managed_build_artifacts(root, host_root)
    generated_packages = output / "packages"
    generated_packages.mkdir()
    generated_entries: dict[str, dict[str, Any]] = {}
    generated_metadata: dict[str, repository_model.PackageMetadata] = {}
    reuse_packages = reuse_packages or {}
    repository_io._require(set(reuse_packages) <= require, "复用包集合超出 release plan")
    for artifact in sorted(require):
        plugin = by_artifact[artifact]
        package = generated_packages / artifact / f"{artifact}-{plugin.version}.zip"
        reusable = reuse_packages.get(artifact)
        if reusable is not None:
            repository_io._require(reusable.is_file() and not reusable.is_symlink(), f"复用包不是普通文件：{artifact}")
            package.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(reusable, package)
            print(f"[repository] 复用已验证候选包：{artifact} v{plugin.version}", flush=True)
        else:
            repository_package.build_plugin_package(plugin, package, root, host_root=host_root)
        existing = distribution_root / "packages" / artifact / package.name
        if existing.is_file():
            repository_io._require(repository_io._same_package_bytes(existing, package), f"同一 SemVer 的发行包已存在且内容不同，拒绝覆盖：{repository_io._display(existing)}")
        metadata = repository_io.package_metadata(package)
        generated_metadata[artifact] = metadata
        generated_entries[artifact] = repository_catalog.catalog_entry(plugin, package, metadata)
        print(f"[repository] 增量包：{artifact} v{plugin.version}，SHA 仅计算 1 次", flush=True)

    final_entries: list[dict[str, Any]] = []
    for plugin in plugins:
        artifact = plugin.artifact_name
        if artifact in generated_entries:
            final_entries.append(generated_entries[artifact])
        elif artifact in old_entries:
            final_entries.append(copy.deepcopy(old_entries[artifact]))
        else:
            raise repository_model.RepositoryError(f"插件缺少发行 entry，且计划没有生成包：{artifact}")
    final_entries = repository_catalog._catalog_order(final_entries)
    catalog_changed = bool(require or deleted)
    timestamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    catalog = {
        "schemaVersion": 2,
        "repository": repository_model.REPOSITORY,
        "generatedAt": timestamp if catalog_changed else old_catalog.get("generatedAt", timestamp),
        "plugins": final_entries,
    }
    repository_catalog._validate_catalog_shape(root, catalog, plugins, False)
    repository_io.write_json(output / "catalog.json", catalog)

    released = copy.deepcopy(state.get("released", {}))
    repository_io._require(isinstance(released, dict), f"{repository_model.STATE_FILE}.released 必须是对象")
    for artifact in deleted:
        released.pop(artifact, None)
    for plugin in plugins:
        artifact = plugin.artifact_name
        if artifact in generated_entries:
            plugin_root = repository_io._display(plugin.root.relative_to(root))
            released[artifact] = _state_entry(plugin, generated_entries[artifact], repository_git.git_tree(root, head, plugin_root))
        elif artifact not in released:
            entry = repository_catalog._catalog_entry_by_artifact(catalog)[artifact]
            released[artifact] = _state_entry(plugin, entry, repository_git.git_tree(root, head, repository_io._display(plugin.root.relative_to(root))))
    new_state = {"schemaVersion": repository_model.STATE_SCHEMA_VERSION, "sourceCommit": head, "released": {key: released[key] for key in sorted(released)}}
    plan["packageMetadata"] = {
        artifact: {
            "path": repository_io._display(metadata.path.relative_to(output)),
            "sha256": metadata.sha256,
            "sizeBytes": metadata.size_bytes,
        }
        for artifact, metadata in sorted(generated_metadata.items())
    }
    repository_io.write_json(output / repository_model.STATE_FILE, new_state)
    repository_io.write_json(output / "release-plan.json", plan)
    validate_generated(root, output, distribution_root=distribution_root)
    support_managed_build.cleanup_managed_build_artifacts(owned_build_paths)
    print(f"[repository] 增量发行候选物完成：{len(require)} 个包，删除 {len(deleted)} 个插件 entry", flush=True)
    return {"catalog": catalog, "state": new_state, "plan": plan}


def _expected_stable_package_paths(root: Path, generated_root: Path) -> set[str]:
    plan = repository_io.read_json(generated_root / "release-plan.json")
    repository_io._require(isinstance(plan, dict), "release plan 必须是对象")
    requires_value = plan.get("requiresPackage", [])
    repository_io._require(isinstance(requires_value, list), "release plan requiresPackage 必须是数组")
    requires = [str(value) for value in requires_value]
    repository_io._require(len(requires) == len(set(requires)), "release plan requiresPackage 不得重复")
    plugins = {plugin.artifact_name: plugin for plugin in repository_source.discover_source_plugins(root)}
    repository_io._require(set(requires) <= set(plugins), "release plan 包含未知插件：" + ", ".join(sorted(set(requires) - set(plugins))))
    return {
        f"packages/{artifact}/{artifact}-{plugins[artifact].version}.zip"
        for artifact in requires
    }


def verify_unchanged_stable(root: Path, candidate: Path, distribution_root: Path) -> None:
    """Keep existing stable entries and packages byte-for-byte unchanged."""
    old_catalog = repository_io.read_json(distribution_root / "catalog.json")
    candidate_catalog = repository_io.read_json(candidate / "catalog.json")
    old_entries = repository_catalog._catalog_entry_by_artifact(old_catalog)
    new_entries = repository_catalog._catalog_entry_by_artifact(candidate_catalog)
    plan = repository_io.read_json(candidate / "release-plan.json")
    changed = set(plan.get("requiresPackage", [])) | set(plan.get("deleted", []))
    for artifact, entry in old_entries.items():
        if artifact in changed:
            continue
        repository_io._require(new_entries.get(artifact) == entry,
                 f"未变更 stable catalog entry 被修改：{artifact}")
        package = distribution_root / "packages" / artifact / f"{artifact}-{entry['version']}.zip"
        repository_io._require(package.is_file(), f"现有 stable 包缺失：{artifact}")
        repository_io._require(repository_io.sha256(package) == entry.get("sha256")
                 and package.stat().st_size == entry.get("sizeBytes"),
                 f"现有 stable 包与 catalog 发行事实不一致：{artifact}")


def validate_stable_candidate_layout(root: Path, generated_root: Path) -> dict[str, Path]:
    """Validate the complete stable candidate tree and return its payload files."""

    generated_root = generated_root.resolve()
    repository_io._require(generated_root.is_dir() and not generated_root.is_symlink(), "stable 候选目录必须是普通目录")
    expected_packages = _expected_stable_package_paths(root, generated_root)
    required_files = {"catalog.json", repository_model.STATE_FILE, "release-plan.json"}
    optional_files = {"candidate.json"}
    allowed_files = required_files | optional_files | expected_packages
    allowed_directories = {"packages"}
    for relative in expected_packages:
        parts = relative.split("/")[:-1]
        allowed_directories.update("/".join(parts[:index]) for index in range(1, len(parts) + 1))

    files: dict[str, Path] = {}
    names_by_folded: dict[str, str] = {}
    for path in generated_root.rglob("*"):
        relative = path.relative_to(generated_root).as_posix()
        folded = relative.casefold()
        repository_io._require(folded not in names_by_folded, f"候选路径重复或大小写冲突：{relative}")
        names_by_folded[folded] = relative
        repository_io._require(not path.is_symlink(), f"稳定候选不得包含 symlink：{relative}")
        if path.is_dir():
            repository_io._require(relative in allowed_directories, f"稳定候选目录不在白名单：{relative}")
            continue
        repository_io._require(path.is_file(), f"稳定候选包含特殊文件：{relative}")
        repository_io._require(relative in allowed_files, f"稳定候选文件不在白名单：{relative}")
        files[relative] = path

    repository_io._require(required_files <= set(files), "稳定候选缺少 catalog/state/release-plan")
    repository_io._require(
        {relative for relative in files if relative.startswith("packages/")} == expected_packages,
        "稳定候选 packages 文件集合必须与 requiresPackage 精确一致",
    )
    return files


def validate_generated(root: Path, generated_root: Path, *, distribution_root: Path | None = None) -> None:
    generated_root = generated_root.resolve()
    distribution_root = (distribution_root or root).resolve()
    plan = repository_io.read_json(generated_root / "release-plan.json")
    catalog = repository_io.read_json(generated_root / "catalog.json")
    state = repository_io.read_json(generated_root / repository_model.STATE_FILE)
    plugins = repository_source.discover_source_plugins(root)
    repository_io._require(repository_git.git_head(root) == plan.get("head"), "生成候选 source HEAD 与 release plan 不一致")
    baseline = str(plan.get("base", ""))
    distribution_state = repository_state.load_state(distribution_root)
    # Published facts can postdate their source cursor. Replaying that cursor
    # must use the frozen distribution state, not its older state at the source commit.
    if baseline == distribution_state.get("sourceCommit"):
        baseline = "auto"
    expected_plan = repository_plan.build_plan(root, baseline=baseline, head=str(plan.get("head", "")), distribution_root=distribution_root)
    for key in (
        "base",
        "head",
        "mode",
        "changed",
        "deleted",
        "managed",
        "requiresPackage",
        "reasons",
        "globalChanges",
        "removePackages",
        "removeArtifacts",
    ):
        repository_io._require(plan.get(key) == expected_plan.get(key), f"release plan {key} 与可信源码/分发基线推导不一致")
    repository_catalog._validate_catalog_shape(root, catalog, plugins, False)
    old_catalog = repository_io.read_json(distribution_root / "catalog.json")
    old_entries = repository_catalog._catalog_entry_by_artifact(old_catalog)
    repository_io._require("relocated" not in plan, "不支持旧 release plan 格式")
    requires = set(plan.get("requiresPackage", []))
    deleted = set(plan.get("deleted", []))
    package_metadata_by_artifact = plan.get("packageMetadata", {})
    repository_io._require(isinstance(package_metadata_by_artifact, dict), "release plan packageMetadata 必须是对象")
    repository_io._require(set(package_metadata_by_artifact) == requires, "release plan packageMetadata 与 requiresPackage 不一致")
    generated_files = validate_stable_candidate_layout(root, generated_root)
    generated_packages_root = generated_root / "packages"
    by_artifact = {plugin.artifact_name: plugin for plugin in plugins}
    generated_entries = repository_catalog._catalog_entry_by_artifact(catalog)
    for artifact in requires:
        repository_io._require(artifact in by_artifact, f"生成物包含未知变更插件：{artifact}")
        package = generated_packages_root / artifact / f"{artifact}-{by_artifact[artifact].version}.zip"
        repository_io._require(package.is_file(), f"生成物缺少变更插件包：{repository_io._display(package)}")
        metadata = package_metadata_by_artifact[artifact]
        repository_io._require(isinstance(metadata, dict), f"生成物 packageMetadata 无效：{artifact}")
        repository_io._require(metadata.get("path") == repository_io._display(package.relative_to(generated_root)), f"生成物 packageMetadata 路径不一致：{artifact}")
        repository_io._require(metadata.get("sha256") == generated_entries[artifact]["sha256"], f"生成物 SHA256 metadata 不一致：{repository_io._display(package)}")
        repository_io._require(metadata.get("sizeBytes") == generated_entries[artifact]["sizeBytes"], f"生成物 sizeBytes metadata 不一致：{repository_io._display(package)}")
        repository_io._require(package.stat().st_size == metadata.get("sizeBytes"), f"生成物 sizeBytes 不一致：{repository_io._display(package)}")
        actual_sha = repository_io.sha256(package)
        repository_io._require(actual_sha == metadata.get("sha256") == generated_entries[artifact]["sha256"], f"生成物 ZIP SHA256 与 catalog 不一致：{repository_io._display(package)}")
        repository_archive._validate_zip(package, by_artifact[artifact])
        existing = distribution_root / "packages" / artifact / package.name
        if existing.exists() or existing.is_symlink():
            repository_io._require(existing.is_file() and not existing.is_symlink(), f"stable 已存在包不是普通文件：{repository_io._display(existing)}")
            repository_io._require(repository_io._same_package_bytes(existing, package), f"同一 SemVer 的发行包已存在且内容不同，拒绝覆盖：{repository_io._display(existing)}")
    for artifact, entry in old_entries.items():
        if artifact not in requires and artifact not in deleted:
            repository_io._require(generated_entries.get(artifact) == entry, f"未变更 catalog entry 被修改：{artifact}")
            package = distribution_root / "packages" / artifact / f"{artifact}-{entry.get('version')}.zip"
            repository_io._require(package.is_file(), f"未变更 stable 包缺失：{repository_io._display(package)}")
            repository_io._require(package.stat().st_size == entry.get("sizeBytes"), f"未变更 stable 包大小与 catalog 不一致：{artifact}")
            repository_io._require(repository_io.sha256(package) == entry.get("sha256"), f"未变更 stable 包 SHA256 与 catalog 不一致：{artifact}")
    repository_io._require(not (set(old_entries) & deleted & set(generated_entries)), "删除插件仍存在于 catalog")
    repository_io._require(state.get("sourceCommit") == plan.get("head"), "生成 state sourceCommit 不一致")
    state_entries = state.get("released", {})
    repository_io._require(isinstance(state_entries, dict), "生成 state.released 必须是对象")
    repository_io._require(set(state_entries) == set(generated_entries), "生成 state 与 catalog 插件集合不一致")
    for artifact, entry in generated_entries.items():
        state_entry = state_entries[artifact]
        repository_io._require(
            state_entry.get("artifactName") == artifact
            and state_entry.get("version") == entry.get("version")
            and state_entry.get("sha256") == entry.get("sha256")
            and state_entry.get("sizeBytes") == entry.get("sizeBytes"),
            f"生成 state 与 catalog 发行事实不一致：{artifact}",
        )


JOB_NAME = "Plugins / 候选校验"


PREVIEW_JOB_NAME = "Plugins / 预览构建"


FULL_SHA = re.compile(r"[0-9a-f]{40}")


def _inventory(root: Path, output: Path) -> list[dict[str, Any]]:
    files = validate_stable_candidate_layout(root, output)
    expected = set(files) - {"candidate.json"}
    repository_io._require("stable-producer.json" not in expected, "新候选禁止旧资格 producer sidecar")
    repository_io._require(len(expected) <= 4096, "stable candidate 文件数超限")
    total = 0
    inventory = []
    for name in sorted(expected):
        path = files[name]
        size = path.stat().st_size
        total += size
        repository_io._require(total <= 512 * 1024 * 1024, "stable candidate 总字节数超限")
        inventory.append({"path": name, "sha256": release_inventory._sha_file(path), "sizeBytes": size})
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
        repository_io._require(isinstance(value, str) and FULL_SHA.fullmatch(value) is not None,
                      f"{label} SHA 无效")
    repository_io._require(type(run_id) is int and run_id > 0 and type(run_attempt) is int and run_attempt > 0,
                  "candidate run/attempt 无效")
    repository_io._require(repository_git.git_head(root) == source_sha, "candidate source 与 HEAD 不一致")
    repository_io._require(not (output / "candidate.json").exists(), "candidate.json 已存在，拒绝覆盖")
    inventory = _inventory(root, output)
    plan = repository_io.read_json(output / "release-plan.json")
    candidate = {
        "schemaVersion": 2,
        "repository": repository_model.REPOSITORY,
        "channel": "plugins-stable",
        "sourceSha": source_sha,
        "sourceTreeSha": repository_git._git(root, ["rev-parse", f"{source_sha}^{{tree}}"], "读取 source tree"),
        "partnerSha": partner_sha,
        "producer": {"workflowPath": release_inventory.WORKFLOW_PATH, "workflowSha": workflow_sha,
                     "runId": run_id, "runAttempt": run_attempt, "jobName": JOB_NAME},
        "files": inventory,
        "releaseLabel": None,
        "distribution": {"headSha": distribution_sha,
                         "stateSha256": release_inventory._sha_file(distribution / repository_model.STATE_FILE),
                         "catalogSha256": release_inventory._sha_file(distribution / "catalog.json")},
        "packageInputs": release_inventory.package_input_identities(root, plan, partner_sha),
    }
    repository_io.write_json(output / "candidate.json", candidate)
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
    repository_io._require(not output.exists(), f"candidate 输出已存在，拒绝覆盖：{output}")
    repository_io._require(not repository_git._git(root, ["status", "--porcelain=v1", "--untracked-files=all"], "检查候选工作树"),
                  "candidate 源码工作树不干净")
    workspace = CandidateWorkspace.create(root, "HEAD")
    plan_path = output.parent / f"{output.name}-plan.json"
    try:
        repository_plan.validate_candidate_against_base(root, workspace.state_source_sha,
                                             head=workspace.source_sha,
                                             distribution_root=workspace.distribution_root)
        plan = repository_plan.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        if not (plan["requiresPackage"] or plan["deleted"]):
            return {"status": "NO_CHANGES", "sourceSha": workspace.source_sha,
                    "distributionSha": workspace.base_sha, "candidate": None}
        sdk = preflight(root, host_root, sdk_sha)
        repository_source.validate_sources(root)
        repository_source.check_syntax(root)
        repository_source.validate_host_locale_registry(root, host_root)
        inputs = release_inventory.package_input_identities(root, plan, sdk["sdkSourceSha"])
        reuse = release_inventory.reusable_candidate_packages(root, reuse_candidate.resolve(), inputs) if reuse_candidate else {}
        repository_io.write_json(plan_path, plan)
        release(root, plan_path, output, host_root=host_root,
                     distribution_root=workspace.distribution_root,
                     reuse_packages=reuse)
        validate_generated(root, output, distribution_root=workspace.distribution_root)
        verify_unchanged_stable(root, output, workspace.distribution_root)
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
    repository_io._require(not repository_git._git(root, ["status", "--porcelain=v1", "--untracked-files=all"], "检查候选工作树"),
                  "candidate 源码工作树不干净")
    workspace = CandidateWorkspace.create(root, "HEAD")
    try:
        repository_plan.validate_candidate_against_base(root, workspace.state_source_sha,
                                             head=workspace.source_sha,
                                             distribution_root=workspace.distribution_root)
        plan = repository_plan.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        needs_build = bool(plan["requiresPackage"] or plan["deleted"])
        return {"status": "BUILD_REQUIRED" if needs_build else "NO_CHANGES",
                "needsBuild": needs_build, "sourceSha": workspace.source_sha,
                "distributionSha": workspace.base_sha}
    finally:
        workspace.cleanup()


def plan_stable_candidate(root: Path, host_root: Path, output: Path, *, sdk_sha: str) -> dict[str, Any]:
    root, host_root, output = root.resolve(), host_root.resolve(), output.resolve()
    repository_io._require(not output.exists(), "候选计划输出已存在")
    repository_io._require(not repository_git._git(root, ["status", "--porcelain=v1", "--untracked-files=all"],
                                "检查候选工作树"), "候选源码工作树不干净")
    workspace = CandidateWorkspace.create(root, "HEAD")
    try:
        repository_plan.validate_candidate_against_base(root, workspace.state_source_sha,
                                             head=workspace.source_sha,
                                             distribution_root=workspace.distribution_root)
        plan = repository_plan.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        needs_build = bool(plan["requiresPackage"] or plan["deleted"])
        if needs_build:
            sdk = preflight(root, host_root, sdk_sha)
            repository_source.validate_sources(root)
            repository_source.check_syntax(root)
            repository_source.validate_host_locale_registry(root, host_root)
            partner_sha = sdk["sdkSourceSha"]
        else:
            partner_sha = sdk_sha
        result = {"schemaVersion": 1, "sourceSha": workspace.source_sha,
                  "sourceTreeSha": repository_git._git(root, ["rev-parse", f"{workspace.source_sha}^{{tree}}"],
                                             "读取 source tree"),
                  "distributionSha": workspace.base_sha, "partnerSha": partner_sha,
                  "plan": plan, "packageInputs": release_inventory.package_input_identities(root, plan, partner_sha)}
        output.parent.mkdir(parents=True, exist_ok=True)
        repository_io.write_json(output, result)
        return result
    finally:
        workspace.cleanup()


def assemble_stable_candidate(root: Path, host_root: Path, plan_phase: Path,
                              package_phases: Path, output: Path, *, sdk_sha: str,
                              workflow_sha: str, run_id: int, run_attempt: int) -> dict[str, Any]:
    root, host_root, output = root.resolve(), host_root.resolve(), output.resolve()
    phase = repository_io.read_json(plan_phase.resolve())
    repository_io._require(isinstance(phase, dict) and set(phase) == {
        "schemaVersion", "sourceSha", "sourceTreeSha", "distributionSha", "partnerSha",
        "plan", "packageInputs"} and phase["schemaVersion"] == 1,
        "候选计划阶段清单无效")
    repository_io._require(not output.exists() and repository_git.git_head(root) == phase["sourceSha"]
                  and not repository_git._git(root, ["status", "--porcelain=v1", "--untracked-files=all"],
                                    "检查候选工作树"), "候选装配源码不干净或身份不符")
    workspace = CandidateWorkspace.create(root, "HEAD")
    try:
        plan = repository_plan.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        repository_io._require(phase["plan"] == plan and phase["distributionSha"] == workspace.base_sha
                      and phase["sourceTreeSha"] == repository_git._git(
                          root, ["rev-parse", f"{workspace.source_sha}^{{tree}}"], "读取 source tree")
                      and phase["partnerSha"] == sdk_sha, "候选计划阶段输入已变化")
        sdk = preflight(root, host_root, sdk_sha)
        repository_io._require(phase["partnerSha"] == sdk["sdkSourceSha"]
                      and phase["packageInputs"] == release_inventory.package_input_identities(
                          root, plan, sdk_sha), "候选 package input identity 不符")
        required = set(plan["requiresPackage"])
        repository_io._require(required or plan["deleted"], "无增量发行内容")
        package_phases = package_phases.resolve()
        actual = {item.name for item in package_phases.iterdir()} if package_phases.is_dir() else set()
        repository_io._require(actual == required, "插件构建阶段集合与计划不符")
        plugins = {item.artifact_name: item for item in repository_source.discover_source_plugins(root)}
        packages = {}
        for artifact in sorted(required):
            directory = package_phases / artifact
            report = repository_io.read_json(directory / "report.json")
            plugin = plugins[artifact]
            repository_io._require(isinstance(report, dict) and report.get("schemaVersion") == 2
                          and report.get("artifactName") == artifact
                          and report.get("version") == plugin.version
                          and report.get("sourceSha") == workspace.source_sha
                          and report.get("partnerSha") == sdk_sha
                          and report.get("inputSha") == phase["packageInputs"][artifact]
                          and report.get("status") == "PASS", f"插件构建阶段身份无效：{artifact}")
            name = report.get("fileName")
            repository_io._require(isinstance(name, str) and re.fullmatch(
                rf"{re.escape(artifact)}-{re.escape(plugin.version)}-[0-9a-f]{{64}}\.zip", name)
                is not None, f"插件构建阶段文件名无效：{artifact}")
            package = directory / name
            repository_io._require(package.is_file() and not package.is_symlink()
                          and release_inventory._sha_file(package) == report.get("sha256")
                          and package.stat().st_size == report.get("sizeBytes")
                          and {item.name for item in directory.iterdir()} == {"report.json", name},
                          f"插件构建阶段字节无效：{artifact}")
            packages[artifact] = package
        plan_path = output.parent / f"{output.name}-plan.json"
        repository_io.write_json(plan_path, plan)
        release(root, plan_path, output, host_root=host_root,
                     distribution_root=workspace.distribution_root,
                     reuse_packages=packages)
        validate_generated(root, output, distribution_root=workspace.distribution_root)
        verify_unchanged_stable(root, output, workspace.distribution_root)
        candidate = write_candidate_manifest(root, output, workspace.distribution_root,
                                             source_sha=workspace.source_sha,
                                             distribution_sha=workspace.base_sha,
                                             partner_sha=sdk_sha, workflow_sha=workflow_sha,
                                             run_id=run_id, run_attempt=run_attempt)
        return {"status": "VALIDATED", "sourceSha": workspace.source_sha,
                "distributionSha": workspace.base_sha, "candidate": str(output),
                "files": len(candidate["files"])}
    finally:
        workspace.cleanup()


def plan_preview_candidate(root: Path, host_root: Path, output: Path, *, sdk_sha: str) -> dict[str, Any]:
    root, host_root, output = root.resolve(), host_root.resolve(), output.resolve()
    repository_io._require(not output.exists() and not repository_git._git(
        root, ["status", "--porcelain=v1", "--untracked-files=all"], "检查 preview 工作树"),
        "preview 源码工作树不干净或计划已存在")
    sdk = preflight(root, host_root, sdk_sha)
    repository_source.validate_sources(root)
    repository_source.check_syntax(root)
    repository_source.validate_host_locale_registry(root, host_root)
    plugins = repository_source.discover_source_plugins(root)
    head = repository_git.git_head(root)
    plan = {"requiresPackage": sorted(plugin.artifact_name for plugin in plugins),
            "managed": sorted(plugin.artifact_name for plugin in plugins
                              if plugin.kind == "managed-code")}
    result = {"schemaVersion": 1, "channel": "preview", "sourceSha": head,
              "sourceTreeSha": repository_git._git(root, ["rev-parse", f"{head}^{{tree}}"],
                                          "读取 preview source tree"),
              "partnerSha": sdk["sdkSourceSha"], "plan": plan,
              "packageInputs": release_inventory.package_input_identities(root, plan, sdk_sha)}
    output.parent.mkdir(parents=True, exist_ok=True)
    repository_io.write_json(output, result)
    return result


def assemble_preview_candidate(root: Path, host_root: Path, plan_phase: Path,
                               package_phases: Path, output: Path, producer_output: Path, *,
                               sdk_sha: str, workflow_sha: str,
                               run_id: int, run_attempt: int) -> dict[str, Any]:
    root, host_root, output = root.resolve(), host_root.resolve(), output.resolve()
    phase = repository_io.read_json(plan_phase.resolve())
    repository_io._require(isinstance(phase, dict) and set(phase) == {
        "schemaVersion", "channel", "sourceSha", "sourceTreeSha", "partnerSha",
        "plan", "packageInputs"} and phase["schemaVersion"] == 1
        and phase["channel"] == "preview", "preview 计划阶段清单无效")
    repository_io._require(not output.exists() and repository_git.git_head(root) == phase["sourceSha"]
                  and phase["sourceTreeSha"] == repository_git._git(
                      root, ["rev-parse", f"{phase['sourceSha']}^{{tree}}"],
                      "读取 preview source tree")
                  and not repository_git._git(root, ["status", "--porcelain=v1", "--untracked-files=all"],
                                    "检查 preview 工作树"), "preview 装配源码身份不符")
    sdk = preflight(root, host_root, sdk_sha)
    repository_io._require(phase["partnerSha"] == sdk["sdkSourceSha"]
                  and phase["packageInputs"] == release_inventory.package_input_identities(
                      root, phase["plan"], sdk_sha), "preview package input identity 不符")
    plugins = {plugin.artifact_name: plugin for plugin in repository_source.discover_source_plugins(root)}
    required = set(plugins)
    repository_io._require(set(phase["plan"]["requiresPackage"]) == required, "preview 包计划不完整")
    package_phases = package_phases.resolve()
    repository_io._require(package_phases.is_dir()
                  and {item.name for item in package_phases.iterdir()} == required,
                  "preview 构建阶段集合不符")
    output.mkdir(parents=True)
    packages_root = output / "packages"
    packages_root.mkdir()
    entries = []
    metadata = {}
    for artifact in sorted(required):
        directory = package_phases / artifact
        report = repository_io.read_json(directory / "report.json")
        plugin = plugins[artifact]
        name = report.get("fileName") if isinstance(report, dict) else None
        repository_io._require(isinstance(report, dict) and report.get("schemaVersion") == 2
                      and report.get("artifactName") == artifact
                      and report.get("version") == plugin.version
                      and report.get("sourceSha") == phase["sourceSha"]
                      and report.get("partnerSha") == sdk_sha
                      and report.get("inputSha") == phase["packageInputs"][artifact]
                      and report.get("status") == "PASS"
                      and isinstance(name, str) and re.fullmatch(
                          rf"{re.escape(artifact)}-{re.escape(plugin.version)}-[0-9a-f]{{64}}\.zip",
                          name) is not None, f"preview 构建阶段身份无效：{artifact}")
        source = directory / name
        repository_io._require(source.is_file() and not source.is_symlink()
                      and release_inventory._sha_file(source) == report["sha256"]
                      and source.stat().st_size == report["sizeBytes"]
                      and {item.name for item in directory.iterdir()} == {"report.json", name},
                      f"preview 构建阶段字节无效：{artifact}")
        destination = packages_root / name
        repository_io._require(not destination.exists(), "preview 包文件名冲突")
        shutil.copy2(source, destination)
        package_metadata = repository_model.PackageMetadata(destination, report["sha256"], report["sizeBytes"])
        entries.append(repository_catalog.preview_catalog_entry(plugin, destination, phase["sourceSha"],
                                                  package_metadata))
        metadata[artifact] = {"path": destination.relative_to(output).as_posix(),
                              "sha256": report["sha256"], "sizeBytes": report["sizeBytes"]}
    from datetime import datetime, timezone
    catalog = {"schemaVersion": 2, "repository": repository_model.REPOSITORY,
               "channel": "develop", "sourceCommit": phase["sourceSha"],
               "generatedAt": datetime.now(timezone.utc).replace(microsecond=0)
               .isoformat().replace("+00:00", "Z"),
               "plugins": repository_catalog._catalog_order(entries)}
    repository_io.write_json(output / "catalog.json", catalog)
    repository_io.write_json(output / "preview-plan.json",
                    {"schemaVersion": 1, "channel": "develop",
                     "sourceCommit": phase["sourceSha"], "packageMetadata": metadata})
    release_preview.validate_preview_candidate(output, expected_source_sha=phase["sourceSha"])
    producer_output = producer_output.resolve()
    repository_io._require(output not in producer_output.parents and not producer_output.exists(),
                  "preview producer sidecar 必须位于候选目录之外")
    repository_io.write_json(producer_output, {"schemaVersion": 1, "sourceSha": phase["sourceSha"],
                                      "runId": run_id, "runAttempt": run_attempt,
                                      "workflowSha": workflow_sha})
    write_preview_manifest(root, output, partner_sha=sdk_sha, workflow_sha=workflow_sha,
                           run_id=run_id, run_attempt=run_attempt)
    return {"status": "VALIDATED", "sourceSha": phase["sourceSha"],
            "packages": len(required), "candidate": str(output)}


def validate_inventory(root: Path, output: Path, *, expected_source_sha: str,
                       expected_partner_sha: str, expected_producer: dict[str, Any],
                       expected_distribution_sha: str) -> dict[str, Any]:
    repository_io._require(repository_git.git_head(root) == expected_source_sha, "writer source checkout 与 candidate 不一致")
    candidate = repository_io.read_json(output / "candidate.json")
    fields = {"schemaVersion", "repository", "channel", "sourceSha", "sourceTreeSha", "partnerSha",
                 "producer", "files", "releaseLabel", "distribution"}
    repository_io._require(isinstance(candidate, dict) and set(candidate) == fields | {"packageInputs"},
                  "candidate 字段集合无效")
    repository_io._require(type(candidate["schemaVersion"]) is int and candidate["schemaVersion"] == 2
                  and candidate["repository"] == repository_model.REPOSITORY and candidate["channel"] == "plugins-stable"
                  and candidate["releaseLabel"] is None, "candidate 仓库或通道无效")
    repository_io._require(candidate["sourceSha"] == expected_source_sha
                  and candidate["sourceTreeSha"] == repository_git._git(root, ["rev-parse", f"{expected_source_sha}^{{tree}}"], "读取 source tree")
                  and candidate["partnerSha"] == expected_partner_sha,
                  "candidate source/tree/partner 与可信输入不一致")
    repository_io._require(candidate["producer"] == expected_producer, "candidate 原 producer 身份不符")
    plan = repository_io.read_json(output / "release-plan.json")
    package_inputs = candidate["packageInputs"]
    repository_io._require(isinstance(package_inputs, dict)
                  and set(package_inputs) == set(plan.get("requiresPackage", []))
                  and all(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value)
                          for value in package_inputs.values()),
                  "candidate package input identity 无效")
    distribution = candidate["distribution"]
    repository_io._require(isinstance(distribution, dict) and set(distribution) == {
        "headSha", "stateSha256", "catalogSha256"}
        and distribution["headSha"] == expected_distribution_sha,
        "candidate 分发基线身份不符")
    actual = _inventory(root, output)
    repository_io._require(candidate["files"] == actual, "candidate inventory 文件摘要、大小或集合不符")
    with tempfile.TemporaryDirectory(prefix="nxp-candidate-check-") as temporary:
        distribution_root = Path(temporary)
        CandidateWorkspace._extract_distribution(root, expected_distribution_sha, distribution_root)
        repository_io._require(distribution["stateSha256"] == release_inventory._sha_file(distribution_root / repository_model.STATE_FILE)
                      and distribution["catalogSha256"] == release_inventory._sha_file(distribution_root / "catalog.json"),
                      "candidate 分发基线摘要不符")
        validate_generated(root, output, distribution_root=distribution_root)
        verify_unchanged_stable(root, output, distribution_root)
    return candidate


def inspect_candidate_identity(output: Path, *, workflow_sha: str,
                               run_id: int, run_attempt: int) -> dict[str, str]:
    """Read only the identity needed to checkout a safely extracted candidate source."""
    candidate = repository_io.read_json(output / "candidate.json")
    repository_io._require(isinstance(candidate, dict), "candidate.json 根节点无效")
    source_sha = candidate.get("sourceSha")
    partner_sha = candidate.get("partnerSha")
    repository_io._require(isinstance(source_sha, str) and FULL_SHA.fullmatch(source_sha) is not None,
                  "candidate source SHA 无效")
    repository_io._require(isinstance(partner_sha, str) and FULL_SHA.fullmatch(partner_sha) is not None,
                  "candidate partner SHA 无效")
    repository_io._require(candidate.get("producer") == {
        "workflowPath": release_inventory.WORKFLOW_PATH,
        "workflowSha": workflow_sha,
        "runId": run_id,
        "runAttempt": run_attempt,
        "jobName": JOB_NAME,
    }, "candidate 原 producer 身份不符")
    return {"sourceSha": source_sha, "partnerSha": partner_sha}


def validate_original_candidate(root: Path, output: Path, *, source_sha: str,
                                workflow_sha: str, run_id: int,
                                run_attempt: int) -> dict[str, Any]:
    manifest = repository_io.read_json(output / "candidate.json")
    repository_io._require(isinstance(manifest, dict), "candidate.json 必须是对象")
    partner_sha = manifest.get("partnerSha")
    distribution = manifest.get("distribution")
    repository_io._require(isinstance(partner_sha, str) and FULL_SHA.fullmatch(partner_sha) is not None,
                  "candidate partner SHA 无效")
    repository_io._require(isinstance(distribution, dict), "candidate distribution 无效")
    distribution_sha = distribution.get("headSha")
    repository_io._require(isinstance(distribution_sha, str) and FULL_SHA.fullmatch(distribution_sha) is not None,
                  "candidate distribution SHA 无效")
    repository_io._require(CandidateWorkspace._is_ancestor(root, distribution_sha, source_sha),
                  "candidate 分发快照不是 source 祖先")
    expected_producer = {"workflowPath": release_inventory.WORKFLOW_PATH, "workflowSha": workflow_sha,
                         "runId": run_id, "runAttempt": run_attempt, "jobName": JOB_NAME}
    return validate_inventory(root, output, expected_source_sha=source_sha,
                              expected_partner_sha=partner_sha,
                              expected_producer=expected_producer,
                              expected_distribution_sha=distribution_sha)


def write_preview_manifest(root: Path, output: Path, *, partner_sha: str | None,
                           workflow_sha: str, run_id: int, run_attempt: int) -> dict[str, Any]:
    source_sha = repository_git.git_head(root)
    repository_io._require(FULL_SHA.fullmatch(workflow_sha) is not None,
                  "preview workflow SHA 无效")
    repository_io._require(partner_sha is None or FULL_SHA.fullmatch(partner_sha) is not None,
                  "preview partner SHA 无效")
    repository_io._require(type(run_id) is int and run_id > 0 and type(run_attempt) is int and run_attempt > 0,
                  "preview run/attempt 无效")
    repository_io._require(not (output / "candidate.json").exists(), "preview candidate.json 已存在")
    release_preview.validate_preview_candidate(output, expected_source_sha=source_sha)
    candidate = {
        "schemaVersion": 1, "repository": repository_model.REPOSITORY, "channel": "plugins-preview",
        "sourceSha": source_sha,
        "sourceTreeSha": repository_git._git(root, ["rev-parse", f"{source_sha}^{{tree}}"], "读取 preview tree"),
        "partnerSha": partner_sha,
        "producer": {"workflowPath": release_inventory.PREVIEW_WORKFLOW_PATH, "workflowSha": workflow_sha,
                     "runId": run_id, "runAttempt": run_attempt, "jobName": PREVIEW_JOB_NAME},
        "files": release_inventory._preview_files(output), "releaseLabel": "plugins-develop", "distribution": None,
    }
    repository_io.write_json(output / "candidate.json", candidate)
    return candidate


def validate_preview_manifest(source_root: Path, output: Path, *, source_sha: str,
                              workflow_sha: str, run_id: int, run_attempt: int) -> dict[str, Any]:
    candidate = repository_io.read_json(output / "candidate.json")
    repository_io._require(isinstance(candidate, dict) and set(candidate) == {
        "schemaVersion", "repository", "channel", "sourceSha", "sourceTreeSha", "partnerSha",
        "producer", "files", "releaseLabel", "distribution"}, "preview candidate 字段集合无效")
    repository_io._require(candidate["schemaVersion"] == 1 and candidate["repository"] == repository_model.REPOSITORY
                  and candidate["channel"] == "plugins-preview"
                  and candidate["releaseLabel"] == "plugins-develop" and candidate["distribution"] is None,
                  "preview candidate 仓库或通道无效")
    repository_io._require(repository_git.git_head(source_root) == source_sha
                  and candidate["sourceSha"] == source_sha
                  and candidate["sourceTreeSha"] == repository_git._git(source_root, ["rev-parse", f"{source_sha}^{{tree}}"], "读取 preview tree"),
                  "preview candidate source/tree 不一致")
    repository_io._require(candidate["partnerSha"] is None
                  or (isinstance(candidate["partnerSha"], str)
                      and FULL_SHA.fullmatch(candidate["partnerSha"]) is not None),
                  "preview candidate partner SHA 无效")
    repository_io._require(candidate["producer"] == {
        "workflowPath": release_inventory.PREVIEW_WORKFLOW_PATH, "workflowSha": workflow_sha,
        "runId": run_id, "runAttempt": run_attempt, "jobName": PREVIEW_JOB_NAME},
        "preview candidate 原 producer 身份不符")
    repository_io._require(candidate["files"] == release_inventory._preview_files(output),
                  "preview candidate inventory 不符")
    release_preview.validate_preview_candidate(output, expected_source_sha=source_sha)
    return candidate


def inspect_preview_candidate(output: Path, producer_path: Path, *, workflow_sha: str,
                              run_id: int, run_attempt: int) -> str:
    """Read the payload source from data after binding it to the original job."""
    candidate = repository_io.read_json(output / "candidate.json")
    producer = repository_io.read_json(producer_path)
    repository_io._require(isinstance(candidate, dict) and isinstance(producer, dict),
                  "preview candidate/producer 必须是对象")
    source_sha = candidate.get("sourceSha")
    repository_io._require(isinstance(source_sha, str) and FULL_SHA.fullmatch(source_sha) is not None,
                  "preview source SHA 无效")
    repository_io._require(candidate.get("producer") == {
        "workflowPath": release_inventory.PREVIEW_WORKFLOW_PATH, "workflowSha": workflow_sha,
        "runId": run_id, "runAttempt": run_attempt, "jobName": PREVIEW_JOB_NAME},
        "preview candidate 原 producer 身份不符")
    repository_io._require(producer == {"schemaVersion": 1, "sourceSha": source_sha,
                              "runId": run_id, "runAttempt": run_attempt,
                              "workflowSha": workflow_sha},
                  "preview producer sidecar 身份不符")
    repository_io._require(candidate.get("files") == release_inventory._preview_files(output),
                  "preview candidate inventory 不符")
    release_preview.validate_preview_candidate(output, expected_source_sha=source_sha)
    return source_sha
