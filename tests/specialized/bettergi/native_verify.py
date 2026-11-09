"""Run source-derived BetterGI cases through the exact production bounded Host interpreter."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from verify import verify_component


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host-root', type=Path, required=True)
    parser.add_argument('--jint-assembly', type=Path, required=True)
    parser.add_argument('--acornima-assembly', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.set_defaults(extension='bettergi')
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    output, host = args.output.resolve(), args.host_root.resolve()
    repo = source.parents[2]
    if output.is_relative_to(repo) or not args.output.is_absolute():
        raise ValueError('Explicit external output directory required')
    native = output / 'native'
    if any((output / name).exists() for name in ('adapter.js', 'cases.json', 'node-report.json', 'native')):
        raise ValueError('Use a fresh external report directory')
    native.mkdir(parents=True)
    args.host_root = host
    args.jint_assembly = args.jint_assembly.resolve()
    args.acornima_assembly = args.acornima_assembly.resolve()
    args.work_root = native
    receipt = verify_component(repo, args, output, native / 'report.json')
    receipt.update(checkedAt=datetime.now(timezone.utc).isoformat(),
                   componentSourceAndAssemblies=receipt.pop('inputs'), upstreamBinary=receipt.pop('upstreamExecution'))
    (native / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': receipt['status'], 'receipt': str(native / 'receipt.json')}))
    return receipt['exitCode']


if __name__ == '__main__':
    raise SystemExit(main())
