# OkWutheringWaves

插件 `okww` 0.5.0 对应官方 v3.7.12，完整源码 `46113e464b823c95d5df988f8eba8b2dd8b45e5e`。release/tag/tree 与官方资产摘要见 [upstream.json](../../plugins/specialized/okww/upstream.json)。requirements 固定 ok-script 2.0.17，官方 PyPI wheel SHA256 `49720827f267297620208bc5fe6981203eb6472868fe2de59d12329ed7494e44` 已核验并审阅实际 Logger/TaskExecutor。归档和 wheel 源码核对不代表发行二进制通过。

## 四阶段输入

`adapter/sources.json` 固定手写模块顺序；任务适配四阶段只消费请求资源；独立来源发现入口通过 Host 有界只读回调列出当前工作配置，不具备文件写入、进程或网络权限。`main` 对应 DailyTask.json，`farm-4c` 对应 FarmEchoTask.json，`nightmare` 对应 NightmareNestTask.json，`devices` 对应 devices.json。已绑定的 resource.value 可优先供语义读取，CAS 仍绑定原字节 SHA/revision/operation。其他独立任务页面不改变日常范围。

## 全部日常范围

| ID | 选择条件与职责 |
| --- | --- |
| daily | 唯一权威 DailyTask 父项，无独立开关 |
| nightmare | all Nightmare 附加项，或 echo 开且体力分支非 Tacet；两种条件共用一项 |
| stamina | Tacet Suppression、Forgery Challenge、Simulation Challenge 三分支之一 |
| daily_reward | 内置日常奖励范围 |
| mail | 内置邮件流程 |
| battle_pass | 内置通行证流程 |
| garden | Check Weekly Garden |
| merge | Merge Echo If discarded > 1000 |
| farm_4c | Teleport and Farm 4C Echo |
| extra:<index>:<value> | 未知附加项保留、阻断，不隐藏 |

梦魇实际先于体力。隐含步骤不伪造独立启停字段，也不把手动入口 FarmEchoTask 当作额外日常分母。4C 必须使用正有限次数，专项范围仅支持 Weekly Challenge、Boss Challenge，分别验证对应 9/20 个目标索引。上游 Special Nightmare 和其他未支持模式保留原配置；4C 启用时阻断执行，不自动转换。all Nightmare 要求非空、已知 Which to Farm。

## 业务观察

仅接受 `file:0`、固定 wheel 的时间/级别/线程/Owner:message 信封及 TaskExecutor 线程。DailyTask 的 open_daily 与 Daily Task Completed 配对建立权威父范围；LauncherTask、其他 TaskExecutor 任务、摘要、进程退出、stdout 和其他文件流不能代替。

权威正常返回证明各隐含调用的范围返回，不单独证明每次鼠标点击已实际取得物品。条件梦魇未调用可记 inapplicable；体力条件正常检查但缺少独立执行痕迹为 satisfied；每周花园明确已完成或目标已到上限为 satisfied。最终日志排空前成功保持 unknown。

Nightmare/Garden/Merge 的捕获异常以及通行证未找到均独立保留 failed。当前源码中梦魇不可达或三次死亡跳过、Tacet/Domain 与 4C 恢复耗尽后返回、Merge 打不开背包而不抛异常，也保留未满足的子项失败。Merge 的完整批次完成、花园明确达到上限使用各自真实 Owner 结果。迟到错误和后续总完成不能清除失败。

权威父成功而子项失败时父为 partial，整个父子范围禁止重试。异常终止只把确切的“📅 Daily Task exception stopped”归到日常父失败；不从其他 worker 名称猜归属。缺口、轮转或未配对范围保持 unknown，checkpoint 只绑定当前 run/attempt/plan。

## CAS 与重试

主配置支持三种体力类型、当前关卡索引/材料、echo 条件和已知附加项组合；未知附加项不能借数组替换移除。4C 支持当前传送/目标/等级/拾取/技能与有限次数、等待设置；Nightmare 支持两种已知资源类型；devices 仅允许 pc_full_path。字段必须已经存在，expected 与 SHA/revision 必须一致，未知键、原生计数、日期、体力预算和退出参数保留。

只在权威 daily 明确 failed、配置可确认、未启用 4C 且没有 partial 结果时，返回 `okww:daily`。`nativeResumeScope` 冻结整个已启用任务范围，Host 沿用原入口、配置和进度，并消费同一有限重试预算。原入口重新检查登录与当前日常进度。4C 次数是每次入口的局部计数，即使配置有限也无法证明剩余量，故不自动重放。子项没有独立开关；父成功子失败、单独子失败或范围 unknown 均不重放资源消费。

## 安装与验证状态

Host 必须核对实际 pyappify China/Global 渠道、安装可用版本、完整 HEAD、精确 origin、真实 worker/updater 空闲以及冻结后的实际 update 仓任务内容。当前 China 源为 cnb.cool/ok-oldking/ok-ww-update2.git，Global 为 GitHub ok-oldking/ok-ww-update.git；不扩展为域名通配，不用持久 running 标志代替进程事实。根 launcher PID 不冒充真实日志 worker。

260 个源派生合成案例通过 Node VM 与生产 BoundedTaskScript/Jint 组件。原插件 ZIP 已通过受控 Host 的原入口续跑，验证旧进程族停止、完整选择范围、原配置和进度保留、最终恢复。实际上游发行安装、游戏会话和 UI 仍 NOT_RUN；受控输出不替代这些资格。未启动真实游戏/脚本或修改 D:\Scripts。
