"""Build and validate a cumulative stable candidate without Qualification proofs."""

from __future__ import annotations

import hashlib
import json
import re
import tempfile
from pathlib import Path
from typing import Any

import repository_core as core
from candidate_workspace import CandidateWorkspace
from verification import preflight, run_managed_gate


WORKFLOW_PATH = ".github/workflows/publish-stable.yml"
JOB_NAME = "stable-candidate"
FULL_SHA = re.compile(r"[0-9a-f]{40}")


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
    candidate = {
        "schemaVersion": 1,
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
) -> dict[str, Any]:
    root = root.resolve()
    host_root = host_root.resolve()
    output = output.resolve()
    core._require(not output.exists(), f"candidate 输出已存在，拒绝覆盖：{output}")
    core._require(not core._git(root, ["status", "--porcelain=v1", "--untracked-files=all"], "检查候选工作树"),
                  "candidate 源码工作树不干净")
    sdk = preflight(root, host_root, sdk_sha)
    workspace = CandidateWorkspace.create(root, "HEAD")
    plan_path = output.parent / f"{output.name}-plan.json"
    try:
        core.validate_candidate_against_base(root, workspace.state_source_sha,
                                             head=workspace.source_sha,
                                             distribution_root=workspace.distribution_root)
        core.validate_sources(root)
        core.check_syntax(root)
        core.validate_host_locale_registry(root, host_root)
        plan = core.build_plan(root, "auto", workspace.source_sha,
                               distribution_root=workspace.distribution_root)
        if not (plan["requiresPackage"] or plan["deleted"] or plan["relocated"]):
            return {"status": "NO_CHANGES", "sourceSha": workspace.source_sha,
                    "distributionSha": workspace.base_sha, "candidate": None}
        core._run(("dotnet", "run", "--project", str(host_root / "tools" / "NexusPipeline.TaskProtocolTests"),
                   "--", "--plugin-root", str(root)), "Production task adapters through Host Jint", root)
        selected = [item for item in plan.get("managed", []) if isinstance(item, str)]
        run_managed_gate(root, host_root, selected=selected, host_integration=False)
        core.write_json(plan_path, plan)
        core.release(root, plan_path, output, host_root=host_root,
                     distribution_root=workspace.distribution_root)
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
                "files": len(candidate["files"])}
    finally:
        workspace.cleanup()


def validate_inventory(root: Path, output: Path, *, expected_source_sha: str,
                       expected_partner_sha: str, expected_producer: dict[str, Any],
                       expected_distribution_sha: str) -> dict[str, Any]:
    core._require(core.git_head(root) == expected_source_sha, "writer source checkout 与 candidate 不一致")
    candidate = core.read_json(output / "candidate.json")
    core._require(isinstance(candidate, dict) and set(candidate) == {
        "schemaVersion", "repository", "channel", "sourceSha", "sourceTreeSha", "partnerSha",
        "producer", "files", "releaseLabel", "distribution"}, "candidate 字段集合无效")
    core._require(type(candidate["schemaVersion"]) is int and candidate["schemaVersion"] == 1
                  and candidate["repository"] == core.REPOSITORY and candidate["channel"] == "plugins-stable"
                  and candidate["releaseLabel"] is None, "candidate 仓库或通道无效")
    core._require(candidate["sourceSha"] == expected_source_sha
                  and candidate["sourceTreeSha"] == core._git(root, ["rev-parse", f"{expected_source_sha}^{{tree}}"], "读取 source tree")
                  and candidate["partnerSha"] == expected_partner_sha,
                  "candidate source/tree/partner 与可信输入不一致")
    core._require(candidate["producer"] == expected_producer, "candidate 原 producer 身份不符")
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
