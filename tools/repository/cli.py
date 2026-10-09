from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from tools.sdk.source import SdkSourceError
from tools.release.provenance import CandidateSourceError
from tools.repository.catalog import audit
from tools.repository.io import configure_console, read_json, write_json
from tools.repository.model import RepositoryError
from tools.repository.plan import check_pr
from tools.repository.source import check_syntax, validate_host_locale_registry, validate_sources


class StrictParser(argparse.ArgumentParser):
    def __init__(self, *args, **kwargs):
        kwargs["allow_abbrev"] = False
        super().__init__(*args, **kwargs)

    def parse_args(self, args=None, namespace=None):
        values = list(sys.argv[1:] if args is None else args)
        seen = set()
        for value in values:
            if value.startswith("--"):
                option = value.split("=", 1)[0]
                if option in seen:
                    self.error(f"重复参数：{option}")
                seen.add(option)
        return super().parse_args(values, namespace)


def parser(default_root: Path) -> argparse.ArgumentParser:
    result = StrictParser(description="NexusPipeline Plugins repository tools")
    commands = result.add_subparsers(dest="command", required=True)
    def family(name):
        return commands.add_parser(name).add_subparsers(dest="operation", required=True)
    def leaf(parent, name, route, required=(), optional=()):
        item = parent.add_parser(name)
        item.set_defaults(route=route)
        item.add_argument("--root", type=Path, default=default_root)
        paths = {"host-root", "output", "generated-root", "artifact-zip", "github-output",
                 "source-root", "plan-phase", "package-phases", "producer", "producer-output", "report"}
        integers = {"candidate-run-id", "current-run-id", "artifact-id"}
        for option in (*required, *optional):
            item.add_argument("--" + option, required=option in required,
                              type=Path if option in paths else int if option in integers else str)
        return item
    check = family("check")
    leaf(check, "source", "check_source", optional=("base",))
    leaf(check, "syntax", "check_syntax")
    leaf(check, "docs", "check_docs")
    governance = leaf(check, "governance", "check_governance", required=("base",), optional=("host-root", "report"))
    governance.add_argument("--working-tree", action="store_true")
    governance.add_argument("--governance-only", action="store_true")
    governance.add_argument("--owner", nargs="+", default=[])
    preflight = leaf(commands, "preflight", "preflight", optional=("host-root", "report"))
    for name in ("path", "keyword", "owner"):
        preflight.add_argument("--" + name, nargs="+", default=[])
    leaf(check, "host", "check_host", required=("host-root", "sdk-sha"))
    leaf(commands, "package", "package", required=("artifact", "output", "report"),
         optional=("host-root", "plan-phase", "sdk-sha"))
    generation = family("generate")
    for kind in ("tasks", "editors", "schema"):
        item = leaf(generation, kind, "generate_" + kind)
        item.add_argument("--check", action="store_true")
    scaffold = family("scaffold")
    item = leaf(scaffold, "task-plugin", "scaffold", required=("artifact", "name", "output"))
    from tools.generate.task_plugin import PRESETS
    item.add_argument("--preset", choices=PRESETS, default="json-id-array")
    item.add_argument("--example", action="store_true")
    item.add_argument("--check", action="store_true")
    release = family("release")
    def channel(name, required=(), optional=(), channels=("stable", "preview")):
        item = leaf(release, name, name, required, optional)
        item.add_argument("--channel", choices=channels, required=True)
        return item
    channel("scope", optional=("github-output",), channels=("stable",))
    channel("plan", required=("host-root", "sdk-sha", "output"), optional=("github-output",))
    channel("assemble", required=("host-root", "sdk-sha", "plan-phase", "package-phases", "workflow-sha", "run-id", "run-attempt", "output"), optional=("producer-output", "github-output"))
    leaf(release, "candidate", "release_candidate", required=("host-root", "sdk-sha", "workflow-sha", "run-id", "run-attempt", "output"), optional=("github-output",))
    leaf(release, "audit", "release_audit", optional=("baseline",))
    channel("source", required=("candidate-run-id", "current-run-id", "github-output"), optional=("artifact-id",))
    channel("extract", required=("artifact-zip", "expected-digest", "output"))
    identity = ("generated-root", "workflow-sha", "run-id", "run-attempt")
    channel("inspect", required=identity, optional=("producer", "github-output"))
    channel("validate", required=(*identity, "source-sha"), optional=("producer",))
    publish = channel("publish", required=(*identity, "source-sha"), optional=("producer", "source-root"))
    publish.add_argument("--remote-write", action="store_true")
    publish.add_argument("--token-env", default="PLUGIN_PUBLISHER_TOKEN")
    return result


