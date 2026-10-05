# 专项配置编辑与修复

本页负责 `configEditor` 的输入、权限、生成和写入责任。任务发现、配置检查与日志观察见 [任务协议](TASK_PROTOCOL.md)；各项目字段见 [修复覆盖表](../frameworks/COMPLETION_ACTIONS.md#当前配置修复覆盖)。官方资产固定为 `data/editor.js`，文件名不改变 manifest 公共字段。

## 两种调用

| 调用 | 输入与 API | 写入责任 |
|---|---|---|
| `config-edit-commit` | 编辑进程退出后的冻结 input 与附加工作副本；与准备阶段相同的受限文件 API | 保存快照前清除临时编辑设置；失败保留会话，取消不调用；当前 0.2.0 编辑器支持，旧协议不调用 |
| `config-edit-preparation` | `nexus.input` 的 mode、configInputName、configInputValue、extras；现役 listFiles/readFile/writeFile/exists/toast/notify | Host 隔离后的附加工作副本；主配置禁止写入；失败回滚，不启动上游 |
| `config-repair` | `nexus.input` 的 rule、document、context；只读 `nexus.readConfig(id)` 与 `nexus.proposeRepair(value)` | 脚本只返回建议，无文件、进程、网络或 CLR 权限；Host 校验、预览、确认后提交用户快照 |

修复 context 包含当前 `configInputValue`、`pc`、Host 的绝对 `gamePath` 与 `gameArguments`，不合格路径传空值。rule 是当前冻结的 manifest 规则；document 是这一条规则对应的配置对象，MFA 的继承优先级由 editor 按稳定实例 ID 读取当前用户主/附加快照计算。readConfig 只接受当前用户主快照内 config:<相对路径> 或 extra:0，每次提案最多读取 32 次、累计 8 MiB，逐文件限制 2 MiB、禁止路径逃逸和重解析点，不访问上游现场。不能将此输入或提案当作原生运行日志。

脚本必须且只能调用一次 `proposeRepair`，没有修复返回 null；有修复返回 `{selector, value}`。selector 必须等于规则字段；MXU 允许定位当前 autoStartInstanceId 的 tasks，Host 独立复核实例归属。输出最多 1 MiB，执行最多 2 秒/100 万语句/32 MiB。越界字段、多次输出、缺输出和脚本错误拒绝应用。

## 规则及默认策略

`taskProtocol 0.2.0` 最多声明 8 条 repairRules，关联已声明的 configRules。资源为 `config:$main`、主快照内相对 `config:<文件>` 或 `extra:0`；`{instance}` 仅展开已验证稳定实例 ID。preconditions 约束快照种类、独占资源和附加配置条件，skipWhen 为单字段布尔条件。

| kind | editor 策略 |
|---|---|
| replace_enum | 仅 fromValues 列表内的字符串替换为 toValue |
| normalize_enum | fromValues 为保留动作，其他字符串改 toValue |
| bind_game_path | PC 模式按 Host 游戏路径修复；不改启动参数和独立启动器字段 |
| enable_boolean | 缺失或 false 改 true；已开启和非布尔异常值不改 |
| mxu_preactions | 当前自动执行实例建立或修正首项前置程序，使用绑定游戏路径，保留参数与后续程序 |
| mxu_tasks | 当前实例关闭电源任务及其控制器缓存，保留其他原生任务 |
| mfa_tasks | 选定实例关闭 ComputerOperationAction，保留其他原生任务 |

MXU 启动使用连接窗口前的前置程序；MFA 使用实例 SoftwarePath/BeforeTask 启动设置，修复为启动软件并运行脚本。共享字段只建立当前实例覆盖。MFA 编辑准备设置一次性 NoAutoStart，提交阶段清除；实例启动配置保留，取消和恢复使用原字节。提交源码使用同名 .commit.js，由生成器合成；未提供提交代码的编辑器该阶段为空操作。BAAH 日志开关位于附加软件配置 SAVE_LOG_TO_FILE，应用后下次配置交换使用该快照。

0.2.0 插件未提供 editor 时没有可用修复；不根据插件名称或旧字段猜测修复动作。

## 事务与账号保护

修复默认关闭。仅对当前用户已保存的快照逐项预览确认，不直接写上游安装目录。令牌绑定账号、脚本、插件版本、editor 内容、规则、Host 路径和参数、配置元数据代次以及主/附加快照全部字节。应用在租约内重读，并在 journal 提交前再次 CAS；冲突不覆盖。

原字节、元数据与摘要存于当前用户 repair-backups。主/附加配置复用各自现役事务，失败保留现场。修复成功刷新计划并预览下一项，不自动应用其他项。原配额、进度和其他账号保持不变。

## 生成与验证

唯一源为 `adapters/config-editor/repair.js` 及三个准备模块：BetterGI 选择一条龙配置；ZZZ 只保留当前实例并设置 CURRENT；MFA 设置一次性 NoAutoStart，防止编辑时执行。其余专项编辑准备无额外调整。账号文件隔离、交换、快照及恢复由 Host 负责，不生成第二套事务实现。

```text
python tools/repo.py generate editors
python tools/repo.py generate editors --check
node tests/config-editors/run.mjs
dotnet <隔离Host工具DLL> --plugin-root <Plugins> --config-repair <新报告.json>
dotnet <隔离Host工具DLL> --plugin-root <Plugins> --account-isolation <新报告.json>
```

生成器按实际 manifest 输出八个 editor，`--check` 不修改字节或时间戳。source gate 检查生成一致性。Host Jint 探针运行真实编辑脚本，验证全部规则、幂等、无关字段、MAA 当前实例以及 BAAH 开关类型边界。编辑准备脚本的 Node 行为验证与账号隔离探针各自证明其有限范围，不代替真实游戏运行。
