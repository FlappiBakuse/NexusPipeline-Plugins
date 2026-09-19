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
from sdk_source import SdkSourceError, validate_host_checkout


def _host_head(host_root: Path) -> str:
    return core.git_head(host_root)


def _preflight(root: Path, host_root: Path, sdk_sha: str | None) -> dict[str, Any]:
    compatibility = core.read_host_compatibility(root)
    resolved_sha = sdk_sha or _host_head(host_root)
    result = validate_host_checkout(host_root, resolved_sha, compatibility)
    print(f"[qualification] SDK preflight 通过：{resolved_sha}", flush=True)
    return result


def run_source_gate(root: Path, host_root: Path, base: str) -> dict[str, Any]:
    count, json_count = core.validate_sources(root)
    locales = core.validate_host_locale_registry(root, host_root)
    syntax = core.check_syntax(root)
    core._run(("node", str(root / "tools" / "Test-ConfigEditors.mjs")), "Test-ConfigEditors", root)
    core._run((sys.executable, "-m", "unittest", "discover", "-s", "tools/tests", "-v"), "Plugins Python 单元测试", root)
    changed = core.check_pr(root, base)
    return {
        "plugins": count,
        "jsonFiles": json_count,
        "locales": locales,
        "syntaxFiles": syntax,
        "changedPaths": changed,
    }


def run_managed_gate(root: Path) -> dict[str, Any]:
    if (root / "package-lock.json").is_file():
        core._run((core._npm_executable(), "ci", "--no-audit", "--no-fund"), "Plugins 根 workspace npm ci", root)
    frontend = root / "tools" / "Test-FrontendPlugins.mjs"
    if frontend.is_file():
        core._run(("node", str(frontend)), "前端插件 conformance", root)
    if (root / "package.json").is_file():
        core._run((core._npm_executable(), "run", "typecheck:frontend"), "managed frontend typecheck", root)
        core._run((core._npm_executable(), "run", "build:frontend"), "managed frontend build", root)
    managed_projects = core.test_managed(root, full=True, include_frontend=False)
    return {"managedProjectsAndTests": managed_projects}


def _verify_unchanged_stable(root: Path, candidate: Path) -> None:
    old_catalog = core.read_json(root / "catalog.json")
    candidate_catalog = core.read_json(candidate / "catalog.json")
    old_entries = core._catalog_entry_by_artifact(old_catalog)
    new_entries = core._catalog_entry_by_artifact(candidate_catalog)
    plan = core.read_json(candidate / "release-plan.json")
    changed = set(plan.get("requiresPackage", [])) | set(plan.get("deleted", []))
    for artifact, entry in old_entries.items():
        if artifact in changed:
            continue
        _require_same = new_entries.get(artifact) == entry
        if not _require_same:
            raise core.RepositoryError(f"未变更 stable catalog entry 被修改：{artifact}")
        package = root / "packages" / artifact / f"{artifact}-{entry['version']}.zip"
        if package.is_file():
            if core.sha256(package) != entry.get("sha256") or package.stat().st_size != entry.get("sizeBytes"):
                raise core.RepositoryError(f"现有 stable 包与 catalog 发行事实不一致：{artifact}")


def run_candidate_gate(root: Path, host_root: Path, base: str, output: Path, baseline: str = "auto") -> dict[str, Any]:
    core.validate_candidate_against_base(root, base)
    plan = core.build_plan(root, baseline)
    output = output.resolve()
    plan_path = output.parent / f"{output.name}-plan.json"
    core.write_json(plan_path, plan)
    generated = core.release(root, plan_path, output)
    core.validate_generated(root, output)
    _verify_unchanged_stable(root, output)
    return {
        "candidate": str(output),
        "requiresPackage": list(generated["plan"].get("requiresPackage", [])),
        "deleted": list(generated["plan"].get("deleted", [])),
        "sdkSourceSha": None,
    }


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
    host_root = (host_root or root.parent / "NexusPipeline").resolve()
    if group not in {"source", "frontend-managed", "candidate", "all"}:
        raise core.RepositoryError(f"Qualification group 无效：{group}")
    preflight = _preflight(root, host_root, sdk_sha)
    result: dict[str, Any] = {"group": group, "sdkSourceSha": preflight["sdkSourceSha"]}
    if group in {"source", "all"}:
        result["source"] = run_source_gate(root, host_root, base)
    if group in {"frontend-managed", "all"}:
        result["frontend-managed"] = run_managed_gate(root)
    if group in {"candidate", "all"}:
        candidate_output = output or root / ".generated" / "qualification-candidate"
        candidate = run_candidate_gate(root, host_root, base, candidate_output, baseline)
        candidate["sdkSourceSha"] = preflight["sdkSourceSha"]
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
