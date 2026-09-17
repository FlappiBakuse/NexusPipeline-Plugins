"""Resolve the immutable host baseline or an explicit candidate commit."""
import json
import os
from pathlib import Path
import re

lock = json.loads(Path("host.lock.json").read_text(encoding="utf-8"))
reference = os.environ.get("NEXUS_CANDIDATE_HOST_REF") or lock.get("ref", "")
if lock.get("repository") != "FlappiBakuse/NexusPipeline" or not re.fullmatch(r"[0-9a-f]{40}", reference):
    raise SystemExit("Host baseline must identify the host repository and a complete commit SHA")
output = f"ref={reference}\n"
print(output, end="")
if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        stream.write(output)
