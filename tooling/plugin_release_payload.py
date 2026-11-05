"""Validate the stable candidate whitelist and its original package facts."""
import hashlib
from pathlib import Path
import re
import stat
import zipfile

from plugin_release_inputs import ARTIFACT, EXTENSION, CATALOG, STATE, version
from plugin_release_git import MAX_BLOB
from release_candidate import inventory, member_path, parse
from release_provenance import bind_producer, require, sha

METADATA = {CATALOG, STATE, "catalog.json"}


def identities(plan, channel="stable"):
    require(plan.get("format") == "nexus.plugins.release-plan" and type(plan.get("version")) is int and
            plan["version"] == 1 and plan.get("channel") == channel and channel in ("stable", "preview") and plan.get("status") == "PLANNED" and
            plan.get("publishable") is False, "Stable writer requires a planned stable release")
    current = plan.get("plugins")
    require(type(current) is dict, "Stable plugin declarations are missing")
    names = set()
    for artifact, item in current.items():
        require(ARTIFACT.fullmatch(artifact) and artifact.casefold() not in names and type(item) is dict and
                type(item.get("extensionId")) is str and EXTENSION.fullmatch(item["extensionId"]) and
                item.get("kind") in ("managed", "specialized") and type(item.get("frontend")) is bool,
                "Stable plugin identity is invalid")
        require(item.get("path") == f"plugins/{item['kind']}/{item['extensionId']}", "Stable source declaration path differs")
        version(item.get("version"))
        names.add(artifact.casefold())
    require(len({item["extensionId"] for item in current.values()}) == len(current), "Stable extension IDs are duplicated")
    for key in ("changed", "deleted", "requiresPackage", "managed", "removePackages", "removeArtifacts", "changedPaths"):
        values = plan.get(key)
        require(type(values) is list and all(type(value) is str for value in values) and values == sorted(set(values)),
                "Stable plan collection is noncanonical: " + key)
    selected = plan["requiresPackage"]
    require((plan["changed"] == selected if channel == "stable" else set(plan["changed"]) <= set(selected) and set(selected) == set(current)) and
            set(selected) <= current.keys() and
            set(plan["deleted"]).isdisjoint(current) and (selected or plan["deleted"]), "Stable package scope differs")
    require(plan["managed"] == [name for name in selected if current[name]["kind"] == "managed"], "Stable managed scope differs")
    return current, selected


def package(path, fact, declaration, profile="production"):
    require(type(fact) is dict and set(fact) == {"path", "sha256", "sizeBytes", "manifestSha256", "sourceTree"} and
            re.fullmatch("[0-9a-f]{64}", str(fact.get("sha256"))) and
            re.fullmatch("[0-9a-f]{64}", str(fact.get("manifestSha256"))) and type(fact.get("sizeBytes")) is int and
            0 < fact["sizeBytes"] <= MAX_BLOB, "Stable PackageMetadata is invalid")
    require(profile in ("production", "test"), "Unknown package validation profile")
    if profile == "production" or fact["sourceTree"] is not None:
        sha(fact["sourceTree"])
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        names, total = set(), 0
        for item in members:
            member_path(item.filename)
            require(not item.is_dir() and not item.flag_bits & 1 and
                    stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFREG) and item.filename.casefold() not in names,
                    "Stable package has unsafe or colliding members")
            names.add(item.filename.casefold())
            total += item.file_size
        require(0 < len(members) <= 8192 and total <= 2 * 1024 ** 3 and archive.testzip() is None,
                "Stable package exceeds its bound or has damaged members")
        require(archive.getinfo("manifest.json").file_size <= 262144, "Stable manifest exceeds its bound")
        raw = archive.read("manifest.json")
        manifest = parse(raw)
        require(hashlib.sha256(raw).hexdigest() == fact["manifestSha256"] and
                manifest.get("format") == "nexus.extension.manifest" and type(manifest.get("version")) is int and
                manifest["version"] == 1 and manifest.get("extensionId") == declaration["extensionId"] and
                manifest.get("packageVersion") == declaration["version"] and manifest.get("sdkVersion") == "0.1.0" and
                manifest.get("minHostVersion") == "0.18.0" and manifest.get("kind") ==
                ("managed-code" if declaration["kind"] == "managed" else "data-specialized"), "Stable package manifest identity differs")
        if declaration["kind"] == "managed":
            managed = manifest.get("managed")
            require(type(managed) is dict and type(managed.get("nativeLibraries", [])) is list,
                    "Stable package managed declaration is invalid")
            required = [managed.get("entryAssembly"), *managed.get("nativeLibraries", [])]
            frontend = manifest.get("frontend")
            if frontend is not None:
                require(type(frontend) is dict and type(frontend.get("styles")) is list,
                        "Stable package frontend declaration is invalid")
                required += [frontend.get("entry"), *frontend["styles"]]
            for key, entry in (("execution", "workerEntry"), ("specialized", "adapterEntry")):
                if manifest.get(key) is not None:
                    require(type(manifest[key]) is dict, "Stable package entry declaration is invalid")
                    required.append(manifest[key].get(entry))
            require(all(type(name) is str and name in archive.namelist() for name in required),
                    "Stable package declared entry is missing")
            require("nexuspipeline.extensibility.dll" not in names, "Stable package contains the Host shared SDK at its root")
        if declaration["kind"] == "specialized":
            entry = manifest.get("specialized", {}).get("adapterEntry")
            require(entry == "adapter/main.js" and not any(key in manifest for key in ("managed", "execution", "frontend")),
                    "Data-specialized package declares executable ownership")
            allowed = {"manifest.json", entry, "README.md", "CHANGELOG.md", "CHANGELOG.en.md"}
            allowed.update(manifest.get("localization", {}).get("locales", {}).values())
            require({item.filename for item in members} <= allowed and entry in archive.namelist(),
                    "Data-specialized package has an undeclared payload")
            for item in members:
                if item.filename.endswith((".json", ".js")):
                    require(item.file_size <= 262144, "Data-specialized document exceeds its bound")
                    raw = archive.read(item)
                    require(b"\0" not in raw, "Data-specialized document contains binary bytes")
                    raw.decode("utf-8", errors="strict")
                    if item.filename.endswith(".json"):
                        parse(raw)
    return manifest