def main(argv: list[str] | None = None, *, default_root: Path) -> int:
    configure_console()
    argument_parser = parser(default_root)
    args = argument_parser.parse_args(argv)
    root = args.root.resolve()
    for name in ("output", "generated_root", "github_output", "producer", "producer_output",
                 "source_root", "reuse_candidate", "baseline", "base"):
        if not hasattr(args, name):
            setattr(args, name, None)
    if args.command == "release" and hasattr(args, "channel"):
        args.route = "release_scope" if args.operation == "scope" else args.operation + "_" + args.channel
    try:
        if args.route == "check_source":
            count, json_count = validate_sources(root)
            print(f'[repository] 源码契约校验通过：{count} 个插件，{json_count} 个 JSON 文件', flush=True)
            if args.base:
                check_pr(root, args.base)
        elif args.route == "check_syntax":
            print(f'[repository] 脚本语法校验通过：{check_syntax(root)} 个文件', flush=True)
        elif args.route == "release_audit":
            audit(root, baseline=args.baseline)
        elif args.route == "check_host":
            from tools.sdk.source import preflight
            preflight(root, args.host_root.resolve(), args.sdk_sha)
            if args.host_root is None:
                raise RepositoryError('validate-host-locales 必须指定 --host-root')
            count = validate_host_locale_registry(root, args.host_root.resolve())
            print(f'[repository] 宿主 locale registry 同步校验通过：{count} 个 locale', flush=True)
        elif args.route == "release_candidate":
            from tools.release.candidate import build_stable_candidate
            if args.host_root is None or not args.sdk_sha or (not args.workflow_sha) or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('candidate 必须指定 --host-root、--sdk-sha、--workflow-sha、--run-id、--run-attempt')
            if not args.run_id.isdecimal() or not args.run_attempt.isdecimal():
                raise RepositoryError('candidate run/attempt 必须为正整数')
            result = build_stable_candidate(root, args.host_root.resolve(), args.output.resolve() if args.output else root / '.generated' / 'stable-candidate', sdk_sha=args.sdk_sha, workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt), reuse_candidate=args.reuse_candidate)
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f"status={result['status']}\n")
                    stream.write(f"source_sha={result['sourceSha']}\n")
            print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        elif args.route == "release_scope":
            from tools.release.candidate import stable_candidate_scope
            result = stable_candidate_scope(root)
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f"status={result['status']}\n")
                    stream.write(f"needs_build={('true' if result['needsBuild'] else 'false')}\n")
                    stream.write(f"source_sha={result['sourceSha']}\n")
            print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        elif args.route == "plan_stable":
            from tools.release.candidate import plan_stable_candidate
            if args.host_root is None or args.output is None or (not args.sdk_sha):
                raise RepositoryError('candidate-plan 必须指定固定 Host SHA、检出和输出')
            result = plan_stable_candidate(root, args.host_root, args.output, sdk_sha=args.sdk_sha)
            plan = result['plan']
            needs_build = bool(plan['requiresPackage'] or plan['deleted'])
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f"source_sha={result['sourceSha']}\n")
                    stream.write(f"partner_sha={result['partnerSha']}\n")
                    stream.write(f"needs_build={('true' if needs_build else 'false')}\n")
                    stream.write(f"package_count={len(plan['requiresPackage'])}\n")
                    stream.write('managed=' + json.dumps(plan['managed'], separators=(',', ':')) + '\n')
                    stream.write('matrix=' + json.dumps({'include': [{'artifact': artifact} for artifact in plan['requiresPackage']]}, separators=(',', ':')) + '\n')
            print(json.dumps({'status': 'BUILD_REQUIRED' if needs_build else 'NO_CHANGES', 'sourceSha': result['sourceSha'], 'requiresPackage': plan['requiresPackage']}, ensure_ascii=False), flush=True)
        elif args.route == "assemble_stable":
            from tools.release.candidate import assemble_stable_candidate
            if args.host_root is None or args.output is None or args.plan_phase is None or (args.package_phases is None) or (not args.sdk_sha) or (not args.workflow_sha) or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('candidate-assemble 缺少固定计划、包阶段或 producer 身份')
            result = assemble_stable_candidate(root, args.host_root, args.plan_phase, args.package_phases, args.output, sdk_sha=args.sdk_sha, workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt))
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f"status={result['status']}\n")
                    stream.write(f"source_sha={result['sourceSha']}\n")
            print(json.dumps(result, ensure_ascii=False), flush=True)
        elif args.route == "plan_preview":
            from tools.release.candidate import plan_preview_candidate
            if args.host_root is None or args.output is None or (not args.sdk_sha):
                raise RepositoryError('preview-plan 必须指定固定 Host SHA、检出和输出')
            result = plan_preview_candidate(root, args.host_root, args.output, sdk_sha=args.sdk_sha)
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f"source_sha={result['sourceSha']}\n")
                    stream.write(f"partner_sha={result['partnerSha']}\n")
                    stream.write('matrix=' + json.dumps({'include': [{'artifact': artifact} for artifact in result['plan']['requiresPackage']]}, separators=(',', ':')) + '\n')
                    stream.write('managed=' + json.dumps(result['plan']['managed'], separators=(',', ':')) + '\n')
            print(json.dumps({'sourceSha': result['sourceSha'], 'packages': result['plan']['requiresPackage']}, ensure_ascii=False), flush=True)
        elif args.route == "assemble_preview":
            from tools.release.candidate import assemble_preview_candidate
            if args.host_root is None or args.output is None or args.plan_phase is None or (args.package_phases is None) or (args.producer_output is None) or (not args.sdk_sha) or (not args.workflow_sha) or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('preview-assemble 缺少固定计划、包阶段或 producer 身份')
            result = assemble_preview_candidate(root, args.host_root, args.plan_phase, args.package_phases, args.output, args.producer_output, sdk_sha=args.sdk_sha, workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt))
            print(json.dumps(result, ensure_ascii=False), flush=True)
        elif args.route == "extract_stable":
            from tools.release.inventory import extract_candidate_artifact
            if args.artifact_zip is None or args.output is None or (not args.expected_digest):
                raise RepositoryError('extract-candidate 必须指定 --artifact-zip、--output、--expected-digest')
            extract_candidate_artifact(args.artifact_zip.resolve(), args.output.resolve(), expected_digest=args.expected_digest)
        elif args.route == "inspect_stable":
            from tools.release.candidate import inspect_candidate_identity
            generated = args.generated_root or args.output
            if generated is None or not args.workflow_sha or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('inspect-candidate 缺少候选目录或原 producer 身份')
            if not args.run_id.isdecimal() or not args.run_attempt.isdecimal():
                raise RepositoryError('candidate run/attempt 必须为正整数')
            identity = inspect_candidate_identity(generated.resolve(), workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt))
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f"source_sha={identity['sourceSha']}\npartner_sha={identity['partnerSha']}\n")
            print(json.dumps(identity, ensure_ascii=False), flush=True)
        elif args.route == "extract_preview":
            from tools.release.inventory import extract_preview_artifact
            if args.artifact_zip is None or args.output is None or (not args.expected_digest):
                raise RepositoryError('extract-preview 必须指定 --artifact-zip、--output、--expected-digest')
            extract_preview_artifact(args.artifact_zip.resolve(), args.output.resolve(), expected_digest=args.expected_digest)
        elif args.route == "inspect_preview":
            from tools.release.candidate import inspect_preview_candidate
            generated = args.generated_root or args.output
            if generated is None or args.producer is None or (not args.workflow_sha) or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('inspect-preview 缺少候选目录或原 producer 身份')
            if not args.run_id.isdecimal() or not args.run_attempt.isdecimal():
                raise RepositoryError('preview run/attempt 必须为正整数')
            source_sha = inspect_preview_candidate(generated.resolve(), args.producer.resolve(), workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt))
            if args.github_output:
                with args.github_output.open('a', encoding='utf-8') as stream:
                    stream.write(f'source_sha={source_sha}\n')
            print(json.dumps({'sourceSha': source_sha}, ensure_ascii=False), flush=True)
        elif args.route == "validate_stable":
            from tools.release.candidate import validate_original_candidate
            generated = args.generated_root or args.output
            if generated is None or not args.source_sha or (not args.workflow_sha) or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('validate-candidate 缺少目录或原 producer 身份')
            if not args.run_id.isdecimal() or not args.run_attempt.isdecimal():
                raise RepositoryError('candidate run/attempt 必须为正整数')
            result = validate_original_candidate(root, generated.resolve(), source_sha=args.source_sha, workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt))
            print(json.dumps({'sourceSha': result['sourceSha'], 'distribution': result['distribution'], 'files': len(result['files'])}, ensure_ascii=False), flush=True)
        elif args.route == "publish_stable":
            from tools.release.candidate import validate_original_candidate
            from tools.release.git_transport import GitHubGitTransport
            generated = args.generated_root or args.output
            if generated is None or not args.source_sha or (not args.workflow_sha) or (not args.run_id) or (not args.run_attempt):
                raise RepositoryError('publish-candidate 缺少目录或原 producer 身份')
            if not args.run_id.isdecimal() or not args.run_attempt.isdecimal():
                raise RepositoryError('candidate run/attempt 必须为正整数')
            manifest = validate_original_candidate(root, generated.resolve(), source_sha=args.source_sha, workflow_sha=args.workflow_sha, run_id=int(args.run_id), run_attempt=int(args.run_attempt))
            if not args.remote_write:
                print(json.dumps({"status": "VALIDATED", "sourceSha": args.source_sha, "distribution": manifest["distribution"], "files": manifest["files"]}, ensure_ascii=False))
                return 0
            if not os.environ.get(args.token_env):
                raise RepositoryError("受保护 writer 缺少 Publisher App token")
            result = GitHubGitTransport().publish_stable_candidate(root, generated.resolve(), args.source_sha, manifest['distribution']['headSha'], remote_write=True, token=os.environ[args.token_env], run_id=int(args.run_id), run_attempt=int(args.run_attempt), workflow_sha=args.workflow_sha)
            print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        elif args.route == "publish_preview":
            from tools.release.preview import publish_preview
            if args.generated_root is None or not args.source_sha or (not args.run_id) or (not args.run_attempt) or (not args.workflow_sha):
                raise RepositoryError('publish-preview 必须指定 --generated-root、--source-sha、--run-id、--run-attempt、--workflow-sha')
            publish_preview(args.generated_root.resolve(), source_sha=args.source_sha, run_id=args.run_id, run_attempt=args.run_attempt, workflow_sha=args.workflow_sha, producer_path=args.producer.resolve() if args.producer else None, remote_write=args.remote_write, token=os.environ.get(args.token_env), source_root=args.source_root.resolve() if args.source_root else None)
        elif args.route in {"source_stable", "source_preview"}:
            from tools.release.provenance import resolve_candidate, github_fetch, require
            token = os.environ.get("GITHUB_TOKEN", "")
            require(bool(token), "缺少 Actions read token")
            result = resolve_candidate(lambda path: github_fetch(token, path), channel=args.channel,
                                       candidate_run_id=args.candidate_run_id,
                                       current_run_id=args.current_run_id, artifact_id=args.artifact_id)
            keys = {"sourceSha": "source_sha", "workflowSha": "workflow_sha", "runId": "run_id",
                    "runAttempt": "run_attempt", "artifactId": "artifact_id", "artifactDigest": "artifact_digest"}
            with args.github_output.open("a", encoding="utf-8") as stream:
                for key, output in keys.items():
                    stream.write(f"{output}={result[key]}\n")
            print(json.dumps(result, sort_keys=True))
        elif args.route == "validate_preview":
            from tools.release.candidate import inspect_preview_candidate, validate_preview_manifest
            if args.producer is None:
                raise RepositoryError("preview validate 必须指定 --producer")
            inspect_preview_candidate(args.generated_root, args.producer,
                                      workflow_sha=args.workflow_sha, run_id=int(args.run_id),
                                      run_attempt=int(args.run_attempt))
            validate_preview_manifest(root, args.generated_root, source_sha=args.source_sha,
                                      workflow_sha=args.workflow_sha, run_id=int(args.run_id),
                                      run_attempt=int(args.run_attempt))
        elif args.route == "package":
            from tools.repository.package import package_one
            package_one(root, artifact=args.artifact, output=args.output, report=args.report,
                        host_root=args.host_root, plan_phase=args.plan_phase, sdk_sha=args.sdk_sha)
        elif args.route.startswith("generate_"):
            from tools.generate import task_protocol, config_editors, task_schema
            generators = {"tasks": task_protocol.generate, "editors": config_editors.generate,
                          "schema": task_schema.generate}
            generators[args.operation](root, check=args.check)
        elif args.route == "scaffold":
            from tools.generate.task_plugin import generate
            files = generate(root, args.artifact, args.name, args.example, args.preset)
            if args.check:
                failures = [name for name, text in files.items()
                            if not (args.output / name).is_file()
                            or (args.output / name).read_text(encoding="utf-8") != text]
                if failures:
                    raise RepositoryError("Generated example differs: " + ", ".join(failures))
            else:
                if args.output.exists() or args.output.is_symlink():
                    raise RepositoryError("Output already exists; refusing to overwrite author changes")
                args.output.mkdir(parents=True)
                for name, text in files.items():
                    target = args.output / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(text, encoding="utf-8", newline="\n")
            print("Checked task plugin" if args.check else "Created task plugin")
        elif args.route in ("check_governance", "preflight"):
            from tools.repository.governance import run
            run(root, args)
        elif args.route == "check_docs":
            from tools.repository.io import _run
            from tools.docs.validate import validate_commands
            print(f"[repository] Public command index: {validate_commands(root, argument_parser)}", flush=True)
            _run(("node", str(Path(__file__).resolve().parents[1] / "docs/check-links.mjs"), "--root", str(root)), "Documentation links", root)
        else:
            raise RepositoryError("未知工具操作")
        return 0
    except (RepositoryError, SdkSourceError, CandidateSourceError, ValueError) as exc:
        print(f"[repository] 错误：{exc}", file=sys.stderr, flush=True)
        return 1
