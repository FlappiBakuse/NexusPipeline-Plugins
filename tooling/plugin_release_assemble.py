"""Assemble stable candidate data from the fixed plan and original package receipts."""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

from ci_plan import source_identity
from plugin_candidate_inputs import candidate_package, sdk_producer
from plugin_release_catalog import catalog_entry
from plugin_release_check import writer_control
from plugin_release_inputs import CATALOG, STATE, object_json
from plugin_release_plan import make_plan
from release_candidate import inventory, parse
from release_provenance import POLICIES, require, sha
from source_snapshot import external_directory, ordinary_path, source_files


def prepare_output(output, roots):
    for root in roots:
        output = external_directory(root, output)
    require(not output.exists() or output.is_dir() and not any(output.iterdir()), "Candidate output must be new or empty")
    return output


def assemble(args):
    root = ordinary_path(args.source_root).resolve(strict=True)
    partner_root = ordinary_path(args.partner_root).resolve(strict=True)
    distribution_root = ordinary_path(args.distribution_root).resolve(strict=True)
    require(args.profile in ("production", "test"), "Unknown candidate profile")
    production = args.profile == "production"
    if production:
        require(args.source_commit is not None and args.partner_commit is not None, "Production candidates require fixed clean Git source commits")
        sha(args.source_commit)
        sha(args.partner_commit)
    control = writer_control() if production else None
    output = prepare_output(args.output, [root, partner_root, distribution_root])
    plan = make_plan(root, distribution_root, args.distribution_commit, args.source_commit)
    if plan["status"] == "NO_CHANGES":
        require(not args.package_receipt, "No-change candidate cannot consume package receipts")
        return {"status": "NO_CHANGES", "remoteWritten": False, "publishable": False, "source": plan["source"]}
    partner = source_identity(partner_root, args.partner_commit)
    original_records = {item["path"]: item for item in source_files(root)}
    original_catalog = object_json(distribution_root, args.distribution_commit, CATALOG)
    old_state = object_json(distribution_root, args.distribution_commit, STATE)
    entries = {item["artifactName"]: deepcopy(item) for item in original_catalog["plugins"]}
    state = deepcopy(old_state)
    state["sourceCommit"] = plan["source"]["sourceCommit"]
    for name in plan["deleted"]:
        entries.pop(name)
        state["released"].pop(name)
    packages, facts, bindings = {}, {}, {"profile": args.profile, "packages": {}}
    if plan["requiresPackage"]:
        require(args.sdk_receipt is not None and args.host_build_receipt is not None, "Changed packages require explicit SDK and Host build receipts")
        sdk_raw, sdk, bindings = sdk_producer(args.sdk_receipt, args.host_build_receipt, partner, args.profile)
        for receipt in args.package_receipt:
            value = parse(ordinary_path(receipt).read_bytes())
            identity = value.get("extensionId")
            selected = [name for name in plan["requiresPackage"] if plan["plugins"][name]["extensionId"] == identity]
            require(len(selected) == 1 and selected[0] not in facts, "Candidate package receipt is duplicated or outside its plan")
            name = selected[0]
            artifact, fact, manifest, data, binding = candidate_package(root, args.source_commit, plan["plugins"][name], receipt,
                args.sdk_receipt, sdk_raw, sdk, original_records, args.profile)
            require(artifact == name, "Candidate artifact identity differs")
            entries[name] = catalog_entry(root, plan["plugins"][name], manifest, fact, entries.get(name), production)
            state["released"][name] = {"name": manifest["extensionId"], "artifactName": name, "version": manifest["packageVersion"],
                "sha256": fact["sha256"], "sizeBytes": fact["sizeBytes"], "sourceTree": fact["sourceTree"]}
            facts[name], packages[fact["path"]], bindings["packages"][name] = fact, data, binding
    require(set(facts) == set(plan["requiresPackage"]), "Candidate package receipt set is incomplete")
    require(not args.package_receipt or facts, "Deletion-only candidate cannot consume package receipts")
    catalog = {**original_catalog, "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "plugins": sorted(entries.values(), key=lambda item: (item["kind"] != "managed-code", item["name"]))}
    plan["packageInputs"] = bindings
    require(source_identity(root, args.source_commit) == plan["source"] and source_identity(partner_root, args.partner_commit) == partner,
            "Candidate source changed during assembly")
    encode = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
    contents = {**packages, CATALOG: encode(catalog), "catalog.json": encode(catalog), STATE: encode(state)}
    output.mkdir(parents=True, exist_ok=True)
    for name, data in contents.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(data)
    files = inventory(output)
    for name, fact in facts.items():
        require(all(files[fact["path"]][key] == fact[key] for key in ("path", "sizeBytes", "sha256")), "Candidate copy differs from PackageMetadata: " + name)
    candidate = {"format": "nexus.release.candidate", "version": 1, "profile": args.profile, "kind": "stable", "producer": control,
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
