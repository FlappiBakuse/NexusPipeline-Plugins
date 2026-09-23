"""读取 Plugins 的 Host/Frontend 兼容元数据。

源码 SDK 的具体 commit 不放在 host.lock.json；验证和候选任务各自固定一次
官方 checkout SHA，并通过 output/参数传递给所有 Gate。
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path


VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+$")
EXPECTED_KEYS = {"hostApiVersion", "frontendApiVersion", "supportedLocales"}


def read_lock(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or set(value) != EXPECTED_KEYS:
        raise ValueError("host.lock.json 必须只包含兼容元数据键")
    for key in ("hostApiVersion", "frontendApiVersion"):
        if not isinstance(value[key], str) or VERSION_PATTERN.fullmatch(value[key]) is None:
            raise ValueError(f"{key} 必须是 major.minor")
    locales = value["supportedLocales"]
    if (
        not isinstance(locales, list)
        or not locales
        or any(not isinstance(locale, str) or not locale.strip() or locale.strip() != locale for locale in locales)
        or len(set(locales)) != len(locales)
    ):
        raise ValueError("supportedLocales 无效")
    return value


def main() -> int:
    lock = read_lock(Path(__file__).resolve().parents[1] / "host.lock.json")
    values = {
        "hostApiVersion": lock["hostApiVersion"],
        "frontendApiVersion": lock["frontendApiVersion"],
        "supportedLocales": ",".join(lock["supportedLocales"]),
    }
    output = "".join(f"{key}={value}\n" for key, value in values.items())
    print(output, end="")
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as stream:
            stream.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
