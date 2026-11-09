"""Compile and execute vendor policies with synthetic Host resources; no vendor program is launched."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from managed_probe import verify_probe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("output", "cache", "sdk-receipt"):
        parser.add_argument("--" + option, type=Path, required=True)
    args = parser.parse_args()
    tests = Path(__file__).resolve().parent
    root = tests.parents[1]
    files = [*root.joinpath("plugins/managed/emulator-support/src").rglob("*.cs"), *tests.rglob("*.cs"), Path(__file__)]
    return verify_probe(root, args, tests / "EmulatorProbe.csproj", files, [("", [])],
                        "Production vendor parsing, selection and session components against the packaged SDK with synthetic Host resources",
                        input_field="compiledInputs")


if __name__ == "__main__":
    raise SystemExit(main())
