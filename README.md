# NexusPipeline-Plugins

NexusPipeline 官方插件仓库，提供 managed-code 与 data-specialized 插件的源码目录、发行包和插件商店索引。

宿主项目负责插件运行时、安装更新和 Plugin API；本仓库负责官方插件内容及插件作者的开发、校验和发布流程。宿主运行时规范以 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md) 和对应版本的实现为准，本仓库文档聚焦于插件作者的实际工作流。Frontend API 1.3、插件本地化、前端模块和 UI slot 约定见 [前端插件指南](docs/FRONTEND_PLUGIN.md)。

## 当前插件

| 机器 ID | artifactName | 游戏 | 类型 | 能力 |
|---|---|---|---|---|
| `baah` | `BAAH` | 蔚蓝档案 | `data-specialized` | `emulator` |
| `bettergi` | `BetterGI` | 原神 | `data-specialized` | — |
| `maaend` | `MaaEnd` | 明日方舟：终末地 | `data-specialized` | `emulator` |
| `maastellasora` | `MaaStellaSora` | 星塔旅人 | `data-specialized` | `emulator` |
| `march7th` | `March7thAssistant` | 崩坏：星穹铁道 | `data-specialized` | — |
| `zzzonedragon` | `ZenlessZoneZeroOneDragon` | 绝区零 | `data-specialized` | — |
| `game-checkin` | `GameCheckIn` | 米游社 / HoYoLAB 多游戏 | `managed-code` | `user-global-management`, `user-run-events`, `user-list-badges` |
| `custom-wallpaper` | `CustomWallpaper` | 通用外观 | `managed-code` | `frontend-module` |
| `live-screenshot` | `LiveScreenshot` | 通用游戏与安卓模拟器 | `managed-code` | `frontend-module`, `execution-preview-client` |

宿主使用 `catalog.json` 发现可安装版本，再从固定官方仓库的 `raw.githubusercontent.com` 地址下载 `packages/` 中对应的 ZIP 发行包。插件版本与 NexusPipeline 宿主版本独立管理；`minHostVersion` 用于表达最低宿主版本要求。`.release-state.json` 记录最近一次成功发行的源码树与包事实，`host.lock.json` 固定 managed-code 构建使用的宿主提交。

## 插件本地化资源

需要前端或宿主插件上下文文案时，可在 `plugin.json` 的 `localization` 中声明 `i18n/*.json` 资源。locale 使用规范化 BCP 47 形式，`defaultLocale` 必须有对应文件；所有语言资源必须拥有相同的 key 集合和占位符集合，值必须是非空字符串，禁止使用 `legacy.*` key。数据化专项插件的 `resolve.json.inputs` 可用 `labelKey` 与 `descriptionKey` 引用同一份插件词典，`label` 与 `description` 作为回退文本。仓库校验会检查路径边界、文件大小、key/value 数量和占位符一致性。

## 发布规则

插件发行包直接随主分支仓库内容维护，不再创建插件 Git tag 或 GitHub Release。源码按插件类型分为 `plugins/general/` 与 `plugins/specialized/`，每个插件使用正式大小写的 artifact 名称建立末级源码目录与发行目录，并最多保留最近三个 SemVer 包。相同 `(artifactName, version)` 的 ZIP 内容不可覆盖；普通发布只生成受影响插件的新版本包。

```text
packages/<ArtifactName>/<ArtifactName>-<version>.zip
```

例如 `game-checkin` 的正式包名为 `GameCheckIn/GameCheckIn-0.1.4.zip`，`catalog.json` 的 `packageUrl` 必须精确指向对应 raw 文件。机器 ID 保持稳定的小写 kebab-case；artifact 名称用于分类源码目录的末级目录、宿主安装目录、发行目录和 ZIP 文件名。源码路径、安装路径与发行路径分别为 `plugins/{general|specialized}/<ArtifactName>/`、`plugins/<ArtifactName>/` 和 `packages/<ArtifactName>/`。插件平台展示最近版本的更新记录，安装入口始终使用 catalog 当前版本。

## 仓库结构

```text
NexusPipeline-Plugins/
├── catalog.json                         # 插件商店索引与包完整性信息
├── plugins/
│   ├── general/<ArtifactName>/          # managed-code 通用插件源码
│   │   ├── plugin.json                  # 元数据与入口声明
│   │   ├── store.json                    # 商店展示元数据与更新记录
│   │   ├── web/                          # 可选 Frontend API 1.3 模块、样式和静态资源
│   │   ├── i18n/                         # 可选 zh-CN/en-US 插件词典
│   │   └── src/                          # managed-code 插件项目（.csproj 与 C# 源码）
│   └── specialized/<ArtifactName>/      # data-specialized 专项插件源码
│       ├── plugin.json                  # 元数据与入口声明
│       ├── store.json                    # 商店展示元数据与更新记录
│       ├── data/                         # data-specialized 插件资源
│       │   ├── resolve.json              # 脚本根目录推导规则
│       │   ├── judge.js 或 judge.py      # 运行中完成/失败判定
│       │   └── config-editor.js          # 可选配置编辑准备脚本
│       ├── web/                          # 可选 Frontend API 1.3 模块、样式和静态资源
│       └── i18n/                         # 可选 zh-CN/en-US 插件词典
├── packages/<ArtifactName>/             # 按正式大小写归档的发行包目录（最多 3 个版本）
│   └── <ArtifactName>-<version>.zip
├── .release-state.json                  # 最近一次成功发行状态
├── host.lock.json                       # managed-code 宿主提交锁
├── tools/
│   ├── repository.py                    # 发行计划、增量打包与审计入口
│   ├── repository_core.py               # 可测试的仓库规则实现
│   └── tests/                           # 仓库工具单元测试
└── docs/
    ├── DATA_SPECIALIZED_PLUGIN.md      # 数据化专项插件开发指南
    ├── JUDGE_SCRIPT.md                  # 判断脚本开发指南
    └── RELEASING.md                     # 打包、catalog 与包校验流程
```

