# MaaStellaSora 项目适配

公共规则见 [MXU](../frameworks/MXU.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

既有专项配置仍经原 GUI 编辑；独立 MaaFrameworkDriver 使用另一份显式配置，不自动迁移。共同启动、配置选择、语言与 stdout 配对规则见框架页。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| MaaStellaSora | 同一 MXU 协议，只接受 MaaStellaSora 接口；机器 ID 保持 maas | 与 MaaEnd 共用来源与配对规则 | 非 MXU、未知接口/缺失实例明确不支持 |
