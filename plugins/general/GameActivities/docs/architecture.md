# 游戏活动实现与维护

版本0.1.2，要求Host0.17.2、Plugin API2.2、Frontend API1.7。默认无订阅。活动设置通过公共 Modal footer 固定保存/取消操作，gameOrder 保存全部八个游戏的顺序（旧设置按已选游戏及默认剩余顺序补全），selectedGames 仅保存启用订阅。活动设置保存游戏顺序、区服与轮播间隔；设置v1使用revision CAS，订阅改变后立即获取数据。显示语言不改变区服。

## 内容与来源

唯一信息源是 `https://starrailassistant.top/api/v1/activity/` 的SRA JSON。八款游戏、11组进度固定映射：蔚蓝档案cn/jp/global分别为ba-cn/ba-jp/ba-global；原神ys、终末地end、星塔旅人xtlr、星穹铁道sr、鸣潮ww、绝区零zzz；异环cn/global分别为nte/nte-en-US，均加.json。异环国际服使用en-US，其余zh-CN；不翻译或混用区服。

走马灯展示根层version、versionName、endTime、cover，保留版本倒计时。详情仅展示activities数组的name、description、可选kind、起止时间和封面，不追加卡池、其他集合或推导活动。描述按原文显示，无公告链接。活动按进行中、即将开始、已结束、时间未知分组，已结束默认折叠；组内按截止或开始时间排列，同时间保持来源顺序。进行中优先临近截止，已结束优先最近截止。

右上角⏸️/▶️、🔄、⚙️控制暂停、刷新和设置。轮播间隔10–120秒或-1；悬停、焦点、弹窗、后台与减少动态偏好暂停自动轮播。

活动卡默认顺序为-100，首次加入今日概览布局及恢复默认时位于顶部；已保存的顺序由宿主布局管理。

## 时间与身份

明确时区按原值解释；无时区的ISO日期时间按SRA默认UTC+8解释并标注source-default。缺失、无效或只有日期的值显示未知，不补日期、秒数、周期或兑换时间。开始晚于截止的活动状态为未知。查看者电脑时区只用于显示；倒计时使用Host UTC和单调时钟。活动允许跨越版本范围。

活动ID由游戏、进度、原名称、开始时间确定；同键条目用出现序号区分。描述和结束时间修订不改变ID，不进行模糊合并。snapshotId覆盖内容和图片身份，不含检查时间与health。

## 刷新与资源

每6小时检查，开始/结束边界前后15分钟各最多额外检查一次，包括版本边界；手动刷新绕过周期，每分钟最多一次，执行中的请求合并。一个操作覆盖保存的订阅；切换订阅取消旧代次，排序或轮播间隔改变不取消来源请求。各区服失败隔离。

成功响应整体替换快照，合法空activities清空活动。错误响应、结构损坏、网络或存储失败保留last-good并显示缓存状态，按1/5/30/120分钟退避，遵守更晚Retry-After。读取state/feed不触发外网。SRA提供的是当前列表，不在本地累积历史活动或建立撤回账本。

私有state/feed与缓存为v3，缓存路径sra/v3，Assets为activity-v3。用户设置保持v1。旧缓存、资产和撤回账本保留原字节，不读取或自动清理。当前内容按game/progression/contentLocale隔离，首次运行重新获取SRA。

只下载SRA cover字段指定的HTTPS图片；SraImages维护已核验的图片CDN域名，拒绝凭据、非默认端口及域外地址，禁用自动重定向。没有公告页、社区接口或图片搜索请求。未知CDN暂不加载，需维护域名表。文字先原子发布，图片异步逐张发布；图片失败不阻止文本可用。同实体同URL保留旧图，强ETag复核或重新获取后比较内容hash；MIME和文件签名共同验证。

HTTP共享并发4、请求超时15秒，文字/图片各90秒预算；JSON响应4MiB、单feed1MiB/250条、单图片8MiB。图片预算128MiB，LRU保护所有当前v3快照引用。前端单一观察器按snapshot变化取feed，图片会话最多4个Blob请求，失败可重试，组件释放时取消请求、计时器和ObjectURL。

## 私有接口与验证

GET state；GET feed(gameId/progressionId/contentLocale)；PUT settings(expectedRevision/settings)；POST refresh({selected:true})返回202 operationId；GET refresh-status(operationId，30分钟有效)；GET assets(assetId，固定scope)。刷新结果包含checkedFeedCount、changedFeedCount、failedFeedCount和imageFailureCount。停用注销API、卡片和调度，并取消存储及刷新工作。

`ActivityCoordinator`负责设置、代次和原子快照；`SraActivityProvider`读取JSON；`ActivityNormalizer`映射与生成身份；`ActivityAssetCache`管理图片。前端源码在frontend，web为构建输出。私有feed合同见contracts/activity-feed.schema.json。

现役入口：`node tests/run.mjs plugin --plugin GameActivities --host-root <Host路径>`，包含xUnit、前端类型检查/构建及Test Host场景。前端行为合同通过tests/frontend/run.mjs的runPlugin和contract.mjs的resolvePublicElements执行。受控回归、11组真实API核验、构建与人工验收分别报告；本地core不等于locked gate或正式发布。
