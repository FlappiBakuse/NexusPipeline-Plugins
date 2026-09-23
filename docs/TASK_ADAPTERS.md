# 官方专项任务适配边界

MaaEnd 的 DailyRewards 五个一级开关（邮件、每日任务、委托、活动、通行证）以冻结的双语计划说明展示，不添加虚假必做子任务，也不改变业务分母。缺省值、显式关闭和类型迁移按锁定 MXU 初始化规则处理；缺定义、非布尔保存值或未核实的控制器/资源限制显示无法确认。输入框内容不进入说明。该说明只表示配置选择，不是执行或完成证据。

实现入口为 `tools/task-protocol/`，发布脚本由生成器写入各插件 `data/`。上游仓库、固定 commit 和逐文件 SHA256 见 [source-lock.json](../tools/task-protocol/source-lock.json)。更新上游后需要重新审查，不能只更新摘要。所有配置和日志夹具均为合成数据，不含用户现场。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| BetterGI | GUID/旧任务名、TaskDefinitions、显式 TaskOrder；缺省顺序回退开关键；NextTaskId 限定本轮 | 邮件领取/空邮件；地脉明确失败、协会领取异常和合成树脂异常；地脉不在运行日期；整轮结束仅为边界 | 无一次性游标时的邮件；重复名称、未知任务、消耗资源均保守停止 |
| MaaEnd | MXU autoStartInstanceId 唯一实例、稳定任务 ID、运行时 interface/import、customName/locale、controller/resource 兼容 | MXU stdout 当前任务开始/完成/失败配对；时间前缀不参与身份 | 风险未证实的任务停止；不按显示名称写配置 |
| MaaStellaSora | 同一 MXU 协议，只接受 MaaStellaSora 接口；机器 ID 保持 maas | 与 MaaEnd 共用来源与配对规则 | 非 MXU、未知接口/缺失实例明确不支持 |
| March7thAssistant | config.yaml 与上游默认值，13 个一级入口、奖励/活动/资产/历战子开关；父禁用抑制子任务 | 日常目标、宇宙固定次数、当前运行未刷新；奖励子模块的明确完成或无可领奖励均为成功；模块明确失败 | 所有未证明完整重跑安全的模块停止；固定次数/日期不当作成功日志 |
| ZenlessZoneZeroOneDragon | 当前账号 one_dragon/_group.yml；旧 app_order/app_run_list 只读发现；保存的未知应用仍可见 | 唯一已注册外层应用终态，应用组当前运行的已完成跳过；嵌套不同名指令不归给外层 | 新结构邮件；旧结构与其他应用停止；不修改其他账号 |
| BAAH | 活动流水线、任务序号和名称、平行 TASK_ONOFF；完整名称数组作为 guard；自动登录/收尾分别建模 | Task.run 嵌套栈限定外层；免费奖励明确确认；后置失败、明确重跑后的恢复；错误退出后才推断后续未执行 | 仅已审查的重复领取/登录；同类多任务必须有当前 pipeline 顺序证据；整个平行数组 CAS |
| OkNTE | DailyRoutineTask 的 Routine Items，按上游顺序去重、补默认和处理互斥；子配置只取 DailyRoutineTaskConfigs | 日常范围内开始/完成/失败配对；语言不支持跳过；异常归当前项及后续 blocked | 完整显式布尔选择列表中的日常领取；只补丁选择，不写日常子配置或进度 |
| OkWutheringWaves | DailyTask 三类体力分支、条件梦魇、隐含奖励和启用的日常附加项 | 捕获后继续的梦魇/花园/合成失败独立保留；花园已完成为已满足跳过 | 隐含步骤缺少独立开关，整轮重跑安全性未证明时停止 |

已识别配置的生产适配器当前 coverage 为 partial；被拒绝的配置为 unsupported，，不承诺任意第三方版本和自定义脚本都能完整判定。没有对应当前运行证据时保持 unknown；未知任务不会被从分母移除。MXU 的外层 callback 不证明每一个内部资源节点都达到业务目标，因此不伪造无独立证据的子任务。

## 运行结束边界

运行结束与业务任务成功分别判断。关闭游戏、关闭脚本、通知发送完成、保存计数和通用“完成”横幅均不能单独证明本轮任务完成。

