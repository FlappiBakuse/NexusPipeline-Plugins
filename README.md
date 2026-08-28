# NexusPipeline-Plugins

NexusPipeline 官方插件仓库，提供数据化专项插件的源码目录、发行包和插件商店索引。

宿主项目负责插件运行时、安装更新和 Plugin API；本仓库负责官方插件内容及插件作者的开发、校验和发布流程。宿主运行时规范以 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md) 和对应版本的实现为准，本仓库文档聚焦于插件作者的实际工作流。

## 当前插件

| 插件 | 游戏 | 类型 | 能力 |
|---|---|---|---|
| `bettergi` | 原神 | `data-specialized` | — |
| `maaend` | 明日方舟：终末地 | `data-specialized` | `emulator` |
| `march7th` | 崩坏：星穹铁道 | `data-specialized` | — |
| `zzzonedragon` | 绝区零 | `data-specialized` | — |

宿主使用 `catalog.json` 发现可安装版本，再从 GitHub Release 下载 `packages/` 中对应的 ZIP 发行包。插件版本与 NexusPipeline 宿主版本独立管理；`minHostVersion` 用于表达最低宿主版本要求。

## 仓库结构

```text
NexusPipeline-Plugins/
├── catalog.json                         # 插件商店索引与包完整性信息
├── plugins/<name>/                      # 插件源码目录
│   ├── plugin.json                      # 元数据与 data 文件引用
│   └── data/
│       ├── resolve.json                 # 脚本根目录推导规则
│       ├── judge.js 或 judge.py         # 运行中完成/失败判定
│       └── config-template/             # 可选默认配置
├── packages/<name>-<version>.zip        # 发行包
└── docs/
    ├── DATA_SPECIALIZED_PLUGIN.md      # 数据化专项插件开发指南
    ├── JUDGE_SCRIPT.md                  # 判断脚本开发指南
    └── RELEASING.md                     # 打包、catalog 与 Release 流程
```

发行 ZIP 的根目录直接对应插件目录内容：`plugin.json` 位于 ZIP 根，`data/` 位于 ZIP 根下。源码目录中的文档、测试草稿和个人配置不应进入发行包。

## 快速开始

新增数据化专项插件时，可以选择一个结构接近的现有插件作为起点：

1. 在 `plugins/<name>/` 创建 `plugin.json`、`data/resolve.json` 和 `data/judge.js` 或 `data/judge.py`。
2. 用 `require` 定义脚本根目录的识别条件，用 `paths` 推导主程序、启动参数、配置和日志路径。
3. 编写判断脚本：证据不足时保持无输出，确认完成后输出规范 JSON。
4. 如首次编辑需要默认配置，加入 `data/config-template/`。
5. 按 [数据化专项插件开发指南](docs/DATA_SPECIALIZED_PLUGIN.md) 和 [判断脚本指南](docs/JUDGE_SCRIPT.md) 完成本地检查。
6. 更新插件自身版本和 `catalog.json`，然后按 [发布指南](docs/RELEASING.md) 生成并校验发行包。

## 重要运行语义

- `plugin.json` 的 `name` 是脚本实例保存的稳定标识；脚本实例的专项身份来自 `PluginType`。
- 专项插件解析成功后，宿主会把主程序、参数、配置路径、日志路径和判断脚本保存到脚本实例 profile 中。
- 插件缺失、类型不匹配或运行时不可用时，相关修改入口会被服务端拒绝；解除绑定、删除脚本等清理操作仍可用。
- 判断脚本运行失败、超时或没有输出最终 JSON 时，宿主继续等待后续日志或进程退出语义，不会把脚本异常直接当作成功。
- 插件启停和安装更新遵循宿主的重启生效约定。

## 数据与安全

仓库中的配置模板必须使用公开的默认值，禁止提交账号、Token、Cookie、真实路径、用户日志或运行数据。JavaScript 判断脚本使用宿主提供的受控 Jint API；Python 判断脚本以系统 `python.exe` 子进程运行，按受信任代码审查，详见 [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)。

## 贡献入口

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [DATA_SPECIALIZED_PLUGIN.md](docs/DATA_SPECIALIZED_PLUGIN.md)
- [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)
- [RELEASING.md](docs/RELEASING.md)
- [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md)
