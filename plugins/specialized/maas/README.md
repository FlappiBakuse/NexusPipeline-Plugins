# MaaStellaSora

NexusPipeline 0.18.0 / SDK 0.1.0 专项，版本 0.5.0。

需用户安装对应上游程序；无需通用 MaaFramework 插件。包内仅含声明、受限适配脚本和说明，不包含上游程序、DLL、worker、原生库或浏览器模块。

通过已保存账号配置及选定目录的声明只读 JSON/JSONC 资料发现任务。执行调用上游程序，任务结果来自其实际日志；未知任务保留并标记未核验，禁用未知项不阻断已知任务。

MaaEnd 以 settings.autoStartInstanceId 唯一匹配自动实例，使用 --autostart --quit-after-run。MaaStellaSora 绑定 config/instances 的稳定文件 ID，使用 --instance；缺失 DefaultConfig 文件时回到 config/config.json。

单文件账号快照由 Host 提供已绑定的来源路径以识别稳定实例；配置选择和写回仍使用快照内路径及原修订。

原生编辑在宿主配置事务内运行；MaaStellaSora 仅对已绑定 settings 的 NoAutoStart 做准备/提交补丁，取消恢复原字节。运行及编辑须证明 writer 停止才能发布或恢复。

本轮真实上游执行、取消、恢复及游戏环境验收待独立测试和实机阶段完成。

实例启动、Android 与配置回写约束由 manifest 的 instancePolicy 声明，Host 保存和执行均校验同一声明。配置探测提供绑定源码身份的覆盖摘要；未知启用任务不视为完整覆盖。
