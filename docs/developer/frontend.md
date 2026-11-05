# 浏览器模块

模块表单使用公共自绘选择器、时间、数字、开关及确认控件，沿宿主主题与语言显示。
确认请求归当前表面所有，表面撤销时取消；同一表面尚有确认时，不接受第二次授权。
Maa 映射及保存确认绑定预览输入，等待期间输入变化会要求重新预览。

五个模块各自导出 `createExtension(ports)`，注册当前 SDK 0.1.0 的 `FrontendExtension`。
生产安装入口导出 `createFrontend(transport)`；各模块已有范围不同的真实服务与原包接线，完整资格逐模块核验。
生产与核心交互测试共用一个编辑器，受控 `ports` 只替换 I/O。Maa 的正式 `createFrontend` 入口
提供任务/选项/排序/次数、预设、导入、运行文件映射、保存和原操作结果核验。
`ports` 是插件本地业务端口；P3 的 Host 公开插件服务适配负责提供实现。未注入端口时，
模块显示“服务尚未接入”，不会编造成功响应。构建从显式传入的 Host SDK 公共入口取得类型与身份，
并将 SDK 版本、合同指纹同本仓 `contracts/sdk-source-lock.json` 核对。全部产物和依赖放仓外。

| 插件 | SDK 表面 | 浏览器交互 |
|---|---|---|
| CustomWallpaper | `settings.panels` | 多图上传、删除、排序、选用；随机/定时轮换、模糊/暗化/透明度、图片配色；外观状态由扩展生命周期持有 |
| GameActivities | `overview.cards` | 游戏/区服订阅、轮播、暂停/展开、倒计时、手动刷新、缓存提示、详情与设置 |
| GameCheckIn | `application.navigation` 与 `/plugin/game-checkin/tasks` route | 多任务增删改排、手动运行、平台游戏、时间计划、通知、凭据 keep/set/clear、浏览器与塔吉多登录 |
| LiveScreenshot | `execution.running.preview` | 当前 run/attempt 截图等待、不可用、就绪；仅可见时按五秒更新并回收 Blob URL |
| MaaFrameworkDriver | `automation.script.editor`、`automation.binding.editor` | 来源/项目探测、Controller/Resource、任务条目/顺序/次数/参数、窗口/ADB、预设、预览、导入与受保护秘密 |

插件浏览器代码只访问 `SurfaceContext`、`ExtensionSurface` 和公共 `nexus-` 元素；不读取宿主私有 DOM。
每个挂载由 surface signal 取消，晚到结果在显示或发布前核对拥有期。GameCheckIn 与 Maa 的秘密明文只在当前编辑器内存，
关闭时清除；保存端口传递明确的 keep/set/clear 或已保存的受保护引用。Host 注册表拥有激活、撤销、样式和晚 cleanup。

五 bundle 的严格类型检查与 Edge fixture 属于 contract-only；实际原包/Host结果保留各自范围，不由该fixture推定。
核心交互验证从正式 `createFrontend` 入口挂载共用编辑器，另以实际安装包核对关键路径。
语言验证覆盖静态/动态文案与模块激活后的切换，普通草稿和操作归属须保持；新建英文模块不能代替切换验证。
构建先使用锁定的 TypeScript AST 检查前端、测试与工具中的类型、函数、局部函数、方法及箭头函数名称；
名称最多三个单词，解析失败或覆盖自测失败会阻断构建，收据写入显式输出目录。
前端构建记录实际 TypeScript、esbuild 与 Node 输入；相同输入复用原回执和产物，命名检查仍执行。
各 bundle 的源依赖包括类型导入、共享控件、SDK 与传递 CSS；修改其他模块不会误判当前包来源。
模块按 `onLocaleChanged` 显式更新文案，保留普通输入节点与无效草稿；表面释放时停止全部语言订阅。
fixture case 是插件端口与表面的定向合同场景，不作为完整产品的核心浏览器 smoke 数量；
它们覆盖键盘排序、失败保留草稿与重试、取消、隐藏恢复、卸载、晚帧及注册表晚 cleanup。
补充场景覆盖 Maa 预览输入与反序响应、组选项合并与秘密代次、签到迟到登录和编辑会话、
活动不完整时间与倒计时边界，以及无变化刷新时的素材和列表拥有权。
测试入口使用 Node.js 24 和显式仓外依赖，保留各次原始收据；失败与后续修复结果分列。
活动状态包含已订阅和未订阅游戏的可选 feed；`progressions` 独立保存未订阅游戏的内容进度选择。
轮播在同一轨道内切换，详情及设置使用公共模态控件；隐藏时暂停展示任务并保留设置草稿。
五模块截图保存在本轮仓外验收目录。活动与签到使用固定旧版组件、相同合成数据、主题与视口进行对照；
场景分别记录功能、静态布局及正常动效，截图数量不能替代未执行场景；fixture端口为受控实现。
签到编辑器保留普通草稿，隐藏时清除秘密明文并拒绝晚到的读取或登录结果；
凭据通过独立 keep/set/clear 意图保存，不进入任务草稿。已保存凭据仅本地连接在用户确认后读取，临时明文到期清除。
壁纸保留折叠设置、双开关、轮换与效果字段，以及拖拽图片列表；删除沿旧版直接执行。
实时画面显示来源徽标、居中画面和本地时间页脚，等待和不可用状态保留同一舞台区域。
Maa 区分脚本基本／高级与账号绑定读取项目前后状态；项目根目录由宿主编辑区提供。
Maa 的 JSON 与次数草稿在重绘后仍须通过有效性检查，预览捕获完整独立副本；
隐藏时清除秘密，重绘撤销旧控件的请求拥有期，晚到的受保护引用不能写回。
Maa 保存结果未知时查询原操作；普通保存可按原 ID 和冻结输入重试，受保护保存仅查询恢复结果。
签到私有保存端口的完整操作结果查询仍须单独核验。

