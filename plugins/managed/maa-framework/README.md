# MaaFrameworkDriver

为 MaaFramework 项目提供配置编辑、任务选择和独立执行引擎，支持项目声明的电脑与 Android 控制方式。

目标版本 0.5.0，使用新 SDK 与 MaaFramework 5.14.3 公共 C ABI。
扩展激活只注册项目编译器；任务资源、原生引擎和控制回调由独立的
`NexusPipeline.MaaWorker.exe` 持有，不在 Host 激活回调中执行任务。

worker 从已认证的 Host 控制通道读取冻结项目和 occurrence 选择，重新核对
完整 PI/profile 与执行语义，再把 Host 归档资源逐文件物化到私有 inputs。
输入目录、文件及 DLL 保持只读租约；outputs 与原脚本目录分开。
`runtime.release.json` 锁定官方发行、完整源码 SHA 与资产摘要；打包器核对
原归档、DLL 清单的指纹及 manifest，生成仅含准确闭包的 runtime-lock。

`managed.nativeLibraries` 明确列出原生 DLL。独立 worker 只加载原包中这些准确路径，
依赖限同一已声明 DLL 目录及 Windows 系统目录，不按当前目录搜索。
scope 撤销后先排空回调，再销毁 tasker、controller、resource 并释放模块，
最后释放包的只读句柄。managed 扩展属于受信代码，不是安全沙箱。

控制仅经 Host 的目标通道，worker 不从 JSON 的 PID、HWND 或 ADB 地址取得权限。
普通执行入口通过 Host 目标通道选择 PrintWindow、GDI 或 ScreenDC 截图，鼠标和键盘分别选择 SendMessage 或 PostMessage；其他设备方法明确拒绝。首次设备操作后不能更换方法。ScreenDC 要求目标客户区可见且未被遮挡。
Agent 使用冻结项目中的程序、参数和原生文件，在独立进程族中运行，原生会话停止后排空并确认其退出。
上游发行资产在仓外核验，不随源码复制。冻结内存 PI 编译器与
MXU、MFA、CFA、MaaPiCli 来源映射已实现，覆盖完整 import、选项、
重复身份与语义参数，不运行程序，不依赖本机参考源码构建。

正式入口激活时通过 SDK `context.Compilers` 注册 `project` 编译器；
`source.compile`、`managed.compilers` 与所选脚本根权限均明确声明。
Discover/Compile 仅使用 Host 的 `ISelectedSource`，完整捕获所需 PI/import、
语言和明确配置来源，返回闭合资产 DAG 与有界执行视图。
Compile 必须以 `ISelectedSource.Configurations` 核对主配置及其全部配置依赖，
精确验证文件/目录命名空间、InstanceKey 与保存修订；selection JSON 不授予此权限。
脚本和绑定编辑区可发现来源、编辑独立任务及选项、顺序和次数、应用预设、显式导入、
预览草稿并按原修订保存。保存结果未知时先读取原操作，必要时以原 ID 和冻结输入重试。
受保护输入以 keep/set/clear 独立意图保存，原操作结果查询负责不确定结果及恢复，普通投影不返回秘密明文。
运行文件编辑包含原生 DLL 相对目录、PI 程序名对应的程序/解释器路径及附加目录；保存及重新导入保留明确映射，
路径仍须通过 Host 来源准入及冻结验证，编辑不会启动程序或安装依赖。
选项默认值由编译器和公开编辑器投影共用解析；只读显示默认值不会制造用户覆盖。
显式初始化使用独立 plan/bootstrap purpose，只接受编译快照声明的有序 pretask 身份，
不连接目标设备、不运行普通任务或 Agent。普通执行按冻结选择先运行 pretask，再连接设备并执行原生任务。
启动程序返回成功后，其创建的子进程保留到任务结束；失败、取消和结束均排空原进程族。
初始化失败不自动重试，配置恢复、幂等受理和停止证据由 Host 管理。
已安装原包验证了受控初始化成功、失败、取消和页面确认流程，以及冻结 AgentServer 的真实回调和进程族退出。
脚本编辑区使用真实脚本来源及独立选择修订，保存不改绑定选择或上游文件；受保护输入在账号绑定中配置。
原包在实际 Host 的脚本编辑区已验证来源读取、预览、保存及重新打开。
崩溃恢复、其他设备方法和真实项目生产组合尚需完整验证。
详细边界见项目文档，不以算法组件代替真实运行资格。

