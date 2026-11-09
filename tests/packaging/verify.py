"""Verify native package input boundaries using synthetic archives outside the repository."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import sys
import time
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "plugins/managed/maa-framework/extension.json"
sys.path.insert(0, str(ROOT / "tooling"))
from maa_runtime_package import runtime_members


def encoded(value):
    return (json.dumps(value, indent=2) + "\n").encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


class RuntimeTests(unittest.TestCase):
    root = None

    def setUp(self):
        self.work = self.root / self._testMethodName
        self.runtime = self.work / "runtime"
        (self.runtime / "bin").mkdir(parents=True)
        self.pin_path, self.receipt_path = self.work / "pin.json", self.work / "receipt.json"
        self.archive = self.work / "runtime.zip"
        self.manifest = json.loads(MANIFEST.read_bytes())
        libraries = sorted(Path(path).name for path in self.manifest["managed"]["nativeLibraries"])
        files = []
        with zipfile.ZipFile(self.archive, "w") as archive:
            for index, name in enumerate(libraries):
                data = bytes([index + 1]) * (index + 2)
                (self.runtime / "bin" / name).write_bytes(data)
                archive.writestr("bin/" + name, data)
                files.append({"path": "bin/" + name, "sizeBytes": len(data), "sha256": digest(data)})
        self.pin = {"repository": "MaaXYZ/MaaFramework", "releaseId": 1, "tag": "v5.14.3", "sourceCommit": "a" * 40,
                    "assetId": 2, "assetName": "MAA-win-x86_64-v5.14.3.zip", "assetSha256": digest(self.archive.read_bytes())}
        self.receipt = {"status": "VERIFIED_BINARY_INPUT_ONLY", "releaseId": 1, "tag": self.pin["tag"], "sourceCommit": self.pin["sourceCommit"],
            "asset": {"id": 2, "name": self.pin["assetName"], "digest": "sha256:" + self.pin["assetSha256"], "size": self.archive.stat().st_size,
                "browser_download_url": "https://github.com/MaaXYZ/MaaFramework/releases/download/v5.14.3/" + self.pin["assetName"]},
            "archive": str(self.archive), "runtime": str(self.runtime), "files": files}

    def invoke(self):
        self.pin_path.write_bytes(encoded(self.pin)); self.receipt_path.write_bytes(encoded(self.receipt))
        return runtime_members(self.manifest, self.pin_path, self.receipt_path)

    def test_complete_closure(self):
        members, proof = self.invoke()
        lock = json.loads(members.pop("runtime/win-x64/runtime-lock.json"))
        with zipfile.ZipFile(self.archive) as archive:
            self.assertEqual({"runtime/win-x64/" + Path(name).name: archive.read(name) for name in archive.namelist()}, members)
        self.assertEqual("5.14.3", lock["runtimeVersion"])
        self.assertCountEqual([dict(name=Path(item["path"]).name, sizeBytes=item["sizeBytes"], sha256=item["sha256"])
                               for item in self.receipt["files"]], lock["files"])
        self.assertEqual(digest(self.receipt_path.read_bytes()), proof["inputReceiptSha256"])

    def test_archive_digest(self):
        self.archive.write_bytes(b"changed")
        with self.assertRaises(ValueError): self.invoke()

    def test_runtime_bytes(self):
        (self.runtime / "bin/MaaFramework.dll").write_bytes(b"changed")
        with self.assertRaises(ValueError): self.invoke()

    def test_mixed_archive(self):
        with zipfile.ZipFile(self.archive, "w") as archive:
            for record in self.receipt["files"]: archive.writestr(record["path"], b"other")
        self.pin["assetSha256"] = digest(self.archive.read_bytes())
        self.receipt["asset"].update(digest="sha256:" + self.pin["assetSha256"], size=self.archive.stat().st_size)
        with self.assertRaises(ValueError): self.invoke()

    def test_missing_inventory(self):
        self.receipt["files"].pop()
        with self.assertRaises(ValueError): self.invoke()

    def test_duplicate_inventory(self):
        self.receipt["files"][-1] = self.receipt["files"][0]
        with self.assertRaises(ValueError): self.invoke()

    def test_extra_native(self):
        self.manifest["managed"]["nativeLibraries"].append("runtime/win-x64/foreign.dll")
        with self.assertRaises(ValueError): self.invoke()

    def test_release_identity(self):
        self.receipt["sourceCommit"] = "b" * 40
        with self.assertRaises(ValueError): self.invoke()

    def test_foreign_asset(self):
        self.receipt["asset"]["browser_download_url"] = "https://example.test/runtime.zip"
        with self.assertRaises(ValueError): self.invoke()

    def test_foreign_extension(self):
        self.manifest["extensionId"] = "other"
        with self.assertRaises(ValueError): self.invoke()

    def test_unknown_pin(self):
        self.pin["unknown"] = True
        with self.assertRaises(ValueError): self.invoke()

    def test_receipt_status(self):
        self.receipt["status"] = "PASS"
        with self.assertRaises(ValueError): self.invoke()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    output = parser.parse_args().output.absolute()
    if ROOT == output or ROOT in output.parents or output in ROOT.parents:
        raise ValueError("Packaging fixture output must be disjoint from source")
    if any(path.is_symlink() or path.is_junction() for path in (output, *output.parents)):
        raise ValueError("Packaging fixture output crosses a link")
    run = output / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True); RuntimeTests.root = run
    sources = [Path(__file__), MANIFEST, ROOT / "tooling/maa_runtime_package.py", ROOT / "tooling/source_snapshot.py"]
    records = [{"path": path.relative_to(ROOT).as_posix(), "sha256": digest(path.read_bytes())} for path in sources]
    log = io.StringIO(); started = time.monotonic()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RuntimeTests)
    expected = suite.countTestCases()
    result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    status = "PASS" if result.wasSuccessful() and result.testsRun == expected and expected > 0 and not result.skipped and \
        all(digest((ROOT / record["path"]).read_bytes()) == record["sha256"] for record in records) else "FAIL"
    (run / "native.log").write_bytes(log.getvalue().encode())
    report = {"status": status, "qualification": "Synthetic archive packaging boundaries; no native execution", "cases": result.testsRun,
              "failed": len(result.failures) + len(result.errors), "skipped": len(result.skipped), "inputs": records,
              "elapsedSeconds": time.monotonic() - started, "command": sys.argv}
    (run / "receipt.json").write_bytes(encoded(report))
    print(json.dumps({"status": status, "cases": result.testsRun, "receipt": str(run / "receipt.json")}))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
