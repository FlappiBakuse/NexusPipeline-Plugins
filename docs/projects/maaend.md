# MaaEnd 专项

实例和参数由 [adapter](../../plugins/specialized/maaend/adapter/discovery.js)维护，支持身份见 [upstream.json](../../plugins/specialized/maaend/upstream.json)。纯数据包、冻结只读资料和 Host 配置恢复的共同规则见[专项指南](../authors/specialized-adapters.md#maa-数据专项共同边界)。

MaaEnd 以 `settings.autoStartInstanceId` 唯一匹配实例，使用 `--autostart --quit-after-run`。未设置、缺失或歧义时保留阻断诊断，通过已有配置编辑选择有效自动实例。

从主 interface 及声明导入闭包按顺序收集 pretask，保留身份、选择、依赖和配置校验。`tests/specialized/maaend/cases.mjs` 的 `tasks/pretasks/LaunchGamePC.json` 是额外配置形态夹具，来源研究记录指向 MaaEnd 3.0.0；当前支持锁仍以 upstream.json 为准。

任务结果使用五语种成对外层事件，核对当前来源、顺序、缺终态和失败保留。未知任务和原配置保留，重试只投影已知且获准选择的任务。

验证归属见[Maa 覆盖](../reference/maa-coverage.md)，组件入口见[验证指南](../development/validation.md)。
