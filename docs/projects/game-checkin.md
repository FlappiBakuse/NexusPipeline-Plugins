# GameCheckIn 0.5.0

目标 Host 0.18.0 / SDK 0.1.0。插件维护平台任务、请求协议、角色与响应策略、内存凭据编辑；Host 维护调度 occurrence/run/attempt、持久副作用去重、秘密原子发布和原生客户端身份。

| 平台 | 游戏代码 | 范围 |
| --- | --- | --- |
| 米游社 cn | gi / hsr / zzz / bh3 | 原神、星铁、绝区零、崩坏3 国服 |
| HoYoLAB os | gi / hsr / zzz / bh3 | 对应四款国际服 |
| 森空岛 skland | ak / endfield | 明日方舟、终末地 |
| SKPORT skport | endfield | 终末地国际服 |
| 库街区 kuro | ww / pgr | 鸣潮、战双 |
| 塔吉多 tajiduo | nte | 异环 |

纯业务组件已实现 14 组合校验、多任务、每任务 30 个星期/本地时间计划、顺序编辑与删除投影，最终配置派生日程总数不得超过 4096。任务名称去除首尾空白后按不区分大小写保持唯一。每个计划使用业务 taskId 与 scheduleId 派生的确定性 UUID，保留私有任务 revision 并可反查原任务；无计划任务不伪造启用的计划。Host 即时执行使用原业务 taskId。运行结果独立于任务配置，避免结果刷新改变已冻结的私有配置修订。

凭据草稿仅驻留内存，使用宿主签发的 ClientId、ClientLifetime 与本次 activation 绑定。候选匹配 editor、平台、nonce 与 fieldGeneration；取消后拒绝迟到候选，客户端退役立即清除候选内存。保存预留明确 keep/set/clear，检查秘密基线 revision；预留失败释放新值，提交成功关闭草稿。显示凭据须当前客户端确认，手改值清除网页辅助认证上下文。编辑器及候选空闲 30 分钟、最长两小时；显示确认最长 24 小时，重复确认不延长已有有效期，不跨 Host 重启或客户端共享。

森空岛会话设备 ID、库街区 distinct_id 与秘密值一起编码给加密 owner；普通状态不返回这些字段。敏感材料、捕获与秘密变更禁止普通 JSON 序列化，释放时清除自有字符缓冲。候选还须经过固定官方当前账号响应核验，不能仅靠捕获到 Cookie 保存。

`LoginPolicies.cs` 提供固定起始页、允许 origin、popup、cookie domain/path/name、localStorage 与只读 JSON 捕获规则。五个平台沿原生 WebView 桥；塔吉多使用短信/密码与原生 JSON。浏览器/远程仅手填。HoYoLAB 当前账号验证使用无 uid 参数的固定当前用户接口，要求响应 UID 与 Cookie UID 一致；空角色列表不影响已认证身份。公共用户资料查询不能作为登录有效证明。

`SignInPolicy` 将“明确未签”“提交未知”“已确认”分开：只有新的 Host effect 且明确未签才请求宿主提交许可；未知提交只能只读核对，Busy 不发任何平台 HTTP。多角色任一失败或未知不能变为整游戏成功。塔吉多仅在新活动 claim 后刷新凭据，可靠原子保存后再查角色与今日状态；未知活动只用已有 access token 读取角色与状态，不刷新。刷新取消或保存结果未知时停止并保留 unknown，多角色不猜选；提交后正向复核才确认成功。没有社区币、分享、云游戏或付费补签策略。

正式 WorkEffects 适配只转发 Host 签发的 activity/role lease，核对当前真实 business task owner，拒绝外来 ID、状态篡改或将活动当角色提交。Host 从实际秘密版本调用纯身份投影：Cookie 的固定完整认证对按固定次序编码，token 保持原始大小写；辅助网页设备与来源不参与 family。塔吉多只投影 SDK token/UID，轮换必须保持 format、source、mask、web 及 uid/device/role/SDK 认证对不变，仅允许合法 access/refresh 变化。原子轮换失败后不通过提交查询恢复 HTTP 权限。

任务编辑调用正式 SDK SecretDocuments，将普通任务 JSON 和六平台秘密变更发布为一个事实。删除仅清除该业务任务的六个字段，排序没有秘密变更。丢失响应仅查询原 operationId，核对原文档摘要与提交 revision；无法确认时保留草稿并返回未知，不生成新写入重试。未知文档或秘密格式保留原字节，不能把读取失败当成空值。CN/Kuro 请求设备标识由新任务编辑器生成，成功保存后保持稳定，不进入前端任务 DTO。

塔吉多现役官方 1.2.7 APK 的静态调用使用 loginV2/refreshTokenV2、AuthorizationV2 和 SDK token/UID。原生 JSON 可包含 sdkToken/sdkUid，并与 accessToken、refreshToken、uid、deviceId、可选 roleId 一同加密保存。缺 SDK 字段的旧 JSON 可保留，但运行明确拒绝，不能退回旧路由。原生认证密码/验证码仅在本次请求中使用；登录会话最多 15 分钟，同客户端跨窗口共享 60 秒验证码冷却。森空岛手填 APP token 使用官方 Shumei 协议兼容画像生成会话设备 ID；网页捕获的真实会话 dId 优先并随秘密保存，不把兼容画像当成本机硬件检测。

