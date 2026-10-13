# MaaFramework 项目直驱

`MaaFrameworkDriver` 是独立 managed 插件，要求 Host v0.17.3、Plugin API 2.2 和 Frontend API 1.7，运行环境为 Windows 11 x64。正式包不预装项目、游戏、native 或用户数据；安装范围以插件 catalog 为准。

## 根目录与保存

在脚本编辑器选择 `maa-framework` 并填写可信项目根目录。驱动只读发现唯一 PI v2 interface，以及 MXU schema 1.0、MFA 2.16 实例或 MaaPiCli v5.14.0 保存的配置。唯一来源自动绑定；多个候选需要选择具体来源与稳定实例 ID。缺少来源、未知字段、已删除实例或目标歧义会显示异常，不回退其他配置。

普通流程使用宿主的一次“保存”：稳定读取来源、冻结候选、准备锁定依赖、等待配置和设备空闲、真实初始化、确认清理，再联合提交插件不可变 revision 与宿主脚本指针。保存可能执行 PI pretask、启动 Agent 或已映射的游戏目标，停在第一条正式任务提交前。关闭编辑器不会取消后台操作；重开后查询同一 operation，不重复执行 pretask。取消须等待清理确认。修改失败保留上一有效 revision。

来源变更经过合并与稳定性核验，空闲后重新初始化并提交；运行中的计划保持冻结。每次准入重新核验输入。驱动不反向改写 GUI 配置。物理目录替换、选中实例删除、未知依赖或无法映射的字段进入异常，需要明确处理。

高级参数用于补齐必要的控制器、资源、运行库及目标约束。Win32 保存完整 EXE 约束，在 pretask 后重新解析唯一窗口；HWND、PID 和启动时间只代表一次观测。已有 exact-process 配置仍核验原强身份。ADB 使用实际 adb.exe 和精确 serial/address，不替换用户已保存设备。

## 来源与任务语义

schema 3 使用独立 occurrenceId，保留顺序、禁用条目、逐条选项、pipeline override 和 1–100 次重复；executionOrdinal 区分每次执行。schema 2 读取转换为独立 scope，保留原字节。MFA 依次读取实例局部、实例作用域、默认和全局字段，绑定选中实例、appsettings 与必要继承文件的稳定快照。CurrentTasks 历史不激活已删除条目。相同任务的多个条目不按显示名合并。

支持 MFA CountdownAction 与 TimedWaitAction，使用真实 native custom action 并参与取消；未知 GUI action、执行脚本、BeforeTask/AfterTask 动作明确拒绝。MXU 支持一个非 shell、无需等待退出且 skipIfRunning 的 PC EXE preAction，映射到宿主现役启动与就绪确认。保存初始化接收宿主就绪目标的完整映像、PID、启动时间和窗口身份；多个匹配目标阻断。

用户 override 匹配共享身份与 parent revision，保存经过 Host 初始化并提交独立绑定修订。共享修订变化后先重新套用用户修改，再初始化并发布新修订；旧授权不会直接用于新执行。

## 依赖与授权

已固定官方 MaaFramework native 5.14.3、5.14.2、5.14.1 和独立 C# binding 5.10.0。配方记录官方仓库、完整源码 SHA、Release/asset ID、下载摘要、平台、大小、安装路径和逐 DLL 摘要。按实际 DLL 字节识别用户安装；未知或多个 native 候选拒绝自动替换。已知 MaaEnd 2.32.0、MaaStellaSora 1.6.0 安装布局可识别现有 5.14.2；缺少运行库且无法确定配方时要求明确约束。

缺失 native 下载到本次操作拥有的 staging，核验固定资产和逐文件字节后原子安装到项目 `.nexus/maa-framework/deps/win-x64/<archive SHA>`。已有未知文件不覆盖，部分目录仅在归属可核验时清理；未确认的安装现场阻断后续安装。

MaaStellaSora 1.6.0 / native 5.14.2 的固定 Python 配方使用 CPython 3.12.10、maafw 5.14.2、MaaAgentBinary 1.0.1、numpy 2.5.3、StrEnum 0.4.15、json-with-comments 1.3.0。记录完整依赖关系、官方来源、许可证、归档与逐文件摘要；requirements 的实际字节进入锁。完全匹配的环境可复用，否则在 `.nexus/maa-framework/py/<recipe digest prefix>` 原子装配独立环境，锁中保留完整摘要。不会修改上游 Python 环境、系统 PATH 或执行 pip、sdist、安装钩子。worker 使用冻结的解释器路径与 `-B -s`；未知项目或声明明确拒绝。用户判断 Python 继续使用宿主现役解释器合同。

授权包含执行声明、资源、native、程序、Python 文件入口及有界本地代码。动态 Python `-m`/`-c` 入口拒绝。固定 argv 保留原样；只有生成的 pretask 选项载荷展开 secret 引用。密码放入 Host 受保护密钥存储，配置与预览只保存作用域引用。隔离 worker 不提供文件系统或网络沙箱，请只使用信任的项目。

## 初始化与结果

