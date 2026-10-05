"""Finite package boundary check for specialized and managed plugin payloads."""
import argparse
import json
from pathlib import Path
import re
import zipfile


def check_specialized_zip(package: Path, artifact: str):
    violations = []
    with zipfile.ZipFile(package) as archive:
        members = [name.replace("\\", "/") for name in archive.namelist() if not name.endswith("/")]
    if not members:
        violations.append({"ruleId": "A06", "artifact": artifact, "path": str(package), "reason": "empty package"})
    for member in members:
        allowed = member in {"plugin.json", "store.json", "README.md"} or member.startswith(("data/", "i18n/"))
        forbidden = member.lower().endswith((".dll", ".exe", ".pdb", ".csproj", ".nupkg", ".wasm"))
        if not allowed or forbidden:
            violations.append({"ruleId": "A06", "artifact": artifact, "path": member,
                               "reason": "specialized package contains non-data payload"})
    return violations


def check_managed_imports(plugin_root: Path, artifact: str, host_root: Path | None):
    violations = []
    frontend = plugin_root / "frontend"
    if not frontend.is_dir() or host_root is None:
        return violations
    private_host = (host_root / "frontend" / "src").resolve()
    for source in frontend.rglob("*"):
        if not source.is_file() or source.suffix not in {".ts", ".tsx", ".js", ".vue"}:
            continue
        if "node_modules" in source.parts or "dist" in source.parts:
            continue
        contents = source.read_text(encoding="utf-8")
        for match in re.finditer(r"\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?['\"]([^'\"]+)['\"]", contents):
            target = match.group(1)
            if not target.startswith(".") and not Path(target).is_absolute():
                continue
            resolved = (source.parent / target).resolve()
            if resolved == private_host or private_host in resolved.parents:
                violations.append({"ruleId": "A06", "artifact": artifact,
                                   "path": str(source.relative_to(plugin_root)).replace("\\", "/"),
                                   "reason": "managed frontend imports private Host source"})
    return violations


def check(root: Path, packages: Path | None = None, host_root: Path | None = None):
    violations = []
    artifacts = []
    for manifest in sorted((root / "plugins").glob("*/**/plugin.json")):
        if len(manifest.relative_to(root).parts) != 4:
            continue
        data = json.loads(manifest.read_text(encoding="utf-8"))
        artifact = data["artifactName"]
        kind = data["kind"]
        artifacts.append(artifact)
        if kind == "data-specialized":
            if data.get("frontend") is not None:
                violations.append({"ruleId": "A06", "artifact": artifact, "path": str(manifest),
                                   "reason": "specialized plugin declares browser frontend"})
            if packages is not None:
                matches = list(packages.glob(f"{artifact}-*.zip"))
                if len(matches) != 1:
                    violations.append({"ruleId": "A06", "artifact": artifact, "path": str(packages),
                                       "reason": "missing or duplicate built package"})
                else:
                    violations.extend(check_specialized_zip(matches[0], artifact))
        elif kind == "managed-code":
            violations.extend(check_managed_imports(manifest.parent, artifact, host_root))
        else:
            violations.append({"ruleId": "A06", "artifact": artifact, "path": str(manifest),
                               "reason": "unknown plugin kind"})
    if not artifacts or len(set(artifacts)) != len(artifacts):
        raise ValueError("Missing or duplicate plugin inventory")
    return {"schemaVersion": 1, "checkedRules": ["A06"], "artifacts": artifacts,
            "status": "FAIL" if violations else "PASS", "violations": violations}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--packages", type=Path)
    parser.add_argument("--host-root", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = check(args.root.resolve(), args.packages.resolve() if args.packages else None,
                   args.host_root.resolve() if args.host_root else None)
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")
    if report["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
