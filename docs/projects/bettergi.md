# BetterGI 0.5.0

仅支持当前锁定的 BetterGI 0.66.0。来源为官方非 draft、非 prerelease Release，完整 commit 为 `0af68c28f6b0e714d5304625ce644736d508022e`，tree 为 `b6c9b16ce2372abb54478179daa7e01486ac8ec8`。发行资产与源码锁见 [upstream.json](../../plugins/specialized/bettergi/upstream.json)。源码归档核验不代替二进制资格。

适配器手写入口是 `plugins/specialized/bettergi/adapter/main.js`；`adapter/sources.json` 为按序输入清单，包含 JSON 读取、配置与任务、日志模块。构建只将这些源合并到显式仓外产物，不把上游源码或生成 runtime 放入仓库。

## 配置与任务身份

Host 从 `BetterGI.exe` 所属安装中明确选择 `User/OneDragon/<配置>.json`，绑定内存资源 `one-dragon`；附加 `User/config.json` 绑定 `extra-user-config`。多配置不能任取第一个；选择另一配置时，Host 必须同时绑定该配置的真实快照、名称、摘要和修订。上游命令行是 `BetterGI.exe startOneDragon <配置名称>`，游戏启动由上游执行；适配器不自行启动游戏。

现代 `TaskDefinitions` 将 ID 映射为名称，`TaskOrder` 恢复执行顺序，`TaskEnabledList` 保存开关，`NextTaskId` 限定本轮范围。旧配置以键作为名称和身份。同名任务保留不同 `bettergi:<原键>`。未列入 TaskOrder 的键、仅有定义的条目及未知配置字段保留，不擅自加入执行范围。

未知游标形成 blocking 诊断并停止自动扩大选择；已知游标保留原位置，阻断选择重试。重复 JSON 成员、重复 TaskOrder、无穷数字与格式不明配置明确拒绝。Host 另行校验资源原字节摘要与冻结计划。

## 逐业务映射

下列上游路径均相对于锁定源码的 `BetterGenshinImpact/`，外层任务映射归 `Model/OneDragonTaskItem.cs` 和 `ViewModel/Pages/OneDragonFlowViewModel.cs`。

| 旧支持范围 | 锁定上游业务来源 | 新适配与保留内容 | 已执行证据 |
|---|---|---|---|
| 领取邮件 | `GameTask/Common/Job/ClaimMailRewardsTask.cs` | 无邮件可正常闭环；异常不能被 finally 覆盖 | 发现、闭环、失败、缺终态、有限重试用例 |
| 合成树脂 | `GameTask/Common/Job/GoToCraftingBenchTask.cs` | 范围 ERR 为失败；不重置树脂与保留额度 | 同上，额度与未知字段保全 |
| 自动秘境 | `GameTask/AutoDomain/AutoDomainTask.cs` | 区分正常 INFO 返回与错误/中断；不猜内部副本节点 | 闭环、策略缺失、缺终态及中断反例 |
| 自动首领讨伐 | `GameTask/AutoBoss/AutoBossTask.cs` | 正常 INFO 树脂不足可闭环；保留累计成功次数和领奖上限 | 树脂 INFO、错误、计数写入拒绝 |
| 自动幽境危战 | `GameTask/AutoStygianOnslaught/AutoStygianOnslaughtTask.cs` | 只证明外层流程；内部难度与节点不扩张 | 发现、闭环、失败及有限重试用例 |
| 自动地脉花 | `GameTask/AutoLeyLineOutcrop/AutoLeyLineOutcropTask.cs` | 未在执行日期为正常返回；次数、日期与消耗参数保留 | 日期跳过、闭环、失败及未知字段保全 |
| 领取每日奖励 | `GameTask/Common/Job/GoToAdventurersGuildTask.cs`、`ClaimBattlePassRewardsTask.cs` | 失败由本轮范围判断，不以历史状态补终态 | 发现、闭环、失败及缺终态用例 |
| 领取尘歌壶奖励 | `GameTask/Common/Job/GoToSereniteaPotTask.cs` | 只判断外层领取流程；无可领内容不凭文本猜失败 | 发现、闭环、失败及有限重试用例 |
| 配置组与自定义名 | `Service/ScriptService.cs` | 独立组序号、明确组名、加载与结束闭环；任意 JS 内部业务保持未知 | 内置/组交错、组失败、错误名称及 DBG 失败用例 |
| 配置组选取 | `Helpers/CommandLineOptions.cs`、`ViewModel/Pages/OneDragonFlowViewModel.cs` | 明确绑定配置，提议修改 `selectedOneDragonFlowConfigName` | 选取提案、未绑定名称拒绝与 CAS 冲突用例 |
| 配置任务编辑 | `Core/Config/OneDragonFlowConfig.cs` | 开关、已知名称映射、原有任务顺序；不隐式创建新组文件 | 编辑意图、重复写入、未知字段与游标保护用例 |
| 完成动作 | `ViewModel/Pages/OneDragonFlowViewModel.cs` | 保留空/无/关闭游戏/关闭软件/关闭游戏和软件；关机或未知动作提议改无 | 合法动作保留及绑定修复提案用例 |