PI 解析接受 JSON/JSONC、BOM、相对 import 和展示翻译，拒绝重复字段、未知执行字段、循环、逃逸与 reparse point。单文件 8 MiB、总计 32 MiB、最多 128 文件。选项按任务声明、global、resource、controller、occurrence 层合并；翻译不改变任务身份或执行值。

会话设置仅本进程的 TEMP/TMP，并验证 CRT 临时文件位置。native 真实加载后执行 PI pretask、加载资源、连接控制器、启动 Agent 并完成官方 identifier 握手，确认 Tasker 初始化。resource hash 不一致按官方语义警告。initialize_only 发布 operationId、revision、fingerprint、native/project 版本及 formalTasksSubmitted=0，并在清理后结束。

pretask 默认 10000 ms，允许 1–120000 ms；Agent RPC timeout 支持官方 -1，但仍受 Host 启动、总预算及取消约束。stdout/stderr 增量脱敏后分帧，不静默丢弃长行。native 日志写入宿主提供的独占会话目录；文件身份、偏移、轮转与缺口进入 provider 日志来源元数据。结构化事实通过认证 IPC 传递，日志沿用宿主判断的字符尾部截断合同。Host 独立确认 worker 与必要写入进程停止后清理会话日志目录，清理不明形成恢复隔离，不能释放相关租约或盲目重放项目程序。

引擎和业务结果分别保存。实例判断复用宿主关键字、JavaScript/Python、SessionJudge 与运行桥；有效用户结论决定业务结果，子任务保留原生事实。取消、总超时、IPC 结构错误及清理隔离不能被规则抹去。未配置独立业务证据时，native 成功仍显示“流程已结束 · 有未核验项”。

通用判断的 configPath 指向 Host 按本次脚本／用户创建的 `configuration.json`，包含全局、资源、控制器及各 occurrence 的选项与 pipeline override。读取与 scriptDir 写入沿用通用文件 API；判断正文按通用脚本资产持久化。failed 结果可返回 `replaceConfigs: ["configuration.json"]`，Host 确认 worker 清理后备份并替换，重试重新编译有效值，最终恢复与清理。任务身份、顺序、启用、次数及安装根、设备、资源和程序授权保持冻结；不能通过替换重绑它们。该会话配置不会反写 GUI 来源或不可变 revision。

已知 Agent 文件日志按核对的项目声明读取：MaaEnd 2.32.0 的 go-service 使用 `debug/go-service.log`，其 native 日志为 `debug/maafw.log`；cpp-algo 的 native 日志为 `debug/cpp-algo/debug/maafw.log`。MaaStellaSora 1.6.0 的 Python Agent 使用 `debug/agent/yyyy-MM-dd.log`，native 日志为 `debug/maafw.log`。会话在启动项目程序前记录原文件身份与偏移，排除旧历史，保留被重命名文件的未读尾部。MaaUtils 复制后截断轮转仅在新备份的已消费前缀摘要匹配时补读；损坏编码、断档或验证预算不足报告 incomplete。已有同根 Agent 写入进程或身份无法核验时阻断运行；未知项目不猜测文件来源。

## 验证边界

现役入口为 `node tests/run.mjs plugin --plugin MaaFrameworkDriver --profile adapter --host-root <Host checkout>`。原生输入先用 `python tests/bootstrap-native.py --output <Temp 路径> --version <锁定版本>` 准备，运行时指定 `NEXUS_MAA_NATIVE_ROOT`。runner 记录源码指纹、输入及报告；所有本机产物由 Temp 根管理。

5.14.3/5.14.2/5.14.1 已通过受控 WinForms 目标的真实控制器、有限 DoNothing 任务、CountdownAction、仅初始化保存、官方 native 下载及来源同步测试；最新受控测试另覆盖关闭目标后的宿主启动和初始化。测试替代了真实游戏及项目业务，不能证明 MaaEnd/MaaStellaSora Agent、游戏任务或奖励成功。两项目真实安装的来源与 native 已只读核对，真实游戏验收仍待人工执行。

固定 Python 闭包、真实 Python Agent 握手及 pretask 初始化已在受控项目中通过；默认 adapter 同时验证该 5.14.2 组合。受控用例不运行真实项目 Agent 或游戏任务。

用户绑定的覆盖通过相同的初始化事务提交独立修订。共享配置变化后，按旧共享值、新共享值和用户值重新套用字段与任务覆盖，再初始化并以 CAS 发布用户修订。未修改的字段继承新来源，用户新增或修改的字段保留；来源删除已被用户修改的任务时提示处理并保留旧修订。编辑中的草稿不会因后台修订变化被覆盖，旧编辑修订提交时会报告冲突。

English scope: saving prepares locked native inputs, waits for shared resource admission and commits one initialized revision. Official native 5.14.3, 5.14.2 and 5.14.1 were exercised with a controlled WinForms target. A fixed CPython/wheel closure, Python Agent handshake, pretask initialization and initialized user-override rebasing were exercised separately. Game-specific agents and real gameplay require manual acceptance; synthetic results do not establish game success.
