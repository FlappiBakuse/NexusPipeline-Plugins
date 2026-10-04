# MFAAvalonia 配置与日志契约

当前专项接入为 [MaaStellaSora](../projects/MaaStellaSora.md)，机器 ID `maas`。Host 不替换 managed MaaFrameworkDriver 的执行框架。

| 责任 | 原生字段/出口 | Host 与适配器处理 |
|---|---|---|
| 实例选择 | config/instances/<ID>.json | 必须是稳定 ID；不存在即拒绝交换，不能回落当前页 |
| 默认配置 | appsettings.json DefaultConfig；config/config.json 或 mfa_<name>.json | 实例本地值优先，其次 Instance.<ID>、Instance.default、全局值 |
| 任务列表 | TaskItems 与 CurrentTasks | 保留持久顺序、删除记录、默认补项及 preset 过滤；只写声明的 default_check |
| 运行参数 | option/advanced/repeat_count/pipeline_override、GlobalOptionItems、ResourceOptionItems、ControllerOptionItems | 行为冻结，选择重试不改额度、次数、选项或进度 |
| 资源/控制器 | PI controller/resource 与 CurrentControllerName/CurrentController/Resource | 按原生名称、类型和首个兼容项解析；不把不兼容任务启用 |
| 前置任务 | PI pre_task、BeforeTask | 原生程序执行；接口资源与配置纳入冻结，不从技术准备推断业务成功 |
| 日志 | LoggerHelper 文件中的 MonitorLog/Monitor，cfg 与 inst | 只读真实文件；UI 内存 RunState 不作为证据 |
| 进程 | 同安装单实例与稳定实例命令参数 | 交换前要求目标程序退出；查询不明阻断，不能接管别的实例或未知进程 |

配置契约为 `mfa-avalonia.instances.v1`。旧 MXU 快照由 Host 启动恢复后原字节归档并清空配置输入，用户从“编辑配置”重新选择 MFA 稳定实例，不迁移旧字段。重置 journal 防止中断后误采用共享安装配置；原生目录和其他账号保持不变。原生程序可能写全局默认配置及实例文件，因此配置目录与 appsettings 的交换/恢复是统一账户事务，不能只保存页面状态。

源码证据固定于 [上游窗口](../../tools/task-protocol/upstream-window.json)：MFAConfiguration/InstanceConfiguration、TaskLoader.SynchronizeTaskItems、TaskQueueViewModel 控制器/资源解析、MFATask.Run、MaaProcessor.MonitorLog 和单实例入口。合成 Jint 测试不等于原生发行运行。当前自动化范围为中文日常；无限重复、未知结构或实例缺失阻止准入。
