import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tooling'))
from package_extension import archive
from package_inputs import inputs
from slice_cache import artifact_records, reusable_build, save_result
from slice_inputs import managed_inputs
from source_snapshot import snapshot, sha, encode


class SliceInputTests(unittest.TestCase):
    def setUp(self):
        self.scope = tempfile.TemporaryDirectory(prefix='slice-inputs-', dir=os.environ['NEXUS_TEST_ROOT'])
        self.root = Path(self.scope.name) / 'repository'
        self.output = Path(self.scope.name) / 'output'
        self.root.mkdir()
        subprocess.run(['git', 'init', '--initial-branch=develop', str(self.root)], check=True, capture_output=True)
        self.plugin = self.root / 'plugins/managed/live-screenshot'
        self.plugin.mkdir(parents=True)
        self.write('tooling/build_managed_slice.py', 'pass\n')
        self.write('plugins/managed/live-screenshot/Slice.csproj', '<Project Sdk="Microsoft.NET.Sdk" />')
        self.write('plugins/managed/live-screenshot/Owner.cs', 'class Owner {}')
        self.write('plugins/managed/live-screenshot/README.md', 'Original package documentation\n')
        self.package = {'sha256': 'a' * 64}
        self.manifest = {'format': 'nexus.extension.manifest', 'version': 1, 'extensionId': 'live-screenshot',
            'artifactName': 'Fixture', 'packageVersion': '0.5.0', 'kind': 'managed-code', 'minHostVersion': '0.18.0',
            'sdkVersion': '0.1.0', 'contractFingerprint': 'b' * 64,
            'managed': {'entryAssembly': 'Slice.dll', 'entryType': 'Owner'}}
        self.write('plugins/managed/live-screenshot/extension.json', json.dumps(self.manifest))

    def tearDown(self):
        self.scope.cleanup()

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8', newline='\n')

    def component(self):
        source = snapshot(self.root, self.output)
        frozen = Path(source['exportRoot'])
        return source, managed_inputs(frozen, frozen / self.plugin.relative_to(self.root), source,
            self.package, self.manifest, os.environ)

    def test_separates_package(self):
        _, before = self.component()
        self.write('plugins/managed/live-screenshot/README.md', 'New package documentation\n')
        self.write('plugins/managed/live-screenshot/frontend/src/main.ts', 'export {};')
        self.assertEqual(before, self.component()[1])
        self.write('plugins/managed/live-screenshot/Owner.cs', 'class Owner { int changed; }')
        self.assertNotEqual(before, self.component()[1])

    def test_tracks_deletion(self):
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True, capture_output=True)
        index = (self.root / '.git/index').read_bytes()
        before, _ = self.component()
        (self.plugin / 'Owner.cs').unlink()
        after, _ = self.component()
        self.assertNotEqual(before['sourceSnapshotHash'], after['sourceSnapshotHash'])
        self.assertFalse((Path(after['exportRoot']) / 'plugins/managed/live-screenshot/Owner.cs').exists())
        self.assertEqual(index, (self.root / '.git/index').read_bytes())

    def test_tracks_sdk(self):
        _, before = self.component()
        self.package['sha256'] = 'c' * 64
        self.assertNotEqual(before, self.component()[1])

    def test_refuses_import(self):
        self.write('plugins/managed/live-screenshot/Slice.csproj', '<Project><Import Project="unknown.props" /></Project>')
        _, component = self.component()
        self.assertTrue(component['conservativeReasons'])
        self.assertIsNone(reusable_build(self.output, 'live-screenshot', component))

    def save_build(self, name, source, component):
        run = self.output / 'runs' / name
        run.mkdir(parents=True)
        assembly = self.output / 'build/bin/Slice/release/Slice.dll'
        assembly.parent.mkdir(parents=True, exist_ok=True)
        if not assembly.exists():
            assembly.write_bytes(b'controlled-compiler-output')
        manifest = run / 'extension.manifest.json'
        manifest.write_bytes(encode(self.manifest))
        receipt = {'status': 'PASS', 'source': source, 'componentInputs': component,
            'artifacts': artifact_records(self.output, component['projects']),
            'assembly': {'path': str(assembly), 'sha256': sha(assembly.read_bytes())},
            'manifest': {'path': str(manifest), 'sha256': sha(manifest.read_bytes())},
            'sdkReceiptSha256': sha(self.sdk.read_bytes()) if hasattr(self, 'sdk') else None,
            'contractFingerprint': self.manifest['contractFingerprint']}
        path = run / 'build-receipt.json'
        save_result(self.output, 'live-screenshot', path, receipt)
        return path, receipt

    def test_checks_artifacts(self):
        source, component = self.component()
        path, _ = self.save_build('original', source, component)
        original = path.read_bytes()
        self.assertIsNotNone(reusable_build(self.output, 'live-screenshot', component))
        (self.output / 'build/bin/Slice/release/extra.dll').write_bytes(b'unowned-output')
        with self.assertRaises(ValueError):
            reusable_build(self.output, 'live-screenshot', component)
        self.assertEqual(original, path.read_bytes())

    def test_packages_document(self):
        contract = b'{"controlled":"public-contract"}\n'
        self.write('contracts/fingerprint.json', contract.decode())
        package = Path(self.scope.name) / 'sdk.nupkg'
        with zipfile.ZipFile(package, 'w') as target:
            target.writestr('contracts/fingerprint.json', contract)
        self.package = {'path': str(package), 'sha256': sha(package.read_bytes())}
        producer = {'sourceSnapshotHash': 'd' * 64}
        self.write('contracts/sdk-source-lock.json', json.dumps({'dotnetPackageSha256': self.package['sha256'],
            'sourceSnapshotHash': producer['sourceSnapshotHash'], 'exportedContracts': {'contracts/fingerprint.json': sha(contract)}}))
        self.sdk = Path(self.scope.name) / 'sdk-receipt.json'
        self.sdk.write_bytes(encode({'status': 'PASS', 'hostSource': producer, 'contractFingerprint': 'b' * 64,
            'packages': [self.package]}))
        source, component = self.component()
        first, _ = self.save_build('first', source, component)
        _, old_members, _ = inputs(self.root, first, self.sdk)
        original = first.read_bytes()
        self.write('plugins/managed/live-screenshot/README.md', 'Revised package documentation\n')
        current, unchanged = self.component()
        self.assertEqual(component, unchanged)
        self.assertIsNotNone(reusable_build(self.output, 'live-screenshot', unchanged))
        second, _ = self.save_build('second', current, unchanged)
        _, new_members, _ = inputs(self.root, second, self.sdk)
        self.assertNotEqual(archive(old_members), archive(new_members))
        self.assertEqual(old_members['Slice.dll'], new_members['Slice.dll'])
        self.assertEqual(b'Revised package documentation\n', new_members['README.md'])
        self.assertEqual(original, first.read_bytes())


if __name__ == '__main__':
    unittest.main()
