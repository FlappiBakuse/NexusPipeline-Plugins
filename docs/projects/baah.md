# BAAH 0.5.0

上游只支持锁定的官方稳定发行 BAAH2.5.1，来源与完整 SHA/tree 见 [upstream.json](../../plugins/specialized/baah/upstream.json)。上游源码仅作实现依据，不作为构建或测试输入。四阶段入口、按序手写源清单与权限见 `plugins/specialized/baah`。

## 身份、配置与恢复

Host 明确绑定选中用户 `BAAH_CONFIGS/<用户>.json` 为 main，附加软件设置为 software-config。不同用户的快照不能合并；复制配置不等于游戏内账号已切换。TASK_ORDER_GROUP.ACTIVATE_IND 选择活动 pipeline，任务身份为 `baah:<pipeline>/<序位>/<名称>`，TASK_ONOFF 的完整平行数组与原 TASK_PIPELINE 一起冻结。自动登录和收尾分别为 automatic-login、automatic-cleanup，不使用业务数组位置，不进入业务分母。

目录发现以明确配置文件名作为启动参数；单候选可直接选定，多候选由用户选择。已存在的 `DATA/USER_STORAGE/STORAGE<文件名 UTF-8 SHA1 前八位>.json` 作为 progress 资源单独保存和恢复；不把其他用户的存储或持久历史当作本轮任务结果，也不向 progress 提议配置修复。

Task.run 的前置→执行→后置→结束按栈归属。类名相同也必须按已确认活动 pipeline 顺序定位；没有激活身份、跨日志缺口或冲突顺序时不凭唯一 class 猜测成功。嵌套 CloseInform 在登录下无弹窗可正常跳过，其余前后置失败保留。文件信封来自锁定 MyLogger；stdout、另一文件流、旧版本文字和正文引用不替代主 file:0。

checkpoint 仅沿本轮 run/attempt/plan 传递，最多 64 KiB。ERROR、价格不可读、无购买按钮、入口失败和前后置失败保持失败；返回主页和所有任务结束不补终态。明确 pipeline 重启及新完整执行可恢复此前失败，历史 incident 保留。原生 CURRENT_PERIOD_TASK_INDEX 是 sessiondict 进度，只读取日志，不写持久文件清零。

正常无红点记 succeeded+satisfied；价格超限或明确日期/活动条件跳过记 succeeded+inapplicable，不宣称发生购买或领奖。明确错误自动关闭后的后续范围记 unknown+notExecuted。其他缺终态保持 unknown。

## 逐业务来源

下列路径相对于锁定源码，任务名称与 class 映射均来自 `modules/AllTask/myAllTask.py`；共同闭环来自 `modules/AllTask/Task.py`。

