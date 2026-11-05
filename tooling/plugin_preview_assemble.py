"""Assemble the complete develop preview from original, fixed-source package receipts."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from ci_plan import source_identity
from plugin_candidate_inputs import candidate_package, sdk_producer
from plugin_preview_payload import RELEASE, REPOSITORY, package_name
from plugin_release_assemble import prepare_output
from plugin_release_catalog import catalog_entry
from plugin_release_check import writer_control
from plugin_release_inputs import CATALOG, object_json
from plugin_release_plan import make_plan
from release_candidate import inventory, parse
from release_provenance import POLICIES, require, sha
from source_snapshot import ordinary_path, source_files


def assemble(args):
    root = ordinary_path(args.source_root).resolve(strict=True)
    partner_root = ordinary_path(args.partner_root).resolve(strict=True)
    distribution_root = ordinary_path(args.distribution_root).resolve(strict=True)
    require(args.profile in ("production", "test"), "Unknown preview candidate profile")
    production = args.profile == "production"
    if production:
        sha(args.source_commit)
        sha(args.partner_commit)
    control = writer_control("preview") if production else None
    output = prepare_output(args.output, [root, partner_root, distribution_root])
    plan = make_plan(root, distribution_root, args.distribution_commit, args.source_commit, "preview")
    if plan["status"] == "NO_CHANGES":
        require(not args.package_receipt, "No-change preview cannot consume package receipts")
        return {"status": "NO_CHANGES", "remoteWritten": False, "publishable": False, "source": plan["source"]}
    current = plan["plugins"]
    require(current, "Preview requires a nonempty current plugin catalog")
    plan["requiresPackage"] = sorted(current)
    plan["managed"] = [name for name in sorted(current) if current[name]["kind"] == "managed"]
    require(args.sdk_receipt is not None and args.host_build_receipt is not None, "Preview requires a fixed SDK and Host producer")
    partner = source_identity(partner_root, args.partner_commit)
    sdk_raw, sdk, bindings = sdk_producer(args.sdk_receipt, args.host_build_receipt, partner, args.profile)
    original_records = {item["path"]: item for item in source_files(root)}
    original_catalog = object_json(distribution_root, args.distribution_commit, CATALOG)
    previous = {item["artifactName"]: item for item in original_catalog["plugins"]}
    facts, packages, entries = {}, {}, []
    for receipt in args.package_receipt:
        value = parse(ordinary_path(receipt).read_bytes())
        selected = [name for name, item in current.items() if item["extensionId"] == value.get("extensionId")]
        require(len(selected) == 1 and selected[0] not in facts, "Preview package receipt is duplicated or outside its source")
        artifact = selected[0]
        name, fact, manifest, data, binding = candidate_package(root, args.source_commit, current[artifact], receipt,
            args.sdk_receipt, sdk_raw, sdk, original_records, args.profile)
        require(name == artifact, "Preview package artifact differs")
        fact["path"] = "packages/" + package_name(name, current[name]["version"], fact["sha256"])
        entry = catalog_entry(root, current[name], manifest, fact, previous.get(name), False)
        entry.update(packageUrl=RELEASE + Path(fact["path"]).name, sourceCommit=plan["source"]["sourceCommit"],
            homepage="https://github.com/" + REPOSITORY + "/tree/develop/" + current[name]["path"])
        facts[name], packages[fact["path"]], bindings["packages"][name] = fact, data, binding
        entries.append(entry)
    require(set(facts) == set(current), "Preview requires original package receipts for every current plugin")
    require(source_identity(root, args.source_commit) == plan["source"] and source_identity(partner_root, args.partner_commit) == partner,
            "Preview source changed during assembly")
    plan["packageInputs"] = bindings
    catalog = {"schemaVersion": 2, "repository": REPOSITORY, "channel": "develop", "sourceCommit": plan["source"]["sourceCommit"],
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "plugins": sorted(entries, key=lambda item: (item["kind"] != "managed-code", item["name"]))}
    encode = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
    output.mkdir(parents=True, exist_ok=True)
    for name, data in {**packages, "catalog.json": encode(catalog)}.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(data)
    files = inventory(output)
    require(all(all(files[fact["path"]][key] == fact[key] for key in ("path", "sizeBytes", "sha256")) for fact in facts.values()),
            "Preview copy differs from its original PackageMetadata")
    candidate = {"format": "nexus.release.candidate", "version": 1, "profile": args.profile, "kind": "preview", "producer": control,
        "source": plan["source"], "partner": {"repository": POLICIES["host"]["repository"], "identity": partner},
        "files": [files[name] for name in sorted(files)], "release": {"plan": plan, "packageMetadata": facts}}
    with (output / "candidate.json").open("xb") as stream:
        stream.write(encode(candidate))
    return {"status": "CANDIDATE_CREATED_NOT_QUALIFIED", "remoteWritten": False, "publishable": False,
        "profile": args.profile, "candidate": str(output / "candidate.json"), "requiresPackage": sorted(facts)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source-root", "partner-root", "distribution-root", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--source-commit")
    parser.add_argument("--partner-commit")
    parser.add_argument("--distribution-commit", required=True)
    parser.add_argument("--profile", choices=("production", "test"), required=True)
    parser.add_argument("--sdk-receipt", type=Path)
    parser.add_argument("--host-build-receipt", type=Path)
    parser.add_argument("--package-receipt", type=Path, action="append", default=[])
    try:
        print(json.dumps(assemble(parser.parse_args()), ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, KeyError) as error:
        print("ERROR: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
