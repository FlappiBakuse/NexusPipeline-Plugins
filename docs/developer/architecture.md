# 插件所有权

managed 插件只消费固定公共 SDK，不依赖 Host/Core 私有类型。
specialized 插件不包含浏览器模块或 .NET 程序集。
共享适配 runtime 不反向导入具体游戏插件。
契约镜像必须携带 SDK 版本、来源快照与字节摘要。
全部构建、依赖、生成脚本结果和 ZIP 只写显式仓外路径。

正式浏览器入口与核心交互测试共用一个编辑器和状态流程；fixture只替换受控I/O，不另选功能不同的界面。
新增Host/SDK能力对应具体业务缺口及关闭用例，插件复用现役权限、调度、资源与恢复owner。
完整来源身份持续保留，构建与包复用按实际传递输入判断；随包文档、manifest或资源变化仍使对应包失效。

专项目录发现声明 `specialized.sourceDiscovery` 和 `selected-script-root`，实现 `nexusDiscoverScript`。Host 只向该调用提供有界、只读的 `nexusListSource`/`nexusReadSource`；响应使用 `nexus.script.source`，列出明确的程序、参数、配置资源和可选 Maa 项目选择。每个配置路径必须有对应资源，不能借额外路径绕过账号快照。发现不启动程序、不写上游文件，所有候选仍由 Host 核对目录身份与当前安装修订。

本地化权威为各插件 i18n 字典，构建器生成 metadata，专项任务另生成 adapter titleLocales；
catalog、Host 及浏览器消费同源投影。SDK/schema 修改必须先生成并构建实际 SDK，再通过 import_sdk 导入，
不能手改 contracts 镜像或 fingerprint。

`node tests/specialized/diagnostic-locales.mjs <源码绝对路径> <仓外目录>` 使用现役合成配置与发现向量，
核对八专项实际返回的诊断码均有中英文文案，并保留不支持控制器的读取拒绝；实际安装面板和真实上游范围另行验收。
