from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request


def require(condition, message):
    if not condition:
        raise ValueError(message)


def canonical_digest(path):
    content = path.read_bytes()
    require(not content.startswith(b"\xef\xbb\xbf"), "Policy BOM")
    return hashlib.sha256(content.replace(b"\r\n", b"\n")).hexdigest()


def exact(actual, expected):
    return isinstance(actual, list) and len(actual) == len(set(actual)) and sorted(actual) == sorted(expected)


def api(route):
    request = urllib.request.Request(os.environ["GITHUB_API_URL"] + route,
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"], "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.load(response)


def all_jobs(repository, run, attempt):
    route = f"/repos/{repository}/actions/runs/{run}/attempts/{attempt}/jobs"
    first = api(route + "?per_page=100&page=1")
    count = first["total_count"]
    require(isinstance(count, int) and 0 <= count <= 2000, "Invalid job count")
    jobs = list(first["jobs"])
    for page in range(2, (count + 99) // 100 + 1):
        jobs.extend(api(route + f"?per_page=100&page={page}")["jobs"])
    require(len(jobs) == count and len({job["id"] for job in jobs}) == count, "Incomplete job pagination")
    return jobs


def main():
    root, reports = Path(sys.argv[1]), Path(sys.argv[2])
    registry = json.loads((root / "tests/gates.json").read_bytes())
    policy = json.loads((root / "tests/policy.json").read_bytes())
    repository_name = registry["repository"]
    prefix = repository_name.lower()
    run, attempt = os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"]
    tested_sha = os.environ["GITHUB_SHA"]
    needs = json.loads(os.environ["CI_NEEDS"])
    require(needs.get("scope", {}).get("result") == "success", "Scope job failed")
    scope_files = list(reports.rglob("scope.json"))
    require(len(scope_files) == 1, "Missing or duplicate scope plan")
    plan = json.loads(scope_files[0].read_bytes())
    require(plan["repository"] == repository_name and plan["runId"] == run and plan["attempt"] == attempt,
            "Foreign scope plan")
    require(plan["testedSha"] == tested_sha and not plan["dirty"], "Wrong tested source")
    require(plan["policyDigest"] == canonical_digest(root / "tests/gates.json") and plan["digestFormat"] == "utf8-lf-v1",
            "Wrong gate policy")
    require(len(plan["selected"]) == len({item["id"] for item in plan["selected"]}), "Duplicate selected gate")
    require(len(plan["notApplicable"]) == len({item["id"] for item in plan["notApplicable"]}), "Duplicate N/A gate")
    declared = {gate["id"] for gate in registry["gates"] if gate["kind"] != "matrix-template"}
    declared.update(f"{gate['id']}:{artifact}" for gate in registry["gates"] if gate["kind"] == "matrix-template"
                    for artifact in policy["plugins"])
    routed = {item["id"] for item in plan["selected"] + plan["notApplicable"]}
    require(declared == routed and not ({item["id"] for item in plan["selected"]}
                                  & {item["id"] for item in plan["notApplicable"]}), "Incomplete gate disposition")
    selected = [item["id"] for item in plan["selected"] if item["id"] not in {f"{prefix}.scope", f"{prefix}.required"}]
    gate_result = needs.get("gates", {}).get("result")
    require(gate_result == ("success" if selected else "skipped"), "Selected matrix failed or skipped")
    names = {gate["id"]: gate["name"] for gate in registry["gates"] if gate["kind"] != "matrix-template"}
    names.update({f"{gate['id']}:{artifact}": gate["name"].replace("${artifact}", artifact)
                  for gate in registry["gates"] if gate["kind"] == "matrix-template" for artifact in policy["plugins"]})
    report_files = list(reports.rglob("gate-report.json"))
    gate_reports = {}
    for file in report_files:
        report = json.loads(file.read_bytes())
        gate_id = report.get("gateId")
        require(gate_id not in gate_reports, "Duplicate gate report")
        gate_reports[gate_id] = (file, report)
    require(set(gate_reports) == set(selected), "Missing or unexpected gate report")
    for gate_id in selected:
        file, report = gate_reports[gate_id]
        require(report["scope"] == "LOCAL_GATE" and report["status"] == "PASS" and report["exitCode"] == 0,
                f"Gate failed: {gate_id}")
        require(report["source"]["commitSha"] == tested_sha and not report["source"]["workingTreeDirty"],
                f"Foreign or dirty gate source: {gate_id}")
        require(report["policyDigest"] == plan["policyDigest"] and report["runId"] == f"{run}-{attempt}-{gate_id.replace('.', '-').replace(':', '-')}",
                f"Wrong gate run identity: {gate_id}")
        require(report["cleanup"]["cleanupComplete"], f"Incomplete cleanup: {gate_id}")
        artifacts = report.get("artifacts")
        require(isinstance(artifacts, list) and len(artifacts) == len({item.get("file") for item in artifacts}),
                f"Invalid artifact inventory: {gate_id}")
        for item in artifacts:
            relative = Path(item["file"])
            require(not relative.is_absolute() and relative.parts and all(part not in {".", ".."} for part in relative.parts),
                    f"Unsafe artifact path: {gate_id}")
            payload = file.parent / relative
            require(payload.is_file() and not payload.is_symlink()
                    and hashlib.sha256(payload.read_bytes()).hexdigest() == item.get("sha256"),
                    f"Artifact digest mismatch: {gate_id}")
        timing = report["timing"]
        require(timing["actualJobMs"] is None and timing["qualificationMs"] == 150000
                and timing["hardTimeoutMs"] == 180000 and 0 <= timing["localElapsedMs"] <= 150000,
                f"Local gate budget exceeded: {gate_id}")
        template, _, artifact = gate_id.partition(":")
        gate = next((item for item in registry["gates"] if item["id"] == template), None)
        require(gate is not None, f"Unknown gate: {gate_id}")
        if gate["partnerRequired"]:
            require(report["partner"] and report["partner"]["commitSha"] == plan["partnerSha"]
                    and not report["partner"]["workingTreeDirty"], f"Wrong partner: {gate_id}")
        if artifact:
            item = policy["plugins"][artifact]
            dimension = template.removeprefix("plugins.plugin.")
            if dimension == "component":
                require(report["counts"] and report["counts"]["failed"] == report["counts"]["skipped"] == 0
                        and report["counts"]["passed"] > 0, f"Missing component cases: {gate_id}")
                methods = {case.split("(")[0] for case in report["completedCases"]}
                require(methods == set(item["expectedMethods"]), f"Wrong component methods: {gate_id}")
                native_path, raw_path = file.parent / "native.json", file.parent / "native.trx"
                require(native_path.is_file() and raw_path.is_file() and raw_path.stat().st_size > 0,
                        f"Missing component native report: {gate_id}")
                native = json.loads(native_path.read_bytes())
                require(exact(native["caseIds"], report["completedCases"]) and native["failed"] == native["skipped"] == 0
                        and native["passed"] == report["counts"]["passed"], f"Wrong component native results: {gate_id}")
            elif dimension in {"adapter", "capability"}:
                require(report["counts"] and report["counts"]["passed"] > 0
                        and report["counts"]["failed"] == report["counts"]["skipped"] == 0,
                        f"Missing real plugin results: {gate_id}")
                require(exact(report["completedCases"], report["selectedCases"]), f"Wrong case set: {gate_id}")
                if dimension == "capability":
                    require(report["scenarios"] == [item["realScenario"]], f"Wrong real scenario: {gate_id}")
                if item["kind"] == "data-specialized":
                    require(exact(report["completedCases"], item["fixtureIds"]), f"Wrong adapter fixtures: {gate_id}")
                    for fixture in item["fixtureIds"]:
                        fixture_path = file.parent / "native" / f"{artifact}-{fixture}.json"
                        require(fixture_path.is_file(), f"Missing native adapter fixture: {fixture}")
                        native = json.loads(fixture_path.read_bytes())
                        require(native["completedCaseIds"] == [fixture] and native["passed"] == 1
                                and native["failed"] == native["skipped"] == 0,
                                f"Wrong native adapter fixture: {fixture}")
                else:
                    require({case.split("(")[0] for case in report["completedCases"]} == set(item["expectedMethods"]),
                            f"Wrong managed methods: {gate_id}")
                    native_path = file.parent / "native" / f"{artifact}-native.json"
                    raw_path = file.parent / "native" / f"{artifact}-native.trx"
                    require(native_path.is_file() and raw_path.is_file() and raw_path.stat().st_size > 0,
                            f"Missing managed native report: {gate_id}")
                    native = json.loads(native_path.read_bytes())
                    require(exact(native["caseIds"], report["completedCases"]) and native["failed"] == native["skipped"] == 0,
                            f"Wrong managed native report: {gate_id}")
                require((file.parent / "native").is_dir(), f"Missing native capability evidence: {gate_id}")
            elif dimension == "package":
                manifest = file.parent / "package-input.json"
                require(manifest.is_file(), f"Missing package input manifest: {gate_id}")
                inputs = json.loads(manifest.read_bytes())["inputs"]
                require({entry["file"] for entry in inputs} >= {"plugin.json", "store.json"},
                        f"Incomplete package inputs: {gate_id}")
                package_report = file.parent / "package-report.json"
                require(package_report.is_file(), f"Missing built package report: {gate_id}")
                built = json.loads(package_report.read_bytes())
                package = file.parent / "package" / built["fileName"]
                require(package.is_file() and package.parent == file.parent / "package"
                        and not package.is_symlink(), f"Missing built package: {gate_id}")
                require(built["status"] == "PASS" and built["artifactName"] == artifact
                        and built["kind"] == item["kind"] and built["sizeBytes"] == package.stat().st_size
                        and built["sha256"] == hashlib.sha256(package.read_bytes()).hexdigest(),
                        f"Built package identity mismatch: {gate_id}")
    jobs = all_jobs(os.environ["GITHUB_REPOSITORY"], run, attempt)
    durations = {}
    for name in [names[f"{prefix}.scope"], *(names[item] for item in selected)]:
        matches = [job for job in jobs if job["name"] == name]
        require(len(matches) == 1, f"Missing or duplicate completed job: {name}")
        job = matches[0]
        require(str(job["run_id"]) == run and str(job["run_attempt"]) == attempt
                and job["status"] == "completed" and job["conclusion"] == "success", f"Failed Actions job: {name}")
        start = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
        elapsed = (end - start).total_seconds() * 1000
        require(0 <= elapsed <= 150000, f"Full job exceeded 150 seconds: {name}")
        durations[name] = elapsed
    print(json.dumps({"status": "PASS", "scope": "ACTIONS_PREDECESSORS", "run": run,
                      "attempt": attempt, "testedSha": tested_sha, "actualJobMs": durations}, ensure_ascii=False))


if __name__ == "__main__":
    main()
