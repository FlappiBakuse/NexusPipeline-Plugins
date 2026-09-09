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

`plugin.json` 与运行时数据继续使用稳定的小写机器标识；源码目录按类型位于 `plugins/general/<ArtifactName>/` 或 `plugins/specialized/<ArtifactName>/`，宿主安装目录保持 `plugins/<ArtifactName>/`，`packages/` 下的目录和 ZIP 使用 artifactName 的正式大小写。schema 2 manifest 的 `artifactName` 必须与分类源码目录的末级目录完全一致。

## 发行包布局

```text
packages/
├── BetterGI/BetterGI-0.1.1.zip
├── CustomWallpaper/
│   ├── CustomWallpaper-0.1.2.zip
│   ├── CustomWallpaper-0.1.3.zip
│   └── CustomWallpaper-0.1.5.zip
├── GameCheckIn/GameCheckIn-0.1.7.zip
├── LiveScreenshot/LiveScreenshot-0.1.0.zip
├── MaaEnd/MaaEnd-0.1.1.zip
├── March7thAssistant/March7thAssistant-0.1.1.zip
└── ZenlessZoneZeroOneDragon/ZenlessZoneZeroOneDragon-0.1.1.zip
```

发行 ZIP 的根目录直接对应运行时插件目录内容：

```text
plugin.json
data/resolve.json
data/judge.js 或 data/judge.py
web/main.js
web/style.css
```

managed-code 插件还包含入口 DLL、Plugin API 依赖 DLL 和所需 JSON 运行时文件。包不包含 `src/`、测试文件、`obj/`、调试符号或用户数据；包内包含 `store.json`，有插件说明时包含 `README.md`。

## 发布前准备

确认以下内容：

- `plugin.json` 的 `name`、`version`、`kind` 与目标条目一致；
- managed-code 插件的 `entryAssembly`、`entryType`、API 版本和依赖输出有效；
- `frontend-module` 的入口、样式和 Frontend API 版本有效，公开资源位于 `web/`；
- data-specialized 插件的 resolve、judgeScript 以及可选 configValidator/configEditor 均位于 `data/`；
- ZIP 不包含账号、Token、Cookie、用户配置、日志、缓存或仓库外文件；
- catalog 的 `artifactName`、版本、raw packageUrl、SHA256、大小和 changelog 与包一致。

## 增量发行流程

发行工具入口为 `python tools/repository.py`。发布计划使用 `.release-state.json` 的 `sourceCommit` 作为基线，再读取当前提交到该基线之间的 Git 变更。`github.event.before` 不参与发行完整性判断。

本地可以执行：

```text
python tools/repository.py validate
python tools/repository.py validate-source
python tools/repository.py check-syntax
python -m unittest discover -s tools/tests -v
python tools/repository.py plan --baseline auto --output .generated/release-plan.json
python tools/repository.py test --plan .generated/release-plan.json
python tools/repository.py release --plan .generated/release-plan.json --output .generated
python tools/repository.py validate-generated --generated-root .generated
```

`release-plan.json` 是同一次发行中唯一的受影响插件清单。计划列出 `changed`、`deleted`、`requiresPackage`、`managed`、变更原因和精确清理路径；release 不会重新推断另一套插件集合。

`validate-source` 用于在 PR 候选 catalog 尚未生成时校验当前源码、JSON、分类目录和宿主锁；`validate` 还会校验当前 catalog 与已存在发行包。

普通发行的处理边界如下：

1. 只读取受影响插件的源码并构建其新版本；
2. 只为新版本 ZIP 计算 SHA256；
3. 未变更 catalog entry 原样保留，未变更 ZIP 不读取；
4. catalog 只替换受影响 entry、移除已删除插件并稳定排序；
5. retention 只扫描受影响 artifact 目录；
6. 同一 `(artifactName, version)` 的 ZIP 内容不同会立即失败。

源码从旧的平铺目录迁移到分类目录时，规划器会比较迁移前后的插件身份、版本和 Git tree。内容完全相同的纯 relocation 不要求 SemVer bump，不生成 ZIP，不计算 SHA，也不修改 catalog entry，只推进发行状态；迁移同时包含 payload 变化时按正常版本发行规则处理，必须提升插件版本。

新 ZIP 完成结构校验后统一生成 `PackageMetadata`，catalog、release state 和候选物校验复用同一份 SHA256 与大小事实。普通发行不会再次读取新 ZIP 计算 SHA；全仓重新计算仍由 `audit --full` 负责。

