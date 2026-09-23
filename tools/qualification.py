"""Plugins P1/P2/P3 Qualification 编排。

每个 Gate 都使用同一个 Host checkout/SHA。这里仅编排本地验证和候选生成，
不写 Git、不提交、不推送，也不持有远端发布凭据。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import repository_core as core
from candidate_workspace import CandidateWorkspace
from sdk_source import SdkSourceError
from verification import preflight, run_managed_gate, run_source_gate


def run_candidate_gate(root: Path, host_root: Path, base: str, output: Path, baseline: str = "auto") -> dict[str, Any]:
    workspace = CandidateWorkspace.create(root, base)
    output = output.resolve()
    plan_path = output.parent / f"{output.name}-plan.json"
    try:
        core.validate_candidate_against_base(
            root,
            workspace.base_sha,
            head=workspace.source_sha,
            distribution_root=workspace.distribution_root,
        )
        plan = core.build_plan(
            root,
            baseline,
            workspace.source_sha,
            distribution_root=workspace.distribution_root,
        )
        core.write_json(plan_path, plan)
        generated = core.release(
            root,
            plan_path,
            output,
            host_root=host_root,
            distribution_root=workspace.distribution_root,
        )
        core.validate_generated(root, output, distribution_root=workspace.distribution_root)
        core.verify_unchanged_stable(root, output, workspace.distribution_root)
        return {
            "candidate": str(output),
            "requiresPackage": list(generated["plan"].get("requiresPackage", [])),
            "deleted": list(generated["plan"].get("deleted", [])),
            "sourceSha": workspace.source_sha,
            "baseSha": workspace.base_sha,
            "stateSourceSha": workspace.state_source_sha,
        }
    finally:
        if output.exists():
            # 保留候选本身供 Qualification 结果和发布器消费；只释放 B 的隔离分发目录。
            pass
        workspace.cleanup()


def run_qualification(
    root: Path,
    group: str,
    *,
    base: str = "main",
    host_root: Path | None = None,
    sdk_sha: str | None = None,
    output: Path | None = None,
    baseline: str = "auto",
) -> dict[str, Any]:
    root = root.resolve()
    if host_root is None:
        raise core.RepositoryError("Qualification 必须显式指定 --host-root")
    host_root = host_root.resolve()
    if group not in {"source", "frontend-managed", "candidate", "all"}:
        raise core.RepositoryError(f"Qualification group 无效：{group}")
    sdk = preflight(root, host_root, sdk_sha)
    result: dict[str, Any] = {"group": group, "sdkSourceSha": sdk["sdkSourceSha"]}
    if group in {"source", "all"}:
        result["source"] = run_source_gate(root, host_root, base)
    if group in {"frontend-managed", "all"}:
        result["frontend-managed"] = run_managed_gate(root, host_root)
    if group in {"candidate", "all"}:
        candidate_output = output or root / ".generated" / "qualification-candidate"
        candidate = run_candidate_gate(root, host_root, base, candidate_output, baseline)
        candidate["sdkSourceSha"] = sdk["sdkSourceSha"]
        result["candidate"] = candidate
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    return result


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="NexusPipeline-Plugins Qualification")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--group", choices=("source", "frontend-managed", "candidate", "all"), default="all")
    parser.add_argument("--base", default="main")
    parser.add_argument("--host-root", type=Path)
    parser.add_argument("--sdk-sha")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--baseline", default="auto")
    args = parser.parse_args(argv)
    core.configure_console()
    try:
        run_qualification(
            args.root,
            args.group,
            base=args.base,
            host_root=args.host_root,
            sdk_sha=args.sdk_sha,
            output=args.output,
            baseline=args.baseline,
        )
    except (core.RepositoryError, SdkSourceError) as exc:
        print(f"[qualification] 错误：{exc}", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
