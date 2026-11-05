"""Import authoritative contracts from a verified local SDK package, preserving its source identity."""
import argparse
import json
from pathlib import Path, PurePosixPath
import zipfile
from source_snapshot import encode, sha, ordinary_path


def mirror_path(root, relative):
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or "\\" in relative or ":" in relative or path.parts[0] != "contracts":
        raise ValueError("Unsafe contract mirror path")
    target = root / path
    for candidate in (target, *target.parents):
        if candidate == root: break
        if candidate.is_symlink() or candidate.is_junction(): raise ValueError("Contract mirror contains a link")
    return target


def import_sdk(root, receipt_path):
    root = ordinary_path(root).resolve(strict=True)
    receipt_path = ordinary_path(receipt_path).resolve(strict=True)
    receipt = json.loads(receipt_path.read_bytes())
    if receipt["status"] != "PASS":
        raise ValueError("SDK consumers did not pass")
    source = receipt["hostSource"]
    source_manifest = ordinary_path(source["sourceManifestPath"])
    if sha(source_manifest.read_bytes()) != source["sourceSnapshotHash"]:
        raise ValueError("Host source manifest differs from the SDK receipt")
    package = next(item for item in receipt["packages"] if item["path"].endswith(".nupkg"))
    path = ordinary_path(package["path"])
    if sha(path.read_bytes()) != package["sha256"]:
        raise ValueError("SDK package differs from its consumer proof")
    lock_path = root / "contracts/sdk-source-lock.json"
    previous = json.loads(lock_path.read_bytes()) if lock_path.exists() else None
    owned = previous.get("exportedContracts") if previous else {}
    if owned is None:
        raise ValueError("Existing contract mirror requires a verified export-membership lock")
    existing = {p.relative_to(root).as_posix() for p in (root / "contracts").rglob("*") if p.is_file() and p != lock_path}
    if existing != set(owned): raise ValueError("Contract mirror contains unowned or missing files")
    for relative, expected in owned.items():
        if sha(mirror_path(root, relative).read_bytes()) != expected: raise ValueError("Owned contract mirror changed")
    with zipfile.ZipFile(path) as archive:
        exported = {}
        for info in archive.infolist():
            if not info.filename.startswith("contracts/") or info.is_dir():
                continue
            relative = PurePosixPath(info.filename)
            if relative.is_absolute() or ".." in relative.parts or "\\" in info.filename or ":" in info.filename or info.file_size > 2097152:
                raise ValueError("Unsafe SDK contract member")
            if info.filename.casefold() in {name.casefold() for name in exported}:
                raise ValueError("SDK contract path collision")
            exported[info.filename] = archive.read(info)
        fingerprint = json.loads(exported["contracts/fingerprint.json"])
        if fingerprint["contractFingerprint"] != receipt["contractFingerprint"]:
            raise ValueError("SDK fingerprint differs from consumer proof")
        for relative in exported: mirror_path(root, relative)
        for relative in set(owned) - set(exported):
            target = (root / relative).resolve(strict=True)
            if (root / "contracts").resolve() not in target.parents: raise ValueError("Obsolete contract escaped mirror")
            if target.is_symlink() or target.is_junction(): raise ValueError("Obsolete contract is a link")
            target.unlink()
        for relative, data in exported.items():
            target = root / relative
            if target.is_symlink() or target.is_junction():
                raise ValueError("Contract mirror contains a link")
            for parent in target.parents:
                if parent == root: break
                if parent.is_symlink() or parent.is_junction():
                    raise ValueError("Contract mirror contains a link parent")
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.read_bytes() != data:
                target.write_bytes(data)
    lock = {"sdkVersion": "0.1.0", "contractFingerprint": receipt["contractFingerprint"],
            "sourceMode": source["sourceMode"], "sourceCommit": source["sourceCommit"], "sourceTree": source["sourceTree"],
            "sourceSnapshotHash": source["sourceSnapshotHash"], "sourceManifestSha256": sha(source_manifest.read_bytes()),
            "sourceManifestAlgorithm": source["manifestAlgorithm"],
            "dotnetPackageSha256": package["sha256"], "consumerReceiptSha256": sha(receipt_path.read_bytes()),
            "exportedContracts": {relative: sha(data) for relative, data in sorted(exported.items())},
            "publication": "local-only-unpublished"}
    (root / "contracts/sdk-source-lock.json").write_bytes(encode(lock))
    return lock


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(import_sdk(Path(__file__).resolve().parent.parent, args.receipt), indent=2))
