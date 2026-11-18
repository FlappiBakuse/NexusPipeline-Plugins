"""Pinned native producer behavior with controlled official metadata and archive bytes."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tooling"))
import native_inputs


class NativeInputTests(unittest.TestCase):
    def prepare(self, members):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        plugin = root / "plugins/managed/maa-framework"
        plugin.mkdir(parents=True)
        output = root / "output"
        output.mkdir()
        archive = output / "runtime.zip"
        with zipfile.ZipFile(archive, "w") as package:
            for name in members:
                package.writestr(name, b"controlled native input")
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        pin = dict(repository="fixture/maa", assetId=7, releaseId=3, tag="v1", assetName=archive.name,
                   assetSha256=digest, sourceCommit="a" * 40)
        (plugin / "runtime.release.json").write_text(json.dumps(pin), encoding="utf-8")
        (plugin / "extension.json").write_text(json.dumps({"managed": {"nativeLibraries": ["runtime/win-x64/MaaFramework.dll"]}}), encoding="utf-8")
        asset = dict(id=7, name=archive.name, size=archive.stat().st_size, digest="sha256:" + digest,
                     browser_download_url="https://github.com/fixture/maa/releases/download/v1/runtime.zip")
        return root, output, archive, asset

    def invoke(self, root, output, asset):
        with patch.object(native_inputs.urllib.request, "urlopen", return_value=io.BytesIO(json.dumps(asset).encode())):
            return native_inputs.maa_runtime(root, output)

    def test_accepts_fixed_archive_and_preserves_receipt(self):
        root, output, _, asset = self.prepare(["bin/MaaFramework.dll"])
        receipt = json.loads(self.invoke(root, output, asset).read_bytes())
        self.assertEqual("VERIFIED_BINARY_INPUT_ONLY", receipt["status"])
        self.assertEqual("a" * 40, receipt["sourceCommit"])
        self.assertEqual(["bin/MaaFramework.dll"], [item["path"] for item in receipt["files"]])
        self.assertEqual(b"controlled native input", (output / "runtime/bin/MaaFramework.dll").read_bytes())

    def test_rejects_changed_archive(self):
        root, output, archive, asset = self.prepare(["bin/MaaFramework.dll"])
        archive.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "digest or size"):
            self.invoke(root, output, asset)

    def test_rejects_missing_library(self):
        root, output, _, asset = self.prepare(["bin/other.dll"])
        with self.assertRaisesRegex(ValueError, "Missing or duplicate"):
            self.invoke(root, output, asset)

    def test_rejects_duplicate_library(self):
        root, output, _, asset = self.prepare(["bin/MaaFramework.dll", "bin/MaaFramework.dll"])
        with self.assertRaisesRegex(ValueError, "Missing or duplicate"):
            self.invoke(root, output, asset)

    def test_rejects_unbound_official_metadata(self):
        root, output, _, asset = self.prepare(["bin/MaaFramework.dll"])
        asset["id"] = 8
        with self.assertRaisesRegex(ValueError, "fixed release pin"):
            self.invoke(root, output, asset)


if __name__ == "__main__":
    unittest.main()
