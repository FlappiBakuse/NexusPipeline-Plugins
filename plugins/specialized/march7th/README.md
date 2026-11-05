# March7thAssistant

将三月七小助手接入任务管理，读取任务配置、跟踪执行结果并支持配置检查。

0.5.0 四阶段手写适配器。当前业务范围、YAML语义输入及验证边界见 [项目文档](../../../docs/projects/march7th.md)。构建从 `adapter/sources.json` 合并仓外单入口，不提交生成 runtime。

实例启动、Android 与配置回写约束由 manifest 的 instancePolicy 声明，Host 保存和执行均校验同一声明。配置探测提供绑定源码身份的覆盖摘要；未知启用任务不视为完整覆盖。
