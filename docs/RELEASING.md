# 插件打包与发行包指南

NexusPipeline-Plugins 的插件版本、发行包和 catalog 必须保持同一份可校验的事实。宿主通过 catalog 的包地址、SHA256、大小、manifest 和最低宿主版本判断是否可以安装。

## 发行模型

stable 发行物由受信 Publisher App 写入 `main`；develop preview 使用固定的 `plugins-develop` GitHub Release。两条通道的 catalog、缓存和来源元数据隔离，preview 不写 stable 的 `catalog.json`、`.release-state.json` 或 `packages/`。

每个插件最多保留最近三个受限版本包。版本格式为 `major.minor.patch`、`major.minor.patch-beta.N` 或 `major.minor.patch-rc.N`，排序遵循 `beta < rc < stable`。旧包保留在仓库中作为发行存档，插件平台只展示和安装 catalog 当前版本，不提供旧版本选择或降级入口。

机器标识与发行 artifact 分离：

| 机器标识 | artifactName |
|---|---|
| `baah` | `BAAH` |
| `bettergi` | `BetterGI` |
| `maaend` | `MaaEnd` |
| `maastellasora` | `MaaStellaSora` |
| `march7th` | `March7thAssistant` |
| `zzzonedragon` | `ZenlessZoneZeroOneDragon` |
| `game-checkin` | `GameCheckIn` |
| `custom-wallpaper` | `CustomWallpaper` |
| `live-screenshot` | `LiveScreenshot` |

`plugin.json` 与运行时数据继续使用稳定的小写机器标识；源码目录按类型位于 `plugins/general/<ArtifactName>/` 或 `plugins/specialized/<ArtifactName>/`，宿主安装目录保持 `plugins/<ArtifactName>/`，`packages/` 下的目录和 ZIP 使用 artifactName 的正式大小写。schema 2 manifest 的 `artifactName` 必须与分类源码目录的末级目录完全一致。

## 发行包布局

```text
packages/
├── BAAH/BAAH-<version>.zip
├── BetterGI/BetterGI-<version>.zip
├── CustomWallpaper/CustomWallpaper-<version>.zip
├── GameCheckIn/GameCheckIn-<version>.zip
├── LiveScreenshot/LiveScreenshot-<version>.zip
├── MaaEnd/MaaEnd-<version>.zip
├── MaaStellaSora/MaaStellaSora-<version>.zip
├── March7thAssistant/March7thAssistant-<version>.zip
└── ZenlessZoneZeroOneDragon/ZenlessZoneZeroOneDragon-<version>.zip
```

每个 artifact 目录保留该插件最近三个受限版本包；`catalog.json` 只描述当前版本，归档包不提供安装入口。

stable 发行 ZIP 的根目录直接对应运行时插件目录内容：

```text
plugin.json
data/resolve.json
data/judge.js 或 data/judge.py
web/main.js                         # 仅 managed-code 且声明 frontend 时
web/style.css                       # 仅 managed-code 且声明 frontend 时
```

`data-specialized` 只包含 `plugin.json`、`store.json`、`data/`、`i18n/` 和说明文件，不得包含 `frontend/`、`web/`、浏览器载荷或 .NET 程序集。managed-code 插件还包含入口 DLL、Plugin API 依赖 DLL 和所需 JSON 运行时文件；带前端的 managed 插件才额外包含 manifest 声明的 `web/` 资源。包不包含 `src/`、测试文件、`obj/`、调试符号或用户数据。

## 发布前准备

确认以下内容：

- `plugin.json` 的 `name`、`version`、`kind` 与目标条目一致；
- managed-code 插件的 `entryAssembly`、`entryType`、API 版本和依赖输出有效；
- `frontend-module` 的入口、样式和 Frontend API 版本有效，公开资源位于 `web/`；
- data-specialized 插件的 resolve、judgeScript 以及可选 configValidator/configEditor 均位于 `data/`，能力仅来自三个 Host 白名单且无 `frontend` 字段；
- ZIP 不包含账号、Token、Cookie、用户配置、日志、缓存或仓库外文件；
- catalog 的 `artifactName`、版本、raw packageUrl、SHA256、大小和 changelog 与包一致。

