from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verification


class VerificationTests(unittest.TestCase):
    def test_native_skip_and_empty_suite_fail_closed(self):
        class Skipped(unittest.TestCase):
            @unittest.skip("controlled runner failure")
            def test_case(self):
                pass

        suites = [unittest.TestSuite(), unittest.defaultTestLoader.loadTestsFromTestCase(Skipped)]
        for suite in suites:
            with self.subTest(suite=suite), patch.object(
                verification.unittest.defaultTestLoader, "discover", return_value=suite
            ), patch.object(verification.sys, "stdout", io.StringIO()):
                with self.assertRaises(verification.core.RepositoryError):
                    verification.run_python_unit_gate(Path("unused"))

    def test_shared_inputs_and_removed_plugin_expand_managed_selection(self):
        root = Path(__file__).resolve().parents[2]
        plugins = [SimpleNamespace(root=root / "plugins/general" / name,
                                   artifact_name=name, kind="managed-code")
                   for name in ["GameCheckIn", "EmulatorSupport"]]
        cases = [
            ([('M', ['tools/PluginTestKit/FakePluginHostContext.cs'])], ['EmulatorSupport', 'GameCheckIn']),
            ([('M', ['README.md'])], []),
            ([('M', ['plugins/general/GameCheckIn/tests/GameCheckInTests.cs'])], ['GameCheckIn']),
            ([('R100', ['plugins/general/Old/plugin.json', 'plugins/general/GameCheckIn/plugin.json'])],
             ['EmulatorSupport', 'GameCheckIn']),
        ]
        for records, expected in cases:
            with self.subTest(records=records), patch.object(verification.core, "changed_paths", return_value=records), \
                    patch.object(verification.core, "git_commit", return_value="a" * 40), \
                    patch.object(verification.core, "git_head", return_value="b" * 40), \
                    patch.object(verification.core, "discover_source_plugins", return_value=plugins):
                selected, _ = verification.managed_selection(root, "a" * 40)
                self.assertEqual(expected, selected)
