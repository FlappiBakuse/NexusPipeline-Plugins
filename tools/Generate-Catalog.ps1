[CmdletBinding()]
param(
    [switch]$Verify,

    [string]$CatalogPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "catalog.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginsRoot = Join-Path $repoRoot "plugins"
$packagesRoot = Join-Path $repoRoot "packages"

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

function Test-Semver([string]$value) {
    if ($value -notmatch '^\d+\.\d+\.\d+$') {
        return $false
    }
    return @($value.Split('.') | Where-Object { $_.Length -gt 1 -and $_.StartsWith('0') }).Count -eq 0
}

function Read-StoreChangelog($store, [string]$version, [string]$artifactName) {
    if ($store.PSObject.Properties.Name -notcontains "changelog" -or $null -eq $store.changelog) {
        throw "插件 $artifactName 的 store.json 缺少 changelog"
    }
    $entries = @($store.changelog)
    if ($entries.Count -lt 1 -or $entries.Count -gt 3) {
        throw "插件 $artifactName 的 changelog 必须包含 1 至 3 个版本"
    }
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $result = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $entries.Count; $index++) {
        $entry = $entries[$index]
        $entryVersion = [string]$entry.version
        $invalidVersion = -not (Test-Semver $entryVersion) -or -not $seen.Add($entryVersion) -or ($index -eq 0 -and $entryVersion -cne $version)
        if ($invalidVersion) {
            throw "插件 $artifactName 的 changelog 版本无效或未对应当前版本"
        }
        if ($index -gt 0 -and [version]$result[$index - 1].version -le [version]$entryVersion) {
            throw "插件 $artifactName 的 changelog 必须按从新到旧排列"
        }
        $date = [string]$entry.date
        [DateTime]$parsedDate = [DateTime]::MinValue
        $invalidDate = $date -notmatch '^\d{4}-\d{2}-\d{2}$' -or -not [DateTime]::TryParseExact($date, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsedDate)
        if ($invalidDate) {
            throw "插件 $artifactName 的 changelog 日期无效：$date"
        }
        $items = @($entry.items)
        if ($items.Count -lt 1 -or $items.Count -gt 32) {
            throw "插件 $artifactName 的 changelog items 数量无效"
        }
        $normalizedItems = @($items | ForEach-Object {
            $text = [string]$_
            if ($text.Length -lt 1 -or $text.Length -gt 512 -or $text.Contains('<') -or $text.Contains('>')) {
                throw "插件 $artifactName 的 changelog 文本无效"
            }
            $text
        })
        $result.Add([pscustomobject][ordered]@{
            version = $entryVersion
            date = $date
            items = $normalizedItems
        })
    }
    return $result.ToArray()
}

function Test-HttpsUrl([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $true
    }
    if ($value.Length -gt 2048) {
        return $false
    }
    try {
        $uri = [Uri]::new($value.Trim(), [UriKind]::Absolute)
        return $uri.Scheme -ceq "https" -and -not [string]::IsNullOrWhiteSpace($uri.Host) -and [string]::IsNullOrEmpty($uri.UserInfo) -and [string]::IsNullOrEmpty($uri.Fragment)
    }
    catch {
        return $false
    }
}

function Read-PresentationMetadata($store, [string]$pluginDirectory, [string]$artifactName) {
    if ($store.PSObject.Properties.Name -notcontains "authors" -or $null -eq $store.authors) {
        throw "插件 $artifactName 的 store.json 必须提供 authors"
    }
    $authorEntries = @($store.authors)
    if ($authorEntries.Count -lt 1 -or $authorEntries.Count -gt 8) {
        throw "插件 $artifactName 的 authors 数量必须为 1 至 8"
    }
    $authors = @($authorEntries | ForEach-Object {
        $name = [string]$_.name
        $url = if ($_.PSObject.Properties.Name -contains "url") { [string]$_.url } else { "" }
        if ([string]::IsNullOrWhiteSpace($name) -or $name.Trim().Length -gt 64 -or $name.Contains('<') -or $name.Contains('>') -or -not (Test-HttpsUrl $url)) {
            throw "插件 $artifactName 的作者元数据无效"
        }
        [pscustomobject][ordered]@{ name = $name.Trim(); url = $url.Trim() }
    })

    $tags = @()
    if ($store.PSObject.Properties.Name -contains "tags") {
        $tagEntries = @($store.tags)
        if ($tagEntries.Count -gt 16) {
            throw "插件 $artifactName 的 tags 数量超过 16"
        }
        $seenTags = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        $tags = @($tagEntries | ForEach-Object {
            $tag = ([string]$_).Trim()
            if ($tag.Length -lt 1 -or $tag.Length -gt 32 -or $tag.Contains('<') -or $tag.Contains('>') -or -not $seenTags.Add($tag)) {
                throw "插件 $artifactName 的标签元数据无效"
            }
            $tag
        })
    }

    $homepage = if ($store.PSObject.Properties.Name -contains "homepage") { ([string]$store.homepage).Trim() } else { "" }
    if (-not (Test-HttpsUrl $homepage)) {
        throw "插件 $artifactName 的 homepage 必须是 HTTPS 地址"
    }
    [pscustomobject][ordered]@{
        authors = $authors
        tags = $tags
        homepage = $homepage
        hasReadme = Test-Path -LiteralPath (Join-Path $pluginDirectory "README.md")
    }
}

