# MXU 框架边界

当前 MaaEnd 沿用官方发行的 MXU；MaaStellaSora 当前使用 [MFAAvalonia](MFA_AVALONIA.md)，旧 MXU 配置按插件声明的配置修订归档并清空绑定，由用户重新设置。这里的 SavedTask 与回调规则不应用到 MFA 实例。

冷启动选择使用持久化 `enabled`。`runOnce` 不属于上游 SavedTask，也不由 importConfig 恢复；`enabledByController` 由控制器切换逻辑消费，不能直接覆盖冷启动的 enabled。已移除的控制器/资源名称按 importConfig 清除、Toolbar 回退到当前首项，再计算兼容性；不改写用户配置。`source-lock` 冻结的上游源码经原 TypeScript 纯函数核实，覆盖翻译回退、运行时选择、控制器切换和 stdout 规则。

日常任务按 frozen `task_id`、控制器/资源兼容性和真实 stdout 回调归属。正式失败终态保留为失败；已恢复的底层 ERR 噪声不能覆盖正式成功终态。任务开始但缺少结束回调、源缺口或未知启用任务不得变为未核验占位。0.2 消耗任务可以进入选择重试。

选择补丁同时更新持久 `enabled` 与当前控制器对应的 `enabledByController` 槽位，保留其他控制器与账号字段。Host 校验预期原值、journal 及恢复；控制器缓存不一致不能通过重启绕过选择范围。
