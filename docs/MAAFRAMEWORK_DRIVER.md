# MaaFramework 项目直驱

`MaaFrameworkDriver` 是独立 managed 插件，要求 Host v0.16.9、Plugin API 1.9 和 Frontend API 1.5。它不进入 Host 初始载荷，原有 MaaEnd、MaaStellaSora 专项和绑定配置不会自动迁移。

## 用户入口

安装并启用插件后重启 Host。在脚本编辑器选择 `maa-framework`，指定项目根目录，然后在插件区域读取项目。选择 Controller、Resource、任务及顺序；可显式应用 PI preset 或项目默认任务，group 负责分组展示。参数可在公共层填写，也可分别设置资源、控制器和逐任务 JSON 覆盖。

Win32 使用“查找并选择 Win32 窗口”，保存 HWND、PID、完整 EXE 路径和启动时间。执行时再次核验这四项身份。ADB 填写实际 adb.exe 和精确 serial/address；控制器由官方 MaaToolkit 枚举并连接。目录、程序和资源变化需要重新预览、授权。

依次执行“只读执行预览”与“确认授权并保存独立配置”，最后保存 Host 脚本。用户绑定页可以设置独立参数，绑定必须对应当前共享配置 revision；共享配置更新后重新读取并明确授权绑定。加入既有队列后使用原有开始、取消和历史入口。

Agent / pretask 是项目代码，授权摘要包含执行声明、资源和程序身份。隔离 worker 不提供文件系统或网络沙箱。密码通过 Host 受保护密钥存储保存，配置和预览只包含引用；引用按 profile、用户和脚本绑定隔离。项目 stdout/stderr 不进入历史。

## 显式导入

填写批准项目根内的源文件相对路径，选择 MXU schema 1.0 或 MaaPiCli v5.14.0。MXU 必须选择精确实例 ID。先预览映射，再明确载入独立草稿，补齐运行目标后重新预览、授权和保存。源文件不写入，不启动 GUI，不隐式同步。

导入保留任务身份与顺序、禁用选择和支持的选项层。未知执行字段、删除的任务或选项、控制器缓存冲突明确拒绝。密码需要受保护地重新输入。MXU 单个启用、无需 shell、无需等待退出的 PC EXE preAction 可只读映射到 Host 启动设置；先显示路径和参数，再明确确认应用到当前脚本，执行使用 Host 就绪后的强身份。多动作、命令脚本、shell 或改变语义的分支拒绝，不静默遗漏。普通保存设备配置与界面缓存分开解释。旧专项仍使用原 GUI，不自动迁移。

## 编译及运行边界

编译器只读 PI v2 JSON/JSONC、BOM、相对 import 和展示翻译；检查重复身份、过滤条件、引用、循环、根目录逃逸和 reparse point。当前能力锁定 PI v2.10.2：未知执行字段显示所在文件和字段并拒绝；telemetry 不执行。文件预算为每文件 8 MiB、总计 32 MiB、最多 128 文件。只翻译展示字段，任务身份、entry 与 pipeline 值保留原样；公开界面 schema 不携带整份 pipeline_override。任务覆盖按任务声明、global option、resource option、controller option、task option 顺序合并。checkbox 使用声明顺序；input 支持 string/int/bool、verify，hotkey 按 Win32/ADB 键码展开。

标准 Agent 使用官方 MaaAgentClient/server identifier 握手。pretask 在 interface 所在目录先执行，声明的选项以紧凑 JSON 放在最后一个参数。PI_* 环境按 PI v2.10.2 提供。pretask 超时范围为 1–120000 ms，默认 10000 ms；Agent RPC timeout 还接受官方项目使用的 -1。它不取消 Host 的 30 秒整体启动预算、总运行预算或取消边界。取消沿 Host 受控 IPC 传播，Host 独立确认写入进程已经停止后恢复配置。

每次执行使用独立 x64 worker，仅从明确选择的原生目录加载 DLL。版本必须与配置声明一致；ABI 缺失、架构错配和握手失败拒绝执行。上游 resource hash 不一致显示警告。原生任务成功只证明引擎完成，没有项目业务证据时仍显示“流程已结束 · 有未核验项”。结构化事件通过 Host 历史模型保存，既有 taskProtocol 日志证据格式保持兼容。

## 当前原生验证范围

已固定 C# binding 5.10.0（源码 commit `27c69a5b8ff41b6002ead71f403a16f442a7168e`）及官方 MaaFramework v5.14.0 x64 测试输入。MaaEnd v2.30.0 附带 v5.14.0，MaaStellaSora v1.4.4 附带 v5.13.0；两份发行 ZIP、原生成员和来源固定在 [official-projects.lock.json](../plugins/general/MaaFrameworkDriver/official-projects.lock.json)。测试只读编译真实 PI、使用真实任务 ID 对照普通 MXU 导入与有效计划，实际查询版本和通信字节预算，不执行官方项目 Agent 或 GUI。

受控窗口和自有 ADB transport fixture 实际调用上述 v5.14.0／v5.13.0 原生 Win32/ADB controller，不连接用户设备；标准 Agent、pretask、任务成功/失败、取消、控制台输出脱敏及启动故障分别留有原始报告。v5.13.0 新增组合覆盖自有 Win32 与 ADB Agent/pretask。真实账号、真实游戏、真实模拟器和其他 runtime 组合的状态独立报告，不能据此宣称官方项目业务成功或全版本支持。

## 构建和门禁

在新建隔离 checkout 准备仓库 npm 依赖并构建现有前端。managed 测试仍由现役入口执行：

```powershell
npm ci --no-audit --no-fund
npm run build:frontend
python tools/repository.py test-managed --full --host-root '<隔离 Host checkout>'
```

Maa 原生测试准备从 [native-tests.lock.json](../plugins/general/MaaFrameworkDriver/native-tests.lock.json) 和项目锁下载并核验官方 ZIP；可分别读取 `NEXUS_MAA_NATIVE_ARCHIVE` 指定的 ZIP、`NEXUS_MAA_PROJECT_ARCHIVES` 指定目录内的锁定项目 ZIP。每次都从验证过的归档解压到新的自有目录，不信任既有解压缓存。输入清单和原生事件位于 `.generated/test-results/maa-native/`，TRX 位于 `.generated/test-results/managed/run-*/`。缺依赖、零用例和 skip 都不算通过。

现役 package builder 发布独立 worker，并验证 apphost、runtimeconfig、锁定 binding 版本及 LGPL/GPL 许可。包内没有项目 native、游戏、测试 EXE 或用户配置。构建输入与 SDK source 由验证/候选任务固定；本地 dirty 源码诊断包不等于发行候选或商店已上架。
