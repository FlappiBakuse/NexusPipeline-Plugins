# MaaFrameworkDriver 0.5.0

目标 Host 0.18.0 / SDK 0.1.0。PI 编译、来源实例映射与选项语义由本插件维护；物理来源准入、冻结发布、进程/窗口身份和执行预算由 Host 维护。编译器不读取任意路径、不运行项目程序、不安装运行库或 Python 依赖。

## PI 与来源

`MaaSourceSet` 接收冻结内存文件、相对路径、SHA-256 和来源身份，先复制字节再核对摘要。每文件最多 8 MiB，闭包总计 32 MiB / 128 文件；JSONC 支持 BOM、注释、尾逗号，拒绝重复键、无效空容器逗号、路径逃逸、大小写别名、缺少 import 和循环。原字节 SHA 不随解析或显示翻译改变。每次编译/导入使用独立读集合，发现其他实例不会污染所选实例的来源摘要。

完整 PI 保留任务、选项、全部 case/pipeline_override、分组、设置、预设、pretask 与 Agent 声明。多个 interface 和同名来源实例均需明确选择，显示名不作为身份。

| 来源 | 配置及身份 | 语义 |
| --- | --- | --- |
| MXU 2.8.0 | schema 1.0、所选 instance.id / task.id | 控制器启用缓存须一致；pretask 与正式任务分开，保留顺序和独立选项 |
| MFAAvalonia 2.16.4 | config/instances/id.json 或明确旧共享实例 | 局部非 null、实例前缀、default 前缀、无前缀全局依次继承，不回写全局 |
| MFW-PyQt6/CFA 4.10.3 | 显式 config_list、bundle 与 item_id | 只取已保存可见设置，保留分支/子选项、数值转换与关闭的 speedrun 元数据 |
| MaaPiCli 5.14.3 | config/maa_pi_config.json 的来源序号 | 相同任务名/参数仍为独立 occurrence，保留各级保存选项 |

这些是锁定框架源码的配置规则，不证明项目发行包捆绑了各组件最新版本。MXU 后导入选项替换、MFA 字段补丁、CFA 深层合并与 MaaPiCli 当前 Parser 的既存键优先分别处理，编译指纹绑定客户端规则及完整声明。

MFA 删除历史阻止新默认任务复活；保存顺序、重复次数和未知禁用条目保留。CountdownAction/TimedWaitAction 只接受确切 Custom action 形状和有界参数，作为技术步骤保留。启用的未知动作、shell、等待型外部启动、嵌入 Agent 以及未映射的 ADB 方法明确拒绝。未启用的 SoftwarePath 和前置动作不会触发启动。

## 执行语义

输入展开只替换当前选项声明的字段；Agent 运行时识别结果引用及正则量词中的花括号原样保留。
替换值作为字面值插入，不再次扫描其中的占位符。受保护输入解析后遵循同一规则。
声明 Agent 或程序前置步骤但尚未选择原生运行库时，项目配置仍可保存和查看；
编译结果携带运行库选择诊断并禁止执行，完整声明保留供用户补全运行环境。
MFA 只展开当前控制器、资源及选中 case 的子选项，同一层选项遍历按名称处理一次；
多个分支引用同名选项时采用首次有效保存值，未选中分支的原始配置留在来源快照中。

`MaaSemanticCompiler` 产生完整内存语义计划，不执行 native 或 Agent。正常 PI 按 global、resource、controller、task 选项层覆盖，checkbox case 按声明顺序合并；不激活的选项不产生参数。CFA 使用已保存值与深层合并，旧共享 MFA 不注入未保存默认值。任务原有和 occurrence 的 pipeline 覆盖保持各自顺序。

输入占位符保留明确类型，快捷键使用有限 Win32/ADB 码表。不执行来自 PI 的任意正则、脚本或表达式，未映射约束明确阻断。密码输入经 Host 受保护输入 owner 绑定，编辑以 keep/set/clear 意图保存，普通预览不能返回其明文。选项循环、深度、展开次数及总重复次数均有界，取消不开始新工作。

