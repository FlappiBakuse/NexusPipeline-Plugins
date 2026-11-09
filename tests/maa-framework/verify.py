"""Compile the current frozen-memory Maa compiler; no native process, device or game is started."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from managed_probe import verify_probe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    parser.add_argument("--corpus", type=Path, help="Optional explicitly supplied local data corpus; never required by the source build or normal fixture tests")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    project = root / "tests/maa-framework/CompilerProbe.csproj"
    corpus = [args.corpus.resolve()] if args.corpus else []
    return verify_probe(root, args, project, [Path(__file__), *corpus], [("", list(map(str, corpus)))],
                        "Frozen-memory PI/import compiler with synthetic fixtures and an optional explicit local corpus",
                        input_field="compiledInputs", evaluated=True)


if __name__ == "__main__":
    raise SystemExit(main())
