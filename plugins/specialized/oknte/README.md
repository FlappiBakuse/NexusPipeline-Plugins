# OkNTE

将 OKNte 接入异环任务管理，读取已配置任务并跟踪执行结果。

0.5.0 手写四阶段适配。任务和证据范围见 [项目文档](../../../docs/projects/oknte.md)。构建按 `adapter/sources.json` 生成仓外单入口；不提交生成 runtime。

实例启动、Android 与配置回写约束由 manifest 的 instancePolicy 声明，Host 保存和执行均校验同一声明。配置探测提供绑定源码身份的覆盖摘要；未知启用任务不视为完整覆盖。

日常发现入口使用 `-t 2 -e`，对应上游的 DailyRoutineTask。
