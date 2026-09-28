# MXU 既有专项框架

## 输出编码

MaaEnd 与 MaaStellaSora 的 MXU stdout／stderr 均声明 `utf-8`，在字节流边界使用有状态解码器，再分行。固定 MXU v2.6.1 commit `a7fdd0b32bfadc1df1bf8c6293bf2395676542b8` 的 [`commands/state.rs`](https://github.com/MistEO/MXU/blob/a7fdd0b32bfadc1df1bf8c6293bf2395676542b8/src-tauri/src/commands/state.rs) 以 Rust `String` 和 `println!` 写入任务 stdout，没有依赖 Windows 系统代码页。其他框架需要独立的输出编码声明和来源验证，不按插件名称套用。Host 字节流验证覆盖多字节拆分、CRLF、stderr 与无换行尾行；源码资格不代替真实发行游戏运行。

本页维护 MaaEnd／MaaStellaSora 既有 GUI 专项的共同配置和日志规则。独立直驱见 [MaaFrameworkDriver](../MAAFRAMEWORK_DRIVER.md)，公共任务证据协议见 [TASK_PROTOCOL](../TASK_PROTOCOL.md)。

MaaEnd 与 MaaStellaSora 的自动执行实例在 PC 模式分别评估 Host、上游和已经运行的启动责任。Host 选择启动时必须配置游戏目标，由 Host 的窗口就绪等待负责确认；Host 不启动时，运行前可见游戏窗口或当前实例明确同目标的 `preActions` / `__MXU_LAUNCH__` 任务可准入。没有窗口且双方均无启动动作时阻断；配置了其他启动器或预任务但不能确认它会启动同目标时给未知警告。预览不读取运行时窗口事实，显示未知。启动动作准入不等于 MXU 控制器已连接，运行期仍由 stdout、总预算、启动及无活动超时判断。当前尝试的 MXU 启动动作明确报告程序启动或参数错误时，Host 立即失败、确认进程清理，并使用原有专项任务状态决定是否安全重试。

这条规则只用于 PC：MaaEnd 官方 `AndroidOpenGame` 任务限定 ADB/CloudADB/PlayCover，不能用作 PC 启动证据；MaaStellaSora 官方接口的桌面端、安卓端和 PlayCover 是独立控制器。两者机器 ID 保持现有 `maaend` / `maas`。当前官方定向源码核对：MXU [v2.6.1](https://github.com/MistEO/MXU/releases/tag/v2.6.1) commit `a7fdd0b32bfadc1df1bf8c6293bf2395676542b8`，`src/types/specialTasks.ts` SHA256 `6fd4ee57923ff5f2ac9b6c79b98caf0a8f347c9d9d46380d1db7cb07a3d3e465`、`src/components/Toolbar.tsx` `b3ceb0e9a8199a4163b0687f4d84d402f791980f9f40ccbd4347925fdd20c089`、`src-tauri/src/mxu_actions.rs` `4daef34a40080b23c0f855bca601ee2f9d9dc3cf3dff5968746d6ac4253d1abe`。MaaEnd [v2.29.0](https://github.com/MaaEnd/MaaEnd/releases/tag/v2.29.0) commit `1ce59e63cf3807212f6655d7eba6981ed2c59508`，`assets/interface.json` SHA256 `85709d60057125789e2f1687604037da58e180bbb512e103ee113a0cce1937e9`；MaaStellaSora [v1.4.4](https://github.com/MaaStellaSora/MaaStellaSora/releases/tag/v1.4.4) commit `4009bc79591ad189d80f8f5d74d34d78bb8508cd`，`assets/interface.json` SHA256 `91fffd3dbe413a94205424e8299c4ce0e327edeb481dbccbf0cc4ecbb83f7f`。这是针对启动字段与控制器的审查，不替代两款安装包和真实游戏验证；`source-lock.json` 的高级日志/任务分支仍需逐文件重新审查。

| 适配器 | 当前运行边界依据 |
|---|---|
| MaaEnd / MaaStellaSora | 同一 stdout epoch 内，全部已选任务具有唯一名称匹配的开始与终态回调；缺失、歧义或日志缺口保持未确认 |

MXU 的 system 语言配置按可用接口翻译解析，观察阶段接受经声明的各语言名称；开始/完成/失败回调支持简中、繁中、英文、日文与韩文。缺失接口翻译时按上游输出去掉 `$` 的键名。stdout 按上游去除名称中的 HTML 标签，显示仍保存原名称；归一化后同名（包括与 unsupported 任务同名）拒绝归属。适配器自身 `*.metadata.json` 的 importTasks 记录固定源码审查得到的导入任务索引，只读取本轮配置涉及的接口分片，避免无关的大型选项树耗尽 Jint 配额。接口可在顶层省略 `task`，前提是声明了非空 import 数组；此时任务定义只从导入分片读取，缺失或无法确认的分片仍降低对应任务覆盖，不以空顶层任务误判整个配置。顶层 `task` 若存在但不是数组仍拒绝解析。索引未知的导入仍尝试读取，无法确认的任务保留 unsupported；上游调整导入布局时需重新审查。JSONC 解析保留字符串中的 URL、注释样式文本和逗号，宿主原有时间、语句与内存限额保持不变。

冷启动选择使用持久化 `enabled`。`runOnce` 不属于上游 SavedTask，也不由 importConfig 恢复；`enabledByController` 由控制器切换逻辑消费，不能直接覆盖冷启动的 enabled。已移除的控制器/资源名称按 importConfig 清除、Toolbar 回退到当前首项，再计算兼容性；不改写用户配置。`Probe-MxuBranches.mjs` 接受显式上游源码和 Host 目录，校验 source-lock 后执行原 TypeScript 纯函数，核实翻译回退、运行时选择、控制器切换和 stdout 规则。

真实实例导出可以通过显式只读回放入口检查；单份当前配置不代表每一份历史日志当时的配置。原始配置、日志及包含实例身份的报告保留在仓库外，正式 fixture 使用合成数据。星塔旅人已有单配置真实启动和退出样本，业务终态仍未核验；不能借此宣称多语言、全部资源和安装包组合通过。

MXU 匿名 focus 的限制已通过锁定原 `handleCallback` 实际执行核实：异步内容解析可晚于下一任务开始，输出 log/stdout 不携带原 task_id。适配器因此不按“最近任务”分配它，也不把此类文本当成独立业务终态；两产品均有 Jint 反例。外层回调只能证明其自身配对范围，无身份的内部 focus 仍是明确受限项，不能承诺从外层成功确认每个内部资源节点。

## 已审查源码分支与反例

- MXU `commands/state.rs` 在 stdout 添加毫秒时间前缀。UI 任务消息经 log_to_stdout 才进入宿主；文件中的同名文本、单独结束行、跨 epoch/缺口和重复显示名称都不建立成功。interface import 不在声明白名单或缺失时降低检测覆盖。
