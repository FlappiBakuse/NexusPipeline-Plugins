from __future__ import annotations

import os
import re
import shutil
import tempfile
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from dataclasses import replace

import tools.repository.io as repository_io
import tools.repository.model as repository_model
import tools.repository.source as repository_source

_frontend_dependencies_ready: set[tuple[Path, str]] = set()


def _npm_executable() -> str:
    """在 Windows 上显式调用 npm.cmd，避免 Python subprocess 找不到 npm shim。"""
    return "npm.cmd" if os.name == "nt" else "npm"


def _build_frontend(plugin: repository_model.SourcePlugin, root: Path) -> None:
    """构建插件 Vue 前端，把源码编译为 manifest 约定的 web/ 发行入口。"""
    frontend = plugin.root / "frontend"
    if not frontend.is_dir():
        return
    input_key = (root.resolve(), repository_io.sha256(root / "package-lock.json"))
    if input_key not in _frontend_dependencies_ready:
        repository_io._run((_npm_executable(), "ci", "--no-audit", "--no-fund"), "安装插件前端依赖", root)
        _frontend_dependencies_ready.add(input_key)
    repository_io._run((_npm_executable(), "run", "typecheck", "--prefix", str(frontend)), f"插件前端类型检查：{plugin.artifact_name}", root)
    repository_io._run((_npm_executable(), "run", "build", "--prefix", str(frontend)), f"插件前端构建：{plugin.artifact_name} v{plugin.version}", root)


def _package_files(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_STORED) as archive:
        for file in sorted(path for path in source.rglob("*") if path.is_file()):
            relative = file.relative_to(source).as_posix()
            info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 0
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o644 << 16
            data = file.read_bytes()
            if file.suffix.lower() in repository_model.TEXT_SUFFIXES:
                data = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
            archive.writestr(info, data)


def _find_host_root(root: Path, host_root: Path | None) -> Path:
    marker = Path("src") / "NexusPipeline.Plugin.Abstractions" / "NexusPipeline.Plugin.Abstractions.csproj"
    if host_root is None:
        raise repository_model.RepositoryError("构建 managed-code 插件必须显式指定 --host-root")
    candidate = host_root.resolve()
    if not (candidate / marker).is_file():
        raise repository_model.RepositoryError(f"--host-root 不是有效 NexusPipeline checkout：{repository_io._display(candidate)}")
    return candidate


def _build_managed(plugin: repository_model.SourcePlugin, output: Path, root: Path, host_root: Path | None) -> None:
    projects = sorted((plugin.root / "src").glob("*.csproj"))
    repository_io._require(bool(projects), f"managed-code 插件缺少 csproj：{plugin.artifact_name}")
    resolved_host_root = _find_host_root(root, host_root)
    properties = (
        "-p:UseSharedCompilation=false",
        "-p:DebugType=None",
        "-p:DebugSymbols=false",
        "-p:ContinuousIntegrationBuild=true",
        "-p:Deterministic=true",
        "-p:CopyLocalLockFileAssemblies=true",
        "-p:IncludeSourceRevisionInInformationalVersion=false",
        "-p:SuppressImplicitGitSourceLink=true",
        f"-p:NexusHostRoot={resolved_host_root}",
    )
    repository_io._run(("dotnet", "build", str(projects[0]), "--configuration", "Release", "--nologo", "-m:1", "--disable-build-servers", "--output", str(output), *properties), f"构建插件：{plugin.artifact_name} v{plugin.version}", root)
    if plugin.artifact_name == "MaaFrameworkDriver":
        worker = plugin.root / "worker" / "NexusPipeline.MaaWorker.csproj"
        repository_io._require(worker.is_file(), "MaaFrameworkDriver 缺少独立 worker")
        repository_io._run(("dotnet", "publish", str(worker), "--configuration", "Release", "--nologo", "-m:1", "--disable-build-servers",
              "--output", str(output / "worker"), "--self-contained", "false", "-p:RestoreLockedMode=true",
              *properties), "构建 MaaFramework 独立 worker", root)


def _copy_tree(source: Path, destination: Path) -> None:
    repository_io._require(source.is_dir(), f"缺少目录：{repository_io._display(source)}")
    shutil.copytree(source, destination, dirs_exist_ok=True)


