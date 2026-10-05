from __future__ import annotations

from pathlib import Path
import tools.release.candidate as release_candidate
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.release.inventory as release_inventory

def _candidate_inventory(source_root: Path, generated_root: Path) -> tuple[dict[str, Path], int]:
    """Enumerate only candidate payload files and reject links/special files."""

    generated_root = release_inventory._ordinary_directory(generated_root, "候选目录")
    release_candidate.validate_stable_candidate_layout(source_root, generated_root)
    files: dict[str, Path] = {}
    total_bytes = 0
    for path in generated_root.rglob("*"):
        relative = path.relative_to(generated_root).as_posix()
        if path.is_symlink():
            raise repository_model.RepositoryError(f"候选目录禁止 symlink：{relative}")
        if path.is_dir():
            continue
        repository_io._require(path.is_file(), f"候选目录包含特殊文件：{relative}")
        if relative in {"release-plan.json", "candidate.json"}:
            continue
        repository_io._require(relative in {"catalog.json", repository_model.STATE_FILE} or relative.startswith("packages/"), f"候选文件不在发布白名单：{relative}")
        if relative.startswith("packages/"):
            repository_io._require(path.suffix.lower() == ".zip", f"stable 候选 packages 只能包含 ZIP：{relative}")
        files[relative] = path
        total_bytes += path.stat().st_size
        repository_io._require(len(files) <= release_inventory.MAX_CANDIDATE_FILES, "候选文件数量超过上限")
        repository_io._require(total_bytes <= release_inventory.MAX_CANDIDATE_BYTES, "候选文件总大小超过上限")
    for package in sorted(path for relative, path in files.items() if relative.startswith("packages/") and path.suffix.lower() == ".zip"):
        release_inventory._validate_zip_limits(package)
    repository_io._require("catalog.json" in files and repository_model.STATE_FILE in files, "候选缺少 catalog/state")
    return files, total_bytes
