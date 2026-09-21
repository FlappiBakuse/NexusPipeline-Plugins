# 专项任务协议 1.0

`data-specialized` 插件可以通过 `taskProtocol` 显式启用任务计划、日志事实与选择性重试。最低宿主版本为 `0.16.8`；旧式 judge 仍使用原有接口。声明错误、缺失脚本或未知协议版本会被拒绝，不能回退到旧 judge。

```json
{
  "minHostVersion": "0.16.8",
  "judgeScript": "data/judge.js",
  "taskProtocol": {
    "version": "1.0",
    "discoverScript": "data/discover.js",
    "retryScript": "data/retry.js",
    "readResources": []
  }
}
```

三个脚本均在宿主 Jint 内执行，一次只能 `console.log` 一个 JSON 结果。`input` 与 `nexus.input` 相同。仅提供 `nexus.readConfig(id)` 和 `nexus.readResource(id)`，返回 `{document, format, revision}`；缺失资源抛出可捕获的 `config_unavailable`。没有任意文件读写、进程、网络、截图或 CLR 接口。

`readResources` 最多 128 项，每项为 `{id, source, path, format, required}`。`source` 为 `root` 或 `extraConfig`；前者相对实例根目录，后者路径以附加配置索引开头，例如 `0/settings.json`。格式为 `json`、`yaml` 或 `text`；JSONC 接口可声明为 text 后由适配器解析。路径禁止绝对路径、回退段和重解析点；只读资源永远不可作为补丁目标。

## 发现与只读预览

`phase: discover` 输入包含 `pluginId`、`userId`、`scriptInstanceId`、`origin`、`locale` 和 `configResources: [{id,format}]`。资源标识采用 `config:<相对路径>`。预览读取用户存储快照，不交换配置、不启动上游、不执行前后置脚本。运行在前置脚本完成后重新读取实际配置，冻结独立的 originalPlan。

输出为 `{protocolVersion:"1.0",type:"discovery",coverage,tasks,diagnostics,selectionFields,behaviorFields}`。coverage 为 complete、partial、unsupported。每项 task 包含稳定 id/sourceKey、name、parentId、role、enabled、order、countsAsUnit、requiredForParent、retryUnitId、retryRisk、dependencies、detection，可附 configRef。角色 business/technical/cleanup；检测 supported/limited/unsupported；风险 safe/conditional/unsafe/unknown。未知任务必须保留。任务最多 1024 个，父链最多 8 层，依赖链最多 128 层，禁止环和重名身份。

`selectionFields` 是补丁授权清单：`{resourceId,selector,purpose}`，purpose 仅 selection/cursor。宿主冻结字段身份、原值和当前值；重试不能扩大授权。selector 示例：

```json
["instances", {"by":"id","value":"instance-a"}, "tasks", {"by":"id","value":"task-a"}, "enabled"]
```

仅有数组序号时必须使用 `{index,guardKey,guardValue}`，guard 要完整识别被选中的对象，不能仅按名称选第一个。补丁支持布尔值、字符串及其平面列表；YAML 目前仅支持标量及流式列表替换，拒绝锚点、别名、标签、合并键、重复键和多文档。保留未选中字段的字节、注释、BOM 和换行。

`behaviorFields: [{resourceId,selector}]` 声明影响任务行为的只读配置投影。宿主仅将规范化后的语义纳入计划签名，不将这些原值写入 TaskReport。不要包含日期、完成计数或临时游标。选项、计划次数、队伍等变化应使新预览与旧历史签名不同。历史本身始终不变。

## 当前运行日志观察

`phase: observe` 输入包含 runId、attemptId、attemptNumber、originalPlan、attemptTaskIds、acceptedState、adapterState、logBatch、isFinalCall、terminationReason。acceptedState 按任务 ID 给出 `{status,executionOrdinal}`；logBatch 为 `{records:[{sourceId,epoch,sequence,text}],hasGap}`。游标由宿主生成，插件不能确认或改变它。

输出 `{protocolVersion,type:"observation",runId,attemptId,observations,runBoundary,boundaryEvidence,diagnostics,cursorState}`。observation 为 `{id,taskId,executionOrdinal,status,reasonCode,evidence,skipKind?}`。evidence 为 `{sourceId,epoch,sequence,ruleId}`，必须引用当前尝试已收到的真实日志。skipped 必须明确 satisfied/inapplicable；blocked 必须有可确认未执行的日志证据。runBoundary 为 open/ended/aborted/unknown，ended/aborted 也要证据。

