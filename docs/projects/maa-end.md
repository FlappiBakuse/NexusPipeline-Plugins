# MaaEnd 项目适配

公共框架见[MXU](../frameworks/mxu.md)，结果契约见[任务协议](../author/task-protocol.md)。本适配器使用 0.3.0，最低 Host 0.17.4。

MaaEnd 保持官方发行实际使用的 MXU GUI。MaaStellaSora 的 MFA 迁移不改变 MaaEnd 或独立 MaaFrameworkDriver 的配置入口。

MaaEnd v2.32.0 的 AutoEssence 地点选项导入已声明；仅选项导入不提供任务边界，不阻断无关任务的发现。

发现使用唯一 autoStartInstanceId、实例任务稳定 ID、interface/import、customName/locale 和 controller/resource 兼容性。配置补丁定位实例与任务 ID，不按显示名称写入。DailyRewards 的五个一级开关以冻结说明展示，不制造缺少独立日志的必需子任务或重复业务分母。

MXU stdout 中当前任务的开始与完成/失败必须在同一来源和 epoch 配对。完成属于该外层任务的权威业务事实；普通框架 ERR 或无归属异步 focus 不可据此伪造子业务失败。缺口、未配对终态和缺少终态最终失败，不能回退未核验。

日常失败参与有限选择重试并保留额度、选项和其他实例。Host 继续复核实际补丁后的启用集合与行为签名，并用 CAS/journal 恢复。匿名 FailureCollector 子项缺少稳定任务身份时，不独立归属到业务子项。

源码生成模块仍为 adapters/task-protocol/mxu，不因其他插件更换 GUI 删除 MXU 分支。

## 上游核对记录与兼容窗口

核对日期：2026-10-17（Asia/Shanghai）。插件当前版本以[源码 manifest](../../plugins/specialized/MaaEnd/plugin.json)为准；协议 `0.3.0`，最低 Host `0.17.4`。插件版本与下表上游版本独立。