工具、文档、工作流和宿主锁变化会触发契约检查与测试，既有 SemVer 包不会因此重建。managed-code 构建使用 `host.lock.json` 指定的 NexusPipeline 提交；GitHub Actions 将两个仓库 checkout 到同级目录，插件 `.csproj` 使用分类源码布局对应的固定兄弟仓库相对路径，不随 CI workspace 改写。

## 发行状态

`.release-state.json` 使用当前 schema：

```json
{
  "schemaVersion": 1,
  "sourceCommit": "<last-successful-source-commit>",
  "released": {
    "BetterGI": {
      "name": "bettergi",
      "artifactName": "BetterGI",
      "version": "0.2.5",
      "sha256": "<64 位小写十六进制>",
      "sizeBytes": 6955,
      "sourceTree": "<git tree sha>"
    }
  }
}
```

初次建立状态时，工具从现有 catalog 导入 `version`、`sha256` 和 `sizeBytes`，读取 Git tree fingerprint；不会为了 bootstrap 重新读取所有 ZIP。状态只在成功候选物应用后推进。

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
      "displayName": "自定义壁纸",
      "gameName": "通用外观",
      "description": "同步管理 NexusPipeline 的多张自定义壁纸、随机轮换、显示效果和自适应配色。",
      "authors": [],
      "tags": ["外观", "壁纸", "主题"],
      "homepage": "https://github.com/FlappiBakuse/NexusPipeline-Plugins/tree/main/plugins/general/CustomWallpaper",
      "updatedAt": "2026-08-29",
      "hasReadme": true,
      "version": "0.1.5",
      "kind": "managed-code",
      "apiVersion": "1.5",
      "capabilities": ["frontend-module"],
      "minHostVersion": "0.11.9",
      "packageUrl": "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/CustomWallpaper/CustomWallpaper-0.1.5.zip",
      "sha256": "<64 位小写十六进制>",
      "sizeBytes": 30783,
      "changelog": [
        {
          "version": "0.1.5",
          "date": "2026-08-29",
          "items": ["设置页迁移至宿主统一自定义控件层，壁纸卡片与内嵌卡片保持统一显示效果。"]
        }
      ]
    }
  ]
}
```

完整条目还包含 `displayName`、`gameName`、`description`、`authors`、`tags`、`homepage`、`updatedAt`、`hasReadme`、`kind`、`apiVersion`、`capabilities` 和 `minHostVersion`；存在本地化元数据时还包含 `locales`，其中每种语言的展示字段和 changelog 版本必须与基础记录对应。

约束如下：

- `name` 为小写 kebab-case 机器 ID，最多 64 字符；
- `artifactName` 为 ASCII 字母/数字，首字符为字母，至少包含一个大写字母，最多 64 字符；
- 同一 catalog 内机器标识和 artifactName 均不区分大小写重复；
- raw packageUrl 必须严格位于官方仓库 `main/packages/` 下，并与 artifactName 和 version 完全匹配；
- `changelog` 包含 1 至 3 条记录，第一条是当前版本，后续记录按 SemVer 从新到旧排列；日期使用 `YYYY-MM-DD`，条目文本不含 HTML；
- SHA256 使用最终 ZIP 的 64 位小写十六进制摘要，`sizeBytes` 使用最终 ZIP 的实际字节数。

宿主与仓库当前均要求 catalog schemaVersion 2 和官方 raw 包地址。

## 校验层级

```text
python tools/repository.py validate
```

校验源码、manifest、store、data-specialized 引用、catalog 集合和包路径元数据。它不会为未变更插件重新计算 ZIP SHA256。

```text
python tools/repository.py audit --full
```

Full Audit 由手动触发或每周计划任务运行。当前 catalog 包必须通过 SHA256、大小、ZIP 路径安全、manifest、store 和 retention 校验；历史存档包检查 ZIP 完整性、路径安全、文件名和 manifest，保留早期发行物的既有格式。发现损坏时报告失败，保留现场供人工调查。

Pull Request 工作流拒绝直接提交 `catalog.json`、`.release-state.json` 和 `packages/`。合并后的 main 发布工作流使用 concurrency coalescing，从最新 main 和最近成功发行状态重新规划；Bot commit 的生成路径不触发下一轮发布。
