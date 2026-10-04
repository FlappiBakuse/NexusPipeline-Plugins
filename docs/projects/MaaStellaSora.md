# MaaStellaSora 项目适配

真实插件 ID 保持 `maas`，当前使用 MFAAvalonia 的稳定实例入口。MaaEnd 继续使用官方 MXU。协议见 [TASK_PROTOCOL](../author/TASK_PROTOCOL.md)，框架与配置责任见 [MFAAvalonia](../frameworks/MFA_AVALONIA.md)。

发现按实例 TaskItems、CurrentTasks 删除记录、PI import/preset、控制器和资源兼容条件冻结任务顺序；任务选项、重复次数和全局/资源/控制器选项均属于行为字段。新默认任务可投影，但没有持久选择字段时重试只能使用耦合范围，不能创造用户选择。

观察仅使用原生文件 MonitorLog 的 cfg/inst/src/op 信封，按稳定实例 ID 过滤。开始、下一任务开始和队列终态配对；异步命名失败在最终排空前合并。同名任务按冻结顺序及重复次数区分；无法唯一归属的同名失败不能证明任一候选成功。缺失重复、日志缺口、异实例、缺少队列终态均不产生完成。

旧 MXU 用户快照在 Host 启动恢复后原字节归档并清空配置绑定，用户从“编辑配置”选择 MFA 实例重新设置。不映射旧字段，不自动采用当前 UI 实例。

创建脚本时可以暂不选择实例；使用前先在 MFA 中保存原生实例，再通过 Host 的“编辑配置”复用并明确选择该实例。插件声明 `no-fresh-config`，不通过 Host 创建没有实例归属的空配置。复用候选只有一个时自动选中并继续编辑；多个候选才请求用户选择，保存前不确认用户快照。

## 当前版本与发行窗口

核对日期：2026-10-04（Asia/Shanghai）。专项源码版本 `0.2.2`，协议 `0.2.0`，最低 Host `0.16.14`。插件版本与下表上游版本独立。

