# BetterGI 四阶段适配

将 BetterGI 一条龙配置接入任务管理，读取任务选择、跟踪运行结果并支持配置检查。

目标版本 0.5.0，固定 BetterGI 0.66.0；发行和源码身份见 `upstream.json`。
`adapter/sources.json` 按序登记手写模块，构建时合并为仓外单一 `adapter/main.js`。
适配器只消费公共 `nexus.task.adapter` / 1 的内存输入，不访问文件、网络、进程或 native 对象。

主资源 `one-dragon` 绑定明确选择的一条龙配置；可选 `extra-user-config` 绑定 `User/config.json`。
发现保留现代 GUID、旧键、重复名称、上游顺序、原禁用、未列入顺序及缺少声明的条目。
完整覆盖八类内置任务和配置组的外层日志闭环；不推断任意脚本内部结果。

日志使用当前进程 PID、文件信封、上下文、epoch/sequence 和 Host 传递的有界 checkpoint。
跨批正文、重复事件、日志轮换、缺少终态、取消、嵌套 finally 与迟到冲突均有定向用例。
失败不会被后续完成横幅或成功覆盖；未证明完整日志流时不提前交付成功。

配置编辑只返回绑定 operation、资源摘要和 revision 的 CAS 提案；支持现有任务开关、顺序、已有名称映射和明确选中配置。
额度、日期、完成计数、游标和未知字段不进入自动编辑或重置。
安全重试只提议本轮已选、启用且明确失败的内置任务；任意配置组副作用及未知结果不自动重放。
实际提交、writer 停止、恢复、预算与外部配置选择投影仍由 Host 审核和执行。

专属用例与实际 Host interpreter component 验证入口见 `tests/specialized/bettergi`，逐业务来源与验证边界见 `docs/projects/bettergi.md`。
安装 Host、持久重试、浏览器接入与真实 BetterGI 发行二进制资格仍需独立验证；组件测试通过不代表这些资格完成。

实例启动、Android 与配置回写约束由 manifest 的 instancePolicy 声明，Host 保存和执行均校验同一声明。配置探测提供绑定源码身份的覆盖摘要；未知启用任务不视为完整覆盖。
