# BetterGI 项目适配

公共契约见[任务协议](../author/TASK_PROTOCOL.md)。本适配器使用 0.2.0 / daily-flow-v1，最低 Host 0.16.15。

发现按 TaskDefinitions、TaskOrder、TaskEnabledList 和 NextTaskId 冻结可执行顺序。任务使用 GUID 或旧配置键作身份；同名任务不合并。NextTaskId 只限定本轮计划，选择重试仍按冻结任务和 CAS 补丁复核。

观察读取文件日志的多行信封：时间、级别、logger、运行上下文与下一条消息跨批保存；来源和 epoch 隔离，重复 sequence 不重复推进。OneDragonFlowViewModel 的一条龙/配置组序号分别在冻结的内置任务/配置组顺序中定位任务。TaskRunner 的 finally 结束行只闭合流程，不抹除该范围 ERR；ScriptService 的配置组结束使用相同规则。当前原粹树脂不足的 INFO 正常结束仍算流程完成。外层整轮结束不补齐缺少任务终态的任务。

日常失败和缺失终态均可进入有限选择重试，不因消耗资源或旧 retryRisk 停止；已成功项保持关闭。所有选择变更经 Host CAS、journal、重新发现及恢复。预算、资源额度和账号配置不由适配器重置。

上游审查基线包括 0.66.0 的 OneDragonFlowViewModel、TaskRunner、ScriptService 和 GoToAdventurersGuildTask。

生产源位于 adapters/task-protocol/bettergi，生成 data/discover.js、judge.js、retry.js；不直接编辑生成产物。现役有限轨迹入口见[测试命令](../TESTING.md)。

## 当前版本与发行窗口

核对日期：2026-10-05（Asia/Shanghai）。专项源码版本 `0.4.0`，协议 `0.2.0`，最低 Host `0.16.15`。插件版本与下表上游版本独立。

| 最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [0.66.0](https://github.com/babalae/better-genshin-impact/releases/tag/0.66.0) | `0af68c28f6b0e714d5304625ce644736d508022e` |
| [0.65.0](https://github.com/babalae/better-genshin-impact/releases/tag/0.65.0) | `f29b0828ab4f8f91d9087152dcb487719e80fa16` |
| [0.64.0](https://github.com/babalae/better-genshin-impact/releases/tag/0.64.0) | `f0cd4fe90d22e9b1fcb3f6b4b61fe6131773410e` |

资产 URL、大小和发布方摘要见 [上游窗口](../../adapters/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| 任务 | 当前识别 | 失败与重试 |
|---|---|---|
| 领取邮件 | 邮箱领取流程；无可领取内容仍以正常闭环判断 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 合成树脂 | 合成流程；不重置树脂额度 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 自动秘境 | 自动秘境的任务范围；原粹树脂不足的 INFO 正常闭环仍完成 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 自动首领讨伐 | 首领外层任务；领奖上限和跨运行次数仍由原配置控制 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 自动幽境危战 | 外层自动战斗范围；不独立识别内部节点/难度分支 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 自动地脉花 | 地脉外层任务；消耗次数保留 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 领取每日奖励 | 每日奖励流程；不以历史奖励状态补当前终态 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 领取尘歌壶奖励 | 尘歌壶领取流程；无内容可领取的正常闭环可完成 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |
| 用户配置组 / 自定义名称 | 按冻结 GUID/旧键和配置组序号识别；同名不合并；只判外层闭环 | 范围 ERR 未恢复即失败；选择重试，成功项保持关闭 |

内置任务从 OneDragonFlowViewModel 冻结顺序定位，ScriptService 的配置组使用独立序号。任务名称变化、重复日志、跨批消息和嵌套 finally 均不能越过范围归属。现代 TaskDefinitions/TaskOrder 与旧 TaskEnabledList 均可读取；未知 NextTaskId 不猜造成功。发现、日志信封与选择规则见 [生产模块](../../adapters/task-protocol/bettergi)。

## 配置修复

- 游戏路径：附加快照 `genshinStartConfig.installPath`。
- 完成动作：主快照 `CompletionAction` 保留空/无/关闭游戏/关闭软件/关闭游戏和软件，其余字符串改无。
- 启动任务：非 MAA，无插入任务。

仅对已保存的当前用户快照逐项预览、确认和备份。字段类型错误不猜测转换；生成的 `data/editor.js` 提供修复策略；详细事务及不适用边界见 [配置编辑契约](../author/CONFIG_EDITOR.md) 与 [八专项覆盖表](../frameworks/COMPLETION_ACTIONS.md)。
