# 专项任务协议

`data-specialized` 插件可以通过 `taskProtocol` 显式启用任务计划、日志事实与选择性重试。最低宿主版本为 `0.16.8`；旧式 judge 仍使用原有接口。声明错误、缺失脚本或未知协议版本会被拒绝，不能回退到旧 judge。

```json
{
  "minHostVersion": "0.16.8",
  "judgeScript": "data/judge.js",
  "taskProtocol": {
    "version": "0.1.0",
    "discoverScript": "data/discover.js",
    "retryScript": "data/retry.js",
    "readResources": [],
    "localization": { "defaultLocale": "zh-CN", "messages": { "zh-CN": "data/i18n/zh-CN.json" } },
    "configRules": [{ "id": "example.configuration", "required": true, "criticality": "advisory_or_contextual" }],
    "environmentChecks": []
  }
}
```

三个脚本均在宿主 Jint 内执行，一次只能 `console.log` 一个 JSON 结果。`input` 与 `nexus.input` 相同。仅提供 `nexus.readConfig(id)` 和 `nexus.readResource(id)`，返回 `{document, format, revision}`；缺失资源抛出可捕获的 `config_unavailable`。没有任意文件读写、进程、网络、截图或 CLR 接口。

## 日常协议 0.2.0

`0.2.0` 要求 `minHostVersion >= 0.16.14`，三阶段线版本保持 `0.2.0`，manifest 包含 `repairRules` 数组。旧 `0.1.0/0.1.1` 保持原解释，不能只改 manifest 版本就假定适配器满足新语义。

任务必填：`completionPolicy: flow|authoritative`、`workflowRole: daily|technical|manual_only`、`observationContract: {ruleSetId,sources,rules:[{id,kind}]}`、`retryPolicy: {mode: selective_config|native_resume,resourceConsumption,limitRefs}`。启用日常任务必须声明可支持的观察范围；manual_only 不能启用或计数。规则最多64个、来源最多8个，规则及来源唯一。

观察增加 `factKind`：scope_started→running、flow_ended/business_succeeded→succeeded、business_failed/upstream_cancelled→failed、normal_skip→skipped、not_executed→blocked。business_succeeded 仅允许 authoritative；flow_ended 仅允许 flow。证据至少有一项匹配事实类型，所有证据来源及规则均须在该任务冻结声明中。Host 的 missing/gap/observer/process 事实不能由脚本生成。

重试输出保留已有 included/prerequisite/expanded/filePatches，并增加 `targetTaskIds` 和 `launchScopeTaskIds`。stop 的动作数组必须全空。native_resume 的目标是未完成任务、启动范围是全部原启用任务，补丁及扩展数组为空；Host 复核行为未变化，不通过写时间戳或重置次数实现续跑。selective 继续使用最小选择字段补丁，保留预算、额度、进度和账号隔离；资源消耗不是新日常协议的拒绝原因。partial 子树禁止重试。

模板命令 `python tools/create_task_plugin.py --help` 支持 `--protocol-version 0.2.0`。可执行例子为 `examples/DailyProtocolExample`；Host 联调工具的 `--daily-protocol <新的外部目录>` 实际验证 Jint 三阶段、失败重试、选择恢复、计数及其他账号字节、报告2保存/重读。该测试不代表上游发行已实测。

## 文本与包版本兼容

`0.1.0` manifest 必须声明 `localization`，例如 `{ "defaultLocale": "zh-CN", "messages": { "zh-CN": "data/i18n/zh-CN.json", "en-US": "data/i18n/en-US.json" } }`。文件是 key 到字符串的平面 JSON 对象；最多 16 种语言、各 4096 项、总计 256 KiB。词条最长 2048 字符。源码、ZIP 与 Host 都校验路径、重复成员、类型和预算。旧开发版的 `1.0`、`1.1`、`1.2` 声明均不再加载。

