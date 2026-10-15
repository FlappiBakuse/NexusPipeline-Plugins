# 项目适配索引与最新稳定发行发现

核对日期：2026-10-14（Asia/Shanghai）。以下来自官方 GitHub Release API，排除 draft/prerelease。任务与配置规则见各项目页，验证状态统一记录在 [STATUS](../STATUS.md)。

| 项目 / 全量任务兼容清单 | 最新稳定发行 | 发布时间（UTC） |
| --- | --- | --- |
| [BAAH](BAAH.md) | [BAAH2.4.13](https://github.com/BlueArchiveArisHelper/BAAH/releases/tag/BAAH2.4.13) | 2026-09-06T13:10:22Z |
| [BetterGI](BetterGI.md) | [0.66.0](https://github.com/babalae/better-genshin-impact/releases/tag/0.66.0) | 2026-09-26T13:58:48Z |
| [March7thAssistant](March7thAssistant.md) | [v2026.10.3](https://github.com/moesnow/March7thAssistant/releases/tag/v2026.10.3) | 2026-10-03T15:59:07Z |
| [ZenlessZoneZeroOneDragon](ZenlessZoneZeroOneDragon.md) | [v2.5.3](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/releases/tag/v2.5.3) | 2026-10-11T17:11:48Z |
| [MaaEnd](MaaEnd.md) | [v2.32.0](https://github.com/MaaEnd/MaaEnd/releases/tag/v2.32.0) | 2026-10-09T18:47:55Z |
| [MaaStellaSora](MaaStellaSora.md) | [v1.6.0](https://github.com/MaaStellaSora/MaaStellaSora/releases/tag/v1.6.0) | 2026-10-10T06:05:55Z |
| [OkNTE](OkNTE.md) | [v1.4.13](https://github.com/BnanZ0/ok-nte/releases/tag/v1.4.13) | 2026-10-14T12:41:00Z |
| [OkWutheringWaves](OkWutheringWaves.md) | [v3.7.4](https://github.com/ok-oldking/ok-wuthering-waves/releases/tag/v3.7.4) | 2026-10-14T10:23:36Z |

| 框架 | 最新稳定发行 | 用途 |
|---|---|---|
| MXU | [v2.7.1](https://github.com/MistEO/MXU/releases/tag/v2.7.1) | MaaEnd 当前 GUI |
| MFAAvalonia | [v2.16.2](https://github.com/MaaXYZ/MFAAvalonia/releases/tag/v2.16.2) | MaaStellaSora 当前 GUI；maas ID 不变 |

MaaStellaSora 最新稳定发行是 v1.6.0；其 import 布局见项目任务清单。旧 MXU 绑定在 Host 启动恢复后备份清空，由用户重新设置。MaaEnd 不随之改用 MFA。

完整最近三版 SHA、资产 URL/大小/摘要见 [upstream-window](../../adapters/task-protocol/upstream-window.json)。每个项目文档逐项列出已知任务及终态、选择、配置和未知项边界。

<a id="历史发行发现与实际样本"></a>
历史发行记录以相应发行与归档证据为准，本页维护当前发现。公共契约见 [TASK_PROTOCOL](../author/TASK_PROTOCOL.md)，实际测试入口见 [TESTING](../TESTING.md)。

八个专项的路径、完成动作和 MAA 启动任务修复范围见 [配置修复覆盖表](../frameworks/COMPLETION_ACTIONS.md#当前配置修复覆盖)。无有限上游字段的项目明确标为不适用。

## 识别兼容口径

任务表覆盖中文日常入口。自定义脚本只识别已审查的外层流程，不推测任意内部业务。

已支持任务须有当前运行的闭环或正式跳过证据。无结束、日志缺口、格式失配最终失败；有权威父成功且明确子业务失败为部分完成，该范围禁止重试。Host 取消保留已确认事实，上游取消按业务失败处理；同范围内部恢复成功最终显示完成。

日常资源消耗失败参与有限重试，保持用户额度、次数、进度、总预算和取消。选择补丁受 CAS、journal、冻结计划及账号隔离保护；原配置续跑不改选择或进度。未知启用任务不能被忽略。各项目页仅维护项目专属任务和配置差异。

未知兼容内容不改变已核实的文件、目标、账号或执行权限。完全降级时沿用原入口；结果说明记录未逐项核验。选择重试保持未知选择的值、重复次数和顺序。
