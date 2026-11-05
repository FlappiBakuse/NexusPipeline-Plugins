"""Apply verified stable candidates as one immutable, fast-forward Git transaction."""
import base64
import hashlib

from plugin_release_git import PREFIX, ancestor, blob, blob_sha, commit, head, published, tree
from plugin_release_inputs import CATALOG, STATE, version
from plugin_release_payload import METADATA, read_payload
from plugin_release_plan import retention
from release_candidate import parse
from release_provenance import require, sha


def catalog_entries(value):
    require(value.get("schemaVersion") == 2 and value.get("repository") == "FlappiBakuse/NexusPipeline-Plugins" and
            type(value.get("plugins")) is list and all(type(item) is dict for item in value["plugins"]),
            "Published catalog contract is invalid")
    result = {item.get("artifactName"): item for item in value["plugins"]}
    require(len(result) == len(value["plugins"]), "Published catalog identities are duplicated")
    return result


def check_metadata(api, files, source_files, directories, directory, payload):
    plan, facts, entries, state, _, manifests = payload
    require(METADATA <= files.keys(), "Published baseline lacks catalog or state")
    baseline = plan["distribution"]
    require(files[CATALOG]["sha"] == baseline["catalogBlob"] and files[STATE]["sha"] == baseline["stateBlob"],
            "Stable baseline metadata identity differs")
    raw = blob(api, files[CATALOG]["sha"])
    require(raw == blob(api, files["catalog.json"]["sha"]), "Published catalog projection differs")
    previous = catalog_entries(parse(raw))
    old_state = parse(blob(api, files[STATE]["sha"]))
    require(type(old_state.get("schemaVersion")) is int and old_state["schemaVersion"] == 1 and
            old_state.get("sourceCommit") == plan["base"] and type(old_state.get("released")) is dict and
            set(previous) == set(old_state["released"]), "Stable published cursor differs")
    current = plan["plugins"]
    require(plan["deleted"] == sorted(set(previous) - set(current)), "Stable deleted artifact scope differs")
    require(plan["removeArtifacts"] == ["packages/" + name for name in plan["deleted"]], "Stable artifact deletion differs")
    removals = sorted(path for name in plan["requiresPackage"] for path in retention(files, name, current[name]["version"]))
    require(plan["removePackages"] == removals, "Stable package retention differs")
    require(set(plan.get("reasons", {})) == set(facts), "Stable change reasons differ from its package scope")
    for artifact, declaration in current.items():
        source_path = declaration["path"] + "/extension.json"
        require(source_path in source_files, "Stable source declaration is missing")
        source = parse(blob(api, source_files[source_path]["sha"], 262144))
        require(source.get("extensionId") == declaration["extensionId"] and source.get("artifactName") == artifact and
                source.get("packageVersion") == declaration["version"] and source.get("kind") ==
                ("managed-code" if declaration["kind"] == "managed" else "data-specialized") and
                (source.get("frontend") is not None) == declaration["frontend"], "Stable declaration differs from fixed source")
        old = previous.get(artifact)
        require(old is None or version(declaration["version"]) >= version(old["version"]), "Stable source version regresses")
        if artifact not in facts:
            require(old is not None and entries[artifact] == old and state["released"][artifact] == old_state["released"][artifact],
                    "Stable candidate changes an unselected entry")
            continue
        fact, manifest = facts[artifact], manifests[artifact]
        require(old is None or version(declaration["version"]) > version(old["version"]), "Changed stable package requires a newer version")
        require(fact["sourceTree"] == directories.get(declaration["path"]), "Stable package source tree differs")
        for key in ("extensionId", "artifactName", "packageVersion", "kind", "minHostVersion", "capabilities", "permissions",
                    "managed", "specialized", "execution", "frontend", "localization", "displayName", "gameName", "summary", "author", "tags"):
            require(source.get(key) == manifest.get(key), "Stable manifest differs from fixed source: " + key)
        record = {"artifactName": artifact, "name": declaration["extensionId"], "version": declaration["version"],
                  "sha256": fact["sha256"], "sizeBytes": fact["sizeBytes"], "sourceTree": fact["sourceTree"]}
        require(state["released"][artifact] == record and all(entries[artifact].get(key) == record[key] for key in
                ("artifactName", "name", "version", "sha256", "sizeBytes")), "Stable catalog, state and PackageMetadata disagree")
        entry = entries[artifact]
        require(entry.get("kind") == manifest["kind"] and entry.get("minHostVersion") == manifest["minHostVersion"] and
                entry.get("sdkVersion") == manifest["sdkVersion"] and entry.get("manifestSha256") == fact["manifestSha256"] and
                entry.get("packageUrl") == "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/" + fact["path"],
                "Stable catalog package binding differs")
        for key, value in manifest.get("metadata", {}).items():
            require(entry.get("metadata", {}).get(key) == value, "Stable catalog presentation differs from its package")
    for artifact, entry in previous.items():
        record = old_state["released"][artifact]
        require(type(record) is dict and all(record.get(key) == entry.get(key) for key in
                ("artifactName", "name", "version", "sha256", "sizeBytes")), "Published package facts disagree")
        require(f"packages/{artifact}/{artifact}-{entry['version']}.zip" in files, "Published current package is missing")
        if artifact in plan["deleted"]:
            retention(files, artifact, entry["version"])


