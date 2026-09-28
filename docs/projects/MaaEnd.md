# MaaEnd 项目适配

公共规则见 [MXU](../frameworks/MXU.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

既有专项配置仍经原 GUI 编辑；独立 MaaFrameworkDriver 使用另一份显式配置，不自动迁移。共同启动、配置选择、语言与 stdout 配对规则见框架页。

MaaEnd 的 DailyRewards 五个一级开关（邮件、每日任务、委托、活动、通行证）以冻结的双语计划说明展示，不添加虚假必做子任务，也不改变业务分母。缺省值、显式关闭和类型迁移按锁定 MXU 初始化规则处理；缺定义、非布尔保存值或未核实的控制器/资源限制显示无法确认。输入框内容不进入说明。该说明只表示配置选择，不是执行或完成证据。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| MaaEnd | MXU autoStartInstanceId 唯一实例、稳定任务 ID、运行时 interface/import、customName/locale、controller/resource 兼容 | MXU stdout 当前任务开始/完成/失败配对；时间前缀不参与身份 | 风险未证实的任务停止；不按显示名称写配置 |
