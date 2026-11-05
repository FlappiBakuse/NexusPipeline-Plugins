"""Preserve original repository inputs and incrementally refresh an isolated build export."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from git_source import clean_commit, git_identity


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def ordinary_path(path):
    path = Path(path)
    if not path.is_absolute():
        raise ValueError("An explicit absolute path is required")
    for item in (path, *path.parents):
        if item.is_symlink() or item.is_junction():
            raise ValueError("Paths cannot traverse a link or reparse point")
    return path


def external_directory(root, output):
    source = ordinary_path(root).resolve(strict=True)
    target = ordinary_path(output).resolve()
    compared = []
    for value in (source, target):
        text = str(value)
        if os.name == "nt":
            text = "\\\\" + text[8:] if text.startswith("\\\\?\\UNC\\") else text.removeprefix("\\\\?\\")
        compared.append(Path(text))
    source_key, target_key = compared
    if source_key == target_key or source_key in target_key.parents or target_key in source_key.parents:
        raise ValueError("Output must be outside and disjoint from the source tree")
    return target


def immutable(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink() or path.is_junction():
        raise ValueError("Source evidence cannot be a link")
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError("Immutable source evidence changed")
    else:
        with path.open("xb") as stream:
            stream.write(data)


def source_files(root):
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        check=True, capture_output=True,
    )
    paths = set(result.stdout.decode("utf-8").split("\0")) - {""}
    deleted = subprocess.run(["git", "-C", str(root), "ls-files", "--deleted", "-z"],
                             check=True, capture_output=True)
    paths.difference_update(deleted.stdout.decode("utf-8").split("\0"))
    folded = {}
    records = []
    for relative in sorted(paths, key=lambda p: p.encode("utf-8")):
        relative = relative.replace("\\", "/")
        if relative.casefold() in folded:
            raise ValueError(f"Case-colliding source paths: {folded[relative.casefold()]}, {relative}")
        folded[relative.casefold()] = relative
        path = root / relative
        if path.is_symlink() or path.is_junction():
            raise ValueError(f"Source links are not permitted: {relative}")
        for parent in path.parents:
            if parent == root:
                break
            if parent.is_symlink() or parent.is_junction():
                raise ValueError(f"Source link parent: {relative}")
        if not path.is_file() or root not in path.resolve().parents:
            raise ValueError(f"Missing, external or non-file source input: {relative}")
        relative = path.resolve(strict=True).relative_to(root).as_posix()
        data = path.read_bytes()
        records.append({"path": relative, "sizeBytes": len(data), "sha256": sha(data), "mode": "100644"})
    if not records:
        raise ValueError("A source snapshot cannot be empty")
    return sorted(records, key=lambda record: record["path"].encode("utf-8"))


def snapshot(root, output, git_commit=None):
    output = external_directory(root, output)
    root = root.resolve(strict=True)
    if git_commit is not None:
        clean_commit(root, git_commit)
    if root == output or root in output.parents or output in root.parents:
        raise ValueError("Build output must be disjoint from the repository")
    for item in [output, *output.parents]:
        if item.is_symlink() or item.is_junction():
            raise ValueError("Build output cannot pass through a link")
    output.mkdir(parents=True, exist_ok=True)
    marker = output / "source-owner.json"
    marker_bytes = encode({"repository": str(root)})
    if not marker.exists() and any(output.iterdir()):
        raise ValueError("Nonempty output has no source ownership marker")
    immutable(marker, marker_bytes)
    records = source_files(root)
    for record in records:
        data = (root / record['path']).read_bytes()
        if sha(data) != record['sha256']:
            raise ValueError('Source changed before export')
        immutable(output / 'source-blobs' / record['sha256'], data)
    if not records:
        raise ValueError("Source snapshot cannot be empty")
    records.sort(key=lambda record: record["path"].encode())
    source_identity = git_identity(root, git_commit, records) if git_commit is not None else {
        "sourceMode": "local-uncommitted", "sourceCommit": None, "sourceTree": None}
    manifest = encode({"manifestAlgorithm": "nexus-source-manifest-sha256-v2-lf", "files": records})
    identity = sha(manifest)
    manifest_path = output / "source-manifests" / (identity + ".json")
    immutable(manifest_path, manifest)
    exported = output / "source"
    previous = output / "source-current.json"
    old_records = json.loads(previous.read_bytes())["files"] if previous.exists() else []
    for record in old_records:
        path = exported / record["path"]
        if path.is_symlink() or path.is_junction() or sha(path.read_bytes()) != record["sha256"]:
            raise ValueError("Previous build source changed outside its owner")
    known = {record["path"] for record in old_records}
    known_paths = {(exported / name).resolve(strict=True) for name in known}
    for path in exported.rglob("*") if exported.exists() else []:
        if path.is_symlink() or path.is_junction() or path.is_file() and path.resolve(strict=True) not in known_paths:
            raise ValueError("Unknown file in isolated source export")
    current = {record["path"] for record in records}
    for relative in known - current:
        (exported / relative).unlink()
    for record in records:
        destination = exported / record["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        data = (output / "source-blobs" / record["sha256"]).read_bytes()
        if not destination.exists() or destination.read_bytes() != data:
            destination.write_bytes(data)
    previous.write_bytes(manifest)
    if git_commit is not None and clean_commit(root, git_commit) != source_identity["sourceTree"]:
        raise ValueError("Git source changed during export")
    return {**source_identity,
            "manifestAlgorithm": "nexus-source-manifest-sha256-v2-lf", "sourceSnapshotHash": identity,
            "sourceManifestPath": str(manifest_path), "exportRoot": str(exported), "fileCount": len(records)}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--git-commit", help="Require exact clean Git bytes; no publication qualification")
    args = parser.parse_args()
    result = snapshot(Path(__file__).resolve().parent.parent, args.output, args.git_commit)
    (args.output / "source-receipt.json").write_bytes(encode(result))
    print(json.dumps(result, indent=2))
