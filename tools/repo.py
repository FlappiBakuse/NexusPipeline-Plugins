from pathlib import Path
import sys

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

from tools.repository.cli import main

if __name__ == "__main__":
    raise SystemExit(main(default_root=REPOSITORY_ROOT))