绑定编辑器保存 `Runtime.NativeDirectory`、`Runtime.Executables` 和 `Runtime.Directories`，重开及重新导入配置保留运行文件映射。
程序名须精确匹配 PI 的 `child_exec` 或 `exec` 声明；路径相对于所选脚本根，最多 32 个程序映射及 32 个附加目录。
运行文件声明与配置导入独立，不随导入执行程序，也不自动安装依赖。Host 冻结时继续验证路径、身份和内容。

来源与编译声明的摘要相互绑定，声明改变后拒绝复用导入结果。来源原文仅作私有快照，不进入普通序列化。语义计划仍需 Host 与完整资源树、native/Python/Agent 身份、窗口/ADB 和初始化授权绑定后才能执行。

`MaaProjectInputs` 通过 SDK 冻结项目读取端口消费原编译器资产，以最多128KiB的分块校验完整内容 SHA、长度、分页、index 引用和执行 view；完整 PI 不进入普通 Jint 帧。`MaaRuntimePlan` 从绑定的完整 PI/profile 重新编译 semantic，拒绝与保存计划不一致的内容。任务选择只接受启用 occurrence 的独立 ID，保留原顺序和次数；重复显示名、Entry、禁用行和 pretask 不能被误选为正式任务。返回选项、pipeline、连接与 Agent 声明均为分离副本。

## 生产接线与验证

标准 `tests/maa-framework/verify.py --sdk-receipt <正式生产者回执> --output <仓外目录> --cache <共用缓存>` 使用仓内合成输入和真实 SDK 接口。可选 `--corpus <清单>` 核对锁定 MaaEnd/MaaS 的完整 PI 闭包。清单逐项指定 `project`、`root`、`interface`、`inventory`、`taskCount` 和预期阻止执行时的 `blockingDiagnostic`。语料逐文件匹配 inventory，文件、任务、选项和分页数据写入语料回执。

完整元数据使用内部有界页图投影，所有选项、case、控制器、资源与未知扩展字段均可无损恢复。每页 SHA、页闭包、原 source-set 和 compilation 指纹同时校验；缺页、改页、无关页及错误身份拒绝。PI 中完整 pipeline_override 留在 artifact，Jint 按页读取。磁盘上的完整 native resource/pipeline 字节由独立归档 owner 负责。

正式入口在激活时注册 `IProjectCompiler`，compilerId 为 `project`，注册可见性和回调排空沿 Host scope。安装后的编译器、绑定编辑器与独立 worker 使用同一冻结项目。受控安装测试覆盖正常原生任务、截图、Agent 自定义动作，以及初始化成功、失败和取消；四类真实发行项目的完整组合仍需独立验证。

`MaaCompilationBundle.Build` 从同一冻结 `MaaSourceSet` 和明确选择重新编译 PI、导入配置及 semantic plan。bundle 保留完整 PI artifact/页图、完整 profile（含 SourceSnapshot、保存的选项和未知进度）、完整 semantic 内容及其 Fingerprint，同时绑定所有已读取文件与完整可用输入清单的身份。Host 仍须为实际目录清单及缺失文件提供物理重验，内存清单本身不授予文件访问或 CAS 权限。

小 index 绑定 bundle artifact、PI index 和执行 JSON。执行 JSON 最多 262144 字节；保留全部 occurrence 的顺序、Id/SourceId、Entry、RepeatCount、Enabled 和 Role，Options/Pipeline 通过完整 artifact 内的精确 JSON pointer、字节数和 SHA 引用。启用任务的编译内容来自同一 `MaaSemanticPlan`，禁用与未知行不因此消失。唯一内容闭包总计最多 32 MiB；超过预算明确拒绝，不截断、拆假任务或提高 Jint 限额。