def expected_tree(files, replacements, plan):
    result = dict(files)
    for name in plan["removePackages"]:
        require(name in result, "Stable retention target is missing")
        del result[name]
    for directory in plan["removeArtifacts"]:
        for name in list(result):
            if name.startswith(directory + "/"):
                del result[name]
    for name, data in replacements.items():
        result[name] = {"mode": "100644", "type": "blob", "sha": blob_sha(data)}
    return result


def publish_stable(api, directory, verified, publish=False):
    payload = read_payload(directory, verified)
    plan, _, _, _, actual, _ = payload
    source = sha(verified["source"]["sourceCommit"])
    baseline = plan["distribution"]
    require(type(baseline) is dict and set(baseline) == {"commit", "tree", "catalogBlob", "stateBlob"},
            "Stable distribution snapshot differs")
    fixed = commit(api, sha(baseline["commit"]))
    require(fixed["tree"]["sha"] == baseline["tree"], "Stable distribution tree differs")
    base_files, _ = tree(api, fixed["tree"]["sha"])
    original = commit(api, source)
    require(original["tree"]["sha"] == verified["source"]["sourceTree"], "Stable source tree differs")
    source_files, source_directories = tree(api, original["tree"]["sha"])
    check_metadata(api, base_files, source_files, source_directories, directory, payload)
    ancestor(api, plan["base"], baseline["commit"])
    ancestor(api, plan["base"], source)
    cursor = commit(api, plan["base"])
    cursor_files, _ = tree(api, cursor["tree"]["sha"])
    paths = sorted(name for name in cursor_files.keys() | source_files.keys() if cursor_files.get(name) != source_files.get(name))
    require(paths == plan["changedPaths"], "Stable cumulative source paths differ")
    replacements = {name: (directory / name).read_bytes() for name in actual}
    for name, data in replacements.items():
        require(len(data) == actual[name]["sizeBytes"] and hashlib.sha256(data).hexdigest() == actual[name]["sha256"],
                "Stable candidate changed before writing")
    current = head(api)
    ancestor(api, source, current)
    current_commit = commit(api, current)
    current_files, _ = tree(api, current_commit["tree"]["sha"])
    expected = expected_tree(base_files, replacements, plan)
    expected_published = {name: value for name, value in expected.items() if published(name)}
    current_published = {name: value for name, value in current_files.items() if published(name)}
    result = {"status": "VERIFIED_NOT_PUBLISHED", "remoteWritten": False, "sourceCommit": source, "parent": current}
    if current_published == expected_published:
        return {**result, "status": "ALREADY_PUBLISHED", "publishedCommit": current, "idempotent": True}
    require(current_published == {name: value for name, value in base_files.items() if published(name)},
            "Stable distribution baseline is stale; create a new candidate")
    require({name: value for name, value in current_files.items() if not published(name)} ==
            {name: value for name, value in source_files.items() if not published(name)}, "Stable candidate is superseded by newer source")
    for name, data in replacements.items():
        if name.startswith("packages/") and name in current_files:
            require(current_files[name]["sha"] == blob_sha(data), "Same-version stable package bytes are immutable")
    if not publish:
        return result
    expected = expected_tree(current_files, replacements, plan)
    changes = []
    for name in sorted(current_files.keys() | expected.keys()):
        if current_files.get(name) == expected.get(name):
            continue
        require(published(name), "Stable writer attempted an unowned path")
        item = expected.get(name)
        if name in replacements:
            record = api.request(PREFIX + "/git/blobs", "POST", {"encoding": "base64",
                "content": base64.b64encode(replacements[name]).decode("ascii")})
            require(record.get("sha") == item["sha"], "Uploaded Git blob identity differs")
        changes.append({"path": name, "mode": "100644", "type": "blob", "sha": item["sha"] if item else None})
    require(changes, "Stable writer refuses an empty commit")
    prepared = api.request(PREFIX + "/git/trees", "POST", {"base_tree": current_commit["tree"]["sha"], "tree": changes})
    prepared_tree = sha(prepared.get("sha"))
    require(tree(api, prepared_tree)[0] == expected, "Prepared stable tree exceeds its exact whitelist")
    message = "Publish plugin stable packages from " + source
    created = api.request(PREFIX + "/git/commits", "POST", {"message": message, "tree": prepared_tree, "parents": [current]})
    created_sha = sha(created.get("sha"))
    prepared_commit = commit(api, created_sha)
    require(prepared_commit["tree"]["sha"] == prepared_tree and
            [item.get("sha") for item in prepared_commit.get("parents", [])] == [current], "Prepared stable commit identity differs")
    require(head(api) == current, "Stable main advanced before the atomic update")
    updated = api.request(PREFIX + "/git/refs/heads/main", "PATCH", {"sha": created_sha, "force": False})
    require(updated.get("object", {}).get("sha") == created_sha and head(api) == created_sha,
            "Stable main did not reach its prepared commit")
    require(tree(api, commit(api, created_sha)["tree"]["sha"])[0] == expected, "Published stable tree differs from its prepared transaction")
    readback = []
    for name in sorted(replacements):
        data = blob(api, expected[name]["sha"], max(1, actual[name]["sizeBytes"]))
        require(len(data) == actual[name]["sizeBytes"] and hashlib.sha256(data).hexdigest() == actual[name]["sha256"],
                "Published stable file readback differs")
        readback.append(actual[name])
    require(head(api) == created_sha, "Stable main changed during publication readback")
    return {**result, "status": "PUBLISHED", "remoteWritten": True, "publishedCommit": created_sha,
            "changedPaths": [item["path"] for item in changes], "files": readback}
