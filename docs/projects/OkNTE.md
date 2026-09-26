# OkNTE 项目适配

公共规则见 [ok-script](../frameworks/OK_SCRIPT.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

项目高级业务规则以 `tools/task-protocol/source-lock.json` 的本款／本渠道身份为边界。新发行基础资格成立时仅受限运行，保留未核验项，不执行旧高级观察器和选择重试。启动器驻留不单独判失败；实际 worker／updater 或不可读身份仍阻断相关配置恢复。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| OkNTE | DailyRoutineTask 的 Routine Items，按上游顺序去重、补默认和处理互斥；子配置只取 DailyRoutineTaskConfigs | 日常范围内开始/完成/失败配对；语言不支持跳过；异常归当前项及后续 blocked | 完整显式布尔选择列表中的日常领取；只补丁选择，不写日常子配置或进度 |
