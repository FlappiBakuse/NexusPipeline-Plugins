[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9-]{0,63}$')]
    [string]$PluginName,

    [switch]$UpdateCatalog
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$catalogPath = Join-Path $repoRoot "catalog.json"
$pluginDir = Join-Path (Join-Path $repoRoot "plugins") $PluginName

function Read-Json([string]$path) {
    return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
}

function Assert-Path([string]$path, [string]$message) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw $message
    }
}

Assert-Path $catalogPath "缺少 catalog.json：$catalogPath"
Assert-Path $pluginDir "缺少插件目录：$pluginDir"

$catalog = Read-Json $catalogPath
$entry = @($catalog.plugins | Where-Object { $_.name -eq $PluginName }) | Select-Object -First 1
if ($null -eq $entry) {
    throw "catalog.json 中不存在插件：$PluginName"
}
if ([int]$catalog.schemaVersion -ne 2) {
    throw "Pack-Plugin.ps1 只生成 catalog schemaVersion 2 包"
}

$artifactName = [string]$entry.artifactName
if (([string]::IsNullOrWhiteSpace($artifactName)) -or ($artifactName -notmatch '^[A-Za-z][A-Za-z0-9]*$') -or ($artifactName -cnotmatch '[A-Z]')) {
    throw "artifactName 不符合大小写命名规范：$artifactName"
}

$manifestPath = Join-Path $pluginDir "plugin.json"
Assert-Path $manifestPath "缺少插件 manifest：$manifestPath"
$manifest = Read-Json $manifestPath
$version = [string]$manifest.version
$kind = [string]$manifest.kind
if ($manifest.name -ne $PluginName -or [string]::IsNullOrWhiteSpace($version)) {
    throw "plugin.json 的 name/version 与目标插件不一致"
}
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "插件版本不是三段 SemVer：$version"
}
if ($entry.version -ne $version) {
    throw "catalog.json 与 plugin.json 版本不一致：$($entry.version) / $version"
}
if ($kind -eq "specialized") { $kind = "data-specialized" }
if ($kind -notin @("data-specialized", "managed-code")) {
    throw "不支持的插件类型：$kind"
}

$tempRoot = [System.IO.Path]::GetTempPath()
$stagingRoot = Join-Path $tempRoot ("nxp-plugin-pack-" + [guid]::NewGuid().ToString("N"))
$payloadRoot = Join-Path $stagingRoot "payload"
$buildRoot = Join-Path $stagingRoot "build"
$artifactDir = Join-Path (Join-Path $repoRoot "packages") $artifactName
$finalPath = Join-Path $artifactDir "$artifactName-$version.zip"
$temporaryZip = Join-Path $artifactDir (".$artifactName-$version-" + [guid]::NewGuid().ToString("N") + ".zip")

New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

try {
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $payloadRoot "plugin.json")

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
        & dotnet build $project.FullName --configuration Release --nologo --output $buildRoot
        if ($LASTEXITCODE -ne 0) {
            throw "插件构建失败：$PluginName"
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
    Compress-Archive -Path (Join-Path $payloadRoot "*") -DestinationPath $temporaryZip -CompressionLevel Optimal
    Move-Item -LiteralPath $temporaryZip -Destination $finalPath -Force

    $hash = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $size = (Get-Item -LiteralPath $finalPath).Length
    if ($UpdateCatalog) {
        $entry.packageUrl = "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/$artifactName/$artifactName-$version.zip"
        $entry.sha256 = $hash
        $entry.sizeBytes = $size
        $catalog.generatedAt = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
        $json = $catalog | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($catalogPath, $json, [System.Text.UTF8Encoding]::new($false))
    }

    $pattern = "^" + [regex]::Escape($artifactName) + "-(\d+)\.(\d+)\.(\d+)\.zip$"
    $versioned = @(
        Get-ChildItem -LiteralPath $artifactDir -Filter *.zip -File | ForEach-Object {
            if ($_.Name -match $pattern) {
                [pscustomobject]@{ File = $_; Major = [int]$Matches[1]; Minor = [int]$Matches[2]; Patch = [int]$Matches[3] }
            }
        }
    ) | Sort-Object Major, Minor, Patch -Descending
    $versioned | Select-Object -Skip 3 | ForEach-Object {
        Remove-Item -LiteralPath $_.File.FullName -Force
    }

    Write-Output "已生成：$finalPath"
    Write-Output "SHA256：$hash"
    Write-Output "大小：$size bytes"
    Write-Output "保留版本：$(@($versioned | Select-Object -First 3 | ForEach-Object { $_.File.Name }) -join ', ')"
}
finally {
    if (Test-Path -LiteralPath $temporaryZip) {
        Remove-Item -LiteralPath $temporaryZip -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
