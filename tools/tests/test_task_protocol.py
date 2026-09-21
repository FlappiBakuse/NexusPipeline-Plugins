import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import repository_core as core
import create_task_plugin as author
import json


class TaskProtocolTests(unittest.TestCase):
    def manifest(self):
        return {
            "kind": "data-specialized", "artifactName": "Example", "minHostVersion": "0.16.8",
            "judgeScript": "data/judge.js", "taskProtocol": {
                "version": "1.0", "discoverScript": "data/discover.js",
                "retryScript": "data/retry.js", "readResources": []}}

    def test_legacy_and_current_contract(self):
        self.assertEqual({}, core._task_protocol_scripts({}))
        self.assertEqual(2, len(core._task_protocol_scripts(self.manifest())))

    def test_invalid_declaration_cannot_fall_back(self):
        for field, value in [("version", "2.0"), ("discoverScript", "../secret.js"),
                             ("retryScript", "data/retry.py"), ("retryScript", "data/C:x.js"),
                             ("readResources", None)]:
            with self.subTest(field=field, value=value):
                manifest = self.manifest()
                manifest["taskProtocol"][field] = value
                with self.assertRaises(core.RepositoryError):
                    core._task_protocol_scripts(manifest)
        for key, value in [("minHostVersion", "0.16.7"), ("minHostVersion", "0.16.8-rc.1"),
                           ("kind", "managed-code"), ("taskProtocol", None)]:
            manifest = self.manifest()
            manifest[key] = value
            with self.assertRaises(core.RepositoryError):
                core._task_protocol_scripts(manifest)

    def test_declared_scripts_are_in_real_source_closure(self):
        with tempfile.TemporaryDirectory(prefix="nxp-task-protocol-") as temporary:
            root = Path(temporary)
            (root / "data").mkdir()
            for name in ("judge", "discover", "retry"):
                (root / "data" / (name + ".js")).write_text("// fixture", encoding="utf-8")
            closure = core._specialized_script_closure(root, self.manifest())
            self.assertEqual({"judge.js", "discover.js", "retry.js"}, {p.name for p in closure})
            (root / "data" / "retry.js").unlink()
            with self.assertRaises(core.RepositoryError):
                core._specialized_script_closure(root, self.manifest())

    def test_unfinished_scaffold_is_not_packagable_but_generated_example_is(self):
        for complete in (False, True):
            with self.subTest(complete=complete), tempfile.TemporaryDirectory(prefix="nxp-author-") as temporary:
                root = Path(temporary)
                files = author.generate("ExampleTask", "example-task", complete)
                for name, content in files.items():
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(content, encoding="utf-8")
                manifest = json.loads(files["plugin.json"])
                if complete:
                    self.assertEqual(3, len(core._specialized_script_closure(root, manifest)))
                else:
                    with self.assertRaises(core.RepositoryError):
                        core._specialized_script_closure(root, manifest)

    def test_author_names_cannot_escape_output(self):
        for artifact, name in [("../Escape", "test"), ("Example", "../escape"), ("Example", "MixedCase")]:
            with self.assertRaises(ValueError):
                author.generate(artifact, name)
