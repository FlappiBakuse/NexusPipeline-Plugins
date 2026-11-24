"""Check repository text encoding and newlines."""
from pathlib import Path
import sys

from source_snapshot import source_files

TEXT_SUFFIXES = {
    ".cs", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
    ".vue", ".css", ".scss", ".py", ".json", ".jsonc", ".yaml", ".yml", ".md",
    ".sql", ".html", ".xml", ".csproj", ".props", ".targets", ".slnx", ".iss", ".isl",
    ".ps1", ".cmd", ".bat", ".sh", ".toml", ".config", ".manifest", ".txt", ".svg",
}
TEXT_NAMES = {".editorconfig", ".gitattributes", ".gitignore", "LICENSE"}
def check_source(root):
    records = source_files(root)
    errors = []
    for record in records:
        relative = record["path"]
        path = root / relative
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in TEXT_NAMES:
            continue
        try:
            text = path.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            errors.append(f"{relative}: not UTF-8")
            continue
        if text.startswith("\ufeff") or "\r" in text or "\0" in text:
            errors.append(f"{relative}: expected UTF-8 without BOM, LF, no NUL")
        if text and not text.endswith("\n"):
            errors.append(f"{relative}: missing final LF")
    for error in errors:
        print(error, file=sys.stderr)
    print(f"source check: {len(records)} files, {len(errors)} errors", flush=True)
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(check_source(Path(__file__).resolve().parents[1]))
