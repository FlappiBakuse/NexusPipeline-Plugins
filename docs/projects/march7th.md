# March7thAssistant

插件 `march7th` 0.5.0 对应稳定发行 v2026.10.16，完整源码 `34c6e4aba914bb8c0cbe1a27e49151cce26f94b4`。来源、tag、tree 与官方资产摘要见 [upstream.json](../../plugins/specialized/march7th/upstream.json)。归档核验不代表二进制业务实测。

手写模块顺序见 `adapter/sources.json`。任务适配四阶段只消费冻结资源，返回任务发现、观察、失败子集及 CAS 提案。独立的来源发现入口通过 Host 有界只读回调列出启动器、worker 和配置，不具备文件写入、网络或进程权限。

## 配置和启动范围

`main` 对应 config.yaml；由 Host 的 ConfigurationDocument 原语法 owner 提供 `resource.value` JSON 语义值，资源 revision/SHA 仍绑定原 YAML 字节，提案仍由 YAML span owner 原位应用。无 value 的真实 YAML 明确拒绝；JSON 语义 fixture 只验证算法，不证明 YAML 绑定集成。

支持固定默认 main：game.start → Daily.start → reward.start → game.stop。routine 只执行 prepare_daily(ignore_refresh=True) 和 reward，与 main 不等价；不把自定义 workflow、循环、中途接管或其他命令行入口伪装成相同范围。部署启动 owner 必须绑定这一入口。

按已核实上游默认值发现 13 个一级入口和 19 个子开关。父禁用只抑制子任务选择，不清除子项原值。已知辅助及历史开关原样保留；未知启用项保留只读并阻断配置检查。
主文件中实际存在的已知布尔开关携带任务投影，固定原资源 ID、相对文件和字段选择器；缺省推导值不伪造写入目标。观察和重试核对该冻结映射，不自动增加前提授权。

## 全部任务

| 配置键 | 任务 | 父门禁 | 角色 |
| --- | --- | --- | --- |
| daily_enable | 每日实训 | — | business |
| power_enable | 清体力 | — | business |
| universe_enable | 模拟宇宙/差分宇宙 | — | business |
| weekly_divergent_enable | 差分宇宙积分奖励 | — | business |
| currencywars_enable | 货币战争积分奖励 | — | business |
| fight_enable | 锄大地 | — | business |
| forgottenhall_enable | 忘却之庭 | — | business |
| purefiction_enable | 虚构叙事 | — | business |
| apocalyptic_enable | 末日幻影 | — | business |
| asset_manager_enable | 资产管理 | — | business |
| reward_enable | 领取奖励 | — | business |
| activity_enable | 活动 | — | business |
| build_target_enable | 培养目标 | — | technical |
| echo_of_war_enable | 历战余响 | power_enable | business |
| reward_assist_enable | 支援奖励 | reward_enable | business |
| reward_mail_enable | 邮件奖励 | reward_enable | business |
| reward_dispatch_enable | 委托奖励 | reward_enable | business |
| reward_quest_enable | 实训奖励 | reward_enable | business |
| reward_srpass_enable | 无名勋礼 | reward_enable | business |
| reward_achievement_enable | 成就奖励 | reward_enable | business |
| reward_message_enable | 短信奖励 | reward_enable | business |
| reward_redemption_code_enable | 兑换码 | reward_enable | business |
| asset_self_molding_resin_enable | 自塑尘脂合成 | asset_manager_enable | business |
| asset_lc3_star_superimpose_enable | 3星光锥叠加 | asset_manager_enable | business |
| asset_ember_special_pass_enable | 星轨专票兑换 | asset_manager_enable | business |
| asset_ember_regular_pass_enable | 星轨通票兑换 | asset_manager_enable | business |
| asset_ember_tracks_of_destiny_enable | 命运的足迹兑换 | asset_manager_enable | business |
| activity_dailycheckin_enable | 活动签到 | activity_enable | business |
| activity_gardenofplenty_enable | 花藏繁生 | activity_enable | business |
| activity_realmofthestrange_enable | 异器盈界 | activity_enable | business |
| activity_planarfissure_enable | 位面分裂 | activity_enable | business |
| activity_journey_highlights_notification_enable | 旅途拾忆通知 | activity_enable | technical |

## 业务证据

只接收声明的主文件流 `file:0`。普通消息必须有官方时间/级别前缀；hr 标题必须为无时间戳的原生 title logger 行，INFO 文本不能冒充标题。根 PID 不冒充外部 launcher/worker 的文件拥有权。stdout、其他文件流与配置诊断日志不参与业务。

