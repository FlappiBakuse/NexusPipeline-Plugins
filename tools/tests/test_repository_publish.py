from __future__ import annotations

import base64
import shutil
import sys
import os
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import repository_core as core
from repository_core import RepositoryError, bootstrap_state, build_plan, catalog_entry, git_head, read_json, release, validate_source_plugin, write_json
from repository_publish import (
    _candidate_inventory,
    _publish_preview_remote,
    GitHubGitTransport,
    publish_develop,
    publish_preview,
    publish_stable,
    write_stable_producer,
)


H = "a" * 40
B = "b" * 40
C = "c" * 40


def _git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=root, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return result.stdout


def _create_fixture() -> Path:
    root = Path(tempfile.mkdtemp(prefix=".nxp-publish-test-"))
    (root / "plugins" / "general").mkdir(parents=True)
    (root / "plugins" / "general" / ".gitkeep").write_text("", encoding="utf-8")
    plugin_root = root / "plugins" / "specialized" / "Alpha"
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
    write_json(plugin_root / "plugin.json", manifest)
    write_json(plugin_root / "store.json", store)
    write_json(plugin_root / "data" / "resolve.json", {"require": [{"var": "main", "file": "Alpha.exe"}], "paths": {"mainExe": "{main}", "args": "", "configPath": "config.json", "logPath": "logs/*.txt"}})
    (plugin_root / "data" / "judge.js").write_text("return null;\n", encoding="utf-8")
    (root / "README.md").write_text("baseline\n", encoding="utf-8")
    plugin = validate_source_plugin(plugin_root)
    payload = root / "payload"
    (payload / "data").mkdir(parents=True)
    shutil.copy2(plugin_root / "plugin.json", payload / "plugin.json")
    shutil.copy2(plugin_root / "store.json", payload / "store.json")
    shutil.copytree(plugin_root / "data", payload / "data", dirs_exist_ok=True)
    package = root / "packages" / "Alpha" / "Alpha-0.1.0.zip"
    core._package_files(payload, package)
    write_json(root / "host.lock.json", {"hostApiVersion": "1.8", "frontendApiVersion": "1.5", "supportedLocales": ["zh-CN", "en-US"]})
    write_json(root / "catalog.json", {"schemaVersion": 2, "repository": core.REPOSITORY, "generatedAt": "2026-01-01T00:00:00Z", "plugins": [catalog_entry(plugin, package)]})
    _git(root, "init")
    _git(root, "add", ".")
    _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "baseline")
    write_json(root / ".release-state.json", bootstrap_state(root))
    _git(root, "add", ".release-state.json")
    _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "release state")
    return root


def _remove_tree(root: Path) -> None:
    def onerror(function, path, _exc_info):
        os.chmod(path, 0o666)
        function(path)

    shutil.rmtree(root, onerror=onerror)


class FakePreviewTransport:
    def __init__(self, *, fail_name: str | None = None, fail_once: bool = False) -> None:
        self.events: list[tuple[str, str]] = []
        self.source_head = H
        self.release: dict | None = None
        self.assets: dict[str, tuple[int, bytes]] = {}
        self.next_id = 1
        self.fail_name = fail_name
        self.fail_once = fail_once

    def get_source_head(self, _repository: str, branch: str, _token: str) -> str:
        self.events.append(("get_source_head", branch))
        return self.source_head

    def get_release(self, _repository: str, tag: str, _token: str) -> dict | None:
        self.events.append(("get_release", tag))
        return None if self.release is None else dict(self.release)

    def create_release(self, _repository: str, tag: str, _token: str, **_fields: object) -> dict:
        self.events.append(("create_release", tag))
        self.release = {"id": 1, "draft": True, "prerelease": True}
        return dict(self.release)

    def update_release(self, _repository: str, _release_id: int, _token: str, **fields: object) -> dict:
        self.events.append(("update_release", "release"))
        assert self.release is not None
        self.release.update(fields)
        return dict(self.release)

    def list_assets(self, _repository: str, _release_id: int, _token: str) -> list[dict]:
        self.events.append(("list_assets", "release"))
        return [{"id": asset_id, "name": name} for name, (asset_id, _data) in sorted(self.assets.items())]

    def download_asset(self, _repository: str, asset_id: int, _token: str) -> bytes:
        self.events.append(("download_asset", str(asset_id)))
        for current_id, data in self.assets.values():
            if current_id == asset_id:
                return data
        raise AssertionError(f"unknown asset {asset_id}")

    def delete_asset(self, _repository: str, asset_id: int, _token: str) -> None:
        self.events.append(("delete_asset", str(asset_id)))
        for name, (current_id, _data) in list(self.assets.items()):
            if current_id == asset_id:
                del self.assets[name]
                return
        raise AssertionError(f"unknown asset {asset_id}")

    def upload_asset(self, _repository: str, _release_id: int, asset: Path, _token: str, *, name: str) -> dict:
        self.events.append(("upload_asset", name))
        if name == self.fail_name:
            if self.fail_once:
                self.fail_name = None
            raise RepositoryError(f"simulated upload failure: {name}")
        asset_id = self.next_id
        self.next_id += 1
        self.assets[name] = (asset_id, asset.read_bytes())
        return {"id": asset_id, "name": name}


