"""Source and managed checks shared by fast verification and the migration Gate."""

from __future__ import annotations

import os
import json
import re
import sys
import unittest
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

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
    core._run((sys.executable, str(root / "tools" / "create_task_plugin.py"), "--artifact", "TaskProtocolExample",
               "--name", "task-protocol-example", "--example", "--check", "--output", str(root / "examples" / "TaskProtocolExample")), "Generated author example", root)
    for preset in ("json-map", "json-parallel-array", "yaml", "mxu"):
        artifact = "TaskProtocol" + "".join(part.title() for part in preset.split("-"))
        core._run((sys.executable, str(root / "tools" / "create_task_plugin.py"), "--artifact", artifact,
                   "--name", "task-protocol-" + preset, "--preset", preset, "--example", "--check",
                   "--output", str(root / "examples" / artifact)), "Generated " + preset + " example", root)
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
            "Plugins Python 单元测试结果不完整："
            f"testsRun={tests_run} failures={failures} errors={errors} skipped={skipped} "
            f"unexpectedSuccesses={unexpected_successes}")
    return {"testsRun": tests_run, "failures": failures, "errors": errors, "skipped": skipped,
            "unexpectedSuccesses": unexpected_successes}


def managed_selection(root: Path, base: str) -> tuple[list[str], str]:
    """Select managed projects from the complete PR diff, including rename endpoints."""
    records = core.changed_paths(root, core.git_commit(root, base), core.git_head(root))
    if not records:
        raise core.RepositoryError("verify 变更范围为空；不能把零选择当作验证通过")
    plugins = core.discover_source_plugins(root)
    by_root = {plugin.root.relative_to(root).as_posix(): plugin for plugin in plugins}
    all_managed = {plugin.artifact_name for plugin in plugins if plugin.kind == "managed-code"}
    selected: set[str] = set()
    expand = False
    for _status, paths in records:
        for path in paths:
            normalized = path.replace("\\", "/")
            plugin_root = core.plugin_root_from_path(normalized)
            if plugin_root is not None:
                plugin = by_root.get(plugin_root)
                if plugin is not None and plugin.kind == "managed-code":
                    selected.add(plugin.artifact_name)
                elif plugin is None:
                    expand = True  # Deleted or renamed source with unknown ownership.
            elif normalized in {"README.md", "CONTRIBUTING.md", "AGENTS.md"} or normalized.startswith("docs/"):
                continue
            else:
                expand = True  # Shared build inputs, tests, workflows and unknown paths.
    if expand:
        return sorted(all_managed), "shared-or-unknown-input"
    if selected:
        return sorted(selected), "changed-managed-plugin"
    return [], "no-managed-impact"


def fast_scope(root: Path, base: str) -> dict[str, Any]:
    records = core.changed_paths(root, core.git_commit(root, base), core.git_head(root))
    paths = [path.replace("\\", "/") for _status, endpoints in records for path in endpoints]
    if not paths:
        raise core.RepositoryError("PR 变更范围为空；不能声明 docs-only 或 fast 已验证")
    docs_only = all(path in {"README.md", "CONTRIBUTING.md"} or path.startswith("docs/") for path in paths)
    return {"docsOnly": docs_only, "changedPaths": len(paths)}


def run_docs_gate(root: Path, base: str) -> dict[str, Any]:
    scope = fast_scope(root, base)
    if not scope["docsOnly"]:
        raise core.RepositoryError("docs 验证仅适用于已确认的纯文档变更")
    try:
        index = json.loads((root / "docs" / "map.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise core.RepositoryError(f"docs/map.json 无法读取或解析：{exc}") from exc
    topics = index.get("topics") if isinstance(index, dict) else None
    if not isinstance(index, dict) or index.get("schemaVersion") != 1 or not isinstance(topics, list) or not topics:
        raise core.RepositoryError("docs/map.json 结构无效或为空")
    mapped: set[str] = set()
    for topic in topics:
        if not isinstance(topic, dict) or not isinstance(topic.get("path"), str):
            raise core.RepositoryError("docs/map.json 含无效专题路径")
        relative = topic["path"]
        resolved = (root / "docs" / relative).resolve()
        if resolved == root.resolve() or root.resolve() not in resolved.parents:
            raise core.RepositoryError(f"docs/map.json 路径越界：{relative}")
        normalized = resolved.relative_to(root.resolve()).as_posix()
        if normalized in mapped:
            raise core.RepositoryError(f"docs/map.json 路径重复：{relative}")
        mapped.add(normalized)
        if not resolved.is_file():
            raise core.RepositoryError(f"docs/map.json 指向缺失文件：{relative}")
    checked = 0
    pattern = re.compile(r"!?(?:\[[^\]]*\])\(([^)]+)\)")
    for document in [root / "README.md", root / "CONTRIBUTING.md", *(root / "docs").rglob("*.md")]:
        text = document.read_text(encoding="utf-8")
        for match in pattern.finditer(text):
            target = match.group(1).strip().split(" ", 1)[0].strip("<>")
            if not target or target.startswith("#"):
                continue
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                continue
            relative = unquote(parsed.path)
            if not relative:
                continue
            resolved = (document.parent / relative).resolve()
            if not resolved.exists() or root.resolve() not in resolved.parents:
                raise core.RepositoryError(f"文档链接无效：{document.relative_to(root)} -> {target}")
            checked += 1
    return {"mappedTopics": len(mapped), "localLinks": checked, **scope}


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
    needs_frontend = selected is None or any((by_artifact[artifact].root / "frontend").is_dir() for artifact in selected)
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
