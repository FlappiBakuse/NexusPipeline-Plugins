from __future__ import annotations

import copy
import unittest

from tools.repository_candidate_source import (
    BUILD_JOB_PREFIX, CandidateSourceError, NEW_REQUIRED_JOBS, resolve_candidate,
)


REPO = "FlappiBakuse/NexusPipeline-Plugins"
PREFIX = f"repos/{REPO}/actions"
LEGACY_SHA = "4c695eede3e1dcb0232de8e13a94ea938bbfcaea"


class CandidateSourceTests(unittest.TestCase):
    def fixture(self):
        return {
            f"{PREFIX}/runs/12": {"id": 12, "repository": {"full_name": REPO},
                                   "workflow_id": 88, "path": ".github/workflows/publish-stable.yml",
                                   "event": "push", "head_branch": "main", "head_sha": LEGACY_SHA,
                                   "run_attempt": 2},
            f"{PREFIX}/runs/99": {"id": 99, "repository": {"full_name": REPO}, "workflow_id": 88},
            f"{PREFIX}/runs/12/artifacts?per_page=100&page=1": {"artifacts": [
                {"id": 42, "name": "plugins-stable-candidate-12-2", "expired": False,
                 "size_in_bytes": 500, "workflow_run": {"id": 12}, "digest": "sha256:" + "b" * 64}]},
            f"{PREFIX}/runs/12/attempts/2/jobs?per_page=100&page=1": {"jobs": [
                {"name": "Build and validate Plugins candidate", "status": "completed",
                 "conclusion": "success"}]},
        }

    def resolve(self, paths):
        return resolve_candidate(lambda name: paths[name], candidate_run_id=12, current_run_id=99)

    def test_approved_legacy_candidate_has_no_new_budget_certificate(self):
        result = self.resolve(self.fixture())
        self.assertEqual((result["producerSchema"], result["budgetQualified"]), ("legacy-v1", False))

    def test_legacy_requires_approved_controller_and_same_attempt(self):
        paths = self.fixture()
        paths[f"{PREFIX}/runs/12"]["head_sha"] = "f" * 40
        with self.assertRaisesRegex(CandidateSourceError, "legacy candidate controller"):
            self.resolve(paths)
        paths = self.fixture()
        paths[f"{PREFIX}/runs/12"]["run_attempt"] = 3
        with self.assertRaisesRegex(CandidateSourceError, "过期 attempt"):
            self.resolve(paths)

    def test_new_producer_checks_every_stage_and_complete_elapsed(self):
        paths = self.fixture()
        paths[f"{PREFIX}/runs/12"]["head_sha"] = "c" * 40
        jobs = [{"name": name, "status": "completed", "conclusion": "success",
                 "started_at": "2026-09-29T00:00:00Z", "completed_at": "2026-09-29T00:02:30Z"}
                for name in (*NEW_REQUIRED_JOBS, BUILD_JOB_PREFIX + "GameCheckIn")]
        paths[f"{PREFIX}/runs/12/attempts/2/jobs?per_page=100&page=1"] = {"jobs": jobs}
        self.assertTrue(self.resolve(paths)["budgetQualified"])
        jobs[-1]["completed_at"] = "2026-09-29T00:02:31Z"
        with self.assertRaisesRegex(CandidateSourceError, "超过 150 秒"):
            self.resolve(paths)
        jobs[-1]["completed_at"] = "2026-09-29T00:02:30Z"
        jobs[-1]["conclusion"] = "skipped"
        with self.assertRaisesRegex(CandidateSourceError, "未真实成功"):
            self.resolve(paths)

    def test_new_producer_accepts_legitimate_empty_package_matrix(self):
        paths = self.fixture()
        paths[f"{PREFIX}/runs/12"]["head_sha"] = "c" * 40
        paths[f"{PREFIX}/runs/12/attempts/2/jobs?per_page=100&page=1"] = {"jobs": [
            {"name": name, "status": "completed", "conclusion": "success",
             "started_at": "2026-09-29T00:00:00Z",
             "completed_at": "2026-09-29T00:01:00Z"}
            for name in NEW_REQUIRED_JOBS]}
        self.assertTrue(self.resolve(paths)["budgetQualified"])

    def test_artifact_digest_and_unique_identity_are_required(self):
        paths = self.fixture()
        artifact = paths[f"{PREFIX}/runs/12/artifacts?per_page=100&page=1"]["artifacts"][0]
        artifact["digest"] = None
        with self.assertRaisesRegex(CandidateSourceError, "SHA256"):
            self.resolve(paths)
        paths = self.fixture()
        artifact = paths[f"{PREFIX}/runs/12/artifacts?per_page=100&page=1"]["artifacts"][0]
        duplicate = copy.deepcopy(artifact)
        duplicate["id"] = 43
        paths[f"{PREFIX}/runs/12/artifacts?per_page=100&page=1"]["artifacts"].append(duplicate)
        with self.assertRaisesRegex(CandidateSourceError, "不唯一"):
            self.resolve(paths)


if __name__ == "__main__":
    unittest.main()