| 核对时最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [v2.33.0](https://github.com/MaaEnd/MaaEnd/releases/tag/v2.33.0) | `39a22f9176a2484c38c10d256b8f595d4370f6a9` |
| [v2.32.0](https://github.com/MaaEnd/MaaEnd/releases/tag/v2.32.0) | `5501b27f3b3f552e8897a8839521dd36caf617a9` |
| [v2.31.0](https://github.com/MaaEnd/MaaEnd/releases/tag/v2.31.0) | `f6e3b5f8b27a8f84391bb73d85a296dabaddfb5d` |

资产 URL、大小和发布方摘要见 [上游窗口](../../adapters/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| PI 任务键 | 显示名称 | 识别层级 | 重试 | 声明文件 |
|---|---|---|---|---|
| AccountSwitch | 🔑自动切换账号 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AccountSwitch.json |
| AeroSalvage | 🎈浮空回收 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AeroSalvage.json |
| AndroidOpenGame | 🎮打开游戏 | 技术启停；不计业务分母 | 技术项随启动范围 | tasks/AndroidOpenGame.json |
| AutoCollect | 🧺自动采集 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AutoCollect.json |
| AutoEcoFarm | 🌾生态农场 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AutoEcoFarm.json |
| AutoEssence | 🎱基质刷取 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AutoEssence/AutoEssence.json |
| AutoSell | 💰售卖弹性物资 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AutoSell.json |
| AutoStockStaple | 🏪购买稳定物资 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AutoStockStaple.json |
| AutoStockpile | 📦自动囤货 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/AutoStockpile.json |
| BakerEntry | 💬会话消息嘴替 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/BakerEntry.json |
| BatchAddFriends | 👥批量添加好友 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/BatchAddFriends.json |
| BatchDeleteFriends | 🗑️批量删除好友 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/BatchDeleteFriends.json |
| BatchUseDetector | 🧭批量探测器 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/BatchUseDetector.json |
| ClaimSimulationRewards | 📦领取模拟空间奖励 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ClaimSimulationRewards.json |
| CloseGame | ❌关闭游戏（安卓端） | 技术启停；不计业务分母 | 技术项随启动范围 | tasks/CloseGame.json |
| CloseGamePC | ❌关闭游戏（PC） | 技术启停；不计业务分母 | 技术项随启动范围 | tasks/CloseGamePC.json |
| Crafting | 🧪简易制作 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/Crafting.json |
| CreditShoppingN2 | CreditShoppingN2 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/CreditShopping.json |
| DailyRewards | 📅日常奖励领取 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/DailyRewards.json |
| DeliveryJobs | 🚚转交委托 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/DeliveryJobs.json |
| DevTest | 🧪开发测试 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/DevTest.json |
| DijiangRewards | 🎁基建任务 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/DijiangRewards.json |
| EnvironmentMonitoring | 🌿环境监测 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/EnvironmentMonitoring.json |
| EssenceFilter | 🔒基质筛选锁定 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/EssenceFilter.json |
| GearAssembly | 🔧装备制造 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/GearAssembly.json |
| GiftOperator | 🎁赠送干员礼物 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/GiftOperator.json |
| ImportBluePrints | 📐一键导入蓝图 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ImportBluePrints.json |
| IntelArchive | 📁情报档案库 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/IntelArchive.json |
| ItemTransfer | 🐌库存转移 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ItemTransfer.json |
| SellProduct | SellProduct | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/OutpostTrading.json |
| ProtocolSpace | ⚔️协议空间 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ProtocolSpace.json |
| PullCountCalculator | 🧮抽数计算 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/PullCountCalculator.json |
| PuzzleSolver | 🧩解拼图 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/PuzzleSolver.json |
| ReadAllWiki | 📖百科已读 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ReadAllWiki.json |
| RealTimeTask | 🤖实时开荒辅助 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/RealTimeTask.json |
| ReceiveProdManual | 🌾简制手册领取 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ReceiveProdManual.json |
| ResourceRecycleStation | 🦉资源回收站 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ResourceRecycleStation.json |
| SeizeDeliveryJobs | 🏍️抢委托送货 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/SeizeDeliveryJobs.json |
| SimpleProductionBatchStart | SimpleProductionBatchStart | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/SimpleProductionBatchStart.json |
| StashBackpack | 🎒存放背包 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/StashBackpack.json |
| SwitchTeam | 🔄切换编队 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/SwitchTeam.json |
| TrialOfSwordmancy | 🗡️选剑演武 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/TrialOfSwordmancy.json |
| VisitFriends | 🤝拜访好友 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/VisitFriends.json |
| WeaponUpgrade | 🔫升级武器 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/Weapon.json |
| WebEvent202605 | 🎁自动共贺庆典网页活动 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/WebEvent202605.json |
| ZiplineImport | 🚡导入/更新滑索坐标 | 正式 MXU 外层回调，权威终态 | 失败可选择重试；选项、额度与进度不改 | tasks/ZiplineImport.json |

### DailyRewards 已知选项

| 选项 |
| --- |
| DailyEmailRewards |
| DailyTaskRewards |
| DailyClaimDeliveryJobsRewards |
| DailyEventRewards |
| DailyProtocolPassRewards |

上述任务均由唯一自动执行实例的稳定 task ID 选择。定位/目标/预设/前置设置等只有 option 或 preset 的 import 不独立建业务任务。AccountSwitch、DevTest、导入、实时辅助等在 PI 中可发现，不代表这些手工操作的内部业务已单独核验。任务定义缺失、控制器/资源不兼容、名称归属歧义与日志缺口保持明确限制。资源控制器缓存选择随事务恢复。[生产模块](../../adapters/task-protocol/mxu)。

## 任务差异与阻断边界

v2.31.0 新增 DecomposeWeaponEssence、SharedZiplineDelete 两个任务文件，当前 manifest 已登记；其启用任务参与发现和范围归属，未知 import 仍明确限制。下表补全最新发行的已知任务差集；旧表中的 DevTest 等定义存在不代表当前发行已启用。

| 最新 PI 任务 | entry | 声明文件 |
| --- | --- | --- |
| DecomposeWeaponEssence | DecomposeWeaponEssenceStart | tasks/DecomposeWeaponEssence.json |
| SharedZiplineDelete | SharedZiplineDeleteMain | tasks/SharedZiplineDelete.json |

公开 PI 的 DeliveryJobs.json 可超过 2 MiB。Host 以公共 text 资源读取，单文件上限 8 MiB，保留 32 MiB 总量限制；不会因该文件大小把有效用户快照误报为未保存。

## 启动责任检查

PC 模式声明 `self-managed-pc-launch`：宿主禁用直接启动游戏，保留用户已保存的游戏参数；模拟器模式沿用现役能力。MaaEnd v2.33.0 的 `__MXU_PRETASK__LaunchGamePC` 在连接控制器前运行 `agent/go-service --pretask LaunchGamePC`，通过启动器进入游戏。检查读取唯一自动执行实例的启用状态、实际控制器兼容性、预任务定义与启动选项。自动模式由上游按区服查找启动器；手动模式必须填写 `Launcher.exe`。过期或类型变化的选择按 MXU 当前选项默认值解释。

游戏已就绪时允许继续；否则缺少、禁用或不兼容的启动预任务，以及空白或指向游戏主程序的手动启动器路径会阻断。旧 `preActions`、普通 `__MXU_LAUNCH__` 任务和宿主保存的游戏路径不能替代此预任务。旧版本配置与任务发现仍保留，但新版游戏的自动启动需要升级上游并配置启动预任务。检查只确认启动安排，不证明自动查找、文件存在或实际启动成功。

公开 pretask 声明作为准备步骤发现，保留名称、控制器限制、选项与重试选择，不计入业务任务分母，也不要求普通 Tasker 的业务完成日志。真实游戏启动仍由上游执行，不由配置检查执行。

## 配置修复

- 完成动作：关闭当前实例所有 `__MXU_POWER__` 并关闭其控制器启用缓存。
- 启动器设置由用户在 MaaEnd 中配置；不把项目游戏路径写入前置程序或启动器路径，不自动修改已有启动配置。

修复事务及账号保护见[配置编辑](../author/config-editor.md)，跨项目字段索引见[覆盖表](../frameworks/completion-actions.md)。

公共识别、重试及证据边界见[任务协议](../author/task-protocol.md)；本页只定义项目特有规则。