`0.1.1` 是 Host v0.16.9 增加的**包声明**扩展：必须声明 `repairRules` 数组，并把 `minHostVersion` 设为至少 `0.16.9`。三阶段输入和输出的 `protocolVersion` 仍为 `0.1.0`。旧 Host 会拒绝整个 `0.1.1` 包，不能忽略未知修复字段后继续运行。空数组表示没有自动修复能力。

0.2.0 的修复权限由 `repairRules` 声明，策略由 `configEditor` 生成提案，Host 负责验证与事务。详见 [配置编辑契约](CONFIG_EDITOR.md)。discover 仅做只读配置诊断。

所有阶段使用协商的 `input.protocolVersion`。任务保留原始 `name`，可增加 `nameText`；观察、诊断和重试可增加 `reasonText`。两种严格形态为：

```json
{"kind":"plugin","key":"task.daily.name","args":{},"fallback":"每日任务"}
```

```json
{"kind":"literal","value":"用户自定义名称"}
```

key 限 160 个 ASCII 字母、数字、点、横线或下划线。args 限 16 项，值只能为字符串（256 字符以内）、有限数值或布尔值；使用 `{argument}` 占位符，不递归替换，不传账号、凭据或原始日志。literal/fallback 最长 2048 字符。引用不接受 owner，Host 自动绑定当前插件；动态名称直接使用 literal，不按中文反向查词典。

Host 冻结启动时的完整词典，预览及历史只保存实际引用的翻译；运行中新出现的原因 key 也只能读取该冻结词典。卸载/更新不影响历史。超出显示预算时保留任务、原名、代码与 fallback，不删任务。语言回退依次为请求 locale、同语言、defaultLocale、fallback、原名/代码。文本不影响任务身份、配置行为签名或安全重试。

`readResources` 最多 128 项，每项为 `{id, source, path, format, required}`。`source` 为 `root` 或 `extraConfig`；前者相对实例根目录，后者路径以附加配置索引开头，例如 `0/settings.json`。格式为 `json`、`yaml` 或 `text`；JSONC 接口可声明为 text 后由适配器解析。路径禁止绝对路径、回退段和重解析点；只读资源永远不可作为补丁目标。

包声明 `0.1.1` 中，`source: root`、`format: json` 的只读资源可声明 `operationalFields`，例如 `{ "running": "boolean", "last_start": "timestamp" }`。最多两项；发行身份、渠道、版本和更新字段不可声明为运行期可变。受限运行仅允许这些字段按类型改变，未声明字段保持原值。OK 的 `running` 是持久线索，Host 另检查安装目录中的嵌入式 worker；活动或不可读会阻断，确认无 worker 且标记遗留才允许基础受限流程。

## discover 配置诊断

`0.1.0` 的 `discover`、`observe`、`retry` 阶段均包含文本引用能力，`discover` 还必须返回只读 `configAssessment`。任务词典放在 `data/i18n/{locale}.json`；manifest 必须声明 `configRules` 与 `environmentChecks`。Host v0.16.9 拒绝声明已退役 `configValidator` 的旧包，并提示升级或卸载，用户配置不变。

`configRules` 是插件规则 ID 清单，形如 `{ "id": "example.configuration", "required": true, "criticality": "advisory_or_contextual" }`；`criticality` 只能是 `critical_when_applicable` 或 `advisory_or_contextual`。每次 discover 必须为每条 required 规则返回一次 `satisfied`、`violated`、`unknown` 或 `not_applicable`，不能缺失后默认为通过。

配置评估的结构为：

```json
{
  "schemaVersion": "1",
  "checks": [{
    "ruleId": "example.configuration",
    "evaluation": "violated",
    "severity": "error",
    "executionEffect": "block",
    "scope": { "kind": "binding" },
    "locations": [{ "source": "config", "resourceId": "config:settings.json", "selector": ["enabled"] }],
    "reasonText": { "kind": "plugin", "key": "diagnostic.configuration", "args": {}, "fallback": "请检查配置。" },
    "actions": [{ "kind": "open_binding_editor" }, { "kind": "refresh_plan" }]
  }]
}
```

