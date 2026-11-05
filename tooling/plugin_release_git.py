"""Read bounded Git objects and preserve their server-owned identities."""
import base64
import hashlib

from release_candidate import member_path
from release_provenance import require, sha

REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"
PREFIX = "repos/" + REPOSITORY
MAX_BLOB = 100 * 1024 ** 2


def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def head(api):
    value = api.fetch(PREFIX + "/git/ref/heads/main")
    require(value.get("ref") == "refs/heads/main" and value.get("object", {}).get("type") == "commit",
            "Stable writer requires the official main commit reference")
    return sha(value["object"].get("sha"))


def commit(api, identity):
    value = api.fetch(PREFIX + "/git/commits/" + sha(identity))
    require(value.get("sha") == identity, "Git commit server identity differs")
    sha(value.get("tree", {}).get("sha"))
    return value


def tree(api, identity):
    value = api.fetch(PREFIX + "/git/trees/" + sha(identity) + "?recursive=1")
    require(value.get("sha") == identity and value.get("truncated") is False and
            type(value.get("tree")) is list and len(value["tree"]) <= 100000, "Git tree is missing or truncated")
    files, directories, names = {}, {}, set()
    for item in value["tree"]:
        require(type(item) is dict, "Git tree member is invalid")
        path = item.get("path")
        member_path(path)
        require(path.casefold() not in names, "Git tree paths collide")
        names.add(path.casefold())
        sha(item.get("sha"))
        if item.get("type") == "tree" and item.get("mode") == "040000":
            directories[path] = item["sha"]
        else:
            require(item.get("type") == "blob" and item.get("mode") in ("100644", "100755"),
                    "Stable Git input contains a link or submodule")
            files[path] = {key: item[key] for key in ("mode", "type", "sha")}
    return files, directories


def blob(api, identity, maximum=8 * 1024 ** 2):
    require(type(maximum) is int and 0 < maximum <= MAX_BLOB, "Git blob budget is invalid")
    value = api.request(PREFIX + "/git/blobs/" + sha(identity), limit=4 * ((maximum + 2) // 3) + 4096)
    require(value.get("sha") == identity and value.get("encoding") == "base64" and
            type(value.get("content")) is str and type(value.get("size")) is int and
            0 <= value["size"] <= maximum, "Git blob server facts differ")
    data = base64.b64decode("".join(value["content"].split()), validate=True)
    require(len(data) == value["size"] and blob_sha(data) == identity, "Git blob bytes differ from their identity")
    return data


def ancestor(api, older, newer):
    value = api.fetch(PREFIX + "/compare/" + sha(older) + "..." + sha(newer))
    require(value.get("status") in ("ahead", "identical") and
            value.get("base_commit", {}).get("sha") == older and
            value.get("merge_base_commit", {}).get("sha") == older, "Stable candidate source is superseded")


def published(path):
    return path in ("catalog.json", "metadata/catalog/stable.json", "metadata/releases/stable-state.json") or path.startswith("packages/")
