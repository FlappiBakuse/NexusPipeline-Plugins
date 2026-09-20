from __future__ import annotations

import argparse
import os
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
    validate_host_locale_registry,
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
            "validate-host-locales",
            "qualification",
            "publish-develop",
            "publish-preview",
            "publish-stable",
            "write-stable-producer",
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
    parser.add_argument("--host-root", type=Path, help="validate-host-locales/qualification 使用的当前宿主 checkout")
    parser.add_argument("--distribution-root", type=Path, help="候选资格使用的 stable catalog/state/packages 分发基线")
    parser.add_argument("--full", action="store_true", help="test 命令测试所有 managed-code 插件")
    parser.add_argument("--group", choices=("source", "frontend-managed", "candidate", "all"), default="all", help="qualification Gate 分组")
    parser.add_argument("--sdk-sha", help="qualification 使用的固定 Host checkout SHA")
    parser.add_argument("--source-ref", default="develop", help="publish-develop 的源码 ref")
    parser.add_argument("--source-sha", help="publish-stable 的已验证源码 SHA")
    parser.add_argument("--remote-write", action="store_true", help="请求受保护 publisher 远端写入（本地工具会拒绝）")
    parser.add_argument("--token-env", default="PLUGIN_PUBLISHER_TOKEN", help="受保护 publisher token 环境变量名")
    parser.add_argument("--run-id", help="publisher workflow run id，仅写入非敏感 metadata")
    parser.add_argument("--run-attempt", help="publisher workflow run attempt")
    parser.add_argument("--workflow-sha", help="publisher workflow trusted SHA")
    parser.add_argument("--producer-output", type=Path, help="preview producer sidecar 输出路径（必须位于候选目录之外）")
    parser.add_argument("--producer", type=Path, help="preview producer sidecar 输入路径")
    parser.add_argument("--base-sha", help="stable qualification historical base SHA")
    parser.add_argument("--qualification-app-id", help="Qualification App id")
    parser.add_argument("--qualification-check-id", help="Qualification App check id")
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
            plan = build_plan(root, args.baseline, args.head, distribution_root=args.distribution_root)
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
            print(f"[repository] managed-code 测试完成：{test_managed(root, plan, args.full, host_root=args.host_root)} 个项目", flush=True)
        elif args.command == "release":
            plan_path = args.plan.resolve() if args.plan else root / ".generated" / "release-plan.json"
            if not plan_path.is_file():
                plan = build_plan(root, args.baseline, args.head, distribution_root=args.distribution_root)
                write_json(plan_path, plan)
            output = args.output.resolve() if args.output else root / ".generated"
            release(root, plan_path, output, host_root=args.host_root, distribution_root=args.distribution_root)
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
            validate_generated(root, generated.resolve(), distribution_root=args.distribution_root)
            print(f"[repository] 生成候选物校验通过：{generated}", flush=True)
        elif args.command == "validate-host-locales":
            if args.host_root is None:
                raise RepositoryError("validate-host-locales 必须指定 --host-root")
            count = validate_host_locale_registry(root, args.host_root.resolve())
            print(f"[repository] 宿主 locale registry 同步校验通过：{count} 个 locale", flush=True)
        elif args.command == "qualification":
            from qualification import run_qualification

            run_qualification(
                root,
                args.group,
                base=args.base or "main",
                host_root=args.host_root.resolve() if args.host_root else None,
                sdk_sha=args.sdk_sha,
                output=args.output.resolve() if args.output else None,
                baseline=args.baseline,
            )
        elif args.command == "publish-develop":
            from repository_publish import publish_develop

            publish_develop(
                root,
                args.source_ref,
                args.output.resolve() if args.output else None,
                remote_write=args.remote_write,
                host_root=args.host_root.resolve() if args.host_root else None,
                token=os.environ.get(args.token_env),
                run_id=args.run_id,
                run_attempt=args.run_attempt,
                workflow_sha=args.workflow_sha,
                producer_output=args.producer_output.resolve() if args.producer_output else None,
            )
        elif args.command == "publish-preview":
            from repository_publish import publish_preview

            if args.generated_root is None or not args.source_sha or not args.run_id or not args.run_attempt or not args.workflow_sha:
                raise RepositoryError("publish-preview 必须指定 --generated-root、--source-sha、--run-id、--run-attempt、--workflow-sha")
            publish_preview(
                args.generated_root.resolve(),
                source_sha=args.source_sha,
                run_id=args.run_id,
                run_attempt=args.run_attempt,
                workflow_sha=args.workflow_sha,
                producer_path=args.producer.resolve() if args.producer else None,
                remote_write=args.remote_write,
                token=os.environ.get(args.token_env),
            )
        elif args.command == "publish-stable":
            from repository_publish import GitHubGitTransport, publish_stable

            if not args.source_sha:
                raise RepositoryError("publish-stable 必须指定 --source-sha")
            generated = args.generated_root or args.output
            if generated is None:
                raise RepositoryError("publish-stable 必须指定 --generated-root")
            publish_stable(
                root,
                args.source_sha,
                generated.resolve(),
                remote_write=args.remote_write,
                host_root=args.host_root.resolve() if args.host_root else None,
                distribution_root=args.distribution_root.resolve() if args.distribution_root else None,
                token=os.environ.get(args.token_env),
                git_transport=GitHubGitTransport() if args.remote_write else None,
                base_sha=args.base_sha,
                run_id=args.run_id,
                run_attempt=args.run_attempt,
                workflow_sha=args.workflow_sha,
                qualification_app_id=args.qualification_app_id,
                qualification_check_id=args.qualification_check_id,
            )
        elif args.command == "write-stable-producer":
            from repository_publish import write_stable_producer

            generated = args.generated_root or args.output
            if generated is None or not args.source_sha or not args.base_sha or not args.run_id or not args.run_attempt or not args.workflow_sha or not args.qualification_app_id or not args.qualification_check_id:
                raise RepositoryError("write-stable-producer 缺少候选、source/base/run/workflow/App/check 身份")
            write_stable_producer(
                generated.resolve(),
                source_sha=args.source_sha,
                base_sha=args.base_sha,
                run_id=args.run_id,
                run_attempt=args.run_attempt,
                workflow_sha=args.workflow_sha,
                qualification_app_id=args.qualification_app_id,
                qualification_check_id=args.qualification_check_id,
            )
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
