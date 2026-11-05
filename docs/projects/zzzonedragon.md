# ZenlessZoneZeroOneDragon

插件 `zzzonedragon` 0.5.0 对应官方稳定 v2.5.6，完整源码 `8fe22ef0cf127f596ba6b28047416fb68dacc797`。release/tag/tree 与官方资产摘要见 [upstream.json](../../plugins/specialized/zzzonedragon/upstream.json)。来源完整性不代表发行二进制业务通过。

## 四阶段、实例与配置

手写输入顺序为 `adapter/sources.json`。任务适配四阶段只解释冻结资源并返回提案、任务、观察和失败子集。独立的来源发现入口通过 Host 有界只读回调列出明确的两位实例，不具备文件写入、进程或网络权限。

绑定根为 config/<两位实例>/。现代 `group:01` 对应 one_dragon/_group.yml；缺少现代文件时 `legacy:01` 对应 one_dragon_app.yml，只读按原生迁移投影 app_order/app_run_list。`account:01` 对应 game_account.yml，`charge:01` 对应 one_dragon/charge_plan.yml；`global` 对应根 one_dragon.yml。现代优先，不把全局文件当任务列表，不从当前 GUI 页签猜账号。所有 YAML 由 Host ConfigurationDocument 提供与原 SHA/revision 绑定的 resource.value；raw YAML 缺少语义值时明确拒绝。

保存的应用身份和顺序固定，重复 app_id 沿原支持边界拒绝歧义并保留原字节。未知项保持可见只读；未知启用项阻断。19 个默认注册项缺失时，原生运行态将它们按 priority 前置为 disabled，不虚构保存任务和可写选择字段。现代已注册非默认且 disabled 的保存项被原生 manager 移出运行池，发现仍保留原行；启用的已知非默认项按原保存位置运行。

Host 启动 owner 必须传单一两位实例 -i，拒绝逗号多实例，并将编辑工作副本限制为仅运行当前。配置 CAS 只提案已有 instance_run/after_done 字段，不删除其他账号实例、改认证会话或清空未知设置。配置隔离不能证明游戏已登录所选账号。

## 全部已知应用

| app_id | 名称 | 默认组 | 角色 |
| --- | --- | --- | --- |
| redemption_code | 兑换码 | 是 | business |
| email | 邮件 | 是 | business |
| daily_signin | 每日签到 | 是 | business |
| random_play | 录像店营业 | 是 | business |
| coffee | 咖啡店 | 是 | business |
| charge_plan | 体力刷本 | 是 | business |
| engagement_reward | 活跃度奖励 | 是 | business |
| city_fund | 丽都城募 | 是 | business |
| ridu_weekly | 丽都周纪 (领奖励) | 是 | business |
| notorious_hunt | 恶名狩猎 | 是 | business |
| lost_void | 迷失之地 | 是 | business |
| withered_domain | 枯萎之都 | 是 | business |
| shiyu_defense | 式舆防卫战 | 是 | business |
| intel_board | 情报板 | 是 | business |
| suibian_temple | 随便观 | 是 | business |
| world_patrol | 锄大地 | 是 | business |
| life_on_line | 真·拿命验收 | 是 | business |
| drive_disc_dismantle | 驱动盘拆解 | 是 | business |
| notify | 通知 | 是 | technical |
| scratch_card | 刮刮卡 | 否；须现代组显式启用 | business |
| trigrams_collection | 卦象集录 | 否；须现代组显式启用 | business |
| hou_hou_bakery | 吼吼饼铺 | 否；须现代组显式启用 | business |
| auto_battle | 自动战斗 | 否；须现代组显式启用 | technical |
| commission_assistant | 委托助手 | 否；须现代组显式启用 | business |
| dodge_assistant | 闪避助手 | 否；须现代组显式启用 | technical |
| mouse_sensitivity_checker | 鼠标灵敏度检测 | 否；须现代组显式启用 | technical |
| one_dragon | 一条龙 | 否；须现代组显式启用 | technical |
| operation_debug | 指令调试 | 否；须现代组显式启用 | technical |
| predefined_team_checker | 预备编队角色识别 | 否；须现代组显式启用 | technical |
| screenshot_helper | 闪避截图 | 否；须现代组显式启用 | technical |

