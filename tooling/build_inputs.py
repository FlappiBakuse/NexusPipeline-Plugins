"""Expose plugin build declarations and prepare their required binary inputs."""
import argparse
import json
from pathlib import Path
from native_inputs import maa_runtime
from source_snapshot import external_directory


def declarations(root):
    policy = json.loads((root / "tooling/build-policy.json").read_bytes())
    selected = policy["bundledExtensions"]
    result = {}
    for kind in ("managed", "specialized"):
        for file in (root / "plugins" / kind).glob("*/extension.json"):
            value = json.loads(file.read_bytes())
            result[value["extensionId"]] = dict(kind=kind, frontend=bool(value.get("frontend")),
                specialized=bool(value.get("specialized")), bundled=value["extensionId"] in selected,
                native=bool(value.get("managed", {}).get("nativeLibraries")))
    if len(set(selected)) != len(selected) or set(selected) - result.keys():
        raise ValueError("Bundled plugin selection is invalid")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--extension")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    values = declarations(root)
    if not args.extension:
        print(json.dumps(values))
        return
    if not args.output or args.extension not in values or not values[args.extension]["native"]:
        raise ValueError("Declared native plugin and output required")
    output = external_directory(root, args.output)
    if args.extension != "maa-framework":
        raise ValueError("Native producer is not registered")
    print(json.dumps({"receipt": str(maa_runtime(root, output))}))


if __name__ == "__main__": main()