范围栈区分日常查询、模块、奖励和嵌套调用；通用“完成”只结束已配对范围，不结束整轮。停止运行一级标题位于退出、暂停或循环之前，是默认 main 的运行边界；最终排空前成功保持 unknown。错误保持 failed，不因后续横幅清除。

每日实训需要本轮范围返回；历史分数与时间戳不能补闭环。模拟宇宙使用当前通知模板的字面完成/失败消息，差分宇宙使用本轮固定次数、零次/已满足以及未完成分支；周常积分缺少独立成功边界时保持 unknown。尚未刷新、历战未到执行日表示 satisfied，不宣称实际领奖/挑战发生。

奖励父项要求外层返回且所有启用必需子项有命名完成或明确无奖励。未检测到奖励和委托派遣中表示检查满足，completionKind=satisfied；包装器完成不能覆盖子项缺口。兑换码保持已用记录，无新码表示 satisfied。

资产父项按自塑尘脂、3星光锥、三类余烬商品汇总。合成失败、商品未完成保持失败；售罄表示已处理。光锥单次“继续查找”不是终态，Daily.start 返回到奖励/停止边界才关闭完整查找。活动外层正常返回关闭已启用条件检查；无活动为 inapplicable，异常保留失败。通知和培养目标是技术角色。

四种 InstanceNotCompleted 通知按当前配置模板逐字格式化 `{error}`，支持转义花括号和最多四行，绝不执行用户正则。记录 source epoch/sequence、父范围、目标和内部执行序号的有界事件；首次失败保持 open，连续 1/3、2/3、3/3 耗尽且退出才失败。只有相同目标的显式重试、完整轮次及请求单位满足才能 recovered。不同目标、缺轮次、重试编号缺口、泛用完成或历史状态均不能恢复。直接历战失败和活动异常按各自真实范围归属，不归猜给清体力。事件保存在本次 attempt checkpoint；公共任务结果展示最终业务状态；内部 open/recovered 事件仅保存在 checkpoint，不提供独立事件时间线。

## CAS 和重试

只允许当前已有任务开关、非云模式游戏路径、有限 universe_count、已知频率/类别与受限 after_finish 的显式 CAS。Loop/RunScript/关机等动作阻断并仅提案改 None；云模式不比较/改本地路径。原日期、完成次数、体力计划、已用兑换码、参数和未知字段不重置。

返回重试任务严格限于选中、启用、可投影且明确 failed 的业务叶任务，顺序固定。有选中子项的父项即使也报告 failed，也不加入失败叶集合；技术角色不会因此成为安全重试目标。奖励子项显式声明 `reward_enable` 为重试前提：上游奖励模板仍逐项检查各子开关，Host 只投影该父开关和失败子项，关闭其他任务。清体力等父项会执行独立业务，不声明为可自动重放的前提。原生默认但没有持久开关的任务保持 unknown 安全性。父 gate 的必要投影由 Host 的冻结依赖规则裁决，不能扩大适配器返回的失败集合。原配置续跑保持上游额度和进度。

## 验证状态

228 个源派生合成案例通过 Node VM 和实际生产 BoundedTaskScript/Jint 组件，覆盖全部任务、正反日志、配置 CAS、父禁用、固定次数、通知模板、同目标恢复、耗尽、迟到冲突、分批/轮转、失败叶集合、技术角色排除及冻结任务投影。

运行 `tests/specialized/verify.py --extension march7th`，显式传入当前 Host 源码、Jint/Acornima 程序集及仓外 output/work-root。runner 复用仓外编译槽，记录实际源码和程序集摘要，核对两个解释器执行相同的非空用例集合；缺少原生报告、超时或未执行均失败。

原始 0.5.0 ZIP 已通过实际 Host 安装、保存 YAML、任务发现、配置检查、真实受控 Job、失败子集持久重试和原磁盘字节恢复；独立任务及奖励子项两个场景均验证成功结果保留、父开关投影和上游计数续接，丢弃进度输入引用被拒绝。日志由受控程序按官方格式追加，不代表真实上游执行。

来源发现固定默认命令 `March7th Launcher.exe main --exit`，要求 Launcher 和 Assistant 同时存在。Host 的受控原入口验证覆盖 launcher/worker 拥有权和重试；真实发行二进制、游戏及 GUI 会话仍待人工验收。组件和受控进程通过不外推这些资格，来源固定 SHA 分析也不替代实际发行包验证。
