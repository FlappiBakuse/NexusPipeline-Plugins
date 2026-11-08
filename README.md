# NexusPipeline 官方插件

为 NexusPipeline 提供脚本接入、游戏签到、活动信息、外观和运行辅助。插件不包含游戏；八个专项也不包含上游自动化软件。普通用户不需要 Node、.NET SDK 或自行构建。

本文档包对应本地开发候选：Host 0.18.0、官方插件 0.5.0、SDK 0.1.0。源码版本不代表已正式发布或已经通过真实平台验收。用户先读[安装与第一次使用](docs/user/README.md)；开发人员查阅[本轮行为对齐表](docs/developer/behavior-targets.md)。

## 选择插件

| 插件 | ID | 用途与前提 | 从哪里使用 |
|---|---|---|---|
| [自定义壁纸](docs/user/managed.md#customwallpaper) | `custom-wallpaper` | 管理背景图片、轮换和显示效果 | 应用设置 |
| [模拟器支持扩展](docs/user/managed.md#emulatorsupport) | `emulator-support` | 已安装雷电、夜神或 BlueStacks；选择准确实例 | 支持 Android 的脚本目标设置 |
| [游戏活动](docs/user/managed.md#gameactivities) | `game-activities` | 订阅支持的游戏及区服，查看活动与倒计时 | 概览卡片 |
| [游戏签到](docs/user/game-checkin.md) | `game-checkin` | 为自己的平台账号建立签到任务 | 游戏签到页面 |
| [实时截图窗口](docs/user/managed.md#livescreenshot) | `live-screenshot` | 查看当前运行绑定的游戏或模拟器画面 | 正在运行的任务 |
| [MaaFramework 框架直驱](docs/user/managed.md#maaframework) | `maa-framework` | 已有受支持的 MaaFramework 项目与资源 | 脚本及账号绑定编辑区 |
| [蔚蓝档案爱丽丝助手](docs/user/specialized.md#baah) | `baah` | 已安装 BAAH，并保存账号配置 | 专项脚本与账号绑定 |
| [更好的原神](docs/user/specialized.md#bettergi) | `bettergi` | 已安装 BetterGI，并保存一条龙配置 | 专项脚本与账号绑定 |
| [终末地小助手](docs/user/specialized.md#maaend) | `maaend` | 已安装 MaaEnd，并选定自动启动实例 | 专项脚本与账号绑定 |
| [星塔助手](docs/user/specialized.md#maastellasora) | `maas` | 已安装 MaaStellaSora，并保存实例配置 | 专项脚本与账号绑定 |
| [三月七小助手](docs/user/specialized.md#march7thassistant) | `march7th` | 已安装 March7thAssistant，保留 Launcher 与 Assistant | 专项脚本与账号绑定 |
| [ok-nte 日常](docs/user/specialized.md#oknte) | `oknte` | 已安装 ok-nte，配置日常事项 | 专项脚本与账号绑定 |
| [ok-ww 日常](docs/user/specialized.md#okww) | `okww` | 已安装 ok-ww，配置日常事项 | 专项脚本与账号绑定 |
| [绝区零一条龙](docs/user/specialized.md#zzzonedragon) | `zzzonedragon` | 已安装绝区零一条龙，选择单一账号实例 | 专项脚本与账号绑定 |

## 开始使用

1. 在 Host 的插件页面选择需要的插件，核对版本、来源和前置条件后安装、启用。
2. 按界面提示完成重启，再前往上表列出的入口。
3. 专项先核对已有上游配置、账号与任务；通用插件先完成一个最小设置。首次快照与主动读取的区别见用户入口。
4. 先查看一次手动操作的实际结果，再启用计划。结果待确认时先核对原结果，不重复触发外部动作。

当前候选已实现 BAAH 日志及修复、OkNTE 日常入口、签到失败留窗和共用设置分类，等待统一定向验证。用户可见影响列在[使用入口](docs/user/README.md#本地候选的已知差异)，开发目标和证据集中在[行为对齐表](docs/developer/behavior-targets.md)。

## 开发入口

- [作者入门](docs/authors/README.md)：选择最小改动路径与实际构建入口。
- [开发与验证规则](docs/developer/validation.md)：先完成本批全部代码，再统一定向验证。
- [Agents 任务地图](docs/agents/change-map.md)：代码 owner、事实源和最低验证范围。
- [完整文档导航](docs/README.md)：用户、作者、开发者与 Agent 分流。

自有代码与文档的许可证见 [LICENSE](LICENSE)。插件引用的上游和第三方运行时保留各自许可，Maa 的原生运行时按包内声明交付。
