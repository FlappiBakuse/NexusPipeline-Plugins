"""Bind package members to successful compiler, source and public SDK evidence."""
import json
from pathlib import Path
from sdk_inputs import verified_sdk
from source_snapshot import sha, ordinary_path
from localization import project_metadata, read_locales


def read_identity(value):
    path = ordinary_path(value["path"]).resolve(strict=True)
    for ancestor in [path, *path.parents]:
        if ancestor.is_symlink() or ancestor.is_junction():
            raise ValueError("Package inputs cannot pass through links")
    data = path.read_bytes()
    if sha(data) != value["sha256"]:
        raise ValueError("Package input differs from its compiler receipt: " + str(path))
    return data


def inputs(root, build_receipt, sdk_receipt, frontend_receipt=None, runtime_receipt=None):
    for path in (build_receipt, sdk_receipt, frontend_receipt, runtime_receipt):
        if path is not None:
            ordinary_path(path)
    sdk_raw, sdk, _, _ = verified_sdk(root, sdk_receipt)
    build_raw = build_receipt.read_bytes()
    build = json.loads(build_raw)
    if build["status"] != "PASS" or build["sdkReceiptSha256"] != sha(sdk_raw) or build["contractFingerprint"] != sdk["contractFingerprint"]:
        raise ValueError("Package compilation and SDK producer are not bound")
    source = build["source"]
    source_records = json.loads(read_identity({"path": source["sourceManifestPath"], "sha256": source["sourceSnapshotHash"]}))["files"]
    source_map = {record["path"]: record["sha256"] for record in source_records}
    manifest_bytes = read_identity(build["manifest"])
    manifest = json.loads(manifest_bytes)
    extension_id = manifest["extensionId"]
    if manifest["packageVersion"] != "0.5.0" or manifest["minHostVersion"] != "0.18.0" or manifest["sdkVersion"] != "0.1.0":
        raise ValueError("Package differs from the fixed unreleased target")
    category = "managed" if manifest["kind"] == "managed-code" else "specialized"
    plugin = Path(source["exportRoot"]) / "plugins" / category / extension_id
    members = {"manifest.json": manifest_bytes}
    if project_metadata(plugin, manifest) != manifest:
        raise ValueError('Packaged metadata differs from its locale source')
    _, locale_records = read_locales(plugin, manifest)
    for record in locale_records:
        path = plugin / record['path']
        relative = path.relative_to(Path(source['exportRoot'])).as_posix()
        if source_map.get(relative) != record['sha256']:
            raise ValueError('Localization differs from its source snapshot')
        members[record['path']] = read_identity({'path': str(path), 'sha256': record['sha256']})
    if category == "managed":
        members[manifest["managed"]["entryAssembly"]] = read_identity(build["assembly"])
        if manifest.get("execution") is not None:
            worker = build.get("worker")
            if worker is None or worker["status"] != "PASS" or not worker.get("files"):
                raise ValueError("Declared managed worker has no successful launch closure")
            for item in worker["files"]:
                name = item["member"]
                if not name.startswith("worker/") or Path(name).name != name[7:] or name in members:
                    raise ValueError("Managed worker package membership is invalid")
                members[name] = read_identity(item)
            if manifest["execution"]["workerEntry"] not in members:
                raise ValueError("Declared worker entry is missing from the package")
    if manifest.get("specialized") is not None:
        members[manifest["specialized"]["adapterEntry"]] = read_identity(build["script"])
    for name in ("README.md", "CHANGELOG.md", "CHANGELOG.en.md"):
        path = plugin / name
        relative = path.relative_to(Path(source["exportRoot"])).as_posix()
        if relative in source_map:
            members[name] = read_identity({"path": str(path), "sha256": source_map[relative]})
    if manifest.get("frontend") is not None:
        if frontend_receipt is None:
            raise ValueError("Declared frontend requires compiled bundle evidence")
        add_frontend(members, manifest, frontend_receipt, source_map, sdk)
    runtime = None
    if manifest.get("managed", {}).get("nativeLibraries"):
        if runtime_receipt is None:
            raise ValueError("Declared native libraries require verified runtime input evidence")
        from maa_runtime_package import runtime_members
        pin = plugin / "runtime.release.json"
        read_identity({"path": str(pin), "sha256": source_map[pin.relative_to(Path(source["exportRoot"])).as_posix()]})
        native, runtime = runtime_members(manifest, pin, runtime_receipt)
        if set(native).intersection(members): raise ValueError("Runtime package members collide")
        members.update(native)
    elif runtime_receipt is not None:
        raise ValueError("Runtime input was supplied without native declarations")
    if category == "specialized":
        allowed = {"manifest.json", manifest["specialized"]["adapterEntry"], "README.md", "CHANGELOG.md", "CHANGELOG.en.md"}
        allowed.update(record['path'] for record in locale_records)
        if any(key in manifest for key in ("managed", "execution", "frontend")) or set(members) - allowed:
            raise ValueError("Data-specialized package contains undeclared or executable payload")
        for name, data in members.items():
            if name.endswith((".js", ".json")):
                text = data.decode("utf-8", errors="strict")
                if len(data) > 262144 or "\0" in text:
                    raise ValueError("Data-specialized document exceeds the bounded input")
                if name.endswith(".json"):
                    json.loads(text)
    frozen_frontend = None
    if frontend_receipt is not None:
        frozen_frontend = frontend_root(frontend_receipt) / "runs" / (sha(frontend_receipt.read_bytes()) + ".json")
        _ = read_identity({"path": str(frozen_frontend), "sha256": sha(frontend_receipt.read_bytes())})
    return manifest, members, {"source": source, "sdkHostSource": sdk["hostSource"], "sdkReceiptSha256": sha(sdk_raw),
        "buildReceipt": str(build_receipt), "buildReceiptSha256": sha(build_raw), "contractFingerprint": sdk["contractFingerprint"],
        "frontendReceipt": str(frozen_frontend) if frozen_frontend else None,
        "frontendReceiptSha256": sha(frontend_receipt.read_bytes()) if frontend_receipt else None, "runtimeInput": runtime}