charge_plan 另派生一个“副本挑战与电池合成”业务子项，继承父选择，不伪造独立开关。技术/通知/手工辅助的登记不授权 Host 额外启动入口。组内显式启用 one_dragon 自身会递归运行同一组，且终态名与根冲突，因此保留识别但明确阻断自动运行/重试。

## 外层日志协议

只接收 `file:0` 主日志，严格核对当前 log_utils 的 ASCII 时间、operation.py 文件名、原始 INFO/ERROR 级别及原始中文指令语法。裸消息、全角标点、引用文字、其他源文件和未经核实的语言名称不作为生产别名。

获取应用组配置打开游标；先消费真实新增 disabled 项，再依冻结保存顺序匹配每个应用。应用首个“检测游戏窗口”建立外层候选，终态仅暂存，直到组“执行应用→下一个”确认 app.execute 已返回才提交。嵌套同名指令先结束不能提前完成；不匹配的禁用/已完成名称和组次序会放弃范围。当前组“应用已完成”表示 satisfied，不读历史记录补日志。

应用组结束后根还可能切换实例；只有根“一条龙”终态和最终日志排空才可完成成功资格。根失败、日志缺口、轮转、跨 source/epoch、缺少外层首节点/终态/组回执保持 unknown；已经明确失败或 partial 的结果保留。单实例与真实 writer 归属仍由 Host 启动/证据 owner 资格验证。

## 体力计划的全部类别

当前源码支持区域巡防、实战模拟室、专业挑战室、恶名狩猎，以及新增合成电池。前四项按“识别副本分类→具体子调用检测窗口→子终态→父分类节点回执→挑战完成”配对；电池按“传送返回合成电池→兑换以太电池子调用→合成电池父回执→挑战完成”配对。

Operation.execute 内异常会原生重试；事件保留调用序号、目标名、epoch/sequence 和父范围。只有同一调用成功、相同返回状态的父回执以及计划推进，才能 recovered。明确子失败经挑战完成被上游标记 skipped 后仍是 failed；其他计划成功、同名后续计划、父总成功和历史计数均不能消除。缺分类、缺子开始、缺父回执或缺推进时按缺失业务证据失败。父正式成功而子失败为 partial，禁止重试整个父子范围。

电量不足、周期挑战仍有次数而跳过深度追猎、特训目标达成的已核实正常分支，经相同子调用和父跳过回执配对后为 satisfied；未进入任何副本/合成调用为 inapplicable，不宣称实际挑战或合成发生。事件留在有界当前 attempt checkpoint；公共任务结果展示最终业务状态；内部 open/recovered 事件仅保存在 checkpoint，不提供独立事件时间线。

## CAS 与有限重试

现代 app_list 按 app_id 的 enabled 和原字节顺序置换可返回 CAS；未知行和字段必须保留。仅当前 account 的 game_path 可改。after_done 只允许无/关闭游戏，其余动作提案改无；instance_run 仅可改仅运行当前。其他账号、原生 run record、plan_id、run_times、日期、额度、循环和体力计划参数保持原样；原生 GUI 负责完整计划编辑，适配器不重建进度。

返回严格限于现代、启用、选中、已知且明确失败的安全业务 ID，保持组顺序；charge 的派生子项不独立重试，partial 家族不重放消费。旧格式只读发现，启动迁移后需 Host 重新确认冻结计划和行为；不借旧列表伪造可写选择。
`nativeResumeScope` 绑定整个原启用范围，包含已启用通知和体力子项。重试保持原应用组入口与配置，由上游当前 run record 跳过已完成项并重新建立游戏会话。任何 partial、未知启用项或未确认安全的交互技术步骤都会阻止整入口重放。

## 验证状态

254 个源派生合成案例通过 Node VM 和生产 BoundedTaskScript/Jint 组件，覆盖 30 应用身份、默认/非默认运行池、五类体力调用、同名嵌套、正常跳过、恢复/放弃/缺回执、partial 禁止重试、CAS 与原始 YAML 语义入口。

原插件 ZIP 已通过受控 Host 的原入口续跑，验证旧进程族停止、配置和进度保留、已完成跳过、通知仍在原范围以及最终恢复。实际上游发行迁移、账号游戏会话和 UI 仍 NOT_RUN。未启动真实上游游戏/脚本或修改 D:\Scripts。
