import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile


spec = importlib.util.spec_from_file_location("architecture_check", Path(__file__).with_name("check.py"))
architecture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(architecture)


class ArchitectureCheckTests(unittest.TestCase):
    def test_specialized_data_script_is_allowed_and_binary_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="plugin-arch-") as directory:
            package = Path(directory) / "fixture.zip"
            with zipfile.ZipFile(package, "w") as archive:
                archive.writestr("plugin.json", "{}")
                archive.writestr("data/judge.js", "export default true")
            self.assertEqual(architecture.check_specialized_zip(package, "Fixture"), [])
            with zipfile.ZipFile(package, "a") as archive:
                archive.writestr("web/main.js", "")
                archive.writestr("data/worker.dll", "")
            self.assertEqual(len(architecture.check_specialized_zip(package, "Fixture")), 2)

    def test_managed_frontend_cannot_import_host_private_vue(self):
        with tempfile.TemporaryDirectory(prefix="plugin-arch-") as directory:
            base = Path(directory)
            plugin = base / "Plugin"
            host = base / "Host"
            (plugin / "frontend").mkdir(parents=True)
            (host / "frontend" / "src" / "ui").mkdir(parents=True)
            source = plugin / "frontend" / "main.ts"
            source.write_text("import '../local';", encoding="utf-8")
            self.assertEqual(architecture.check_managed_imports(plugin, "Plugin", host), [])
            private = host / "frontend" / "src" / "ui" / "Private.vue"
            source.write_text(f"import '{private.as_posix()}';", encoding="utf-8")
            self.assertEqual(len(architecture.check_managed_imports(plugin, "Plugin", host)), 1)
            source.write_text("import '../../Host/frontend/src/ui/Private.vue';", encoding="utf-8")
            self.assertEqual(len(architecture.check_managed_imports(plugin, "Plugin", host)), 1)


if __name__ == "__main__":
    unittest.main()
