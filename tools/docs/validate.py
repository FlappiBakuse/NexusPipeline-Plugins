from __future__ import annotations

import argparse
import json
from pathlib import Path
from tools.repository.model import RepositoryError


def validate_commands(root: Path, parser: argparse.ArgumentParser) -> int:
    registered = {}

    def visit(current: argparse.ArgumentParser, prefix: tuple[str, ...]) -> None:
        subcommands = next((action for action in current._actions
                            if isinstance(action, argparse._SubParsersAction)), None)
        if subcommands is not None:
            for name, child in subcommands.choices.items():
                visit(child, (*prefix, name))
        else:
            registered[' '.join(prefix)] = sorted(action.option_strings[0]
                for action in current._actions if action.required and action.option_strings)

    visit(parser, ())
    document = json.loads((root / 'tools/docs/commands.json').read_text(encoding='utf-8'))
    if document.get('schemaVersion') != 1 or document.get('commands') != registered:
        raise RepositoryError('Public command index differs from the current parser')
    return len(registered)
