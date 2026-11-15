# 官方插件文档

本仓维护插件业务、上游映射和包生产。Host 的权限、配置恢复与公共 SDK 由[Host 文档](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/README.md)维护。

## 按任务进入

| 任务 | 入口 |
|---|---|
| 安装和第一次使用 | [用户指南](user/README.md) |
| 接入已有自动化软件 | [八个专项](user/specialized.md) |
| 使用壁纸、活动、模拟器或 Maa | [通用插件](user/managed.md) |
| 签到、凭据和计划 | [签到指南](user/game-checkin.md) |
| 处理异常 | [用户排障](user/troubleshooting.md) |
| 第一次开发插件 | [开发入门](getting-started/development.md) |
| 协作与提交审查 | [CONTRIBUTING](../CONTRIBUTING.md) |
| AI 定位模块与检查 | [AGENTS](../AGENTS.md) → [任务地图](agents/README.md) |

## 主题与权威来源

| 主题 | 主要维护位置 | 代码或机器权威 |
|---|---|---|
| 组件、SDK 与 Host 分工 | [架构](architecture/overview.md) | `plugins`、`adapter-runtime` 与公开 SDK |
| managed 生命周期、错误与效果 | [managed 指南](authors/managed-extensions.md) | 插件 Domain/Application/Host |
| 专项四阶段、发现与 CAS | [专项指南](authors/specialized-adapters.md) | `adapter`、`sources.json`、`extension.json` |
| 上游身份与预期依据 | [上游依据](reference/upstream-oracles.md) | 对应 `upstream.json`；本页只索引 |
| 共享 UI 与前端状态 | [前端开发](development/frontend.md) | `frontend/src`、`frontend-ui`、公开 SDK |
| SDK 导入、切片、本地化与包 | [构建](development/building.md) | `tooling`、`contracts/sdk-source-lock.json` |
| 场景选择、运行命令与结果范围 | [验证](development/validation.md) | `tests` 与现役 runner |
| Maa 专项与直驱的覆盖归属 | [Maa 覆盖](reference/maa-coverage.md) | 各自 sources 与 compiler/worker |
| 图标来源 | [脚本图标](reference/script-icons.md) | 各插件资源和 manifest |
| PR、候选与 Publisher | [发行](operations/release.md) | `.github/workflows`、`tooling` |
| 待验证资格 | [当前状态](status.md) | 各轮源码/包绑定的原始回执 |

## 项目参考

每个项目页维护自身输入、任务、日志、配置和支持限制；共用协议通过链接引用。manifest 和上游锁维护精确版本与来源。

| 项目 | 代码根 | 业务参考 |
|---|---|---|
| BAAH | `plugins/specialized/baah` | [BAAH](projects/baah.md) |
| BetterGI | `plugins/specialized/bettergi` | [BetterGI](projects/bettergi.md) |
| MaaEnd | `plugins/specialized/maaend` | [MaaEnd](projects/maaend.md) |
| MaaStellaSora | `plugins/specialized/maas` | [MaaS](projects/maas.md) |
| March7thAssistant | `plugins/specialized/march7th` | [March7th](projects/march7th.md) |
| OkNTE | `plugins/specialized/oknte` | [OkNTE](projects/oknte.md) |
| OkWW | `plugins/specialized/okww` | [OkWW](projects/okww.md) |
| ZzzOneDragon | `plugins/specialized/zzzonedragon` | [绝区零](projects/zzzonedragon.md) |
| EmulatorSupport | `plugins/managed/emulator-support` | [模拟器](projects/emulator-support.md) |
| GameActivities | `plugins/managed/game-activities` | [活动](projects/game-activities.md) |
| GameCheckIn | `plugins/managed/game-checkin` | [签到](projects/game-checkin.md) |
| MaaFrameworkDriver | `plugins/managed/maa-framework` | [Maa 直驱](projects/maa-framework.md) |
| CustomWallpaper / LiveScreenshot | 各 `plugins/managed/<id>` | [用户任务](user/managed.md)与各自随包 README |

`plugins/*/*/README.md` 服务源码模块和包内使用，双语 changelog 服务发行读者；保留可独立读取的最小内容。`tests/host-fixtures/README.md` 说明 Host 原包集成的显式编译输入。

## 维护规则

- README 只保留插件用途、选择和入口；开发流程归 CONTRIBUTING；AGENTS 只保留持续执行约束与路由。
- 初次教学放 `getting-started`，作者任务放 `authors`，组件原理放 `architecture`，工具/验证放 `development`，跨项目事实参考放 `reference`，插件专属语义留 `projects`，发行流程归 `operations`，用户任务归 `user`。
- 改公共接口检查 Host 权威与实际镜像；改模块边界检查架构；改命令检查构建/验证；改发行检查 operations；改用户操作更新对应用户页及必要随包说明。只同步受影响主题。
- 重要且长期改变依赖、信任、持久格式或恢复分工时，在 `docs/decisions/<主题>.md` 记录有依据的背景、选择、原因与后果。当前不补造历史 ADR，也不建立空目录。
- 模块有独立任务、复杂协议或生命周期时增加项目/模块页并接入本索引；仅有独立执行规则时才增加子 AGENTS。
- schema 镜像、SDK 身份、本地化 JSON、bundle、manifest 投影和 catalog 由现役 producer 生成；不手写 API 全集、摘要清单或测试方法计数。
- 先查唯一主题归属，再新增页面；其他位置以相对链接连接，迁移时同步跨仓入口。上游锁变化更新对应语义向量，不在多个入口复制版本/SHA 表。
- 当前事实给代码或配置依据；固定源码研究、受控组件、安装 Host、真实账号/厂商和正式发行各自记录资格。历史 PASS 保留原身份，未完成项集中在 status。

分类参考 [Diátaxis](https://diataxis.fr/)；读者与贡献入口参考 [GitHub Docs](https://github.com/github/docs)、[VS Code](https://github.com/microsoft/vscode) 和 [Kubernetes Community](https://github.com/kubernetes/community)。
