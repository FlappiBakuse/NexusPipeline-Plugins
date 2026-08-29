# 插件打包与发行包指南

NexusPipeline-Plugins 的插件版本、发行包和 catalog 必须保持同一份可校验的事实。宿主通过 catalog 的包地址、SHA256、大小、manifest 和最低宿主版本判断是否可以安装。

## 发行模型

插件发行包直接随 `main` 分支维护。本仓库不再为插件创建 Git tag 或 GitHub Release，宿主从固定官方 raw 地址下载 catalog 和 ZIP。

每个插件最多保留最近三个数值 SemVer 包。旧包保留在仓库中作为发行存档，插件平台只展示和安装 catalog 当前版本，不提供旧版本选择或降级入口。

机器标识与发行 artifact 分离：

| 机器标识 | artifactName |
|---|---|
| `bettergi` | `BetterGI` |
| `maaend` | `MaaEnd` |
| `march7th` | `March7thAssistant` |
| `zzzonedragon` | `ZenlessZoneZeroOneDragon` |
| `game-checkin` | `GameCheckIn` |
| `custom-wallpaper` | `CustomWallpaper` |
| `live-screenshot` | `LiveScreenshot` |
| 历史 `hoyolab-checkin` | `HoYoLABCheckIn` |

`plugin.json` 与运行时数据继续使用稳定的小写机器标识；源码目录、宿主安装目录、`packages/` 下的目录和 ZIP 使用 artifactName 的正式大小写。schema 2 manifest 的 `artifactName` 必须与源码目录完全一致。

## 发行包布局

```text
packages/
├── BetterGI/BetterGI-0.1.1.zip
├── CustomWallpaper/
│   ├── CustomWallpaper-0.1.1.zip
│   ├── CustomWallpaper-0.1.2.zip
│   └── CustomWallpaper-0.1.3.zip
├── GameCheckIn/GameCheckIn-0.1.3.zip
├── LiveScreenshot/LiveScreenshot-0.1.0.zip
├── HoYoLABCheckIn/
│   ├── HoYoLABCheckIn-0.1.0.zip
│   └── HoYoLABCheckIn-0.1.1.zip
├── MaaEnd/MaaEnd-0.1.1.zip
├── March7thAssistant/March7thAssistant-0.1.1.zip
└── ZenlessZoneZeroOneDragon/ZenlessZoneZeroOneDragon-0.1.1.zip
```

发行 ZIP 的根目录直接对应运行时插件目录内容：

```text
plugin.json
data/resolve.json
data/judge.js 或 data/judge.py
data/config-template/...
web/main.js
web/style.css
```

managed-code 插件还包含入口 DLL、Plugin API 依赖 DLL 和所需 JSON 运行时文件。包不包含 `src/`、README、测试文件、`obj/`、调试符号或用户数据。

## 发布前准备

确认以下内容：

- `plugin.json` 的 `name`、`version`、`kind` 与目标条目一致；
- managed-code 插件的 `entryAssembly`、`entryType`、API 版本和依赖输出有效；
- `frontend-module` 的入口、样式和 Frontend API 版本有效，公开资源位于 `web/`；
- data-specialized 插件的 resolve、judgeScript 和模板均位于 `data/`；
- ZIP 不包含账号、Token、Cookie、用户配置、日志、缓存或仓库外文件；
- catalog 的 `artifactName`、版本、raw packageUrl、SHA256、大小和 changelog 与包一致。

## 标准流程

在仓库根目录执行：

```powershell
# 生成指定插件的包；managed-code 插件会先以 Release 配置构建
pwsh -NoProfile -File tools\Pack-Plugin.ps1 -ArtifactName CustomWallpaper

# 从各插件的 manifest、store.json 和当前 ZIP 生成 catalog
pwsh -NoProfile -File tools\Generate-Catalog.ps1

# 检查 catalog 是否仍可由源数据重建
pwsh -NoProfile -File tools\Generate-Catalog.ps1 -Verify

# 校验 catalog、目录命名、每个包的 SHA256/大小、ZIP 路径和 manifest
pwsh -NoProfile -File tools\Validate-Packages.ps1
```

