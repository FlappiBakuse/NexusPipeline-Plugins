# BAAH 项目适配

公共规则见 [公共任务协议](../TASK_PROTOCOL.md)；源码身份见 [source-lock](../../tools/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| BAAH | 活动流水线、任务序号和名称、平行 TASK_ONOFF；完整名称数组作为 guard；自动登录/收尾分别建模 | Task.run 嵌套栈限定外层；免费奖励明确确认；后置失败、明确重跑后的恢复；错误退出后才推断后续未执行 | 仅已审查的重复领取/登录；同类多任务必须有当前 pipeline 顺序证据；整个平行数组 CAS |

| 适配器 | 当前运行边界依据 |
|---|---|
| BAAH | BAAH_main 在 my_AllTask.run 返回后输出“所有任务结束”，早于可选关闭游戏/模拟器；通用退出提示不作为成功依据 |

固定源码 `modules/AllTask/myAllTask.py` 的 `parse_task/run` 先加入自动登录，再按启用项构建 taskpool，末尾加入收尾；`CURRENT_PERIOD_TASK_INDEX` 是该 taskpool 的下标，续跑仍保留 EnterGame。观察器只有在当前 pipeline 标记、完整外层顺序和嵌套栈一致时区分重复类；日志缺口、来源/epoch切换或 pipeline 冲突不能继续借用旧顺序。

`Task.run` 即使 on_run 返回 False/None 也可能打印执行结束。post_condition 失败后返回主页只关闭控制范围，不补业务成功。致命后置异常由 `BAAH_main` 捕获并可能自动重跑，因此先记录失败和事件，只有实际错误自动关闭或 Host 确认进程退出才结束失败范围并标记后续 blocked；取消/卡顿不替代进程退出证据。后续同任务需新的 pipeline 启动、执行 ordinal 及独立业务成功证据才能恢复，原异常仍留在历史。

可用 `python tools/Probe-BaahBranches.py --source-root <锁定源码> --output <新的报告.json>` 运行原 Task 包装器、返回主页、AllTask 顺序/续跑及 BAAH_main 内置重跑分支。探针对源码验 SHA，导航识别、任务实例和外部动作均受控；不启动游戏。

顶层一般异常按仍打开的外层 pipeline 任务归属，嵌套子任务的异常不误认作另一顶层任务。缺少范围时保留未归属异常；即使随后确认退出，也不能凭异常文本推断哪些任务尚未运行。标记后续 blocked 还要求该来源下的 pipeline 顺序已确认且未丢失。

以下规则只接受对应外层任务正在运行时的完整原生消息，通用结束不覆盖失败。锁定源码行号用于定位分支，升级上游后须重新核查：

| 原方法/范围 | 已确认分支 | 尚不能推导的结果 |
|---|---|---|
| `InWanted.on_run` 28–90、`InSpecial.on_run` 29–87、`InExchange.on_run` 28–88 | 当前轮次无关卡为不适用；进入页面失败为失败；后两者按活动条件退出为不适用 | 子关卡扫荡返回、票数不足和部分关卡完成不证明全部目标完成 |
| `BuyAP.on_run` 24–62 | 无入口、单价无法识别为失败；价格超过配置上限为不适用 | 点击购买及回主页不独立证明购买成功；不开放自动消费重试 |
| `InMomotalk.on_run` 112–170 | 打开弹窗失败为失败；初始检查无未读为已满足跳过 | “处理完毕”后还会递归调用同类任务，不能据此提前宣布整体成功 |
| `InEventRecap.on_run` 52–109 | 无法进入、明确报告内部剧情失败均为失败 | 坐标无剧情、一次子任务完成不证明整张列表已完成 |

探针执行上述可控入口/空轮次/价格/活动条件的原 `on_run`，与包装器和重跑合计 28 个分支；业务导航、OCR、时钟是隔离输入。Jint 夹具另验证错误归属、近似文本和普通结束不能洗掉失败。

静默限制：`CollectMails.on_run` 进入邮箱失败直接 return，后续领取无独立确认日志；`CollectDailyRewards.on_run` 的点击/识别循环结果不能由普通结束横幅替代；`InClub.on_run` 只有点击。`Attendance.on_run` 单个签到领取日志不证明全部循环完成；`InCafe.cafe_process/on_run` 含配置跳过、邀请失败与第二咖啡厅缺失分支；`InTimeTable.on_run` 无票退出不证明所选课程已执行；`InCraft.on_run/dealing_with_quick_craft` 可在进入失败后继续，并含材料/次数限制；`InShop.on_run` 含关购买开关、切页失败和嵌套购买任务。上述未完成逐业务规则的路径保持未确认，不能将本次包装器/顺序改进解释为所有业务分支已完整支持。

BAAH 目标字段 `TARGET_EMULATOR_PATH`、`TARGET_IP_PATH`、`TARGET_PORT` 来自当前用户主配置，软件配置仅提供 `SAVE_LOG_TO_FILE`。路径声明按唯一主配置解析，文件改名不会切换账号；缺省 IP/port 按锁定 defaultSettings 为 127.0.0.1/5555。端口支持原生整数；显式 null 或错误类型不伪装为缺省。直接 ADB 序列号不能与 Host 的网络端点证明为同一设备，显示 unknown/warn。日志开关缺省 false；文件日志关闭且无可用 stdout 时阻断，有可用 stdout 时无需强制开启文件日志。

## 已审查源码分支与反例

- BAAH `myAllTask.parse_task/run` 先按 TASK_ONOFF 过滤再执行。`CURRENT_PERIOD_TASK_INDEX` 属于 sessiondict，`MyConfig.parse_user_config` 默认清空，独立新进程不继承旧游标。通用 Task.run 完成仅证明 post_condition；CollectMails 和 CollectDailyRewards 存在无业务确认的返回分支，不能据此计成功。当前日志只支持外层任务身份，嵌套收尾不覆盖外层结果。
