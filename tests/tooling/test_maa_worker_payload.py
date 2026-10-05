from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.repository.model import RepositoryError
from tools.repository.package import validate_maa_worker_payload, _copy_managed_payload


class MaaWorkerPayloadTests(unittest.TestCase):
    def test_private_runtime_assets_keep_paths_and_host_sdk_is_not_packaged(self):
        with tempfile.TemporaryDirectory(prefix="nxp-private-assets-") as directory:
            source = Path(directory) / "build"
            target = Path(directory) / "payload"
            source.mkdir(); target.mkdir()
            resources = {"Entry.dll": b"assembly", "Entry.deps.json": b"{}",
                         "runtimes/win-x64/native/native.dll": b"native",
                         "resources/dictionary.dat": b"data", "LICENSES/dependency.txt": b"license"}
            for name, data in resources.items():
                path = source / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            (source / "Entry.pdb").write_bytes(b"debug")
            (source / "NexusPipeline.Plugin.Abstractions.dll").write_bytes(b"shared sdk build output")
            _copy_managed_payload(source, target)
            self.assertEqual({p.relative_to(target).as_posix(): p.read_bytes() for p in target.rglob("*") if p.is_file()}, resources)
            self.assertEqual((source / "NexusPipeline.Plugin.Abstractions.dll").read_bytes(), b"shared sdk build output")

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="nxp-maa-package-")
        self.addCleanup(self.temporary.cleanup)
        self.payload = Path(self.temporary.name)
        worker = self.payload / "worker"
        worker.mkdir()
        for name in ("NexusPipeline.MaaWorker.exe", "NexusPipeline.MaaWorker.dll",
                     "MaaFramework.Binding.dll", "MaaFramework.Binding.Native.dll",
                     "NexusPipeline.Plugin.Abstractions.dll"):
            (worker / name).write_bytes(b"MZowned payload fixture")
        self.write("NexusPipeline.MaaWorker.runtimeconfig.json", {
            "runtimeOptions": {"tfm": "net10.0", "rollForward": "LatestPatch", "framework": {"name": "Microsoft.NETCore.App", "version": "10.0.12"}}})
        self.write("NexusPipeline.MaaWorker.deps.json", {"libraries": {
            "Maa.Framework.Binding/5.10.0": {}, "Maa.Framework.Binding.Native/5.10.0": {}}})
        licenses = self.payload / "LICENSES"
        licenses.mkdir()
        for name in ("NOTICE.md", "MaaFramework.Binding.LGPL-3.0.md", "GPL-3.0.txt"):
            (licenses / name).write_text("owned license fixture", encoding="utf-8")

    def write(self, name, document):
        (self.payload / "worker" / name).write_text(json.dumps(document), encoding="utf-8")

    def test_complete_layout_qualifies_and_missing_runtime_cannot(self):
        validate_maa_worker_payload(self.payload)
        (self.payload / "worker" / "NexusPipeline.MaaWorker.runtimeconfig.json").unlink()
        with self.assertRaisesRegex(RepositoryError, "缺少 worker 依赖"):
            validate_maa_worker_payload(self.payload)

    def test_wrong_binding_or_framework_rejected(self):
        self.write("NexusPipeline.MaaWorker.deps.json", {"libraries": {"Maa.Framework.Binding/5.11.0": {}}})
        with self.assertRaisesRegex(RepositoryError, "绑定版本"):
            validate_maa_worker_payload(self.payload)
        self.write("NexusPipeline.MaaWorker.runtimeconfig.json", {"runtimeOptions": {"tfm": "net9.0"}})
        with self.assertRaisesRegex(RepositoryError, ".NET 10"):
            validate_maa_worker_payload(self.payload)

    def test_other_runtime_series_and_major_roll_forward_are_rejected(self):
        for version, roll in [("8.0.31", "LatestPatch"), ("10.0.11", "LatestPatch"),
                              ("10.1.0", "LatestPatch"), ("11.0.0", "LatestPatch"), ("10.0.12", "Major")]:
            self.write("NexusPipeline.MaaWorker.runtimeconfig.json", {"runtimeOptions": {
                "tfm": "net10.0", "rollForward": roll,
                "framework": {"name": "Microsoft.NETCore.App", "version": version}}})
            with self.assertRaisesRegex(RepositoryError, ".NET 10"):
                validate_maa_worker_payload(self.payload)

    def test_license_and_test_binary_boundaries(self):
        (self.payload / "worker" / "NexusPipeline.MaaTestAgent.exe").write_bytes(b"MZfixture")
        with self.assertRaisesRegex(RepositoryError, "测试程序"):
            validate_maa_worker_payload(self.payload)
        (self.payload / "worker" / "NexusPipeline.MaaTestAgent.exe").unlink()
        (self.payload / "LICENSES" / "GPL-3.0.txt").unlink()
        with self.assertRaisesRegex(RepositoryError, "缺少许可"):
            validate_maa_worker_payload(self.payload)


if __name__ == "__main__":
    unittest.main()
