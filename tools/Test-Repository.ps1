[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginsRoot = Join-Path $repoRoot "plugins"
$catalogPath = Join-Path $repoRoot "catalog.json"

function Invoke-Checked([string]$label, [string]$command, [string[]]$arguments) {
    Write-Output "[Test-Repository] $label"
    & $command @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$label 失败（exit=$LASTEXITCODE）"
    }
}

function Read-Json([string]$path) {
    try {
        return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
    }
    catch {
        throw "JSON 无效：$path；$($_.Exception.Message)"
    }
}

function Assert-SafePluginRelativeFile([string]$pluginDirectory, [string]$relativePath, [string]$label, [string]$extension) {
    if ([string]::IsNullOrWhiteSpace($relativePath) -or $relativePath.Contains([char]0)) {
        throw "$label 不能为空：$relativePath"
    }
    if ([IO.Path]::IsPathRooted($relativePath) -or $relativePath.Contains(':')) {
        throw "$label 必须是插件目录内的相对路径：$relativePath"
    }

    $normalized = $relativePath.Replace('\', '/')
    if (-not $normalized.EndsWith($extension, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$label 必须使用 $extension 扩展名：$relativePath"
    }
    if ($normalized.Split('/') | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' }) {
        throw "$label 包含不安全的路径段：$relativePath"
    }

    try {
        $root = [IO.Path]::GetFullPath($pluginDirectory).TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
        $candidate = [IO.Path]::GetFullPath([IO.Path]::Combine($pluginDirectory, $relativePath))
    }
    catch {
        throw "$label 路径无效：$relativePath"
    }
    if (-not $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$label 越出插件目录：$relativePath"
    }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw "$label 文件不存在：$candidate"
    }
}

function Assert-DataSpecializedContract($pluginDirectory, $manifest) {
    $resolveRelative = [string]$manifest.resolve
    $judgeRelative = [string]$manifest.judgeScript
    if ([string]::IsNullOrWhiteSpace($resolveRelative) -or [string]::IsNullOrWhiteSpace($judgeRelative)) {
        throw "数据化插件缺少 resolve/judgeScript：$($manifest.name)"
    }

    $pluginRoot = (Resolve-Path -LiteralPath $pluginDirectory.FullName).Path.TrimEnd('\') + '\'
    foreach ($relative in @($resolveRelative, $judgeRelative)) {
        $candidate = [IO.Path]::GetFullPath((Join-Path $pluginDirectory.FullName $relative))
        if (-not $candidate.StartsWith($pluginRoot, [StringComparison]::OrdinalIgnoreCase)) {
            throw "数据化插件引用越出插件目录：$($manifest.name) -> $relative"
        }
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "数据化插件引用文件不存在：$candidate"
        }
    }

    if ($manifest.PSObject.Properties.Name -contains "configValidator") {
        Assert-SafePluginRelativeFile $pluginDirectory.FullName ([string]$manifest.configValidator) "configValidator" ".js"
    }

    $resolve = Read-Json ([IO.Path]::GetFullPath((Join-Path $pluginDirectory.FullName $resolveRelative)))
    if ($null -eq $resolve.require -or $null -eq $resolve.paths) {
        throw "数据化插件 resolve.json 缺少 require 或 paths：$($manifest.name)"
    }
    $requirements = @($resolve.require)
    if ($requirements.Count -lt 1 -or $requirements.Count -gt 32) {
        throw "数据化插件 require 数量无效：$($manifest.name)"
    }
    foreach ($requirement in $requirements) {
        $variable = [string]$requirement.var
        $file = [string]$requirement.file
        if ($variable -notmatch '^[A-Za-z][A-Za-z0-9_]*$' -or [string]::IsNullOrWhiteSpace($file)) {
            throw "数据化插件 require 条目无效：$($manifest.name)"
        }
    }
    foreach ($pathName in @("mainExe", "args", "configPath", "logPath")) {
        if ($resolve.paths.PSObject.Properties.Name -notcontains $pathName) {
            throw "数据化插件 paths 缺少 $pathName：$($manifest.name)"
        }
    }
    if ($resolve.paths.PSObject.Properties.Name -contains "extraConfigPaths") {
        if ($null -eq $resolve.paths.extraConfigPaths -or $resolve.paths.extraConfigPaths -isnot [System.Array]) {
            throw "数据化插件 paths.extraConfigPaths 必须是字符串数组：$($manifest.name)"
        }
        foreach ($extraPath in @($resolve.paths.extraConfigPaths)) {
            $extraText = [string]$extraPath
            if ([string]::IsNullOrWhiteSpace($extraText) -or [IO.Path]::IsPathRooted($extraText) -or $extraText -match ':') {
                throw "数据化插件 paths.extraConfigPaths 条目必须是安全的脚本根目录相对路径：$($manifest.name)"
            }
            if ($extraText -split '[\\/]' -contains '..') {
                throw "数据化插件 paths.extraConfigPaths 条目不允许相对路径上跳：$($manifest.name)"
            }
        }
    }
}

function Assert-ManifestsAndDataContracts {
    $directories = @(Get-ChildItem -LiteralPath $pluginsRoot -Directory | Sort-Object Name)
    if ($directories.Count -eq 0) {
        throw "plugins 目录为空"
    }
    foreach ($directory in $directories) {
        $manifestPath = Join-Path $directory.FullName "plugin.json"
        $manifest = Read-Json $manifestPath
        if ([int]$manifest.schemaVersion -ne 2) {
            throw "plugin.json schemaVersion 必须为 2：$($directory.Name)"
        }
        if ([string]$manifest.artifactName -cne $directory.Name) {
            throw "artifactName 与插件目录不一致：$($directory.Name)"
        }
        if ([string]$manifest.name -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
            throw "插件机器 ID 无效：$($manifest.name)"
        }
        if ($manifest.PSObject.Properties.Name -contains "supportsEmulator" -or $manifest.PSObject.Properties.Name -contains "replaces") {
            throw "插件 manifest 不支持历史兼容字段：$($manifest.name)"
        }
        if ([string]$manifest.version -notmatch '^\d+\.\d+\.\d+$') {
            throw "插件版本无效：$($manifest.name)"
        }
        $kind = ([string]$manifest.kind).Trim().ToLowerInvariant()
        if ($manifest.PSObject.Properties.Name -contains "configValidator" -and $kind -ne "data-specialized") {
            throw "configValidator 仅支持 data-specialized 插件：$($manifest.name)"
        }
        if ($kind -eq "data-specialized") {
            Assert-DataSpecializedContract $directory $manifest
        }
    }
}

function Assert-CatalogOrder($catalog) {
    $entries = @($catalog.plugins)
    $previousGroup = -1
    $previousName = ""
    foreach ($entry in $entries) {
        $group = if ([string]$entry.kind -eq "data-specialized") { 1 } else { 0 }
        if ($group -lt $previousGroup) {
            throw "catalog 插件顺序必须为通用插件在前、专项插件在后"
        }
        if ($group -eq $previousGroup -and [string]::Compare([string]$entry.name, $previousName, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
            throw "catalog 同组插件必须按机器 ID 稳定排序：$previousName / $($entry.name)"
        }
        $previousGroup = $group
        $previousName = [string]$entry.name
    }
}

function Assert-DocumentationSemantics {
    $readmePath = Join-Path $repoRoot "README.md"
    $contributingPath = Join-Path $repoRoot "CONTRIBUTING.md"
    $dataGuidePath = Join-Path $repoRoot "docs\DATA_SPECIALIZED_PLUGIN.md"
    $judgeGuidePath = Join-Path $repoRoot "docs\JUDGE_SCRIPT.md"
    $releaseGuidePath = Join-Path $repoRoot "docs\RELEASING.md"
    $documents = @(
        @{ Path = $readmePath; Text = Get-Content -Raw -LiteralPath $readmePath },
        @{ Path = $contributingPath; Text = Get-Content -Raw -LiteralPath $contributingPath },
        @{ Path = $dataGuidePath; Text = Get-Content -Raw -LiteralPath $dataGuidePath },
        @{ Path = $judgeGuidePath; Text = Get-Content -Raw -LiteralPath $judgeGuidePath },
        @{ Path = $releaseGuidePath; Text = Get-Content -Raw -LiteralPath $releaseGuidePath }
    )

    if ($documents[0].Text -notmatch 'PluginType\s*\+\s*RootPath') {
        throw "README 未说明专项脚本实例的稳定身份：PluginType + RootPath"
    }
    if ($documents[0].Text -notmatch 'scripts\.json.*PluginType.*RootPath') {
        throw "README 未说明专项 profile 从 scripts.json 声明解析"
    }
    if ($documents[2].Text -notmatch '每次运行/编辑.*冻结') {
        throw "数据化专项插件指南未说明运行/编辑时冻结当前 profile"
    }
    if ($documents[1].Text -notmatch '不重新保存.*当前 profile') {
        throw "贡献指南未覆盖插件升级后的历史实例解析检查"
    }

    $stalePatterns = @(
        '保存脚本实例时固化解析结果',
        '宿主固化.*JudgeScript',
        'config-template',
        'configTemplate'
    )
    foreach ($document in $documents) {
        foreach ($pattern in $stalePatterns) {
            if ($document.Text -match $pattern) {
                throw "插件文档包含已废弃运行语义：$($document.Path) -> $pattern"
            }
        }
    }
}

function Invoke-JavaScriptSyntaxChecks {
    $files = @(Get-ChildItem -LiteralPath $pluginsRoot -Recurse -File | Where-Object {
        $_.Extension -in @(".js", ".mjs") -and $_.FullName -notmatch '[\\/]bin[\\/]|[\\/]obj[\\/]'
    } | Sort-Object FullName)
    if ($files.Count -eq 0) {
        throw "未找到插件 JavaScript 文件"
    }
    foreach ($file in $files) {
        Invoke-Checked "JavaScript 语法：$($file.FullName)" "node" @("--check", $file.FullName)
    }

    $pythonFiles = @(Get-ChildItem -LiteralPath $pluginsRoot -Recurse -File -Filter *.py | Where-Object {
        $_.FullName -notmatch '[\\/]bin[\\/]|[\\/]obj[\\/]'
    } | Sort-Object FullName)
    foreach ($file in $pythonFiles) {
        Invoke-Checked "Python 语法：$($file.FullName)" "python" @("-m", "py_compile", $file.FullName)
    }
}

function Remove-GeneratedBuildArtifacts {
    $projectDirectories = @(Get-ChildItem -LiteralPath $pluginsRoot -Recurse -File -Filter *.csproj | ForEach-Object {
        $_.Directory.FullName
    } | Sort-Object -Unique)
    foreach ($directory in $projectDirectories) {
        foreach ($name in @("bin", "obj")) {
            $path = Join-Path $directory $name
            if (Test-Path -LiteralPath $path -PathType Container) {
                Remove-Item -LiteralPath $path -Recurse -Force
            }
        }
    }
}

try {
    Write-Output "[Test-Repository] 开始 NexusPipeline-Plugins 全量验证：$repoRoot"

    $jsonFiles = @(Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Filter *.json | Where-Object {
        $_.FullName -notmatch '[\\/]\.git[\\/]|[\\/]bin[\\/]|[\\/]obj[\\/]'
    } | Sort-Object FullName)
    foreach ($file in $jsonFiles) {
        Read-Json $file.FullName | Out-Null
    }
    Write-Output "[Test-Repository] JSON 语法：$($jsonFiles.Count) 个文件通过"

    Assert-CatalogOrder (Read-Json $catalogPath)
    Write-Output "[Test-Repository] catalog 通用插件优先顺序通过"

    Assert-ManifestsAndDataContracts
    Write-Output "[Test-Repository] manifest 与 data-specialized contract 通过"
    Assert-DocumentationSemantics
    Write-Output "[Test-Repository] 插件文档运行语义通过"

    Invoke-JavaScriptSyntaxChecks
    Invoke-Checked "catalog 可重建性" "pwsh" @("-NoProfile", "-File", (Join-Path $PSScriptRoot "Generate-Catalog.ps1"), "-Verify")
    Invoke-Checked "发行包完整性" "pwsh" @("-NoProfile", "-File", (Join-Path $PSScriptRoot "Validate-Packages.ps1"))

    $projects = @(Get-ChildItem -LiteralPath $pluginsRoot -Recurse -File -Filter *.csproj | Where-Object {
        $_.Name -notlike "*.Tests.csproj"
    } | Sort-Object FullName)
    foreach ($project in $projects) {
        Invoke-Checked "managed-code 构建：$($project.FullName)" "dotnet" @("build", $project.FullName, "--configuration", "Release", "--nologo", "-m:1")
    }

    $testProjects = @(Get-ChildItem -LiteralPath $pluginsRoot -Recurse -File -Filter *.Tests.csproj | Sort-Object FullName)
    foreach ($project in $testProjects) {
        Invoke-Checked "managed-code 测试：$($project.FullName)" "dotnet" @("test", $project.FullName, "--configuration", "Release", "--nologo", "-m:1")
    }

    Write-Output "[Test-Repository] NexusPipeline-Plugins 全量验证通过"
    exit 0
}
finally {
    try {
        Remove-GeneratedBuildArtifacts
    }
    catch {
        Write-Warning "清理插件构建产物失败：$($_.Exception.Message)"
    }
}
