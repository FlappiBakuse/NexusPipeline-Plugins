"""Resolve an original Plugins candidate from GitHub's server-side run records.

The candidate sidecar is data. This module does not download or execute it, and
does not require the overall workflow conclusion to be success: a later writer
failure must not invalidate an earlier successful candidate job.
"""

from __future__ import annotations

from datetime import datetime
import json
import re
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any


REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"
POLICIES = {
    "stable": {
        "workflow": ".github/workflows/publish-stable.yml",
        "events": {"push", "workflow_dispatch"},
        "artifact": "plugins-stable-candidate",
        "jobs": ("Plugins / 候选输入", "Plugins / 发行装配", "Plugins / 候选校验"),
        "buildPrefix": "Plugins / 插件构建 · ",
        "requireBuild": False,
    },
    "preview": {
        "workflow": ".github/workflows/publish-develop.yml",
        "events": {"workflow_dispatch"},
        "artifact": "plugins-develop-preview",
        "jobs": ("Plugins / 预览输入", "Plugins / 预览构建"),
        "buildPrefix": "Plugins / 预览插件 · ",
        "requireBuild": True,
    },
}


class CandidateSourceError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise CandidateSourceError(message)


def positive_int(value: Any, label: str) -> int:
    require(type(value) is int and value > 0, f"{label} 必须是正整数")
    return value


def full_sha(value: Any, label: str) -> str:
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None,
            f"{label} 必须是完整 SHA")
    return value


def completed_job(entries: list[dict[str, Any]], name: str) -> None:
    matches = [job for job in entries if job.get("name") == name]
    require(len(matches) == 1 and matches[0].get("conclusion") == "success"
            and matches[0].get("status") == "completed", f"原 attempt {name} job 未真实成功")
    try:
        started = datetime.fromisoformat(matches[0]["started_at"].replace("Z", "+00:00"))
        completed = datetime.fromisoformat(matches[0]["completed_at"].replace("Z", "+00:00"))
        elapsed = (completed - started).total_seconds()
    except (KeyError, AttributeError, TypeError, ValueError) as exc:
        raise CandidateSourceError(f"{name} 缺少完整服务端时间") from exc
    require(0 <= elapsed <= 150, f"{name} 完整耗时超过 150 秒")


def list_attempt_jobs(fetch: Callable[[str], dict[str, Any]], prefix: str, run_id: int, attempt: int) -> list[dict[str, Any]]:
    entries = []
    for page in range(1, 101):
        response = fetch(f"{prefix}/runs/{run_id}/attempts/{attempt}/jobs?per_page=100&page={page}")
        batch = response.get("jobs")
        require(isinstance(batch, list) and all(isinstance(job, dict) for job in batch), "原 attempt jobs 列表无效")
        entries.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise CandidateSourceError("原 attempt jobs 超过有界分页上限")
    return entries


def resolve_candidate(
    fetch: Callable[[str], dict[str, Any]],
    *,
    channel: str,
    candidate_run_id: int,
    current_run_id: int,
    artifact_id: int | None = None,
) -> dict[str, Any]:
    require(channel in POLICIES, "未知发行通道")
    policy = POLICIES[channel]
    positive_int(candidate_run_id, "candidate run ID")
    positive_int(current_run_id, "current run ID")
    if artifact_id is not None:
        positive_int(artifact_id, "artifact ID")
    prefix = f"repos/{REPOSITORY}/actions"
    original = fetch(f"{prefix}/runs/{candidate_run_id}")
    current = fetch(f"{prefix}/runs/{current_run_id}")
    require(original.get("id") == candidate_run_id and current.get("id") == current_run_id,
            "Actions run ID 与服务端记录不符")
    require(original.get("repository", {}).get("full_name") == REPOSITORY
            and current.get("repository", {}).get("full_name") == REPOSITORY,
            "candidate 或 writer 不属于官方 Plugins 仓库")
    require(original.get("workflow_id") == current.get("workflow_id"),
            "candidate 与 writer 的 workflow 身份不一致")
    workflow_path = str(original.get("path", "")).split("@", 1)[0]
    require(workflow_path in {policy["workflow"], f"{REPOSITORY}/{policy['workflow']}"},
            "candidate workflow 路径不可信")
    require(original.get("event") in policy["events"] and original.get("head_branch") == "main",
            "candidate 必须由 main push 或 main 控制的手动工作流产生")
    controller_sha = full_sha(original.get("head_sha"), "candidate controller")
    artifacts: list[dict[str, Any]] = []
    for page in range(1, 101):
        response = fetch(f"{prefix}/runs/{candidate_run_id}/artifacts?per_page=100&page={page}")
        batch = response.get("artifacts")
        require(isinstance(batch, list), "artifact 服务端列表无效")
        artifacts.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise CandidateSourceError("artifact 列表超过有界分页上限")
    matches = []
    for item in artifacts:
        if not isinstance(item, dict):
            continue
        match = re.fullmatch(rf"{policy['artifact']}-{candidate_run_id}-([1-9][0-9]*)", str(item.get("name", "")))
        if match and (artifact_id is None or item.get("id") == artifact_id):
            matches.append((item, int(match.group(1))))
    require(len(matches) == 1, "IDENTITY_UNVERIFIABLE：candidate artifact 不唯一或不存在；请指定 artifact ID")
    artifact, attempt = matches[0]
    require(original.get("run_attempt") == attempt, "candidate artifact 属于过期 attempt")
    require(type(artifact.get("id")) is int and artifact["id"] > 0
            and artifact.get("expired") is False
            and type(artifact.get("size_in_bytes")) is int and artifact["size_in_bytes"] > 0
            and artifact.get("workflow_run", {}).get("id") == candidate_run_id,
            "candidate artifact 身份、有效期或大小无效")
    digest = artifact.get("digest")
    require(isinstance(digest, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is not None,
            "candidate artifact 缺少服务端 SHA256")
    entries = list_attempt_jobs(fetch, prefix, candidate_run_id, attempt)
    names = {job.get("name") for job in entries}
    for name in policy["jobs"]:
        completed_job(entries, name)
    builds = [name for name in names if isinstance(name, str) and name.startswith(policy["buildPrefix"])]
    require(not policy["requireBuild"] or bool(builds), "preview 缺少插件构建阶段")
    for name in builds:
        completed_job(entries, name)
    return {
        "sourceSha": controller_sha,
        "workflowSha": controller_sha,
        "runId": candidate_run_id,
        "runAttempt": attempt,
        "artifactId": artifact["id"],
        "artifactDigest": digest,
        "producerSchema": "staged-v2",
        "budgetQualified": True,
    }


def github_fetch(token: str, path: str) -> dict[str, Any]:
    request = urllib.request.Request(
        f"https://api.github.com/{path}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if (exc.code == 429 or exc.code >= 500) and attempt < 2:
                retry_after = exc.headers.get("Retry-After", "1")
                delay = min(5, max(1, int(retry_after))) if retry_after.isdecimal() else 1
                time.sleep(delay)
                continue
            raise CandidateSourceError(f"读取 Actions 服务端事实失败：HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise CandidateSourceError(f"读取 Actions 服务端事实失败：{type(exc).__name__}") from exc
        except ValueError as exc:
            raise CandidateSourceError("读取 Actions 服务端事实失败：响应 JSON 无效") from exc
    raise CandidateSourceError("读取 Actions 服务端事实失败：超过有界重试")
