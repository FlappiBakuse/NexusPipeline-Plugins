# MaaFramework 框架直驱

这是独立安装的 managed 插件，需 Host v0.16.9 / Plugin API 1.9。原有 MaaEnd、MaaStellaSora 专项和用户配置不会自动迁移。插件使用自己的 profile，经现有 Host 队列、用户绑定、历史和恢复流程执行。

配置、显式导入、支持范围和现役验证入口见 [MaaFramework 框架指南](../../../docs/MAAFRAMEWORK_DRIVER.md)。仓库文档不随商店 ZIP 打包，包内保留本说明与 `LICENSES/`。

## 配置和信任

项目检查与预览只读取批准项目根内的 PI v2 声明，不加载 native，也不启动 Agent、pretask 或更新器。执行前需明确选择运行库、控制器、资源、任务和参数，并确认执行授权摘要。执行声明、代码或解释器身份变化需重新授权；展示文案变化不撤销授权。

项目 Agent 和 pretask 是代码。进程隔离不等于沙箱，项目可以写共享根或联网；共享可写根由 Host 串行保护。密码只保存 secret 引用，运行时通过受控引导输入进入 worker 内存；不写普通配置、预览或历史。项目程序的 stdout/stderr 被消费但不转发，避免密码回显。

## 状态

开发中的首版尚待完整用户入口、显式导入、官方项目契约、原生与发行门禁验收。不能将本目录的存在或编译通过当作可用首版交付。

## 构建输入

worker 使用官方 `Maa.Framework.Binding.Native` 与 `Maa.Framework.Binding` v5.10.0 的 net7.0 资产，在 .NET 8 x64 独立进程内运行。来源 commit 为 `27c69a5b8ff41b6002ead71f403a16f442a7168e`。项目原生库按其自身版本使用，不统一替换为插件构建版本。官方绑定为 LGPL-3.0-only；发行包需附对应许可、来源与替换说明。
