from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
import zipfile
import os
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from repository_core import (  # noqa: E402
    RepositoryError,
    _package_files,
    bootstrap_state,
    build_plan,
    catalog_entry,
    is_semver,
    parse_date,
    parse_semver,
    plugin_root_from_path,
    release_requires_full,
    release,
    read_json,
    validate_source_plugin,
    write_json,
)


class RepositoryCoreTests(unittest.TestCase):
    def test_semver_and_date_are_strict(self) -> None:
        self.assertEqual(parse_semver("0.14.6"), (0, 14, 6))
        self.assertTrue(is_semver("10.0.1"))
        self.assertFalse(is_semver("01.0.0"))
        with self.assertRaises(RepositoryError):
            parse_semver("0.14", "测试版本")
        self.assertEqual(parse_date("2026-09-06"), "2026-09-06")
        with self.assertRaises(RepositoryError):
            parse_date("2026-02-30", "测试日期")

    def test_plugin_root_mapping_handles_current_and_typed_layouts(self) -> None:
        self.assertEqual(plugin_root_from_path("plugins/LiveScreenshot/src/Main.cs"), "plugins/LiveScreenshot")
        self.assertEqual(plugin_root_from_path("plugins\\specialized\\BAAH\\store.json"), "plugins/specialized/BAAH")
        self.assertIsNone(plugin_root_from_path("docs/RELEASING.md"))
        self.assertFalse(release_requires_full(["tools/repository_core.py", ".github/workflows/publish-plugins.yml"]))

    def test_deterministic_zip_has_stable_bytes(self) -> None:
        root = Path(tempfile.mkdtemp(prefix=".nxp-repository-test-", dir=str(Path.cwd())))
        try:
            source = root / "payload"
            (source / "z").mkdir(parents=True)
            (source / "z" / "last.txt").write_text("last", encoding="utf-8")
            (source / "first.txt").write_text("first", encoding="utf-8")
            (source / "line-endings.json").write_bytes(b'{"value":1}\r\n')
            first = root / "first.zip"
            second = root / "second.zip"
            _package_files(source, first)
            _package_files(source, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), ["first.txt", "line-endings.json", "z/last.txt"])
                self.assertEqual(archive.read("line-endings.json"), b'{"value":1}\n')
                self.assertTrue(all(item.compress_type == zipfile.ZIP_STORED for item in archive.infolist()))
                self.assertTrue(all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in archive.infolist()))
        finally:
            self._remove_tree(root)

    def test_docs_only_plan_does_not_package(self) -> None:
        root = self._create_git_fixture()
        try:
            readme = root / "README.md"
            readme.write_text("docs only\n", encoding="utf-8")
            self._git(root, "add", "README.md")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "docs")
            plan = build_plan(root)
            self.assertEqual(plan["requiresPackage"], [])
            self.assertEqual(plan["deleted"], [])
            self.assertIn("README.md", plan["globalChanges"])
        finally:
            self._remove_tree(root)

    def test_source_change_requires_semver_bump(self) -> None:
        root = self._create_git_fixture()
        try:
            data = root / "plugins" / "Alpha" / "data" / "judge.js"
            data.write_text("changed\n", encoding="utf-8")
            self._git(root, "add", ".")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "source change")
            with self.assertRaisesRegex(RepositoryError, "必须提升 SemVer"):
                build_plan(root)
        finally:
            self._remove_tree(root)

    def test_release_candidate_contains_only_changed_package(self) -> None:
        root = self._create_git_fixture()
        try:
            manifest_path = root / "plugins" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            self._git(root, "add", "plugins/Alpha/plugin.json", "plugins/Alpha/store.json")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "version bump")
            plan = build_plan(root)
            plan_path = root / "release-plan.json"
            write_json(plan_path, plan)
            candidate = root / ".generated" / "candidate"
            release(root, plan_path, candidate)
            self.assertEqual(plan["requiresPackage"], ["Alpha"])
            self.assertEqual([path.name for path in (candidate / "packages").iterdir()], ["Alpha"])
            self.assertTrue((candidate / "packages" / "Alpha" / "Alpha-0.2.0.zip").is_file())
            self.assertEqual(read_json(candidate / "catalog.json")["plugins"][0]["version"], "0.2.0")
        finally:
            self._remove_tree(root)

    def _git(self, root: Path, *args: str) -> str:
        result = subprocess.run(["git", *args], cwd=root, check=False, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip())
        return result.stdout

    def _remove_tree(self, root: Path) -> None:
        def onerror(function, path, _exc_info):
            os.chmod(path, 0o666)
            function(path)

        shutil.rmtree(root, onerror=onerror)

    def _create_git_fixture(self) -> Path:
        root = Path(tempfile.mkdtemp(prefix=".nxp-plan-test-", dir=str(Path.cwd())))
        (root / "plugins" / "Alpha" / "data").mkdir(parents=True)
        manifest = {
            "schemaVersion": 2,
            "name": "alpha",
            "artifactName": "Alpha",
            "displayName": "Alpha",
            "description": "test",
            "version": "0.1.0",
            "kind": "data-specialized",
            "minHostVersion": "0.0.0",
            "capabilities": [],
            "resolve": "data/resolve.json",
            "judgeScript": "data/judge.js",
        }
        store = {
            "schemaVersion": 1,
            "gameName": "Test",
            "authors": [{"name": "Test", "url": "https://example.test/author"}],
            "tags": ["test"],
            "homepage": "https://example.test/plugin",
            "changelog": [{"version": "0.1.0", "date": "2026-01-01", "items": ["initial"]}],
        }
        resolve = {
            "require": [{"var": "main", "file": "Alpha.exe"}],
            "paths": {"mainExe": "{main}", "args": "", "configPath": "config.json", "logPath": "logs/*.txt"},
        }
        write_json(root / "plugins" / "Alpha" / "plugin.json", manifest)
        write_json(root / "plugins" / "Alpha" / "store.json", store)
        write_json(root / "plugins" / "Alpha" / "data" / "resolve.json", resolve)
        (root / "plugins" / "Alpha" / "data" / "judge.js").write_text("return null;\n", encoding="utf-8")
        (root / "README.md").write_text("baseline\n", encoding="utf-8")
        plugin = validate_source_plugin(root / "plugins" / "Alpha")
        payload = root / "payload"
        (payload / "data").mkdir(parents=True)
        shutil.copy2(root / "plugins" / "Alpha" / "plugin.json", payload / "plugin.json")
        shutil.copy2(root / "plugins" / "Alpha" / "store.json", payload / "store.json")
        shutil.copytree(root / "plugins" / "Alpha" / "data", payload / "data", dirs_exist_ok=True)
        package = root / "packages" / "Alpha" / "Alpha-0.1.0.zip"
        _package_files(payload, package)
        write_json(root / "catalog.json", {"schemaVersion": 2, "repository": "FlappiBakuse/NexusPipeline-Plugins", "generatedAt": "2026-01-01T00:00:00Z", "plugins": [catalog_entry(plugin, package)]})
        self._git(root, "init")
        self._git(root, "add", ".")
        self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "baseline")
        state = bootstrap_state(root)
        write_json(root / ".release-state.json", state)
        self._git(root, "add", ".release-state.json")
        self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "release state")
        return root


if __name__ == "__main__":
    unittest.main()
