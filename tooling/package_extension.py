"""Create a deterministic installable ZIP from explicitly bound compiler receipts."""
import argparse
from datetime import datetime, timezone
import io
import json
import re
from pathlib import Path, PurePosixPath
import zipfile
from package_inputs import inputs
from source_snapshot import encode, immutable, sha, external_directory


def archive(members):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        folded = set()
        for name, data in sorted(members.items(), key=lambda item: item[0].encode()):
            path = PurePosixPath(name)
            if not name or path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name or name.casefold() in folded:
                raise ValueError("Unsafe or colliding package member")
            folded.add(name.casefold())
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3; entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            package.writestr(entry, data, compresslevel=9)
    data = output.getvalue()
    with zipfile.ZipFile(io.BytesIO(data)) as package:
        if package.testzip() is not None or set(package.namelist()) != set(members):
            raise ValueError("Package inventory verification failed")
        for name, original in members.items():
            if package.read(name) != original:
                raise ValueError("Packaged bytes differ from their source")
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-receipt", type=Path, required=True)
    parser.add_argument("--sdk-receipt", type=Path, required=True)
    parser.add_argument("--frontend-receipt", type=Path)
    parser.add_argument("--runtime-receipt", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = external_directory(root, args.output)
    if root == output or root in output.parents or output in root.parents:
        raise ValueError("Package output must be disjoint from the repository")
    for path in [output, *output.parents]:
        if path.is_symlink() or path.is_junction(): raise ValueError("Package output cannot pass through links")
    if output.exists() and not (output / "package-owner.json").exists() and any(output.iterdir()):
        raise ValueError("Nonempty package output has no ownership marker")
    output.mkdir(parents=True, exist_ok=True)
    immutable(output / "package-owner.json", encode({"repository": str(root)}))
    manifest, members, source = inputs(root, args.build_receipt, args.sdk_receipt, args.frontend_receipt, args.runtime_receipt)
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]{0,79}", manifest["artifactName"]):
        raise ValueError("Artifact name is not portable")
    data = archive(members)
    if data != archive(members): raise ValueError("Repeated assembly is not deterministic")
    digest = sha(data)
    filename = f"{manifest['artifactName']}-{manifest['packageVersion']}-{digest[:12]}.zip"
    target = output / filename; immutable(target, data)
    receipt = {"status": "PASS", "scope": "Source-bound deterministic installable ZIP; runtime and business qualification remain separate",
        "createdAt": datetime.now(timezone.utc).isoformat(), "extensionId": manifest["extensionId"],
        "packageVersion": manifest["packageVersion"], "manifestSha256": sha(members["manifest.json"]),
        "artifact": {"path": str(target), "sizeBytes": len(data), "sha256": digest},
        "determinism": "two assemblies are byte-identical", "members": [
            {"path": name, "sizeBytes": len(content), "sha256": sha(content)} for name, content in sorted(members.items())], **source}
    receipt_path = output / "receipts" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + "-" + filename + ".json")
    immutable(receipt_path, encode(receipt))
    print(json.dumps({"status": "PASS", "receipt": str(receipt_path), "artifact": str(target)}))


if __name__ == "__main__": main()