完整 PI 内部编译支持绑定来源和编译指纹的有界页图，完整选项/控制器/资源元数据与原 pipeline artifact 可无损核验。
原始 ZIP 已在实际 Host 安装，并对受控 PC 窗口运行原生任务、读取原尺寸截图和独立 occurrence 回执；
这些证据不覆盖真实 MaaEnd/MaaS 发行的 Agent 或其他控制器组合。

私有 `MaaCompilationBundle` 将 PI artifact/页闭包、完整导入配置与来源读集合、
完整 semantic plan 一起冻结。执行 JSON 最多 256 KiB，保留顺序、重复身份、
禁用行和重复次数；选项与 pipeline 使用同一 artifact 的精确指针和摘要，
不将完整内容丢弃或只保留任务表。小 index 绑定各项内容；重开时从冻结来源
重新验证全部身份、页和执行投影，不允许用当前配置解释旧计划。

目录与缺失文件观察进入绑定摘要。所选 resource 根及 pipeline 只观察完整即时成员，
不递归加载原生资源、DLL 或图片。`ResourceTrees` 按所选语义路径顺序去重声明，
最多八棵；完整资源树仍须由 Host 独立归档和验证，声明及目录清单不构成 native 资格。

已知业务设置阻断执行时，完整只读 PI/profile 仍保存在私有冻结资产中：
`canExecute=false`、`blockingDiagnostics` 明确标识阻断，`semantic` 和其指纹为 null，
不生成假任务计划。源码解析、路径/身份、预算和口令保护错误仍直接拒绝。
原始行 Origin 区分本地、继承与新默认，配置绑定保留原文件 SHA 和保存修订；
这些事实不替代 Host 写入权限、CAS、资源归档或运行准入。

浏览器只读取明确 PreviewIndex=editor-index 的公开子图，不接收私有 PI 页、
bundle-artifact、SourceSnapshot、连接参数或 pipeline。公开 schema 保留全部已知
任务/选项/控制器/资源与其引用翻译；已声明的普通输入值保留供编辑，
未知字段、受保护输入值、密码 default 及诊断 Detail 不公开。occurrence 身份、顺序、来源位置与只读阻断保留，
每页最多64KiB，根最多512KiB；原配置 SHA/revision 仍由 Host 校验，不授予写权限。

生产 `createFrontend` 与交互用例使用同一个完整编辑器；Host 项目端口负责来源与
冻结投影、预设编译及 CAS 保存。普通值和无效输入草稿在切换界面语言时原样保留，
秘密草稿在隐藏或语言切换时清理。原生窗口列表通过明确声明的 `window-inventory`
端口读取，要求仍有效的原生客户端；PID、路径和时间仅作观察，不构成目标运行授权。

内部 `MaaTaskSession` 为独立受控 worker 提供原生资源、custom controller、
tasker 和回调的唯一生命周期，激活入口不会创建它或执行任务。任务顺序、
occurrence、重复次数和 pipeline override 冻结后逐次提交；原生状态与过滤后的
任务事件分别保留。控制输入仅经 typed port；StartApp/StopApp/Shell 没有
进程或 ADB fallback。取消关闭输入并排空所有已受理操作和回调后才释放句柄；
无法证明排空时保留 native 模块及输入租约，必须交由 Host 停止完整 worker。

加载前拒绝自动旁加载的 plugins 目录，Command 始终拒绝。Screencap 默认拒绝；
仅可信内部输出 scope 可开启严格分支，要求独立 worker 的真实 CWD 匹配私有
输出根、持有父链/root/screencap 身份与完整输入只读租约。会话不切换 CWD，
不从 JSON 路径授予输出权限。保持 LogDir 空及自动存图关闭，不记录原 pipeline；
有效截图必须 filename 空、png、quality100、节点名安全，原生动作仍为 Screencap。

停止排空后只固定内部 native 输出文件集、原 SHA 和覆盖可能，不声称时间戳唯一
或整个进程族停止。输出 scope 由外层保留，Host 在完整 worker/Agent 停止后须
重新收集核验。Host 在完整进程族停止后按原物理目录身份归档输出及逐文件摘要，
历史读取与 GC 引用使用归档，不重开当前输出目录。独立 worker 的真实 PNG 输出已经过该路径验证。
四类项目的完整生产组合仍须分别验证；编译 CanExecute 不替代运行准入检查。
合成测试不构成真实项目执行资格。

MaaFramework 提供独立框架直驱类型：受限 adapter 发现本机项目配置，现有 compiler 冻结接口、来源与依赖，原 worker 执行编译结果。
原生和程序事实按冻结运行、attempt、项目指纹、任务与重复次数校验；不将未知任务声明为可安全重试。
直驱入口与 MaaEnd/MaaStellaSora 数据专项相互独立；两个专项无需安装此通用驱动。
