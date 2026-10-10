# NexusPipeline-Plugins 文档门户

文档按责任分类。当前源码行为以本仓库契约和测试为准；正式发行以 catalog 和发行记录为准；真实游戏资格单独记录。机器导航见 [map.json](map.json)。

## 插件作者：author/

| 任务 | 权威文档 |
|---|---|
| manifest、能力、resolve、快照和破坏性修订 | [数据化专项](author/DATA_SPECIALIZED_PLUGIN.md) |
| 任务发现、只读诊断、日志观察、重试和报告 | [任务协议](author/TASK_PROTOCOL.md) |
| editor 准备、修复提案、生成及写入权限 | [配置编辑](author/CONFIG_EDITOR.md) |
| 上游源码审查、模块生成、夹具和 Jint 验证 | [适配开发](author/TASK_ADAPTERS.md) |
| 未声明 taskProtocol 的旧式 judge | [旧式判断接口](author/JUDGE_SCRIPT.md) |
| managed 浏览器扩展、公共元素和 Frontend API | [前端插件](author/FRONTEND_PLUGIN.md) |

## 框架：frameworks/

[MXU](frameworks/MXU.md)、[MFAAvalonia](frameworks/MFA_AVALONIA.md)、[ok-script](frameworks/OK_SCRIPT.md) 分别维护原生配置和执行差异。[MaaFrameworkDriver](frameworks/MAAFRAMEWORK_DRIVER.md) 是独立 managed 直驱能力，不替换专项 GUI。

[完成动作与修复覆盖](frameworks/COMPLETION_ACTIONS.md) 汇总八专项字段及安全边界，项目页维护任务级细节。

## 项目：projects/

[项目索引](projects/README.md) 提供固定日期的上游稳定发行发现与全部已知任务清单。每页区分任务登记、终态证据、重试和真实游戏 NOT_RUN；共同识别口径仅在索引维护，避免八份重复定义漂移。

## 开发与发行

[贡献指南](../CONTRIBUTING.md) 说明源码和开发流程；[核心测试](TESTING.md) 说明现役 runner、固定输入、预算及原生报告；[发行指南](RELEASING.md) 维护候选、preview/stable 和发布验证；[状态](STATUS.md) 只记录尚未完成或未验证事项。

宿主公开接口见 [Host Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/reference/plugin-api/README.md)。Plugin API 2.2、Frontend API 1.7、taskProtocol 0.2.0 和各插件版本独立管理。

- [GameActivities 使用、来源与限制](../plugins/general/GameActivities/README.md)