def _isolate_build_inputs(plugin: repository_model.SourcePlugin, root: Path, host_root: Path,
                          temporary_root: Path) -> tuple[repository_model.SourcePlugin, Path, Path]:
    def copy(source: Path, destination: Path) -> None:
        for item in source.rglob("*"):
            if any(part in {"bin", "obj", "node_modules", "__pycache__", ".git"} for part in item.relative_to(source).parts):
                continue
            repository_io._require(not item.is_symlink() and not item.is_junction(), "Linked build input")
            if item.is_file():
                target = destination / item.relative_to(source)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(item, target)
    plugins = temporary_root / "Plugins"
    host = temporary_root / "Host"
    copy(root / "plugins" / "general", plugins / "plugins" / "general")
    copy(host_root / "src" / "NexusPipeline.Plugin.Abstractions", host / "src" / "NexusPipeline.Plugin.Abstractions")
    for original, staged in ((root, plugins), (host_root, host)):
        for name in ("global.json", "Directory.Build.props", "Directory.Build.targets", "package.json", "package-lock.json"):
            source = original / name
            if source.is_file():
                repository_io._require(not source.is_symlink(), "Linked shared build input")
                shutil.copyfile(source, staged / name)
    return replace(plugin, root=plugins / plugin.root.relative_to(root)), plugins, host


