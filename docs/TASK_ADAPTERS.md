# 官方专项任务适配边界

公共协议见 [TASK_PROTOCOL](TASK_PROTOCOL.md)，框架见 [MXU](frameworks/MXU.md)、[ok-script](frameworks/OK_SCRIPT.md) 和 [MaaFrameworkDriver](MAAFRAMEWORK_DRIVER.md)，项目规则与历史资格见 [项目索引](projects/README.md)。本页保留原有链接锚点及共同作者工具。

## 官方发行发现与本轮资格（2026-09-25，中国时间）

[历史发行发现和样本](projects/README.md#历史发行发现与实际样本)。

## MXU PC 启动准入（v0.16.9）

[MXU PC 启动职责](frameworks/MXU.md)。

## 运行结束边界

[公共任务协议](TASK_PROTOCOL.md)、[MXU](frameworks/MXU.md) 与各 [项目边界](projects/README.md)。

## 关键源码分支与反例

按 [项目索引](projects/README.md) 进入；共同源码身份见 [source-lock](../tools/task-protocol/source-lock.json)。

## 作者审查清单

运行结束与业务任务成功分别判断。关闭游戏、关闭脚本、通知发送完成、保存计数和通用“完成”横幅均不能单独证明本轮任务完成。

1. 从实际启动入口追踪配置选择、默认值、迁移、父子开关、账号与资源覆盖顺序；为缺省和冲突提供反例。
2. 从业务判断追踪到实际日志输出通道，记录成功、失败、正常跳过、提前返回、异常捕获、内部重试和根结束；每条成功规则必须有正例与近似文本反例。
3. 审查重跑的消费、购买、领取、次数和状态副作用；只有所有扩张任务均安全才允许 retryUnit 与依赖闭包。未知风险停止，不能凭插件名称推断安全。
4. 在 discovery 声明 selectionFields 与 behaviorFields；测试第三方编辑、重名、数组重排和失败后恢复，保留最终计数。
5. 运行真实 Host Jint 夹具和全套资格入口；纯语法通过不能代替状态机、配置 journal 和进程集成。

Host 联调工具的 `--runtime-installations <matrix.json>` 从显式 `cases`（id/artifact/root/expectedEvaluation）只读捕获官方安装资源，账号配置仍为合成夹具；`output` 指向不存在的报告路径。先传 `--plugin-root <插件检出>`；不能用合成资源集合代替安装来源证据。旧 `configValidator` 对照入口已随该执行器退役。运行前用 `dotnet build <Host>/tools/NexusPipeline.TaskProtocolTests -m:1 -p:NexusTestHost=true` 构建，随后运行对应 Test Host 输出 DLL。

## 夹具维护

[fixtures](../tools/task-protocol/fixtures) 按插件划分正例、重复名称、缺失身份、日志来源、未配对终态、嵌套与选择重试。`example-*` 覆盖五种配置结构。Host 工具读取真实 manifest 和生成脚本，通过实际 Jint、归并器、选择补丁与恢复；缺少任一官方适配器或零用例会失败。新增可确认规则时，同时增加相反分支；未验证分支保持 unknown 并说明原因。

## 三阶段脚本按职责生成

`phase-modules.json` 声明模块提供的符号、依赖和阶段根。生成器按依赖顺序输出自包含脚本；发现和观察不包含重试执行器，重试保留所需发现逻辑。每次调用使用独立 Jint 环境，跨批次状态只通过受限 cursorState 传递。

- 公共纯函数保留在 `core/`，适配器源文件按职责位于各自子目录，只有一份源码权威。
- 作者模板和五个示例使用同一生成器；未适配模板继续被源码、包和 Host 校验拒绝。
- 每个阶段在访问配置前拒绝错误的 `input.phase`。真实 Host Jint 联调同时验证阶段拒绝、受限 API、发现、观察、选择补丁和恢复。

构建单测验证缺依赖、循环、重复符号、阶段闭包及只读 `--check`。这些测试不替代完整 Host/插件发布资格。

## BAAH 顺序和错误恢复

[BAAH 顺序和错误恢复](projects/BAAH.md)。

## ZZZ 应用组和体力子范围

[ZZZ 应用组和体力子范围](projects/ZenlessZoneZeroOneDragon.md)。
