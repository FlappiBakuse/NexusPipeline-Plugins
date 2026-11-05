"""Read immutable distribution facts and cumulative plugin source changes."""
from pathlib import PurePosixPath
import re
import subprocess
import xml.etree.ElementTree as ET

from git_source import git
from release_candidate import parse
from release_provenance import require, sha

CATALOG = "metadata/catalog/stable.json"
STATE = "metadata/releases/stable-state.json"
ARTIFACT = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}")
EXTENSION = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")
SEMVER = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(beta|rc)\.(0|[1-9][0-9]*))?")


def version(value):
    match = SEMVER.fullmatch(value) if isinstance(value, str) else None
    require(match is not None, "Release versions require canonical stable, beta.N or rc.N SemVer")
    major, minor, patch, stage, ordinal = match.groups()
    return int(major), int(minor), int(patch), {"beta": 0, "rc": 1, None: 2}[stage], int(ordinal or 0)


def tree_files(root, commit, prefix=None):
    arguments = ["ls-tree", "-r", "-z", "--full-tree", sha(commit)]
    if prefix:
        arguments += ["--", prefix]
    result = {}
    for row in git(root, *arguments).split(b"\0"):
        if not row:
            continue
        metadata, path = row.split(b"\t", 1)
        mode, kind, identity = metadata.decode().split()
        name = path.decode("utf-8")
        require(mode in ("100644", "100755") and kind == "blob", "Release inputs require ordinary Git files")
        result[name] = identity
    return result


def object_json(root, commit, path):
    return parse(git(root, "show", sha(commit) + ":" + path))


def ancestor(root, older, newer):
    result = subprocess.run(["git", "-C", str(root), "merge-base", "--is-ancestor", sha(older), sha(newer)],
                            capture_output=True)
    require(result.returncode == 0, "Published source cursor must precede the candidate and distribution snapshots")


def distribution(root, commit):
    files = tree_files(root, commit)
    require({CATALOG, STATE, "catalog.json"} <= files.keys(), "Distribution snapshot lacks canonical catalog, projection or state")
    raw = git(root, "show", commit + ":" + CATALOG)
    require(raw == git(root, "show", commit + ":catalog.json"), "Published catalog projection differs from its authority")
    catalog, state = parse(raw), object_json(root, commit, STATE)
    require(catalog.get("schemaVersion") == 2 and catalog.get("repository") == "FlappiBakuse/NexusPipeline-Plugins" and
            isinstance(catalog.get("plugins"), list) and state.get("schemaVersion") == 1 and
            type(state.get("schemaVersion")) is int and isinstance(state.get("released"), dict), "Published distribution contract is invalid")
    entries, names = {}, set()
    for entry in catalog["plugins"]:
        require(isinstance(entry, dict), "Published catalog entry must be an object")
        artifact = entry.get("artifactName")
        require(isinstance(artifact, str) and ARTIFACT.fullmatch(artifact) and artifact.casefold() not in names,
                "Published artifact identity is missing or duplicated")
        entries[artifact] = entry
        names.add(artifact.casefold())
    require(set(entries) == set(state["released"]), "Published catalog and state plugin sets differ")
    for artifact, record in state["released"].items():
        entry = entries[artifact]
        require(isinstance(record, dict) and all(record.get(key) == entry.get(key) for key in
                ("artifactName", "name", "version", "sha256", "sizeBytes")), "Published package facts disagree")
        require(record["artifactName"] == artifact and EXTENSION.fullmatch(str(record.get("name"))) and
                re.fullmatch("[0-9a-f]{64}", str(record.get("sha256"))) and type(record.get("sizeBytes")) is int and
                record["sizeBytes"] > 0, "Published package identity is invalid")
        version(record["version"])
        sha(record.get("sourceTree"))
        require(f"packages/{artifact}/{artifact}-{record['version']}.zip" in files, "Published package path is missing")
    cursor = sha(state.get("sourceCommit"))
    ancestor(root, cursor, commit)
    return {"commit": commit, "tree": git(root, "rev-parse", commit + "^{tree}").decode().strip(),
            "catalogBlob": files[CATALOG], "stateBlob": files[STATE]}, state, files


def previous_plugins(root, cursor):
    result, names, identities = {}, set(), set()
    for path in tree_files(root, cursor, "plugins"):
        parts = PurePosixPath(path).parts
        if len(parts) != 4 or parts[1] not in ("general", "managed", "specialized") or parts[3] not in ("plugin.json", "extension.json"):
            continue
        manifest = object_json(root, cursor, path)
        identity = manifest.get("name" if parts[3] == "plugin.json" else "extensionId")
        artifact = manifest.get("artifactName")
        require(EXTENSION.fullmatch(str(identity)) and ARTIFACT.fullmatch(str(artifact)) and
                artifact.casefold() not in names and identity not in identities,
                "Published source identities are ambiguous")
        result[artifact] = {"extensionId": identity, "path": "/".join(parts[:3])}
        names.add(artifact.casefold())
        identities.add(identity)
    return result


def changed_paths(root, cursor, commit):
    arguments = ["diff", "--name-only", "--no-renames", "-z", sha(cursor)]
    if commit:
        arguments.append(sha(commit))
    data = git(root, *arguments)
    if commit is None:
        data += git(root, "ls-files", "--others", "--exclude-standard", "-z")
    return sorted(set(data.decode("utf-8").split("\0")) - {""})


def project_signature(data):
    root = ET.fromstring(data)
    result = []
    for node in root.iter():
        if node.tag in ("Project", "PropertyGroup", "ItemGroup") and not node.attrib:
            continue
        attributes = dict(node.attrib)
        if node.tag == "ProjectReference" and "Include" in attributes:
            attributes["Include"] = attributes["Include"].replace("\\", "/").rsplit("/", 1)[-1]
        result.append((node.tag, sorted(attributes.items()), (node.text or "").strip()))
    return result


def payload_change(root, cursor, commit, path, previous, current):
    relative = path[len(current["path"]) + 1:] if path.startswith(current["path"] + "/") else path[len(previous["path"]) + 1:]
    if "tests" in PurePosixPath(relative).parts or relative.endswith((".sln", ".slnx")):
        return False
    if not relative.endswith((".csproj", ".fsproj", ".vbproj")):
        return True
    try:
        before = git(root, "show", cursor + ":" + previous["path"] + "/" + relative)
        after = git(root, "show", commit + ":" + path) if commit else (root / path).read_bytes()
        return project_signature(before) != project_signature(after)
    except (OSError, subprocess.CalledProcessError, ET.ParseError):
        return True
