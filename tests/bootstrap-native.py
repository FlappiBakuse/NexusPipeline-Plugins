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
parser.add_argument("--version")
args = parser.parse_args()
root = args.output.resolve()
inputs = json.loads(Path(__file__).with_name("inputs.lock.json").read_text())
versions = [inputs['maaFramework'], *inputs.get('maaFrameworkPrevious', [])]
lock = next((item for item in versions if item['version'] == (args.version or inputs['maaFramework']['version'])), None)
if lock is None:
    raise SystemExit('Version outside the locked compatibility window')
if root.is_symlink():
    raise SystemExit('Bootstrap root must be a regular directory')
root.mkdir(parents=True, exist_ok=True)
archive = args.archive.resolve() if args.archive else root / "native.zip"
if args.archive is None and not archive.exists():
    with urllib.request.urlopen(lock['url'], timeout=120) as response, archive.open('xb') as target:
        while block := response.read(1024 * 1024):
            target.write(block)
if archive.stat().st_size != lock['sizeBytes'] or hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != lock['sha256']:
    raise SystemExit('Native archive identity mismatch')
with zipfile.ZipFile(archive) as package:
    entries = set()
    for entry in package.infolist():
        location = (root / entry.filename).resolve()
        if (not location.is_relative_to(root) or stat.S_ISLNK(entry.external_attr >> 16)
                or entry.filename in entries or '\\' in entry.filename):
            raise SystemExit('Unsafe archive entry')
        entries.add(entry.filename)
    for entry in package.infolist():
        if not entry.filename.startswith('bin/') or entry.is_dir():
            continue
        location = root / entry.filename
        if location.exists():
            if location.is_symlink() or location.read_bytes() != package.read(entry):
                raise SystemExit('Existing native bytes differ from the locked archive')
        else:
            location.parent.mkdir(parents=True, exist_ok=True)
            with location.open('xb') as target, package.open(entry) as source:
                while block := source.read(1024 * 1024):
                    target.write(block)
    actual_files = {item.relative_to(root).as_posix() for item in (root / 'bin').rglob('*') if item.is_file()}
    if actual_files != {entry.filename for entry in package.infolist() if entry.filename.startswith('bin/') and not entry.is_dir()}:
        raise SystemExit('Unknown files in prepared native directory')
files = {file.relative_to(root).as_posix(): hashlib.file_digest(file.open('rb'), 'sha256').hexdigest()
         for file in sorted((root / 'bin').rglob('*')) if file.is_file()}
if not all(f'bin/{name}.dll' in files for name in ['MaaFramework', 'MaaToolkit', 'MaaAgentClient']):
    raise SystemExit('Native modules missing')
(root / 'native-input.json').write_text(json.dumps({'source': lock, 'files': files}, indent=2), encoding='utf-8')
print(root)
