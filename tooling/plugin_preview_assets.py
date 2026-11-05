"""Read back immutable preview assets and restore only the owned catalog transition."""
import hashlib
import re
import urllib.error

from plugin_preview_payload import REPOSITORY
from release_provenance import positive, require

PREFIX = "repos/" + REPOSITORY


def find_release(api):
    try:
        value = api.fetch(PREFIX + "/releases/tags/plugins-develop")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise
    require(value.get("tag_name") == "plugins-develop" and value.get("prerelease") is True and
            type(value.get("draft")) is bool, "Preview release identity differs")
    positive(value.get("id"))
    return value


def assets(api, release_id):
    result, names = {}, set()
    for page in range(1, 101):
        values = api.fetch(PREFIX + f"/releases/{positive(release_id)}/assets?per_page=100&page={page}")
        require(type(values) is list and len(values) <= 100, "Preview asset collection is invalid")
        for item in values:
            require(type(item) is dict and type(item.get("name")) is str and item["name"].casefold() not in names,
                    "Preview assets have duplicate or invalid names")
            positive(item.get("id"))
            names.add(item["name"].casefold())
            result[item["name"]] = item
        if len(values) < 100:
            return result
    raise ValueError("Preview asset collection exceeds its bound")


def read_asset(api, record, output, expected=None, maximum=100 * 1024 ** 2):
    identity = positive(record.get("id"))
    current = api.fetch(PREFIX + "/releases/assets/" + str(identity))
    require(current.get("id") == identity and current.get("name") == record.get("name") and current.get("state") == "uploaded" and
            type(current.get("size")) is int and 0 < current["size"] <= maximum and
            type(current.get("digest")) is str and re.fullmatch("sha256:[0-9a-f]{64}", current["digest"]),
            "Preview asset server identity differs")
    fact = dict(path=current["name"], sizeBytes=current["size"], sha256=current["digest"][7:])
    if expected is not None:
        require(fact == expected, "Immutable preview asset bytes differ")
    path = output / str(identity)
    api.download(PREFIX + "/releases/assets/" + str(identity), path, fact["sizeBytes"], fact["sha256"])
    raw = path.read_bytes()
    require(len(raw) == fact["sizeBytes"] and hashlib.sha256(raw).hexdigest() == fact["sha256"], "Preview asset byte readback differs")
    return raw


def upload_immutable(api, release_id, path, name, expected, current, output):
    raw = path.read_bytes()
    require(len(raw) == expected["sizeBytes"] and hashlib.sha256(raw).hexdigest() == expected["sha256"],
            "Preview candidate changed before upload")
    record = current.get(name)
    if record is None:
        record = api.upload(REPOSITORY, release_id, path, name)
    require(record.get("name") == name, "Preview upload asset name differs")
    read_asset(api, record, output, expected)
    current[name] = record
    return record


def restore_catalog(api, release_id, previous, candidate, owned_id, output):
    current = assets(api, release_id).get("catalog.json")
    if current is not None:
        raw = read_asset(api, current, output / "current", maximum=8 * 1024 ** 2)
        if raw == previous:
            return
        require(current["id"] == owned_id or raw == candidate, "Preview catalog changed outside this publisher; preserve remote state")
        api.request(PREFIX + "/releases/assets/" + str(current["id"]), "DELETE")
    if previous is not None:
        path = output / "original/catalog.json"
        path.parent.mkdir(parents=True)
        with path.open("xb") as stream:
            stream.write(previous)
        expected = dict(path="catalog.json", sizeBytes=len(previous), sha256=hashlib.sha256(previous).hexdigest())
        upload_immutable(api, release_id, path, "catalog.json", expected, {}, output / "readback")
    restored = assets(api, release_id).get("catalog.json")
    if previous is None:
        require(restored is None, "Preview catalog removal was not observed")
    else:
        require(restored is not None and read_asset(api, restored, output / "final", maximum=8 * 1024 ** 2) == previous,
                "Original preview catalog was not restored")