`Verify` 使用 Host 应保存的 artifact 摘要和原冻结来源重开，验证完整页图并重建比对 profile、semantic 与执行视图。普通编辑 schema 按页取用。组件覆盖重算摘要后的 profile/semantic/read-set 修改、来源身份与清单变化、缺页/改页/多余页和预算拒绝。两个完整语料使用合成的 MXU/MFA 保存配置，各启用一个真实 PI 任务并保留其余 occurrence。缺少相应的运行时或 Agent 程序选择时，保留可读预览和诊断，执行保持禁用。

完整 PI/profile 可解释但业务设置阻断执行时，公共 CompilationResult.CanExecute 与 bundle、ExecutionView 使用同一语义结果，返回 `canExecute=false` 和 `blockingDiagnostics[{Code,Stage,Detail}]`。完整 SourceSnapshot、PI 页图、保存选项及来源绑定继续保留；`semantic`、`semanticFingerprint` 和各行 Compiled 为 null，不伪造空的可执行计划。MFA StartupSoftwareAndScript、MXU 启用的 __MXU_POWER__、不支持的控制器和明确的选项选择冲突属于此类。只有显式 typed 业务错误转换为阻断；JSON/源码、缺少 import、身份/路径、口令保护、重复次数及输出预算错误继续拒绝。修复配置后必须以新冻结输入重新编译。`canExecute=true` 仅表示语义编译成功，不代表 Host 已授权启动或 native 验收通过。

每行 Origin 的 Path/Pointer 指向原文件和原数组项，SnapshotPointer 相对 `bundle-artifact /profile/SourceSnapshot`，Index 为该原数组位置。MXU Tasks/Pretasks 虽分别编号，合并旧任务序列时按 Origin.Index 恢复原顺序，SourceId 仍为保存的 task.id。MFA Origin.Kind 为 local、inherited 或 default；继承行给出实际全局文件及精确前缀属性指针，新默认行四个位置字段均为 null，不能据此生成既存行 patch。Inheritance 提供实际 GlobalPath、RequestedConfig 与 ResolvedConfig，避免重复猜测 fallback。原始 remark/customName 等仍从 SourceSnapshot 读取，不复制成第二份原配置。

configurationBindings 将真正读取的配置 Path 绑定到 Host ResourceId/Revision、原文件 SourceSha256、mount 内 RelativePath 和契约/快照事实，并纳入整个来源摘要。SnapshotSha256 是保存 manifest 摘要，不能代替原文件 SHA。绑定只是来源事实，不授予写入或扩大 selector；Host 仍须校验实际声明、protected/CAS/read-set。继承行的原位置也不是写回全局的许可，局部物化仍须走明确目标并重新发现。

`MaaProjectCompiler` 实现正式 SDK `DiscoverAsync/CompileAsync`，接受 `InterfacePath/ClientKind/Language/Source(Kind/Path/InstanceId)`，以及可选的 `Profile` 草稿和 `Preset` 名字，拒绝字段别名、未知字段、路径逃逸和不完整选择。每次回调经 `ISelectedSource.ListAsync/ReadAsync` 读取并校验原路径/SHA/文件身份；128 个实际文件、8 MiB 单文件、32 MiB 总量、128 个目录及 4096 个即时成员有界，缺失与已有空目录分开。只发现根、assets、明确 CFA bundle 和各框架配置目录；所选 PI 的递归 import 与语言按实际客户端规则读取。

`MaaProfileDraft` 在原导入配置上应用明确编辑，保留源行身份和未编辑的进度、继承及连接事实。新行取得独立 ID，Entry 从 PI 定义导出；顺序、重复次数和选项重新编译。禁用未知行可解除该行的执行阻断，原来源身份仍保留。预设也由同一编译 owner 生成，任务与前置任务分开；来源刷新不执行初始化。

Compile 首先核对 `ISelectedSource.Configurations` 的实际保存 mount：主配置须精确匹配 File，或为 Directory 下的真实相对文件路径；目录自身及前缀相近的其他命名空间不算文件授权。RequiresInstance 时 Source.InstanceId 必须与 InstanceKey 精确相等。MFA 的 appsettings、所选全局配置、缺失命名空间与 fallback，及 CFA 的 multi_config 均在读取前单独核对，不能回退到根内未保存 live 配置。Discovery 仍可列出未保存候选，但不会授予 Compile。

