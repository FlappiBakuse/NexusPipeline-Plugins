"""Publish a verified original preview, with immutable packages and a guarded catalog switch."""
import hashlib
import json

from plugin_preview_assets import PREFIX, assets, find_release, read_asset, restore_catalog, upload_immutable
from plugin_preview_payload import REPOSITORY, read_payload
from plugin_release_git import ancestor, blob, commit, tree
from release_candidate import parse
from release_provenance import positive, require, sha
from source_snapshot import ordinary_path


def require_head(api, source):
    require(sha(api.fetch(PREFIX + "/commits/develop").get("sha")) == source, "Preview is superseded by the current develop source")


def require_source(api, verified, payload):
    plan, facts, _, _, manifests = payload
    source = sha(verified["source"]["sourceCommit"])
    original = commit(api, source)
    require(original["tree"]["sha"] == verified["source"]["sourceTree"], "Preview source tree differs from the verified candidate")
    files, directories = tree(api, original["tree"]["sha"])
    declared = {path for path in files if path.startswith(("plugins/managed/", "plugins/specialized/")) and path.endswith("/extension.json")}
    require(declared == {item["path"] + "/extension.json" for item in plan["plugins"].values()}, "Preview omits or adds a source plugin")
    for artifact, declaration in plan["plugins"].items():
        path = declaration["path"] + "/extension.json"
        source_manifest = parse(blob(api, files[path]["sha"], 262144))
        require(facts[artifact]["sourceTree"] == directories.get(declaration["path"]), "Preview package source subtree differs")
        manifest = manifests[artifact]
        for key in ("extensionId", "artifactName", "packageVersion", "kind", "minHostVersion", "capabilities", "permissions",
                    "managed", "specialized", "execution", "frontend", "localization", "displayName", "gameName", "summary", "author", "tags"):
            require(source_manifest.get(key) == manifest.get(key), "Preview manifest differs from fixed source: " + key)
    require_head(api, source)
    return source


def previous_catalog(api, release, output, source):
    current = assets(api, release["id"]) if release is not None else {}
    record = current.get("catalog.json")
    previous = read_asset(api, record, output, maximum=8 * 1024 ** 2) if record is not None else None
    if previous is not None:
        catalog = parse(previous)
        require(catalog.get("schemaVersion") == 2 and catalog.get("repository") == REPOSITORY and catalog.get("channel") == "develop",
                "Previous preview catalog owner differs")
        older = sha(catalog.get("sourceCommit"))
        if older != source:
            ancestor(api, older, source)
    return current, previous


def publish_preview(api, directory, verified, output, publish=False):
    directory = ordinary_path(directory).resolve(strict=True)
    output = ordinary_path(output)
    require(not output.exists() and directory not in output.parents and output not in directory.parents,
            "Preview writer requires a new external output directory")
    payload = read_payload(directory, verified)
    source = require_source(api, verified, payload)
    output.mkdir(parents=True)
    release = find_release(api)
    current, previous = previous_catalog(api, release, output / "before", source)
    result = dict(status="VERIFIED_NOT_PUBLISHED", remoteWritten=False, sourceCommit=source)
    if not publish:
        return result
    if release is None:
        release = api.request(PREFIX + "/releases", "POST", dict(tag_name="plugins-develop", target_commitish=source,
            name="Plugins develop preview", body="sourceCommit=" + source, draft=True, prerelease=True))
    release_id = positive(release.get("id"))
    require(release.get("tag_name") == "plugins-develop" and release.get("prerelease") is True,
            "Preview release changed before writing")
    _, facts, _, actual, _ = payload
    for artifact in sorted(facts):
        fact = facts[artifact]
        name = fact["path"].split("/")[-1]
        expected = dict(path=name, sizeBytes=fact["sizeBytes"], sha256=fact["sha256"])
        upload_immutable(api, release_id, directory / fact["path"], name, expected, current, output / "packages")
    catalog = (directory / "catalog.json").read_bytes()
    catalog_sha = hashlib.sha256(catalog).hexdigest()
    require(dict(path="catalog.json", sizeBytes=len(catalog), sha256=catalog_sha) == actual["catalog.json"],
            "Preview catalog changed before switching")
    sidecar = output / "publisher.json"
    sidecar.write_bytes((json.dumps(dict(schemaVersion=1, sourceSha=source, catalogSha256=catalog_sha), sort_keys=True) + "\n").encode())
    sidecar_name = "preview-publisher-" + source + "-" + catalog_sha + ".json"
    expected = dict(path=sidecar_name, sizeBytes=sidecar.stat().st_size, sha256=hashlib.sha256(sidecar.read_bytes()).hexdigest())
    upload_immutable(api, release_id, sidecar, sidecar_name, expected, current, output / "publisher")
    require_head(api, source)
    latest = assets(api, release_id).get("catalog.json")
    require((latest is None) == (current.get("catalog.json") is None) and
            (latest is None or latest["id"] == current["catalog.json"]["id"]), "Preview catalog changed before switching")
    mutated, owned_id = False, None
    try:
        if previous != catalog:
            mutated = True
            if latest is not None:
                api.request(PREFIX + "/releases/assets/" + str(latest["id"]), "DELETE")
            uploaded = api.upload(REPOSITORY, release_id, directory / "catalog.json", "catalog.json")
            owned_id = positive(uploaded.get("id"))
            read_asset(api, uploaded, output / "catalog", actual["catalog.json"], maximum=8 * 1024 ** 2)
        final = assets(api, release_id)
        require(final.get("catalog.json") is not None and read_asset(api, final["catalog.json"], output / "final-catalog",
            actual["catalog.json"], maximum=8 * 1024 ** 2) == catalog, "Preview catalog readback differs")
        for artifact in sorted(facts):
            fact = facts[artifact]
            name = fact["path"].split("/")[-1]
            require(name in final and final[name]["id"] == current[name]["id"], "Preview package asset identity changed")
            read_asset(api, final[name], output / "final-packages", dict(path=name, sizeBytes=fact["sizeBytes"], sha256=fact["sha256"]))
        require_head(api, source)
        if release.get("draft") is True:
            api.request(PREFIX + "/releases/" + str(release_id), "PATCH", dict(draft=False, prerelease=True))
        published = find_release(api)
        require(published is not None and published["id"] == release_id and published.get("draft") is False,
                "Preview release did not reach its public prerelease state")
    except Exception:
        if mutated:
            restore_catalog(api, release_id, previous, catalog, owned_id, output / "restoration")
        raise
    return dict(status="ALREADY_PUBLISHED" if previous == catalog else "PUBLISHED", remoteWritten=mutated or release.get("draft") is True,
        sourceCommit=source, releaseId=release_id, catalogSha256=catalog_sha)
