from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import tools.release.preview as release_preview
import tools.repository.archive as repository_archive
import tools.repository.io as repository_io
import tools.repository.model as repository_model

import shutil
import json
import subprocess
import tempfile
import unittest
import zipfile
import os
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


repository_io.configure_console()

from tools.release.candidate import release, validate_generated
from tools.repository.catalog import catalog_entry
from tools.repository.git import git_head, git_tree, plugin_root_from_path
from tools.repository.io import read_json, write_json
from tools.repository.model import SourcePlugin, RepositoryError
from tools.repository.package import _package_files
from tools.repository.plan import build_plan, validate_candidate_against_base
from tools.repository.source import discover_source_plugins, validate_source_plugin
from tools.repository.state import load_state
from tools.repository.versions import is_semver, parse_date, parse_semver

class RepositoryCoreTests(unittest.TestCase):
    def test_package_identity_tracks_author_inputs_separately_from_controller(self) -> None:
        from tools.release.inventory import _builder_fingerprint
        with tempfile.TemporaryDirectory(prefix="nxp-package-identity-") as temporary:
            root = Path(temporary)
            adapter = root / "adapters" / "task-protocol" / "observer.js"
            adapter.parent.mkdir(parents=True)
            adapter.write_bytes(b"emit('success');")
            props = root / "Directory.Build.props"
            props.write_bytes(b"<Project />")
            managed = _builder_fingerprint(root, "managed-code")
            data = _builder_fingerprint(root, "data-specialized")
            adapter.write_bytes(b"emit('failed');")
            self.assertEqual(_builder_fingerprint(root, "managed-code"), managed)
            self.assertNotEqual(_builder_fingerprint(root, "data-specialized"), data)
            props.write_bytes(b"<Project><PropertyGroup /></Project>")
            self.assertNotEqual(_builder_fingerprint(root, "managed-code"), managed)

    def test_historical_archive_checks_original_bytes_without_current_manifest_parsing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="nxp-history-archive-") as temporary:
            package = Path(temporary) / "Alpha-0.1.0.zip"
            with zipfile.ZipFile(package, "w") as archive:
                archive.writestr("plugin.json", b"unsupported historical manifest")
            original = package.read_bytes()
            repository_archive._validate_historical_archive(package, original)
            with self.assertRaises(RepositoryError):
                repository_archive._validate_zip(package)
            package.write_bytes(original + b"unexpected mutation")
            with self.assertRaisesRegex(RepositoryError, "基线字节"):
                repository_archive._validate_historical_archive(package, original)

    def test_missing_state_is_rejected_without_importing_catalog(self) -> None:
        with tempfile.TemporaryDirectory(prefix="nxp-missing-state-") as temporary:
            root = Path(temporary)
            catalog = root / "catalog.json"
            catalog.write_bytes(b'{"schemaVersion":2,"plugins":[]}\r\n')
            before = catalog.read_bytes()
            with self.assertRaisesRegex(RepositoryError, "发行状态"):
                load_state(root)
            self.assertEqual(catalog.read_bytes(), before)
            self.assertFalse((root / ".release-state.json").exists())
            self.assertIsNone(plugin_root_from_path("plugins/Alpha/plugin.json"))
            self.assertEqual(plugin_root_from_path("plugins/specialized/Alpha/plugin.json"), "plugins/specialized/Alpha")

    @staticmethod
    def _managed_plugin(root: Path, *, with_tests: bool = True):
        plugin_root = root / "plugins" / "general" / "Managed"
        (plugin_root / "src").mkdir(parents=True)
        (plugin_root / "src" / "Managed.csproj").write_text("<Project />", encoding="utf-8")
        if with_tests:
            (plugin_root / "tests").mkdir()
            (plugin_root / "tests" / "Managed.Tests.csproj").write_text("<Project />", encoding="utf-8")
        return SimpleNamespace(root=plugin_root, artifact_name="Managed", kind="managed-code")

    @staticmethod
    def _write_trx(command, *, total: int, executed: int, passed: int, failed: int = 0,
                   skipped: int = 0) -> None:
        arguments = list(command)
        results = Path(arguments[arguments.index("--results-directory") + 1])
        logger = arguments[arguments.index("--logger") + 1]
        report = results / logger.split("=", 1)[1]
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(
            f'<TestRun><ResultSummary><Counters total="{total}" executed="{executed}" '
            f'passed="{passed}" failed="{failed}" notExecuted="{skipped}" />'
            '</ResultSummary></TestRun>', encoding="utf-8")

    def test_zip_namespace_rejects_unsafe_and_colliding_paths(self) -> None:
        root = Path(tempfile.mkdtemp(prefix=".nxp-zip-layout-test-"))
        try:
            cases = {
                "traversal": ["../escape.txt"],
                "casefold": ["plugin.json", "PLUGIN.JSON"],
                "ancestor": ["config", "config/settings.json"],
                "directory-ancestor": ["config", "config/settings/"],
                "duplicate": ["plugin.json", "plugin.json"],
                "drive": ["C:/payload.dll"],
                "ads": ["payload.dll:stream"],
                "reserved": ["COM¹.txt"],
                "wildcard": ["data/bad?.json"],
                "control": ["data/bad\x01.json"],
            }
            for label, names in cases.items():
                package = root / f"{label}.zip"
                with zipfile.ZipFile(package, "w") as archive:
                    for name in names:
                        archive.writestr(name, b"" if name.endswith('/') else b"test")
                with self.subTest(label=label), self.assertRaises(RepositoryError):
                    with zipfile.ZipFile(package) as archive:
                        repository_archive._validate_zip_layout(archive.infolist(), package)
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_zip_type_and_resource_limits_are_checked_before_payload(self) -> None:
        for mode in (0o120777, 0o010644, 0o060644):
            info = zipfile.ZipInfo("payload")
            info.external_attr = mode << 16
            with self.subTest(mode=mode), self.assertRaises(RepositoryError):
                repository_archive._validate_zip_layout([info], Path('test.zip'))
        info = zipfile.ZipInfo('directory/')
        info.file_size = 1
        with self.assertRaises(RepositoryError):
            repository_archive._validate_zip_layout([info], Path('test.zip'))
        info = zipfile.ZipInfo('payload')
        info.file_size = repository_model.MAX_ZIP_UNCOMPRESSED_BYTES
        repository_archive._validate_zip_layout([info], Path('test.zip'))
        info.file_size += 1
        with self.assertRaises(RepositoryError):
            repository_archive._validate_zip_layout([info], Path('test.zip'))
        with patch.object(repository_model, 'MAX_ZIP_ENTRIES', 0), self.assertRaises(RepositoryError):
            repository_archive._validate_zip_layout([info], Path('test.zip'))

    def test_semver_and_date_are_strict(self) -> None:
        self.assertEqual(parse_semver("0.14.6").text, "0.14.6")
        self.assertEqual(parse_semver("0.14.6-beta.2").text, "0.14.6-beta.2")
        self.assertEqual(parse_semver("0.14.6-rc.1").text, "0.14.6-rc.1")
        self.assertTrue(is_semver("10.0.1"))
        self.assertTrue(is_semver("10.0.1-beta.1"))
        self.assertFalse(is_semver("01.0.0"))
        self.assertFalse(is_semver("10.0.1-alpha.1"))
        self.assertFalse(is_semver("10.0.1-beta.01"))
        self.assertGreater(parse_semver("1.2.3"), parse_semver("1.2.3-rc.1"))
        self.assertGreater(parse_semver("1.2.3-rc.1"), parse_semver("1.2.3-beta.2"))
        with self.assertRaises(RepositoryError):
            parse_semver("0.14", "测试版本")
        self.assertEqual(parse_date("2026-09-06"), "2026-09-06")
        with self.assertRaises(RepositoryError):
            parse_date("2026-02-30", "测试日期")

    def test_deterministic_zip_has_stable_bytes(self) -> None:
        root = Path(tempfile.mkdtemp(prefix=".nxp-repository-test-"))
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

    def test_specialized_contract_rejects_frontend_and_unknown_capability(self) -> None:
        root = self._create_git_fixture()
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            manifest = read_json(manifest_path)
            manifest["frontend"] = None
            write_json(manifest_path, manifest)
            with self.assertRaisesRegex(RepositoryError, r"Alpha.*frontend"):
                discover_source_plugins(root)

            manifest.pop("frontend")
            manifest["capabilities"] = ["frontend-module"]
            write_json(manifest_path, manifest)
            with self.assertRaisesRegex(RepositoryError, r"Alpha.*capability"):
                discover_source_plugins(root)
        finally:
            self._remove_tree(root)

    def test_retired_config_validator_is_rejected_in_source_and_zip(self) -> None:
        root = self._create_git_fixture()
        try:
            plugin_root = root / "plugins" / "specialized" / "Alpha"
            manifest_path = plugin_root / "plugin.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["configValidator"] = "data/config-validator.js"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(RepositoryError, "configValidator"):
                validate_source_plugin(plugin_root)
            package = root / "Alpha-0.1.0.zip"
            with zipfile.ZipFile(package, "w") as archive:
                archive.write(manifest_path, "plugin.json")
            with self.assertRaisesRegex(RepositoryError, "configValidator"):
                repository_archive._validate_zip(package)
        finally:
            self._remove_tree(root)

    def test_preview_uses_current_hash_named_package_without_stable_state(self) -> None:
        root = self._create_git_fixture()
        try:
            from tools.repository.package import package_one
            from tools.repository.catalog import preview_catalog_entry
            from tools.repository.source import discover_source_plugins
            from tools.repository.io import package_metadata, write_json
            from tools.repository.model import REPOSITORY
            output = root / ".generated" / "preview"
            report = root / "package-report.json"
            (root / "tests" / "architecture").mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(__file__).resolve().parents[2] / "tests/architecture/check.py", root / "tests/architecture/check.py")
            result = package_one(root, artifact="Alpha", output=output / "packages", report=report)
            package = output / "packages" / result["fileName"]
            source = git_head(root)
            plugin = discover_source_plugins(root)[0]
            entry = preview_catalog_entry(plugin, package, source, package_metadata(package))
            write_json(output / "catalog.json", {"schemaVersion": 2, "repository": REPOSITORY,
                       "channel": "develop", "sourceCommit": source, "plugins": [entry]})
            validated = release_preview.validate_preview_candidate(output, expected_source_sha=source)
            self.assertEqual(validated["sourceCommit"], source)
            self.assertFalse((output / ".release-state.json").exists())
            self.assertRegex(package.name, r"^Alpha-0\.1\.0-[0-9a-f]{64}\.zip$")
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
            original_sha256 = repository_io.sha256
            calls = []

            def counted_sha256(path: Path) -> str:
                calls.append(path)
                return original_sha256(path)

            repository_io.sha256 = counted_sha256
            try:
                release(root, plan_path, candidate)
                validate_generated(root, candidate)
            finally:
                repository_io.sha256 = original_sha256
            self.assertEqual(len(calls), 3)
            self.assertEqual(calls[0].name, "Alpha-0.2.0.zip")
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

    def _create_git_fixture(self, managed: bool = False) -> Path:
        root = Path(tempfile.mkdtemp(prefix=".nxp-plan-test-"))
        (root / "plugins" / "general").mkdir(parents=True)
        (root / "plugins" / "specialized").mkdir(parents=True)
        category = "general" if managed else "specialized"
        plugin_root = root / "plugins" / (Path(category) / "Alpha")
        (plugin_root / "data").mkdir(parents=True)
        if managed:
            (plugin_root / "src").mkdir()
            (plugin_root / "src" / "Alpha.csproj").write_text(
                "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>\n",
                encoding="utf-8",
            )
        manifest = {
            "schemaVersion": 2,
            "name": "alpha",
            "artifactName": "Alpha",
            "displayName": "Alpha",
            "description": "test",
            "version": "0.1.0",
            "kind": "managed-code" if managed else "data-specialized",
            "minHostVersion": "0.16.15",
            "capabilities": [],
            "resolve": "data/resolve.json",
            "judgeScript": "data/judge.js",
        }
        if managed:
            manifest["apiVersion"] = "2.0"
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
        plugin = validate_source_plugin(plugin_root)
        payload = root / "payload"
        (payload / "data").mkdir(parents=True)
        shutil.copy2(plugin_root / "plugin.json", payload / "plugin.json")
        shutil.copy2(plugin_root / "store.json", payload / "store.json")
        shutil.copytree(plugin_root / "data", payload / "data", dirs_exist_ok=True)
        package = root / "packages" / "Alpha" / "Alpha-0.1.0.zip"
        _package_files(payload, package)
        write_json(
            root / "host.lock.json",
            {
                "hostApiVersion": "2.0",
                "frontendApiVersion": "1.5",
                "supportedLocales": ["zh-CN", "en-US"],
            },
        )
        write_json(root / "catalog.json", {"schemaVersion": 2, "repository": "FlappiBakuse/NexusPipeline-Plugins", "generatedAt": "2026-01-01T00:00:00Z", "plugins": [catalog_entry(plugin, package)]})
        self._git(root, "init")
        self._git(root, "add", ".")
        self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "baseline")
        baseline_commit = git_head(root)
        entry = read_json(root / "catalog.json")["plugins"][0]
        state = {"schemaVersion": 1, "sourceCommit": baseline_commit, "released": {
            "Alpha": {"name": "alpha", "artifactName": "Alpha", "version": "0.1.0",
                      "sha256": entry["sha256"], "sizeBytes": entry["sizeBytes"],
                      "sourceTree": git_tree(root, baseline_commit, plugin_root.relative_to(root).as_posix())}}}
        write_json(root / ".release-state.json", state)
        self._git(root, "add", ".release-state.json")
        self._git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "release state")
        return root

if __name__ == "__main__":
    unittest.main()