ResourceId、Path、Revision、ContractRevision、ContractSha256、SnapshotSha256、Kind 和实例事实全部冻结进入观察与快照摘要；回调中 metadata 改变拒绝，原字节相同也不能复用另一保存修订。伪造 selection metadata、重叠 mount 和大小写别名拒绝。此校验使用 Host 对象，不从文件名、selection 或私有身份字符串推断来源权限。

`CompilationResult.RootIndex` 指向 `project` index，全部 Index/Page/Artifact 的 References 都为本次资产名，闭合且无孤儿。目录/缺失观察与 mount metadata 作为 artifact 绑定。`ResourceTrees` 从实际所选控制器/资源声明解析路径并按原顺序去重，生成唯一 resource-N 名字，最多八个唯一相对根；超过预算拒绝。对所选路径只列其根和 pipeline 的完整即时成员，不扫描 DLL/图片，不按任务名猜 pipeline 子集，不把声明或目录观察冒称资源归档。完整语料通过带保存 mount 的 SDK 只读端口核对任务顺序、启用状态和执行门禁。

## 浏览器编辑投影

`CompilationResult.PreviewIndex` 明确指定 `editor-index`；完整 RootIndex、PI/Jint 页图与 artifact 仍为独立私有闭包。公开子图只含该 Index 及它引用的 editor-page-<sha>，不引用 Artifact。Host 必须只开放 PreviewIndex 可达的 Index/Page，不能仅因资产 kind 为 Index/Page 就开放；缺少公开声明默认无预览。

编辑 index 绑定原 bundle artifact/index 摘要、Maa source/snapshot/compilation/semantic 指纹及 CanExecute；Host 预览自己的 fingerprint 是另一独立身份。schema 保留完整已知 PI 任务、选项、case、input/hotkey、控制器、资源、分组、设置和预设。仅复制类型正确的已知展示/约束字段；pipeline、Agent/exec 参数、telemetry、未知扩展和连接数据不进入普通 schema。显示文本与参考路径只作元数据，不授予读取、HTTP 或正则执行权限。

schema 保留 password 标志，但密码 default 不公开；非空密码 default 和普通配置中的密码材料仍由编译 owner 直接拒绝。PI 明确声明的非 password input/hotkey 字符串值可供编辑，受保护及未知字段不公开，密码编辑仍须受保护输入 owner。选择值只保留声明中实际存在的 case，未知值不作为自由文本返回。翻译保留全部已知公共 label/description/doc 等字段引用的字符串；未引用及非字符串未知语言数据留在私有 artifact。

profile 保留 occurrence 的 Id/SourceId、顺序、开关、重复次数、角色及原 Origin{Kind,Path,Pointer,Index}，不提供 SourceSnapshot 或指向它的私有 SnapshotPointer。未知行保留身份与位置，Name/Entry 为 null。MFA Inheritance 与原配置 SHA/revision 绑定保持，不构成写授权。阻断诊断只公开 code/stage/severity，不公开可能含原配置片段的 Detail。

每页最多65536字节，index最多524288字节。使用 inline/object/array/string 编码，所有分片都由 SHA/bytes/count 绑定并可无损还原公共 schema。组件覆盖公开任务和选项数量、长非 BMP 文本、缺页、改页、多余页、来源绑定和私有配置隔离。

Host 以所选 binding 的已保存配置挂载和 revision/read-set 编译，不能用另一个 live 账号配置代替。
完整编译闭包及所选语义计划绑定到 Jint 和历史计划。DeliveryJobs 单文件 2,360,901 字节，
不作为普通 raw Jint 输入；不裁剪 pipeline/选项，不在插件放宽限额。
native、Agent、Python 和资源树均须声明冻结输入；来源刷新只重编译候选，不重放程序或初始化。

