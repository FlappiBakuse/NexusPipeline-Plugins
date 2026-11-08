# Host 集成协议夹具

这里保存插件业务的受控输出、日志、配置和厂商命令模拟。Host 侧保留通用进程/权限/持久化消费场景。

集成构建显式将 `NexusPluginFixturesRoot` 设为本轮 Plugins 源码导出的 `tests/host-fixtures` 绝对路径。Host 的 OwnedWriter 与 AndroidTool 通过通用 partial dispatch 消费这些源文件，编译回执将逐文件身份纳入重用判定。输入来自同轮 Plugins 源码导出，不从本机参考目录读取。Host 产品构建不需要该输入。

真实插件包、SDK receipt 与 fixture 编译输入必须属于本轮；原生运行报告仍记录实际进程与包身份。未提供 fixture 输入时通用 Host fixture 可独立编译，插件专属集成场景须在提供输入后执行。

`storage/emulator-inventory.json` 提供真实插件集成所需的厂商工具名、枚举输出、目录和配置样例；Host 按通用字段装配场景。受控 VM 以允许原子替换的只读句柄轮询设备状态。