| 适配器 | 当前运行边界依据 |
|---|---|
| BetterGI | 一条龙和配置组任务结束 |
| March7thAssistant | game.stop 的“停止运行”一级标题，位于可选退出/循环/暂停之前；顶层“发生错误”记录异常结束。启动和各模块也输出“完成”，不能据此结束整轮 |
| ZenlessZoneZeroOneDragon | 外层“一条龙”的执行成功/失败；应用组完成尚可能继续切换实例，不能提前结束 |
| BAAH | BAAH_main 在 my_AllTask.run 返回后输出“所有任务结束”，早于可选关闭游戏/模拟器；通用退出提示不作为成功依据 |
| MaaEnd / MaaStellaSora | 同一 stdout epoch 内，全部已选任务具有唯一名称匹配的开始与终态回调；缺失、歧义或日志缺口保持未确认 |

MXU 的 system 语言配置按可用接口翻译解析，观察阶段接受经声明的各语言名称；开始/完成/失败回调支持简中、繁中、英文、日文与韩文。缺失接口翻译时按上游输出去掉 `$` 的键名。stdout 按上游去除名称中的 HTML 标签，显示仍保存原名称；归一化后同名（包括与 unsupported 任务同名）拒绝归属。适配器自身 `*.metadata.json` 的 importTasks 记录固定源码审查得到的导入任务索引，只读取本轮配置涉及的接口分片，避免无关的大型选项树耗尽 Jint 配额。索引未知的导入仍尝试读取，无法确认的任务保留 unsupported；上游调整导入布局时需重新审查。JSONC 解析保留字符串中的 URL、注释样式文本和逗号，宿主原有时间、语句与内存限额保持不变。

冷启动选择使用持久化 `enabled`。`runOnce` 不属于上游 SavedTask，也不由 importConfig 恢复；`enabledByController` 由控制器切换逻辑消费，不能直接覆盖冷启动的 enabled。已移除的控制器/资源名称按 importConfig 清除、Toolbar 回退到当前首项，再计算兼容性；不改写用户配置。`Probe-MxuBranches.mjs` 接受显式上游源码和 Host 目录，校验 source-lock 后执行原 TypeScript 纯函数，核实翻译回退、运行时选择、控制器切换和 stdout 规则。

真实实例导出可以通过显式只读回放入口检查；单份当前配置不代表每一份历史日志当时的配置。原始配置、日志及包含实例身份的报告保留在仓库外，正式 fixture 使用合成数据。星塔旅人无真实样本时仅报告同架构源码与合成契约验证，不冒称完成真机验证。

## 关键源码分支与反例

