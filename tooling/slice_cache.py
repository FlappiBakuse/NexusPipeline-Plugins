"""Reuse an exact managed compiler result while retaining the original receipt identity."""
import json
from pathlib import Path

from source_snapshot import sha, encode, immutable


def artifact_records(output, projects):
    records = []
    for project in projects:
        directory = output / 'build/bin' / project / 'release'
        if not directory.is_dir() or directory.is_symlink() or directory.is_junction():
            raise ValueError('Managed compiler output is missing: ' + project)
        for path in sorted(directory.rglob('*')):
            if path.is_symlink() or path.is_junction() or output.resolve() not in path.resolve().parents:
                raise ValueError('Managed compiler output contains a link')
            if path.is_file():
                data = path.read_bytes()
                records.append({'path': path.relative_to(output).as_posix(), 'sizeBytes': len(data), 'sha256': sha(data)})
    if not records:
        raise ValueError('Managed compiler produced no files')
    return records


def reusable_build(output, extension, component):
    pointer = output / 'managed-latest' / (extension + '.json')
    if not pointer.is_file() or component.get('conservativeReasons'):
        return None
    reference = json.loads(pointer.read_bytes())
    original = Path(reference['path']).resolve(strict=True)
    if output.resolve() not in original.parents or original.is_symlink() or sha(original.read_bytes()) != reference['sha256']:
        raise ValueError('Original managed compiler receipt changed')
    receipt = json.loads(original.read_bytes())
    if receipt.get('status') != 'PASS' or receipt.get('componentInputs') != component:
        return None
    if artifact_records(output, component['projects']) != receipt['artifacts']:
        raise ValueError('Managed compiler artifacts changed')
    return receipt, reference


def save_result(output, extension, path, receipt):
    immutable(path, encode(receipt))
    if receipt['status'] == 'PASS':
        latest = output / 'managed-latest' / (extension + '.json')
        latest.parent.mkdir(parents=True, exist_ok=True)
        latest.write_bytes(encode({'path': str(path), 'sha256': sha(path.read_bytes())}))