观察异常或非法输出不推进游标，完全相同的 observation ID 可幂等重放，变更事实的同 ID 会被拒绝。同一执行序号的矛盾终态变为 unknown；内部重跑需先提交更高序号的 running。可用 cursorState 保存跨批次嵌套栈等纯日志派生状态，最多 64 KiB；它不是持久配置或成功依据。hasGap 时不得从缺失的开始/结束配对推断成功。进程退出只触发最终日志排空，不证明业务成功。

## 选择重试与恢复

`phase: retry` 输入包含 originalPlan、taskStates、attemptsUsed、maxAttempts、cancelled、budgetExhausted、configResources。输出 `{protocolVersion,type:"retry",decision,reasonCode,includedTaskIds,prerequisiteTaskIds,expandedUnitIds,filePatches}`。decision 为 stop/selective，stop 必须所有动作数组为空。

每个 filePatch 为 `{resourceId,format,expectedRevision,operations}`；每项 operation 为 `{selector,expected,value,purpose}`。revision 是宿主生成的随机不透明令牌，只用于当前快照 CAS，不能缓存到下次调用。宿主另行计算失败与有证据 blocked 的闭包，验证必要前置与重试单位。conditional/unsafe/unknown 风险均停止自动重试，不开启原先关闭的业务任务。提升父任务范围要验证整个范围安全。

多文件补丁先全部预检，再通过 staged/committed journal 提交。停止目标进程并确认清理后，仅恢复原始选择，保留实际运行后计数；随后才同步用户快照。第三方改动或恢复冲突时保留现场，拒绝覆盖。宿主崩溃后的任务检查点以 interrupted 历史恢复，已确认事实保留，未终结任务为 unknown。

## 限额与测试

每次输出最多 1 MiB；预览预算 2 秒，运行阶段 30 秒，最多 200 万条语句。配置单文件 2 MiB、总计 32 MiB/256 个资源；选择事务最多 32 个文件和 2048 个字段。日志缓冲受限，超限显式 hasGap；每条证据最多保存 1024 字符片段，完整日志仍走历史归档。

生产脚本由 `tools/task-protocol/common.js`、各适配器源文件与 `adapters.json` 确定性生成。上游固定版本和文件摘要保存在 `source-lock.json`；fixture 使用合成数据，规则来自对应源码，不读取真实用户数据。

```text
python tools/generate_task_protocol.py
python tools/generate_task_protocol.py --check
dotnet run --project <Host>/tools/NexusPipeline.TaskProtocolTests -- --plugin-root <Plugins>
python tools/repository.py qualification --group source --base <B> --host-root <Host> --sdk-sha <SDK_SHA>
```

P1 执行生成一致性与真实 Host Jint/归并器/配置 journal 的六适配器测试。Node 语法检查不是此测试的替代品；零夹具或缺少任何适配器均失败。完整正式资格还要求 P2/P3 和干净且固定 SHA 的 Host checkout。

## 作者模板

[JSON Schema](../contracts/task-protocol.schema.json) 描述三个阶段的输出，跨字段约束由宿主继续校验。使用 `python tools/create_task_plugin.py --artifact MyAdapter --name my-adapter --output <新目录>` 创建待适配模板。默认模板含 `__NXP_ADAPTATION_REQUIRED__` 标记，源码、ZIP 和宿主加载均拒绝该标记。完成上游源码审查和证据/风险规则后才能移除。

`--example` 生成完整的合成协议示例。[TaskProtocolExample](../examples/TaskProtocolExample/README.md) 由模板生成并经过真实宿主 Jint、重试与恢复测试；它不在发行 catalog 中，也不代表任何真实游戏。生成器拒绝覆盖已有输出；`--check` 用于验证示例与模板一致。

生成器支持 `--preset json-id-array|json-map|json-parallel-array|yaml|mxu` 五种结构。`examples/` 中每种预设都有确定性生成的合成示例和真实 Host 夹具；这些安全重试规则只适用于虚构任务，不能直接用于游戏。默认模板仍须完成源码审查后才能打包。

六个官方适配器的源码分支、保守支持范围和作者审查清单见 [专项适配边界](TASK_ADAPTERS.md)。
