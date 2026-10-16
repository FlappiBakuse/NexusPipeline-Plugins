# OkNTE 项目适配

公共规则见 [ok-script](../frameworks/ok-script.md)；源码身份见 [source-lock](../../adapters/task-protocol/source-lock.json)。本页不将引擎完成或进程退出推断为业务成功。

当前 0.3.0 按结构兼容与实际执行归属准入，新版本保持真实日常任务。冻结后的结构变化、活跃 worker/updater 或不可读身份阻断。

| 插件 | 发现身份与选择 | 当前日志事实 | 自动重试边界 |
|---|---|---|---|
| OkNTE | DailyRoutineTask 的 Routine Items，按上游顺序去重、补默认和处理互斥；子配置只取 DailyRoutineTaskConfigs | 日常范围内开始/完成/失败配对；语言不支持跳过；异常归当前项及后续 blocked | 所有日常失败参与有限重试；完整显式选择列表可选择重试，否则耦合日常范围，不写进度 |

## 上游核对记录与兼容窗口

核对日期：2026-10-14（Asia/Shanghai）。插件当前版本以[源码 manifest](../../plugins/specialized/OkNTE/plugin.json)为准；协议 `0.3.0`，最低 Host `0.17.4`。插件版本与下表上游版本独立。

| 核对时最新及前两次稳定发行 | 源码 SHA |
| --- | --- |
| [v1.4.13](https://github.com/BnanZ0/ok-nte/releases/tag/v1.4.13) | `3958f471702f504fe36cfb4f8b9e564bdf734bf0` |
| [v1.4.12](https://github.com/BnanZ0/ok-nte/releases/tag/v1.4.12) | `23df0cb47f92ea4da79c19b42970fb120ee1cf13` |
| [v1.4.11](https://github.com/BnanZ0/ok-nte/releases/tag/v1.4.11) | `87640281bd91809f740bbdb917e34b8834cadc66` |

资产 URL、大小和发布方摘要见 [上游窗口](../../adapters/task-protocol/upstream-window.json)。

任务表遵循 [共同识别口径](README.md#识别兼容口径)。

## 全部已知任务与识别边界

| Routine Item ID | 任务 | 默认选择 | 识别 / 选择兼容 |
|---|---|---|---|
| daily_anomaly | 异象界域 | 开 | 同组互斥，按原生顺序选首项；DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| daily_anomaly_hunter | 异象追猎 | 关 | 同组互斥，按原生顺序选首项；DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| coffee | 一咖舍 | 关 | DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| daily_claim | 日常领取 | 开 | DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| cinema_date | 影院约会 | 关 | DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| fountain | 喷泉签到 | 关 | DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| furniture | 异象家具 | 关 | DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |
| gift | 羁遇赠礼 | 关 | DailyRoutineTask 当前项开始/完成/失败配对；语言不支持可跳过 |

异常中止时当前任务失败、已确认未执行的后续项 blocked。完整且唯一的显式 enabled 列表支持选择补丁；缺省补项等不能安全单独选择时耦合日常范围。独立框架任务类或一次性脚本不是 Routine Items，不把不认识的类自动纳入/删除。安装结构兼容、官方渠道和 worker/updater 状态共同准入，旧版本号和旧源码 hash 不作为拒绝新发行的理由。[生产模块](../../adapters/task-protocol/oknte)。

## 启动与日志配置门禁

插件声明 `self-managed-pc-launch`。PC 游戏启动交给 OkNTE 的启动器链路，Host 编辑器禁用直接启动选项，运行入口即使读到旧的 launchGame=true 也不会启动 PC 游戏。游戏路径仍用于目标归属与关闭，不因此授权直接启动。

## 配置修复

- 游戏路径：`devices.json/pc_full_path`；不覆盖独立的 Launcher Path。
- 完成动作：无可修复的有限完成动作字段；保留框架退出参数。
- 启动任务：非 MAA，无插入任务；仍由脚本负责启动器。

修复事务及账号保护见[配置编辑](../author/config-editor.md)，跨项目字段索引见[覆盖表](../frameworks/completion-actions.md)。

公共识别、重试及证据边界见[任务协议](../author/task-protocol.md)；本页只定义项目特有规则。