生产绑定表面通过同一 `MaaEditor` 消费分页公开投影，提供来源选择、任务/选项/排序/次数、预设、显式导入和草稿预览。Host 保存与只读原操作查询共享 binding、调用者和原始选择摘要；未知结果不创建另一个保存 ID。原生窗口观察要求当前原生客户端和 manifest 的 `window-inventory` 声明，不扩大执行权限。脚本表面使用独立脚本来源授权和选择 revision，共享编译器、编辑器与预览，不借用账号绑定或提供秘密写入；实际原包浏览器已验证保存及重开。四类真实发行组合与完整设备组合尚未取得资格。受控安装验证不等同这些真实项目资格通过。

## 正式 worker 入口

扩展激活只注册编译器，manifest 独立声明 `worker/NexusPipeline.MaaWorker.exe`、
gracefulStop 和 targetControl。worker 从原 Host 已认证的通道读取项目和任务选择，
资源清单及内容绑定同一冻结指纹。最多八棵树、32768项、1GiB，128KiB分块读取，
核对完整长度/SHA、大小写唯一性与父目录；链接、设备名、路径逃逸和缺失页均拒绝。
Host 私有 workspace 中独占创建资源目录，并持有目录及所有文件只读租约。

默认原生运行库来自本包 `runtime/win-x64`，包含 AgentClient 的十一个 DLL 与 runtime-lock 精确闭合；
打包器按仓内发行锁验证官方资产摘要、原 ZIP 与实际 DLL，不依赖本机 Reference。
显式选择项目运行库时，Host 将声明目录冻结到同一项目输入，worker 持有并校验所需模块；
程序的相邻运行库须与冻结输入一致，冲突时拒绝启动。
worker 通过 Host 目标通道选择 PC PrintWindow/GDI/ScreenDC/FramePool 截图，鼠标与键盘分别选择 SendMessage、PostMessage、SendMessageWithCursorPos 或 Seize；首次设备操作后锁定选择。ScreenDC 由目标输入 owner 提升所选窗口，截图 helper 只读验证客户区可见、未被遮挡；无法确认时拒绝截图。FramePool 按同一窗口身份捕获并裁出原尺寸客户区。Seize 只有在所选窗口取得前台焦点后才发送原生输入；取消时释放本次持有的按键与鼠标按钮。Win32 控制器使用分开的按下、抬起回调，由 Maa 保留所配置的按压时长。

默认 Adb 控制器使用 Host 冻结的 Android 目标和受管命令进程族，支持原始 PNG、点击、滑动、完整按键、ASCII 文本、有限时 shell 与冻结 package 的启动/停止。明确指定其他 ADB 后端方法时拒绝受理；持续触点、持续按键和非 ASCII 文本不做近似转换。MuMu 命令前后重验冻结 index/endpoint，取消或超限须停止完整命令进程族。
Agent 通过冻结的程序、参数和运行库启动，并与 worker 一同受 Host 进程族管理。
初始化由独立的显式调度目标执行，只运行冻结选择中的 pretask，不计入业务成功记录、
每日次数或通知，不同步执行后的配置。保存、预览和来源刷新不启动初始化。
普通执行只运行本次冻结选择包含的 pretask，顺序在原生任务之前；重试重新执行显式安全启动前提。
普通启动等待程序根进程返回，保留其游戏子进程到会话结束；独立初始化要求整个程序族结束。
pretask 默认限时 15 分钟、最大 20 分钟，同时受 Host 本次预算约束；Agent 连接限时独立处理。
其他控制器方法仍须逐项接通，不以编译 CanExecute 替代准入。
原生会话排空后才释放输入；无法排空时保留全部所有权，等待 Host 停止完整进程族。

`tests/packaging/verify.py --output <仓外目录>` 用合成归档核对声明的 DLL、原始字节和错配拒绝。