`Pack-Plugin.ps1` 会：

1. 校验 manifest schema、机器 ID、artifactName 和版本；
2. 构建 managed-code 插件，或复制 data-specialized 插件资源；
3. 生成根目录带 `plugin.json` 的 ZIP；
4. 拒绝覆盖同一 SemVer 下内容不同的既有 ZIP；
5. 按数值 SemVer 在对应 artifact 目录保留最近三个 ZIP。

`Generate-Catalog.ps1` 扫描 `plugins/<ArtifactName>/plugin.json`、`store.json` 和 `packages/<ArtifactName>/<ArtifactName>-<version>.zip`，生成 catalog 的展示字段、包地址、SHA256、大小和时间。`catalog.json` 是可重建的索引，新增插件与版本由各插件目录提供事实输入。

脚本在临时目录完成构建和压缩，结束后清理暂存内容。包写入 `packages/<ArtifactName>/` 后，必须再次运行全量校验。

## catalog.json schemaVersion 2

```json
{
  "schemaVersion": 2,
  "repository": "FlappiBakuse/NexusPipeline-Plugins",
  "generatedAt": "2026-08-29T00:00:00Z",
  "plugins": [
    {
      "name": "custom-wallpaper",
      "artifactName": "CustomWallpaper",
      "version": "0.1.3",
      "packageUrl": "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/CustomWallpaper/CustomWallpaper-0.1.3.zip",
      "sha256": "<64 位小写十六进制>",
      "sizeBytes": 30783,
      "changelog": [
        {
          "version": "0.1.2",
          "date": "2026-08-29",
          "items": ["随机轮换、透明度和主题行为更新。"]
        }
      ]
    }
  ]
}
```

完整条目还包含 `displayName`、`gameName`、`description`、`kind`、`apiVersion`、`capabilities`、`minHostVersion` 和可选的 `replaces`。

约束如下：

- `name` 为小写 kebab-case 机器 ID，最多 64 字符；
- `artifactName` 为 ASCII 字母/数字，首字符为字母，至少包含一个大写字母，最多 64 字符；
- 同一 catalog 内机器标识和 artifactName 均不区分大小写重复；
- raw packageUrl 必须严格位于官方仓库 `main/packages/` 下，并与 artifactName 和 version 完全匹配；
- `changelog` 包含 1 至 3 条记录，第一条是当前版本，后续记录按 SemVer 从新到旧排列；日期使用 `YYYY-MM-DD`，条目文本不含 HTML；
- SHA256 使用最终 ZIP 的 64 位小写十六进制摘要，`sizeBytes` 使用最终 ZIP 的实际字节数。

宿主仍兼容旧缓存中的 catalog schemaVersion 1 和 GitHub Release URL；仓库当前事实使用 schemaVersion 2 和 raw 包地址。

## 本地核对

```powershell
# JSON 语法
Get-Content -Raw -LiteralPath catalog.json | ConvertFrom-Json | Out-Null
Get-ChildItem -LiteralPath plugins -Recurse -Filter *.json |
  ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null }

# 查看指定包内容
tar -tf packages\CustomWallpaper\CustomWallpaper-0.1.1.zip

# 全量包校验
pwsh -NoProfile -File tools\Validate-Packages.ps1
```

校验结果必须确认 ZIP 根有 `plugin.json`，manifest 与 catalog 的名称/版本一致，包路径安全，摘要和大小一致，并且每个 artifact 目录最多有三个版本。

## 仓库维护核对

- 新版本先更新对应插件的 manifest/store，再生成 `packages/<ArtifactName>/` 中的新 ZIP 和 catalog；
- 不创建新的插件 tag 或 GitHub Release；
- 历史插件 Release/Tag 的清理属于仓库迁移维护动作，应在所有包迁移、下载复核和远端备份确认后执行；
- 修改 ZIP 内容、压缩顺序或包元数据后必须重新生成 SHA256 和 `sizeBytes`；
- 宿主插件页应能显示当前版本、兼容性、更新状态和 catalog 中的更新记录。
