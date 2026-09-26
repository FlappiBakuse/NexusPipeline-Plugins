from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from repository_core import RepositoryError, validate_maa_worker_payload


class MaaWorkerPayloadTests(unittest.TestCase):
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
            "runtimeOptions": {"tfm": "net8.0", "framework": {"name": "Microsoft.NETCore.App", "version": "8.0.0"}}})
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
        with self.assertRaisesRegex(RepositoryError, ".NET 8"):
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
