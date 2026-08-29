[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [Alias("PluginName")]
    [string]$ArtifactName,

    [switch]$UpdateCatalog
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginRoot = Join-Path $repoRoot "plugins"

function Read-Json([string]$path) {
    return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
}

function Assert-Path([string]$path, [string]$message) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw $message
    }
}

function Test-CanonicalPluginId([string]$value) {
    return $value -cmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$' -and $value.Length -le 64
}

function Test-ArtifactName([string]$value) {
    return $value -cmatch '^[A-Za-z][A-Za-z0-9]*$' -and $value.Length -le 64 -and $value -cmatch '[A-Z]'
}

function Write-DeterministicZip([string]$sourceRoot, [string]$destination) {
    $root = (Resolve-Path -LiteralPath $sourceRoot).Path.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        $files = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse | ForEach-Object {
            [pscustomobject]@{
                File = $_
                Relative = [IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/')
            }
        } | Sort-Object Relative)
        $fixedTimestamp = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
        foreach ($item in $files) {
            $entry = $archive.CreateEntry($item.Relative, [IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = $fixedTimestamp
            $input = [IO.File]::OpenRead($item.File.FullName)
            $output = $entry.Open()
            try {
                $input.CopyTo($output)
            }
            finally {
                $output.Dispose()
                $input.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
        $stream.Dispose()
    }
}

if ([string]::IsNullOrWhiteSpace($ArtifactName)) {
    throw "必须指定 artifactName（例如 -ArtifactName GameCheckIn）"
}
if (-not (Test-ArtifactName $ArtifactName)) {
    throw "artifactName 不符合大小写命名规范：$ArtifactName"
}

$pluginDir = Join-Path $pluginRoot $ArtifactName
$manifestPath = Join-Path $pluginDir "plugin.json"
Assert-Path $pluginDir "缺少插件目录：$pluginDir"
Assert-Path $manifestPath "缺少插件 manifest：$manifestPath"
$manifest = Read-Json $manifestPath
if ([int]$manifest.schemaVersion -ne 2) {
    throw "正式发行包必须使用 plugin.json schemaVersion 2：$ArtifactName"
}
if ([string]$manifest.artifactName -cne $ArtifactName) {
    throw "plugin.json artifactName 与源码目录不一致：$($manifest.artifactName) / $ArtifactName"
}
if (-not (Test-CanonicalPluginId ([string]$manifest.name))) {
    throw "plugin.json name 不符合小写 kebab-case：$($manifest.name)"
}
$version = [string]$manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+$' -or @($version.Split('.') | Where-Object { $_.Length -gt 1 -and $_.StartsWith('0') }).Count -gt 0) {
    throw "插件版本不是三段 SemVer：$version"
}
$kind = ([string]$manifest.kind).Trim().ToLowerInvariant()
if ($kind -eq "specialized") { $kind = "data-specialized" }
if ($kind -notin @("data-specialized", "managed-code")) {
    throw "不支持的插件类型：$kind"
}

$storePath = Join-Path $pluginDir "store.json"
Assert-Path $storePath "缺少插件商店元数据：$storePath"

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("nxp-plugin-pack-" + [guid]::NewGuid().ToString("N"))
$payloadRoot = Join-Path $tempRoot "payload"
$buildRoot = Join-Path $tempRoot "build"
$artifactDir = Join-Path (Join-Path $repoRoot "packages") $ArtifactName
$finalPath = Join-Path $artifactDir "$ArtifactName-$version.zip"
$temporaryZip = Join-Path ([System.IO.Path]::GetTempPath()) ("$ArtifactName-$version-" + [guid]::NewGuid().ToString("N") + ".zip")

New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

try {
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $payloadRoot "plugin.json")
    Copy-Item -LiteralPath $storePath -Destination (Join-Path $payloadRoot "store.json")
    $readmePath = Join-Path $pluginDir "README.md"
    if (Test-Path -LiteralPath $readmePath) {
        Copy-Item -LiteralPath $readmePath -Destination (Join-Path $payloadRoot "README.md")
    }

    if ($kind -eq "data-specialized") {
        $dataRoot = Join-Path $pluginDir "data"
        Assert-Path $dataRoot "数据化插件缺少 data 目录：$dataRoot"
        Copy-Item -LiteralPath $dataRoot -Destination (Join-Path $payloadRoot "data") -Recurse
    }
    else {
        $project = @(Get-ChildItem -LiteralPath (Join-Path $pluginDir "src") -Filter *.csproj -File) | Select-Object -First 1
        if ($null -eq $project) {
            throw "managed-code 插件缺少 src/*.csproj"
        }
        New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
        Write-Output "正在构建插件：$ArtifactName v$version"
        & dotnet build $project.FullName --configuration Release --nologo --output $buildRoot
        if ($LASTEXITCODE -ne 0) {
            throw "插件构建失败：$ArtifactName"
        }
        Get-ChildItem -LiteralPath $buildRoot -File | Where-Object {
            $_.Extension -in @(".dll", ".json") -and $_.Name -notmatch '\.runtimeconfig\.json$'
        } | Copy-Item -Destination $payloadRoot
    }

    if (($manifest.PSObject.Properties.Name -contains "frontend") -and $null -ne $manifest.frontend) {
        $webRoot = Join-Path $pluginDir "web"
        Assert-Path $webRoot "manifest 声明了 frontend，但缺少 web 目录：$webRoot"
        Copy-Item -LiteralPath $webRoot -Destination (Join-Path $payloadRoot "web") -Recurse
    }

    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
    Write-DeterministicZip $payloadRoot $temporaryZip
    $hash = (Get-FileHash -LiteralPath $temporaryZip -Algorithm SHA256).Hash.ToLowerInvariant()
    $size = (Get-Item -LiteralPath $temporaryZip).Length
    if (Test-Path -LiteralPath $finalPath) {
        $existingHash = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($existingHash -cne $hash) {
            throw "同一 SemVer 的发行包已存在且内容不同，拒绝覆盖：$finalPath"
        }
        Write-Output "同版本发行包内容一致，保持原文件：$finalPath"
    }
    else {
        Move-Item -LiteralPath $temporaryZip -Destination $finalPath
        Write-Output "已生成：$finalPath"
    }

    $pattern = "^" + [regex]::Escape($ArtifactName) + "-(\d+)\.(\d+)\.(\d+)\.zip$"
    $versioned = @(
        Get-ChildItem -LiteralPath $artifactDir -Filter *.zip -File | ForEach-Object {
            if ($_.Name -cmatch $pattern) {
                [pscustomobject]@{ File = $_; Major = [int]$Matches[1]; Minor = [int]$Matches[2]; Patch = [int]$Matches[3] }
            }
        }
    ) | Sort-Object Major, Minor, Patch -Descending
    $versioned | Select-Object -Skip 3 | ForEach-Object {
        Remove-Item -LiteralPath $_.File.FullName -Force
    }

    Write-Output "SHA256：$hash"
    Write-Output "大小：$size bytes"
    Write-Output "保留版本：$(@($versioned | Select-Object -First 3 | ForEach-Object { $_.File.Name }) -join ', ')"
    if ($UpdateCatalog) {
        & (Join-Path $PSScriptRoot "Generate-Catalog.ps1")
    }
}
finally {
    if (Test-Path -LiteralPath $temporaryZip) {
        Remove-Item -LiteralPath $temporaryZip -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
