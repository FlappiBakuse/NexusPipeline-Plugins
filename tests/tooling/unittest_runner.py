from pathlib import Path
import argparse
import json
import sys
import unittest
import tools.repository.model as repository_model

SUITES = {"tooling", "ci", "architecture"}

def run_python_unit_gate(root: Path, suite_name: str = "tooling") -> dict[str, int]:
    """运行标准库 unittest，并把原生结果计数作为 gate 语义。"""
    if suite_name not in SUITES:
        raise repository_model.RepositoryError(f"未知 Python 测试组：{suite_name}")
    suite = unittest.defaultTestLoader.discover(str(root / "tests" / suite_name))
    result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
    tests_run = int(result.testsRun)
    failures = len(result.failures)
    errors = len(result.errors)
    skipped = len(result.skipped)
    unexpected_successes = len(result.unexpectedSuccesses)
    if tests_run <= 0:
        raise repository_model.RepositoryError("Plugins Python 单元测试发现零用例")
    if not result.wasSuccessful() or skipped:
        raise repository_model.RepositoryError(
            "Plugins Python 单元测试失败："
            f"testsRun={tests_run} failures={failures} errors={errors} skipped={skipped} "
            f"unexpectedSuccesses={unexpected_successes}")
    return {"testsRun": tests_run, "failures": failures, "errors": errors, "skipped": skipped,
            "unexpectedSuccesses": unexpected_successes}


def main() -> int:
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--suite", choices=sorted(SUITES), required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        parser.error("测试报告已经存在")
    report = {"schemaVersion": 1, "suite": args.suite, "status": "FAIL"}
    try:
        report["counts"] = run_python_unit_gate(args.root.resolve(), args.suite)
        report["status"] = "PASS"
    except (repository_model.RepositoryError, ImportError) as error:
        report["failure"] = str(error)
        print(error, file=sys.stderr)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
