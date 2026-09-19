"""受信任发布编排使用的 Git 适配器。

候选构建仍在 repository_core/repository_publish 中完成；本模块只接受参数列表，
不通过 shell 拼接命令，并把写操作放在显式 remote_write 保护后。
"""

from __future__ import annotations

import subprocess
from pathlib import Path


class GitAdapterError(RuntimeError):
    """Git 事实读取或受保护写入失败。"""


def run_git(root: Path, *arguments: str, remote_write: bool = False) -> str:
    """执行固定参数 Git 命令；写入命令必须显式 remote_write。"""
    command = tuple(arguments)
    writes_remote = command[:1] == ("push",) or command[:2] == ("remote", "set-url")
    if writes_remote and not remote_write:
        raise GitAdapterError("Git remote write 需要显式 remote_write=True")
    result = subprocess.run(
        ("git", *command),
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise GitAdapterError(f"git {' '.join(command)} 失败（{result.returncode}）：{detail}")
    return result.stdout.strip()


def head(root: Path) -> str:
    return run_git(root, "rev-parse", "HEAD")


def remote_head(root: Path, remote: str = "origin", branch: str = "main") -> str:
    output = run_git(root, "ls-remote", remote, f"refs/heads/{branch}")
    value = output.split()[0] if output else ""
    if len(value) != 40:
        raise GitAdapterError(f"远端 {remote}/{branch} 未返回完整 commit SHA")
    return value


def is_ancestor(root: Path, ancestor: str, descendant: str) -> bool:
    result = subprocess.run(
        ("git", "merge-base", "--is-ancestor", ancestor, descendant),
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode not in (0, 1):
        raise GitAdapterError((result.stderr or result.stdout).strip() or "merge-base 检查失败")
    return result.returncode == 0


def verify_fast_forward(root: Path, expected_remote: str, local: str) -> None:
    actual = remote_head(root)
    if actual != expected_remote:
        raise GitAdapterError(f"远端基线已变化：期望 {expected_remote}，实际 {actual}")
    if not is_ancestor(root, actual, local):
        raise GitAdapterError("候选不是远端 HEAD 的正常快进后继")


def push_fast_forward(root: Path, expected_remote: str, local: str, *, remote_write: bool = False) -> str:
    if not remote_write:
        raise GitAdapterError("推送需要显式 remote_write=True")
    verify_fast_forward(root, expected_remote, local)
    return run_git(root, "push", "origin", f"{local}:refs/heads/main", remote_write=True)