- BetterGI `OneDragonFlowViewModel.LoadDisplayTaskListFromConfig` 使用非空 TaskOrder 作为完整可执行顺序，遗漏的开关键不自动追加执行；现代结构缺失定义也不执行。一次性 NextTaskId 在内存中清空，当前适配器对带游标计划停止自动重试。TaskRunner/外层返回可吞内部异常，只有独立规则证明的业务事实才计成功。
- BetterGI 锁定版本的 `AutoLeyLineOutcropTask.Start` 在“自动地脉花执行失败”之后抛异常；`GoToAdventurersGuildTask.Start` 的 `_retryTimes = 1`，因此协会异常也是终止失败，并映射到“领取每日奖励”。`OneDragonTaskItem` 捕获的树脂异常仍须报告业务失败。这些规则仅在当前选择中名称唯一时归属，重复名字不任选第一个；后续整轮结束不覆盖失败。匹配命名消息边界，不把引用或堆栈提及当成该任务日志。当前修复不代表已有完整开始、成功或内部恢复覆盖；未来上游改变重试次数必须重审。
- MXU `commands/state.rs` 在 stdout 添加毫秒时间前缀。UI 任务消息经 log_to_stdout 才进入宿主；文件中的同名文本、单独结束行、跨 epoch/缺口和重复显示名称都不建立成功。interface import 不在声明白名单或缺失时降低检测覆盖。
- March7th 日常/宇宙、日周月刷新和奖励子模块独立建模。随机内部补做不会扩大冻结的业务范围；培养目标属于技术角色。奖励总包装完成、保存时间戳、历史分数不能替代子模块日志。命名奖励模块的“奖励完成”和明确“未检测到奖励”表示领取检查已成功完成，无需实际领到物品；所有已启用必需奖励子任务满足后，领取奖励父任务才汇总成功。
- March7th `InstanceNotCompleted` 从有效配置模板经 `Base.send_notification_with_screenshot` 逐行写入 INFO，随后才截图和发送 ERROR 级通知。四个已核实失败分支记录当前 source/epoch、父任务、目标副本和内部执行序号；首次失败保留 open 问题事件，不提前重启整项任务。连续三次重试耗尽且退出范围才形成失败；相同目标的显式重试、完整轮次和目标次数证据才能恢复对应事件。另一副本成功、通用完成横幅、历史时间戳不能洗掉失败。历战余响与活动调用独立归属；无法确定范围时保留 unattributed_error，不猜给清体力。
- `Probe-March7thBranches.py` 在哈希锁定的上游原方法体中执行四个通知分支、截图失败、三次重试和同目标恢复，依赖均为内存控制对象。夹具中的公开 issue #690 只有正文摘录及报告者版本，不等同已验证发行二进制或完整运行。孤立的旧式 ERROR 简化行属于负例。默认关闭的签到 [日志桥原型](../tools/march7th-bridge/README.md) 独立于专项 ZIP；它不表示官方安装版已支持静默分支。
- ZZZ `ApplicationGroupConfig.update_full_app_list` 将未保存的新注册应用默认设为禁用，不需要虚构启用项。`GroupApplication` 先过滤启用与已完成，再调用外层 Application；嵌套 Operation 与应用组结束不代表全部业务成功。
- ZZZ 绑定根是 `config/<两位实例>/`。新 `one_dragon/_group.yml` 存在时优先使用；不存在时只读取 `one_dragon_app.yml`，不把全局 `one_dragon.yml` 当成任务列表。按锁定 GroupManager 的迁移逻辑，用旧 app_order 排序、app_run_list 决定启用，并补入遗漏的默认注册应用；新注册应用未被旧运行列表选择时保持禁用。旧格式投影仅用于读取，自动重试不改旧列表，因为上游启动会创建新组文件；此时需重新冻结新组后才能获得可验证的补丁目标。`Probe-ZzzMigration.py` 执行锁定上游原类方法验证迁移及新文件优先级。
- ZZZ 编辑工作副本只保留选中实例并写入 `instance_run: 仅运行当前`，保留 BOM、换行和无关根字段；重复或未知运行模式拒绝。`-i` 仅接受绑定的两位实例号，不接受逗号多实例输入。配置隔离不证明或自动切换游戏认证会话。
- BAAH `myAllTask.parse_task/run` 先按 TASK_ONOFF 过滤再执行。`CURRENT_PERIOD_TASK_INDEX` 属于 sessiondict，`MyConfig.parse_user_config` 默认清空，独立新进程不继承旧游标。通用 Task.run 完成仅证明 post_condition；CollectMails 和 CollectDailyRewards 存在无业务确认的返回分支，不能据此计成功。当前日志只支持外层任务身份，嵌套收尾不覆盖外层结果。

## 作者审查清单

两个 ok 插件的初始版本为 `0.1.0`。当前属于开发候选：已核查 China 与 Global 的 ok-ww v3.6.7、ok-nte v1.3.19 完整安装包，日常源码及关键内嵌框架文件与源码锁/对应 wheel 完全一致。经用户明确授权的隔离管理员测试验证官方启动器实际转发 `-a true -u manual -t 1/2 -e`，子进程为包内 Python 3.12.10 `pythonw.exe`，工作目录为 `data/apps/<name>/working/`。解释器保护在业务代码前退出，不能算真实日常完成。

