# ZenlessZoneZeroOneDragon 项目适配

公共规则见 [公共任务协议](../author/TASK_PROTOCOL.md)；源码身份见 [source-lock](../../adapters/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| ZenlessZoneZeroOneDragon | 当前账号 one_dragon/_group.yml；旧 app_order/app_run_list 只读发现；保存的未知应用仍可见 | 唯一已注册外层应用终态，应用组当前运行的已完成跳过；嵌套不同名指令不归给外层 | native_resume 使用原入口与启用范围，不写选择、进度或其他账号 |

| 适配器 | 当前运行边界依据 |
|---|---|
| ZenlessZoneZeroOneDragon | 外层“一条龙”的执行成功/失败；应用组完成尚可能继续切换实例，不能提前结束 |

观察器使用当前绑定配置顺序、`获取应用组配置`、应用首个 `检测游戏窗口` 节点及组 `执行应用` 回执配对。只收到结束行不能确定是外层应用；同名子操作先结束时，候选结果等到组确认 `app.execute()` 返回后才提交。组结束不等于根一条龙结束。缺口、来源/epoch变化、组次序或跳过名称冲突会放弃范围，不能借旧状态补齐。已完成跳过只接受当前组回执。

原生格式来自锁定 `log_utils.get_log_formatter` 与 `Operation.execute/after_operation_done`，包含 ASCII 时间戳、`operation.py` 和 INFO/ERROR。全角标点、翻译后的级别、引用文字和别的文件伪装的消息不作为生产别名。裸消息用于日志通道和源码派生夹具；未经核实的其他语言名称不猜配。

体力计划的四类副本按分类、具体子调用开始、子返回、父分类节点返回、`挑战完成` 配对。锁定 `ChargePlanApp.challenge_complete` 会把失败计划设为 skipped，同时返回成功让外层继续；该路径保留失败事件，明确失败的副本子业务为 failed，权威父成功则为 partial，整个父子范围禁止重试，别的计划成功不清除。操作内异常由原 `Operation.execute` 重试，只有同一子调用成功及父返回确认才将事件记为 recovered；在此之前父任务仍 running。缺少子开始/父回执则按缺失证据失败，不把外层成功当作恢复。

## 已审查源码分支与反例

- ZZZ `ApplicationGroupConfig.update_full_app_list` 将未保存的新注册应用默认设为禁用，不需要虚构启用项。`GroupApplication` 先过滤启用与已完成，再调用外层 Application；嵌套 Operation 与应用组结束不代表全部业务成功。

- 官方 [v2.5.2 `ApplicationGroupConfig`](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/blob/v2.5.2/src/one_dragon/base/operation/application/application_group_config.py) 将尚未持久化的默认应用置于保存列表之前；[`GroupApplication`](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/blob/v2.5.2/src/one_dragon/base/operation/application/group_application.py) 仍为每项输出“应用未启用”并推进游标。观察器只在当前组开始且尚未认领保存项时接受与缺失默认注册身份一致的禁用行，不为其虚构任务或可写选择字段。随后五条已完成保存项各自解释为已满足 skipped；名称不符、缺口、跨 epoch 与未知动态应用仍不认领。

- ZZZ 绑定根是 `config/<两位实例>/`。新 `one_dragon/_group.yml` 存在时优先使用；不存在时只读取 `one_dragon_app.yml`，不把全局 `one_dragon.yml` 当成任务列表。按锁定 GroupManager 的迁移逻辑，用旧 app_order 排序、app_run_list 决定启用，并补入遗漏的默认注册应用；新注册应用未被旧运行列表选择时保持禁用。旧格式投影仅用于读取；native_resume 不改旧列表，启动创建新组文件后须复核冻结计划与行为兼容。

- ZZZ 编辑工作副本只保留选中实例并写入 `instance_run: 仅运行当前`，保留 BOM、换行和无关根字段；重复或未知运行模式拒绝。`-i` 仅接受绑定的两位实例号，不接受逗号多实例输入。配置隔离不证明或自动切换游戏认证会话。

## 当前版本与发行窗口

核对日期：2026-10-05（Asia/Shanghai）。专项源码版本 `0.4.0`，协议 `0.2.0`，最低 Host `0.16.15`。插件版本与下表上游版本独立。

| 最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [v2.5.2](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/releases/tag/v2.5.2) | `a2789666e6a0175b33969ec61d3c27dce517ff14` |
| [v2.5.1](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/releases/tag/v2.5.1) | `a75973a368d21efcb3c92ccf209eee35eed835b9` |
| [v2.4.7](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/releases/tag/v2.4.7) | `55926ffbdde06ab6643886d2fb6a841f8707af57` |

资产 URL、大小和发布方摘要见 [上游窗口](../../adapters/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| app_id | 名称 | 入口兼容 | 终态边界 |
|---|---|---|---|
| charge_plan | 体力刷本 | 默认组已注册 | 另有副本挑战子项；父成功/明确子失败为 partial，整范围禁止重试 |
| city_fund | 丽都城募 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| coffee | 咖啡店 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| commission_assistant | 委托助手 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| daily_signin | 每日签到 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| drive_disc_dismantle | 驱动盘拆解 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| email | 邮件 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| engagement_reward | 活跃度奖励 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| hou_hou_bakery | 吼吼饼铺 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| intel_board | 情报板 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| life_on_line | 真·拿命验收 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| notify | 通知 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| notorious_hunt | 恶名狩猎 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| one_dragon | 一条龙 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| random_play | 录像店营业 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| redemption_code | 兑换码 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| ridu_weekly | 丽都周纪 (领奖励) | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| scratch_card | 刮刮卡 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| shiyu_defense | 式舆防卫战 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| suibian_temple | 随便观 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| trigrams_collection | 卦象集录 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| world_patrol | 锄大地 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| lost_void | 迷失之地 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| withered_domain | 枯萎之都 | 默认组已注册 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| mouse_sensitivity_checker | 鼠标灵敏度检测 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| predefined_team_checker | 预备编队角色识别 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| operation_debug | 指令调试 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| screenshot_helper | 闪避截图 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| auto_battle | 自动战斗 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |
| dodge_assistant | 闪避助手 | 名称已知；需显式存在于组配置，仅按显式组选择启用 | 应用开始 + 终态 + 组回执；组结束不替代应用终态 |

所有日常应用采用原配置续跑。通知、调试、战斗辅助、截图、灵敏度和编队检查等名称登记不意味着 Host 额外启动手工入口。现代组配置中的未知启用项被明确拒绝；未启用的未知项不影响已知任务。子任务“副本挑战”由 charge_plan 派生，不另写选择开关。[生产模块](../../adapters/task-protocol/zzz)。

## 配置修复

- 游戏路径：`game_account.yml/game_path`。
- 完成动作：附加 `one_dragon.yml/after_done` 保留无/关闭游戏，其余字符串改无。
- 启动任务：非 MAA，无插入任务。

仅对已保存的当前用户快照逐项预览、确认和备份。字段类型错误不猜测转换；生成的 `data/editor.js` 提供修复策略；详细事务及不适用边界见 [配置编辑契约](../author/CONFIG_EDITOR.md) 与 [八专项覆盖表](../frameworks/COMPLETION_ACTIONS.md)。
