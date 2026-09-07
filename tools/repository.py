from __future__ import annotations

import argparse
import sys
from pathlib import Path

from repository_core import (
    RepositoryError,
    STATE_FILE,
    apply_generated,
    audit,
    bootstrap_state,
    build_plan,
    check_pr,
    check_syntax,
    configure_console,
    read_json,
    release,
    test_managed,
    validate_generated,
    validate_sources,
    validate_source_and_catalog,
    write_json,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NexusPipeline-Plugins 增量发行工具")
    parser.add_argument(
        "command",
        choices=(
            "plan",
            "validate",
            "validate-source",
            "check-syntax",
            "test",
            "test-managed",
            "release",
            "audit",
            "check-pr",
            "validate-generated",
            "apply",
            "bootstrap-state",
        ),
    )
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--baseline", default="auto", help="发行基线；默认读取 .release-state.json")
    parser.add_argument("--base", help="check-pr 的 PR 基线")
    parser.add_argument("--head", help="plan 的目标提交，默认 HEAD")
    parser.add_argument("--plan", type=Path, help="release/test 使用的唯一 release-plan.json")
    parser.add_argument("--output", type=Path, help="plan/release/bootstrap-state 输出路径")
    parser.add_argument("--generated-root", type=Path, help="生成候选物目录")
    parser.add_argument("--full", action="store_true", help="test 命令测试所有 managed-code 插件")
    return parser


def _load_plan(path: Path) -> dict:
    value = read_json(path.resolve())
    if not isinstance(value, dict):
        raise RepositoryError(f"release plan 必须是对象：{path}")
    return value


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = _parser().parse_args(argv)
    root = args.root.resolve()
    try:
        if args.command == "validate":
            count, json_count = validate_source_and_catalog(root)
            print(f"[repository] 源码与 catalog 校验通过：{count} 个插件，{json_count} 个 JSON 文件", flush=True)
        elif args.command == "validate-source":
            count, json_count = validate_sources(root)
            print(f"[repository] 源码契约校验通过：{count} 个插件，{json_count} 个 JSON 文件", flush=True)
        elif args.command == "check-syntax":
            print(f"[repository] 脚本语法校验通过：{check_syntax(root)} 个文件", flush=True)
        elif args.command == "plan":
            plan = build_plan(root, args.baseline, args.head)
            output = args.output.resolve() if args.output else root / ".generated" / "release-plan.json"
            write_json(output, plan)
            print(
                f"[repository] {plan['mode']} release plan："
                f"{len(plan['requiresPackage'])} 个插件待打包，"
                f"{len(plan['deleted'])} 个插件待删除，"
                f"{len(plan['globalChanges'])} 个全局变更",
                flush=True,
            )
        elif args.command in {"test", "test-managed"}:
            plan = _load_plan(args.plan) if args.plan else None
            print(f"[repository] managed-code 测试完成：{test_managed(root, plan, args.full)} 个项目", flush=True)
        elif args.command == "release":
            plan_path = args.plan.resolve() if args.plan else root / ".generated" / "release-plan.json"
            if not plan_path.is_file():
                plan = build_plan(root, args.baseline, args.head)
                write_json(plan_path, plan)
            output = args.output.resolve() if args.output else root / ".generated"
            release(root, plan_path, output)
        elif args.command == "audit":
            audit(root)
        elif args.command == "check-pr":
            base = args.base or args.baseline
            if not base or base == "auto":
                raise RepositoryError("check-pr 必须指定 --base")
            check_pr(root, base)
        elif args.command == "validate-generated":
            generated = args.generated_root or args.output
            if generated is None:
                raise RepositoryError("validate-generated 必须指定 --generated-root")
            validate_generated(root, generated.resolve())
            print(f"[repository] 生成候选物校验通过：{generated}", flush=True)
        elif args.command == "apply":
            generated = args.generated_root or args.output
            if generated is None:
                raise RepositoryError("apply 必须指定 --generated-root")
            apply_generated(root, generated.resolve())
        elif args.command == "bootstrap-state":
            output = args.output.resolve() if args.output else root / STATE_FILE
            write_json(output, bootstrap_state(root, args.head))
            print(f"[repository] 已生成发行状态：{output}", flush=True)
        return 0
    except RepositoryError as exc:
        print(f"[repository] 错误：{exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
