"""Plan cumulative stable or preview packages without rebuilding or reading old ZIPs."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

from ci_plan import plugins, source_identity
from git_source import git
from plugin_release_inputs import (ARTIFACT, EXTENSION, ancestor, changed_paths, distribution, payload_change,
                                   previous_plugins, version)
from release_candidate import parse
from release_provenance import require, sha
from source_snapshot import external_directory, ordinary_path


def declarations(root):
    result = {}
    names = set()
    inputs = plugins(root)
    paths = [*root.glob("plugins/managed/*/extension.json"), *root.glob("plugins/specialized/*/extension.json")]
    require(len(inputs) == len(paths), "Current extension IDs are duplicated")
    for identity, item in inputs.items():
        manifest = parse((root / item["path"] / "extension.json").read_bytes())
        artifact = manifest.get("artifactName")
        require(EXTENSION.fullmatch(identity) and Path(item["path"]).name == identity and
                isinstance(artifact, str) and ARTIFACT.fullmatch(artifact) and artifact.casefold() not in names,
                "Current plugin identities are ambiguous or noncanonical")
        require(manifest.get("kind") == ("managed-code" if item["kind"] == "managed" else "data-specialized"),
                "Plugin kind differs from its source declaration")
        version(manifest.get("packageVersion"))
        names.add(artifact.casefold())
        result[artifact] = {"extensionId": identity, **item, "version": manifest["packageVersion"]}
    return result


def select_changes(root, cursor, commit, paths, current, prior):
    reasons = {}
    for path in paths:
        matched = False
        for artifact, item in current.items():
            previous = prior.get(artifact, item)
            if path.startswith((item["path"] + "/", previous["path"] + "/")):
                matched = True
                if payload_change(root, cursor, commit, path, previous, item):
                    reasons.setdefault(artifact, []).append(path)
        if matched or path.startswith(("docs/", "tests/", "tooling/", ".github/", "metadata/", "packages/")) or path in (
                "catalog.json", "LICENSE", "COPYING", "contracts/sdk-source-lock.json") or path.lower().endswith(".md") or "tests" in Path(path).parts:
            continue
        if path.startswith("plugins/managed/frontend-ui/"):
            selected = [artifact for artifact, item in current.items() if item["frontend"]]
        elif path.startswith("adapter-runtime/"):
            selected = [artifact for artifact, item in current.items() if item["kind"] == "specialized" or item["extensionId"] == "maa-framework"]
        elif any(path.startswith(item["path"] + "/") for item in prior.values()):
            selected = []
        else:
            selected = list(current)
        for artifact in selected:
            reasons.setdefault(artifact, []).append(path)
    return reasons


def retention(files, artifact, target_version):
    versions = {}
    prefix = "packages/" + artifact + "/"
    for path in files:
        if not path.startswith(prefix):
            continue
        name = path[len(prefix):]
        require(name.startswith(artifact + "-") and name.endswith(".zip") and "/" not in name,
                "Affected published artifact contains an unowned package path")
        value = name[len(artifact) + 1:-4]
        versions[value] = path
        version(value)
    versions[target_version] = prefix + artifact + "-" + target_version + ".zip"
    return sorted(versions[value] for value in sorted(versions, key=version, reverse=True)[3:])


def make_plan(root, distribution_root, distribution_commit, source_commit=None, channel="stable"):
    root, distribution_root = ordinary_path(root).resolve(strict=True), ordinary_path(distribution_root).resolve(strict=True)
    require(channel in ("stable", "preview"), "Unknown plugin release channel")
    fixed = sha(distribution_commit)
    baseline, state, files = distribution(distribution_root, fixed)
    cursor = state["sourceCommit"]
    head = sha(source_commit) if source_commit else sha(git(root, "rev-parse", "HEAD").decode().strip())
    ancestor(root, cursor, head)
    source = source_identity(root, source_commit)
    current, prior = declarations(root), previous_plugins(root, cursor)
    require(set(state["released"]) <= prior.keys(), "Released cursor lacks its original source identities")
    for artifact, record in state["released"].items():
        require(prior[artifact]["extensionId"] == record["name"], "Published source and distribution identities differ")
    paths = changed_paths(root, cursor, source_commit)
    reasons = select_changes(root, cursor, source_commit, paths, current, prior)
    deleted = sorted(set(state["released"]) - set(current))
    for artifact in current.keys() - state["released"].keys():
        reasons.setdefault(artifact, []).append("new-plugin")
    selected = sorted(reasons)
    for artifact in selected:
        previous = state["released"].get(artifact)
        require(previous is None or channel == "preview" or version(current[artifact]["version"]) > version(previous["version"]),
                "Changed stable package requires a newer version: " + artifact)
    for artifact, item in current.items():
        previous = state["released"].get(artifact)
        require(previous is None or item["extensionId"] == previous["name"], "Published artifact cannot change its extension identity")
        require(previous is None or version(item["version"]) >= version(previous["version"]), "Plugin source version regresses: " + artifact)
    removed = sorted(path for artifact in selected for path in retention(files, artifact, current[artifact]["version"])) if channel == "stable" else []
    for artifact in deleted:
        retention(files, artifact, state["released"][artifact]["version"])
    require(source_identity(root, source_commit) == source, "Release source changed while planning")
    return {"format": "nexus.plugins.release-plan", "version": 1, "channel": channel,
            "status": "PLANNED" if selected or deleted else "NO_CHANGES", "publishable": False,
            "source": source, "distribution": baseline, "base": cursor, "changedPaths": paths,
            "changed": selected, "deleted": deleted, "requiresPackage": selected,
            "managed": [artifact for artifact in selected if current[artifact]["kind"] == "managed"],
            "reasons": {artifact: sorted(set(reasons[artifact])) for artifact in selected},
            "plugins": {artifact: current[artifact] for artifact in sorted(current)},
            "removePackages": removed, "removeArtifacts": ["packages/" + artifact for artifact in deleted] if channel == "stable" else []}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source-root", "distribution-root", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--distribution-commit", required=True)
    parser.add_argument("--source-commit")
    parser.add_argument("--channel", choices=("stable", "preview"), default="stable")
    args = parser.parse_args()
    try:
        output = external_directory(args.source_root, args.output)
        external_directory(args.distribution_root, output)
        require(not output.exists() or output.is_dir() and not any(output.iterdir()),
                "Release plan output must be new or empty")
        plan = make_plan(args.source_root, args.distribution_root, args.distribution_commit, args.source_commit, args.channel)
        output.mkdir(parents=True, exist_ok=True)
        (output / "release-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": plan["status"], "publishable": False, "report": str(output / "release-plan.json")}))
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print("ERROR: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