def _copy_managed_payload(source: Path, destination: Path) -> None:
    copied = 0
    for item in sorted(source.rglob("*")):
        relative = item.relative_to(source)
        repository_io._require(not item.is_symlink() and not item.is_junction(), f"managed 构建输出不允许链接：{relative}")
        if relative.parts[0] == "worker" or not item.is_file() or item.suffix.lower() == ".pdb":
            continue
        if item.name.lower() in {"nexuspipeline.plugin.abstractions.dll", "nexuspipeline.plugin.abstractions.deps.json"}:
            continue
        target = destination / relative
        repository_io._require(not target.exists(), f"managed 构建输出与包资源冲突：{relative}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(item, target)
        copied += 1
    repository_io._require(copied > 0, "managed-code 插件没有可打包构建输出")


def validate_maa_worker_payload(payload: Path) -> None:
    worker = payload / "worker"
    required = ("NexusPipeline.MaaWorker.exe", "NexusPipeline.MaaWorker.dll",
                "NexusPipeline.MaaWorker.deps.json", "NexusPipeline.MaaWorker.runtimeconfig.json",
                "MaaFramework.Binding.dll", "MaaFramework.Binding.Native.dll",
                "NexusPipeline.Plugin.Abstractions.dll")
    for name in required:
        path = worker / name
        repository_io._require(path.is_file() and not path.is_symlink(), f"Maa 插件包缺少 worker 依赖：{name}")
    repository_io._require((worker / required[0]).read_bytes()[:2] == b"MZ", "Maa worker 必须是实际 Windows apphost")
    runtime = repository_io.read_json(worker / "NexusPipeline.MaaWorker.runtimeconfig.json").get("runtimeOptions", {})
    framework = runtime.get("framework", {})
    runtime_version = framework.get("version", "")
    repository_io._require(runtime.get("tfm") == "net10.0"
             and framework.get("name") == "Microsoft.NETCore.App"
             and re.fullmatch(r"10\.0\.(?:0|[1-9][0-9]*)", runtime_version) is not None
             and int(runtime_version.split(".")[2]) >= 12
             and runtime.get("rollForward") == "LatestPatch",
             "Maa worker 必须使用共享 .NET 10.0.12 或后续 10.0 补丁运行时")
    dependencies = repository_io.read_json(worker / "NexusPipeline.MaaWorker.deps.json")
    libraries = dependencies.get("libraries", {})
    repository_io._require("Maa.Framework.Binding/5.10.0" in libraries
             and "Maa.Framework.Binding.Native/5.10.0" in libraries,
             "Maa worker 绑定版本与锁定输入不一致")
    for name in ("NOTICE.md", "MaaFramework.Binding.LGPL-3.0.md", "GPL-3.0.txt"):
        repository_io._require((payload / "LICENSES" / name).is_file(), f"Maa 插件包缺少许可：{name}")
    repository_io._require(not any(path.suffix.casefold() == ".pdb"
                     or path.suffix.casefold() == ".exe" and path.name != required[0]
                     for path in payload.rglob("*") if path.is_file()),
             "Maa 插件包混入测试程序或调试产物")


def build_plugin_package(
    plugin: repository_model.SourcePlugin,
    destination: Path,
    root: Path,
    *,
    host_root: Path | None = None,
) -> Path:
    if plugin.kind == "data-specialized":
        repository_source.validate_specialized_contract(plugin)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_root = Path(tempfile.mkdtemp(prefix="nxp-pack-"))
    try:
        if plugin.kind == "managed-code":
            plugin, root, host_root = _isolate_build_inputs(plugin, root, _find_host_root(root, host_root), temporary_root)
        payload = temporary_root / "payload"
        payload.mkdir()
        shutil.copyfile(plugin.root / "plugin.json", payload / "plugin.json")
        shutil.copyfile(plugin.root / "store.json", payload / "store.json")
        readme = plugin.root / "README.md"
        if readme.is_file():
            shutil.copyfile(readme, payload / "README.md")
        if plugin.kind == "data-specialized":
            _copy_tree(plugin.root / "data", payload / "data")
        else:
            build_output = temporary_root / "build"
            if plugin.manifest.get("frontend") is not None:
                with ThreadPoolExecutor(max_workers=2) as executor:
                    managed = executor.submit(_build_managed, plugin, build_output, root, host_root)
                    frontend = executor.submit(_build_frontend, plugin, root)
                    managed.result()
                    frontend.result()
            else:
                _build_managed(plugin, build_output, root, host_root)
            _copy_managed_payload(build_output, payload)
            if plugin.artifact_name == "MaaFrameworkDriver":
                worker_output = build_output / "worker"
                repository_io._require((worker_output / "NexusPipeline.MaaWorker.exe").is_file(), "Maa 插件包缺少实际 worker")
                _copy_tree(worker_output, payload / "worker")
                _copy_tree(plugin.root / "LICENSES", payload / "LICENSES")
                validate_maa_worker_payload(payload)
        if plugin.manifest.get("frontend") is not None:
            repository_io._require(plugin.kind == "managed-code", f"专项插件 {plugin.artifact_name} 禁止构建 frontend")
            _copy_tree(plugin.root / "web", payload / "web")
        if plugin.manifest.get("localization") is not None:
            _copy_tree(plugin.root / "i18n", payload / "i18n")
        temporary_zip = temporary_root / "package.zip"
        _package_files(payload, temporary_zip)
        shutil.copyfile(temporary_zip, destination)
    except BaseException:
        print(f"[repository] Package failure evidence: {temporary_root}", flush=True)
        raise
    else:
        shutil.rmtree(temporary_root)
    return destination


def package_one(root: Path, *, artifact: str, output: Path, report: Path,
                host_root: Path | None = None, plan_phase: Path | None = None,
                sdk_sha: str | None = None) -> dict:

    import importlib.util
    import json
    from tools.repository.archive import _validate_zip
    from tools.repository.git import git_head
    from tools.repository.io import package_metadata, read_json
    from tools.repository.source import discover_source_plugins
    from tools.release.inventory import package_input_identities
    root, host = root.resolve(), host_root.resolve() if host_root else None
    if report.exists() or report.is_symlink():
        raise ValueError("Package report already exists")
    if bool(plan_phase) != bool(sdk_sha):
        raise ValueError("Package phase and SDK SHA must be supplied together")
    phase = read_json(plan_phase) if plan_phase else None
    if phase is not None:
        if (not isinstance(phase, dict) or phase.get("schemaVersion") != 1
                or phase.get("sourceSha") != git_head(root)
                or phase.get("partnerSha") != sdk_sha
                or host is None or git_head(host) != sdk_sha
                or artifact not in phase.get("plan", {}).get("requiresPackage", [])
                or phase.get("packageInputs") != package_input_identities(
                    root, phase["plan"], sdk_sha)):
            raise ValueError("Plugin package phase input identity mismatch")
    plugin = next((item for item in discover_source_plugins(root)
                   if item.artifact_name == artifact), None)
    if plugin is None or output.exists() or output.is_symlink():
        raise ValueError("Unknown plugin or existing package output")
    if plugin.kind == "managed-code" and host is None:
        raise ValueError("Managed package requires an explicit Host SDK input")
    output.mkdir(parents=True)
    output = output.resolve()
    if os.name == "nt":
        output = Path("\\\\?\\" + str(output))
    temporary = output / "package.build.zip"
    build_plugin_package(plugin, temporary, root, host_root=host)
    preliminary = package_metadata(temporary)
    package = output / f"{plugin.artifact_name}-{plugin.version}-{preliminary.sha256}.zip"
    temporary.rename(package)
    metadata = package_metadata(package)
    _validate_zip(package, mode="preview", expected_artifact=plugin.artifact_name,
                  expected_version=plugin.version, expected_sha256=metadata.sha256)
    spec = importlib.util.spec_from_file_location("plugin_architecture", root / "tests" / "architecture" / "check.py")
    architecture = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(architecture)
    violations = architecture.check_specialized_zip(package, plugin.artifact_name) if plugin.kind == "data-specialized" else []
    if violations:
        raise ValueError(f"A06 package boundary failed: {violations}")
    result = {"schemaVersion": 2 if phase is not None else 1, "artifactName": plugin.artifact_name,
              "version": plugin.version, "kind": plugin.kind, "fileName": package.name,
              "sha256": metadata.sha256,
              "sizeBytes": metadata.size_bytes, "status": "PASS"}
    if phase is not None:
        result.update({"sourceSha": phase["sourceSha"], "partnerSha": sdk_sha,
                       "inputSha": phase["packageInputs"][artifact]})
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return result
