# MaaEnd 专项

当前版本 0.5.0，消费 Host 0.18.0 / SDK 0.1.0。

专项保持纯数据和受限 JavaScript；用户自行安装上游程序，无通用 MaaFramework 插件前置。配置资源绑定用户快照，只读 interface/import/locale 按声明闭包捕获并冻结，不参加配置交换。

MaaEnd 按 autoStartInstanceId 唯一匹配实例，以 --autostart --quit-after-run 运行。MaaStellaSora 使用 config/instances 的稳定文件 ID 和 --instance；继承 local 非 null → 当前实例 global → default global → global 普通字段，保留 DefaultConfig 缺失回退。

MaaEnd 在声明的只读 interface 导入闭包中收集 `pretask`，按主文件、导入文件的顺序解析。验收使用 MaaEnd 3.0.0 的 `tasks/pretasks/LaunchGamePC.json` 形态，验证 PC 启动前置的身份、选择、依赖及配置校验。重复定义保持未核验。没有有效自动执行实例时保留阻断诊断，并通过已有配置编辑入口引导选择。

任务保留顺序、选项、自定义名和未知原值；未知禁用项不阻断，未知启用项标记未核验，不加入已知成功分母或安全重试选择。重试仅修改具备冻结配置投影的已知任务，保留未知项和其他实例。

结果来自上游日志的源、epoch、sequence 和终结 drain。MaaEnd 使用五语种成对外层事件；MaaStellaSora 使用实例日志、顺序及有限重复，同名歧义保持保守。原始进程和恢复事实仍由 Host owner 提供。

原生编辑由现有 Host 配置事务启动、收集并恢复；MaaStellaSora 对绑定 settings 的 NoAutoStart 执行有限 prepare/commit 补丁，取消不执行 commit。

包只包含 manifest、声明 adapter/main.js 及说明文档；不包含 DLL、EXE、native、worker、runtime 或 frontend。来源参考不是运行依赖，包内不附上游软件。

当前测试与覆盖归属见 [Maa 覆盖](../developer/maa-coverage.md)。实际定向回归和真实程序验收分别使用当前固定源码与产物，记录精确场景和原始结果。
