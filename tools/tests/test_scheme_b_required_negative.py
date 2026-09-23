import unittest


class SchemeBRequiredNegativeProbe(unittest.TestCase):
    def test_required_check_rejects_a_real_failure(self):
        self.fail("Scheme B migration probe: this failure must block Plugins / Required")