PyAppify 的版本身份异常分支会在手动模式下强制更新；实测异环 v1.3.19 安装包首次启动更新到 v1.3.20。发现/重试阶段只读核对发行 `app.json`、detached HEAD、独立 tag ref 和 manifest 固定的 working 文件 SHA-256，要求与 China/Global 渠道分别匹配的精确版本、已安装、空闲更新器、非运行状态；未知版本及缺失/不匹配身份返回带本地化原因的 unsupported。annotated tag object 与 peeled commit 分别固定，不把两者当同一 SHA。此准入只覆盖检查时的本地身份，不能消除启动器之后远端 tag 变化或外部更新的竞争，固定文件包含入口、配置注册、日常与已解释的业务分支、任务执行器及启动控制器；Host 在运行观察和结束阶段复核，变化后拒绝后续证据及重试。这不验证完整解释器/依赖，也不能证明瞬时替换未发生；完整发行资格仍须执行。`-e` 的框架完成通知不证明业务成功，LauncherTask 完成也不能关闭异环日常范围。

可复现的上游对照工具（所有输出使用仓库外新路径，游戏与 GUI 不会启动）：

```text
python tools/Probe-OkFramework.py --wheel-root <锁定wheel目录> --output <新报告.json>
python tools/Probe-OkNteNormalization.py --source <锁定DailyRoutineTask.py> --output <新报告.json>
python tools/Probe-OkNteBranches.py --source <锁定DailyRoutineTask.py> --output <新报告.json>
```

框架工具直接从 SHA256 校验后的 `ok_script-2.0.4` 和 `2.0.7b1` wheel 执行原 CLI 解析、任务索引选择、队列和执行方法，设备和任务结果由隔离测试端口控制。规范化工具比较原 `normalize_items` 与适配器纯函数，覆盖空列表、重复、互斥、Python 真值及显式选择后的默认补项。分支工具执行日常原方法与原 `_DailyTaskConfig`，验证 False/None、异常、语言跳过、重复入队以及子配置临时切换恢复；进度回调是明确标注的受控输入，不冒称真实战斗或真实 shift 算法。这些工具不导入游戏模块，也不替代实际发行运行验证。

1. 从实际启动入口追踪配置选择、默认值、迁移、父子开关、账号与资源覆盖顺序；为缺省和冲突提供反例。
2. 从业务判断追踪到实际日志输出通道，记录成功、失败、正常跳过、提前返回、异常捕获、内部重试和根结束；每条成功规则必须有正例与近似文本反例。
3. 审查重跑的消费、购买、领取、次数和状态副作用；只有所有扩张任务均安全才允许 retryUnit 与依赖闭包。未知风险停止，不能凭插件名称推断安全。
4. 在 discovery 声明 selectionFields 与 behaviorFields；测试第三方编辑、重名、数组重排和失败后恢复，保留最终计数。
5. 运行真实 Host Jint 夹具和全套资格入口；纯语法通过不能代替状态机、配置 journal 和进程集成。

## 夹具维护

[fixtures](../tools/task-protocol/fixtures) 按插件划分正例、重复名称、缺失身份、日志来源、未配对终态、嵌套与选择重试。`example-*` 覆盖五种配置结构。Host 工具读取真实 manifest 和生成脚本，通过实际 Jint、归并器、选择补丁与恢复；缺少任一官方适配器或零用例会失败。新增可确认规则时，同时增加相反分支；未验证分支保持 unknown 并说明原因。

## 三阶段脚本按职责生成

`phase-modules.json` 声明模块提供的符号、依赖和阶段根。生成器按依赖顺序输出自包含脚本；发现和观察不包含重试执行器，重试保留所需发现逻辑。每次调用使用独立 Jint 环境，跨批次状态只通过受限 cursorState 传递。

- 公共纯函数保留在 `core/`，适配器源文件按职责位于各自子目录，只有一份源码权威。
- 作者模板和五个示例使用同一生成器；未适配模板继续被源码、包和 Host 校验拒绝。
- 每个阶段在访问配置前拒绝错误的 `input.phase`。真实 Host Jint 联调同时验证阶段拒绝、受限 API、发现、观察、选择补丁和恢复。

构建单测验证缺依赖、循环、重复符号、阶段闭包及只读 `--check`。这些测试不替代完整 Host/插件发布资格。

## BAAH 顺序和错误恢复

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

## ZZZ 应用组和体力子范围

