# ZenlessZoneZeroOneDragon 项目适配

公共规则见 [公共任务协议](../TASK_PROTOCOL.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| ZenlessZoneZeroOneDragon | 当前账号 one_dragon/_group.yml；旧 app_order/app_run_list 只读发现；保存的未知应用仍可见 | 唯一已注册外层应用终态，应用组当前运行的已完成跳过；嵌套不同名指令不归给外层 | 新结构邮件；旧结构与其他应用停止；不修改其他账号 |

| 适配器 | 当前运行边界依据 |
|---|---|
| ZenlessZoneZeroOneDragon | 外层“一条龙”的执行成功/失败；应用组完成尚可能继续切换实例，不能提前结束 |

观察器使用当前绑定配置顺序、`获取应用组配置`、应用首个 `检测游戏窗口` 节点及组 `执行应用` 回执配对。只收到结束行不能确定是外层应用；同名子操作先结束时，候选结果等到组确认 `app.execute()` 返回后才提交。组结束不等于根一条龙结束。缺口、来源/epoch变化、组次序或跳过名称冲突会放弃范围，不能借旧状态补齐。已完成跳过只接受当前组回执。

原生格式来自锁定 `log_utils.get_log_formatter` 与 `Operation.execute/after_operation_done`，包含 ASCII 时间戳、`operation.py` 和 INFO/ERROR。全角标点、翻译后的级别、引用文字和别的文件伪装的消息不作为生产别名。裸消息用于日志通道和源码派生夹具；未经核实的其他语言名称不猜配。

体力计划的四类副本按分类、具体子调用开始、子返回、父分类节点返回、`挑战完成` 配对。锁定 `ChargePlanApp.challenge_complete` 会把失败计划设为 skipped，同时返回成功让外层继续；该路径保留失败事件，在应用组终态中维持 failed，别的计划成功不清除。操作内异常由原 `Operation.execute` 重试，只有同一子调用成功及父返回确认才将事件记为 recovered；在此之前父任务仍 running。缺少子开始/父回执则保留无法确认，不把外层成功当作恢复。

`python tools/Probe-ZzzBranches.py --source-root <锁定源码> --output <新报告.json>` 执行原 Operation 重试/日志、ChargePlan 返回值消费及 GroupApplication 顺序/跳过方法；节点图和游戏识别是受控依赖，不启动游戏。公开 issue #2797 的转贴格式仅用于定位上述源码，夹具明确是原生格式的源码派生输入，不冒充原始日志附件。其他应用全部内部业务分支和英文日志覆盖仍需各自核查。

## 已审查源码分支与反例

- ZZZ `ApplicationGroupConfig.update_full_app_list` 将未保存的新注册应用默认设为禁用，不需要虚构启用项。`GroupApplication` 先过滤启用与已完成，再调用外层 Application；嵌套 Operation 与应用组结束不代表全部业务成功。

- 官方 [v2.5.2 `ApplicationGroupConfig`](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/blob/v2.5.2/src/one_dragon/base/operation/application/application_group_config.py) 将尚未持久化的默认应用置于保存列表之前；[`GroupApplication`](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/blob/v2.5.2/src/one_dragon/base/operation/application/group_application.py) 仍为每项输出“应用未启用”并推进游标。观察器只在当前组开始且尚未认领保存项时接受与缺失默认注册身份一致的禁用行，不为其虚构任务或可写选择字段。随后五条已完成保存项各自解释为已满足 skipped；名称不符、缺口、跨 epoch 与未知动态应用仍不认领。

- ZZZ 绑定根是 `config/<两位实例>/`。新 `one_dragon/_group.yml` 存在时优先使用；不存在时只读取 `one_dragon_app.yml`，不把全局 `one_dragon.yml` 当成任务列表。按锁定 GroupManager 的迁移逻辑，用旧 app_order 排序、app_run_list 决定启用，并补入遗漏的默认注册应用；新注册应用未被旧运行列表选择时保持禁用。旧格式投影仅用于读取，自动重试不改旧列表，因为上游启动会创建新组文件；此时需重新冻结新组后才能获得可验证的补丁目标。`Probe-ZzzMigration.py` 执行锁定上游原类方法验证迁移及新文件优先级。

- ZZZ 编辑工作副本只保留选中实例并写入 `instance_run: 仅运行当前`，保留 BOM、换行和无关根字段；重复或未知运行模式拒绝。`-i` 仅接受绑定的两位实例号，不接受逗号多实例输入。配置隔离不证明或自动切换游戏认证会话。