## 增量发行流程

发行工具入口为 `python tools/repository.py`。发布计划使用 `.release-state.json` 的 `sourceCommit` 作为基线，再读取当前提交到该基线之间的 Git 变更。`github.event.before` 不参与发行完整性判断。

本地可以执行固定的 P1/P2/P3：

```text
python tools/repository.py qualification --group source --base main --host-root ..\NexusPipeline
python tools/repository.py qualification --group frontend-managed --host-root ..\NexusPipeline
python tools/repository.py qualification --group candidate --base main --host-root ..\NexusPipeline

# develop preview，只生成并校验本地候选，不写 stable
python tools/repository.py publish-develop --source-ref develop --output .generated/preview
```

发布工作流把生成的 catalog 与 package 纳入主分支后，再运行 `python tools/repository.py validate` 核对主分支源码、catalog 和发行包集合。

`release-plan.json` 是同一次发行中唯一的受影响插件清单。计划列出 `changed`、`deleted`、`requiresPackage`、`managed`、变更原因和精确清理路径；release 不会重新推断另一套插件集合。

`validate-source` 用于在 PR 或新插件候选的 catalog 尚未生成时校验当前源码、JSON、分类目录和宿主锁。`validate` 还会校验当前 catalog 集合与已存在发行包，因此只有 catalog/packages 已包含当前源码版本时才能通过；新插件或新版本进入候选时，源码阶段应先运行 `validate-source`，生成候选物后运行 `validate-generated`，正式发布流水线更新 catalog/packages 后再运行 `validate`。

`host.lock.json` 只记录 `hostApiVersion`、`frontendApiVersion` 和 `supportedLocales`。每次 Qualification 的 preflight 通过 `tools/sdk_source.py` 固定官方 Host 的完整 `sdkSourceSha`，所有 P1/P2/P3 使用同一隔离 checkout；不接受旧的 repository/ref 锁或任意 URL。`validate-host-locales` 仍可作为独立诊断。

普通发行的处理边界如下：

1. 只读取受影响插件的源码并构建其新版本；
2. 只为新版本 ZIP 计算 SHA256；
3. 未变更 catalog entry 原样保留，未变更 ZIP 不读取；
4. catalog 只替换受影响 entry、移除已删除插件并稳定排序；
5. retention 只扫描受影响 artifact 目录；
6. 同一 `(artifactName, version)` 的 ZIP 内容不同会立即失败。

源码从旧的平铺目录迁移到分类目录时，规划器会比较迁移前后的插件身份、版本和 Git tree。内容完全相同的纯 relocation 不要求受限版本递增，不生成 ZIP，不计算 SHA，也不修改 catalog entry，只推进发行状态；迁移同时包含 payload 变化时按正常版本发行规则处理，必须提升插件版本。

新 ZIP 完成结构校验后统一生成 `PackageMetadata`，catalog、release state 和候选物校验复用同一份 SHA256 与大小事实。普通发行不会再次读取新 ZIP 计算 SHA；全仓重新计算仍由 `audit --full` 负责。

工具、文档、工作流和兼容元数据变化会触发契约检查和 Qualification；既有 SemVer 包不会因此重建。SDK checkout 的来源 SHA 会写入资格关联和候选计划。`catalog.json`、`packages/` 与 `.release-state.json` 由受信发布器生成，不手工填写包摘要或发行事实。

## 模拟器支持真实设备验证

雷电、夜神和 BlueStacks 的厂商探测及驱动属于 `EmulatorSupport` 插件。发行该插件前，须在真实设备上逐项验证实例身份与 ADB 端点关联、应用启动、前台查询、截图、应用停止和实例安全关闭；host System Smoke 的 managed-code fixture 只验证宿主 API/provider 跨边界调用。

