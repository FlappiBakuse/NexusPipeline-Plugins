import importlib.util
from pathlib import Path
import unittest


class ConfigEditorGenerationTests(unittest.TestCase):
    def test_generated_editors_match_and_check_is_read_only(self):
        root = Path(__file__).resolve().parents[2]
        spec = importlib.util.spec_from_file_location('editor_generator', root / 'tools/generate/config_editors.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        files = list((root / 'plugins/specialized').glob('*/data/editor.js'))
        before = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in files}
        module.generate(root, check=True)
        self.assertEqual(8, len(files))
        self.assertEqual(before, {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in files})
