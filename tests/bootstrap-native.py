"""Prepare fixed native test input outside the timed test invocation."""
import argparse
import hashlib
import json
from pathlib import Path
import stat
import urllib.request
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--archive", type=Path)
args = parser.parse_args()
root = args.output.resolve()
if root.exists():
    raise SystemExit("Use a new bootstrap output directory")
lock = json.loads(Path(__file__).with_name("inputs.lock.json").read_text())['maaFramework']
root.mkdir(parents=True)
archive = args.archive.resolve() if args.archive else root / "native.zip"
if args.archive is None:
    with urllib.request.urlopen(lock['url'], timeout=120) as response, archive.open('xb') as target:
        while block := response.read(1024 * 1024):
            target.write(block)
if archive.stat().st_size != lock['sizeBytes'] or hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != lock['sha256']:
    raise SystemExit('Native archive identity mismatch')
with zipfile.ZipFile(archive) as package:
    for entry in package.infolist():
        location = (root / entry.filename).resolve()
        if not location.is_relative_to(root) or stat.S_ISLNK(entry.external_attr >> 16):
            raise SystemExit('Unsafe archive entry')
    package.extractall(root)
files = {file.relative_to(root).as_posix(): hashlib.file_digest(file.open('rb'), 'sha256').hexdigest()
         for file in sorted((root / 'bin').rglob('*')) if file.is_file()}
if not all(f'bin/{name}.dll' in files for name in ['MaaFramework', 'MaaToolkit', 'MaaAgentClient']):
    raise SystemExit('Native modules missing')
(root / 'native-input.json').write_text(json.dumps({'source': lock, 'files': files}, indent=2), encoding='utf-8')
print(root)
