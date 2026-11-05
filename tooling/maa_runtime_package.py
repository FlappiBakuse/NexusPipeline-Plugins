"""Verify a pinned official runtime archive and its exact binary package closure."""
import json
from pathlib import Path
import zipfile
from source_snapshot import encode, sha

REQUIRED = {"MaaFramework.dll", "MaaCustomControlUnit.dll", "MaaUtils.dll", "opencv_world4_maa.dll", "fastdeploy_ppocr_maa.dll",
            "onnxruntime_maa.dll", "webgpu_dawn_maa.dll", "DirectML.dll", "dxcompiler.dll", "dxil.dll", "MaaAgentClient.dll"}


def ordinary(path):
    path = Path(path).absolute()
    for candidate in (path, *path.parents):
        if candidate.is_symlink() or candidate.is_junction():
            raise ValueError("Runtime inputs cross a link")
    resolved = path.resolve(strict=True)
    if path != resolved:
        raise ValueError("Runtime input path is not canonical")
    return resolved


def runtime_members(manifest, pin_path, receipt_path):
    if manifest["extensionId"] != "maa-framework":
        raise ValueError("Maa runtime cannot be added to another extension")
    pin_path, receipt_path = ordinary(pin_path), ordinary(receipt_path)
    pin, receipt = json.loads(pin_path.read_bytes()), json.loads(receipt_path.read_bytes())
    if set(pin) != {"repository", "releaseId", "tag", "sourceCommit", "assetId", "assetName", "assetSha256"} or pin["repository"] != "MaaXYZ/MaaFramework":
        raise ValueError("Unknown Maa runtime release pin")
    asset = receipt["asset"]
    if receipt["status"] != "VERIFIED_BINARY_INPUT_ONLY" or any(receipt[key] != pin[key] for key in ("releaseId", "tag", "sourceCommit")) or \
        asset["id"] != pin["assetId"] or asset["name"] != pin["assetName"] or asset["digest"] != "sha256:" + pin["assetSha256"] or \
        asset["browser_download_url"] != "https://github.com/" + pin["repository"] + "/releases/download/" + pin["tag"] + "/" + pin["assetName"]:
        raise ValueError("Maa runtime receipt differs from the source release pin")
    archive, runtime = ordinary(receipt["archive"]), ordinary(receipt["runtime"])
    if sha(archive.read_bytes()) != pin["assetSha256"] or archive.stat().st_size != asset["size"]:
        raise ValueError("Maa runtime archive differs from the official asset digest")
    expected = {"runtime/win-x64/" + name for name in REQUIRED}
    if set(manifest["managed"]["nativeLibraries"]) != expected:
        raise ValueError("Maa native declarations differ from the runtime closure")
    declared = [record for record in receipt["files"] if record["path"] in {"bin/" + name for name in REQUIRED}]
    if len(declared) != len(REQUIRED) or len({record["path"] for record in declared}) != len(REQUIRED):
        raise ValueError("Maa runtime binary inventory is incomplete")
    members, files = {}, []
    with zipfile.ZipFile(archive) as package:
        names = package.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Maa archive contains duplicate names")
        for record in sorted(declared, key=lambda item: item["path"]):
            path = ordinary(runtime / record["path"])
            if runtime not in path.parents:
                raise ValueError("Runtime file escaped the verified directory")
            data = path.read_bytes()
            if len(data) != record["sizeBytes"] or sha(data) != record["sha256"] or package.read(record["path"]) != data:
                raise ValueError("Maa runtime binary differs from archive and inventory")
            name = Path(record["path"]).name
            members["runtime/win-x64/" + name] = data
            files.append({"name": name, "sizeBytes": len(data), "sha256": sha(data)})
    members["runtime/win-x64/runtime-lock.json"] = encode({"format": "nexus.maa.runtime-lock", "version": 1,
        "runtimeVersion": pin["tag"].removeprefix("v"), "files": files})
    return members, {"releasePin": pin, "releasePinSha256": sha(pin_path.read_bytes()), "inputReceipt": str(receipt_path),
                     "inputReceiptSha256": sha(receipt_path.read_bytes()), "qualification": "Pinned binary input only; not native execution qualification"}