观察器使用当前绑定配置顺序、`获取应用组配置`、应用首个 `检测游戏窗口` 节点及组 `执行应用` 回执配对。只收到结束行不能确定是外层应用；同名子操作先结束时，候选结果等到组确认 `app.execute()` 返回后才提交。组结束不等于根一条龙结束。缺口、来源/epoch变化、组次序或跳过名称冲突会放弃范围，不能借旧状态补齐。已完成跳过只接受当前组回执。

原生格式来自锁定 `log_utils.get_log_formatter` 与 `Operation.execute/after_operation_done`，包含 ASCII 时间戳、`operation.py` 和 INFO/ERROR。全角标点、翻译后的级别、引用文字和别的文件伪装的消息不作为生产别名。裸消息用于日志通道和源码派生夹具；未经核实的其他语言名称不猜配。

体力计划的四类副本按分类、具体子调用开始、子返回、父分类节点返回、`挑战完成` 配对。锁定 `ChargePlanApp.challenge_complete` 会把失败计划设为 skipped，同时返回成功让外层继续；该路径保留失败事件，在应用组终态中维持 failed，别的计划成功不清除。操作内异常由原 `Operation.execute` 重试，只有同一子调用成功及父返回确认才将事件记为 recovered；在此之前父任务仍 running。缺少子开始/父回执则保留无法确认，不把外层成功当作恢复。

`python tools/Probe-ZzzBranches.py --source-root <锁定源码> --output <新报告.json>` 执行原 Operation 重试/日志、ChargePlan 返回值消费及 GroupApplication 顺序/跳过方法；节点图和游戏识别是受控依赖，不启动游戏。公开 issue #2797 的转贴格式仅用于定位上述源码，夹具明确是原生格式的源码派生输入，不冒充原始日志附件。其他应用全部内部业务分支和英文日志覆盖仍需各自核查。

China 与 Global 使用独立的 commit/tag 身份，关键 working 文件逐字节一致。China 隔离官方 EXE 的参数转发测试同样通过；两款启动后的版本和业务入口保持原身份。`fixtures/resources/` 中的共享文件明确标注 synthetic，仅测试真实 Host 的哈希机制，不能用作官方包的来源证据。

M7 云游戏模式不比较本地游戏路径。`after_finish: Loop` 在明确有后续队列时阻断，没有后续时允许，队列未知则提醒；普通暂停与 Host 清理不冲突，不要求用户强制关闭游戏或脚本。

BAAH 目标字段 `TARGET_EMULATOR_PATH`、`TARGET_IP_PATH`、`TARGET_PORT` 来自当前用户主配置，软件配置仅提供 `SAVE_LOG_TO_FILE`。路径声明按唯一主配置解析，文件改名不会切换账号；缺省 IP/port 按锁定 defaultSettings 为 127.0.0.1/5555。端口支持原生整数；显式 null 或错误类型不伪装为缺省。直接 ADB 序列号不能与 Host 的网络端点证明为同一设备，显示 unknown/warn。日志开关缺省 false；文件日志关闭且无可用 stdout 时阻断，有可用 stdout 时无需强制开启文件日志。

Host 联调工具的 `--runtime-installations <matrix.json>` 从显式 `cases`（id/artifact/root/expectedEvaluation）只读捕获官方安装资源，账号配置仍为合成夹具；`output` 指向不存在的报告路径。`--validator-comparison <inputs.json>` 使用显式 legacyCommit/scripts（artifact/path/sha256）与当前四个生产适配器进行只读 Jint 对照，覆盖路径、ADB 默认值和日志开关。两者均先传 `--plugin-root <插件检出>`；不能用合成资源集合代替安装来源证据。运行前用 `dotnet build <Host>/tools/NexusPipeline.TaskProtocolTests -m:1 -p:NexusTestHost=true` 构建，随后运行对应 Test Host 输出 DLL。

MXU 匿名 focus 的限制已通过锁定原 `handleCallback` 实际执行核实：异步内容解析可晚于下一任务开始，输出 log/stdout 不携带原 task_id。适配器因此不按“最近任务”分配它，也不把此类文本当成独立业务终态；两产品均有 Jint 反例。外层回调只能证明其自身配对范围，无身份的内部 focus 仍是明确受限项，不能承诺从外层成功确认每个内部资源节点。
