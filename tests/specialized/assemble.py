"""Use the production assembler for source-derived component vectors."""
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
root, extension, output = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
if not root.is_absolute() or not output.is_absolute() or output.resolve().is_relative_to(root.resolve()):
    raise ValueError('Explicit disjoint repository and output required')
sys.path.insert(0, str(root / 'tooling'))
from generate_adapter import assemble_adapter

family = 'managed' if extension == 'maa-framework' else 'specialized'
script, records = assemble_adapter(root / 'plugins' / family / extension)
output.mkdir(parents=True, exist_ok=True)
(output / 'adapter.js').write_bytes(script)
print(json.dumps({'records': records}))
