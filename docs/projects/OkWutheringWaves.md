# OkWutheringWaves 项目适配

公共规则见 [ok-script](../frameworks/OK_SCRIPT.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

项目高级业务规则以 `tools/task-protocol/source-lock.json` 的本款／本渠道身份为边界。新发行基础资格成立时仅受限运行，保留未核验项，不执行旧高级观察器和选择重试。启动器驻留不单独判失败；实际 worker／updater 或不可读身份仍阻断相关配置恢复。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| OkWutheringWaves | DailyTask 三类体力分支、条件梦魇、隐含奖励和启用的日常附加项 | 捕获后继续的梦魇/花园/合成失败独立保留；花园已完成为已满足跳过 | 隐含步骤缺少独立开关，整轮重跑安全性未证明时停止 |