当前验证为 `tests/game-checkin/verify.py` 的 243/243 纯源码组件与模拟网络案例，以及 95/95 正式 SDK DTO/原子适配与 handler 组件。包括任务/计划、风险正反例、角色、捕获候选的跨域半对/账号冲突/完整版本优先/设备 JSON 正反例、编辑取消/代次/过期/客户端隔离、显示确认、未知提交、HTTP origin/MIME/大小/重复字段、身份投影/轮换、Host 运行历史，以及 Shumei RSA/AES/Gzip/DES 编码逆解。正式前端适配声明 18 个操作，Read 不携带操作 ID，Write/RevealSecret/Desktop 必须携带；状态读取等待同一初始化任务，不将失败文档当成空状态。scope 组合在 WaitReady 后初始化，抑制原调用的 AsyncLocal 流，停止时清除草稿并排空初始化。生产 createFrontend、正式 SDK 与 P2 控件的实际 Edge 受控回归 12/12，覆盖十四组合、多计划、秘密操作身份、远程秘密拒绝及明确清除后手填、原提交查询与停止。SDK 与浏览器场景使用模拟 Host ports，不能替代真实 DPAPI 或安装资格。实际平台登录、设备画像请求、签到和领奖均未执行。

登录可用性与动作授权分开：read-state 通过正式 IExtensionDesktop.ReadClientAsync 读取当前客户端的 IsBound/CanCapture，不调用需要 Desktop 执行权的 RequireClientAsync。headless 的 Desktop 端口缺失时仅显示手填，登录动作明确拒绝，不影响手填凭据与后台任务。塔吉多要求实际 native 绑定；五个平台的网页登录还要求捕获 owner 可用。真正登录动作仍在 Host Desktop 门禁下重新核对，不能用 IsLocal 或全局桌面进程在线状态代替。

正式 SDK handler 同时实现即时任务元数据与派生日程接口。自动计划检查全局配置、OwnerTaskId 和私有任务修订；手动运行检查私有修订，允许自动计划已禁用的任务。无修订入口明确拒绝，执行身份和冻结日期必须来自真实 Host 背景上下文。替换最近结果前，必须由 HasStopped 证明旧 run/attempt 写者已经停止，缓存成功不构成证明。运行按钮取 Host 的 task.IsRunning，每个未终结历史 run 独立保留 unknown；只按相同 run/attempt/私有修订合并逐游戏缓存。通知列表读取现役 owner 的启用和配置齐备状态，保留不可用身份供编辑，执行目标只取冻结目标与当前有效已选项的交集；配置齐备不代表外部可达或送达。手动与计划结果均使用原 invocation 提交通知，受理失败保留签到结果并标记通知未知，不重复签到。

副作用按真实角色/服务器各自去重：同一凭据 family 和游戏保持排他协调，一个任务完成角色 A 不能把另一个任务明确选择的角色 B 当成已签。已确认角色保留 confirmed，未知角色只能只读对账。Taji 的 roleId 不属于 family，但自动凭据轮换也不得改变 roleId。角色 A/B 消费者矩阵使用模拟 Host 协调 epoch；真实 Host 角色事实与 epoch 的原包集成资格另行验收。

正式入口已注册 checkin 业务 provider，并接入同一 scope 服务与独立页面。五平台官方隔离捕获已接正式 Desktop SDK，独立声明 12 个 loginOrigins 与 interactive-login 权限；完整同域条件组、精确字符/相等约束、当前账号验证后才接受候选。SDK 草稿转换后销毁，未知选择器拒绝；取消、客户端退休和 scope 停止等待真实捕获任务的 cleanup 返回。无实际捕获能力时保持手填。原包集成组在实际 Host 中安装原 ZIP，执行生产程序集。用例覆盖十四区域游戏的受控 HTTP、成功和响应丢失、轮换凭据先于角色查询可靠保存、同日跨任务不重复提交，以及五平台的真实 NativeClient/BrowserLogin 会话、只读身份核验与 opaque 候选原子保存。分钟调度使用派生计划的 OwnerTaskId 关联业务任务，通知经过现役队列，只投递明确选择的有效目标。合成捕获证明会话和程序集接线；官方页面与真实账号登录仍独立区分。

官方主页与直接引用脚本已只读核实，负例当前账号请求未携带凭据；完整协议来源证据留在本轮 Temp 的 `p3-game-checkin/protocol-sources`。官方 APK 只做 ZIP/指纹、manifest、DEX 与 Hermes 静态核对，没有安装或执行。公共静态脚本与无凭据错误响应只能证明相应字段/路径，不等同六平台成功登录或签到资格。现役 C# 源码已在正式 SDK 组件中编译；现役业务入口程序集与原 ZIP 已构建；原包调度、通知和受控原生捕获由 Host 的 storage-checkin 组验收；完整软件中的重启恢复、运行中更新与页面装配仍需成品集成验证。真实账号签到/领奖为 NOT_REQUIRED。

已保存凭据默认 keep 和空草稿，不在 mount 时读取。只有支持揭示的本地 transport、用户点击眼睛并明确确认后，才依次调用 confirm-reveal/reveal-credential。取消确认零请求，远程编辑禁用保存凭据的揭示，仍可明确清除或输入新值。Host 的当前 client/activation、24 小时且不延长的确认期限保持，单次 UI 明文最长 60 秒并在编辑器关闭/失去可见性时清除。

编辑器显式代理 ExtensionSurface 的 element/context/scope/signal/visible/onVisibilityChanged/setAppearance，保留实时 getter 与原接收者，取消仅合并自身 signal。Edge 夹具使用原型方法和私有字段 getter，覆盖隐藏/恢复清空草稿及取消释放订阅。
