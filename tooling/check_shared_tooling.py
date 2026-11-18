"""Check the fixed Host-owned tool mirror without downloading or importing Host code."""
import hashlib
import json
from pathlib import Path

FILES = {"release_provenance.py", "release_github.py", "release_candidate.py", "git_source.py", "artifact_paths.mjs"}


def verify(root):
    manifest = json.loads((root / "tooling/shared-tooling.json").read_bytes())
    if manifest.get("format") != "nexus.shared-tooling" or manifest.get("version") != 1 or \
            manifest.get("owner", {}).get("repository") != "FlappiBakuse/NexusPipeline":
        raise ValueError("Shared tool source identity differs")
    records = manifest.get("files", [])
    if len(records) != len(FILES) or {record["path"] for record in records} != {"tooling/" + name for name in FILES}:
        raise ValueError("Shared tool mirror set differs")
    for record in records:
        name = Path(record["path"]).name
        prefix = "//" if name.endswith(".mjs") else "#"
        header = (prefix + " Generated from NexusPipeline/tooling/" + name + "; edit the Host owner.\n").encode()
        data = (root / record["path"]).read_bytes()
        if not data.startswith(header) or hashlib.sha256(data[len(header):]).hexdigest() != record["sourceSha256"]:
            raise ValueError("Shared tool mirror changed: " + name)
    return manifest


if __name__ == "__main__":
    result = verify(Path(__file__).resolve().parents[1])
    print(json.dumps({"status": "PASS", "files": len(result["files"]), "owner": result["owner"]}))