`severity` 为 `info`、`warning` 或 `error`；`executionEffect` 为 `none`、`warn` 或 `block`。`scope` 限于 binding、queue 或当前计划中的 task。`locations` 只能引用已声明资源/配置 selector、受限 context field 或 manifest 中的 environment inspection ID；每个检查最多 8 个位置、3 个动作，整个评估最多 128 个检查。动作仅允许打开绑定编辑器、打开脚本设置或重新检查。阻断必须来自 manifest 的 critical 规则并带有合法 `reasonText`；unknown 不是 violated，也不能被普通建议规则擅自升级为阻断。

`0.1.0` discover 输入附带 Host 生成的 `executionContext`。脚本只能调用 `nexus.inspectDeclaredTarget(id)` 查询 manifest 已声明目标的状态/类型/上下文匹配结果；API 不接受任意路径、不返回原始内容、不读网络、不启动进程。Host 将合法评估聚合为独立的 `currentReadiness`（ready、attention、unknown、blocked），并生成 `checkedAt`、`configRevision`、`contextFingerprint` 和 `assessmentId`。这些可信身份不能由插件伪造，语言变化也不能改变任务行为签名。

配置保存成功后，诊断失败只更新检查状态，不回滚保存。预览是只读的；启动前、前置脚本完成后和 retry 前均须用实际配置重新检查。阻断启动建立 `admissionBlocked` 事实，不创建虚假的游戏 attempt、任务失败日志或成功配额消耗；历史显示“未启动：配置检查未通过”。

系统动作判定按当前绑定和实际队列上下文执行。BetterGI 已保存的“关闭游戏和软件”明确表示关闭游戏并退出上游程序；若后续队列仍需游戏则阻断，单独或末项运行可放行。上游 Loop、关机、睡眠、休眠、重启及注销在 Host 完成配置恢复前可能执行，即使是队列末项也阻断；这些动作需用户在上游配置中调整后重新诊断。静音/取消静音不作为整机阻断。未知动作保留 unknown，不从中文字面猜系统动作。

可选配置文件缺失时仍返回相应检查；`locations` 不得引用本次 `configResources` 中未暴露的配置 ID，可提供绑定编辑器或刷新动作。必需关键规则执行异常返回 `unknown/error/block`，不能因异常降为建议。宿主继续拒绝未授权位置，不扩大配置读取范围。

就绪状态仅代表 `checkedAt` 时点。页面闲置不按分钟标记过期；配置编辑结束或相关绑定/插件定义改变时刷新，运行前再次核验。冻结历史不随页面时间改写。

## 发现与只读预览

`phase: discover` 输入包含 `pluginId`、`userId`、`scriptInstanceId`、`origin`、`locale` 和 `configResources: [{id,format}]`。资源标识采用 `config:<相对路径>`。预览读取用户存储快照，不交换配置、不启动上游、不执行前后置脚本。运行在前置脚本完成后重新读取实际配置，冻结独立的 originalPlan。

输出为 `{protocolVersion,type:"discovery",coverage,tasks,diagnostics,selectionFields,behaviorFields}`，还必须提供 `configAssessment`，由 Host 在生成的 TaskPlan 上附加 `currentReadiness`。coverage 为 complete、partial、unsupported。每项 task 包含稳定 id/sourceKey、name、parentId、role、enabled、order、countsAsUnit、requiredForParent、retryUnitId、retryRisk、dependencies、detection，可附 configRef。角色 business/technical/cleanup；检测 supported/limited/unsupported；风险 safe/conditional/unsafe/unknown。未知任务必须保留。任务最多 1024 个，父链最多 8 层，依赖链最多 128 层，禁止环和重名身份。