发行 ZIP 的根目录直接对应运行时插件目录内容。`data-specialized` 包含 `plugin.json`、`store.json` 与 `data/`；`managed-code` 包含 `plugin.json`、`store.json`、入口 DLL 及其依赖 DLL；带前端的插件额外包含 manifest 声明的 `web/` 资源和 `README.md`。源码目录中的测试草稿和个人配置不应进入发行包。

## 快速开始

新增插件时，可以选择一个结构接近的现有插件作为起点：

1. `data-specialized` 插件在 `plugins/specialized/<ArtifactName>/` 创建 `plugin.json`、`store.json`、`data/resolve.json` 和判断脚本；`managed-code` 插件在 `plugins/general/<ArtifactName>/` 创建 `src/` 项目并引用宿主 Plugin API。
2. 数据化插件用 `require` 与 `paths` 推导运行时 profile；代码插件实现 `INexusPlugin` 生命周期并通过声明式 API 端口接入宿主。
3. 按插件类型完成本地构建、JSON 检查、运行语义和敏感数据审查。
4. 按 [数据化专项插件开发指南](docs/DATA_SPECIALIZED_PLUGIN.md)、[判断脚本指南](docs/JUDGE_SCRIPT.md) 或 [发布指南](docs/RELEASING.md) 完成对应校验。
5. 更新插件自身版本和 `store.json`，运行 `python tools/repository.py validate`、`python tools/repository.py plan` 和对应测试。Pull Request 只提交源码与元数据；合并后发布工作流依据发行状态生成受影响插件的包、catalog 与状态文件。

## 重要运行语义

- `plugin.json` 的 `name` 是脚本实例保存的稳定标识；脚本实例的专项身份来自 `PluginType`。
- 专项脚本实例在 `scripts.json` 中保存 `PluginType + RootPath` 等稳定声明；宿主在 API 展示、准入、配置编辑和运行时解析当前插件 profile。主程序、参数、配置路径、日志路径和判断脚本属于插件运行时资产，每次新运行或编辑都会自动使用当前版本。
- 已触发的调度 occurrence 会冻结当时的有效运行计划；尚未触发的 occurrence 在触发时重新解析当前插件。插件变更 `configPath` 或文件/目录形态时，新位置缺失会阻断本次运行并保留旧用户快照；新位置存在时宿主按当前配置重新建立该用户唯一快照并更新当前元数据，插件发布说明应明确标注这类影响。
- 插件缺失、类型不匹配或运行时不可用时，相关修改入口会被服务端拒绝；解除绑定、删除脚本等清理操作仍可用。
- 数据化插件可通过 `configEdit` 与 `configEditor` 声明多候选配置的编辑隔离和工作副本调整；宿主在保存、取消及恢复时还原 `edit-isolation` 现场。
- 判断脚本运行失败、超时或没有输出最终 JSON 时，宿主继续等待后续日志或进程退出语义，不会把脚本异常直接当作成功。
- managed-code 插件默认关闭，启用后随宿主重启加载；用户级配置、密钥、设置贡献、用户列表徽章、用户运行事件和插件本地化均通过 Plugin API v1.5 的通用端口处理。`game-checkin` v0.1.9 使用全局用户、用户运行事件和本地化能力，`custom-wallpaper` v0.1.10 通过 Frontend API 1.3 管理服务端同步壁纸，`live-screenshot` v0.1.4 通过 `execution-preview-client` 能力接入宿主统一的受控实时画面。
- 插件启停和安装更新遵循宿主的重启生效约定。

## 数据与安全

仓库中的 JSON、脚本和其他公开资源必须使用公开的默认值，禁止提交账号、Token、Cookie、真实路径、用户日志或运行数据。JavaScript 判断脚本使用宿主提供的受控 Jint API；Python 判断脚本以系统 `python.exe` 子进程运行；managed-code 插件构建产物只应在发行包校验通过后进入 `packages/`。插件前端与发行包内容应在发布前完成代码审查，详见 [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)。

## 贡献入口

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [DATA_SPECIALIZED_PLUGIN.md](docs/DATA_SPECIALIZED_PLUGIN.md)
- [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)
- [RELEASING.md](docs/RELEASING.md)
- [FRONTEND_PLUGIN.md](docs/FRONTEND_PLUGIN.md)
- [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md)
