# 前端：公共控件、集合与任务状态

生产入口使用 `createFrontend(transport)`，业务编辑器与受控测试共用实现；fixture 只替换 I/O。所有说明以当前公开 SDK 为边界，保留 next 原生 Custom Elements 与样式约定。

## 五个模块

| 插件 | 公开表面 | 主要用户任务 |
|---|---|---|
| custom-wallpaper | `settings.panels` | 上传/选用/排序、轮换与效果 |
| game-activities | `overview.cards` | 订阅、内容进度、轮播、详情与刷新 |
| game-checkin | `application.navigation`，`/plugin/game-checkin/tasks` | 任务、计划、凭据、登录与结果 |
| live-screenshot | `execution.running.preview` | 当前 run/attempt 的画面与状态 |
| maa-framework | `automation.script.editor`、`automation.binding.editor` | 来源、任务、选项、预览和保存 |

`emulator-support` 与八个数据专项不因为本轮 UI 修复新增独立浏览器模块。

## 原子控件和集合一起复用

现役 `plugins/managed/frontend-ui` 已提供控件、模态、语言和可见图片等公共辅助。优先使用 SDK 的公开 `nexus-` 元素与这些辅助，避免在一个插件里重写 busy、disabled、确认归属、语言订阅和资源释放。

集合级规则也需要统一：

- 壁纸开关采用 Host 已有公共开关集合的边框/行布局，不再用外层自绘容器叠加卡片边框。
- 设置分类应由宿主与插件共享展开状态，恢复单展开、选中置顶、重复点击关闭和视口稳定的旧行为。只移动滚动位置不足以完成导航。
- 有顺序语义的集合继续使用公共 sortable/drag-handle；重排时验证身份集合，保持普通草稿与焦点。
- 所有嵌入真实 `<form>` 的非保存原生按钮显式 `type="button"`；保存只有明确出口。公共按钮本身也应有一致的动作语义。

不通过读取 Host 私有 DOM、私有 Vue 字段或写入全局 store 实现共享。若现役 SDK 缺少共同分类 owner，只扩展实际需要的最小公开接点，并同步 Host 与当前壁纸消费者。

## 状态与拥有期

`SurfaceContext` 与 surface 提供实例、任务、信号和可见性。隐藏、卸载、切账号和新 attempt 撤销旧展示请求；晚到结果核对身份并释放图片租约。已受理写入由原操作 owner 结算。

| 内容 | owner 与行为 |
|---|---|
| 活动和壁纸 | 激活期命令 owner 即时提交；活动取消还原打开基线，保存与关闭保持现状 |
| 签到任务、Maa 项目和绑定配置 | `ExtensionSurface.drafts` 按实例、插件和目标保留实际编辑；未编辑表单关闭后释放 |
| 敏感输入 | `drafts.protect` 使用专用内存和清除回调，重开默认遮罩；披露与登录授权另行核验 |
| 已受理或未知保存 | 沿原 operationId 结算或只读查询；视图卸载释放展示资源 |
| 父子编辑 | `guardCancel` 先检查整个子树，`settle` 结清所属内容；`onParentSaved` 保留独立配置编辑 |

恢复草稿显示保存或取消提醒；已有目标仅在恢复后标记变化字段与开关，首次编辑及新建目标使用普通状态。成功保存更新基线，普通快照刷新保留未提交编辑。

