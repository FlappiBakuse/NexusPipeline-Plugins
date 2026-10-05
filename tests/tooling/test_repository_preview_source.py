from __future__ import annotations

import unittest

from tools.release.provenance import CandidateSourceError, POLICIES, resolve_candidate

NEW_REQUIRED_JOBS = POLICIES["preview"]["jobs"]
BUILD_JOB_PREFIX = POLICIES["preview"]["buildPrefix"]


PREFIX = "repos/FlappiBakuse/NexusPipeline-Plugins/actions"
REPO = "FlappiBakuse/NexusPipeline-Plugins"
LEGACY_SHA = "4c695eede3e1dcb0232de8e13a94ea938bbfcaea"


class PreviewSourceTests(unittest.TestCase):
    def fixture(self):
        return {
            f"{PREFIX}/runs/12": {
                "id": 12, "repository": {"full_name": REPO}, "workflow_id": 7,
                "path": ".github/workflows/publish-develop.yml",
                "event": "workflow_dispatch", "head_branch": "main",
                "head_sha": LEGACY_SHA, "run_attempt": 2,
            },
            f"{PREFIX}/runs/99": {"id": 99, "repository": {"full_name": REPO}, "workflow_id": 7},
            f"{PREFIX}/runs/12/artifacts?per_page=100&page=1": {"artifacts": [{
                "id": 42, "name": "plugins-develop-preview-12-2", "expired": False,
                "size_in_bytes": 99, "workflow_run": {"id": 12},
                "digest": "sha256:" + "a" * 64,
            }]},
            f"{PREFIX}/runs/12/attempts/2/jobs?per_page=100&page=1": {"jobs": [{
                "name": "preview-build", "status": "completed", "conclusion": "success",
            }]},
        }

    def resolve(self, fixture):
        return resolve_candidate(lambda path: fixture[path], channel="preview", candidate_run_id=12,
                                 current_run_id=99)

    def test_legacy_candidate_is_rejected_for_any_controller(self):
        fixture = self.fixture()
        with self.assertRaisesRegex(CandidateSourceError, "未真实成功"):
            self.resolve(fixture)
        fixture[f"{PREFIX}/runs/12"]["head_sha"] = "f" * 40
        with self.assertRaisesRegex(CandidateSourceError, "未真实成功"):
            self.resolve(fixture)

    def test_staged_jobs_require_complete_budget_and_current_attempt(self):
        fixture = self.fixture()
        fixture[f"{PREFIX}/runs/12"]["head_sha"] = "f" * 40
        jobs = [{
            "name": name, "status": "completed", "conclusion": "success",
            "started_at": "2026-09-29T00:00:00Z",
            "completed_at": "2026-09-29T00:02:30Z",
        } for name in (*NEW_REQUIRED_JOBS, BUILD_JOB_PREFIX + "GameCheckIn")]
        fixture[f"{PREFIX}/runs/12/attempts/2/jobs?per_page=100&page=1"] = {"jobs": jobs}
        self.assertEqual(self.resolve(fixture)["runAttempt"], 2)
        jobs[-1]["completed_at"] = "2026-09-29T00:02:31Z"
        with self.assertRaisesRegex(CandidateSourceError, "超过 150 秒"):
            self.resolve(fixture)
        jobs[-1]["completed_at"] = "2026-09-29T00:02:30Z"
        jobs[-1]["conclusion"] = "skipped"
        with self.assertRaisesRegex(CandidateSourceError, "未真实成功"):
            self.resolve(fixture)
        jobs[-1]["conclusion"] = "success"
        fixture[f"{PREFIX}/runs/12"]["run_attempt"] = 3
        with self.assertRaisesRegex(CandidateSourceError, "过期 attempt"):
            self.resolve(fixture)


if __name__ == "__main__":
    unittest.main()
