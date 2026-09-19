"""为 Plugins P3 固定 H/B/S 输入，隔离源码与稳定发行事实。"""

from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path

import repository_core as core


FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
GENERATED_PREFIXES = ("catalog.json", core.STATE_FILE, "packages/")


class CandidateWorkspaceError(core.RepositoryError):
    """H/B 候选输入不满足资格边界。"""


@dataclass(frozen=True)
class CandidateWorkspace:
    """H 为当前候选源码，distribution_root 为从 B 提取的稳定事实。"""

    source_root: Path
    distribution_root: Path
    source_sha: str
    base_sha: str
    state_source_sha: str
    _sandbox: Path

    @classmethod
    def create(cls, source_root: Path, base: str = "main") -> "CandidateWorkspace":
        source_root = source_root.resolve()
        source_sha = core.git_head(source_root)
        base_sha = core.git_commit(source_root, base)
        cls._reject_generated_changes(source_root, base_sha, source_sha)

        sandbox = Path(tempfile.mkdtemp(prefix="nxp-candidate-workspace-"))
        distribution_root = sandbox / "distribution"
        distribution_root.mkdir(parents=True)
        try:
            cls._extract_distribution(source_root, base_sha, distribution_root)
            catalog = core.read_json(distribution_root / "catalog.json")
            state = core.load_state(distribution_root)
            state_source_sha = state.get("sourceCommit")
            if not isinstance(state_source_sha, str) or FULL_SHA.fullmatch(state_source_sha) is None:
                raise CandidateWorkspaceError("B 的 .release-state.json.sourceCommit 必须是完整 commit SHA")
            if not cls._is_ancestor(source_root, state_source_sha, source_sha):
                raise CandidateWorkspaceError("B 的发行 sourceCommit 不是 H 的允许祖先")
            if not isinstance(catalog, dict):
                raise CandidateWorkspaceError("B 的 catalog.json 必须是对象")
            return cls(source_root, distribution_root, source_sha, base_sha, state_source_sha, sandbox)
        except Exception:
            shutil.rmtree(sandbox, ignore_errors=False)
            raise

    def cleanup(self) -> None:
        """只清理本次 nonce sandbox；调用方可在失败时保留现场。"""
        if self._sandbox.is_dir():
            shutil.rmtree(self._sandbox)

    @staticmethod
    def _reject_generated_changes(root: Path, base_sha: str, source_sha: str) -> None:
        for status, paths in core.changed_paths(root, base_sha, source_sha):
            for path in paths:
                normalized = path.replace("\\", "/")
                if normalized == "catalog.json" or normalized == core.STATE_FILE or normalized.startswith("packages/"):
                    raise CandidateWorkspaceError(
                        f"候选 H 不得人工修改发行生成物：{status} {normalized}"
                    )

    @staticmethod
    def _extract_distribution(root: Path, commit: str, destination: Path) -> None:
        command = ["git", "archive", "--format=tar", commit, "catalog.json", core.STATE_FILE, "packages"]
        completed = subprocess.run(
            command,
            cwd=root,
            check=False,
            capture_output=True,
        )
        if completed.returncode != 0:
            detail = completed.stderr.decode("utf-8", errors="replace").strip()
            raise CandidateWorkspaceError(f"从 B 提取稳定发行事实失败：{detail}")
        try:
            with tarfile.open(fileobj=io.BytesIO(completed.stdout), mode="r:") as archive:
                for member in archive.getmembers():
                    name = member.name.replace("\\", "/")
                    if name.startswith("/") or any(part in {"", ".", ".."} for part in name.split("/")):
                        raise CandidateWorkspaceError(f"B 发行事实路径非法：{name}")
                    if not (name == "catalog.json" or name == core.STATE_FILE or name == "packages" or name.startswith("packages/")):
                        raise CandidateWorkspaceError(f"B 发行事实包含越界文件：{name}")
                    if member.issym() or member.islnk() or not (member.isdir() or member.isfile()):
                        raise CandidateWorkspaceError(f"B 发行事实禁止链接或特殊条目：{name}")
                    target = (destination / name).resolve()
                    if destination.resolve() not in target.parents and target != destination.resolve():
                        raise CandidateWorkspaceError(f"B 发行事实越出隔离目录：{name}")
                    if member.isdir():
                        target.mkdir(parents=True, exist_ok=True)
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    extracted = archive.extractfile(member)
                    if extracted is None:
                        raise CandidateWorkspaceError(f"B 发行事实无法读取：{name}")
                    target.write_bytes(extracted.read())
        except tarfile.TarError as exc:
            raise CandidateWorkspaceError("B 发行事实归档无效") from exc

    @staticmethod
    def _is_ancestor(root: Path, ancestor: str, descendant: str) -> bool:
        result = subprocess.run(
            ["git", "merge-base", "--is-ancestor", ancestor, descendant],
            cwd=root,
            check=False,
            capture_output=True,
        )
        if result.returncode == 0:
            return True
        if result.returncode == 1:
            return False
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise CandidateWorkspaceError(f"无法验证发行 sourceCommit 祖先关系：{detail}")
