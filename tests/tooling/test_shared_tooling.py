"""Validate the standalone fixed tool mirror and reject edited consumer bytes."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("check_shared_tooling", ROOT / "tooling/check_shared_tooling.py")
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class SharedToolingTests(unittest.TestCase):
    def test_detects_modified_mirror(self):
        checker.verify(ROOT)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "tooling").mkdir()
            manifest = json.loads((ROOT / "tooling/shared-tooling.json").read_bytes())
            for name in ["shared-tooling.json", *checker.FILES]:
                shutil.copyfile(ROOT / "tooling" / name, root / "tooling" / name)
            checker.verify(root)
            changed = root / manifest["files"][0]["path"]
            changed.write_bytes(changed.read_bytes() + b"\n# modified\n")
            with self.assertRaisesRegex(ValueError, "mirror changed"):
                checker.verify(root)


if __name__ == "__main__":
    unittest.main()