`selectionFields` 是补丁授权清单：`{resourceId,selector,purpose}`，purpose 仅 selection/cursor。宿主冻结字段身份、原值和当前值；重试不能扩大授权。selector 示例：

```json
["instances", {"by":"id","value":"instance-a"}, "tasks", {"by":"id","value":"task-a"}, "enabled"]
```

仅有数组序号时必须使用 `{index,guardKey,guardValue}`，guard 要完整识别被选中的对象，不能仅按名称选第一个。补丁支持布尔值、字符串及其平面列表；YAML 目前仅支持标量及流式列表替换，拒绝锚点、别名、标签、合并键、重复键和多文档。保留未选中字段的字节、注释、BOM 和换行。

`behaviorFields: [{resourceId,selector}]` 声明影响任务行为的只读配置投影。宿主仅将规范化后的语义纳入计划签名，不将这些原值写入 TaskReport。不要包含日期、完成计数或临时游标。选项、计划次数、队伍等变化应使新预览与旧历史签名不同。历史本身始终不变。

## 当前运行日志观察

`phase: observe` 输入包含 runId、attemptId、attemptNumber、originalPlan、attemptTaskIds、acceptedState、adapterState、logBatch、isFinalCall、terminationReason。acceptedState 按任务 ID 给出 `{status,executionOrdinal}`；logBatch 为 `{records:[{sourceId,epoch,sequence,text}],hasGap}`。游标由宿主生成，插件不能确认或改变它。

输出 `{protocolVersion,type:"observation",runId,attemptId,observations,runBoundary,boundaryEvidence,diagnostics,cursorState}`。observation 为 `{id,taskId,executionOrdinal,status,reasonCode,evidence,skipKind?}`。evidence 为 `{sourceId,epoch,sequence,ruleId}`，必须引用当前尝试已收到的真实日志。skipped 必须明确 satisfied/inapplicable；blocked 必须有可确认未执行的日志证据。runBoundary 为 open/ended/aborted/unknown，ended/aborted 也要证据。

观察可增加 `incidents`，每项为 `{id,taskId,scopeId,executionOrdinal,kind,resolution,reasonCode,reasonText?,evidence}`。kind 为 transient_error/business_error/unattributed_error；无法归属时 taskId 必须为 null 且 kind 为 unattributed_error。resolution 从 open 开始，只能转为 recovered 或 terminal；转换必须保持身份和原原因，保留原证据并增加新证据。相同事件重放幂等，冲突使整批拒绝。每批最多 2048 项，每次运行最多 4096 条历史事件且序列化累计不超过 256 KiB；证据上限与普通观察一致。

问题事件不直接改变业务状态、计数或重试选择。适配器另行依据范围退出、内部重试和目标完成事实发出 observation。历史保存每次事件变更与原文，卡片显示该尝试中最新的问题状态；恢复不会擦除旧失败证据。前缀、通知级别和外层完成都不能替代范围归属或恢复证明。

观察异常或非法输出不推进游标，完全相同的 observation ID 可幂等重放，变更事实的同 ID 会被拒绝。同一执行序号的矛盾终态在 0.1.x 变为 unknown，0.2.0 变为有 Host 证据的 failed；内部重跑需先提交更高序号的 running。可用 cursorState 保存跨批次嵌套栈等纯日志派生状态，最多 64 KiB；它不是持久配置或成功依据。hasGap 时不得从缺失的开始/结束配对推断成功。进程退出只触发最终日志排空，不证明业务成功。

## 选择重试与恢复

`phase: retry` 输入包含 originalPlan、taskStates、attemptsUsed、maxAttempts、cancelled、budgetExhausted、configResources。输出 `{protocolVersion,type:"retry",decision,reasonCode,includedTaskIds,prerequisiteTaskIds,expandedUnitIds,filePatches}`。decision 为 stop/selective，stop 必须所有动作数组为空。

