from pathlib import Path
import contextlib
import io
import json
import tempfile
import unittest
from tools.repository.cli import main, parser
from tools.repository.model import RepositoryError
from tools.release.candidate import _prepare_output

ROOT = Path(__file__).resolve().parents[2]


class RepositoryCliTests(unittest.TestCase):
    def test_unknown_duplicate_and_retired_commands_are_rejected(self):
        cases = [
            ['validate-source'], ['publish-develop'], ['test-managed'], ['verify'],
            ['check', 'source', '--unknown'], ['check', 'source', '--ro', '.'],
            ['check', 'source', '--root', '.', '--root=elsewhere'],
            ['release', 'plan', '--channel', 'stable'],
            ['release', 'audit', '--full'],
        ]
        for arguments in cases:
            with self.subTest(arguments=arguments), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    parser(ROOT).parse_args(arguments)
                self.assertEqual(2, error.exception.code)

    def test_root_is_explicit_or_entry_default(self):
        self.assertEqual(ROOT, parser(ROOT).parse_args(['check', 'source']).root)
        self.assertEqual(Path('different'), parser(ROOT).parse_args(
            ['check', 'source', '--root', 'different']).root)

    def test_scaffold_and_check_preserve_existing_author_bytes(self):
        with tempfile.TemporaryDirectory(prefix='nxp-cli-author-') as directory:
            output = Path(directory) / 'Example'
            arguments = ['scaffold', 'task-plugin', '--artifact', 'ExampleTask',
                         '--name', 'example-task', '--example', '--output', str(output)]
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, main(arguments, default_root=ROOT))
                self.assertEqual(0, main([*arguments, '--check'], default_root=ROOT))
            manifest = output / 'plugin.json'
            manifest.write_bytes(b'author-owned')
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(1, main(arguments, default_root=ROOT))
                self.assertEqual(1, main([*arguments, '--check'], default_root=ROOT))
            self.assertEqual(b'author-owned', manifest.read_bytes())

    def test_candidate_output_never_overwrites_existing_bytes(self):
        with tempfile.TemporaryDirectory(prefix='nxp-cli-output-') as directory:
            output = Path(directory)
            original = output / 'original'
            original.write_bytes(b'owned-by-user')
            with self.assertRaises(RepositoryError):
                _prepare_output(ROOT, output)
            self.assertEqual(b'owned-by-user', original.read_bytes())


if __name__ == '__main__':
    unittest.main()