## 日志与重试

`App.xaml.cs` 的文件信封含时间、级别、BgiInstance 与 SourceContext，正文位于下一物理行。只接受 Host 提供的本轮 `upstreamProcessId` 所属 PID；缺失 PID 时返回 unknown。另一个实例即使是唯一文本上下文，也不能证明本轮成功。stdout 不作为文件信封来源。

`logEvents` 只接受主声明文件流 sourceId=`file:0`，epoch、sequence 和 `observationCheckpoint` 支持跨批正文及活动范围；其他文件流不归并。checkpoint 绑定 run、attempt、plan 和进程 PID。重复 sequence 忽略，旧 epoch 忽略，序列缺口或轮换不能拼接未闭合范围。完整闭合的历史范围可跨轮换保留。checkpoint 由 Host 在同一冻结调用链中持有，适配器不自行持久化。

一条龙序号分母按上游使用全部启用任务数，配置组使用独立组数量；内置任务结束要求对应 TaskRunner 的启动/结束，嵌套 runner 不提前闭合。配置组要求同一组名的加载/结束。异常 continuation、裸任务名、任意脚本正文、最终整轮横幅及未证明正常的中断都不能补造成功。ERR、取消或明确组失败保持失败；成功只在 `logComplete=true` 的完整流结果中交付。

retry 只返回冻结、已启用、已选且明确失败的内置 ID；成功、partial、unknown、原禁用和范围外任务保留。任意配置组的外部副作用未证明安全，不自动重放。选择提案仍需 Host 的安全策略、writer 停止、恢复、预算与绑定配置投影；本适配器不重置累计次数、日期、资源额度或游标。
每个现存布尔任务开关绑定 `TaskEnabledList` 投影。原一条龙入口在业务循环前执行游戏启动，重试沿用该入口；观察序号与检查点绑定实际重试子集。原插件 ZIP 已通过受控 Host 持久重试，验证旧进程族停止、成功项保留和原配置恢复；真实 BetterGI 游戏会话仍需另行验收。

## 配置提案

configuration 输入的 `configurationIntents` 是显式用户意图。每项完整绑定 operation、resourceId、sourceSha256、expectedRevision、selector、expected 和 value；全部预检通过才返回原范围 CAS 提案。重复/重叠 selector、过期摘要/修订、未绑定配置名与未知字段修改均拒绝。附加配置中游戏路径编辑需要明确意图；实际路径存在性和绑定游戏身份仍由 Host 核实。

当前允许已有任务布尔开关、同一任务集合的顺序、已知名称映射、受支持完成动作及明确绑定配置的选取。游标不为空时不改任务顺序。任务计数、日期、预算、账号和未知字段没有自动编辑入口。没有文件写入旁路；实际提交和恢复归 Host。

## 验证与剩余资格

专属入口：

```text
node tests/specialized/bettergi/verify.mjs --output <显式仓外报告目录>
python -B tests/specialized/bettergi/native_verify.py --host-root <实际Host源码> --jint-assembly <已声明Jint.dll> --acornima-assembly <已声明Acornima.dll> --output <同一仓外报告目录>
```

Node VM 和从实际生产 `BoundedTaskScript.cs` 编译的独立组件探针运行相同 source-derived 用例，报告分别写 node-report.json、native/report.json 和 native/receipt.json，包含命令、退出码、耗时、源码和程序集摘要。它们证明四阶段算法与真实 Jint 解释器组件行为，不代表安装 Host 或真实上游。

以下仍须由正式整合验证：冻结 SDK producer 的消费身份、完整 TaskAdapterExecutor 及安装包接入、当前 Host 的日志读取与声明绑定、持久选择重试/停止 writer/恢复、实际配置 UI，以及真实 0.66.0 发行二进制的隔离配置消费、受控失败、取消与再运行。未运行资格记 NOT_RUN；不要求真实账号日常或真实奖励核验。