每个 filePatch 为 `{resourceId,format,expectedRevision,operations}`；每项 operation 为 `{selector,expected,value,purpose}`。revision 是宿主生成的随机不透明令牌，只用于当前快照 CAS，不能缓存到下次调用。0.1.x 宿主对每个明确失败或有证据 blocked 的候选独立计算依赖及重试单位闭包；只有整个闭包的风险均为 safe 才纳入同一次选择。不相关的危险失败或 unknown 不否决合格候选；共享重试单位中有 conditional/unsafe/unknown 风险时，该候选仍不能自动重试。不开启原先关闭的业务任务。提升父任务范围要验证整个范围安全。

多文件补丁先全部预检，再通过 staged/committed journal 提交。停止目标进程并确认清理后，仅恢复原始选择，保留实际运行后计数；随后才同步用户快照。第三方改动或恢复冲突时保留现场，拒绝覆盖。宿主崩溃后的任务检查点以 interrupted 历史恢复，已确认事实保留，未终结任务在报告1为 unknown、报告2为 failed。

## 限额与测试

每次输出最多 1 MiB；预览预算 2 秒，运行阶段 30 秒，最多 200 万条语句。用户配置单文件 2 MiB，公共只读 text 资源单文件 8 MiB，总计 32 MiB/256 个资源；选择事务最多 32 个文件和 2048 个字段。日志缓冲受限，超限显式 hasGap；每条证据最多保存 1024 字符片段，完整日志仍走历史归档。

生产脚本由 `tools/task-protocol/phase-modules.json` 声明模块、提供的符号、依赖及三阶段入口，结合只记录元数据路径的 `adapters.json` 确定性生成；各适配器的规则索引和文本键放在自身目录的 `*.metadata.json`。纯函数位于 `core/`，各适配器函数位于独立目录；不保留另一份完整 bundle 源文件。依赖先于调用者输出，缺依赖、循环、重复符号和未知阶段均失败。重试复用发现与当前配置校验，观察不携带发现和重试执行器；MXU 观察仍包含其确实需要的只读资源解析。上游固定版本和文件摘要保存在 `source-lock.json`；fixture 使用合成数据，规则来自对应源码，不读取真实用户数据。

修改模块时同步依赖清单。三个入口都在业务处理前严格检查 `input.phase`，错误阶段不能降级为“配置不支持”。`--check` 只比较，不改输出字节或时间戳。Python 构建测试验证依赖闭包，Host 联调验证真实 Jint 三阶段行为和权限；脚本哈希不同本身不代表阶段拆分通过。

```text
python tools/generate_task_protocol.py
python tools/generate_task_protocol.py --check
dotnet run --project <Host>/tools/NexusPipeline.TaskProtocolTests -- --plugin-root <Plugins>
python tools/repository.py verify --scope all --base <PR_BASE_SHA> --host-root <Host> --sdk-sha <SDK_SHA>
```

`verify --scope all` 执行生成一致性、真实 Host Jint/归并器/配置 journal 的八适配器测试，以及适用的 managed 和前端契约检查。Node 语法检查不是 Host Jint 测试的替代品；零夹具或缺少任何适配器均失败。运行时使用干净且固定 SHA 的 Host checkout。

## 作者模板

[JSON Schema](../../contracts/task-protocol.schema.json) 描述三个阶段的输出，跨字段约束由宿主继续校验。使用 `python tools/create_task_plugin.py --artifact MyAdapter --name my-adapter --output <新目录>` 创建待适配模板。默认模板含 `__NXP_ADAPTATION_REQUIRED__` 标记，源码、ZIP 和宿主加载均拒绝该标记。完成上游源码审查和证据/风险规则后才能移除。

`--example` 生成完整的合成协议示例。[TaskProtocolExample](../../examples/TaskProtocolExample/README.md) 由模板生成并经过真实宿主 Jint、重试与恢复测试；它不在发行 catalog 中，也不代表任何真实游戏。生成器拒绝覆盖已有输出；`--check` 用于验证示例与模板一致。

