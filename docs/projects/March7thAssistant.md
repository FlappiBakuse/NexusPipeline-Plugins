# March7thAssistant 项目适配

公共规则见 [公共任务协议](../author/TASK_PROTOCOL.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| March7thAssistant | config.yaml 与上游默认值，13 个一级入口、奖励/活动/资产/历战子开关；父禁用抑制子任务 | 日常目标、宇宙固定次数、当前运行未刷新；奖励子模块的明确完成或无可领奖励均为成功；模块明确失败 | native_resume 保留原配置、额度、日期和进度；固定次数/日期不当作成功日志 |

| 适配器 | 当前运行边界依据 |
|---|---|
| March7thAssistant | game.stop 的“停止运行”一级标题，位于可选退出/循环/暂停之前；顶层“发生错误”记录异常结束。启动和各模块也输出“完成”，不能据此结束整轮 |

M7 云游戏模式不比较本地游戏路径。`after_finish: Loop` 会使上游在 Host 配置恢复前继续循环，因此即使是队列末项也阻断；普通暂停与 Host 清理不冲突，不要求用户强制关闭游戏或脚本。

## 已审查源码分支与反例

- March7th 日常/宇宙、日周月刷新和奖励子模块独立建模。随机内部补做不会扩大冻结的业务范围；培养目标属于技术角色。奖励总包装完成、保存时间戳、历史分数不能替代子模块日志。命名奖励模块的“奖励完成”和明确“未检测到奖励”表示领取检查已成功完成，无需实际领到物品；所有已启用必需奖励子任务满足后，领取奖励父任务才汇总成功。

- March7th `InstanceNotCompleted` 从有效配置模板经 `Base.send_notification_with_screenshot` 逐行写入 INFO，随后才截图和发送 ERROR 级通知。四个已核实失败分支记录当前 source/epoch、父任务、目标副本和内部执行序号；首次失败保留 open 问题事件，不提前重启整项任务。连续三次重试耗尽且退出范围才形成失败；相同目标的显式重试、完整轮次和目标次数证据才能恢复对应事件。另一副本成功、通用完成横幅、历史时间戳不能洗掉失败。历战余响与活动调用独立归属；无法确定范围时保留 unattributed_error，不猜给清体力。

- 默认关闭的签到 [日志桥原型](../../tools/march7th-bridge/README.md) 独立于专项 ZIP；它不表示官方安装版已支持静默分支。

## 日常入口与资源范围

当前 Host 启动默认 main：`game.start → Daily.start → reward.start → game.stop`。`routine` 只执行 `prepare_daily(ignore_refresh=True)` 和奖励，不包含全部资产、周常及挑战；不能把两种入口视为等价。原配置续跑保留时间戳、完成次数和体力计划，不重置每日额度；上游尚未刷新的任务以正常跳过记录。错误时间戳本身不证明完成。

资源观察覆盖自塑尘脂合成的完成/失败/上限、余烬商品的购买/售罄/未完成、光锥叠加异常与 Daily.start 返回。光锥单轮“继续查找”不作为整个任务终态。资产未结束、缺少适用子任务收尾或显式失败会失败并允许原配置续跑。活动日历通知属于技术步骤；活动检测的正常返回可以闭合条件检查，未检测到活动记为不适用。

## 当前版本与发行窗口

核对日期：2026-10-04（Asia/Shanghai）。专项源码版本 `0.3.2`，协议 `0.2.0`，最低 Host `0.16.14`。插件版本与下表上游版本独立。

| 最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [v2026.10.3](https://github.com/moesnow/March7thAssistant/releases/tag/v2026.10.3) | `04b14f43570a361a5289f5ad7982e06ffe1f72d7` |
| [v2026.9.30](https://github.com/moesnow/March7thAssistant/releases/tag/v2026.9.30) | `5bbe11c4a1e799b89258dd01cf8d30837eadb32f` |
| [v2026.9.25](https://github.com/moesnow/March7thAssistant/releases/tag/v2026.9.25) | `e3eb9fc844bdf8a4e6672eb261563f5c31c550ba` |

资产 URL、大小和发布方摘要见 [上游窗口](../../tools/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| 配置键 | 任务 | 已知识别 / 限制 | 重试 |
|---|---|---|---|
| daily_enable | 每日实训 | 日常范围正常结束；单独历史分数/目标达标不补闭环 | 原配置续跑；保留日期、次数与额度 |
| power_enable | 清体力 | 范围+副本目标+执行序号；未恢复体力失败保留；历战未到执行日可跳过 | 原配置续跑；保留日期、次数与额度 |
| universe_enable | 模拟宇宙/差分宇宙 | 固定次数完成、零次或本周期次数满足；本轮未完成为失败 | 原配置续跑；保留日期、次数与额度 |
| weekly_divergent_enable | 差分宇宙积分奖励 | 已登记；识别未刷新/多轮仍未完成；独立正常成功边界不足时最终失败 | 原配置续跑；保留日期、次数与额度 |
| currencywars_enable | 货币战争积分奖励 | 当前模块标题与对应完成横幅；未刷新可跳过 | 原配置续跑；保留日期、次数与额度 |
| fight_enable | 锄大地 | 当前模块标题与对应完成横幅；未刷新可跳过 | 原配置续跑；保留日期、次数与额度 |
| forgottenhall_enable | 忘却之庭 | 当前模块标题与对应完成横幅；未刷新可跳过 | 原配置续跑；保留日期、次数与额度 |
| purefiction_enable | 虚构叙事 | 当前模块标题与对应完成横幅；未刷新可跳过 | 原配置续跑；保留日期、次数与额度 |
| apocalyptic_enable | 末日幻影 | 当前模块标题与对应完成横幅；未刷新可跳过 | 原配置续跑；保留日期、次数与额度 |
| asset_manager_enable | 资产管理 | 全部启用资产子项终态汇总，缺项或失败则失败 | 原配置续跑；保留日期、次数与额度 |
| reward_enable | 领取奖励 | 领取奖励外层闭环与所有必需子任务；包装器结束不掩盖子项缺口 | 原配置续跑；保留日期、次数与额度 |
| activity_enable | 活动 | 活动检测外层和条件检查；无活动可跳过，活动处理异常保留 | 原配置续跑；保留日期、次数与额度 |
| build_target_enable | 培养目标 | 技术步骤，不计业务分母；不作为其他任务成功凭证 | 不独立触发业务重试 |
| echo_of_war_enable | 历战余响 | 范围+副本目标+执行序号；未恢复体力失败保留；历战未到执行日可跳过 | 原配置续跑；保留日期、次数与额度 |
| reward_assist_enable | 支援奖励 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_mail_enable | 邮件奖励 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_dispatch_enable | 委托奖励 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_quest_enable | 实训奖励 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_srpass_enable | 无名勋礼 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_achievement_enable | 成就奖励 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_message_enable | 短信奖励 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| reward_redemption_code_enable | 兑换码 | 命名奖励结束/当前无奖励；兑换码依其独立范围，缺终态失败 | 原配置续跑；保留日期、次数与额度 |
| asset_self_molding_resin_enable | 自塑尘脂合成 | 合成完成/达到上限；合成失败明确失败；未刷新正常跳过 | 原配置续跑；保留日期、次数与额度 |
| asset_lc3_star_superimpose_enable | 3星光锥叠加 | 开始后 Daily.start 返回且无异常才闭合；单次“继续查找”不结束 | 原配置续跑；保留日期、次数与额度 |
| asset_ember_special_pass_enable | 星轨专票兑换 | 按商品名购买完成/售罄/未刷新；未完成不记录时间并失败 | 原配置续跑；保留日期、次数与额度 |
| asset_ember_regular_pass_enable | 星轨通票兑换 | 按商品名购买完成/售罄/未刷新；未完成不记录时间并失败 | 原配置续跑；保留日期、次数与额度 |
| asset_ember_tracks_of_destiny_enable | 命运的足迹兑换 | 按商品名购买完成/售罄/未刷新；未完成不记录时间并失败 | 原配置续跑；保留日期、次数与额度 |
| activity_dailycheckin_enable | 活动签到 | 活动检测外层和条件检查；无活动可跳过，活动处理异常保留 | 原配置续跑；保留日期、次数与额度 |
| activity_gardenofplenty_enable | 花藏繁生 | 活动检测外层和条件检查；无活动可跳过，活动处理异常保留 | 原配置续跑；保留日期、次数与额度 |
| activity_realmofthestrange_enable | 异器盈界 | 活动检测外层和条件检查；无活动可跳过，活动处理异常保留 | 原配置续跑；保留日期、次数与额度 |
| activity_planarfissure_enable | 位面分裂 | 活动检测外层和条件检查；无活动可跳过，活动处理异常保留 | 原配置续跑；保留日期、次数与额度 |
| activity_journey_highlights_notification_enable | 旅途拾忆通知 | 技术步骤，不计业务分母；不作为其他任务成功凭证 | 不独立触发业务重试 |

该表逐项列出 13 个一级入口与已知子开关。默认 main 与 routine 不等价；未出现独立成功证据的周常不能因整轮结束被补成完成。[生产模块](../../tools/task-protocol/march7th)。

旧配置中的 weekly_relic_smart_discard_enable、divergent_auto_save_enable、fight_reward_enable 与 notify_qmsg_enable 属于已知辅助/历史开关，不作为独立业务任务或未知启用任务阻断日常发现。原字节与开关值保留，原配置续跑不重置它们；真正未知的启用任务仍不静默忽略。

## 配置修复

- 游戏路径：`config.yaml/game_path`；云游戏启用时不改。
- 完成动作：`after_finish` 保留 None/Exit 及已识别中文无操作/退出，其余字符串（包括 RunScript）改 None。
- 启动任务：非 MAA，无插入任务。

仅对已保存的当前用户快照逐项预览、确认和备份。字段类型错误不猜测转换；生成的 `data/editor.js` 提供修复策略；详细事务及不适用边界见 [配置编辑契约](../author/CONFIG_EDITOR.md) 与 [八专项覆盖表](../frameworks/COMPLETION_ACTIONS.md)。
