from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tools.repository.model as repository_model

@dataclass(frozen=True, order=True)
class ParsedVersion:
    """NexusPipeline 的严格版本键：核心版本优先，beta < rc < stable。"""

    major: int
    minor: int
    patch: int
    stage_rank: int
    stage_number: int

    @property
    def text(self) -> str:
        core = f"{self.major}.{self.minor}.{self.patch}"
        if self.stage_rank == 0:
            return f"{core}-beta.{self.stage_number}"
        if self.stage_rank == 1:
            return f"{core}-rc.{self.stage_number}"
        return core


def parse_semver(value: Any, label: str = "版本") -> ParsedVersion:
    text = value if isinstance(value, str) else ""
    match = repository_model.SEMVER_PATTERN.fullmatch(text)
    if match is None:
        raise repository_model.RepositoryError(f"{label}不是受支持的 Nexus 版本：{text}")
    stage = match.group(4)
    stage_rank = {"beta": 0, "rc": 1}.get(stage, 2)
    return ParsedVersion(
        int(match.group(1)),
        int(match.group(2)),
        int(match.group(3)),
        stage_rank,
        int(match.group(5) or 0),
    )


def is_semver(value: Any) -> bool:
    return isinstance(value, str) and repository_model.SEMVER_PATTERN.fullmatch(value) is not None


def parse_date(value: Any, label: str = "日期") -> str:
    text = value if isinstance(value, str) else ""
    if repository_model.DATE_PATTERN.fullmatch(text) is None:
        raise repository_model.RepositoryError(f"{label}必须使用 YYYY-MM-DD 格式：{text}")
    try:
        dt.date.fromisoformat(text)
    except ValueError as exc:
        raise repository_model.RepositoryError(f"{label}不是有效日期：{text}") from exc
    return text


def _version_from_package(path: Path, artifact: str) -> ParsedVersion | None:
    match = repository_model.PACKAGE_PATTERN.fullmatch(path.name)
    if match is None or match.group("artifact") != artifact:
        return None
    return parse_semver(match.group("version"), "发行包版本")
