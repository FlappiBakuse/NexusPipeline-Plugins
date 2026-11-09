"""Run source-derived GameActivities components against one verified production SDK package."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from managed_probe import verify_probe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("output", "cache", "sdk-receipt"):
        parser.add_argument("--" + option, type=Path, required=True)
    parser.add_argument("--source-fields", type=Path)
    args = parser.parse_args()
    tests = Path(__file__).resolve().parent
    root = tests.parents[1]
    fixtures = tests / "fixtures"
    files = [*root.joinpath("plugins/managed/game-activities/src").rglob("*.cs"), *tests.rglob("*.cs"),
             *fixtures.glob("*.json"), Path(__file__)]
    scenarios = [("fixtures", [str(fixtures)])]
    if args.source_fields:
        source = args.source_fields.resolve(strict=True)
        if not source.is_dir():
            raise ValueError("Source fields must be a directory")
        files.extend(source.glob("*.json"))
        scenarios.append(("actual-source-fields", ["--source-fields", str(source)]))
    return verify_probe(root, args, tests / "ActivityProbe.csproj", files, scenarios,
                        "Source-derived business and actual SDK DTO/dispatch components with fake Host ports; not installed Host/real HTTP qualification")


if __name__ == "__main__":
    raise SystemExit(main())
