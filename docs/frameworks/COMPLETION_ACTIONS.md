# 完成动作与后继依赖

动作不提供业务成功证据。Host 先核对配置、任务事实、进程角色和恢复状态；未知动作显示警告。配置修复默认关闭，逐次预览并明确应用。纯游戏启动器驻留可以保留，不能据此把任务判为失败。

## 八个专项的上游定义

下表列的是锁定上游源码定义，不代表已完成真实账号验证。缺失字段只使用该项目明确的默认值；配置不可读、类型错误和未声明动作仍是未知。

| 项目 | 字段、默认值与完整动作范围 | Host 处理与执行覆盖 |
|---|---|---|
| BetterGI | `CompletionAction` 默认空字符串；空、无、关闭游戏、关闭软件、关闭游戏和软件、关机 | 空/无/关闭软件不阻断；关闭游戏的两项检查后继启动责任；关机阻断。真实 Jint 的 `sup-actions-bettergi-*` 覆盖每个枚举。 |
| March7thAssistant | `after_finish=None`；None、Exit、Loop、Shutdown、Sleep、Hibernate、Restart、Logoff、TurnOffDisplay、RunScript | None/Exit 允许；Loop 和关机/睡眠/休眠/重启/注销阻断；关闭显示器因屏幕依赖未确认而警告；RunScript 的外部副作用未知。执行参数必须与原任务选择及有限生命周期相符，不把配置里的无限循环变成有限执行。 |
| ZenlessZoneZeroOneDragon | `after_done=无`；无、关闭游戏、关机 | 无允许；关闭游戏按后继依赖检查；关机阻断。 |
| BAAH | `CLOSE_GAME_FINISH`、`CLOSE_EMULATOR_FINISH`、`CLOSE_BAAH_FINISH` 均默认 false；`POST_COMMAND` 默认空 | PC 模式忽略 CLOSE_GAME_FINISH，CLOSE_EMULATOR_FINISH 会关闭 PC 游戏；CLOSE_BAAH_FINISH 是程序退出。模拟器关闭可能影响共享实例，后继风险未证明时警告。POST_COMMAND 非空是未知外部命令。真实 Jint 覆盖 PC 三开关全部 8 种组合和同目标保持运行的阻断。 |
| MaaEnd | MXU 实例的完成动作列表；空列表不执行动作。`__MXU_POWER__` 的 operation：shutdown、restart、screenoff、sleep、mute、unmute；缺失 operation 默认 shutdown | 关机/重启/睡眠阻断；关屏因屏幕依赖未确认而警告；静音/解除静音不阻断。其他程序或 pretask 不推断成安全；使用 MXU 共同规则。 |
| MaaStellaSora | 同一 MXU 特殊任务契约，独立项目实例和选择 | 与 MaaEnd 共用框架动作处理，不共享用户配置或自动迁移到直驱。 |
| OkNTE | 项目配置没有有限完成动作枚举；官方启动器转发 `-a true -u manual -t … -e` | `-e` 控制框架收尾，不证明业务成功，不要求 PyAppify GUI 自动退出。新官方发行仅基础安全可确认时受限运行，保留未核验事实。 |
| OkWutheringWaves | 同一 ok-script 有限 CLI，项目任务索引独立 | 不套用异环任务或旧版本规则；框架/项目身份按各自锁定来源核验。 |

关闭游戏只有在后继依赖同一目标且 `nextLaunchOwner=already_running` 时明确阻断。最后一项、不同目标，或同目标由 Host/上游重新启动时可以放行。后继关系未知时警告，不把“队列还有任务”直接等同于冲突。恢复隔离由现役队列逐项准入：受阻项未执行，独立项继续；人工取消仍停止整队。

系统动作可能在 Host 恢复事务之前发生，因此以上会中断事务的上游系统动作不能仅靠“最后一项”放行。Host 自己的自动电源、退出和更新动作另受恢复门禁保护。

## 独立来源

- BetterGI：[配置默认值](https://github.com/babalae/better-genshin-impact/blob/bfe5f868ed088e67f7e73caddc0c05627dbfa935/BetterGenshinImpact/Core/Config/OneDragonFlowConfig.cs)；[枚举及执行](https://github.com/babalae/better-genshin-impact/blob/bfe5f868ed088e67f7e73caddc0c05627dbfa935/BetterGenshinImpact/ViewModel/Pages/OneDragonFlowViewModel.cs)。
- March7thAssistant：[默认配置和十项动作](https://github.com/moesnow/March7thAssistant/blob/7423dea64552f71332cc71f3c02481695aaec151/config.example.yaml)。
- ZZZ：[动作枚举和默认值](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/blob/a91a606b4726a335af1556dd47f54e9249f9ea2a/src/one_dragon/base/config/one_dragon_config.py)。
- BAAH：[默认值](https://github.com/BlueArchiveArisHelper/BAAH/blob/c008a8f3eac90acacac6da49ebb10c061f44fc24/modules/configs/defaultSettings.py)；[PC、模拟器关闭与外部命令](https://github.com/BlueArchiveArisHelper/BAAH/blob/c008a8f3eac90acacac6da49ebb10c061f44fc24/BAAH.py)。
- MXU：[v2.6.1 特殊任务定义](https://github.com/MistEO/MXU/blob/a7fdd0b32bfadc1df1bf8c6293bf2395676542b8/src/types/specialTasks.ts)。项目输入和日志归属见 [MaaEnd](../projects/MaaEnd.md)、[MaaStellaSora](../projects/MaaStellaSora.md)。
- OK：[框架锁定与 CLI 验证方法](OK_SCRIPT.md)；项目独立的 [异环配置](https://github.com/BnanZ0/ok-nte/blob/0339cfc44a9827ad8cd1ebeabe432660e87f2acb/src/config.py)和[鸣潮配置](https://github.com/ok-oldking/ok-wuthering-waves/blob/016c19e807fcc16800c42c89fdb3b01ea6947ee9/config.py)。

公共日志协议和结构化 provider 的边界见 [TASK_PROTOCOL](../TASK_PROTOCOL.md)；Maa 独立直驱的授权及原生生命周期见 [框架指南](../MAAFRAMEWORK_DRIVER.md)。
