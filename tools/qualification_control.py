"""Plugins Release Qualification 的固定策略与 GitHub API 控制器。

这个模块只允许访问固定官方 GitHub API 主机和两个官方仓库。候选 job 不应把
用户输入拼接进 shell；远端写 check 的 token 只由受保护的 qualification job
传入。所有聚合规则都 fail-closed，离线策略测试不代表远端权限已经启用。
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from typing import Any

try:
    from .qualification_contract import (
        ContractError,
        make_external_id,
        parse_strict_json,
        validate_jobs,
        validate_proof,
        validate_run,
        validate_squash,
    )
except ImportError:
    from qualification_contract import (
        ContractError,
        make_external_id,
        parse_strict_json,
        validate_jobs,
        validate_proof,
        validate_run,
        validate_squash,
    )


API_ROOT = "https://api.github.com"
OFFICIAL_REPOSITORIES = frozenset(
    {
        "FlappiBakuse/NexusPipeline",
        "FlappiBakuse/NexusPipeline-Plugins",
    }
)
OFFICIAL_HOST_REPOSITORY = "FlappiBakuse/NexusPipeline"
OFFICIAL_PLUGINS_REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"
CHECK_NAME = "Plugin Release Qualification"
REQUIRED_GATES = ("P1", "P2", "P3")
FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
EXTERNAL_ID = "plugins-release-qualification-v1"
WORKFLOW_PATH = ".github/workflows/release-qualification.yml"


class QualificationError(RuntimeError):
    """资格控制器拒绝候选时抛出的明确错误。"""


RequestFn = Callable[[str, str, str | None, Mapping[str, Any] | None], Any]
GitRunner = Callable[[list[str]], subprocess.CompletedProcess[str]]


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise QualificationError(message)


def _sha(value: Any, label: str) -> str:
    _require(isinstance(value, str) and FULL_SHA.fullmatch(value) is not None, f"{label} 必须是完整 40 位 SHA")
    return value


def _repository(repository: str) -> str:
    _require(repository in OFFICIAL_REPOSITORIES, f"仓库不在官方允许范围：{repository}")
    return repository


def _path(path: str) -> str:
    _require(path.startswith("/") and not path.startswith("//"), "GitHub API path 必须是绝对 API 路径")
    _require(".." not in path and not re.search(r"https?://", path, re.IGNORECASE), "禁止在 API path 中使用 URL 或越界段")
    return path


def _default_request(method: str, path: str, token: str | None, payload: Mapping[str, Any] | None) -> Any:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "nexuspipeline-qualification",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{API_ROOT}{_path(path)}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def github_request(
    method: str,
    path: str,
    token: str | None,
    payload: Mapping[str, Any] | None = None,
    *,
    request_fn: RequestFn | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Any:
    """调用固定 api.github.com，最多三次重试限流和 5xx。

    `request_fn` 只用于离线策略测试；真实调用使用标准库请求。异常信息从不包含
    token，且本函数不会打印请求头或响应中的敏感字段。
    """

    _require(method in {"GET", "POST", "PATCH"}, f"不允许的 GitHub API method：{method}")
    path = _path(path)
    request_fn = request_fn or _default_request
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return request_fn(method, path, token, payload)
        except urllib.error.HTTPError as exc:
            if exc.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise QualificationError(f"GitHub API {method} {path} 失败：HTTP {exc.code}") from exc
            last_error = exc
            sleep(float(2**attempt))
        except (TimeoutError, urllib.error.URLError) as exc:
            raise QualificationError(f"GitHub API {method} {path} 网络失败") from exc
    raise QualificationError(f"GitHub API {method} {path} 重试失败") from last_error


def read_pull_request(
    repository: str,
    number: int | str,
    expected_head_sha: str,
    token: str | None,
    *,
    request_fn: RequestFn | None = None,
) -> dict[str, Any]:
    """读取并固定一个同仓库、打开中、目标为 main 的 PR。"""

    repository = _repository(repository)
    _sha(expected_head_sha, "expected_head_sha")
    _require(str(number).isdigit() and int(number) > 0, "pr_number 必须是正整数")
    pull = github_request("GET", f"/repos/{repository}/pulls/{int(number)}", token, request_fn=request_fn)
    _require(isinstance(pull, dict), "PR API 返回不是对象")
    _require(pull.get("state") == "open", "PR 必须保持 open")
    _require(pull.get("draft") is not True, "PR 不得是 draft")
    _require((pull.get("base") or {}).get("ref") == "main", "PR base 必须是 main")
    base_repo = ((pull.get("base") or {}).get("repo") or {}).get("full_name")
    head_repo = ((pull.get("head") or {}).get("repo") or {}).get("full_name")
    _require(base_repo == repository and head_repo == repository, "PR 必须来自同一官方仓库，不能使用 fork")
    _require(((pull.get("head") or {}).get("sha")) == expected_head_sha, "PR head 已变化")
    return pull


def _ref_sha(value: Mapping[str, Any], label: str) -> str:
    return _sha((value.get("object") or {}).get("sha"), label)


def resolve_candidate(
    repository: str,
    expected_head_sha: str,
    workflow_sha: str,
    token: str | None,
    *,
    request_fn: RequestFn | None = None,
    git_runner: GitRunner | None = None,
) -> dict[str, str]:
    """解析 H/B/C，要求可信 workflow C 等于启动时 main B 且 B 是 H 祖先。"""

    repository = _repository(repository)
    h = _sha(expected_head_sha, "H")
    c = _sha(workflow_sha, "C")
    main_ref = github_request("GET", f"/repos/{repository}/git/ref/heads/main", token, request_fn=request_fn)
    b = _ref_sha(main_ref, "B")
    _require(c == b, "可信 qualification workflow C 必须等于启动时 main B")
    runner = git_runner or (lambda args: subprocess.run(args, check=False, capture_output=True, text=True))
    result = runner(["git", "merge-base", "--is-ancestor", b, h])
    _require(result.returncode == 0, "main B 必须是候选 head H 的祖先")
    return {"headSha": h, "baseSha": b, "workflowSha": c}


def resolve_contract_input(
    repository: str,
    token: str | None,
    *,
    candidate_sha: str | None = None,
    request_fn: RequestFn | None = None,
    contract_validator: Callable[[str], None] | None = None,
) -> dict[str, str]:
    """从固定官方对端仓库解析一次契约输入，不接受任意 URL 或仓库。"""

    _repository(repository)
    partner = OFFICIAL_HOST_REPOSITORY if repository == OFFICIAL_PLUGINS_REPOSITORY else OFFICIAL_PLUGINS_REPOSITORY
    if candidate_sha is None:
        ref = github_request("GET", f"/repos/{partner}/git/ref/heads/main", token, request_fn=request_fn)
        resolved = _ref_sha(ref, "contractSourceSha")
    else:
        resolved = _sha(candidate_sha, "contractSourceSha")
    if contract_validator is not None:
        contract_validator(resolved)
    return {"repository": partner, "contractSourceSha": resolved}


def resolve_candidate_compatibility(
    repository: str,
    candidate_sha: str,
    token: str | None,
    *,
    request_fn: RequestFn | None = None,
) -> dict[str, Any]:
    """从固定官方 API 读取候选 H 的 host.lock.json；不执行候选代码。"""

    repository = _repository(repository)
    candidate_sha = _sha(candidate_sha, "candidate H")
    response = github_request(
        "GET",
        f"/repos/{repository}/contents/host.lock.json?ref={candidate_sha}",
        token,
        request_fn=request_fn,
    )
    _require(isinstance(response, dict) and response.get("path") == "host.lock.json" and response.get("encoding") == "base64", "候选 host.lock.json API 响应无效")
    content = response.get("content")
    _require(isinstance(content, str), "候选 host.lock.json 缺少 base64 内容")
    try:
        decoded = decode_contents_base64(content).decode("utf-8")
        value = json.loads(decoded)
    except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise QualificationError("候选 host.lock.json 不是有效 JSON") from exc
    _require(isinstance(value, dict), "候选 host.lock.json 根节点必须是对象")
    return value


def decode_contents_base64(content: str) -> bytes:
    """GitHub Contents 使用换行 Base64；仅去除 CR/LF，其余字符严格校验。"""
    return base64.b64decode(content.replace("\r", "").replace("\n", "").encode("ascii"), validate=True)


def begin_check(
    repository: str,
    head_sha: str,
    app_id: int | str,
    token: str,
    association: Mapping[str, Any],
    *,
    base_sha: str,
    workflow_sha: str,
    run_id: int | str,
    run_attempt: int | str,
    request_fn: RequestFn | None = None,
) -> str:
    """创建或更新本控制器唯一的 in_progress App check。"""

    repository = _repository(repository)
    head_sha = _sha(head_sha, "H")
    _require(str(app_id).isdigit(), "Qualification App ID 必须是数字")
    listing = github_request(
        "GET",
        f"/repos/{repository}/commits/{head_sha}/check-runs?per_page=100",
        token,
        request_fn=request_fn,
    )
    runs = listing.get("check_runs", []) if isinstance(listing, dict) else []
    run_id_int = int(run_id)
    run_attempt_int = int(run_attempt)
    external_id = make_external_id(repository, head_sha, base_sha, workflow_sha, run_id_int, run_attempt_int)
    same_name = [run for run in runs if run.get("name") == CHECK_NAME]
    foreign = [run for run in same_name if str((run.get("app") or {}).get("id")) != str(app_id)]
    _require(not foreign, "发现其他 App 使用同名资格 check，拒绝混淆")
    ours = [run for run in same_name if run.get("external_id") == external_id]
    _require(len(ours) <= 1, "本控制器同一 H 存在重复 external_id")
    payload = {
        "name": CHECK_NAME,
        "head_sha": head_sha,
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "external_id": external_id,
        "output": {
            "title": "Plugin Release Qualification running",
            "summary": json.dumps(dict(association), ensure_ascii=False, sort_keys=True),
        },
    }
    if ours:
        check_id = ours[0].get("id")
        _require(isinstance(check_id, int), "已有资格 check 缺少合法 id")
        response = github_request("PATCH", f"/repos/{repository}/check-runs/{check_id}", token, payload, request_fn=request_fn)
    else:
        response = github_request("POST", f"/repos/{repository}/check-runs", token, payload, request_fn=request_fn)
    _require(isinstance(response, dict) and isinstance(response.get("id"), int), "GitHub 未返回资格 check id")
    return str(response["id"])


def _job_pages(
    repository: str,
    run_id: int | str,
    run_attempt: int | str,
    token: str,
    request_fn: RequestFn | None,
) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    page = 1
    while True:
        response = github_request(
            "GET",
            f"/repos/{repository}/actions/runs/{run_id}/attempts/{run_attempt}/jobs?per_page=100&page={page}",
            token,
            request_fn=request_fn,
        )
        _require(isinstance(response, dict), "Actions jobs API 返回不是对象")
        page_jobs = response.get("jobs")
        _require(isinstance(page_jobs, list), "Actions jobs API 缺少 jobs")
        jobs.extend(job for job in page_jobs if isinstance(job, dict))
        if len(page_jobs) < 100:
            break
        page += 1
    return jobs


def collect_gate_results(
    repository: str,
    run_id: int | str,
    token: str,
    *,
    run_attempt: int | str,
    gate_names: tuple[str, ...] = REQUIRED_GATES,
    request_fn: RequestFn | None = None,
) -> dict[str, dict[str, Any]]:
    """收集当前 attempt 的全部必需 Gate，缺失/重复/非 success 一律拒绝。"""

    repository = _repository(repository)
    jobs = _job_pages(repository, run_id, run_attempt, token, request_fn)
    try:
        return validate_jobs(
            jobs,
            request_run_id=int(run_id),
            request_attempt=int(run_attempt),
            gate_names=gate_names,
        )
    except (ContractError, ValueError) as exc:
        raise QualificationError(str(exc)) from exc


def _check_pages(
    repository: str,
    head_sha: str,
    token: str,
    request_fn: RequestFn | None,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    page = 1
    while True:
        response = github_request(
            "GET",
            f"/repos/{repository}/commits/{head_sha}/check-runs?per_page=100&page={page}",
            token,
            request_fn=request_fn,
        )
        _require(isinstance(response, dict) and isinstance(response.get("check_runs"), list), "check-runs API 返回不完整")
        result.extend(item for item in response["check_runs"] if isinstance(item, dict))
        if len(response["check_runs"]) < 100:
            break
        page += 1
    return result


def _find_owned_check(
    repository: str,
    head_sha: str,
    check_id: str,
    app_id: int,
    external_id: str,
    token: str,
    request_fn: RequestFn | None,
) -> dict[str, Any]:
    _require(str(check_id).isdigit() and int(check_id) > 0, "check_id 必须是正整数")
    matches = [
        item for item in _check_pages(repository, head_sha, token, request_fn)
        if item.get("id") == int(check_id) and item.get("name") == CHECK_NAME
    ]
    _require(len(matches) == 1, "check_id 不属于当前 H 的唯一 Qualification check")
    check = matches[0]
    _require(str((check.get("app") or {}).get("id")) == str(app_id), "Qualification check 来源 App 不匹配")
    _require(check.get("head_sha") == head_sha, "Qualification check head SHA 不匹配")
    _require(check.get("external_id") == external_id, "Qualification check external_id 不匹配")
    _require(check.get("status") == "in_progress", "Qualification check 不是当前运行创建的 in_progress check")
    return check


def finish_check(
    repository: str,
    number: int | str,
    expected_head_sha: str,
    expected_base_sha: str,
    workflow_sha: str,
    run_id: int | str,
    check_id: str,
    app_id: int | str,
    sdk_source_sha: str,
    contract_source_sha: str,
    token: str,
    *,
    run_attempt: int | str,
    workflow_path: str = WORKFLOW_PATH,
    request_fn: RequestFn | None = None,
    gate_names: tuple[str, ...] = REQUIRED_GATES,
) -> dict[str, Any]:
    """在重新读取 H/B 和全部 Gate 后完成唯一资格 check。"""

    repository = _repository(repository)
    h = _sha(expected_head_sha, "H")
    b = _sha(expected_base_sha, "B")
    c = _sha(workflow_sha, "C")
    if repository == OFFICIAL_HOST_REPOSITORY:
        _require(sdk_source_sha == "", "Host qualification 的 sdkSourceSha 必须为空")
    else:
        _sha(sdk_source_sha, "sdkSourceSha")
        _require(sdk_source_sha == contract_source_sha, "Plugins qualification 的 SDK/契约 SHA 必须一致")
    _sha(contract_source_sha, "contractSourceSha")
    run_id_int = int(run_id)
    run_attempt_int = int(run_attempt)
    app_id_int = int(app_id)
    external_id = make_external_id(repository, h, b, c, run_id_int, run_attempt_int)
    _find_owned_check(repository, h, check_id, app_id_int, external_id, token, request_fn)
    outcome = "success"
    reason = "全部 P1-P3 Gate 成功"
    try:
        run = github_request("GET", f"/repos/{repository}/actions/runs/{run_id_int}", token, request_fn=request_fn)
        try:
            validate_run(
                run,
                repository=repository,
                run_id=run_id_int,
                run_attempt=run_attempt_int,
                workflow_sha=c,
                workflow_path=workflow_path,
            )
        except ContractError as exc:
            raise QualificationError(str(exc)) from exc
        pull = read_pull_request(repository, number, h, token, request_fn=request_fn)
        main_ref = github_request("GET", f"/repos/{repository}/git/ref/heads/main", token, request_fn=request_fn)
        current_b = _ref_sha(main_ref, "当前 main")
        _require(current_b == b, "main 在资格期间前进")
        _require(c == b, "可信 workflow C 与 B 不一致")
        gates = collect_gate_results(repository, run_id_int, token, run_attempt=run_attempt_int, gate_names=gate_names, request_fn=request_fn)
    except QualificationError as exc:
        outcome = "failure"
        reason = str(exc)
        gates = {}
        pull = None
    payload = {
        "name": CHECK_NAME,
        "status": "completed",
        "conclusion": outcome,
        "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "output": {
            "title": "Plugin Release Qualification " + ("passed" if outcome == "success" else "failed"),
            "summary": reason,
            "text": json.dumps(
                {
                    "schemaVersion": 1,
                    "repository": repository,
                    "headSha": h,
                    "baseSha": b,
                    "workflowSha": c,
                    "runId": run_id_int,
                    "runAttempt": run_attempt_int,
                    "appId": app_id_int,
                    "sdkSourceSha": sdk_source_sha,
                    "contractSourceSha": contract_source_sha,
                    "gates": {name: "success" for name in sorted(gates)},
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
        },
    }
    updated = github_request("PATCH", f"/repos/{repository}/check-runs/{check_id}", token, payload, request_fn=request_fn)
    _require(isinstance(updated, dict), "完成资格 check 未返回对象")
    proof = parse_strict_json(payload["output"]["text"])
    if outcome == "success":
        try:
            validate_proof(
                proof,
                repository=repository,
                head_sha=h,
                base_sha=b,
                workflow_sha=c,
                run_id=run_id_int,
                run_attempt=run_attempt_int,
                app_id=app_id_int,
                gate_names=gate_names,
                sdk_source_sha=sdk_source_sha,
                contract_source_sha=contract_source_sha,
            )
        except ContractError as exc:
            raise QualificationError(str(exc)) from exc
    return {"conclusion": outcome, "reason": reason, "pull": pull, "gates": gates, "response": updated, "proof": proof}


def verify_merged_candidate(
    repository: str,
    number: int | str,
    merged_sha: str,
    expected_base_sha: str,
    expected_head_sha: str,
    check_id: str,
    app_id: int | str,
    run_id: int | str,
    token: str,
    *,
    request_fn: RequestFn | None = None,
) -> dict[str, Any]:
    """验证 squash merge 的父提交/tree 和 Qualification App 关联。"""

    repository = _repository(repository)
    m = _sha(merged_sha, "M")
    b = _sha(expected_base_sha, "B")
    h = _sha(expected_head_sha, "H")
    _require(str(number).isdigit() and int(number) > 0, "pr_number 必须是正整数")
    run_id_int = int(run_id)
    app_id_int = int(app_id)
    _require(run_id_int > 0, "run_id 必须是正整数")
    pull = github_request("GET", f"/repos/{repository}/pulls/{int(number)}", token, request_fn=request_fn)
    _require(pull.get("merged") is True and pull.get("merge_commit_sha") == m, "PR 未按预期合并到 M")
    _require(pull.get("draft") is not True and (pull.get("base") or {}).get("ref") == "main", "PR 不是目标 main 的已合并 PR")
    _require(((pull.get("head") or {}).get("repo") or {}).get("full_name") == repository, "合并 PR 不是同仓库来源")
    merged = github_request("GET", f"/repos/{repository}/git/commits/{m}", token, request_fn=request_fn)
    head = github_request("GET", f"/repos/{repository}/git/commits/{h}", token, request_fn=request_fn)
    _require(isinstance(head, dict) and isinstance((head.get("tree") or {}).get("sha"), str), "H Git commit tree 缺失")
    try:
        validate_squash(merged, base_sha=b, head_tree_sha=head["tree"]["sha"])
    except ContractError as exc:
        raise QualificationError(str(exc)) from exc
    checks = _check_pages(repository, h, token, request_fn)
    matches = [run for run in checks if run.get("id") == int(check_id) and run.get("name") == CHECK_NAME]
    _require(len(matches) == 1, "M 缺少唯一 Qualification App check 关联")
    check = matches[0]
    _require(str((check.get("app") or {}).get("id")) == str(app_id_int), "Qualification check 来源 App 不匹配")
    proof_text = (check.get("output") or {}).get("text")
    _require(isinstance(proof_text, str), "Qualification check 缺少结构化证明")
    proof = parse_strict_json(proof_text)
    expected_attempt = proof.get("runAttempt")
    try:
        sdk_source_sha = proof.get("sdkSourceSha")
        contract_source_sha = proof.get("contractSourceSha")
        _require(isinstance(sdk_source_sha, str), "Qualification check 缺少 sdkSourceSha")
        _require(isinstance(contract_source_sha, str), "Qualification check 缺少 contractSourceSha")
        validate_proof(
            proof,
            repository=repository,
            head_sha=h,
            base_sha=b,
            workflow_sha=proof.get("workflowSha"),
            run_id=run_id_int,
            run_attempt=expected_attempt,
            app_id=app_id_int,
            gate_names=REQUIRED_GATES,
            sdk_source_sha=sdk_source_sha,
            contract_source_sha=contract_source_sha,
        )
        external_id = make_external_id(repository, h, b, proof["workflowSha"], run_id_int, expected_attempt)
    except (ContractError, TypeError, ValueError) as exc:
        raise QualificationError(f"Qualification check 证明无效：{exc}") from exc
    _require(check.get("head_sha") == h and check.get("external_id") == external_id and check.get("conclusion") == "success", "Qualification check 关联无效")
    run = github_request("GET", f"/repos/{repository}/actions/runs/{run_id_int}", token, request_fn=request_fn)
    try:
        validate_run(
            run,
            repository=repository,
            run_id=run_id_int,
            run_attempt=expected_attempt,
            workflow_sha=proof["workflowSha"],
            workflow_path=WORKFLOW_PATH,
            require_completed=True,
        )
    except ContractError as exc:
        raise QualificationError(str(exc)) from exc
    collect_gate_results(repository, run_id_int, token, run_attempt=expected_attempt, request_fn=request_fn)
    return {
        "mergedSha": m,
        "baseSha": b,
        "headSha": h,
        "checkId": check_id,
        "appId": app_id_int,
        "runId": run_id_int,
        "runAttempt": expected_attempt,
        "workflowSha": proof["workflowSha"],
        "sdkSourceSha": proof["sdkSourceSha"],
        "contractSourceSha": proof["contractSourceSha"],
    }


def resolve_merged_candidate(
    repository: str,
    merged_sha: str,
    app_id: int | str,
    token: str,
    *,
    request_fn: RequestFn | None = None,
    require_current_main: bool = True,
) -> dict[str, Any]:
    """从当前 squash merge 自动发现并复核唯一成功的 Qualification 证明。"""

    repository = _repository(repository)
    merged_sha = _sha(merged_sha, "M")
    _require(str(app_id).isdigit() and int(app_id) > 0, "Qualification App ID 必须是正整数")
    app_id_int = int(app_id)
    if require_current_main:
        main_ref = github_request("GET", f"/repos/{repository}/git/ref/heads/main", token, request_fn=request_fn)
        _require(_ref_sha(main_ref, "当前 main") == merged_sha, "main 已前进，当前 push 事件不是最新 source SHA")

    listing = github_request("GET", f"/repos/{repository}/commits/{merged_sha}/pulls?per_page=100", token, request_fn=request_fn)
    _require(isinstance(listing, list), "关联 PR API 返回不是数组")
    pulls: list[dict[str, Any]] = []
    for item in listing:
        if not isinstance(item, dict):
            continue
        number = item.get("number")
        if not isinstance(number, int) or number <= 0:
            continue
        pull = github_request("GET", f"/repos/{repository}/pulls/{number}", token, request_fn=request_fn)
        if not isinstance(pull, dict):
            continue
        if (
            pull.get("merged") is True
            and pull.get("merge_commit_sha") == merged_sha
            and (pull.get("base") or {}).get("ref") == "main"
            and ((pull.get("base") or {}).get("repo") or {}).get("full_name") == repository
            and ((pull.get("head") or {}).get("repo") or {}).get("full_name") == repository
        ):
            pulls.append(pull)
    _require(len(pulls) == 1, "M 必须关联唯一同仓库 main squash PR")
    pull = pulls[0]
    number = pull.get("number")
    base_sha = _sha((pull.get("base") or {}).get("sha"), "B")
    head_sha = _sha((pull.get("head") or {}).get("sha"), "H")

    checks = _check_pages(repository, head_sha, token, request_fn)
    candidates: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for check in checks:
        if (
            check.get("name") != CHECK_NAME
            or check.get("head_sha") != head_sha
            or str((check.get("app") or {}).get("id")) != str(app_id_int)
            or check.get("conclusion") != "success"
            or not isinstance(check.get("id"), int)
            or check.get("id") <= 0
        ):
            continue
        proof_text = (check.get("output") or {}).get("text")
        if not isinstance(proof_text, str):
            continue
        try:
            proof = parse_strict_json(proof_text)
            validate_proof(
                proof,
                repository=repository,
                head_sha=head_sha,
                base_sha=base_sha,
                workflow_sha=proof.get("workflowSha"),
                run_id=proof.get("runId"),
                run_attempt=proof.get("runAttempt"),
                app_id=app_id_int,
                gate_names=REQUIRED_GATES,
                sdk_source_sha=proof.get("sdkSourceSha"),
                contract_source_sha=proof.get("contractSourceSha"),
            )
        except (ContractError, TypeError, ValueError):
            continue
        candidates.append((check, proof))
    _require(candidates, "M 缺少唯一成功的 Qualification App 证明")
    # 同一 H 允许历史重跑；只选择 check id 最大的成功证明，再由 verify_merged_candidate
    # 重新读取 run、attempt、Gate 和 squash 树，避免使用旧的字符串输出作凭据。
    candidates.sort(key=lambda item: int(item[0].get("id", 0)))
    check, proof = candidates[-1]
    check_id = check.get("id")
    result = verify_merged_candidate(
        repository,
        number,
        merged_sha,
        base_sha,
        head_sha,
        str(check_id),
        app_id_int,
        proof["runId"],
        token,
        request_fn=request_fn,
    )
    result["prNumber"] = int(number)
    result["qualificationAppId"] = app_id_int
    return result


def _read_release_cursor(repository: str, token: str, *, request_fn: RequestFn | None = None) -> str:
    response = github_request("GET", f"/repos/{repository}/contents/.release-state.json?ref=main", token, request_fn=request_fn)
    _require(isinstance(response, dict) and response.get("encoding") == "base64", "main .release-state.json API 响应无效")
    content = response.get("content")
    _require(isinstance(content, str), "main .release-state.json 缺少内容")
    try:
        state = json.loads(decode_contents_base64(content).decode("utf-8"))
    except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise QualificationError("main .release-state.json 不是有效 JSON") from exc
    _require(isinstance(state, dict), "main .release-state.json 根节点必须是对象")
    return _sha(state.get("sourceCommit"), "发行 source cursor S")


def _first_parent_chain(
    repository: str,
    start_sha: str,
    stop_sha: str,
    token: str,
    *,
    request_fn: RequestFn | None = None,
) -> list[tuple[str, str, list[str]]]:
    chain: list[tuple[str, str, list[str]]] = []
    current = _sha(start_sha, "main head")
    stop_sha = _sha(stop_sha, "发行 source cursor S")
    for _ in range(1000):
        if current == stop_sha:
            return list(reversed(chain))
        commit = github_request("GET", f"/repos/{repository}/commits/{current}", token, request_fn=request_fn)
        _require(isinstance(commit, dict), "main commit API 返回不是对象")
        parents = commit.get("parents")
        _require(isinstance(parents, list) and len(parents) == 1 and isinstance(parents[0], dict), "main first-parent 链必须是线性提交")
        parent = _sha(parents[0].get("sha"), "main first-parent")
        files = commit.get("files")
        _require(isinstance(files, list) and len(files) < 300, "main commit 文件列表不完整，拒绝猜测生成物范围")
        paths: list[str] = []
        for item in files:
            _require(isinstance(item, dict) and isinstance(item.get("filename"), str), "main commit 文件记录无效")
            paths.append(item["filename"].replace("\\", "/"))
            previous = item.get("previous_filename")
            if isinstance(previous, str):
                paths.append(previous.replace("\\", "/"))
        chain.append((current, parent, paths))
        current = parent
    raise QualificationError("main 待发布 first-parent 链超过 1000 个提交")


def resolve_main_queue(
    repository: str,
    merged_sha: str,
    app_id: int | str,
    token: str,
    *,
    request_fn: RequestFn | None = None,
) -> dict[str, Any]:
    """依据 stable source cursor S 复核所有未发布源码提交，返回最新候选证明。"""

    repository = _repository(repository)
    merged_sha = _sha(merged_sha, "main head M")
    main_ref = github_request("GET", f"/repos/{repository}/git/ref/heads/main", token, request_fn=request_fn)
    _require(_ref_sha(main_ref, "当前 main") == merged_sha, "main 已前进，当前 push 事件不是最新 head")
    cursor = _read_release_cursor(repository, token, request_fn=request_fn)
    chain = _first_parent_chain(repository, merged_sha, cursor, token, request_fn=request_fn)
    generated_prefixes = ("catalog.json", ".release-state.json", "packages/")
    source_proofs: list[dict[str, Any]] = []
    for commit_sha, _parent, paths in chain:
        if paths and all(path == generated_prefixes[0] or path == generated_prefixes[1] or path.startswith(generated_prefixes[2]) for path in paths):
            continue
        source_proofs.append(resolve_merged_candidate(repository, commit_sha, app_id, token, request_fn=request_fn, require_current_main=False))
    _require(source_proofs, "main source cursor 已追平，没有可发布的源码资格")
    latest = source_proofs[-1]
    latest["sourceCursor"] = cursor
    latest["pendingSourceShas"] = [item["mergedSha"] for item in source_proofs]
    return latest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Plugin Release Qualification 的远端控制器策略入口")
    parser.add_argument("--print-policy", action="store_true", help="输出固定 gate 和官方仓库策略，不执行网络请求")
    sub = parser.add_subparsers(dest="command")
    preflight = sub.add_parser("preflight")
    preflight.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    preflight.add_argument("--pr-number", required=True)
    preflight.add_argument("--expected-head-sha", required=True)
    preflight.add_argument("--workflow-sha", required=True)
    preflight.add_argument("--contract-sha")
    preflight.add_argument("--app-id")
    preflight.add_argument("--run-id")
    preflight.add_argument("--run-attempt")
    preflight.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    begin = sub.add_parser("begin")
    begin.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    begin.add_argument("--head-sha", required=True)
    begin.add_argument("--app-id", required=True)
    begin.add_argument("--base-sha", required=True)
    begin.add_argument("--workflow-sha", required=True)
    begin.add_argument("--run-id", required=True)
    begin.add_argument("--run-attempt", required=True)
    begin.add_argument("--association-json", default="{}")
    begin.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    finish = sub.add_parser("finish")
    finish.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    finish.add_argument("--pr-number", required=True)
    finish.add_argument("--head-sha", required=True)
    finish.add_argument("--base-sha", required=True)
    finish.add_argument("--workflow-sha", required=True)
    finish.add_argument("--run-id", required=True)
    finish.add_argument("--run-attempt", required=True)
    finish.add_argument("--check-id", required=True)
    finish.add_argument("--app-id", required=True)
    finish.add_argument("--sdk-source-sha", required=True)
    finish.add_argument("--contract-source-sha", required=True)
    finish.add_argument("--workflow-path", default=WORKFLOW_PATH)
    finish.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    verify = sub.add_parser("verify-merged")
    verify.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    verify.add_argument("--pr-number", required=True)
    verify.add_argument("--merged-sha", required=True)
    verify.add_argument("--base-sha", required=True)
    verify.add_argument("--head-sha", required=True)
    verify.add_argument("--check-id", required=True)
    verify.add_argument("--app-id", required=True)
    verify.add_argument("--run-id", required=True)
    verify.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    resolve = sub.add_parser("resolve-merged")
    resolve.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    resolve.add_argument("--merged-sha", required=True)
    resolve.add_argument("--app-id", required=True)
    resolve.add_argument("--allow-noncurrent", action="store_true")
    resolve.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    queue = sub.add_parser("resolve-main-queue")
    queue.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    queue.add_argument("--merged-sha", required=True)
    queue.add_argument("--app-id", required=True)
    queue.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    compatibility = sub.add_parser("compatibility")
    compatibility.add_argument("--repository", default=OFFICIAL_PLUGINS_REPOSITORY)
    compatibility.add_argument("--candidate-sha", required=True)
    compatibility.add_argument("--token-env", default="QUALIFICATION_TOKEN")
    args = parser.parse_args(argv)
    if args.print_policy:
        print(json.dumps({"checkName": CHECK_NAME, "gates": REQUIRED_GATES, "repositories": sorted(OFFICIAL_REPOSITORIES)}, ensure_ascii=False))
    elif args.command == "preflight":
        token = os.environ.get(args.token_env)
        candidate = resolve_candidate(args.repository, args.expected_head_sha, args.workflow_sha, token)
        contract = resolve_contract_input(args.repository, token, candidate_sha=args.contract_sha)
        result = {**candidate, **contract, "prNumber": int(args.pr_number)}
        read_pull_request(args.repository, args.pr_number, args.expected_head_sha, token)
        if args.app_id:
            if args.run_id is None or args.run_attempt is None:
                raise QualificationError("preflight 创建 check 必须提供 run-id/run-attempt")
            result["checkId"] = begin_check(
                args.repository,
                args.expected_head_sha,
                args.app_id,
                token or "",
                result,
                base_sha=result["baseSha"],
                workflow_sha=result["workflowSha"],
                run_id=args.run_id,
                run_attempt=args.run_attempt,
            )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    elif args.command == "begin":
        try:
            association = json.loads(args.association_json)
        except json.JSONDecodeError as exc:
            raise QualificationError(f"association JSON 无效：{exc}") from exc
        check_id = begin_check(
            args.repository,
            args.head_sha,
            args.app_id,
            os.environ.get(args.token_env, ""),
            association,
            base_sha=args.base_sha,
            workflow_sha=args.workflow_sha,
            run_id=args.run_id,
            run_attempt=args.run_attempt,
        )
        print(check_id)
    elif args.command == "finish":
        result = finish_check(
            args.repository,
            args.pr_number,
            args.head_sha,
            args.base_sha,
            args.workflow_sha,
            args.run_id,
            args.check_id,
            args.app_id,
            args.sdk_source_sha,
            args.contract_source_sha,
            os.environ.get(args.token_env, ""),
            run_attempt=args.run_attempt,
            workflow_path=args.workflow_path,
        )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, default=str))
        if result.get("conclusion") != "success":
            return 1
    elif args.command == "compatibility":
        value = resolve_candidate_compatibility(args.repository, args.candidate_sha, os.environ.get(args.token_env))
        print(json.dumps(value, ensure_ascii=False, sort_keys=True))
    elif args.command == "verify-merged":
        result = verify_merged_candidate(
            args.repository,
            args.pr_number,
            args.merged_sha,
            args.base_sha,
            args.head_sha,
            args.check_id,
            args.app_id,
            args.run_id,
            os.environ.get(args.token_env, ""),
        )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    elif args.command == "resolve-merged":
        result = resolve_merged_candidate(
            args.repository,
            args.merged_sha,
            args.app_id,
            os.environ.get(args.token_env, ""),
            require_current_main=not args.allow_noncurrent,
        )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    elif args.command == "resolve-main-queue":
        result = resolve_main_queue(
            args.repository,
            args.merged_sha,
            args.app_id,
            os.environ.get(args.token_env, ""),
        )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except QualificationError as exc:
        print(f"[qualification-control] 错误：{exc}", file=sys.stderr)
        raise SystemExit(1) from exc