class FakeGitTransport:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def publish_stable_candidate(self, root: Path, generated_root: Path, source_sha: str, base_sha: str, **kwargs: object) -> dict:
        self.calls.append({"root": root, "generated_root": generated_root, "source_sha": source_sha, "base_sha": base_sha, **kwargs})
        return {"publishedCommit": "d" * 40, "parent": source_sha, "remoteWritten": True}


class RepositoryPublishTests(unittest.TestCase):
    def test_preview_transport_uploads_packages_and_metadata_before_catalog(self) -> None:
        root = _create_fixture()
        try:
            output = root / ".generated" / "preview"
            result = publish_develop(root, source_ref="HEAD", output=output, host_root=None, run_id="12", run_attempt="1", workflow_sha=C)
            transport = FakePreviewTransport()
            transport.source_head = result["sourceCommit"]
            _publish_preview_remote(result, token="secret", transport=transport, run_id="12")
            uploads = [name for event, name in transport.events if event == "upload_asset"]
            self.assertGreaterEqual(len(uploads), 3)
            self.assertEqual(uploads[-1], "catalog.json")
            self.assertTrue(any(name.startswith("preview-publisher-") for name in uploads))
            self.assertTrue(all(uploads.index(name) < uploads.index("catalog.json") for name in uploads[:-1]))
            self.assertEqual(transport.events[0], ("get_source_head", "develop"))
            catalog_index = transport.events.index(("upload_asset", "catalog.json"))
            for name, (asset_id, _) in transport.assets.items():
                if name.endswith('.zip'):
                    self.assertLess(transport.events.index(("download_asset", str(asset_id))), catalog_index)
        finally:
            _remove_tree(root)

    def test_preview_remote_is_idempotent_for_same_candidate(self) -> None:
        root = _create_fixture()
        try:
            output = root / ".generated" / "preview"
            result = publish_develop(root, source_ref="HEAD", output=output, run_id="12", run_attempt="1", workflow_sha=C)
            transport = FakePreviewTransport()
            transport.source_head = result["sourceCommit"]
            _publish_preview_remote(result, token="secret", transport=transport, run_id="12")
            event_count = len(transport.events)
            before = {str(path.relative_to(output)): path.read_bytes() for path in output.rglob('*') if path.is_file()}
            _publish_preview_remote(result, token="secret", transport=transport, run_id="13")
            self.assertEqual(before, {str(path.relative_to(output)): path.read_bytes() for path in output.rglob('*') if path.is_file()})
            self.assertNotIn("upload_asset", [event for event, _name in transport.events[event_count:]])
            self.assertEqual(transport.assets["catalog.json"][1], (root / ".generated" / "preview" / "catalog.json").read_bytes())
        finally:
            _remove_tree(root)

    def test_preview_upload_failure_does_not_switch_catalog(self) -> None:
        root = _create_fixture()
        try:
            output = root / ".generated" / "preview"
            result = publish_develop(root, source_ref="HEAD", output=output, run_id="12", run_attempt="1", workflow_sha=C)
            transport = FakePreviewTransport()
            transport.source_head = result["sourceCommit"]
            _publish_preview_remote(result, token="secret", transport=transport, run_id="12")
            old_catalog = transport.assets["catalog.json"][1]
            changed = root / ".generated" / "preview-changed"
            shutil.copytree(output, changed)
            catalog = read_json(changed / "catalog.json")
            catalog["generatedAt"] = "2099-01-01T00:00:00Z"
            write_json(changed / "catalog.json", catalog)
            transport.fail_name = "catalog.json"
            transport.fail_once = True
            with self.assertRaises(RepositoryError):
                _publish_preview_remote({"output": str(changed), "sourceCommit": result["sourceCommit"]}, token="secret", transport=transport, run_id="12")
            self.assertEqual(transport.assets["catalog.json"][1], old_catalog)
            restored_id = transport.assets['catalog.json'][0]
            self.assertIn(('download_asset', str(restored_id)), transport.events)
        finally:
            _remove_tree(root)

    def test_preview_corrupt_package_and_mid_upload_supersession_never_switch_catalog(self) -> None:
        root = _create_fixture()
        try:
            result = publish_develop(root, source_ref='HEAD', output=root / '.generated/preview')
            for failure in ('corrupt', 'superseded'):
                transport = FakePreviewTransport()
                transport.source_head = result['sourceCommit']
                download = transport.download_asset
                def altered(repository, asset_id, token):
                    data = download(repository, asset_id, token)
                    if failure == 'corrupt': return data + b'corrupt'
                    transport.source_head = 'e' * 40
                    return data
                with patch.object(transport, 'download_asset', side_effect=altered), self.assertRaises(RepositoryError):
                    _publish_preview_remote(result, token='secret', transport=transport, run_id='12')
                self.assertNotIn('catalog.json', transport.assets)
        finally:
            _remove_tree(root)

    def test_preview_corrupt_restore_is_reported_as_restore_failure(self) -> None:
        root = _create_fixture()
        try:
            output = root / '.generated/preview'
            result = publish_develop(root, source_ref='HEAD', output=output)
            transport = FakePreviewTransport()
            transport.source_head = result['sourceCommit']
            _publish_preview_remote(result, token='secret', transport=transport, run_id='12')
            catalog = read_json(output / 'catalog.json')
            catalog['generatedAt'] = '2099-01-01T00:00:00Z'
            write_json(output / 'catalog.json', catalog)
            transport.fail_name = 'catalog.json'
            transport.fail_once = True
            download = transport.download_asset
            old_id = transport.assets['catalog.json'][0]
            def corrupted_restore(repository, asset_id, token):
                data = download(repository, asset_id, token)
                current = transport.assets.get('catalog.json')
                return data + b'bad' if current and current[0] == asset_id and asset_id != old_id else data
            with patch.object(transport, 'download_asset', side_effect=corrupted_restore), self.assertRaisesRegex(RepositoryError, '恢复失败'):
                _publish_preview_remote(result, token='secret', transport=transport, run_id='13')
        finally:
            _remove_tree(root)

    def test_preview_remote_false_has_no_transport_side_effect(self) -> None:
        root = _create_fixture()
        try:
            output = root / ".generated" / "preview"
            result = publish_develop(root, source_ref="HEAD", output=output, run_id="12", run_attempt="1", workflow_sha=C)
            transport = FakePreviewTransport()
            result = publish_preview(output, source_sha=result["sourceCommit"], run_id="12", run_attempt="1", workflow_sha=C, github_transport=transport)
            self.assertFalse(result["remoteWritten"])
            self.assertEqual(transport.events, [])
        finally:
            _remove_tree(root)

    def test_preview_rejects_superseded_source_before_release_write(self) -> None:
        root = _create_fixture()
        try:
            output = root / ".generated" / "preview"
            result = publish_develop(root, source_ref="HEAD", output=output, run_id="12", run_attempt="1", workflow_sha=C)
            transport = FakePreviewTransport()
            transport.source_head = "e" * 40
            with self.assertRaisesRegex(RepositoryError, "SUPERSEDED"):
                _publish_preview_remote(result, token="secret", transport=transport, run_id="12")
            self.assertEqual([event for event in transport.events if event[0] in {"create_release", "upload_asset", "update_release"}], [])
        finally:
            _remove_tree(root)

    def test_stable_writer_requires_producer_identity_and_forwards_it(self) -> None:
        root = _create_fixture()
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            _git(root, "add", ".")
            _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "source")
            source = git_head(root)
            plan = build_plan(root)
            plan_path = root / ".generated" / "plan.json"
            write_json(plan_path, plan)
            candidate = root / ".generated" / "stable"
            release(root, plan_path, candidate)
            write_stable_producer(candidate, source_sha=source, base_sha=B, run_id="12", run_attempt="2", workflow_sha=C, qualification_app_id="456", qualification_check_id="789")
            transport = FakeGitTransport()
            result = publish_stable(root, source, candidate, remote_write=True, token="secret", git_transport=transport, base_sha=B, run_id="12", run_attempt="2", workflow_sha=C, qualification_app_id="456", qualification_check_id="789")
            self.assertTrue(result["remoteWritten"])
            self.assertEqual(transport.calls[0]["source_sha"], source)
            self.assertEqual(transport.calls[0]["base_sha"], B)
            self.assertEqual(transport.calls[0]["run_id"], 12)
        finally:
            _remove_tree(root)

    def test_stable_candidate_inventory_rejects_extra_payload(self) -> None:
        root = _create_fixture()
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            _git(root, "add", ".")
            _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "source")
            plan = build_plan(root)
            plan_path = root / ".generated" / "plan.json"
            write_json(plan_path, plan)
            candidate = root / ".generated" / "stable"
            release(root, plan_path, candidate)
            (candidate / "packages" / "unexpected.txt").write_text("bad", encoding="utf-8")
            with self.assertRaisesRegex(RepositoryError, "候选文件不在白名单"):
                _candidate_inventory(root, candidate)
        finally:
            _remove_tree(root)

    def test_stable_git_writer_pushes_whitelist_and_is_idempotent(self) -> None:
        root = _create_fixture()
        remote_parent = Path(tempfile.mkdtemp(prefix=".nxp-stable-remote-"))
        remote = remote_parent / "remote.git"
        try:
            base = git_head(root)
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = read_json(manifest_path)
            store = read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            write_json(manifest_path, manifest)
            write_json(store_path, store)
            _git(root, "add", ".")
            _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "source")
            source = git_head(root)
            _git(root, "branch", "-M", "main")
            _git(root, "clone", "--bare", ".", str(remote))
            plan = build_plan(root)
            plan_path = root / ".generated" / "plan.json"
            write_json(plan_path, plan)
            candidate = root / ".generated" / "stable"
            release(root, plan_path, candidate)
            transport = GitHubGitTransport(remote=str(remote))
            original_run = transport._run
            def checked_run(command, cwd, *, env):
                header = env["GIT_CONFIG_VALUE_0"]
                self.assertTrue(header.startswith("AUTHORIZATION: basic "))
                credentials = base64.b64decode(header.split(" ")[-1]).decode()
                self.assertTrue(credentials.startswith("x-access-token:"))
                self.assertEqual(env["GIT_TERMINAL_PROMPT"], "0")
                self.assertNotIn(credentials, " ".join(command))
                return original_run(command, cwd, env=env)
            transport._run = checked_run
            writer_source = remote_parent / 'writer-source'
            _git(root, 'clone', '--depth', '1', root.as_uri(), str(writer_source))
            with self.assertRaisesRegex(RepositoryError, 'Git 基线'):
                core.validate_generated(writer_source, candidate)
            _git(writer_source, 'fetch', '--unshallow', 'origin')
            core.validate_generated(writer_source, candidate)
            # Every hostile candidate must fail at the top-level boundary,
            # before a local bare remote or any historical package can change.
            write_stable_producer(candidate, source_sha=source, base_sha=base, run_id='12', run_attempt='1', workflow_sha=C, qualification_app_id='456', qualification_check_id='789')
            original_plan = (candidate / 'release-plan.json').read_bytes()
            remote_before = _git(remote, 'rev-parse', 'main').strip()
            historical = (root / 'packages/Alpha/Alpha-0.1.0.zip').read_bytes()
            for attack in ('history', 'unreferenced', 'remove', 'requires'):
                extra = None
                if attack in ('history', 'unreferenced'):
                    extra = candidate / 'packages/Alpha' / ('Alpha-0.1.0.zip' if attack == 'history' else 'Alpha-0.9.0.zip')
                    extra.write_bytes(b'foreign bytes')
                else:
                    altered = read_json(candidate / 'release-plan.json')
                    altered['removeArtifacts' if attack == 'remove' else 'requiresPackage'] = ['packages/Alpha'] if attack == 'remove' else []
                    write_json(candidate / 'release-plan.json', altered)
                with self.subTest(attack=attack), self.assertRaises(RepositoryError):
                    publish_stable(root, source, candidate, remote_write=True, token='secret', git_transport=transport, base_sha=base, run_id='12', run_attempt='1', workflow_sha=C, qualification_app_id='456', qualification_check_id='789')
                self.assertEqual(_git(remote, 'rev-parse', 'main').strip(), remote_before)
                self.assertEqual((root / 'packages/Alpha/Alpha-0.1.0.zip').read_bytes(), historical)
                if extra: extra.unlink()
                (candidate / 'release-plan.json').write_bytes(original_plan)
            first = transport.publish_stable_candidate(root, candidate, source, base, remote_write=True, token="secret", run_id=12, run_attempt=1, workflow_sha=C)
            second = transport.publish_stable_candidate(root, candidate, source, base, remote_write=True, token="secret", run_id=12, run_attempt=1, workflow_sha=C)
            self.assertFalse(first["idempotent"])
            self.assertTrue(second["idempotent"])
            self.assertNotEqual(first["publishedCommit"], source)
            self.assertRegex(first["catalogSha256"], r"^[0-9a-f]{64}$")
            self.assertRegex(first["stateSha256"], r"^[0-9a-f]{64}$")
            self.assertTrue(first["packageSha256"])
            changed = _git(remote, "--no-pager", "diff", "--name-only", f"{source}..{first['publishedCommit']}").splitlines()
            self.assertTrue(changed)
            self.assertTrue(all(path == "catalog.json" or path == ".release-state.json" or path.startswith("packages/") for path in changed))
        finally:
            _remove_tree(root)
            _remove_tree(remote_parent)


if __name__ == "__main__":
    unittest.main()