def add_frontend(members, manifest, receipt, source_map, sdk):
    frontend = json.loads(receipt.read_bytes())
    artifact_root = frontend_root(receipt)
    if frontend["status"] != "PASS" or frontend["contractFingerprint"] != sdk["contractFingerprint"]:
        raise ValueError("Frontend bundle identity differs from the compiled plugin")
    module = frontend.get('moduleInputs', {}).get(manifest['extensionId'])
    selected = module['source'] + [item for item in frontend['inputs'] if item['path'].startswith('tooling/')] \
        if module is not None else frontend["inputs"]
    for record in selected:
        if source_map.get(record["path"]) != record["sha256"]:
            raise ValueError("Frontend and backend use different source snapshots")
    producer = sdk["hostSource"]
    host_map = {record["path"]: record["sha256"] for record in json.loads(read_identity(
        {"path": producer["sourceManifestPath"], "sha256": producer["sourceSnapshotHash"]}))["files"]}
    sdk_inputs = module['sdk'] if module is not None else frontend["sdkSourceRecords"]
    if not sdk_inputs or any(host_map.get(record["path"]) != record["sha256"] for record in sdk_inputs):
        raise ValueError("Frontend used SDK sources outside the packaged producer")
    entry = manifest["frontend"]
    if entry["entry"] != "frontend/main.js" or entry["styles"] != ["frontend/main.css"] or entry["sdkVersion"] != "0.1.0":
        raise ValueError("Unknown frontend asset declaration")
    artifacts = {record["path"]: record["sha256"] for record in frontend["artifacts"]}
    for name in ("main.js", "main.css"):
        relative = manifest["extensionId"] + "/" + name
        members["frontend/" + name] = read_identity({"path": str(artifact_root / relative), "sha256": artifacts[relative]})


def frontend_root(receipt):
    raw = receipt.read_bytes()
    value = json.loads(raw)
    root = ordinary_path(value["artifactRoot"]).resolve(strict=True)
    expected = root / "runs" / (sha(raw) + ".json") if receipt.parent.name == "runs" else root / "build-receipt.json"
    if receipt.resolve(strict=True) != expected:
        raise ValueError("Frontend receipt is outside its declared artifact root")
    return root
