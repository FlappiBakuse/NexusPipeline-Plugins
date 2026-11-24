# MaaEnd 专项

实例和参数由 [adapter](../../plugins/specialized/maaend/adapter/discovery.js)维护，支持身份见 [upstream.json](../../plugins/specialized/maaend/upstream.json)。纯数据包、冻结只读资料和 Host 配置恢复的共同规则见[专项指南](../authors/specialized-adapters.md#maa-数据专项共同边界)。

MaaEnd 以 `settings.autoStartInstanceId` 唯一匹配实例，使用 `--autostart --quit-after-run`。未设置、缺失或歧义时保留阻断诊断，通过已有配置编辑选择有效自动实例。

首次编辑枚举 `mxu.json` 或 `config/mxu-*.json` 中的独立实例。打开程序时只带入当前选择。保存时只能保留一个实例，其 ID 成为账号配置的自动启动实例。安装目录中的原实例和自动启动设置在编辑结束后恢复。

从主 interface 及声明导入闭包按顺序收集 pretask，保留身份、选择、依赖和配置校验。`tests/specialized/maaend/cases.mjs` 的 `tasks/pretasks/LaunchGamePC.json` 是额外配置形态夹具，来源研究记录指向 MaaEnd 3.0.0；当前支持锁仍以 upstream.json 为准。

原版英文输出的 `Running pre-task` 和 `Pre-task completed` 仅归属同名的已选前置任务。普通任务仍按各自的开始与终态配对。

任务结果使用五语种成对外层事件，核对当前来源、顺序、缺终态和失败保留。未知任务和原配置保留，重试只投影已知且获准选择的任务。

确认未启动任务时，标准输出须覆盖按顺序到达的任务，MaaFramework 文件日志须同时给出同一进程和任务队列的原生终态及停止事件。标准输出出现解码断点时撤销该来源的任务归属。

验证归属见[Maa 覆盖](../reference/maa-coverage.md)，组件入口见[验证指南](../development/validation.md)。
