from __future__ import annotations

import sys
import tempfile
import unittest
import hashlib
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import repository_core as core
from candidate_workspace import CandidateWorkspace
from repository_candidate import JOB_NAME, WORKFLOW_PATH, extract_candidate_artifact, extract_preview_artifact, validate_inventory, write_candidate_manifest
from repository_publish import GitHubGitTransport
from test_repository_publish import _create_fixture, _git, _remove_tree


class StableCandidateContractTests(unittest.TestCase):
    def test_artifact_extraction_rejects_foreign_paths_and_duplicate_names(self) -> None:
        with tempfile.TemporaryDirectory(prefix="nxp-candidate-zip-") as temporary:
            root = Path(temporary)
            archive = root / "artifact.zip"
            for names in (("candidate.json", "../foreign"),
                          ("candidate.json", "candidate.json")):
                with self.subTest(names=names):
                    with zipfile.ZipFile(archive, "w") as target:
                        for name in names:
                            target.writestr(name, b"{}")
                    digest = "sha256:" + hashlib.sha256(archive.read_bytes()).hexdigest()
                    with self.assertRaises(core.RepositoryError):
                        extract_candidate_artifact(archive, root / "output", expected_digest=digest)
                    self.assertFalse((root / "foreign").exists())

    def test_preview_artifact_extraction_rejects_path_escape(self) -> None:
        with tempfile.TemporaryDirectory(prefix="nxp-preview-zip-") as temporary:
            root = Path(temporary)
            archive = root / "artifact.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("preview/candidate.json", b"{}")
                target.writestr("preview-producer.json", b"{}")
                target.writestr("preview/catalog.json", b"{}")
                target.writestr("preview/preview-plan.json", b"{}")
                target.writestr("preview/../../foreign", b"bad")
            digest = "sha256:" + hashlib.sha256(archive.read_bytes()).hexdigest()
            with self.assertRaises(core.RepositoryError):
                extract_preview_artifact(archive, root / "output", expected_digest=digest)
            self.assertFalse((root / "foreign").exists())

    def test_inventory_and_original_producer_are_bound_to_distribution(self) -> None:
        root = _create_fixture()
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = core.read_json(manifest_path)
            store = core.read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            core.write_json(manifest_path, manifest)
            core.write_json(store_path, store)
            _git(root, "add", ".")
            _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "source")
            source = core.git_head(root)
            distribution_sha = source
            plan_path = root / ".generated" / "plan.json"
            core.write_json(plan_path, core.build_plan(root))
            output = root / ".generated" / "stable"
            core.release(root, plan_path, output)
            producer = {"workflowPath": WORKFLOW_PATH, "workflowSha": source,
                        "runId": 12, "runAttempt": 2, "jobName": JOB_NAME}
            with tempfile.TemporaryDirectory(prefix="nxp-candidate-fixture-") as temporary:
                distribution = Path(temporary)
                CandidateWorkspace._extract_distribution(root, distribution_sha, distribution)
                write_candidate_manifest(root, output, distribution, source_sha=source,
                                         distribution_sha=distribution_sha, partner_sha="a" * 40,
                                         workflow_sha=source, run_id=12, run_attempt=2)
            expected = dict(expected_source_sha=source, expected_partner_sha="a" * 40,
                            expected_producer=producer, expected_distribution_sha=distribution_sha)
            self.assertEqual(validate_inventory(root, output, **expected)["producer"], producer)
            with self.assertRaisesRegex(core.RepositoryError, "producer"):
                validate_inventory(root, output, **{**expected, "expected_producer": {**producer, "runAttempt": 3}})
            (output / "release-plan.json").write_bytes(b"{}")
            with self.assertRaises(core.RepositoryError):
                validate_inventory(root, output, **expected)
        finally:
            _remove_tree(root)

    def test_candidate_writer_uses_same_bytes_and_is_idempotent(self) -> None:
        root = _create_fixture()
        remote_parent = Path(tempfile.mkdtemp(prefix="nxp-candidate-remote-"))
        try:
            manifest_path = root / "plugins" / "specialized" / "Alpha" / "plugin.json"
            store_path = root / "plugins" / "specialized" / "Alpha" / "store.json"
            manifest = core.read_json(manifest_path)
            store = core.read_json(store_path)
            manifest["version"] = "0.2.0"
            store["changelog"] = [{"version": "0.2.0", "date": "2026-01-02", "items": ["update"]}]
            core.write_json(manifest_path, manifest)
            core.write_json(store_path, store)
            _git(root, "add", ".")
            _git(root, "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "source")
            _git(root, "branch", "-M", "main")
            source = core.git_head(root)
            remote = remote_parent / "remote.git"
            _git(root, "clone", "--bare", ".", str(remote))
            plan_path = root / ".generated" / "plan.json"
            core.write_json(plan_path, core.build_plan(root))
            output = root / ".generated" / "stable"
            core.release(root, plan_path, output)
            with tempfile.TemporaryDirectory(prefix="nxp-candidate-fixture-") as temporary:
                distribution = Path(temporary)
                CandidateWorkspace._extract_distribution(root, source, distribution)
                write_candidate_manifest(root, output, distribution, source_sha=source,
                                         distribution_sha=source, partner_sha="a" * 40,
                                         workflow_sha=source, run_id=12, run_attempt=2)
            transport = GitHubGitTransport(remote=str(remote))
            options = dict(remote_write=True, token="test-token", run_id=12,
                           run_attempt=2, workflow_sha=source)
            racer = remote_parent / "racer"
            _git(root, "clone", str(remote), str(racer))
            _git(racer, "-c", "user.email=test@example.test", "-c", "user.name=Test",
                 "commit", "--allow-empty", "-m", "unchanged distribution tree")
            unchanged_parent = core.git_head(racer)
            _git(racer, "push", "origin", "main")
            first = transport.publish_stable_candidate(root, output, source, source, **options)
            second = transport.publish_stable_candidate(root, output, source, source, **options)
            self.assertFalse(first["idempotent"])
            self.assertTrue(second["idempotent"])
            self.assertEqual(first["parent"], unchanged_parent)
            self.assertEqual(first["publishedCommit"], second["publishedCommit"])
            _git(racer, "pull", "--ff-only", "origin", "main")
            catalog_path = racer / "catalog.json"
            catalog_path.write_bytes(catalog_path.read_bytes() + b"\n")
            _git(racer, "add", "catalog.json")
            _git(racer, "-c", "user.email=test@example.test", "-c", "user.name=Test",
                 "commit", "-m", "new distribution baseline")
            _git(racer, "push", "origin", "main")
            with self.assertRaisesRegex(core.RepositoryError, "BASELINE_STALE"):
                transport.publish_stable_candidate(root, output, source, source, **options)
            (racer / "README.md").write_text("next source\n", encoding="utf-8")
            _git(racer, "add", "README.md")
            _git(racer, "-c", "user.email=test@example.test", "-c", "user.name=Test",
                 "commit", "-m", "new source")
            _git(racer, "push", "origin", "main")
            with self.assertRaisesRegex(core.RepositoryError, "SUPERSEDED"):
                transport.publish_stable_candidate(root, output, source, source, **options)
        finally:
            _remove_tree(root)
            _remove_tree(remote_parent)


if __name__ == "__main__":
    unittest.main()
