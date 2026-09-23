from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verification  # noqa: E402


class ManagedSelectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path("C:/verify-root")
        self.plugins = [
            SimpleNamespace(root=self.root / "plugins/general/Managed", artifact_name="Managed", kind="managed-code"),
            SimpleNamespace(root=self.root / "plugins/specialized/Data", artifact_name="Data", kind="data-specialized"),
        ]

    def selection(self, records):
        with patch.object(verification.core, "git_commit", return_value="a" * 40), \
             patch.object(verification.core, "git_head", return_value="b" * 40), \
             patch.object(verification.core, "changed_paths", return_value=records), \
             patch.object(verification.core, "discover_source_plugins", return_value=self.plugins):
            return verification.managed_selection(self.root, "main")

    def test_data_plugin_does_not_select_managed_build(self):
        selected, reason = self.selection([("M", ["plugins/specialized/Data/data/judge.js"])])
        self.assertEqual((selected, reason), ([], "no-managed-impact"))

    def test_rename_checks_both_paths_and_shared_input_expands(self):
        self.assertEqual(self.selection([("R100", ["plugins/specialized/Data/a.js", "plugins/general/Managed/src/a.cs"])])[0], ["Managed"])
        self.assertEqual(self.selection([("M", ["host.lock.json"])])[0], ["Managed"])
        self.assertEqual(self.selection([("D", ["plugins/general/Removed/src/a.cs"])])[0], ["Managed"])

    def test_not_applicable_does_not_start_build_or_host_integration(self):
        with patch.object(verification.core, "_run") as run, patch.object(verification.core, "test_managed") as managed:
            result = verification.run_managed_gate(self.root, self.root, selected=[], host_integration=False)
        self.assertEqual(result["applicability"], "not-applicable")
        run.assert_not_called()
        managed.assert_not_called()

    def test_managed_without_frontend_runs_only_selected_dotnet_projects(self):
        plugin = SimpleNamespace(root=self.root / "plugins/general/EmulatorSupport", artifact_name="EmulatorSupport", kind="managed-code")
        with patch.object(verification.core, "discover_source_plugins", return_value=[plugin]), \
             patch.object(verification.core, "_run") as run, \
             patch.object(verification.core, "test_managed", return_value=2) as managed:
            result = verification.run_managed_gate(self.root, self.root, selected=["EmulatorSupport"], host_integration=False)
        self.assertEqual(result["managedProjectsAndTests"], 2)
        run.assert_not_called()
        self.assertEqual(managed.call_args.kwargs["include_frontend"], False)

    def test_empty_diff_is_not_success(self):
        with self.assertRaisesRegex(verification.core.RepositoryError, "变更范围为空"):
            self.selection([])

    def test_git_diff_parser_preserves_both_rename_paths_and_whitespace(self):
        raw = "R100\0plugins/general/Old/a file.cs\0plugins/general/Managed/a file.cs\0M\0docs/new\nline.md\0"
        with patch.object(verification.core, "_git", return_value=raw):
            records = verification.core.changed_paths(self.root, "a" * 40, "b" * 40)
        self.assertEqual(records, [
            ("R100", ["plugins/general/Old/a file.cs", "plugins/general/Managed/a file.cs"]),
            ("M", ["docs/new\nline.md"]),
        ])

    def test_docs_scope_is_explicit_and_unknown_paths_expand(self):
        with patch.object(verification.core, "git_commit", return_value="a" * 40), \
             patch.object(verification.core, "git_head", return_value="b" * 40), \
             patch.object(verification.core, "changed_paths", return_value=[("M", ["docs/README.md"])]):
            self.assertTrue(verification.fast_scope(self.root, "main")["docsOnly"])
        with patch.object(verification.core, "git_commit", return_value="a" * 40), \
             patch.object(verification.core, "git_head", return_value="b" * 40), \
             patch.object(verification.core, "changed_paths", return_value=[("M", ["docs/README.md"]), ("M", ["tools/verification.py"])]):
            self.assertFalse(verification.fast_scope(self.root, "main")["docsOnly"])

    def test_docs_gate_checks_current_map_and_local_links(self):
        repository = Path(__file__).resolve().parents[2]
        with patch.object(verification, "fast_scope", return_value={"docsOnly": True, "changedPaths": 1}):
            result = verification.run_docs_gate(repository, "main")
        self.assertGreater(result["mappedTopics"], 0)
        self.assertGreater(result["localLinks"], 0)


if __name__ == "__main__":
    unittest.main()
