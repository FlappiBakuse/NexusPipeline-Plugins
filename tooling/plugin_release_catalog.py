"""Project stable catalog entries from package metadata and authored release notes."""
from copy import deepcopy
from datetime import date, datetime, timezone
import re

from plugin_release_inputs import version
from release_provenance import require

REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"


def changelog(path, current, production):
    require(path.is_file(), "Current package changelog is missing: " + str(path))
    raw = path.read_bytes()
    require(len(raw) <= 65536, "Package changelog exceeds its bound")
    selected, entries, released, count = False, [], None, 0
    for line in raw.decode("utf-8").splitlines():
        if line.startswith("## "):
            match = re.fullmatch(r"## (\S+)(?: - (\d{4}-\d{2}-\d{2}))?", line)
            require(match is not None, "Package changelog heading is noncanonical")
            value, declared = match.groups()
            version(value)
            selected = value == current
            if declared:
                require(date.fromisoformat(declared).isoformat() == declared, "Package release date is invalid")
            if selected:
                count += 1
                released = declared
        elif selected and line.startswith("- "):
            text = line[2:].strip()
            require(0 < len(text) <= 512 and "<" not in text and ">" not in text, "Package release note is invalid")
            entries.append(text)
    require(count == 1 and 0 < len(entries) <= 32, "Package changelog must contain one nonempty current release")
    require(not production or released is not None, "Production candidate requires the authored current release date: " + str(path))
    return {"version": current, "date": released, "items": entries}


def history(head, previous):
    values = [head, *[deepcopy(item) for item in previous if item["version"] != head["version"]]]
    values.sort(key=lambda item: version(item["version"]), reverse=True)
    require(values[0]["version"] == head["version"], "Published release notes contain a newer version")
    return values[:3]


def published_time(value):
    if value is None:
        return None
    require(type(value) is str, "Published date must be a string or null")
    if len(value) == 10:
        require(date.fromisoformat(value).isoformat() == value, "Published day is noncanonical")
        return value + "T00:00:00Z"
    instant = datetime.fromisoformat(value)
    require(instant.utcoffset() is not None, "Published timestamp requires a timezone")
    return instant.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def catalog_entry(root, declaration, manifest, fact, previous, production):
    current = manifest["packageVersion"]
    plugin = root / declaration["path"]
    head = changelog(plugin / "CHANGELOG.md", current, production)
    previous = previous or {}
    metadata = deepcopy(manifest.get("metadata", {}))
    created = previous.get("metadata", {}).get("createdAt") or previous.get("createdAt")
    if not previous:
        created = head["date"]
    if metadata:
        metadata["createdAt"] = published_time(created)
        metadata["updatedAt"] = published_time(head["date"])
    entry = {"name": manifest["extensionId"], "artifactName": manifest["artifactName"], "version": current,
        "displayName": manifest["displayName"], "gameName": manifest.get("gameName", ""), "description": manifest.get("summary", ""),
        "authors": [{"name": manifest["author"]}] if manifest.get("author") else [], "tags": manifest.get("tags", []),
        "homepage": "https://github.com/" + REPOSITORY + "/tree/main/" + declaration["path"],
        "updatedAt": head["date"], "createdAt": published_time(created)[:10] if created else None, "hasReadme": (plugin / "README.md").is_file(),
        "kind": manifest["kind"], "apiVersion": ".".join(manifest["sdkVersion"].split(".")[:2]), "sdkVersion": manifest["sdkVersion"],
        "minHostVersion": manifest["minHostVersion"], "capabilities": sorted(manifest["capabilities"]),
        "packageUrl": "https://raw.githubusercontent.com/" + REPOSITORY + "/main/" + fact["path"],
        "sha256": fact["sha256"], "sizeBytes": fact["sizeBytes"], "manifestSha256": fact["manifestSha256"],
        "changelog": history(head, previous.get("changelog", []))}
    if metadata:
        entry["metadata"] = metadata
        localized = {}
        for locale, value in metadata["locales"].items():
            notes = head
            if locale == "en-US":
                notes = changelog(plugin / "CHANGELOG.en.md", current, production)
                require(notes["date"] == head["date"], "Localized current release dates differ")
            localized[locale] = {"displayName": value["displayName"], "gameName": value["gameName"], "description": value["summary"],
                "tags": metadata["tags"], "changelog": history(notes, previous.get("locales", {}).get(locale, {}).get("changelog", []))}
        entry["locales"] = localized
    return entry
