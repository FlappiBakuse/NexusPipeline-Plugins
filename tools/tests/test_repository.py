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

import repository_core as core  # noqa: E402

core.configure_console()

from repository_core import (  # noqa: E402
    SourcePlugin,
    RepositoryError,
    _package_files,
    bootstrap_state,
    build_plan,
    catalog_entry,
    discover_source_plugins,
    git_head,
    git_tree,
    is_semver,
    parse_date,
    parse_semver,
    plugin_root_from_path,
    release_requires_full,
    release,
    read_json,
    validate_source_plugin,
    validate_generated,
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

    def test_locales_use_canonical_bcp47_casing(self) -> None:
        self.assertEqual(core._canonical_locale("zh_hant_tw"), "zh-Hant-TW")
        self.assertEqual(core._canonical_locale("EN-us"), "en-US")
        self.assertIsNone(core._canonical_locale("zh--CN"))
        self.assertIsNone(core._canonical_locale("中文"))

    def test_localization_contract_requires_matching_keys_and_placeholders(self) -> None:
        root = Path(tempfile.mkdtemp(prefix=".nxp-localization-test-", dir=str(Path.cwd())))
        try:
            plugin = root / "Plugin"
            (plugin / "i18n").mkdir(parents=True)
            manifest = {
                "artifactName": "Plugin",
                "localization": {
                    "defaultLocale": "zh-CN",
                    "locales": {
                        "zh-CN": "i18n/zh-CN.json",
                        "en-US": "i18n/en-US.json",
                    },
                },
            }
            write_json(plugin / "i18n" / "zh-CN.json", {"greeting": "你好，{name}", "plain": "文本"})
            write_json(plugin / "i18n" / "en-US.json", {"greeting": "Hello, {name}", "plain": "Text"})
            core._validate_localization_contract(plugin, manifest)

            write_json(plugin / "i18n" / "en-US.json", {"greeting": "Hello", "plain": "Text"})
            with self.assertRaisesRegex(RepositoryError, "占位符集合"):
                core._validate_localization_contract(plugin, manifest)

            write_json(plugin / "i18n" / "en-US.json", {"greeting": "Hello, {name}", "legacy.old": "Text"})
            with self.assertRaisesRegex(RepositoryError, "key 无效"):
                core._validate_localization_contract(plugin, manifest)

            write_json(plugin / "i18n" / "en-US.json", {"greeting": "Hello, {name}", "中文": "Text"})
            with self.assertRaisesRegex(RepositoryError, "key 无效"):
                core._validate_localization_contract(plugin, manifest)
        finally:
            self._remove_tree(root)

    def test_localized_changelog_item_counts_match_base_entries(self) -> None:
        base_changelog = [{"version": "0.1.0", "items": ["first", "second"]}]
        locales = {
            "en-US": {
                "displayName": "Alpha",
                "gameName": "Test",
                "description": "Description",
                "tags": ["test"],
                "changelog": [{"version": "0.1.0", "items": ["first"]}],
            },
        }
        with self.assertRaisesRegex(RepositoryError, "items 数量必须与基础记录一致"):
            core._validate_localized_metadata(locales, "alpha", "0.1.0", "Alpha", "Description", base_changelog)

    def test_supported_locales_follow_host_lock(self) -> None:
        lock = read_json(Path(__file__).resolve().parents[2] / "host.lock.json")
        self.assertEqual(core.SUPPORTED_LOCALES, set(lock["supportedLocales"]))

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

    def test_plugin_conformance_tests_do_not_require_package(self) -> None:
        root = self._create_git_fixture()
        try:
            test_path = root / "plugins" / "specialized" / "Alpha" / "tests" / "Alpha.Tests.csproj"
            test_path.parent.mkdir()
            test_path.write_text("<Project />\n", encoding="utf-8")
            self._git(root, "add", "plugins/specialized/Alpha/tests/Alpha.Tests.csproj")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "plugin tests")
            plan = build_plan(root)
            self.assertEqual(plan["requiresPackage"], [])
            self.assertIn("plugins/specialized/Alpha/tests/Alpha.Tests.csproj", plan["globalChanges"])
        finally:
            self._remove_tree(root)

    def test_source_change_requires_semver_bump(self) -> None:
        root = self._create_git_fixture()
        try:
            data = root / "plugins" / "specialized" / "Alpha" / "data" / "judge.js"
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
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            self._git(root, "add", "plugins/specialized/Alpha/plugin.json", "plugins/specialized/Alpha/store.json")
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

    def test_flat_source_plugin_is_rejected_after_migration(self) -> None:
        root = self._create_git_fixture()
        try:
            shutil.move(root / "plugins" / "specialized" / "Alpha", root / "plugins" / "Alpha")
            with self.assertRaisesRegex(RepositoryError, "必须位于 plugins/general/ 或 plugins/specialized/"):
                discover_source_plugins(root)
        finally:
            self._remove_tree(root)

    def test_general_requires_managed_code(self) -> None:
        root = self._create_git_fixture()
        try:
            shutil.move(root / "plugins" / "specialized" / "Alpha", root / "plugins" / "general" / "Alpha")
            with self.assertRaisesRegex(RepositoryError, "必须位于 plugins/general/"):
                discover_source_plugins(root)
        finally:
            self._remove_tree(root)

    def test_specialized_requires_data_specialized(self) -> None:
        root = self._create_git_fixture()
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            manifest = read_json(manifest_path)
            manifest["kind"] = "managed-code"
            write_json(manifest_path, manifest)
            with self.assertRaisesRegex(RepositoryError, "必须位于 plugins/specialized/"):
                discover_source_plugins(root)
        finally:
            self._remove_tree(root)

    def test_pure_flat_to_typed_relocation_requires_no_semver_bump(self) -> None:
        root = self._create_git_fixture(legacy_flat=True)
        try:
            plan = build_plan(root)
            self.assertEqual(plan["changed"], [])
            self.assertEqual(plan["deleted"], [])
            self.assertEqual(plan["requiresPackage"], [])
            self.assertEqual(plan["relocated"], ["Alpha"])
        finally:
            self._remove_tree(root)

    def test_pure_relocation_preserves_catalog_entry_package_bytes_and_advances_state(self) -> None:
        root = self._create_git_fixture(legacy_flat=True)
        try:
            before_catalog = read_json(root / "catalog.json")
            before_package = (root / "packages" / "Alpha" / "Alpha-0.1.0.zip").read_bytes()
            before_state = read_json(root / ".release-state.json")
            plan = build_plan(root)
            plan_path = root / ".generated" / "relocation-plan.json"
            write_json(plan_path, plan)
            candidate = root / ".generated" / "relocation-candidate"
            release(root, plan_path, candidate)
            validate_generated(root, candidate)
            self.assertEqual(read_json(candidate / "catalog.json"), before_catalog)
            self.assertEqual((root / "packages" / "Alpha" / "Alpha-0.1.0.zip").read_bytes(), before_package)
            self.assertEqual(list((candidate / "packages").rglob("*.zip")), [])
            state = read_json(candidate / ".release-state.json")
            self.assertEqual(state["sourceCommit"], plan["head"])
            self.assertEqual(state["released"]["Alpha"]["sourceTree"], before_state["released"]["Alpha"]["sourceTree"])
        finally:
            self._remove_tree(root)

    def test_relocation_plus_payload_change_requires_semver_bump(self) -> None:
        root = self._create_git_fixture(legacy_flat=True)
        try:
            judge = root / "plugins" / "specialized" / "Alpha" / "data" / "judge.js"
            judge.write_text("changed after relocation\n", encoding="utf-8")
            self._git(root, "add", ".")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "payload change")
            with self.assertRaisesRegex(RepositoryError, "必须提升 SemVer"):
                build_plan(root)
        finally:
            self._remove_tree(root)

    def test_relocation_with_version_bump_is_one_package_change_without_delete(self) -> None:
        root = self._create_git_fixture(legacy_flat=True)
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["relocated"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            self._git(root, "add", ".")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "version bump after relocation")
            plan = build_plan(root)
            self.assertEqual(plan["requiresPackage"], ["Alpha"])
            self.assertEqual(plan["deleted"], [])
            self.assertEqual(plan["relocated"], [])
        finally:
            self._remove_tree(root)

    def test_changed_package_sha_is_computed_once_in_normal_release(self) -> None:
        root = self._create_git_fixture()
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            self._git(root, "add", ".")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "version bump")
            plan = build_plan(root)
            plan_path = root / ".generated" / "release-plan.json"
            write_json(plan_path, plan)
            candidate = root / ".generated" / "candidate"
            original_sha256 = core.sha256
            calls = []

            def counted_sha256(path: Path) -> str:
                calls.append(path)
                return original_sha256(path)

            core.sha256 = counted_sha256
            try:
                release(root, plan_path, candidate)
                validate_generated(root, candidate)
            finally:
                core.sha256 = original_sha256
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0].name, "Alpha-0.2.0.zip")
        finally:
            self._remove_tree(root)

    def test_docs_only_release_performs_zero_package_sha(self) -> None:
        root = self._create_git_fixture()
        try:
            (root / "README.md").write_text("docs only\n", encoding="utf-8")
            self._git(root, "add", "README.md")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "docs")
            plan = build_plan(root)
            plan_path = root / ".generated" / "release-plan.json"
            write_json(plan_path, plan)
            original_sha256 = core.sha256
            calls = []
            core.sha256 = lambda path: calls.append(path) or original_sha256(path)
            try:
                release(root, plan_path, root / ".generated" / "candidate")
            finally:
                core.sha256 = original_sha256
            self.assertEqual(calls, [])
        finally:
            self._remove_tree(root)

    def test_tool_only_release_performs_zero_package_sha(self) -> None:
        root = self._create_git_fixture()
        try:
            (root / "tools").mkdir()
            (root / "tools" / "repository.py").write_text("# tool change\n", encoding="utf-8")
            self._git(root, "add", "tools/repository.py")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "tool")
            plan = build_plan(root)
            plan_path = root / ".generated" / "release-plan.json"
            write_json(plan_path, plan)
            original_sha256 = core.sha256
            calls = []
            core.sha256 = lambda path: calls.append(path) or original_sha256(path)
            try:
                release(root, plan_path, root / ".generated" / "candidate")
            finally:
                core.sha256 = original_sha256
            self.assertEqual(calls, [])
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

    def _create_git_fixture(self, legacy_flat: bool = False) -> Path:
        root = Path(tempfile.mkdtemp(prefix=".nxp-plan-test-", dir=str(Path.cwd())))
        (root / "plugins" / "general").mkdir(parents=True)
        (root / "plugins" / "specialized").mkdir(parents=True)
        plugin_root = root / "plugins" / ("Alpha" if legacy_flat else Path("specialized") / "Alpha")
        (plugin_root / "data").mkdir(parents=True)
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
        write_json(plugin_root / "plugin.json", manifest)
        write_json(plugin_root / "store.json", store)
        write_json(plugin_root / "data" / "resolve.json", resolve)
        (plugin_root / "data" / "judge.js").write_text("return null;\n", encoding="utf-8")
        (root / "README.md").write_text("baseline\n", encoding="utf-8")
        plugin = SourcePlugin("specialized", plugin_root, manifest, store) if legacy_flat else validate_source_plugin(plugin_root)
        payload = root / "payload"
        (payload / "data").mkdir(parents=True)
        shutil.copy2(plugin_root / "plugin.json", payload / "plugin.json")
        shutil.copy2(plugin_root / "store.json", payload / "store.json")
        shutil.copytree(plugin_root / "data", payload / "data", dirs_exist_ok=True)
        package = root / "packages" / "Alpha" / "Alpha-0.1.0.zip"
        _package_files(payload, package)
        write_json(root / "catalog.json", {"schemaVersion": 2, "repository": "FlappiBakuse/NexusPipeline-Plugins", "generatedAt": "2026-01-01T00:00:00Z", "plugins": [catalog_entry(plugin, package)]})
        self._git(root, "init")
        self._git(root, "add", ".")
        self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "baseline")
        baseline_commit = git_head(root)
        if legacy_flat:
            state = {
                "schemaVersion": 1,
                "sourceCommit": baseline_commit,
                "released": {
                    "Alpha": {
                        "name": "alpha",
                        "artifactName": "Alpha",
                        "version": "0.1.0",
                        "sha256": read_json(root / "catalog.json")["plugins"][0]["sha256"],
                        "sizeBytes": read_json(root / "catalog.json")["plugins"][0]["sizeBytes"],
                        "sourceTree": git_tree(root, baseline_commit, "plugins/Alpha"),
                    }
                },
            }
        else:
            state = bootstrap_state(root)
        write_json(root / ".release-state.json", state)
        self._git(root, "add", ".release-state.json")
        self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "release state")
        if legacy_flat:
            typed_root = root / "plugins" / "specialized" / "Alpha"
            typed_root.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(root / "plugins" / "Alpha", typed_root)
            self._git(root, "add", ".")
            self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "categorize plugin")
        return root


if __name__ == "__main__":
    unittest.main()
