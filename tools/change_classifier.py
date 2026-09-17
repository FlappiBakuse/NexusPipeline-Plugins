"""Classify plugin-repository changes into the validation gates.

The classifier is intentionally small and deterministic.  It is used by the
pull-request workflow and imported by repository tests so that the workflow
does not contain a second, untestable copy of the rules.
"""

from __future__ import annotations

import argparse
import os
import subprocess
from collections.abc import Iterable, Sequence

SOURCE = "source"
FRONTEND = "frontend"
MANAGED = "managed"
PACKAGE = "package"
GATES = (SOURCE, FRONTEND, MANAGED, PACKAGE)

FRONTEND_SCRIPTS = frozenset(
    {
        "tools/Test-FrontendPlugins.mjs",
        "tools/Test-ConfigEditors.mjs",
    }
)
BUILD_CONFIG = frozenset(
    {
        "global.json",
        "Directory.Build.props",
        "Directory.Build.targets",
    }
)
PACKAGE_ROOT_FILES = frozenset(
    {
        "catalog.json",
        ".release-state.json",
        "host.lock.json",
        "package.json",
        "package-lock.json",
    }
)


def normalize_path(path: str) -> str | None:
    """Normalize a repository-relative path without hiding traversal."""

    if not isinstance(path, str):
        return None
    value = path.strip().replace("\\", "/")
    if not value or value.startswith("/") or len(value) >= 3 and value[1] == ":":
        return None
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        return None
    return "/".join(parts)


def plugin_relative(path: str) -> tuple[str, ...] | None:
    """Return path segments below a plugin root, or ``None`` outside plugins."""

    normalized = normalize_path(path)
    if normalized is None:
        return None
    parts = normalized.split("/")
    if len(parts) < 3 or parts[0] != "plugins":
        return None
    if parts[1] in {"general", "specialized"}:
        if len(parts) < 4:
            return None
        return tuple(parts[3:])
    return tuple(parts[2:])


def classify_path(path: str) -> frozenset[str]:
    """Return every gate that must validate one changed path."""

    normalized = normalize_path(path)
    if normalized is None:
        return frozenset({SOURCE})

    hits: set[str] = set()
    relative = plugin_relative(normalized)
    if normalized.startswith("plugins/"):
        hits.add(PACKAGE)
        if relative:
            head = relative[0]
            if len(relative) == 1 and head in {"plugin.json", "store.json"}:
                hits.add(SOURCE)
            elif head in {"data", "i18n"}:
                hits.add(SOURCE)
            if len(relative) == 1 and head == "plugin.json":
                hits.add(FRONTEND)
            elif head == "data" and relative[-1].endswith(".js"):
                hits.add(FRONTEND)
            elif head in {"frontend", "web"}:
                hits.add(FRONTEND)
            elif head in {"src", "tests"}:
                hits.add(MANAGED)
        if normalized.endswith(".csproj"):
            hits.add(MANAGED)
        return frozenset(hits)

    if normalized.startswith("tools/"):
        hits.update({SOURCE, PACKAGE})
        if normalized in FRONTEND_SCRIPTS:
            hits.add(FRONTEND)
        if normalized.startswith("tools/PluginTestKit/"):
            hits.add(MANAGED)
        return frozenset(hits)

    if normalized == "host.lock.json":
        return frozenset({SOURCE, MANAGED, PACKAGE})
    if normalized in {"package.json", "package-lock.json"}:
        return frozenset({FRONTEND, PACKAGE})
    if normalized in {"catalog.json", ".release-state.json"} or normalized.startswith("packages/"):
        return frozenset({SOURCE, PACKAGE})
    if normalized in BUILD_CONFIG:
        return frozenset({MANAGED, PACKAGE})
    return frozenset({SOURCE})


def parse_name_status_z(output: bytes | str) -> list[str]:
    """Parse NUL-separated ``git diff --name-status -z`` output.

    Rename and copy records contain both the old and new path.  Keeping both
    sides ensures that a cross-domain move executes both relevant gates.
    """

    text = output.decode("utf-8", errors="replace") if isinstance(output, bytes) else str(output or "")
    tokens = text.split("\0")
    paths: list[str] = []
    index = 0
    while index < len(tokens):
        status = tokens[index]
        index += 1
        if not status:
            continue
        if status.startswith(("R", "C")):
            old_path = tokens[index] if index < len(tokens) else ""
            new_path = tokens[index + 1] if index + 1 < len(tokens) else ""
            index += 2
            if old_path:
                paths.append(old_path)
            if new_path:
                paths.append(new_path)
            continue
        file_path = tokens[index] if index < len(tokens) else ""
        index += 1
        if file_path:
            paths.append(file_path)
    return paths


def changed_paths(root: str, base: str, head: str) -> list[str]:
    """Read the complete changed path set for a pull request."""

    if not base or not head:
        raise ValueError("pull_request 事件缺少 base/head SHA")
    completed = subprocess.run(
        ["git", "diff", "--name-status", "--find-renames", "-z", f"{base}...{head}", "--"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    return parse_name_status_z(completed.stdout)


def classify_paths(paths: Iterable[str]) -> tuple[set[str], dict[str, frozenset[str]]]:
    """Classify paths and return enabled gates plus per-path evidence."""

    evidence: dict[str, frozenset[str]] = {}
    enabled: set[str] = set()
    for path in paths:
        hits = classify_path(path)
        evidence[path] = hits
        enabled.update(hits)
    return enabled, evidence


def run(event_name: str, base: str = "", head: str = "", root: str = ".") -> int:
    """Run the classifier and optionally emit GitHub Actions outputs."""

    if event_name != "pull_request":
        paths: list[str] | None = None
        enabled = set(GATES)
        print("[changes] workflow_dispatch：四个 Gate 全部执行")
    else:
        paths = changed_paths(root, base, head)
        enabled, evidence = classify_paths(paths)
        for path in sorted(evidence):
            print(f"[changes] {path} -> {', '.join(sorted(evidence[path]))}")
        if not paths:
            enabled.add(SOURCE)
            print("[changes] 未检测到变更路径，回退执行 plugin-source")

    lines = [f"{gate}={str(gate in enabled).lower()}" for gate in GATES]
    for line in lines:
        print(f"[changes] {line}")
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as stream:
            stream.write("\n".join(lines) + "\n")
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", default=os.environ.get("EVENT_NAME", "workflow_dispatch"))
    parser.add_argument("--base", default=os.environ.get("BASE_SHA", ""))
    parser.add_argument("--head", default=os.environ.get("HEAD_SHA", "HEAD"))
    parser.add_argument("--root", default=".")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    options = parse_args(argv)
    return run(options.event, options.base, options.head, options.root)


if __name__ == "__main__":
    raise SystemExit(main())
