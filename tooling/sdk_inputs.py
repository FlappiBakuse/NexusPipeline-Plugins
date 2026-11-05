"""Verify explicit SDK packages and the repository's exact exported contract mirror."""
import json
from pathlib import Path
import zipfile
from source_snapshot import sha, ordinary_path


def verified_sdk(root, receipt):
    receipt = ordinary_path(receipt)
    raw = receipt.read_bytes()
    sdk = json.loads(raw)
    if sdk["status"] != "PASS" or not sdk.get("hostSource", {}).get("sourceSnapshotHash"):
        raise ValueError("SDK receipt lacks successful source-bound consumer proof")
    package = next(item for item in sdk["packages"] if item["path"].endswith(".nupkg"))
    package_path = ordinary_path(package["path"]).resolve(strict=True)
    if sha(package_path.read_bytes()) != package["sha256"]:
        raise ValueError("SDK package differs from its immutable receipt")
    with zipfile.ZipFile(package_path) as archive:
        exported = {}
        for name in archive.namelist():
            if name.startswith("contracts/") and not name.endswith("/"):
                if ".." in Path(name).parts or Path(name).is_absolute() or "\\" in name or ":" in name:
                    raise ValueError("Unsafe SDK contract path")
                if archive.read(name) != (root / name).read_bytes():
                    raise ValueError("Repository contract mirror differs from the SDK package")
                exported[name] = sha(archive.read(name))
    lock = json.loads((root / "contracts/sdk-source-lock.json").read_bytes())
    existing = {p.relative_to(root).as_posix() for p in (root / "contracts").rglob("*")
                if p.is_file() and p.name != "sdk-source-lock.json"}
    if lock.get("exportedContracts") != exported or existing != set(exported):
        raise ValueError("Contract mirror membership differs from the SDK package")
    if lock["dotnetPackageSha256"] != package["sha256"] or lock["sourceSnapshotHash"] != sdk["hostSource"]["sourceSnapshotHash"]:
        raise ValueError("Repository SDK source lock differs from the explicit SDK receipt")
    return raw, sdk, package, package_path
