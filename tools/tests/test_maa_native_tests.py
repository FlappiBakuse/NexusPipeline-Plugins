from __future__ import annotations

import io
import stat
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from maa_native_tests import validate_members


class NativeArchiveTests(unittest.TestCase):
    def archive(self, names):
        memory = io.BytesIO()
        with zipfile.ZipFile(memory, "w") as writer:
            for name in names:
                writer.writestr(name, b"owned fixture")
        return zipfile.ZipFile(io.BytesIO(memory.getvalue()))

    def test_selects_only_bin_assets_after_validating_entire_archive(self):
        with self.archive(["README.md", "bin/MaaFramework.dll", "bin/models/a.bin"]) as archive:
            self.assertEqual([item.filename for item in validate_members(archive)],
                             ["bin/MaaFramework.dll", "bin/models/a.bin"])

    def test_rejects_unsafe_windows_paths_even_outside_selected_bin(self):
        for path in ("../bad", "bin/../bad", "bin/./bad", "/bad", r"C:\bad",
                     "bin/a:stream", "bin//bad", "bin/bad.", "bin/bad ",
                     "bin/CON.dll", "bin/LpT1.txt", "bin/NUL", r"..\bad"):
            with self.subTest(path=path), self.archive(["bin/MaaFramework.dll", path]) as archive:
                with self.assertRaisesRegex(ValueError, "unsafe path"):
                    validate_members(archive)

    def test_rejects_case_collision_and_unix_link(self):
        with self.archive(["bin/MaaFramework.dll", "BIN/maaframework.dll"]) as archive:
            with self.assertRaisesRegex(ValueError, "duplicate"):
                validate_members(archive)
        link = zipfile.ZipInfo("bin/link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.archive(["bin/MaaFramework.dll", link]) as archive:
            with self.assertRaisesRegex(ValueError, "link"):
                validate_members(archive)

    def test_rejects_no_native_payload_and_bounded_expansion(self):
        with self.archive(["README.md"]) as archive:
            with self.assertRaisesRegex(ValueError, "no bin assets"):
                validate_members(archive)
        with self.archive(["bin/MaaFramework.dll"]) as archive:
            archive.infolist()[0].file_size = 1024 * 1024 * 1024 + 1
            with self.assertRaisesRegex(ValueError, "exceeds limits"):
                validate_members(archive)


if __name__ == "__main__":
    unittest.main()
