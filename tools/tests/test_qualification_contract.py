from __future__ import annotations

import unittest

from tools.qualification_contract import ContractError, parse_strict_json, validate_jobs, validate_proof


H = "a" * 40
B = "b" * 40
D = "d" * 40


def proof() -> dict:
    return {
        "schemaVersion": 1,
        "repository": "FlappiBakuse/NexusPipeline-Plugins",
        "headSha": H,
        "baseSha": B,
        "workflowSha": B,
        "runId": 12,
        "runAttempt": 2,
        "appId": 17,
        "sdkSourceSha": D,
        "contractSourceSha": D,
        "gates": {name: "success" for name in ("P1", "P2", "P3")},
    }


class QualificationContractTests(unittest.TestCase):
    def test_valid_plugins_proof(self) -> None:
        value = proof()
        validate_proof(value, repository=value["repository"], head_sha=H, base_sha=B, workflow_sha=B, run_id=12, run_attempt=2, app_id=17, gate_names=("P1", "P2", "P3"), sdk_source_sha=D, contract_source_sha=D)

    def test_duplicate_unknown_bool_and_prefix_are_rejected(self) -> None:
        with self.assertRaises(ContractError):
            parse_strict_json('{"runId": 12, "runId": 123}')
        value = proof()
        for changed in ({**value, "trusted": True}, {**value, "runId": True}, {**value, "runId": 1234}):
            with self.subTest(changed=changed), self.assertRaises(ContractError):
                validate_proof(changed, repository=value["repository"], head_sha=H, base_sha=B, workflow_sha=B, run_id=12, run_attempt=2, app_id=17, gate_names=value["gates"], sdk_source_sha=D, contract_source_sha=D)

    def test_skipped_execution_step_is_not_success(self) -> None:
        jobs = [{"name": "P1", "run_id": 12, "status": "completed", "conclusion": "success", "steps": [{"name": "Execute gate", "status": "completed", "conclusion": "skipped"}]}]
        with self.assertRaises(ContractError):
            validate_jobs(jobs, request_run_id=12, request_attempt=2, gate_names=("P1",))


if __name__ == "__main__":
    unittest.main()
