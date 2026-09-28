# BetterGI 项目适配

公共规则见 [公共任务协议](../TASK_PROTOCOL.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| BetterGI | GUID/旧任务名、TaskDefinitions、显式 TaskOrder；缺省顺序回退开关键；NextTaskId 限定本轮 | 邮件领取/空邮件；地脉明确失败、协会领取异常和合成树脂异常；地脉不在运行日期；整轮结束仅为边界 | 无一次性游标时，独立邮件或每日奖励失败项；重复名称、未知任务、消耗资源均保守停止 |

| 适配器 | 当前运行边界依据 |
|---|---|
| BetterGI | 一条龙和配置组任务结束 |

## 已审查源码分支与反例

- BetterGI `OneDragonFlowViewModel.LoadDisplayTaskListFromConfig` 使用非空 TaskOrder 作为完整可执行顺序，遗漏的开关键不自动追加执行；现代结构缺失定义也不执行。一次性 NextTaskId 在内存中清空，当前适配器对带游标计划停止自动重试。TaskRunner/外层返回可吞内部异常，只有独立规则证明的业务事实才计成功。

- BetterGI 锁定版本的 `AutoLeyLineOutcropTask.Start` 在“自动地脉花执行失败”之后抛异常；`GoToAdventurersGuildTask.Start` 的 `_retryTimes = 1`，因此协会异常也是终止失败，并映射到“领取每日奖励”。`OneDragonTaskItem` 捕获的树脂异常仍须报告业务失败。这些规则仅在当前选择中名称唯一时归属，重复名字不任选第一个；后续整轮结束不覆盖失败。匹配命名消息边界，不把引用或堆栈提及当成该任务日志。当前修复不代表已有完整开始、成功或内部恢复覆盖；未来上游改变重试次数必须重审。

- BetterGI 官方 [0.65.0 `OneDragonTaskItem`](https://github.com/babalae/better-genshin-impact/blob/0.65.0/BetterGenshinImpact/Model/OneDragonTaskItem.cs) 将“领取每日奖励”独立挂到 `TaskEnabledList`，依次执行冒险家协会与纪行领取；[`GoToAdventurersGuildTask`](https://github.com/babalae/better-genshin-impact/blob/0.65.0/BetterGenshinImpact/GameTask/Common/Job/GoToAdventurersGuildTask.cs) 对已领每日奖励及探索派遣有状态检查，[`OneDragonFlowViewModel`](https://github.com/babalae/better-genshin-impact/blob/0.65.0/BetterGenshinImpact/ViewModel/Pages/OneDragonFlowViewModel.cs) 以 GUID、TaskOrder 和开关执行。故仅在名称唯一、无一次性 NextTaskId 且收到该项明确失败时，按独立开关重试每日奖励；已成功邮件和无证据尘歌壶项不纳入。真实账号行为仍未验证；版本变化须复核幂等性。
