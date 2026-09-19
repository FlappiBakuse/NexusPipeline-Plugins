from __future__ import annotations

import unittest

from tools.qualification_control import (
    CHECK_NAME,
    EXTERNAL_ID,
    QualificationError,
    begin_check,
    collect_gate_results,
    read_pull_request,
    resolve_candidate,
)


H = "a" * 40
B = "b" * 40


class FakeApi:
    def __init__(self, responses: dict[tuple[str, str], object]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, str, object]] = []

    def __call__(self, method: str, path: str, _token: str | None, payload: object) -> object:
        self.calls.append((method, path, payload))
        response = self.responses.get((method, path))
        if isinstance(response, Exception):
            raise response
        if response is None:
            raise AssertionError(f"unexpected request: {method} {path}")
        return response


def pull_payload(*, state: str = "open", head: str = H, head_repo: str = "FlappiBakuse/NexusPipeline") -> dict:
    return {
        "state": state,
        "base": {"ref": "main", "repo": {"full_name": "FlappiBakuse/NexusPipeline"}},
        "head": {"sha": head, "repo": {"full_name": head_repo}},
    }


class QualificationControlTests(unittest.TestCase):
    def test_read_pull_rejects_fork_even_with_matching_head(self) -> None:
        api = FakeApi({("GET", "/repos/FlappiBakuse/NexusPipeline/pulls/7"): pull_payload(head_repo="someone/fork")})
        with self.assertRaisesRegex(QualificationError, "同一官方仓库"):
            read_pull_request("FlappiBakuse/NexusPipeline", 7, H, "secret", request_fn=api)

    def test_resolve_candidate_requires_c_equal_b_and_ancestor(self) -> None:
        api = FakeApi({
            ("GET", "/repos/FlappiBakuse/NexusPipeline-Plugins/git/ref/heads/main"): {"object": {"sha": B}},
        })
        with self.assertRaisesRegex(QualificationError, "C 必须等于"):
            resolve_candidate("FlappiBakuse/NexusPipeline-Plugins", H, "c" * 40, "secret", request_fn=api)

        class Result:
            returncode = 1

        with self.assertRaisesRegex(QualificationError, "祖先"):
            resolve_candidate("FlappiBakuse/NexusPipeline-Plugins", H, B, "secret", request_fn=api, git_runner=lambda _args: Result())

    def test_collect_gate_results_rejects_duplicate_or_skipped(self) -> None:
        jobs = [
            {"name": "P1", "status": "completed", "conclusion": "success", "run_attempt": 1},
            {"name": "P2", "status": "completed", "conclusion": "skipped", "run_attempt": 1},
            {"name": "P3", "status": "completed", "conclusion": "success", "run_attempt": 1},
        ]
        api = FakeApi({("GET", "/repos/FlappiBakuse/NexusPipeline-Plugins/actions/runs/12/attempts/1/jobs?per_page=100&page=1"): {"jobs": jobs}})
        with self.assertRaisesRegex(QualificationError, "P2"):
            collect_gate_results("FlappiBakuse/NexusPipeline-Plugins", 12, "secret", request_fn=api)

        jobs[1] = {"name": "P2", "status": "completed", "conclusion": "success", "run_attempt": 1}
        jobs.append(dict(jobs[0]))
        with self.assertRaisesRegex(QualificationError, "P1"):
            collect_gate_results("FlappiBakuse/NexusPipeline-Plugins", 12, "secret", request_fn=api)

    def test_begin_check_rejects_same_name_from_other_app(self) -> None:
        api = FakeApi({
            ("GET", f"/repos/FlappiBakuse/NexusPipeline-Plugins/commits/{H}/check-runs?per_page=100"): {
                "check_runs": [{"id": 9, "name": CHECK_NAME, "external_id": "other", "app": {"id": 123}}],
            },
        })
        with self.assertRaisesRegex(QualificationError, "其他 App"):
            begin_check("FlappiBakuse/NexusPipeline-Plugins", H, 456, "secret", {"H": H}, request_fn=api)

    def test_policy_identifiers_are_stable(self) -> None:
        self.assertEqual(EXTERNAL_ID, "plugins-release-qualification-v1")


if __name__ == "__main__":
    unittest.main()
