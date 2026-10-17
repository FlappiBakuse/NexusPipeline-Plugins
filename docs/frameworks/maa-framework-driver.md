# MaaFramework 项目直驱

`MaaFrameworkDriver` 要求 Host v0.17.3、Plugin API 2.2、Frontend API 1.7 和 Windows 11 x64。产品包不包含项目、游戏、运行库或用户数据。

pretask 与 Agent 的 `PI_CLIENT_VERSION` 从实际 Host 的入口程序集产品元数据读取，经认证 worker 会话输入传递，不取插件或 worker 的程序集版本。`PI_INTERFACE_VERSION`、`PI_CLIENT_MAAFW_VERSION` 与 `PI_VERSION` 分别表示 PI 协议、原生运行库与项目版本，独立维护。

## 发现与配置

从根目录或 assets 的 interface.json/interface.jsonc 读取 PI v2。多个 interface 必须显式选择。MXU schema 1.0、MFA 2.16、MaaPiCli v5.14.0 和 MFW-PyQt6/CFA v4 配置按真实来源实例绑定；未知来源、实例删除、歧义或无法映射的执行字段明确报错，不回退到其他配置。

schema 3 的 occurrenceId 独立于显示名，保留顺序、禁用状态、逐条选项、pipeline override 和 1–100 次重复。相同名称或参数的 CLI 条目也保持独立身份。MXU/MFA/CLI 选项按 global、resource、controller、task 层合并。CFA 按已保存的可见 setting/resource/controller 选项、任务声明、任务选项顺序深层合并，不注入未保存选项的默认值；数值输入按声明类型转换。CFA 读取 multi_config/configs 的实例、bundle、controller、resource、分支及子选项；Win32 程序路径、参数和等待时间映射到宿主启动设置。CFA 保存的关闭状态 speedrun 元数据不参与任务选项编译；启用状态、未知内置动作、未映射的 ADB 方法覆盖及额外前后动作会阻断，不能静默丢失语义。嵌入式 Agent 配置可读取任务语义，但保存初始化与执行明确拒绝 GUI 进程内注册模式；只有上游明确选择外部 Agent 且本地环境完整时才执行外部程序。来源原字节保持不变。

MFA 的 CountdownAction/TimedWaitAction 由 native custom action 执行；未知动作拒绝。MXU 的单个非 shell、非等待、skipIfRunning PC preAction 映射到宿主启动与就绪确认。Win32 以完整 EXE 和窗口约束解析唯一目标；HWND/PID/启动时间只代表本次观测。ADB 使用保存的路径和精确 serial/address。

MFA 保存的窗口类名、标题及 Agent TCP 偏好保留在导入来源信息中。窗口标签只是 GUI 的匹配提示，不能覆盖 Host 已核验的进程身份；Agent 通道由驱动独占会话管理，不继承 GUI 的通道生命周期。

宿主“保存”负责冻结候选、共享资源准入、初始化、清理和 revision 联合提交。initialize_only 可以执行 pretask 和 Agent，但 formalTasksSubmitted=0。关闭编辑器不会重复初始化；取消必须等待清理。失败保留上一有效修订。用户覆盖以 parent revision 绑定，冲突不覆盖现有指针。

## 本地运行输入

驱动识别本地常见 native 目录，也支持显式目录。必需 DLL、x64 PE 架构、文件大小、SHA256 和物理根身份记录在 RuntimeInputs；原生进程加载后核对 v5 ABI。未知或多个候选必须处理。没有产品下载器、逐项目版本配方、pip 安装或系统 PATH 回退。

Python 使用发行包内解释器或显式路径；入口必须是可冻结的本地文件，保留原 argv。动态 -m/-c 拒绝。声明 uv run 时要求本地 uv.lock 与 .venv，启动设置 offline/no-sync。requirements、pyproject、uv.lock 及有界本地程序代码进入输入指纹。程序、资源或 DLL 改变后重新保存。旧 dependencyLock 保留读取，但不能代替新绑定。

PI 文件支持 JSON/JSONC、BOM、相对 import 和展示翻译；拒绝重复字段、循环、逃逸及 reparse point。单文件 8 MiB，总计 32 MiB，最多 128 文件。翻译不改变执行值。密码通过宿主受保护存储引用，普通配置和预览不返回明文。

## 同步、结果与重试

一个物理根共享文件 watcher。变更合并后，在空闲时只读重新编译来源并发布修订，不启动 native、Agent 或 pretask。没有变更时仅做低频文件元数据核验。运行计划不被后台同步替换；准入重新核对冻结输入。

可选 SDK 字段 ResultBasis 默认为 legacy-provider；本驱动声明 framework-task-v1。worker 通过认证 IPC 上报本次真实 native job ID 和任务终态。普通任务失败在资源清理后发送 completed/maa.task_failed；加载、资源、IPC、取消及清理异常保持独立失败。宿主在同一 run 中保留有效成功结果和逐次报告，通过 SelectedTaskIds 续跑首个失败任务及后续未成功任务。原始顺序不变，空集合不启动 worker，最大尝试次数和总预算仍由宿主限制。

Maa 隐藏并拒绝新增/修改自定义判断，保留旧资产但不执行。框架任务成功显示“完成（框架）”，业务核验仍为 unverified。没有日志关键字猜测或判断配置替换重试。native 日志使用宿主独占会话目录，Agent stdout/stderr 经脱敏传递；不扫描项目私有日志。进程退出和资源清理未确认时保留隔离并阻止重试。

## 验证边界

现役入口：`node tests/run.mjs plugin --plugin MaaFrameworkDriver --profile adapter --host-root <Host checkout>`。测试输入通过 `tests/bootstrap-native.py` 和 `tests/bootstrap-python.py` 准备到 Temp，并以官方资产大小、SHA256 和逐文件摘要固定；它们仅用于测试，不进入产品运行依赖。

组件回归覆盖 PI/来源/运行输入/任务选择等规则。受控 WinForms、官方 native 5.14.3 与发行包 Python Agent 验证真实初始化、有限任务、A/B/B/C 续跑和来源同步不重放预任务。它们不证明真实项目 Agent、设备或游戏业务成功。官方项目发行布局的只读发现不等于 GUI 配置等价或真机资格；缺少这些证据的项目继续保持待验收。

English scope: local PI v2 distributions and saved GUI configurations are frozen into immutable revisions. Runtime libraries and Python inputs are verified locally; the product does not download or install dependencies. Authenticated native task failures permit bounded suffix retries while preserving successful tasks. Passive source synchronization starts no project programs. Maa judgement assets remain stored but are not executed. Controlled native/Agent tests do not establish real-game compatibility or business success.
