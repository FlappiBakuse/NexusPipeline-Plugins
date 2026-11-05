# OkNTE

插件 `oknte` 0.5.0 对应官方 v1.4.21，源码 `460a7687faa7dc928f7a9c4593d7031e21df493c`。完整 release/tag/tree 与资产摘要见 [upstream.json](../../plugins/specialized/oknte/upstream.json)。requirements 固定 ok-script 2.0.17；官方 PyPI wheel SHA256 `49720827f267297620208bc5fe6981203eb6472868fe2de59d12329ed7494e44` 已核验并审阅 Logger/TaskExecutor。该事实不代表发行安装实际捆绑组合已运行。

## 四阶段与资源

手写模块由 `adapter/sources.json` 固定顺序合并。任务适配四阶段仅消费 Host 提供的冻结资源；独立来源发现入口通过 Host 有界只读回调列出当前工作配置，不具备文件写入、进程或网络权限。`main` 对应 DailyRoutineTask.json；`routine-configs` 仅对应 DailyRoutineTaskConfigs.json；`devices` 对应 devices.json。独立任务页配置不会供给日常子项，也不会被解释或改写。资源可使用 Host 绑定的 JSON 语义 value，CAS 仍绑定原 resource ID、revision、SHA 和 operation。

按上游 normalize_items 处理：保存顺序优先、已知 ID 首次出现有效、Python bool 真值规则、补缺省项、互斥组按出现顺序选首项。未知项保留只读且不选择；未知启用项阻断配置检查。完整且唯一的显式布尔列表才允许逐项选择重试。

## 全部日常任务

| ID | 名称 | 缺省选择 | 互斥组 |
| --- | --- | --- | --- |
| daily_anomaly | 异象界域 | 开 | anomaly |
| daily_anomaly_hunter | 异象追猎 | 关 | anomaly |
| coffee | 一咖舍 | 关 | — |
| daily_claim | 日常领取 | 开 | — |
| cinema_date | 影院约会 | 关 | — |
| fountain | 喷泉签到 | 关 | — |
| furniture | 异象家具 | 关 | — |
| gift | 羁遇赠礼 | 关 | — |

独立战斗、钓鱼、小游戏、触发器和 LauncherTask 不属于日常分母，不从框架任务类列表自动增加业务范围。

## 日志与正常跳过

只接收声明的主文件 `file:0`；精确按固定官方 wheel 的时间/级别/线程/Owner:message 解析，线程必须 TaskExecutor。DailyRoutineTask 的“开始执行日常任务”打开范围，逐项名称必须匹配冻结的日常顺序。成对开始和任务完成/失败是权威结果；语言不支持按 ID 关闭该项为 succeeded+inapplicable。

v1.4.21 `_run_routine_task` 将 do_run 的 None 明确映射 SKIPPED，且不写完成/失败行。在日志连续、已知日常范围内，下一项开始或日常结束之前没有终态，才按真实控制流证明该项返回 None，标 inapplicable，不能宣称实际操作完成。异常、错误顺序、缺口和轮转不能借此推断跳过。

“任务运行失败”及正式失败保持 failed，迟到正式失败不能被成功覆盖。日常异常或 TaskExecutor 的“日常任务 exception stopped”只令当前已开始项失败，后续确认未执行项保持 unknown+notExecuted。已完成项保留。报告摘要、子任务/启动器/框架完成、其他线程、stdout 和其他文件均不能建立日常结果。成功还需日常范围结束/异常退出后最终日志排空。checkpoint 只用于当前 run/attempt/plan。

## 配置和有限重试

CAS 允许完整唯一列表中按 id 的 enabled、原任务字节的顺序置换和 BOT 通知开关。切换互斥项必须显式同时关闭另一项，不暗中扩大意图。设备只允许 pc_full_path，独立 Launcher Path 不受影响。

日常专属配置支持异象任务类型/材料序号/具体奖励/循环模式及唯一循环序列、每日体力目标、追猎目标；一咖舍原生领取/补货选项、商品位、价格策略和 2/4/8/24 小时时长；邮件/活跃度/环期奖励开关、约会目标、喷泉签到/捞币与家具挑战玛门。未知字段、礼物捕获档案、原生进度、计数、日期和独立页面参数保持原样，不接受重置提案。

八个日常失败均可参与有限选择重试，返回严格限于已选、启用、safe 且 failed 的 ID，保持规范化顺序。缺少完整显式列表时安全性 unknown；原旧耦合重试需要 Host 明确耦合 owner 或 GUI 先持久化完整列表，现不扩大失败集合重放其他成功项。

## 安装及验证边界

PC 游戏仍由 OkNTE 自己的启动器链路负责。Host 必须核对实际 pyappify China/Global 渠道、可用版本、完整安装 HEAD、精确 origin、真实 worker/updater 空闲及冻结后的任务源码。持久 running 标志不能代替进程事实，也不能把根 launcher PID 当 worker。主仓源码和固定 wheel 只供业务研究，不替代实际发行 update 仓文件身份。

源派生合成案例通过 Node VM 和生产 BoundedTaskScript/Jint 组件。原插件 ZIP 已通过受控 Host 的持久选择重试：旧进程族停止后只启用失败日常项，观察器按实际子集归属日志，保留此前成功事实，并恢复原配置。原日常入口负责重新检查游戏主界面。实际上游发行安装、账号游戏会话和 UI 仍 NOT_RUN。未启动真实游戏、脚本或写 D:\Scripts 配置。