function New-Catalog([string]$generatedAt) {
    Assert-Path $pluginsRoot "缺少插件源码目录：$pluginsRoot"
    Assert-Path $packagesRoot "缺少插件发行目录：$packagesRoot"
    $entries = [System.Collections.Generic.List[object]]::new()
    $names = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $artifacts = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $pluginDirectories = @(Get-ChildItem -LiteralPath $pluginsRoot -Directory | Sort-Object Name)
    if ($pluginDirectories.Count -eq 0) {
        throw "plugins 目录为空"
    }
    foreach ($pluginDirectory in $pluginDirectories) {
        $manifestPath = Join-Path $pluginDirectory.FullName "plugin.json"
        $storePath = Join-Path $pluginDirectory.FullName "store.json"
        Assert-Path $manifestPath "插件目录缺少 plugin.json：$($pluginDirectory.Name)"
        Assert-Path $storePath "插件目录缺少 store.json：$($pluginDirectory.Name)"
        $manifest = Read-Json $manifestPath
        $store = Read-Json $storePath
        $schemaVersion = [int]$manifest.schemaVersion
        if ($schemaVersion -ne 2) {
            throw "插件 $($pluginDirectory.Name) 的 plugin.json schemaVersion 必须为 2"
        }
        if (-not (Test-CanonicalPluginId ([string]$manifest.name)) -or -not $names.Add([string]$manifest.name)) {
            throw "插件机器 ID 无效或重复：$($manifest.name)"
        }
        $artifactName = [string]$manifest.artifactName
        if (-not (Test-ArtifactName $artifactName) -or -not $artifacts.Add($artifactName)) {
            throw "artifactName 无效或重复：$artifactName"
        }
        if ($pluginDirectory.Name -cne $artifactName) {
            throw "插件源码目录名必须严格匹配 artifactName：$($pluginDirectory.Name) / $artifactName"
        }
        if ([int]$store.schemaVersion -ne 1) {
            throw "插件 $artifactName 的 store.json schemaVersion 必须为 1"
        }
        $version = [string]$manifest.version
        if (-not (Test-Semver $version)) {
            throw "插件 $artifactName 的版本无效：$version"
        }
        $kind = ([string]$manifest.kind).Trim().ToLowerInvariant()
        if ($kind -notin @("data-specialized", "managed-code")) {
            throw "插件 $artifactName 的类型不受支持：$kind"
        }
        if ($manifest.PSObject.Properties.Name -contains "supportsEmulator" -or $manifest.PSObject.Properties.Name -contains "replaces") {
            throw "插件 $artifactName 的 manifest 不支持历史兼容字段"
        }
        $apiVersion = if ($manifest.PSObject.Properties.Name -contains "apiVersion") { [string]$manifest.apiVersion } else { "" }
        if ($kind -eq "managed-code" -and $apiVersion -notmatch '^\d+\.\d+$') {
            throw "managed-code 插件 $artifactName 的 apiVersion 无效：$apiVersion"
        }
        $minHostVersion = if ($manifest.PSObject.Properties.Name -notcontains "minHostVersion" -or [string]::IsNullOrWhiteSpace([string]$manifest.minHostVersion)) { "0.0.0" } else { [string]$manifest.minHostVersion }
        if (-not (Test-Semver $minHostVersion)) {
            throw "插件 $artifactName 的 minHostVersion 无效：$minHostVersion"
        }
        $capabilities = @()
        if ($manifest.PSObject.Properties.Name -contains "capabilities") {
            $capabilities = @($manifest.capabilities | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
        }
        $changelog = @(Read-StoreChangelog $store $version $artifactName)
        $presentation = Read-PresentationMetadata $store $pluginDirectory.FullName $artifactName
        $packageDirectory = Join-Path $packagesRoot $artifactName
        $packageDirectories = @(Get-ChildItem -LiteralPath $packagesRoot -Directory | Where-Object { $_.Name -ceq $artifactName })
        if ($packageDirectories.Count -ne 1) {
            throw "缺少严格匹配 artifactName 的发行目录：$packageDirectory"
        }
        $packagePath = Join-Path $packageDirectory "$artifactName-$version.zip"
        Assert-Path $packagePath "缺少当前版本发行包：$packagePath"
        $archive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
        try {
            foreach ($zipEntry in $archive.Entries) {
                $entryName = $zipEntry.FullName.Replace('\', '/').TrimEnd('/')
                $invalidSegment = @($entryName.Split('/') | Where-Object { $_ -in @('', '.', '..') }).Count -gt 0
                if ($entryName.StartsWith('/') -or $invalidSegment) {
                    throw "ZIP 条目路径非法：$packagePath -> $entryName"
                }
            }
            $manifestEntry = $archive.Entries | Where-Object { $_.FullName -eq 'plugin.json' } | Select-Object -First 1
            if ($null -eq $manifestEntry) {
                throw "ZIP 根目录缺少 plugin.json：$packagePath"
            }
            $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
            try {
                $packageManifest = $reader.ReadToEnd() | ConvertFrom-Json
            }
            finally {
                $reader.Dispose()
            }
            if ($packageManifest.PSObject.Properties.Name -contains "supportsEmulator" -or $packageManifest.PSObject.Properties.Name -contains "replaces") {
                throw "ZIP manifest 不支持历史兼容字段：$packagePath"
            }
            $sourceCapabilities = if ($manifest.PSObject.Properties.Name -contains "capabilities" -and $null -ne $manifest.capabilities) {
                @($manifest.capabilities | ForEach-Object { [string]$_ } | Sort-Object -Unique)
            }
            else {
                @()
            }
            $packageCapabilities = if ($packageManifest.PSObject.Properties.Name -contains "capabilities" -and $null -ne $packageManifest.capabilities) {
                @($packageManifest.capabilities | ForEach-Object { [string]$_ } | Sort-Object -Unique)
            }
            else {
                @()
            }
            $manifestMismatch = (
                ([int]$packageManifest.schemaVersion -ne $schemaVersion) -or
                ([string]$packageManifest.name -cne [string]$manifest.name) -or
                ([string]$packageManifest.artifactName -cne $artifactName) -or
                ([string]$packageManifest.version -cne $version) -or
                (([string]$packageManifest.kind).Trim().ToLowerInvariant() -cne $kind) -or
                (($sourceCapabilities -join ([char]0x1f)) -cne ($packageCapabilities -join ([char]0x1f)))
            )
            if ($manifestMismatch) {
                throw "ZIP manifest 与源码 manifest 不一致：$packagePath"
            }
        }
        finally {
            $archive.Dispose()
        }
        $file = Get-Item -LiteralPath $packagePath
        $hash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
        $entry = [ordered]@{
            name = [string]$manifest.name
            artifactName = $artifactName
            displayName = [string]$manifest.displayName
            gameName = [string]$store.gameName
            description = [string]$manifest.description
            authors = $presentation.authors
            tags = $presentation.tags
            homepage = $presentation.homepage
            updatedAt = [string]$changelog[0].date
            hasReadme = [bool]$presentation.hasReadme
            version = $version
            kind = $kind
            apiVersion = $apiVersion
            capabilities = $capabilities
            minHostVersion = $minHostVersion
            packageUrl = "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/$artifactName/$artifactName-$version.zip"
            sha256 = $hash
            sizeBytes = [int64]$file.Length
        }
        $entry.changelog = $changelog
        $entries.Add([pscustomobject]$entry)
    }
    # The catalog is a user-facing index. Keep general-purpose plugins first,
    # then data-specialized plugins, with a deterministic machine-id order in
    # each group so generation is stable across machines and file systems.
    $orderedEntries = @($entries | Sort-Object @{ Expression = { if ([string]$_.kind -eq "data-specialized") { 1 } else { 0 } } }, @{ Expression = { [string]$_.name }; Ascending = $true })
    return [pscustomobject][ordered]@{
        schemaVersion = 2
        repository = "FlappiBakuse/NexusPipeline-Plugins"
        generatedAt = $generatedAt
        plugins = $orderedEntries
    }
}

if ($Verify) {
    Assert-Path $CatalogPath "缺少 catalog.json：$CatalogPath"
    $existing = Read-Json $CatalogPath
    $existingGeneratedAt = ([DateTimeOffset]$existing.generatedAt).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $expected = New-Catalog $existingGeneratedAt
    $actualJson = $existing | ConvertTo-Json -Depth 20 -Compress
    $expectedJson = $expected | ConvertTo-Json -Depth 20 -Compress
    if ($actualJson -cne $expectedJson) {
        throw "catalog.json 与插件 manifest/store/package 生成结果不一致"
    }
    Write-Output "catalog.json 校验通过：$(@($expected.plugins).Count) 个插件。"
    exit 0
}

$generatedAt = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$catalog = New-Catalog $generatedAt
[System.IO.File]::WriteAllText(
    $CatalogPath,
    ($catalog | ConvertTo-Json -Depth 20),
    [System.Text.UTF8Encoding]::new($false))
Write-Output "已生成 catalog.json：$(@($catalog.plugins).Count) 个插件，时间 $generatedAt。"
