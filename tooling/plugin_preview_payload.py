"""Bind immutable preview packages and the public develop catalog to one candidate."""
import re

from plugin_release_inputs import ARTIFACT, version
from plugin_release_payload import identities, package
from release_candidate import inventory, parse
from release_provenance import bind_producer, require, sha

REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"
RELEASE = "https://github.com/" + REPOSITORY + "/releases/download/plugins-develop/"


def package_name(artifact, package_version, digest):
    require(type(artifact) is str and ARTIFACT.fullmatch(artifact) and
            type(digest) is str and re.fullmatch("[0-9a-f]{64}", digest), "Preview immutable package identity is invalid")
    version(package_version)
    return artifact + "-" + package_version + "-" + digest + ".zip"


def catalog_entries(catalog, source):
    require(type(catalog) is dict and type(catalog.get("schemaVersion")) is int and catalog["schemaVersion"] == 2 and
            catalog.get("repository") == REPOSITORY and catalog.get("channel") == "develop" and
            catalog.get("sourceCommit") == sha(source) and type(catalog.get("plugins")) is list and catalog["plugins"],
            "Preview catalog contract differs")
    entries = catalog["plugins"]
    require(all(type(entry) is dict for entry in entries), "Preview catalog entries must be objects")
    result = {}
    for entry in entries:
        artifact = entry.get("artifactName")
        name = package_name(artifact, entry.get("version"), entry.get("sha256"))
        require(artifact not in result and artifact.casefold() not in {value.casefold() for value in result} and
                entry.get("sourceCommit") == source and entry.get("packageUrl") == RELEASE + name and
                type(entry.get("sizeBytes")) is int and 0 < entry["sizeBytes"] <= 100 * 1024 ** 2,
                "Preview catalog package binding differs")
        result[artifact] = entry
    require(entries == sorted(entries, key=lambda entry: (entry.get("kind") != "managed-code", entry.get("name", ""))),
            "Preview catalog ordering is noncanonical")
    return result


def read_payload(directory, verified):
    candidate = bind_producer(verified["candidate"], verified["provenance"])
    require(candidate.get("kind") == "preview" and verified["provenance"].get("kind") == "preview" and
            verified["provenance"].get("repository") == REPOSITORY, "Preview candidate owner differs")
    release = candidate["release"]
    require(type(release) is dict and set(release) == {"plan", "packageMetadata"}, "Preview release fields differ")
    plan, facts = release["plan"], release["packageMetadata"]
    require(type(plan) is dict, "Preview plan must be an object")
    current, selected = identities(plan, "preview")
    require(plan.get("source") == candidate["source"] and candidate["source"].get("sourceMode") == "git-commit" and
            candidate["source"].get("sourceCommit") == verified["source"]["sourceCommit"] and
            candidate["source"].get("sourceTree") == verified["source"]["sourceTree"] and
            plan["removePackages"] == plan["removeArtifacts"] == [], "Preview source or retention differs")
    sha(plan["base"])
    require(type(facts) is dict and set(facts) == set(current) == set(selected),
            "Preview package facts do not cover the complete catalog")
    expected = {"catalog.json"}
    for artifact, declaration in current.items():
        fact = facts[artifact]
        require(type(fact) is dict and fact.get("path") == "packages/" + package_name(artifact, declaration["version"], fact.get("sha256")),
                "Preview package path differs from immutable naming")
        expected.add(fact["path"])
    actual = inventory(directory)
    actual.pop("candidate.json", None)
    require(set(actual) == expected and candidate["files"] == [actual[name] for name in sorted(actual)],
            "Preview candidate exceeds its exact file whitelist")
    entries = catalog_entries(parse((directory / "catalog.json").read_bytes()), candidate["source"]["sourceCommit"])
    require(set(entries) == set(current), "Preview catalog declaration set differs")
    manifests = {}
    for artifact, declaration in current.items():
        fact, entry = facts[artifact], entries[artifact]
        require(all(actual[fact["path"]][key] == fact[key] for key in ("path", "sha256", "sizeBytes")),
                "Preview package bytes differ from PackageMetadata")
        manifest = package(directory / fact["path"], fact, declaration)
        require(manifest.get("artifactName") == artifact and entry.get("name") == declaration["extensionId"] and
                entry.get("version") == declaration["version"] and entry.get("kind") == manifest["kind"] and
                entry.get("sdkVersion") == manifest["sdkVersion"] and entry.get("minHostVersion") == manifest["minHostVersion"] and
                entry.get("manifestSha256") == fact["manifestSha256"] and entry.get("sha256") == fact["sha256"] and
                entry.get("sizeBytes") == fact["sizeBytes"], "Preview catalog identity differs from its original package")
        for key, value in manifest.get("metadata", {}).items():
            require(entry.get("metadata", {}).get(key) == value, "Preview catalog localization differs from its package")
        manifests[artifact] = manifest
    return plan, facts, entries, actual, manifests