| 最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [v1.5.1](https://github.com/MaaStellaSora/MaaStellaSora/releases/tag/v1.5.1) | `ee9f3c9b65011d1b7649202328c0914af7910c81` |
| [v1.5.0](https://github.com/MaaStellaSora/MaaStellaSora/releases/tag/v1.5.0) | `ea7890883b4001bb2d5aed3d0866ba0f49aeada6` |
| [v1.4.4](https://github.com/MaaStellaSora/MaaStellaSora/releases/tag/v1.4.4) | `4009bc79591ad189d80f8f5d74d34d78bb8508cd` |

资产 URL、大小和发布方摘要见 [上游窗口](../../tools/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| PI 任务键 | 显示名称 | 识别层级 | 重试 | 声明文件 |
|---|---|---|---|---|
| 活动快速战斗 | 活动快速战斗 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/activity.json |
| 活动挑战关卡自动战斗 | 活动挑战关卡自动战斗 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/activity_challenge.json |
| 新版爬塔 | 新版爬塔 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/climb_tower.json |
| 悬赏试炼快速战斗 | 悬赏试炼快速战斗 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/fight.json |
| 领取与赠送干劲 | 领取与赠送干劲 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/friend.json |
| 领取基金奖励 | 领取基金奖励 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/grant.json |
| 邀约 | 邀约 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/invite.json |
| 登录游戏 | 登录游戏 | 技术启停；不计业务分母 | 技术项随启动范围 | resource/tasks/login.json |
| 领取邮箱奖励 | 领取邮箱奖励 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/mail.json |
| 猎影合围 | 猎影合围 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/operation.json |
| 真格挑战 | 真格挑战 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/proving_grounds.json |
| 领取并重新派遣委托 | 领取并重新派遣委托 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/quest.json |
| 领取每日奖励 | 领取每日奖励 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/shop.json |
| 心链送礼 | 心链送礼 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/talk.json |
| 领取任务奖励 | 领取任务奖励 | MFA 当前实例任务范围，顺序/重复次数闭环 | 失败可选择重试；选项、额度与进度不改 | resource/tasks/task.json |

上表是适配器登记的 resource/tasks 布局任务。preset 只筛选/排序任务，不作为额外业务分母；控制器与资源不兼容任务不启用。重复次数必须为有限正整数，无持久选择字段的默认任务按耦合范围重试。同名任务的迟到失败不能唯一定位时保守失败。旧 MXU callbacks 不参与当前 MFA 日志匹配。[生产模块](../../tools/task-protocol/mfa)。

## 最新发行实际 PI 布局

v1.5.1 的 interface.json 使用 interface/tasks 路径；当前 manifest 与生成器同时登记该布局和 resource/tasks 布局，并在实际 import 范围读取。下表列出最新源码的全部任务；未知 import 不会被忽略，也不会降级执行。选项专用 import（邀约选择、爬塔商店/强化/目标）没有独立业务任务。

| 最新 PI 任务 | entry | 声明文件 |
| --- | --- | --- |
| 登录游戏 | 登录_登录 | interface/tasks/login.json |
| 领取每日奖励 | 采购_入口 | interface/tasks/shop.json |
| 心链送礼 | 心链_入口 | interface/tasks/talk.json |
| 邀约 | 邀约_入口 | interface/tasks/invite.json |
| 活动快速战斗 | 活动快速战斗_入口 | interface/tasks/activity.json |
| 活动挑战关卡自动战斗 | 活动挑战_入口 | interface/tasks/activity_challenge.json |
| 悬赏试炼快速战斗 | 战斗_入口 | interface/tasks/fight.json |
| 领取并重新派遣委托 | 委托_入口 | interface/tasks/quest.json |
| 领取与赠送干劲 | 好友_入口 | interface/tasks/friend.json |
| 领取任务奖励 | 任务_入口 | interface/tasks/task.json |
| 领取邮箱奖励 | 邮箱_入口 | interface/tasks/mail.json |
| 领取基金奖励 | 基金_入口 | interface/tasks/grant.json |
| 猎影合围 | 猎影合围_入口 | interface/tasks/operation.json |
| 真格挑战 | 真格挑战_入口 | interface/tasks/proving_grounds.json |
| 新版爬塔 | 星塔_入口_agent | interface/tasks/climb_tower.json |

manifest 的 `configurationRevision` 固定为 `mfa-avalonia.instances.v1`，驱动 Host 通用重置与“需重新设置”门禁。首次复用编辑在唯一候选时自动提交稳定实例 ID，多候选显示选择表单；候选列表使用 HTTP `args` 信封，空列表需先在 MFA 中保存实例，最终绑定只在保存成功时提交。

## 启动与收尾检查

`mfa.instance` 检查稳定实例与有限重复。PC 的 `mfa.launch_owner` 检查当前实例启动设置：`SoftwarePath` 非空且 `BeforeTask=StartupSoftwareAndScript`；项目已启动游戏或窗口已就绪时，也允许 `StartupScriptOnly`。`StartupSoftware` 只启动软件，不能保证日常脚本运行；普通 CustomProgramAction 在连接之后执行，不能证明连接前启动游戏。未知动作或非字符串路径阻断，窗口未知且启动设置不足时警告。正常启动参数只选定稳定实例，不使用绕过启动设置的命令行自动运行入口。配置检查不证明程序文件存在或实际窗口连接成功。

八种 MFA 内置特殊任务（倒计时、定时等待、系统通知、自定义程序、结束进程、计算机操作、Webhook、切换实例）按原生持久顺序识别为技术任务，不增加业务分母。按持久顺序执行的自定义程序作为业务任务的重试依赖，选择补丁保留原始参数与账号隔离；不执行这些程序来检查配置。

编辑准备脚本在已交换的附加 `appsettings.json` 中设置 MFA 原生一次性 `NoAutoStart=true`，保留其他字段。MFA 打开后先据此禁止全局和实例自动启动，再自行复位；Host 的正常执行不运行编辑准备脚本。点击完成时，在编辑进程确认退出后、提交快照前调用 config-edit-commit 清除 NoAutoStart，防止提前关闭编辑器时遗留临时标志；失败保留会话和工作副本，取消/恢复使用原字节备份。实例的 SoftwarePath/BeforeTask 及其他账号配置不因进入编辑而改写。

`mfa.finish_action` 同时检查启用的计算机操作特殊任务和 `AfterTask`。关机、重启、睡眠、休眠及结构不明的计算机操作会阻断，避免中断 Host 恢复。`AfterTask=None/CloseMFA` 允许；`ShutDown/ShutDownOnce/RestartPC/CloseEmulatorAndRestartMFA` 阻断。关闭游戏动作仍按后继目标、重启责任与模拟器共享关系检查。特殊任务参数及启动/收尾字段进入行为签名，修改后旧计划不能用于选择重试。

依据固定 MFA `1080d3e1500f3439ac896ab2eca9aeb8e885f1f4` 的 `AddTaskDialogViewModel`、`TaskLoader`、`RootView` 与 `MaaProcessor`。

## 配置修复

- 游戏路径：选定实例启动设置的 `SoftwarePath`，继承字段只在当前实例建立覆盖。
- 完成动作：`AfterTask` 保留 None/CloseMFA/CloseEmulator/CloseEmulatorAndMFA，其余字符串改 None；关闭 ComputerOperationAction。
- 启动后操作：设为 `StartupSoftwareAndScript`，保留任务顺序、参数、额度及进度；不插入 CustomProgramAction。进入编辑时原生一次性 NoAutoStart 屏蔽启动动作，保存前恢复正常启动。

仅对已保存的当前用户快照逐项预览、确认和备份。字段类型错误不猜测转换；生成的 `data/editor.js` 提供修复策略；详细事务及不适用边界见 [配置编辑契约](../author/CONFIG_EDITOR.md) 与 [八专项覆盖表](../frameworks/COMPLETION_ACTIONS.md)。

任务备注使用原生 `remark`，非空时优先于 `display_name_override`；显示原任务标签加备注，日志匹配使用原生实际名称。空白备注回退到旧昵称或原标签。备注/昵称随计划冻结，不借显示文字推定同名日志归属。