| 模拟器 | 设备验证范围 | 当前状态 |
|---|---|---|
| 雷电 | 实例枚举与 ADB 端点映射；启动、前台查询、截图、应用停止与安全关闭 | 待真实设备 |
| 夜神 | VM/实例身份与 ADB 端点映射；启动、前台查询、截图、应用停止与安全关闭 | 待真实设备 |
| BlueStacks | 实例身份与 ADB 端点映射；启动、前台查询、截图、应用停止与安全关闭 | 待真实设备 |

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
      "version": "<version>",
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
  "generatedAt": "2026-09-12T00:00:00Z",
  "plugins": [
    {
      "name": "custom-wallpaper",
      "artifactName": "CustomWallpaper",
      "displayName": "自定义壁纸",
      "gameName": "通用外观",
      "description": "同步管理 NexusPipeline 的多张自定义壁纸、随机轮换、显示效果和自适应配色。",
      "authors": [{ "name": "FlappiBakuse", "url": "https://github.com/FlappiBakuse" }],
      "tags": ["外观", "壁纸", "主题"],
      "homepage": "https://github.com/FlappiBakuse/NexusPipeline-Plugins/tree/main/plugins/general/CustomWallpaper",
      "updatedAt": "<yyyy-mm-dd>",
      "hasReadme": true,
      "version": "<version>",
      "kind": "managed-code",
      "apiVersion": "1.6",
      "capabilities": ["frontend-module"],
      "minHostVersion": "0.15.9",
      "packageUrl": "https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/CustomWallpaper/CustomWallpaper-0.2.2.zip",
      "sha256": "<64 位小写十六进制>",
      "sizeBytes": 30783,
      "changelog": [
        {
          "version": "<version>",
          "date": "<yyyy-mm-dd>",
          "items": [
            "壁纸运行时改为插件级生命周期：不进入设置页面也会应用壁纸与配色，离开设置页面后壁纸、配色与轮换计时保持运行，只有插件停用才清理全局外观。",
            "启动轮换改为由插件启动生命周期执行一次，打开或离开设置页面不再改变当前壁纸；按时间轮换在任意页面继续生效。"
          ]
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
- `changelog` 包含 1 至 3 条记录，第一条是当前版本，后续记录按受限版本从新到旧排列；日期使用 `YYYY-MM-DD`，条目文本不含 HTML；
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

Full Audit 只由手动入口触发，不参与每次 PR/main 资格。当前 catalog 包必须通过 SHA256、大小、ZIP 路径安全、manifest、store 和 retention 校验；历史存档包检查 ZIP 完整性、路径安全、文件名和 manifest，保留早期发行物的既有格式。发现损坏时报告失败，保留现场供人工调查。

Pull Request 工作流拒绝直接提交 `catalog.json`、`.release-state.json` 和 `packages/`。stable publisher 使用 `.release-state.json.sourceCommit` 追踪已发布游标，写入前校验资格关联、不可变包、精确生成物白名单和远端快进；develop preview 使用不可变包名和最后切换 catalog 的顺序，不删除旧 preview 资产。

## 校验工作流

本地 `qualification` 命令固定执行 P1/P2/P3；正式 PR 资格工作流必须执行全部 Gate，不使用 changed-path skip：

| Gate | 运行环境 | 内容 |
|---|---|---|
| `P1` | 固定的源 checkout/SDK | source contracts、locale、syntax、Config Editors、Python tests、PR base 检查 |
| `P2` | 固定的 managed/Frontend 环境 | `npm ci`、Frontend conformance/typecheck/build、managed-code 全量构建测试 |
| `P3` | 隔离候选目录 | base 版本纪律、candidate plan、全量发行包验证、stable 文件未修改 |

`tools/qualification.py` 负责本地编排，`tools/sdk_source.py` 负责一次解析并固定 SDK 来源；`tools/qualification_control.py`（部署后）负责外部 App Check 的 fail-closed 聚合。手动 `audit --full` 只作完整包诊断，不替代 P1/P2/P3，也不自动改变 stable 状态。
