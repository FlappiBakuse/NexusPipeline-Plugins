"""Verify an original stable Actions candidate and optionally apply its Git transaction."""
import argparse
import json
import os
from pathlib import Path
import sys

from ci_plan import source_identity
from plugin_release_publish import publish_stable
from release_candidate import extract, validate
from release_github import GitHub
from release_provenance import POLICIES, positive, require, resolve_candidate, sha
from source_snapshot import external_directory


def writer_control(kind="stable"):
    require(kind in ("stable", "preview"), "Unknown plugin writer channel")
    policy = POLICIES[kind]
    require(os.environ.get("GITHUB_REPOSITORY") == policy["repository"] and
            os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and os.environ.get("GITHUB_REF") == "refs/heads/main" and
            os.environ.get("GITHUB_WORKFLOW_REF") == policy["repository"] + "/" + policy["workflow"] + "@refs/heads/main",
            "Stable writer requires the official manual main workflow")
    return {"repository": policy["repository"], "workflow": policy["workflow"],
            "workflowCommit": sha(os.environ.get("GITHUB_SHA")), "runId": positive(int(os.environ.get("GITHUB_RUN_ID", "0"))),
            "runAttempt": positive(int(os.environ.get("GITHUB_RUN_ATTEMPT", "0")))}


def verify_original(args, api=None):
    root = Path(__file__).resolve().parent.parent
    output = external_directory(root, args.output)
    require(not output.exists(), "Stable verification output requires a new owned directory")
    api = api if api is not None else GitHub()
    provenance = resolve_candidate(api.fetch, "stable", args.run_id, args.writer_id, args.artifact_id)
    if args.publish:
        control = writer_control()
        require(control == provenance["writer"], "Stable writer control differs from its server-owned run")
        source_identity(root, control["workflowCommit"])
    output.mkdir(parents=True)
    (output / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    result = {"status": "RUNNING", "remoteWritten": False}
    try:
        archive = output / "candidate.zip"
        api.download(f"repos/{provenance['repository']}/actions/artifacts/{provenance['artifactId']}/zip", archive,
                     provenance["artifactSizeBytes"], provenance["artifactDigest"].removeprefix("sha256:"))
        directory = extract(archive, output / "candidate")
        verified = validate(directory, provenance, api.fetch)
        result = publish_stable(api, directory, verified, args.publish)
        return result
    except Exception as error:
        result = {"status": "FAIL", "remoteWriteRequested": args.publish,
                  "remoteWritten": None if args.publish else False, "error": str(error)}
        raise
    finally:
        (output / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("run-id", "writer-id"):
        parser.add_argument("--" + name, type=int, required=True)
    parser.add_argument("--artifact-id", type=int)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--publish", action="store_true")
    try:
        print(json.dumps(verify_original(parser.parse_args()), ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, KeyError) as error:
        print("ERROR: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
