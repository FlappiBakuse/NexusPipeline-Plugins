# 官方专项任务适配边界

实现入口为 `tools/task-protocol/`，发布脚本由生成器写入各插件 `data/`。上游仓库、固定 commit 和逐文件 SHA256 见 [source-lock.json](../tools/task-protocol/source-lock.json)。更新上游后需要重新审查，不能只更新摘要。所有配置和日志夹具均为合成数据，不含用户现场。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| BetterGI | GUID/旧任务名、TaskDefinitions、显式 TaskOrder；缺省顺序回退开关键；NextTaskId 限定本轮 | 邮件领取/空邮件均满足任务，接受结构化日志字符串引号；异常仍失败；地脉不在运行日期；整轮结束仅为边界 | 无一次性游标时的邮件；重复名称、未知任务、消耗资源均保守停止 |
| MaaEnd | MXU autoStartInstanceId 唯一实例、稳定任务 ID、运行时 interface/import、customName/locale、controller/resource 兼容 | MXU stdout 当前任务开始/完成/失败配对；时间前缀不参与身份 | 风险未证实的任务停止；不按显示名称写配置 |
| MaaStellaSora | 同一 MXU 协议，只接受 MaaStellaSora 接口；机器 ID 保持 maas | 与 MaaEnd 共用来源与配对规则 | 非 MXU、未知接口/缺失实例明确不支持 |
| March7thAssistant | config.yaml 与上游默认值，13 个一级入口、奖励/活动/资产/历战子开关；父禁用抑制子任务 | 日常目标、宇宙固定次数、当前运行未刷新；奖励子模块的明确完成或无可领奖励均为成功；模块明确失败 | 所有未证明完整重跑安全的模块停止；固定次数/日期不当作成功日志 |
| ZenlessZoneZeroOneDragon | 当前账号 one_dragon/_group.yml；旧 app_order/app_run_list 只读发现；保存的未知应用仍可见 | 唯一已注册外层应用终态，应用组当前运行的已完成跳过；嵌套不同名指令不归给外层 | 新结构邮件；旧结构与其他应用停止；不修改其他账号 |
| BAAH | 活动流水线、任务序号和名称、平行 TASK_ONOFF；完整名称数组作为 guard；自动登录/收尾分别建模 | Task.run 嵌套栈限定外层；免费奖励明确确认；致命后置失败及后续未执行 | 仅已审查的重复领取/登录；同类多任务身份歧义不推断；整个平行数组 CAS |

所有生产适配器当前 coverage 为 partial，不承诺任意第三方版本和自定义脚本都能完整判定。没有对应当前运行证据时保持 unknown；未知任务不会被从分母移除。MXU 的外层 callback 不证明每一个内部资源节点都达到业务目标，因此不伪造无独立证据的子任务。

## 运行结束边界

运行结束与业务任务成功分别判断。关闭游戏、关闭脚本、通知发送完成、保存计数和通用“完成”横幅均不能单独证明本轮任务完成。

| 适配器 | 当前运行边界依据 |
|---|---|
| BetterGI | 一条龙和配置组任务结束 |
| March7thAssistant | game.stop 的“停止运行”一级标题，位于可选退出/循环/暂停之前；顶层“发生错误”记录异常结束。启动和各模块也输出“完成”，不能据此结束整轮 |
| ZenlessZoneZeroOneDragon | 外层“一条龙”的执行成功/失败；应用组完成尚可能继续切换实例，不能提前结束 |
| BAAH | BAAH_main 在 my_AllTask.run 返回后输出“所有任务结束”，早于可选关闭游戏/模拟器；通用退出提示不作为成功依据 |
| MaaEnd / MaaStellaSora | 同一 stdout epoch 内，全部已选任务具有唯一名称匹配的开始与终态回调；缺失、歧义或日志缺口保持未确认 |

MXU 的 system 语言配置按可用接口翻译解析，观察阶段接受经声明的各语言名称；跨语言同名仍拒绝歧义。adapters.json 的 importTasks 记录固定源码审查得到的导入任务索引，只读取本轮配置涉及的接口分片，避免无关的大型选项树耗尽 Jint 配额。索引未知的导入仍尝试读取，无法确认的任务保留 unsupported；上游调整导入布局时需重新审查。JSONC 解析保留字符串中的 URL、注释样式文本和逗号，宿主原有时间、语句与内存限额保持不变。

