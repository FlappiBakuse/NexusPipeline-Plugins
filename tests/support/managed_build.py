from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Iterable

import tools.repository.package as repository_package



def capture_managed_build_artifacts(root: Path, host_root: Path | None = None) -> set[Path]:
    """记录当前不存在的构建目录；只允许删除本次运行创建的精确路径。"""
    directories = {path.parent for path in (root / "plugins").rglob("*.csproj")}
    if host_root is not None:
        resolved_host_root = repository_package._find_host_root(root, host_root)
        directories.add(resolved_host_root / "src" / "NexusPipeline.Plugin.Abstractions")
    return {
        directory / name
        for directory in directories
        for name in ("bin", "obj")
        if not (directory / name).exists()
    }


def cleanup_managed_build_artifacts(owned_paths: Iterable[Path]) -> None:
    """删除本次工具运行新建的精确 bin/obj 目录，保留用户既有目录。"""
    for target in sorted({path.resolve() for path in owned_paths}, key=str, reverse=True):
        if target.is_dir():
            shutil.rmtree(target)