业务任务通过 `executionTaskId` 绑定编译 occurrence，Host 将实际选中业务 ID 和执行 ID
同序冻结。worker 不依赖专项插件 ID 规则，也不从显示名或 Entry 推断对应关系。
原生排空后输出 `nexus.maa.native-fact` version=1，绑定 run/attempt/plan、完整项目指纹、
consumer、两个任务 ID、重复序号、真实 native task ID、终结状态和连续序号。
专项观察器核对这些事实；缺失重复、断序、换 epoch 或不完整输出不生成完成结果。
预任务输出独立的 `nexus.maa.program-fact`，绑定同一运行、计划、项目与 occurrence，记录真实程序退出结果。
所有选中预任务成功后才接受原生任务事实；预任务不伪造 native task ID。检查点同时绑定实际重试范围。
尚无原日志事实的空检查点可在第一条原生事实到达时进入该模式；已有框架执行事实时拒绝混入。
内部检查点保存计数和绑定，不从普通 JSON 取得执行权限。58项真实观察模块测试覆盖这些边界。

MFA 原生无 ID 的局部 TaskItems 已有纯内部冻结 index 选择映射：绑定原文件 SHA/revision、所选 instance/read-set 和独立 occurrence，不按重复 name/entry 合并。只为明确授权 occurrence 生成现存 boolean selector；其他行、未知禁用项和进度原值保留。继承/缺失/显式 null、未物化默认任务及缺少 boolean flag 必须先 materialize 再重发现。source 字节或顺序变化拒绝旧映射；它只证明原快照的选择投影，不替代 Host 已停止 writer 后的恢复、公共 CAS 或授权。

## 受控 worker 原生会话

内部 `MaaTaskSession` 只供独立受控 worker 使用，不在扩展激活时创建或执行任务。
`IMaaSessionInputs` 持有已核验 runtime 与完整资源只读租约，并在每次操作前重验；
`IMaaController` 提供 capture/click/swipe/touch/key/text/scroll/move/inactive 及明确
StartApp/StopApp/Shell 方法，实际权限由 Host target owner 实现。字符串 PID、HWND、
ADB 地址、app intent 或 shell 文本均不授予权限，插件没有直接进程/ADB fallback。
Capture 仅接收有界 PNG；NoInput fixture 拒绝所有输入和 app/shell 动作。

计划冻结 OccurrenceId、SourceId、Entry、Pipeline 与 RepeatCount，保留顺序，重复分别
PostTask 并记录不同 native task ID。第一个失败阻止后续重复和任务，不预排队。
资源按所选顺序 PostBundle，pipeline override 在原生任务提交时使用同一冻结字节。
MFA 的 CountdownAction 与 TimedWaitAction 使用原生 Custom action 回调注册；倒计时保留秒数，
定时等待按本地日历时间计算，等于或晚于所选分钟时等待次日。参数在提交前校验，等待期间
持续核对输入租约和取消；取消排空这两类回调后才注销并销毁资源，不启动外部程序。
仅识别官方 Pending/Running/Succeeded/Failed 状态；过滤事件仅含 native task ID 与
Tasker.Task.Starting/Succeeded/Failed，不包含原 pipeline、回调 detail 或自由文本。

取消先关闭输入与新提交，再取消 typed port、PostStop，并等待已受理的资源/连接/任务、
原生 Running/Stopping 和全部托管回调排空。上游 stop 可能清空状态表，已确认的终态
不会被重新要求证明；返回无效 stop ID 不伪称 stop 已受理。只有证明静止后才移除 sink，
依次销毁 tasker/controller/callback table/resource/module，最后释放输入/控制器租约。
超时或排空失败保留强引用和全部句柄，不在 finalizer 中强制释放，不允许新会话复用该
worker；Host 必须停止完整进程族后收敛，不把内存任务消失当停止证明。

