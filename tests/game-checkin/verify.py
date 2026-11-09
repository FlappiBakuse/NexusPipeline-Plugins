"""Verify CheckIn policy, SDK adapters or the original packaged entry with synthetic ports."""
import argparse
import json
from pathlib import Path
import sys
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from managed_probe import verify_probe
from sdk_inputs import verified_sdk
from source_snapshot import sha


def original_package(receipt, fingerprint):
    raw = receipt.read_bytes()
    packed = json.loads(raw)
    artifact = Path(packed["artifact"]["path"])
    if (packed["status"] != "PASS" or packed["extensionId"] != "game-checkin" or
            packed["contractFingerprint"] != fingerprint or sha(artifact.read_bytes()) != packed["artifact"]["sha256"]):
        raise ValueError("Original package identity differs from the requested producer")
    with ZipFile(artifact) as archive:
        members = {item["path"]: item["sha256"] for item in packed["members"]}
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != set(members) or any(sha(archive.read(name)) != digest for name, digest in members.items()):
            raise ValueError("Original package member bytes differ")
        manifest = json.loads(archive.read("manifest.json"))
        entry = manifest["managed"]["entryAssembly"]
        if (manifest["extensionId"] != "game-checkin" or manifest["packageVersion"] != "0.5.0" or
                manifest["contractFingerprint"] != fingerprint or entry != "NexusPipeline.Extensions.GameCheckIn.dll"):
            raise ValueError("Original entry declaration differs")
        assembly_sha = sha(archive.read(entry))
    return artifact, {"receipt": str(receipt), "receiptSha256": sha(raw), "artifact": packed["artifact"], "assemblySha256": assembly_sha}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--sdk-receipt", type=Path)
    parser.add_argument("--package-receipt", type=Path)
    args = parser.parse_args()
    if args.package_receipt and not args.sdk_receipt:
        parser.error("An actual package probe requires its verified SDK producer")
    tests = Path(__file__).resolve().parent
    root = tests.parents[1]
    project = tests / ("sdk/CheckInSdkProbe.csproj" if args.sdk_receipt else "PolicyProbe.csproj")
    files, arguments, evidence = [Path(__file__)], [], {}
    sdk_input = None
    if args.package_receipt:
        sdk_input = verified_sdk(root, args.sdk_receipt)
        artifact, original = original_package(args.package_receipt, sdk_input[1]["contractFingerprint"])
        files += [args.package_receipt, artifact]
        arguments = [str(artifact), original["assemblySha256"]]
        evidence["originalPackage"] = original
        scope = "Original ZIP entry through SDK interfaces with fake Host ports"
    elif args.sdk_receipt:
        scope = "SDK DTO, persistence and handler components with fake Host ports"
    else:
        scope = "Pure platform, task, editor and HTTP-format policies with synthetic responses and fake network"
    return verify_probe(root, args, project, files, [("", arguments)], scope, input_field="compiledInputs",
                        evaluated=True, sdk_input=sdk_input, evidence=evidence)


if __name__ == "__main__":
    raise SystemExit(main())
