# NexusPipeline-Plugins

NexusPipeline 官方插件仓库，提供数据化专项插件的源码目录、发行包和插件商店索引。

宿主项目负责插件运行时、安装更新和 Plugin API；本仓库负责官方插件内容及插件作者的开发、校验和发布流程。宿主运行时规范以 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md) 和对应版本的实现为准，本仓库文档聚焦于插件作者的实际工作流。Frontend API 1.2、可信前端模块和 UI slot 约定见 [前端插件指南](docs/FRONTEND_PLUGIN.md)。

## 当前插件

| 机器 ID | artifactName | 游戏 | 类型 | 能力 |
|---|---|---|---|---|
| `bettergi` | `BetterGI` | 原神 | `data-specialized` | — |
| `maaend` | `MaaEnd` | 明日方舟：终末地 | `data-specialized` | `emulator` |
| `march7th` | `March7thAssistant` | 崩坏：星穹铁道 | `data-specialized` | — |
| `zzzonedragon` | `ZenlessZoneZeroOneDragon` | 绝区零 | `data-specialized` | — |
| `game-checkin` | `GameCheckIn` | 米游社 / HoYoLAB 多游戏 | `managed-code` | `user-global-management`, `user-run-events`, `user-list-badges` |
| `custom-wallpaper` | `CustomWallpaper` | 通用外观 | `managed-code` | `frontend-module` |
| `live-screenshot` | `LiveScreenshot` | 通用游戏与安卓模拟器 | `managed-code` | `frontend-module` |

宿主使用 `catalog.json` 发现可安装版本，再从固定官方仓库的 `raw.githubusercontent.com` 地址下载 `packages/` 中对应的 ZIP 发行包。插件版本与 NexusPipeline 宿主版本独立管理；`minHostVersion` 用于表达最低宿主版本要求。

## 发布规则

插件发行包直接随主分支仓库内容维护，不再创建插件 Git tag 或 GitHub Release。每个插件使用正式大小写的 artifact 名称建立源码与发行目录，并最多保留最近三个 SemVer 包：

```text
packages/<ArtifactName>/<ArtifactName>-<version>.zip
```

例如 `game-checkin` 的正式包名为 `GameCheckIn/GameCheckIn-0.1.3.zip`，`catalog.json` 的 `packageUrl` 必须精确指向对应 raw 文件。机器 ID 保持稳定的小写 kebab-case；artifact 名称用于源码目录、宿主安装目录、发行目录和 ZIP 文件名。插件平台展示最近版本的更新记录，安装入口始终使用 catalog 当前版本。

## 仓库结构

```text
NexusPipeline-Plugins/
├── catalog.json                         # 插件商店索引与包完整性信息
├── plugins/<ArtifactName>/              # 严格大小写的插件源码目录
│   ├── plugin.json                      # 元数据与入口声明
│   ├── store.json                        # 商店展示元数据与更新记录
│   ├── data/                            # data-specialized 插件资源
│   ├── web/                             # 可选 Frontend API 1.2 模块、样式和静态资源
│   └── src/                             # managed-code 插件项目
│       ├── resolve.json                 # 脚本根目录推导规则
│       ├── judge.js 或 judge.py         # 运行中完成/失败判定
│       └── config-template/             # 可选默认配置
├── packages/<ArtifactName>/             # 按正式大小写归档的发行包目录（最多 3 个版本）
│   └── <ArtifactName>-<version>.zip
└── docs/
    ├── DATA_SPECIALIZED_PLUGIN.md      # 数据化专项插件开发指南
    ├── JUDGE_SCRIPT.md                  # 判断脚本开发指南
    └── RELEASING.md                     # 打包、catalog 与包校验流程
```

发行 ZIP 的根目录直接对应运行时插件目录内容。`data-specialized` 包含 `plugin.json` 与 `data/`；`managed-code` 包含 `plugin.json`、入口 DLL 及其依赖 DLL；带前端的插件额外包含 manifest 声明的 `web/` 资源。源码目录中的文档、测试草稿和个人配置不应进入发行包。

## 快速开始

新增插件时，可以选择一个结构接近的现有插件作为起点：

1. `data-specialized` 插件在 `plugins/<ArtifactName>/` 创建 `plugin.json`、`store.json`、`data/resolve.json` 和判断脚本；`managed-code` 插件创建 `src/` 项目并引用宿主 Plugin API。
2. 数据化插件用 `require` 与 `paths` 推导脚本 profile；代码插件实现 `INexusPlugin` 生命周期并通过声明式 API 端口接入宿主。
3. 按插件类型完成本地构建、JSON 检查、运行语义和敏感数据审查。
4. 按 [数据化专项插件开发指南](docs/DATA_SPECIALIZED_PLUGIN.md)、[判断脚本指南](docs/JUDGE_SCRIPT.md) 或 [发布指南](docs/RELEASING.md) 完成对应校验。
5. 更新插件自身版本和 `store.json`，使用 `tools/Pack-Plugin.ps1 -ArtifactName <ArtifactName>` 生成包，再用 `tools/Generate-Catalog.ps1` 生成索引，最后执行 `tools/Validate-Packages.ps1`。

## 重要运行语义

- `plugin.json` 的 `name` 是脚本实例保存的稳定标识；脚本实例的专项身份来自 `PluginType`。
- 专项插件解析成功后，宿主会把主程序、参数、配置路径、日志路径和判断脚本保存到脚本实例 profile 中。
- 插件缺失、类型不匹配或运行时不可用时，相关修改入口会被服务端拒绝；解除绑定、删除脚本等清理操作仍可用。
- 判断脚本运行失败、超时或没有输出最终 JSON 时，宿主继续等待后续日志或进程退出语义，不会把脚本异常直接当作成功。
- managed-code 插件默认关闭，启用后随宿主重启加载；用户级配置、密钥、设置贡献、用户列表徽章和用户运行事件均通过 Plugin API v1.4 的通用端口处理。`game-checkin` v0.1.3 通过 `replaces: ["hoyolab-checkin"]` 迁移旧插件身份，`custom-wallpaper` v0.1.3 通过 Frontend API 1.2 管理服务端同步壁纸，`live-screenshot` v0.1.0 通过调度中心 sidecar 显示受控实时画面。
- 插件启停和安装更新遵循宿主的重启生效约定。

## 数据与安全

仓库中的配置模板必须使用公开的默认值，禁止提交账号、Token、Cookie、真实路径、用户日志或运行数据。JavaScript 判断脚本使用宿主提供的受控 Jint API；Python 判断脚本以系统 `python.exe` 子进程运行；managed-code 插件构建产物只应在发行包校验通过后进入 `packages/`。按受信任代码审查，详见 [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)。

## 贡献入口

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [DATA_SPECIALIZED_PLUGIN.md](docs/DATA_SPECIALIZED_PLUGIN.md)
- [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)
- [RELEASING.md](docs/RELEASING.md)
- [FRONTEND_PLUGIN.md](docs/FRONTEND_PLUGIN.md)
- [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md)