真实实例导出可以通过显式只读回放入口检查；单份当前配置不代表每一份历史日志当时的配置。原始配置、日志及包含实例身份的报告保留在仓库外，正式 fixture 使用合成数据。星塔旅人无真实样本时仅报告同架构源码与合成契约验证，不冒称完成真机验证。

## 关键源码分支与反例

- BetterGI `OneDragonFlowViewModel.LoadDisplayTaskListFromConfig` 使用非空 TaskOrder 作为完整可执行顺序，遗漏的开关键不自动追加执行；现代结构缺失定义也不执行。一次性 NextTaskId 在内存中清空，当前适配器对带游标计划停止自动重试。TaskRunner/外层返回可吞内部异常，只有独立规则证明的业务事实才计成功。
- MXU `commands/state.rs` 在 stdout 添加毫秒时间前缀。UI 任务消息经 log_to_stdout 才进入宿主；文件中的同名文本、单独结束行、跨 epoch/缺口和重复显示名称都不建立成功。interface import 不在声明白名单或缺失时降低检测覆盖。
- March7th 日常/宇宙、日周月刷新和奖励子模块独立建模。随机内部补做不会扩大冻结的业务范围；培养目标属于技术角色。奖励总包装完成、保存时间戳、历史分数不能替代子模块日志。命名奖励模块的“奖励完成”和明确“未检测到奖励”表示领取检查已成功完成，无需实际领到物品；所有已启用必需奖励子任务满足后，领取奖励父任务才汇总成功。
- ZZZ `ApplicationGroupConfig.update_full_app_list` 将未保存的新注册应用默认设为禁用，不需要虚构启用项。`GroupApplication` 先过滤启用与已完成，再调用外层 Application；嵌套 Operation 与应用组结束不代表全部业务成功。
- BAAH `myAllTask.parse_task/run` 先按 TASK_ONOFF 过滤再执行。`CURRENT_PERIOD_TASK_INDEX` 属于 sessiondict，`MyConfig.parse_user_config` 默认清空，独立新进程不继承旧游标。通用 Task.run 完成仅证明 post_condition；CollectMails 和 CollectDailyRewards 存在无业务确认的返回分支，不能据此计成功。当前日志只支持外层任务身份，嵌套收尾不覆盖外层结果。

## 作者审查清单

1. 从实际启动入口追踪配置选择、默认值、迁移、父子开关、账号与资源覆盖顺序；为缺省和冲突提供反例。
2. 从业务判断追踪到实际日志输出通道，记录成功、失败、正常跳过、提前返回、异常捕获、内部重试和根结束；每条成功规则必须有正例与近似文本反例。
3. 审查重跑的消费、购买、领取、次数和状态副作用；只有所有扩张任务均安全才允许 retryUnit 与依赖闭包。未知风险停止，不能凭插件名称推断安全。
4. 在 discovery 声明 selectionFields 与 behaviorFields；测试第三方编辑、重名、数组重排和失败后恢复，保留最终计数。
5. 运行真实 Host Jint 夹具和全套资格入口；纯语法通过不能代替状态机、配置 journal 和进程集成。

## 夹具维护

[fixtures](../tools/task-protocol/fixtures) 按插件划分正例、重复名称、缺失身份、日志来源、未配对终态、嵌套与选择重试。`example-*` 覆盖五种配置结构。Host 工具读取真实 manifest 和生成脚本，通过实际 Jint、归并器、选择补丁与恢复；缺少任一官方适配器或零用例会失败。新增可确认规则时，同时增加相反分支；未验证分支保持 unknown 并说明原因。

## 待改进：三阶段脚本按职责生成

当前生成器将公共工具、单个适配器的发现/判定/重试逻辑及 dispatch 入口完整写入 discover.js、judge.js、retry.js，因此同一插件内三个文件内容相同。运行时通过 input.phase（discover / observe / retry）选择入口；每次调用使用独立 Jint 环境，不共享执行状态。这是复用源码、保持独立可执行文件的打包选择，并非协议要求，也不带来额外安全或性能收益。

- [ ] 保留 tools/task-protocol 的公共源码，改为按阶段生成所需依赖及固定入口；retry 继续复用必要的 discovery 逻辑。
- [ ] 同步作者模板与五个示例，减少重复载荷及无关代码解析，并验证错误阶段输入被明确拒绝。
- [ ] 用现有真实 Host Jint 夹具及完整插件资格验证发现、判定、选择补丁、恢复行为不变。

此项尚未实施；当前验收包沿用已验证的完整打包方案。
