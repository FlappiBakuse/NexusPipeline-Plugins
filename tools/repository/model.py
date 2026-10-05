from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any



REPOSITORY = "FlappiBakuse/NexusPipeline-Plugins"


PACKAGE_URL_PREFIX = f"https://raw.githubusercontent.com/{REPOSITORY}/main/packages"


PREVIEW_RELEASE_URL_PREFIX = f"https://github.com/{REPOSITORY}/releases/download/plugins-develop"


STATE_FILE = ".release-state.json"


STATE_SCHEMA_VERSION = 1


MAX_RETAINED_PACKAGES = 3


MAX_ZIP_ENTRIES = 8192


MAX_ZIP_UNCOMPRESSED_BYTES = 128 * 1024 * 1024


SUPPORTED_KINDS = {"managed-code", "data-specialized"}


SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-(beta|rc)\.(0|[1-9]\d*))?$"
)


DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


ARTIFACT_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,63}$")


PLUGIN_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


PACKAGE_PATTERN = re.compile(
    r"^(?P<artifact>[A-Za-z][A-Za-z0-9]{0,63})-"
    r"(?P<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-(?:beta|rc)\.(?:0|[1-9]\d*))?)\.zip$"
)


PREVIEW_PACKAGE_PATTERN = re.compile(
    r"^(?P<artifact>[A-Za-z][A-Za-z0-9]{0,63})-"
    r"(?P<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-(?:beta|rc)\.(?:0|[1-9]\d*))?)-"
    r"(?P<sha256>[0-9a-f]{64})\.zip$"
)


TEXT_SUFFIXES = {
    ".css",
    ".csv",
    ".htm",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".svg",
    ".toml",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}


CAPABILITY_MIN_HOST = {
    "self-managed-pc-launch": "0.14.1",
    "no-fresh-config": "0.14.2",
}


SPECIALIZED_CAPABILITIES = frozenset({"emulator", "self-managed-pc-launch", "no-fresh-config"})


SPECIALIZED_FORBIDDEN_SUFFIXES = frozenset({
    ".css",
    ".htm",
    ".html",
    ".less",
    ".scss",
    ".sln",
    ".csproj",
    ".fsproj",
    ".vbproj",
    ".dll",
    ".exe",
    ".pdb",
    ".ts",
    ".tsx",
    ".jsx",
    ".vue",
    ".svelte",
    ".wasm",
})


SPECIALIZED_FORBIDDEN_NAMES = frozenset({
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
})


HOST_COMPATIBILITY_KEYS = frozenset({"hostApiVersion", "frontendApiVersion", "supportedLocales"})


HOST_API_VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+$")


JUDGE_LOCALE_MIN_HOST_VERSION = "0.15.11"


DEFAULT_SUPPORTED_LOCALES = frozenset({"zh-CN", "en-US"})


BCP47_LOCALE_PATTERN = re.compile(r"^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$")


LOCALIZATION_KEY_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]*$")


PLACEHOLDER_PATTERN = re.compile(r"\{([A-Za-z][A-Za-z0-9_.-]*)\}")


MAX_LOCALIZATION_FILE_BYTES = 512 * 1024


MAX_LOCALIZATION_KEYS = 4096


MAX_LOCALIZATION_KEY_LENGTH = 128


MAX_LOCALIZATION_VALUE_LENGTH = 8192


class RepositoryError(ValueError):
    """仓库契约或发行状态无效。"""


@dataclass(frozen=True)
class SourcePlugin:
    category: str
    root: Path
    manifest: dict[str, Any]
    store: dict[str, Any]

    @property
    def name(self) -> str:
        return str(self.manifest["name"])

    @property
    def artifact_name(self) -> str:
        return str(self.manifest["artifactName"])

    @property
    def version(self) -> str:
        return str(self.manifest["version"])

    @property
    def kind(self) -> str:
        return str(self.manifest["kind"]).strip().lower()

    @property
    def updated_at(self) -> str:
        entries = self.store.get("changelog", [])
        return str(entries[0]["date"]) if entries else ""

    @property
    def authors(self) -> list[dict[str, str]]:
        return [
            {"name": str(item["name"]), "url": str(item.get("url", ""))}
            for item in self.store.get("authors", [])
        ]


@dataclass(frozen=True)
class PackageMetadata:
    path: Path
    sha256: str
    size_bytes: int


_WINDOWS_RESERVED_NAMES = frozenset({
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{index}" for index in '123456789¹²³'),
    *(f"LPT{index}" for index in '123456789¹²³'),
})
