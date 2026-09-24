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
from repository_candidate import JOB_NAME, WORKFLOW_PATH, extract_candidate_artifact, extract_preview_artifact, inspect_candidate_identity, package_input_identities, reusable_candidate_packages, stable_candidate_scope, validate_inventory, write_candidate_manifest
from repository_publish import GitHubGitTransport
from test_repository_publish import _create_fixture, _git, _remove_tree


class StableCandidateContractTests(unittest.TestCase):
    def test_candidate_identity_separates_source_from_manual_controller(self) -> None:
        with tempfile.TemporaryDirectory(prefix="nxp-plugin-candidate-identity-") as temporary:
            output = Path(temporary)
            candidate = {
                "sourceSha": "a" * 40,
                "partnerSha": "b" * 40,
                "producer": {"workflowPath": WORKFLOW_PATH, "workflowSha": "c" * 40,
                             "runId": 12, "runAttempt": 2, "jobName": JOB_NAME},
            }
            core.write_json(output / "candidate.json", candidate)
            self.assertEqual(inspect_candidate_identity(output, workflow_sha="c" * 40,
                                                        run_id=12, run_attempt=2),
                             {"sourceSha": "a" * 40, "partnerSha": "b" * 40})
            with self.assertRaisesRegex(core.RepositoryError, "producer"):
                inspect_candidate_identity(output, workflow_sha="d" * 40,
                                           run_id=12, run_attempt=2)
    def test_scope_skips_generated_only_event_and_selects_payload_change(self) -> None:
        root = _create_fixture()
        try:
            self.assertEqual(stable_candidate_scope(root)["status"], "NO_CHANGES")
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
            self.assertEqual(stable_candidate_scope(root)["status"], "BUILD_REQUIRED")
        finally:
            _remove_tree(root)

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

    def test_refresh_reuses_only_matching_byte_verified_package_inputs(self) -> None:
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
            plan_path = root / ".generated" / "plan.json"
            plan = core.build_plan(root)
            core.write_json(plan_path, plan)
            output = root / ".generated" / "stable"
            core.release(root, plan_path, output)
            with tempfile.TemporaryDirectory(prefix="nxp-refresh-distribution-") as temporary:
                distribution = Path(temporary)
                CandidateWorkspace._extract_distribution(root, source, distribution)
                write_candidate_manifest(root, output, distribution, source_sha=source,
                                         distribution_sha=source, partner_sha="a" * 40,
                                         workflow_sha=source, run_id=12, run_attempt=1)
            inputs = package_input_identities(root, plan, "a" * 40)
            reusable = reusable_candidate_packages(root, output, inputs)
            self.assertEqual(set(reusable), {"Alpha"})
            package_entry = next(item for item in core.read_json(output / "candidate.json")["files"]
                                 if item["path"].endswith(".zip"))
            self.assertEqual(hashlib.sha256(reusable["Alpha"].read_bytes()).hexdigest(),
                             package_entry["sha256"])
            self.assertEqual(reusable_candidate_packages(root, output, {"Alpha": "0" * 64}), {})
            reusable["Alpha"].write_bytes(reusable["Alpha"].read_bytes() + b"tamper")
            with self.assertRaisesRegex(core.RepositoryError, "摘要或大小"):
                reusable_candidate_packages(root, output, inputs)
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
