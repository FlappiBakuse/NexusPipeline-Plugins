"""Resolve the finite managed compiler inputs without package documentation or browser assets."""
import ast
import glob
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

from source_snapshot import sha, encode


def tool_sources(root, entries):
    pending = [root / 'tooling' / name for name in entries]
    visited = set()
    while pending:
        path = pending.pop()
        if path in visited:
            continue
        visited.add(path)
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            names = [item.name for item in node.names] if isinstance(node, ast.Import) else \
                [node.module] if isinstance(node, ast.ImportFrom) and node.module else []
            for name in names:
                candidate = root / 'tooling' / (name.split('.')[0] + '.py')
                if candidate.is_file():
                    pending.append(candidate)
    return visited


def dotnet_context(root, environment):
    search = next((value for key, value in environment.items() if key.upper() == 'PATH'), '')
    path = shutil.which('dotnet', path=search)
    if path is None:
        raise ValueError('A stable .NET 10.0 SDK is required')
    host = Path(path).resolve(strict=True)
    result = subprocess.run([str(host), '--version'], cwd=root, env=environment, capture_output=True,
                            encoding='utf-8', errors='replace', timeout=30)
    version = result.stdout.strip()
    if result.returncode or re.fullmatch(r'10\.0\.[1-9][0-9]{2,}', version) is None:
        raise ValueError('Expected a stable .NET 10.0 SDK: ' + (result.stderr.strip() or version))
    relevant = {key: value for key, value in environment.items() if key.upper().startswith(('DOTNET_', 'MSBUILD', 'NUGET_'))
                or key.upper() in ('PATH', 'PATHEXT')}
    return {'tool': 'dotnet', 'path': str(host), 'sdkVersion': version, 'toolSha256': sha(host.read_bytes()),
            'pythonSha256': sha(Path(sys.executable).read_bytes()), 'platform': platform.platform(),
            'configuration': 'Release', 'environmentHash': sha(encode(dict(sorted(relevant.items()))))}


def records(root, paths):
    result = []
    for path in sorted(set(paths), key=lambda item: item.relative_to(root).as_posix().encode()):
        if path.is_symlink() or path.is_junction() or root not in path.resolve(strict=True).parents:
            raise ValueError('Compiler input escaped its source owner')
        data = path.read_bytes()
        result.append({'path': path.relative_to(root).as_posix(), 'sizeBytes': len(data), 'sha256': sha(data)})
    return result


def managed_inputs(root, plugin, source, package, manifest, environment):
    paths = tool_sources(root, ['build_managed_slice.py'])
    pending = list(plugin.glob('*.csproj'))
    if manifest.get('execution'):
        configuration = plugin / 'build.json'
        paths.add(configuration)
        worker = (plugin / json.loads(configuration.read_bytes())['workerProject']).resolve(strict=True)
        if plugin.resolve() not in worker.parents:
            raise ValueError('Managed worker project escaped its plugin')
        pending.append(worker)
    projects, unknown = set(), []

    def expand(base, pattern):
        if any(char in pattern for char in '$@;'):
            raise ValueError('Unresolved compiler input: ' + pattern)
        values = [Path(name).resolve(strict=True) for name in glob.glob(str(base / pattern), recursive=True) if Path(name).is_file()]
        if not values and not any(char in pattern for char in '*?['):
            raise ValueError('Missing declared compiler input: ' + pattern)
        return values

    while pending:
        project = pending.pop().resolve(strict=True)
        if project in projects:
            continue
        projects.add(project)
        paths.add(project)
        tree = ET.parse(project)
        defaults = tree.findtext('PropertyGroup/EnableDefaultCompileItems') != 'false'
        compiled = set(project.parent.rglob('*.cs')) if defaults else set()
        for node in tree.iter():
            try:
                if node.tag not in {'Project', 'PropertyGroup', 'ItemGroup', 'TargetFramework', 'Nullable', 'ImplicitUsings',
                        'TreatWarningsAsErrors', 'Version', 'AssemblyName', 'IsPackable', 'OutputType', 'UseSharedCompilation',
                        'EnableDefaultCompileItems', 'PackageReference', 'ProjectReference', 'Compile'}:
                    raise ValueError('Unresolved managed project evaluation: ' + node.tag)
                if node.tag == 'ProjectReference':
                    pending.extend(expand(project.parent, node.attrib['Include']))
                elif node.tag == 'Compile':
                    if 'Include' in node.attrib:
                        compiled.update(expand(project.parent, node.attrib['Include']))
                    if 'Remove' in node.attrib:
                        compiled.difference_update(expand(project.parent, node.attrib['Remove']))
            except (ValueError, KeyError) as reason:
                unknown.append(str(reason))
        paths.update(compiled)
        for directory in [project.parent, *project.parent.parents]:
            if directory != root and root not in directory.parents:
                break
            for name in ('Directory.Build.props', 'Directory.Build.targets', 'Directory.Packages.props', 'NuGet.Config',
                         'global.json', 'packages.lock.json', '.editorconfig', '.globalconfig'):
                candidate = directory / name
                if candidate.is_file():
                    paths.add(candidate)
                    if candidate.suffix in ('.props', '.targets'):
                        unknown.append('Shared build evaluation requires a fresh managed invocation')
            if directory == root:
                break
    files = json.loads(Path(source['sourceManifestPath']).read_bytes())['files'] if unknown else records(root, paths)
    value = {'algorithm': 'nexus-managed-inputs-v1', 'files': files, 'projects': sorted(path.stem for path in projects),
             'sdkPackageSha256': package['sha256'], 'managed': manifest['managed'], 'execution': manifest.get('execution'),
             'context': dotnet_context(plugin, environment), 'conservativeReasons': sorted(set(unknown))}
    return {**value, 'sha256': sha(encode(value))}
