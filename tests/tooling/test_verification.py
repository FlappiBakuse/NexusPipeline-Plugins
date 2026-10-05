from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.tooling import unittest_runner as verification


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
                with self.assertRaises(verification.repository_model.RepositoryError):
                    verification.run_python_unit_gate(Path("unused"))
