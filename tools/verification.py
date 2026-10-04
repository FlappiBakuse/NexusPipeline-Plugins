"""Source and managed checks shared by PR verification and the release candidate."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from typing import Any

import repository_core as core
from sdk_source import SdkSourceError, validate_host_checkout


def preflight(root: Path, host_root: Path, sdk_sha: str | None) -> dict[str, Any]:
    compatibility = core.read_host_compatibility(root)
    resolved_sha = sdk_sha or core.git_head(host_root)
    result = validate_host_checkout(host_root, resolved_sha, compatibility)
    if result.get("workingTreeDirty"):
        raise SdkSourceError("正式验证不接受 dirty Host SDK checkout；请提供固定的干净 Host checkout")
    print(f"[verify] SDK preflight 通过：{resolved_sha}", flush=True)
    return result


def run_source_gate(root: Path, host_root: Path, base: str) -> dict[str, Any]:
    count, json_count = core.validate_sources(root)
    locales = core.validate_host_locale_registry(root, host_root)
    syntax = core.check_syntax(root)
    core._run((sys.executable, str(root / "tools" / "generate_task_protocol.py"), "--check"), "Task adapter generation", root)
    core._run((sys.executable, str(root / "tools" / "generate_task_schema.py"), "--check"), "Task protocol schema", root)
    core._run((sys.executable, str(root / "tools" / "generate_config_editors.py"), "--check"), "Config editor generation", root)
    core._run(("node", str(root / "tools" / "Test-ConfigEditors.mjs")), "Test-ConfigEditors", root)
    python_tests = run_python_unit_gate(root)
    changed = core.check_pr(root, base)
    return {"plugins": count, "jsonFiles": json_count, "locales": locales,
            "syntaxFiles": syntax, "pythonTests": python_tests, "changedPaths": changed}


def run_python_unit_gate(root: Path) -> dict[str, int]:
    """运行标准库 unittest，并把原生结果计数作为 gate 语义。"""
    suite = unittest.defaultTestLoader.discover(str(root / "tools" / "tests"))
    result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
    tests_run = int(result.testsRun)
    failures = len(result.failures)
    errors = len(result.errors)
    skipped = len(result.skipped)
    unexpected_successes = len(result.unexpectedSuccesses)
    if tests_run <= 0:
        raise core.RepositoryError("Plugins Python 单元测试发现零用例")
    if not result.wasSuccessful() or skipped:
        raise core.RepositoryError(
            "Plugins Python 单元测试失败："
            f"testsRun={tests_run} failures={failures} errors={errors} skipped={skipped} "
            f"unexpectedSuccesses={unexpected_successes}")
    return {"testsRun": tests_run, "failures": failures, "errors": errors, "skipped": skipped,
            "unexpectedSuccesses": unexpected_successes}


def managed_selection(root: Path, base: str) -> tuple[list[str], str]:
    """按完整 diff 选择 managed 插件；未知共享输入保守扩大。"""
    records = core.changed_paths(root, core.git_commit(root, base), core.git_head(root))
    if not records:
        raise core.RepositoryError("verify 变更范围为空；不能把零选择当作验证通过")
    plugins = core.discover_source_plugins(root)
    by_root = {plugin.root.relative_to(root).as_posix(): plugin for plugin in plugins}
    selected: set[str] = set()
    all_managed = sorted(plugin.artifact_name for plugin in plugins if plugin.kind == "managed-code")
    for _status, paths in records:
        for path in paths:
            normalized = path.replace("\\", "/")
            plugin_root = core.plugin_root_from_path(normalized)
            if plugin_root is None:
                if normalized.startswith("docs/") and normalized.endswith(".md"):
                    continue
                if normalized in {"README.md", "CONTRIBUTING.md", "CHANGELOG.md"}:
                    continue
                return all_managed, "shared-or-unknown-input"
            plugin = by_root.get(plugin_root)
            if plugin is None:
                return all_managed, "removed-or-renamed-plugin"
            if plugin is not None and plugin.kind == "managed-code":
                selected.add(plugin.artifact_name)
    if selected:
        return sorted(selected), "changed-managed-plugin"
    return [], "no-managed-impact"



def run_managed_gate(
    root: Path,
    host_root: Path,
    *,
    selected: list[str] | None = None,
    host_integration: bool = True,
) -> dict[str, Any]:
    if selected is not None and not selected:
        return {"managedBuilds": 0, "managedTestProjects": 0, "managedTestCases": 0,
                "selected": [], "applicability": "not-applicable"}
    if host_integration:
        core._run(("dotnet", "run", "--project", str(host_root / "tools" / "NexusPipeline.TaskProtocolTests"),
                   "--", "--plugin-root", str(root)), "Production task adapters through Host Jint", root)
    by_artifact = {plugin.artifact_name: plugin for plugin in core.discover_source_plugins(root)}
    needs_frontend = selected is None or any(
        (by_artifact[artifact].root / "frontend").is_dir()
        or bool(by_artifact[artifact].manifest.get("frontend"))
        for artifact in selected)
    if needs_frontend:
        if (root / "package-lock.json").is_file():
            core._run((core._npm_executable(), "ci", "--no-audit", "--no-fund"), "Plugins 根 workspace npm ci", root)
        frontend = root / "tools" / "Test-FrontendPlugins.mjs"
        if (root / "package.json").is_file():
            core._run((core._npm_executable(), "run", "typecheck:frontend"), "managed frontend typecheck", root)
            core._run((core._npm_executable(), "run", "build:frontend"), "managed frontend build", root)
        if frontend.is_file():
            environment = os.environ.copy()
            environment["NEXUS_HOST_ROOT"] = str(host_root)
            environment["NEXUS_OFFICIAL_PLUGINS_ROOT"] = str(root)
            core._run(("node", str(frontend), "--host-root", str(host_root)), "前端插件 conformance", root, env=environment)
    managed = core.test_managed(
        root,
        {"managed": selected} if selected is not None else None,
        full=selected is None,
        include_frontend=False,
        host_root=host_root,
    )
    return {"managedBuilds": managed["builds"],
            "managedTestProjects": managed["testProjects"],
            "managedTestCases": managed["testCases"],
            "selected": selected if selected is not None else sorted(plugin.artifact_name for plugin in by_artifact.values() if plugin.kind == "managed-code"),
            "applicability": "required"}