图片读取在插件本地限制压缩字节和解码像素，实时截图上限分别为 32 MiB 和 64 MiB；
壁纸缩略图及活动详情图片按可见区域读取，各自最多四张在途，隐藏时释放展示 URL。
这些约束不等于整个 Host 标签页的全局媒体预算；P3 接线须用 Host 公共媒体池维护跨表面预算和租约。
壁纸在同一可见拥有期复用相同资产的验证结果与显示 URL，效果更新不重读素材；隐藏后重新取得拥有权。
设置缩略图按资产身份复用，删除和卸载释放 URL。签到跳过相同修订刷新，按任务 ID 更新变化行，
保留展开与焦点，拖动期间延后应用列表变化。工作次数验证不作为整机 CPU 或内存通过证据。
没有新的完整插件后端服务、manifest 前端声明、实际安装与 Host 页面接入结果，不能把这些 fixture 结果记为 integrated。
实际包须登记 `ui.contribute` 与 frontend entry/styles，再用实际插件服务逐项复测。
LAN HTTP 下的标识符使用 `getRandomValues` 生成，不依赖仅安全上下文可用的 `randomUUID`。

工具矩阵使用显式仓外 `NEXUS_TEST_ROOT`；Node 输入测试另需 `NEXUS_FRONTEND_WORK_ROOT` 指向已安装构建依赖的工作区。
运行 `python -B -m unittest discover -s tests/tooling -p test_slice_inputs.py` 与
`node --test tests/frontend/input-cases.mjs`，分别验证编译/打包来源、模块闭包与产物篡改拒绝。
`node --test tests/frontend-paths.test.mjs` 验证依赖工作区、输出目录和 SDK 输入经过目录联接时，在写入前拒绝；同样需要仓外 `NEXUS_TEST_ROOT`。

## 显式范围

`build_frontend.mjs` 可重复 `--extension <id>`；支持 custom-wallpaper、game-activities、game-checkin、live-screenshot、maa-framework。
省略选择为全部；单插件只编译该模块与共享依赖。`--shared true` 明确扩大全部五个消费者；
复用时发现 SDK 或 frontend-ui 变化也自动扩大。没有有效旧回执时，调用者对共享变更必须显式传此参数。
回执逐模块保存传递源码、SDK 和实际 compiler 输入，不以完整快照变化代替相关输入。

`tests/frontend/fixture.mjs` 要求 `--extension <id> --scenario <完整case名称或all> --browser <绝对exe>`。
只有对应插件的实际 case 被执行；未知名称或零 case 失败。先按选择构建 bundle，不能要求单插件恢复测试准备五包。
case 名称来自 tests/frontend 中现役 `test` 声明；选择不会改变其断言或受控 I/O 边界。
Host 原包浏览器流程与此合同夹具分开，入口和依赖见 Host 的 docs/developer/frontend-testing.md。
行级 locale 订阅归该行 panel，重排、刷新及移除均释放。
