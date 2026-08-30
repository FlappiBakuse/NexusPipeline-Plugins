[CmdletBinding()]
param(
    [string]$CatalogPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "catalog.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packagesRoot = Join-Path $repoRoot "packages"

function Read-Json([string]$path) {
    return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
}

function Assert-ValidArtifactName([string]$value) {
    return -not [string]::IsNullOrWhiteSpace($value) -and $value.Length -le 64 -and $value -match '^[A-Za-z][A-Za-z0-9]*$' -and $value -cmatch '[A-Z]'
}

function Normalize-Authors($value, [string]$source) {
    if ($null -eq $value) {
        throw "缺少 authors：$source"
    }
    $entries = @($value)
    if ($entries.Count -lt 1 -or $entries.Count -gt 8) {
        throw "authors 数量无效：$source"
    }
    $normalized = [System.Collections.Generic.List[string]]::new()
    $separator = [char]0x1f
    foreach ($entry in $entries) {
        if ($null -eq $entry) {
            throw "作者条目无效：$source"
        }
        $name = ([string]$entry.name).Trim()
        $url = if ($entry.PSObject.Properties.Name -contains "url") { ([string]$entry.url).Trim() } else { "" }
        if ([string]::IsNullOrWhiteSpace($name) -or $name.Length -gt 64 -or $name.Contains('<') -or $name.Contains('>')) {
            throw "作者条目无效：$source"
        }
        $normalized.Add("$name$separator$url")
    }
    return $normalized.ToArray()
}

if (-not (Test-Path -LiteralPath $CatalogPath)) { throw "缺少 catalog.json：$CatalogPath" }
if (-not (Test-Path -LiteralPath $packagesRoot)) { throw "缺少 packages 目录：$packagesRoot" }
$catalog = Read-Json $CatalogPath
if ([int]$catalog.schemaVersion -ne 2) { throw "catalog schemaVersion 必须为 2" }

$artifactNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$checked = 0
foreach ($entry in @($catalog.plugins)) {
    $artifact = [string]$entry.artifactName
    if (-not (Assert-ValidArtifactName $artifact) -or -not $artifactNames.Add($artifact)) {
        throw "artifactName 无效或重复：$artifact"
    }
    $expectedUrl = "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/$artifact/$artifact-$($entry.version).zip"
    if ($entry.packageUrl -cne $expectedUrl) { throw "packageUrl 与 artifactName/version 不一致：$($entry.name)" }

    $artifactDir = Join-Path $packagesRoot $artifact
    $packagePath = Join-Path $artifactDir "$artifact-$($entry.version).zip"
    if (-not (Test-Path -LiteralPath $packagePath)) { throw "缺少 catalog 指定包：$packagePath" }
    $file = Get-Item -LiteralPath $packagePath
    if ([int64]$entry.sizeBytes -ne $file.Length) { throw "包大小不一致：$packagePath" }
    $actualHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($entry.sha256 -cne $actualHash) { throw "SHA256 不一致：$packagePath" }

    $archive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
    try {
        foreach ($zipEntry in $archive.Entries) {
            $name = $zipEntry.FullName.Replace('\', '/').TrimEnd('/')
            $invalidSegment = @($name.Split('/') | Where-Object { $_ -in @('', '.', '..') }).Count -gt 0
            if ($name.StartsWith('/') -or $invalidSegment) {
                throw "ZIP 条目路径非法：$packagePath -> $name"
            }
        }
        $manifestEntry = $archive.Entries | Where-Object { $_.FullName -eq 'plugin.json' } | Select-Object -First 1
        if ($null -eq $manifestEntry) { throw "ZIP 根目录缺少 plugin.json：$packagePath" }
        $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
        try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        $manifestMismatch = [int]$manifest.schemaVersion -ne 2 -or $manifest.name -cne $entry.name -or $manifest.artifactName -cne $artifact -or $manifest.version -cne $entry.version
        if ($manifestMismatch) {
            throw "ZIP manifest 与 catalog 不一致：$packagePath"
        }
        $storeEntry = $archive.Entries | Where-Object { $_.FullName -eq 'store.json' } | Select-Object -First 1
        if ($null -eq $storeEntry) { throw "ZIP 根目录缺少 store.json：$packagePath" }
        $storeReader = [System.IO.StreamReader]::new($storeEntry.Open())
        try { $store = $storeReader.ReadToEnd() | ConvertFrom-Json } finally { $storeReader.Dispose() }
        if ([int]$store.schemaVersion -ne 1) { throw "ZIP store.json schemaVersion 无效：$packagePath" }
        $catalogAuthors = @(Normalize-Authors $entry.authors "catalog $($entry.name)")
        $packageAuthors = @(Normalize-Authors $store.authors "ZIP $packagePath")
        if ($catalogAuthors.Count -ne $packageAuthors.Count) {
            throw "ZIP store.json authors 与 catalog 不一致：$packagePath"
        }
        for ($authorIndex = 0; $authorIndex -lt $catalogAuthors.Count; $authorIndex++) {
            if ($catalogAuthors[$authorIndex] -cne $packageAuthors[$authorIndex]) {
                throw "ZIP store.json authors 与 catalog 不一致：$packagePath"
            }
        }
    }
    finally { $archive.Dispose() }
    $checked++
}

foreach ($directory in @(Get-ChildItem -LiteralPath $packagesRoot -Directory)) {
    if (-not (Assert-ValidArtifactName $directory.Name)) { throw "发行包目录名不符合大小写规范：$($directory.Name)" }
    $zips = @(Get-ChildItem -LiteralPath $directory.FullName -Filter *.zip -File)
    if ($zips.Count -gt 3) { throw "插件发行包超过最近 3 个版本：$($directory.Name)" }
    $pattern = "^" + [regex]::Escape($directory.Name) + '-\d+\.\d+\.\d+\.zip$'
    foreach ($zip in $zips) {
        if ($zip.Name -cnotmatch $pattern) { throw "发行包文件名不符合 artifactName/版本规范：$($zip.FullName)" }
    }
}

Write-Output "包校验通过：$checked 个 catalog 条目，所有发行目录最多保留 3 个版本。"