| 原任务范围 | 当前 class | 项目特定解释 |
|---|---|---|
| 登录游戏 | EnterGame | 技术启动；登录内 CloseInform 无弹窗不算业务失败 |
| 清momotalk | InMomotalk | 无红点 satisfied；无法进入弹窗失败 |
| 活动一览 | InEventRecap | 入口或剧情子流程明确失败不被外层结束覆盖 |
| 长期签到 | Attendance | 出席簿入口失败保留 |
| 咖啡馆 | InCafe | 独立序位；邀请、摸头、收取开关保留 |
| 咖啡馆只摸头 | InCafe | 与咖啡馆独立身份，不按 class 合并 |
| 课程表 | InTimeTable | 前后置完整闭环；课程参数保留 |
| 社团 | InClub | 外层闭环 |
| 制造 | InCraft | 制造次数与快速制造选择保留 |
| 商店 | InShop | 采购选择、金额与刷新次数保留 |
| 每日免费奖励 | InFreeAward | 明确领取失败保留 |
| 购买AP | BuyAP | 无按钮/价格不可读失败，超上限 inapplicable；不提高限价 |
| 悬赏通缉 | InWanted | 页面打不开失败，空轮次 inapplicable |
| 特殊任务 | InSpecial | 入口失败、空轮次与活动条件分别解释 |
| 学园交流会 | InExchange | 入口失败、空轮次与活动条件分别解释 |
| 战术大赛 | InContest | 保留上游最后一个大赛范围才收奖励的选择语义 |
| 战术测试 | InExam | 外层闭环 |
| 总力战 | AutoAssault | 外层闭环 |
| 大决战 | AutoGrandAssault | 外层闭环 |
| 活动关卡 | InEvent | 保留最后一个活动范围才抽奖的上游参数 |
| 推活动关卡剧情和推图 | InEvent | 独立序位及强制推图/剧情、不扫荡等原参数 |
| 每日任务 | CollectDailyRewards | 外层领取流程，不用历史记录补本轮成功 |
| 邮件 | CollectMails | 外层领取流程 |
| 一键扫荡 | InQuest | 原 one-click 参数保留 |
| 普通关卡 | InQuest | 原 normal 参数保留 |
| 普通推图 | InQuest | 原 push-normal 参数保留 |
| 困难关卡 | InQuest | 原 hard 参数保留 |
| 困难推图 | InQuest | 原 push-hard 参数保留 |
| 主线剧情 | AutoStory | 原 main-first 范围；不猜内部节点 |
| 主线剧情第二部 | AutoStory | 原 main-second 范围；独立身份 |
| 短篇剧情 | AutoStory | 原 short 范围 |
| 支线剧情 | AutoStory | 原 side 范围 |
| 挑战任务 | SolveChallenge | 已注册外层流程；不替代手工内部核验 |
| 自定义任务 | UserTask | 仅判断外层闭环，未知外部副作用不自动重放 |

## CAS 配置与有限重试

文件日志 SAVE_LOG_TO_FILE 必须为 boolean true；false 可返回绑定修订与摘要的 true 提案，错误类型不自动转换，缺少软件资源阻断。主用户配置提供 TARGET_EMULATOR_PATH/IP/PORT，software-config 不冒充用户网络配置。缺省端点由上游使用 127.0.0.1:5555，显式坏类型需诊断；直接 ADB 序列号不能证明与绑定网络端点一致。

POST_COMMAND 非空只提议清空；关闭游戏/模拟器/BAAH 的原标志保留。配置意图先完整核对 expected、资源摘要、修订、operation 和 selector，不允许重叠写入、未知字段或任意 sessiondict 写入。选择数组修改只操作明确活动 pipeline；未知名称开关不擅自更改。上游价格、次数、消费额度、日期、其他用户与账号信息不由重试清零。

retry 输出已选、启用、明确失败的业务任务 ID，自定义任务不自动重放。Host 按冻结依赖补入自动登录和此前启用的显式登录，不因上一轮登录成功而跳过新进程所需的登录。业务与显式登录投影到受完整流水线保护的 TASK_ONOFF，自动登录单独映射 OPEN_GAME_APP_TASK；未启用的登录保持禁用。DO_POST_ALL_TASK 保持原值，PostAllTask 的按日资源记录具有上游持久去重，不进入业务失败集合。writer 停止、恢复、预算与持久授权仍由 Host 实施；适配器不直接执行或修改文件。

## 资格

专属 source-derived 用例位于 `tests/specialized/baah/cases.mjs`，可由公共专项组件 runner 装配；同一组输入和期望复用生产 Host BoundedTaskScript/Jint 探针，不复制另一套解释器。34 个任务分别覆盖发现、中英文闭环、前后置失败、缺终态和失败子集；另有同 class 独立身份、条件跳过、资源绑定、日志来源/轮换/重复及原生重启反例。

实际 BAAH 文件日志不含 PID，GUI 下 worker 不能由根进程 PID 代验。原始 ZIP 已通过实际 TaskAdapterExecutor 四阶段校验，并在安装 Host 中完成受控脚本及子进程强制关闭后的两次持久调用；自动/显式登录、安全收尾、成功业务保留、主/附加配置接续、现场原字节恢复和接续证据篡改拒绝分别核验。受控进程输出上游格式的合成日志，不代表运行了真实 BAAH。GUI worker 归属、配置 UI 与真实发行隔离配置消费/受控失败/取消恢复仍单列 NOT_RUN。