共享交互规则由 Host 的[编辑草稿](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/developer/frontend-state.md#编辑草稿)维护，公开能力见[扩展前端](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/developer/extension-frontend.md#编辑草稿能力)。插件按所属任务管理普通状态、受保护输入和取消/保存结算，普通对象、浏览器存储和日志不保存秘密。

## 登录失败与白屏的最小诊断

可信原生菜单提供刷新、完成并验证与取消。验证失败保留隔离会话，成功后清理窗口、Cookie 和捕获值；取消与迟到响应保持原会话归属。

按窗口创建、CDP、导航、DOM ready、加载完成与取消清理记录阶段。主 frame 导航网络错误保留原会话；捕获、来源和权限检查继续约束原允许范围。

主导航失败会保留窗口，标题显示“官方页面加载失败，请在登录操作中刷新”。刷新重新加载已声明的官方起始地址，初始化、来源检查、秘密隔离与权限限制继续有效。捕获初始化或进程故障仍结束会话。日志只记录阶段、错误数值、来源类别和清理结果，不输出 Cookie、Token 或带查询参数的 URL。

原生测试使用断连后恢复的本地 HTTP 页面检查刷新、验证与取消；官方观测不输入账号、不调用签到。平台账号验证仍由插件负责。

## 错误反馈

操作错误显示在对应表面并保留普通草稿；连接错误才提供重连，资源不存在不应统一建议重连。未知写结果保留持续核对入口。活动轮询失败可以显示旧缓存，但需要用户知道数据来自最近成功读取。

可见状态、错误阶段和用户下一步先定义好，再增加必要的错误码。无生产消费者的字段或 code 不算完成可观测性。

## 构建与验证入口

本批代码完成后才运行选定命令：

```text
node tooling/build_frontend.mjs --sdk-root <Host绝对根> --work-root <仓外依赖根> --output <仓外bundle根> --extension game-checkin
node tests/frontend/fixture.mjs --host-root <同源Host根> --work-root <含playwright-core的仓外依赖根> --bundles <bundle根> --report <新的仓外报告根> --browser <实际浏览器exe绝对路径> --extension game-checkin --scenario "checkin task editor and secret draft"
```

上例选择器是基线真实存在的 case；执行前按本批更新后的 `test(name, ...)` 名称确认。某一产品假设需要更小 case 时，在代码阶段调整现有测试组织，不新增一套与生产编辑器不同的 fixture。

`build_frontend.mjs` 可重复 `--extension`。省略时构建全部五个模块；本轮不默认省略。有有效旧回执时，共享 SDK/frontend-ui 变化可能自动扩大所有消费者，记录实际 selectedExtensions 及原因。基线参数解析不接受 `--shared true`，旧文档的该命令不应继续复制。

构建已经串联命名、tsc 和 bundling，统一计划只执行一次并分别归类结果；不再重复跑同一 tsc 或 Vite/esbuild。独立 lint/typecheck 接口若由本轮工具任务新增，文档再按已实现 CLI 微调，未实现前不伪造命令。

源码入口：[前端构建](../../tooling/build_frontend.mjs)、[场景选择](../../tests/frontend/fixture.mjs)、[插件账号验证](../../plugins/managed/game-checkin/src/Application/CheckInBrowserLogins.cs)。

## 首次准备

Host 在展示主界面之前等待异步 `activate`，之后等待当前页和全局外观的 `mount`。插件应在激活中读取默认只读状态与本地缓存并复用；不要等待外部图片或执行用户业务动作。总预算 30 秒，由宿主取消过期代次并提供重试。

活动插件直接用总览绘制轮播，`read-cached-cover` 只查询本地封面，已有图片解码后完成首轮挂载；详情打开后读取 `read-feed`。壁纸预读当前本地图片，签到预读任务列表。轮询仍只在表面可见时运行。

概览贡献声明 `dashboard` 元数据，布局键由插件持有并保持稳定；停用后宿主保留原键。图片由 manifest 的 `icon` 声明，专项脚本与 Maa 图标均随各自插件包交付。

## 隐藏窗口首屏准备

插件激活缓存与挂载实例在当前前端会话内复用。图片准备使用原始 Blob 的独立解码，禁止把隐藏页面的 HTMLImageElement.decode 或绘制帧作为就绪条件。活动轮播挂载直接消费激活阶段已经验证的封面；页面显示仅恢复可见性相关订阅与轮播。

活动卡片缩放时，视口与内部幻灯片共享高度动画，封面、遮罩和文案随布局同步变化；中断切换从当前高度继续，减少动态效果时直接切换。共享 frontend-ui 在呈现时翻译已知错误码和临时提示，语言切换更新现有 toast，原始错误与操作身份保持不变。
