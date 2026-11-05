"""Combine the finite handwritten sources declared by one specialized plugin."""
import json
from pathlib import PurePosixPath
from source_snapshot import sha
from localization import adapter_titles


def assemble_adapter(plugin):
    manifest = plugin / "adapter/sources.json"
    names = json.loads(manifest.read_bytes())
    if not isinstance(names, list) or not 1 <= len(names) <= 32 or any(not isinstance(name, str) for name in names):
        raise ValueError("Adapter source list must contain one to 32 paths")
    if len({name.casefold() for name in names}) != len(names):
        raise ValueError("Adapter source list repeats a path")
    records = [{"path": "adapter/sources.json", "sha256": sha(manifest.read_bytes())}]
    localized, locale_records = adapter_titles(plugin, json.loads((plugin / 'extension.json').read_bytes()))
    parts = [localized] if localized else []
    records.extend(locale_records)
    for name in names:
        relative = PurePosixPath(name)
        shared = name.startswith(("adapter-runtime/core/", "adapter-runtime/frameworks/"))
        if relative.is_absolute() or ".." in relative.parts or "\\" in name or ":" in name or \
                not (name.startswith("adapter/") or shared) or relative.suffix != ".js":
            raise ValueError("Adapter source is not a portable handwritten JavaScript path")
        owner = plugin.parents[2] if shared else plugin
        path = owner / name
        for candidate in (path, *path.parents):
            if candidate == owner:
                break
            if candidate.is_symlink() or candidate.is_junction():
                raise ValueError("Adapter source cannot pass through a link")
        data = path.read_bytes()
        text = data.decode("utf-8")
        if not text or "\r" in text or "\0" in text or text.startswith("\ufeff") or not text.endswith("\n") or len(text.splitlines()) > 350:
            raise ValueError("Adapter source violates UTF-8/LF or handwritten size bounds")
        parts.append(data)
        records.append({"path": name, "sha256": sha(data)})
    actual = {path.relative_to(plugin).as_posix() for path in (plugin / "adapter").rglob("*.js")}
    if actual != {name for name in names if name.startswith("adapter/")}:
        raise ValueError("Adapter source list must own every JavaScript input")
    combined = b"\n".join(parts)
    if len(combined) > 262144:
        raise ValueError("Combined adapter exceeds the actual Host interpreter input bound")
    return combined, records
