"""发布候选的本地安全编排。

本模块只生成和验证数据候选。真正的 GitHub Release/catalog/state 写入必须在
受保护 publisher runner 使用独立适配器执行，并显式传入 remote-write；本地
开发工具不会因为误运行而产生远端副作用。
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import repository_core as core


def publish_develop(
    root: Path,
    source_ref: str = "develop",
    output: Path | None = None,
    *,
    remote_write: bool = False,
) -> dict[str, Any]:
    if remote_write:
        raise core.RepositoryError("本地 publish-develop 不执行 remote write；请使用受保护 publisher 适配器")
    result = core.build_preview(root, source_ref, output)
    print(f"[publisher] develop preview 候选已生成（未写远端）：{result['output']}", flush=True)
    return result


def publish_stable(
    root: Path,
    source_sha: str,
    generated_root: Path,
    *,
    remote_write: bool = False,
) -> dict[str, Any]:
    if remote_write:
        raise core.RepositoryError("本地 publish-stable 不执行 remote write；请使用受保护 publisher 适配器")
    generated_root = generated_root.resolve()
    core.validate_generated(root, generated_root)
    plan = core.read_json(generated_root / "release-plan.json")
    core._require(plan.get("head") == source_sha, f"stable 候选 source SHA 不一致：{plan.get('head')} / {source_sha}")
    result = {"sourceCommit": source_sha, "generatedRoot": str(generated_root), "remoteWritten": False}
    print(f"[publisher] stable 候选校验通过（未写远端）：{generated_root}", flush=True)
    return result
