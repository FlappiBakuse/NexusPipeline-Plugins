"""Bind candidate packages to original source, compiler receipts and the fixed SDK producer."""
import hashlib
from pathlib import Path
import zipfile

from localization import project_metadata
from package_inputs import inputs
from plugin_release_inputs import object_json
from plugin_release_payload import package
from release_candidate import parse
from release_provenance import require
from source_snapshot import ordinary_path


def read_source(source):
    path = ordinary_path(source["sourceManifestPath"]).resolve(strict=True)
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == source["sourceSnapshotHash"], "Candidate source manifest changed")
    document = parse(raw)
    require(type(document.get("files")) is list and len(document["files"]) == source["fileCount"], "Candidate source manifest is incomplete")
    records = {item["path"]: item for item in document["files"]}
    require(len(records) == len(document["files"]), "Candidate source manifest has duplicate members")
    exported = ordinary_path(source["exportRoot"]).resolve(strict=True)
    for name, item in records.items():
        path = ordinary_path(exported / name).resolve(strict=True)
        require(exported in path.parents and path.is_file(), "Candidate source member leaves its export")
        data = path.read_bytes()
        require(len(data) == item["sizeBytes"] and hashlib.sha256(data).hexdigest() == item["sha256"], "Candidate source export changed")
    return exported, records


def sdk_producer(receipt, build_receipt, partner, profile):
    raw = ordinary_path(receipt).read_bytes()
    sdk = parse(raw)
    build_raw = ordinary_path(build_receipt).read_bytes()
    build = parse(build_raw)
    require(sdk.get("status") == "PASS" and hashlib.sha256(build_raw).hexdigest() == sdk.get("hostBuildReceiptSha256") and
            build.get("exitCode") == 0 and build.get("profile") == profile and build.get("sdkApi", {}).get("exitCode") == 0 and
            {"NexusPipeline.Extensibility", "NexusPipeline.Boundaries"} <= set(build.get("componentInputs", {}).get("projectNames", [])),
            "Candidate SDK requires a successful matching-profile Host build")
    require(build.get("source") == sdk.get("hostSource") and
            sdk["hostSource"]["sourceSnapshotHash"] == partner["sourceSnapshotHash"], "Candidate SDK producer differs from fixed Host source")
    read_source(sdk["hostSource"])
    return raw, sdk, {"profile": profile, "sdkReceiptSha256": hashlib.sha256(raw).hexdigest(),
                      "hostBuildReceiptSha256": hashlib.sha256(build_raw).hexdigest(), "packages": {}}


def candidate_package(root, source_commit, declaration, receipt, sdk_receipt, sdk_raw, sdk, original_records, profile):
    raw = ordinary_path(receipt).read_bytes()
    value = parse(raw)
    require(value.get("status") == "PASS" and value.get("extensionId") == declaration["extensionId"] and
            value.get("packageVersion") == declaration["version"] and value.get("sdkReceiptSha256") == hashlib.sha256(sdk_raw).hexdigest() and
            value.get("sdkHostSource") == sdk["hostSource"] and value.get("contractFingerprint") == sdk["contractFingerprint"],
            "Candidate package receipt differs from its fixed SDK or plugin")
    exported, records = read_source(value["source"])
    exclude = lambda name: name.startswith("contracts/")
    require({name: item for name, item in records.items() if not exclude(name)} ==
            {name: item for name, item in original_records.items() if not exclude(name)}, "Candidate package uses different source inputs")
    build_raw = ordinary_path(value["buildReceipt"]).read_bytes()
    build = parse(build_raw)
    require(hashlib.sha256(build_raw).hexdigest() == value["buildReceiptSha256"] and build.get("status") == "PASS" and
            build.get("source") == value["source"] and build.get("sdkReceiptSha256") == value["sdkReceiptSha256"] and
            build.get("contractFingerprint") == value["contractFingerprint"], "Candidate compiler receipt changed")
    frontend = ordinary_path(value["frontendReceipt"]) if value.get("frontendReceipt") else None
    runtime = ordinary_path(value["runtimeInput"]["inputReceipt"]) if value.get("runtimeInput") else None
    compiled, expected_members, binding = inputs(exported, ordinary_path(value["buildReceipt"]), sdk_receipt, frontend, runtime)
    require(all(value.get(key) == item for key, item in binding.items()), "Candidate package input receipts differ from the original producer")
    archive = ordinary_path(value["artifact"]["path"]).resolve(strict=True)
    data = archive.read_bytes()
    require(len(data) == value["artifact"]["sizeBytes"] and hashlib.sha256(data).hexdigest() == value["artifact"]["sha256"],
            "Candidate archive differs from its original receipt")
    manifest = parse(ordinary_path(Path(value["source"]["exportRoot"]) / declaration["path"] / "extension.json").read_bytes())
    expected = project_metadata(root / declaration["path"], {"format": "nexus.extension.manifest", "version": 1,
        "sdkVersion": "0.1.0", "contractFingerprint": sdk["contractFingerprint"], **manifest})
    actual_source = parse((root / declaration["path"] / "extension.json").read_bytes())
    require(manifest == actual_source and compiled == expected, "Candidate package declaration differs from original source")
    artifact = expected["artifactName"]
    source_tree = None
    if source_commit:
        from git_source import git
        source_tree = git(root, "rev-parse", source_commit + ":" + declaration["path"]).decode().strip()
        require(object_json(root, source_commit, declaration["path"] + "/extension.json") == manifest,
                "Candidate declaration differs from its fixed Git source")
    fact = {"path": f"packages/{artifact}/{artifact}-{expected['packageVersion']}.zip",
            "sha256": value["artifact"]["sha256"], "sizeBytes": len(data), "manifestSha256": value["manifestSha256"], "sourceTree": source_tree}
    require(package(archive, fact, declaration, profile) == expected, "Candidate package metadata differs from original localization")
    with zipfile.ZipFile(archive) as payload:
        entries = payload.infolist()
        members = {item["path"]: item for item in value["members"]}
        require(len(members) == len(value["members"]) == len(entries) and
                set(members) == set(payload.namelist()) == set(expected_members), "Candidate package member receipt differs")
        for item in entries:
            raw_member = payload.read(item)
            require(len(raw_member) == members[item.filename]["sizeBytes"] and
                    hashlib.sha256(raw_member).hexdigest() == members[item.filename]["sha256"] and
                    raw_member == expected_members[item.filename], "Candidate package member changed")
    return artifact, fact, expected, data, {"receiptSha256": hashlib.sha256(raw).hexdigest(),
        "buildReceiptSha256": value["buildReceiptSha256"], "sourceSnapshotHash": value["source"]["sourceSnapshotHash"],
        "sdkReceiptSha256": value["sdkReceiptSha256"], "contractFingerprint": value["contractFingerprint"]}
