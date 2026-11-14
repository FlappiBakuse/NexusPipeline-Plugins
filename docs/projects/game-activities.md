# GameActivities 0.5.0

面向 Host 0.18.0 / SDK 0.1.0。插件唯一业务 owner 为 `plugins/managed/game-activities`，无独立脚本或游戏执行入口。

| 业务 | 当前实现 |
| --- | --- |
| 来源 | SRA `api/v1/activity/` 下 ba-cn、ba-jp、ba-global、ys、end、xtlr、sr、ww、zzz、nte、nte-en-US，共八游戏 11 feed |
| 字段 | version / versionName / startTime / endTime / cover / activities；活动 name / description / startTime / endTime / cover / kind；不发布公告链接和抽卡记录 |
| 配置 | 默认无订阅；完整八游戏 gameOrder；BA cn/jp/global 与 NTE cn/global；轮播 -1 或 10–120 秒；交互暂停；未订阅进度保留 |
| 并发 | 设置 Documents CAS 与 operationId；丢失响应按原 operationId 只读查询提交结果并同步最新文档；缓存写入独立 feed CAS，不重试覆盖竞争胜出内容 |
| 刷新 | 六小时、已核实时间边界前后 15 分钟各一次、手动 60 秒持久限流；失败 1/5/30/120 分钟退避，尊重有界 Retry-After |
| 缓存 | 成功空列表替换旧内容；失败保留内容和 lastGoodAt；单 feed 文档；未知格式不覆盖；元数据与详情分次传输且校验同一视图 revision |
| 生命周期 | 订阅代次取消、迟到响应检查、唯一 scope 初始化任务先等待宿主明确发布信号，调用等待同一初始化；后台初始化/刷新隔离调用 ExecutionContext；scope 停止取消并等待进行中的请求，清理图片内存；不删除设置或普通缓存 |
| 时间 | 仅明确 Z/偏移转换为 UTC；无偏移、无效日期保留原值与 unknown；浏览器电脑时区显示，覆盖 DST 重复小时；未知时间不推算边界 |
| 图片 | JSON 引用绑定 SHA ID；八精确 HTTPS origin；不接收客户端 URL；PNG/JPEG/WebP MIME+签名、单项 8 MiB、内存 32 MiB / 128 项、TTL 淘汰；既有 SDK 图片库持久保存最多32项/32 MiB，文档与引用原子CAS，重启离线复用与有界淘汰 |
| 前端 | 实际 createFrontend + SDK invoke/image/subscribe；有界快照重读、scope 所有轮询、图片 release；轮播直接切换/暂停/展开、窄屏、详情分组、已结束折叠、即时设置与取消还原 |

来源字段夹具在 `tests/game-activities/fixtures`；`provenance.json` 记录原 JSON SHA 与精确官方 URL。11 个已登记活动源的无偏移时间按 UTC+8 解释；显式偏移优先，保留原始时间字段。封面 origin 根据这 11 份实际 JSON 中的根封面和活动封面核实：resource.starrailassistant.top、web.hycdn.cn、i0.hdslb.com、prod-alicdn-community.kurobbs.com、webusstatic.yo-star.com、fastcdn.mihoyo.com、sdk.hoyoverse.com、yh.wanmei.com。manifest 不使用通配域名。

验证入口 `tests/game-activities/verify.py` 接收实际 SDK producer receipt、共享 cache 和仓外 output。它编译当前产品源码与真实 SDK 包，运行源字段、时间、配置、缓存、并发、图片、实际 SDK DTO/dispatch 与 scope 组件案例。fake Host ports 用于组件层。可选 `--source-fields` 使用仓外官方 JSON 额外运行源字段用例。

`tests/game-activities/browser.mjs` 使用实际 P2 控件与 SDK ExtensionScope、生产 createFrontend、真实后端生成的 DTO，transport 为受控夹具。验证订阅 CAS/取消、未订阅进度再启用、未知时间、无公告跳转、图片 release、360px 及停止轮询；不等同已安装 Host 的鉴权或网络证据。

当前定向验证为组件 88/88、活动选择与详情焦点浏览器场景、程序集编译与五模块 typecheck/bundle PASS。完整 Host 原包安装后，重启进程并通过拒绝联网的代理读取六张缓存图片，摘要全部一致；未缓存图片请求被拒绝，原代理设置恢复。独立上游二进制资格为 NOT_APPLICABLE。
