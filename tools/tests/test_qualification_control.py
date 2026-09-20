from __future__ import annotations

import base64
import json
import unittest

from tools.qualification_control import (
    CHECK_NAME,
    EXTERNAL_ID,
    QualificationError,
    begin_check,
    collect_gate_results,
    read_pull_request,
    resolve_candidate,
    resolve_main_queue,
    resolve_merged_candidate,
    verify_merged_candidate,
)
from tools.qualification_contract import make_external_id


H = "a" * 40
B = "b" * 40
M = "c" * 40
C = B
SDK = "d" * 40


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
            {"name": "P1", "run_id": 12, "status": "completed", "conclusion": "success", "run_attempt": 2, "steps": [{"name": "Execute gate", "status": "completed", "conclusion": "success"}]},
            {"name": "P2", "run_id": 12, "status": "completed", "conclusion": "skipped", "run_attempt": 2, "steps": [{"name": "Execute gate", "status": "completed", "conclusion": "success"}]},
            {"name": "P3", "run_id": 12, "status": "completed", "conclusion": "success", "run_attempt": 2, "steps": [{"name": "Execute gate", "status": "completed", "conclusion": "success"}]},
        ]
        api = FakeApi({("GET", "/repos/FlappiBakuse/NexusPipeline-Plugins/actions/runs/12/attempts/2/jobs?per_page=100&page=1"): {"jobs": jobs}})
        with self.assertRaisesRegex(QualificationError, "P2"):
            collect_gate_results("FlappiBakuse/NexusPipeline-Plugins", 12, "secret", run_attempt=2, request_fn=api)

        jobs[1] = {"name": "P2", "run_id": 12, "status": "completed", "conclusion": "success", "run_attempt": 2, "steps": [{"name": "Execute gate", "status": "completed", "conclusion": "success"}]}
        jobs.append(dict(jobs[0]))
        with self.assertRaisesRegex(QualificationError, "P1"):
            collect_gate_results("FlappiBakuse/NexusPipeline-Plugins", 12, "secret", run_attempt=2, request_fn=api)

    def test_begin_check_rejects_same_name_from_other_app(self) -> None:
        api = FakeApi({
            ("GET", f"/repos/FlappiBakuse/NexusPipeline-Plugins/commits/{H}/check-runs?per_page=100"): {
                "check_runs": [{"id": 9, "name": CHECK_NAME, "external_id": "other", "app": {"id": 123}}],
            },
        })
        with self.assertRaisesRegex(QualificationError, "其他 App"):
            begin_check("FlappiBakuse/NexusPipeline-Plugins", H, 456, "secret", {"H": H}, base_sha=B, workflow_sha=B, run_id=12, run_attempt=2, request_fn=api)

    def test_policy_identifiers_are_stable(self) -> None:
        self.assertEqual(EXTERNAL_ID, "plugins-release-qualification-v1")
        self.assertEqual(make_external_id("FlappiBakuse/NexusPipeline-Plugins", H, B, B, 12, 2), f"FlappiBakuse/NexusPipeline-Plugins:qualification:{H}:{B}:{B}:12:2")

    def test_resolve_merged_discovers_and_rechecks_structured_proof(self) -> None:
        repository = "FlappiBakuse/NexusPipeline-Plugins"
        proof = {
            "schemaVersion": 1,
            "repository": repository,
            "headSha": H,
            "baseSha": B,
            "workflowSha": C,
            "runId": 12,
            "runAttempt": 2,
            "appId": 456,
            "sdkSourceSha": SDK,
            "contractSourceSha": SDK,
            "gates": {name: "success" for name in ("P1", "P2", "P3")},
        }
        check = {
            "id": 99,
            "name": CHECK_NAME,
            "head_sha": H,
            "external_id": make_external_id(repository, H, B, C, 12, 2),
            "app": {"id": 456},
            "conclusion": "success",
            "output": {"text": json.dumps(proof, separators=(",", ":"))},
        }
        pull = {
            "number": 7,
            "merged": True,
            "merge_commit_sha": M,
            "draft": False,
            "base": {"ref": "main", "sha": B, "repo": {"full_name": repository}},
            "head": {"sha": H, "repo": {"full_name": repository}},
        }
        jobs = [
            {"name": name, "run_id": 12, "status": "completed", "conclusion": "success", "run_attempt": 2, "steps": [{"name": "Execute gate", "status": "completed", "conclusion": "success"}]}
            for name in ("P1", "P2", "P3")
        ]
        api = FakeApi({
            ("GET", f"/repos/{repository}/git/ref/heads/main"): {"object": {"sha": M}},
            ("GET", f"/repos/{repository}/commits/{M}/pulls?per_page=100"): [{"number": 7}],
            ("GET", f"/repos/{repository}/pulls/7"): pull,
            ("GET", f"/repos/{repository}/commits/{H}/check-runs?per_page=100&page=1"): {"check_runs": [check]},
            ("GET", f"/repos/{repository}/git/commits/{M}"): {"parents": [{"sha": B}], "tree": {"sha": "tree"}},
            ("GET", f"/repos/{repository}/git/commits/{H}"): {"tree": {"sha": "tree"}},
            ("GET", f"/repos/{repository}/actions/runs/12"): {"id": 12, "run_attempt": 2, "repository": {"full_name": repository}, "event": "workflow_dispatch", "head_branch": "main", "head_sha": C, "path": ".github/workflows/release-qualification.yml", "status": "completed", "conclusion": "success"},
            ("GET", f"/repos/{repository}/actions/runs/12/attempts/2/jobs?per_page=100&page=1"): {"jobs": jobs},
        })
        result = resolve_merged_candidate(repository, M, 456, "secret", request_fn=api)
        self.assertEqual(result["prNumber"], 7)
        self.assertEqual(result["headSha"], H)
        self.assertEqual(result["runAttempt"], 2)
        self.assertEqual(result["sdkSourceSha"], SDK)

    def test_resolve_main_queue_skips_generated_only_commit_and_never_guesses(self) -> None:
        repository = "FlappiBakuse/NexusPipeline-Plugins"
        state = base64.b64encode(json.dumps({"schemaVersion": 1, "sourceCommit": B}).encode("utf-8")).decode("ascii")
        api = FakeApi({
            ("GET", f"/repos/{repository}/git/ref/heads/main"): {"object": {"sha": M}},
            ("GET", f"/repos/{repository}/contents/.release-state.json?ref=main"): {"encoding": "base64", "content": state},
            ("GET", f"/repos/{repository}/commits/{M}"): {"parents": [{"sha": B}], "files": [{"filename": "catalog.json"}]},
        })
        with self.assertRaisesRegex(QualificationError, "source cursor 已追平"):
            resolve_main_queue(repository, M, 456, "secret", request_fn=api)


if __name__ == "__main__":
    unittest.main()
