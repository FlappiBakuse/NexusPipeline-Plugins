from __future__ import annotations

from pathlib import Path
import tools.release.candidate as release_candidate
import tools.repository.io as repository_io
import tools.repository.model as repository_model
import base64
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from typing import Any
import tools.release.inventory as release_inventory
import tools.release.stable as release_stable

class GitHubGitTransport:
    """在一次性 checkout 中执行 stable 生成物白名单提交和普通 push。"""

    def __init__(self, remote: str = f"https://github.com/{release_inventory.OFFICIAL_REPOSITORY}.git") -> None:
        self.remote = remote

    @staticmethod
    def _run(command: list[str], cwd: Path, *, env: dict[str, str]) -> str:
        completed = subprocess.run(command, cwd=cwd, env=env, check=False, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if completed.returncode != 0:
            raise repository_model.RepositoryError(f"stable Git 操作失败（exit={completed.returncode}）：{completed.stderr.strip()[:500]}")
        return completed.stdout.strip()

    @staticmethod
    def _safe_candidate_file(path: Path, generated_root: Path) -> str:
        resolved = path.resolve()
        root = generated_root.resolve()
        repository_io._require(path.is_file() and not path.is_symlink() and root in resolved.parents, f"stable 候选文件无效：{path}")
        relative = resolved.relative_to(root).as_posix()
        repository_io._require(relative in {"catalog.json", repository_model.STATE_FILE} or relative.startswith("packages/"), f"stable 候选路径不在白名单：{relative}")
        return relative

    def publish_stable_candidate(
        self,
        root: Path,
        generated_root: Path,
        source_sha: str,
        base_sha: str,
        *,
        remote_write: bool,
        token: str,
        run_id: int,
        run_attempt: int,
        workflow_sha: str,
    ) -> dict[str, Any]:
        repository_io._require(remote_write and bool(token), "stable remote write 必须有 publisher token")
        source_sha = release_inventory._full_sha(source_sha, "stable source SHA")
        release_inventory._full_sha(base_sha, "stable base SHA")
        release_inventory._positive_int(run_id, "candidate runId")
        release_inventory._positive_int(run_attempt, "candidate runAttempt")
        release_inventory._full_sha(workflow_sha, "candidate workflow SHA")
        generated_root = release_inventory._ordinary_directory(generated_root, "stable 候选目录")
        plan = repository_io.read_json(generated_root / "release-plan.json")
        repository_io._require(isinstance(plan, dict) and plan.get("head") == source_sha, "stable 候选 plan/source SHA 不一致")
        release_candidate.validate_generated(root.resolve(), generated_root, distribution_root=root.resolve())
        files, _total = release_stable._candidate_inventory(root.resolve(), generated_root)
        expected_paths = set(files)
        for key in ("removePackages", "removeArtifacts"):
            values = plan.get(key, [])
            repository_io._require(isinstance(values, list), f"stable plan {key} 必须是数组")
            for value in values:
                normalized = release_inventory._safe_relative(value, f"stable plan {key}")
                if key == "removeArtifacts":
                    repository_io._require(len(normalized.split("/")) == 2, f"stable 删除目录路径无效：{value}")
                expected_paths.add(normalized)
        packages = generated_root / "packages"
        with tempfile.TemporaryDirectory(prefix=".nxp-stable-writer-") as temporary:
            checkout = Path(temporary) / "checkout"
            env = os.environ.copy()
            env.update({
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                "GIT_CONFIG_VALUE_0": "AUTHORIZATION: basic " + base64.b64encode(f"x-access-token:{token}".encode("utf-8")).decode("ascii"),
                "GIT_TERMINAL_PROMPT": "0",
            })
            self._run(["git", "-c", "core.autocrlf=false", "clone", "--no-hardlinks", self.remote, str(checkout)], Path(temporary), env=env)
            self._run(["git", "config", "core.autocrlf", "false"], checkout, env=env)
            self._run(["git", "fetch", "origin", "main"], checkout, env=env)
            current = self._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
            self._assert_checkout_modes(checkout, env)
            self._run(["git", "checkout", "-B", "publisher-stable", current], checkout, env=env)
            if self._matches_candidate(checkout, generated_root, plan, source_sha, current, expected_paths, env):
                verification = self._verify_published_tree(checkout, generated_root, plan, source_sha, current, files, env)
                return {"sourceCommit": source_sha, "publishedCommit": current, "parent": current, "remoteWritten": True, "idempotent": True, **verification}
            ancestor = self._run(["git", "merge-base", source_sha, current], checkout, env=env)
            repository_io._require(ancestor == source_sha, "SUPERSEDED：candidate source 已不在当前 main 历史中")
            if current != source_sha:
                intervening = self._parse_changed_paths(self._run(
                    ["git", "diff", "--name-status", "--find-renames", "-z", f"{source_sha}..{current}"],
                    checkout, env=env))
                repository_io._require(all(path in {"catalog.json", repository_model.STATE_FILE} or path.startswith("packages/")
                                  for path in intervening),
                              "SUPERSEDED：main 已有更新源码，旧候选不再写入")
            if (generated_root / "candidate.json").is_file():
                for relative in ("catalog.json", repository_model.STATE_FILE, "packages"):
                    original_tree = self._run(["git", "rev-parse", f"{base_sha}:{relative}"], checkout, env=env)
                    current_tree = self._run(["git", "rev-parse", f"{current}:{relative}"], checkout, env=env)
                    repository_io._require(original_tree == current_tree,
                                  f"BASELINE_STALE：main 分发基线 {relative} 已改变，需要新候选")
            else:
                repository_io._require(current == source_sha, "stable main 已前进且尚未包含当前旧资格候选")
            self._assert_checkout_modes(checkout, env)
            for relative, candidate in sorted(files.items()):
                if not relative.startswith("packages/"):
                    continue
                destination = checkout / relative
                if destination.exists() or destination.is_symlink():
                    repository_io._require(destination.is_file() and not destination.is_symlink(), f"stable 目标包不是普通文件：{relative}")
                    repository_io._require(repository_io._same_package_bytes(destination, candidate), f"同一 SemVer 的远端发行包字节不同，拒绝覆盖：{relative}")
            for relative in ("catalog.json", repository_model.STATE_FILE):
                source = files[relative]
                destination = checkout / relative
                repository_io._require(not destination.is_symlink(), f"stable 目标不得是 symlink：{relative}")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)
            for relative, path in sorted(files.items()):
                if not relative.startswith("packages/"):
                    continue
                destination = checkout / relative
                self._require_no_symlink_parents(checkout, destination)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
            for relative in plan.get("removePackages", []):
                target = checkout / release_inventory._safe_relative(relative, "stable plan removePackages")
                if target.exists() or target.is_symlink():
                    repository_io._require(target.is_file() and not target.is_symlink(), f"stable 删除包目标无效：{relative}")
                    target.unlink()
            for relative in plan.get("removeArtifacts", []):
                target = checkout / release_inventory._safe_relative(relative, "stable plan removeArtifacts")
                if target.exists() or target.is_symlink():
                    repository_io._require(target.is_dir() and not target.is_symlink(), f"stable 删除目标不是普通目录：{relative}")
                    shutil.rmtree(target)
            self._run(["git", "fetch", "origin", "main"], checkout, env=env)
            latest = self._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
            repository_io._require(latest == current, "stable main 在写入前发生竞争，拒绝使用旧父提交")
            self._run(["git", "add", "--all", "--", "catalog.json", repository_model.STATE_FILE, "packages"], checkout, env=env)
            raw = self._run(["git", "diff", "--cached", "--name-status", "--find-renames", "-z"], checkout, env=env)
            changed = self._parse_changed_paths(raw)
            remove_directories = tuple(release_inventory._safe_relative(value, "stable plan removeArtifacts") for value in plan.get("removeArtifacts", []))
            unexpected = [path for path in changed if path not in expected_paths and not any(path.startswith(directory.rstrip("/") + "/") for directory in remove_directories)]
            repository_io._require(not unexpected, f"stable 生成物 diff 超出白名单：{sorted(set(unexpected))}")
            repository_io._require(not any((checkout / path).is_symlink() for path in changed if (checkout / path).exists()), "stable 生成物不得包含 symlink")
            if not changed:
                verification = self._verify_published_tree(checkout, generated_root, plan, source_sha, current, files, env)
                return {"sourceCommit": source_sha, "publishedCommit": current, "parent": current, "remoteWritten": True, "idempotent": True, **verification}
            self._run(["git", "-c", "user.name=NexusPipeline Stable Publisher", "-c", "user.email=noreply@nexuspipeline.invalid", "commit", "--no-verify", "-m", "chore: 更新稳定插件生成物"], checkout, env=env)
            published = self._run(["git", "rev-parse", "HEAD"], checkout, env=env)
            try:
                self._run(["git", "push", "origin", "HEAD:refs/heads/main"], checkout, env=env)
            except repository_model.RepositoryError as push_error:
                # A transport can lose the response after the server accepted the
                # push.  Read back first; never blindly repeat a write.
                self._run(["git", "fetch", "origin", "main"], checkout, env=env)
                observed = self._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
                if self._matches_candidate(checkout, generated_root, plan, source_sha,
                                           observed, expected_paths, env):
                    verification = self._verify_published_tree(
                        checkout, generated_root, plan, source_sha, observed, files, env)
                    return {"sourceCommit": source_sha, "publishedCommit": observed,
                            "parent": current, "remoteWritten": True, "idempotent": False,
                            "writeRecovered": True, **verification}
                raise repository_model.RepositoryError(
                    f"NON_FAST_FORWARD_OR_WRITE_UNCERTAIN：stable push 未确认且远端不是候选字节；{push_error}") from push_error
            verification = self._verify_published_tree(
                checkout,
                generated_root,
                plan,
                source_sha,
                published,
                files,
                env,
            )
            return {"sourceCommit": source_sha, "publishedCommit": published, "parent": current, "remoteWritten": True, "idempotent": False, **verification}

    @staticmethod
    def _parse_changed_paths(raw: str) -> list[str]:
        tokens = raw.split("\x00") if raw else []
        changed: list[str] = []
        index = 0
        while index < len(tokens) and tokens[index]:
            status = tokens[index]
            index += 1
            count = 2 if status.startswith(("R", "C")) else 1
            repository_io._require(index + count <= len(tokens), "stable Git diff 输出不完整")
            changed.extend(tokens[index:index + count])
            index += count
        return changed

    @staticmethod
    def _read_tree_blob(checkout: Path, revision: str, relative: str, env: dict[str, str]) -> bytes | None:
        completed = subprocess.run(
            ["git", "show", f"{revision}:{relative}"],
            cwd=checkout,
            env=env,
            check=False,
            capture_output=True,
        )
        if completed.returncode == 0:
            return completed.stdout
        return None

    @classmethod
    def _verify_published_tree(
        cls,
        checkout: Path,
        generated_root: Path,
        plan: dict[str, Any],
        source_sha: str,
        published: str,
        files: dict[str, Path],
        env: dict[str, str],
    ) -> dict[str, Any]:
        cls._run(["git", "fetch", "origin", "main"], checkout, env=env)
        fetched_head = cls._run(["git", "rev-parse", "refs/remotes/origin/main"], checkout, env=env)
        cls._run(["git", "merge-base", "--is-ancestor", published, fetched_head], checkout, env=env)

        catalog_bytes = cls._read_tree_blob(checkout, published, "catalog.json", env)
        state_bytes = cls._read_tree_blob(checkout, published, repository_model.STATE_FILE, env)
        repository_io._require(catalog_bytes is not None and state_bytes is not None, "stable push 后 catalog/state 不可读取")
        try:
            catalog = json.loads(catalog_bytes.decode("utf-8"))
            state = json.loads(state_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise repository_model.RepositoryError("stable push 后 catalog/state 不是有效 UTF-8 JSON") from exc
        repository_io._require(isinstance(catalog, dict) and isinstance(state, dict), "stable push 后 catalog/state 根节点无效")
        repository_io._require(state.get("sourceCommit") == source_sha, "stable push 后 state sourceCommit 不一致")

        package_hashes: dict[str, str] = {}
        for entry in catalog.get("plugins", []):
            repository_io._require(isinstance(entry, dict), "stable push 后 catalog.plugins 条目无效")
            artifact = entry.get("artifactName")
            version = entry.get("version")
            repository_io._require(isinstance(artifact, str) and isinstance(version, str), "stable push 后 catalog 包身份无效")
            relative = f"packages/{artifact}/{artifact}-{version}.zip"
            package_bytes = cls._read_tree_blob(checkout, published, relative, env)
            repository_io._require(package_bytes is not None, f"stable push 后缺少 catalog 指定包：{relative}")
            digest = hashlib.sha256(package_bytes).hexdigest()
            repository_io._require(digest == entry.get("sha256") and len(package_bytes) == entry.get("sizeBytes"), f"stable push 后包字节与 catalog 不一致：{relative}")
            package_hashes[relative] = digest

        for relative, candidate in files.items():
            remote_bytes = cls._read_tree_blob(checkout, published, relative, env)
            repository_io._require(remote_bytes is not None and remote_bytes == candidate.read_bytes(), f"stable push 后候选字节不一致：{relative}")

        tree_paths = cls._run(["git", "ls-tree", "-r", "--name-only", published, "--", "packages"], checkout, env=env).splitlines()
        for relative in plan.get("removePackages", []):
            normalized = release_inventory._safe_relative(relative, "stable plan removePackages")
            repository_io._require(normalized not in tree_paths, f"stable push 后删除包仍存在：{normalized}")
        for relative in plan.get("removeArtifacts", []):
            normalized = release_inventory._safe_relative(relative, "stable plan removeArtifacts")
            repository_io._require(not any(path == normalized or path.startswith(normalized.rstrip("/") + "/") for path in tree_paths), f"stable push 后删除目录仍存在：{normalized}")
        return {
            "catalogSha256": hashlib.sha256(catalog_bytes).hexdigest(),
            "stateSha256": hashlib.sha256(state_bytes).hexdigest(),
            "packageSha256": package_hashes,
        }

    @classmethod
    def _require_no_symlink_parents(cls, checkout: Path, target: Path) -> None:
        relative = target.relative_to(checkout)
        current = checkout
        for part in relative.parts:
            current = current / part
            repository_io._require(not current.is_symlink(), f"stable 目标路径包含 symlink：{relative}")

    @classmethod
    def _assert_checkout_modes(cls, checkout: Path, env: dict[str, str]) -> None:
        for relative in ("catalog.json", repository_model.STATE_FILE, "packages"):
            target = checkout / relative
            if target.is_symlink():
                raise repository_model.RepositoryError(f"stable checkout 白名单路径不得是 symlink：{relative}")
        packages = checkout / "packages"
        if packages.is_dir():
            for path in packages.rglob("*"):
                repository_io._require(not path.is_symlink(), f"stable checkout packages 不得包含 symlink：{path.relative_to(checkout)}")
        index = cls._run(["git", "ls-files", "-s", "--", "catalog.json", repository_model.STATE_FILE, "packages"], checkout, env=env)
        repository_io._require(not any(line.startswith("160000 ") for line in index.splitlines()), "stable checkout 禁止 submodule")

    @classmethod
    def _matches_candidate(cls, checkout: Path, generated_root: Path, plan: dict[str, Any], source_sha: str, current: str, expected_paths: set[str], env: dict[str, str]) -> bool:
        if current != source_sha:
            try:
                merge_base = cls._run(["git", "merge-base", source_sha, current], checkout, env=env)
            except repository_model.RepositoryError:
                return False
            if merge_base != source_sha:
                return False
            # Idempotent readback is a statement about already-published bytes.  A
            # later README or ordinary source commit must not erase that fact.
            # New writes are still guarded below by the source/baseline diff.
        for relative in ("catalog.json", repository_model.STATE_FILE):
            candidate_path = generated_root / relative
            current_bytes = cls._read_tree_blob(checkout, current, relative, env)
            if current_bytes is None or current_bytes != candidate_path.read_bytes():
                return False
        for relative in sorted(path for path in expected_paths if path.startswith("packages/")):
            if not (generated_root / relative).is_file():
                continue
            current_bytes = cls._read_tree_blob(checkout, current, relative, env)
            if current_bytes is None or current_bytes != (generated_root / relative).read_bytes():
                return False
        tree_paths = cls._run(["git", "ls-tree", "-r", "--name-only", current, "--", "packages"], checkout, env=env).splitlines()
        for relative in plan.get("removePackages", []):
            if release_inventory._safe_relative(relative, "stable plan removePackages") in tree_paths:
                return False
        for relative in plan.get("removeArtifacts", []):
            target = release_inventory._safe_relative(relative, "stable plan removeArtifacts").rstrip("/")
            if any(path == target or path.startswith(target + "/") for path in tree_paths):
                return False
        try:
            state_bytes = cls._read_tree_blob(checkout, current, repository_model.STATE_FILE, env)
            state = json.loads(state_bytes.decode("utf-8")) if state_bytes is not None else None
        except (UnicodeDecodeError, json.JSONDecodeError):
            return False
        return isinstance(state, dict) and state.get("sourceCommit") == source_sha