默认生成完整的 `0.1.0` 首发协议、`data/i18n/` 中英文词典、`configRules` 和 `environmentChecks` 骨架。`--protocol-version` 接受 `0.1.0`、`0.1.1` 或 `0.2.0`；0.1.1 生成空的 `repairRules` 并要求 Host 0.16.9；0.2.0 同样生成空数组并要求 Host 0.16.14；实际修复规则须逐项审查后声明。旧开发协议和 `TaskProtocolLegacy` 示例已废弃。用户自定义名称使用 literal，不按名称猜测词典键。

生成器支持 `--preset json-id-array|json-map|json-parallel-array|yaml|mxu` 五种可执行合成结构，以及 `ok-script-daily` 待适配骨架。后者拒绝 `--example`，必须先审查实际发行包、日常注册入口、框架队列、日志与配置存储。`examples/` 中每种预设都有确定性生成的合成示例和真实 Host 夹具；这些安全重试规则只适用于虚构任务，不能直接用于游戏。默认模板仍须完成源码审查后才能打包。

八个官方适配器的源码分支、保守支持范围和作者审查清单见 [专项适配边界](TASK_ADAPTERS.md)。

## 固定运行资源的完整性

`0.1.0` 的 `readResources` 可添加可选 `sha256`，值为 64 位小写十六进制，且资源必须为 `source: root`、`format: text`。宿主按捕获的原始字节比较，包含 BOM 和换行；`readResource` 增加 `integrity: verified|mismatch`。不匹配时 document 为 null，缺失/不可读仍按资源不可用处理。未声明哈希的资源返回形状不变；配置 revision 仍为不透明令牌，不返回内容摘要。既有路径白名单、单文件及总量预算不变。

此声明用于已审查的发行文件。发现时由插件 critical 规则决定阻断；运行阶段 Host 在接受观察前及结束时复核已固定资源，变化或不可读会停止接受后续证据及自动重试，记录运行链异常，保留此前任务事实。它不是对全部 Python 依赖、解释器、加载代码或瞬时替换的完整证明，也不会阻止上游启动器修复/更新；新发行字节必须重新审查。

环境目标可声明 `source: {kind: "mainConfig", selector: [...]}`，仅在绑定捕获恰好一份主配置时解析，文件改名不改变归属；目录多配置或无配置时返回未检查，不从附加配置或其他账号回退。可选 `defaultValue`、`secondaryDefaultValue` 必须为有界字符串且对应单层属性 selector，只用于该属性不存在，显式 null、空值和错误类型不能被默认值掩盖。ADB 端口 selector 接受整数或字符串，地址组合仍只作格式/相等比较，不联网探测。默认值必须有锁定上游依据。

修复预览只在当前用户快照存在可安全修复的值时展示。无规则、没有符合规则的值或禁用修复时返回 `available:false`，不提供无效按钮。相同配置契约可读取先前插件版本保存的快照；修复提交仍绑定当前规则、账号、配置代次和原字节 CAS。

修复清单的结构定义见 [config-repair.schema.json](../../contracts/config-repair.schema.json)；实际加载还核对规则引用、资源路径和版本范围。隔离诊断入口为 Host Jint 工具 `--plugin-root <Plugins> --config-repair <报告路径>`，加载八个实际 manifest，验证每条规则的真实写入、幂等性和其他字段保持。

MAA 任务的自定义昵称仅影响显示：`name` 保留原生回调实际使用的昵称；`nameText` 显示原任务标签加 `（“昵称”）`；已登记标签使用冻结中英文词典和 nickname 参数，其他动态标签使用 literal。昵称组合词条由适配器生成器从原标签派生。任务身份、选择字段和日志匹配不使用组合后的显示文字。MFA 同昵称任务仍按原生顺序及证据归属处理，显示标签不能消除异步同名失败的歧义。