def read_payload(directory, verified):
    candidate = bind_producer(verified["candidate"], verified["provenance"])
    require(candidate.get("kind") == "stable" and verified["provenance"].get("kind") == "stable" and
            verified["provenance"].get("repository") == "FlappiBakuse/NexusPipeline-Plugins", "Stable candidate owner differs")
    release = candidate["release"]
    require(type(release) is dict and set(release) == {"plan", "packageMetadata"}, "Stable release contract differs")
    plan, facts = release["plan"], release["packageMetadata"]
    require(type(plan) is dict, "Stable release plan must be an object")
    current, selected = identities(plan)
    require(plan.get("source") == candidate["source"] and candidate["source"].get("sourceMode") == "git-commit" and
            candidate["source"].get("sourceCommit") == verified["source"]["sourceCommit"] and
            candidate["source"].get("sourceTree") == verified["source"]["sourceTree"], "Stable source differs from its verified Git tree")
    sha(plan["base"])
    require(type(facts) is dict and set(facts) == set(selected), "Stable package facts differ from the selected scope")
    expected = set(METADATA)
    for artifact in selected:
        value = facts[artifact]
        name = f"packages/{artifact}/{artifact}-{current[artifact]['version']}.zip"
        require(type(value) is dict and value.get("path") == name, "Stable package path differs from artifactName and version")
        expected.add(name)
    actual = inventory(directory)
    actual.pop("candidate.json", None)
    require(set(actual) == expected and candidate["files"] == [actual[name] for name in sorted(actual)],
            "Stable candidate files differ from their exact whitelist")
    manifests = {}
    for artifact in selected:
        value = facts[artifact]
        require(all(actual[value["path"]][key] == value[key] for key in ("path", "sha256", "sizeBytes")),
                "Stable package bytes differ from PackageMetadata")
        manifests[artifact] = package(directory / value["path"], value, current[artifact])
        require(manifests[artifact].get("artifactName") == artifact, "Stable artifact identity differs")
    require((directory / CATALOG).read_bytes() == (directory / "catalog.json").read_bytes(), "Stable catalog projection differs")
    catalog, state = parse((directory / CATALOG).read_bytes()), parse((directory / STATE).read_bytes())
    require(catalog.get("schemaVersion") == 2 and catalog.get("repository") == "FlappiBakuse/NexusPipeline-Plugins" and
            type(catalog.get("plugins")) is list and type(state.get("schemaVersion")) is int and state["schemaVersion"] == 1 and
            state.get("sourceCommit") == candidate["source"]["sourceCommit"] and type(state.get("released")) is dict,
            "Stable catalog or cursor contract differs")
    entries = catalog["plugins"]
    require(all(type(item) is dict for item in entries) and len(entries) == len(current) and
            {item.get("artifactName") for item in entries} == set(current) and set(state["released"]) == set(current),
            "Stable catalog and state plugin sets differ")
    require(entries == sorted(entries, key=lambda item: (item.get("kind") != "managed-code", item.get("name", ""))),
            "Stable catalog ordering is noncanonical")
    return plan, facts, {item["artifactName"]: item for item in entries}, state, actual, manifests