官方模块在初始化时自动扫描同目录 plugins，所以加载前拒绝该目录。原生日志会包含
pipeline，设置空 LogDir、StdoutLevel Off、关闭 DebugMode/SaveDraw/SaveOnError；
仅返回受控诊断事实。资源的 JSON/JSONC 和冻结 override 在任何原生加载/提交前解析，
拒绝绕过 typed controller 的 Command，缺少可信输出 scope 时拒绝原生 Screencap；不是全文字符串命中。
资源输入按完整只读树检查，32 MiB pipeline 字节预算，最多八棵资源树，不按任务名裁剪。

`tests/maa-framework/native-session/verify.py` 使用 `--resource-inventory <清单>` 独立审计锁定资源，
使用 `--runtime-receipt <回执>` 验证原生行为。清单的 `projects` 逐项提供项目名 `project`、源码
`root` 和由 `relativePath` 组成的 `trees`。审计回执记录流水线与默认流水线的核验范围，以及
有无输出 scope 时的产品 guard 结果。资源审计的 `test` 状态为 `NOT_RUN`。

正式原生组件测试使用已核验官方 5.14.3 的原生闭包与合成资源，覆盖顺序/重复、
override、资源覆盖、识图、失败停止、回调异常、取消排空、并发拒绝、typed app/shell
拒绝、未证明停止时保留所有权及语义动作 guard。测试不运行真实 corpus，不连接设备，
组件结果不替代独立的 Host owned-worker、target IPC 和 Agent 安装验证，也不证明真实项目业务通过。

### 严格可选的原生截图

`IMaaOutputScope` 是可信 worker producer 的借用，提供 Root/RequireCurrent/FreezeAsync。
它必须证明父分配的 fresh 私有输出根、原父链/root/screencap 的持续物理持有及完整输入
只读 master；不能从 JSON、路径内容相等或本地客户端标志自行构造权限。会话额外核对
真实进程 CWD 与该 Root，所有资源、原配置和 runtime 输入根须与输出分离；不会切换 CWD。
LogDir 保持空，输出只在 CWD/screencap 中；不启用非空 LogDir 的原始文件日志或 detached
旧图清理线程，SaveDraw/DebugMode/SaveOnError 保持关闭。现役 activation/manifest 不开启此分支。

源码 JSON/JSONC 与每次冻结 override 检查继承参数；加载后使用官方 GetNodeList/GetNodeData
核验实际规范化动作及 Screencap 默认参数。单节点字符串最多256KiB、最多65536节点、
规范化数据总计64MiB；超预算拒绝。只允许 filename 空、format png、quality100；
拒绝非空路径、Windows 不安全节点名、Command 或无法保持约束的参数，保留原生
Screencap action/detail、缓存优先捕获及原 next/focus/识别语义，不改成 Custom。
Agent 动态 ContextOverride/RunActionDirect 的门禁尚未接通，不能以此允许未知 Agent 调用。

native task/controller/callback 完整排空并销毁后才调用 FreezeAsync。返回内部文件名、
大小、原 SHA、TotalBytes 与 MayOverwrite=true；配额或未知输出失败不能变成成功。
NativeWritersDrained=true 与 ProcessFamilyStopped=false 明确区分。毫秒时间戳可能碰撞，
原生 ofstream 可覆盖本次自己的输出；不宣称 CreateNew 或每次命中产生唯一图片。
会话不会 Dispose 输出 scope；外层 Host 保持它和独立输入 master 到所有 worker/Agent
writer 真正结束，再核验完整文件集、身份与哈希后发布受控证据。普通页面没有此输出接口。

组件的 7 个独立输出子进程由测试父进程设置各自 fresh CWD。scope fixture
持有真实目录身份/no-delete 句柄和独立输入只读 master。实际 C ABI 验证 Screencap detail、
PNG 参数、文件 SHA、目录替换/输入写拒绝、取消排空、quota 失败、错误 CWD 与缺 scope 拒绝。
可选真实语料审计只读取锁定资源并调用策略 guard。
测试子进程不等同 Host Native Job 准入，内部快照不构成完整进程族停止证明；实际输出
scope/family stop/最终收集的安装验证由受控原包用例单独记录。
