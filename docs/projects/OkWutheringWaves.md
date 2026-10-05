# OkWutheringWaves 项目适配

公共规则见 [ok-script](../frameworks/OK_SCRIPT.md)；源码身份见 [source-lock](../../adapters/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

当前 0.2.0 按结构兼容与实际执行归属准入，新版本保持真实日常任务。冻结后的结构变化、活跃 worker/updater 或不可读身份阻断。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| OkWutheringWaves | DailyTask 三类体力分支、条件梦魇、隐含奖励和启用的日常附加项 | 捕获后继续的梦魇/花园/合成失败独立保留；花园已完成为已满足跳过 | 隐含步骤采用整轮日常重试，消费失败不因 safe-only 拒绝；父成功子失败为 partial 并禁止重试 |

## 当前版本与发行窗口

核对日期：2026-10-05（Asia/Shanghai）。专项源码版本 `0.2.0`，协议 `0.2.0`，最低 Host `0.16.15`。插件版本与下表上游版本独立。

| 最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [v3.7.3](https://github.com/ok-oldking/ok-wuthering-waves/releases/tag/v3.7.3) | `f5f38c8d9e2b7f7e91edad77bd5fab14df3f162d` |
| [v3.7.2](https://github.com/ok-oldking/ok-wuthering-waves/releases/tag/v3.7.2) | `b2c3af8025c28f0a128f73f8cbee77404bb1baf8` |
| [v3.6.7](https://github.com/ok-oldking/ok-wuthering-waves/releases/tag/v3.6.7) | `7df910be3b91e73be0f7a96d34fb4091510f7fac` |

资产 URL、大小和发布方摘要见 [上游窗口](../../adapters/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| 任务 ID / 分支 | 启用条件 | 识别和重试边界 |
|---|---|---|
| daily | 有效 DailyTask 配置 | 权威父任务；无独立开关，整轮重试；partial 保护 |
| nightmare：日常所需梦魇 | echo 开启且非 Tacet Suppression | 先于体力；同范围捕获错误保留 |
| nightmare：全部梦魇 | Auto Farm all Nightmare Nest | 与日常梦魇共用任务身份，不重复分母 |
| stamina：Tacet Suppression | Which to Farm 对应值 | 无音区体力流程，消耗配置不重置 |
| stamina：Forgery Challenge | Which to Farm 对应值 | 凝素领域流程，材料/关卡保留 |
| stamina：Simulation Challenge | Which to Farm 对应值 | 模拟领域流程，保留配置 |
| daily_reward | 日常内置 | 领取日常奖励；外层有效闭环且无错误可完成 |
| mail | 日常内置 | 邮件领取；缺日志不能单凭进程退出完成 |
| battle_pass | 日常内置 | 通行证奖励流程 |
| garden | Check Weekly Garden | 明确已完成可满足跳过；捕获失败仍失败 |
| merge | Merge Echo If discarded > 1000 | 条件声骸合成，合成错误保留 |
| farm_4c | Teleport and Farm 4C Echo | 需 Weekly Challenge/Boss Challenge 与正有限 Repeat Farm Count；无效配置阻断 |
| extra:<未知值> | 未知启用附加项 | 不支持，阻断日常计划，不能隐藏 |

所有隐含步骤共享 DailyTask 重试单元；不伪造单独启停字段。其执行顺序、条件与额度在发现时冻结，明确子错误与权威父成功形成部分完成；该父子范围不能整轮重跑。独立的手动 FarmEchoTask 入口与作为日常附加步骤的 farm_4c 分别处理。[生产模块](../../adapters/task-protocol/okww)。

## 配置修复

- 游戏路径：`devices.json/pc_full_path`。
- 完成动作：无可修复的有限完成动作字段；保留框架退出参数。
- 启动任务：非 MAA，无插入任务。

仅对已保存的当前用户快照逐项预览、确认和备份。字段类型错误不猜测转换；生成的 `data/editor.js` 提供修复策略；详细事务及不适用边界见 [配置编辑契约](../author/CONFIG_EDITOR.md) 与 [八专项覆盖表](../frameworks/COMPLETION_ACTIONS.md)。

单一日常检查包含唯一 `daily` 父任务及其已知子任务，所有启用子任务必须归属于该父任务。正常保存的默认 DailyTask 组合可通过；未知附加任务、结构不兼容及无法确认的 4C 次数仍阻断。
