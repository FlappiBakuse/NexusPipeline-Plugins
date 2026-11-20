# 前端：公共控件、集合与任务状态

生产入口使用 `createFrontend(transport)`，业务编辑器与受控测试共用实现；fixture 只替换 I/O。所有说明以当前公开 SDK 为边界，共用现役 Native Custom Elements 与样式约定。

## 五个模块

| 插件 | 公开表面 | 主要用户任务 |
|---|---|---|
| custom-wallpaper | `settings.panels` | 上传/选用/排序、轮换与效果 |
| game-activities | `overview.cards` | 订阅、内容进度、轮播、详情与刷新 |
| game-checkin | `application.navigation`，`/plugin/game-checkin/tasks` | 任务、计划、凭据、登录与结果 |
| live-screenshot | `execution.running.preview` | 当前 run/attempt 的画面与状态 |
| maa-framework | `automation.script.editor`、`automation.binding.editor` | 来源、任务、选项、预览和保存 |

`emulator-support` 与八个数据专项没有独立浏览器模块。

## 原子控件和集合一起复用

现役 `plugins/managed/frontend-ui` 已提供控件、模态、语言和可见图片等公共辅助。优先使用 SDK 的公开 `nexus-` 元素与这些辅助，避免在一个插件里重写 busy、disabled、确认归属、语言订阅和资源释放。

集合级规则也需要统一：

- 成组开关使用 `nexus-switch-list`，由组件绘制外框和可见开关之间的分隔线。
- 自绘内嵌区块使用 `data-surface="raised"`。Host 负责卡片底板、内嵌区块和填写控件的颜色层级。
- `nexus-collapsible-card` 为标题与展开内容提供同一底色，内容容器直接继承卡片主题。
- 设置分类由宿主与插件共享展开状态，保持单展开、选中置顶、重复点击关闭和视口稳定。
- 有顺序语义的集合继续使用公共 sortable/drag-handle；重排时验证身份集合，保持普通草稿与焦点。
- 所有嵌入真实 `<form>` 的非保存原生按钮显式 `type="button"`；保存只有明确出口。公共按钮本身也应有一致的动作语义。

Host 通过公开表面统一分类 owner；插件使用公开元素及窄能力，不访问 Host 私有 DOM、Vue 字段或全局 store。
字段帮助使用 `frontend-ui/src/field-help.ts` 的 `fieldHelp(panel, anchor, content, signal)`；内容为文本或语言更新时求值的函数。
锚点插入后再绑定，子编辑器传自己的 signal；已有明文说明无需重复。placeholder 仅提供空值格式或配置状态，秘密值不进入帮助。
字段帮助由 Host 在填写框旁绘制可切换的问号及带小三角的气泡。悬停和焦点气泡用于补充操作信息，常见图标操作通过可访问名称标识。
选择框展开时的提示避让、组合输入高亮、滑块键盘反馈与空列表样式由 Host [公共控件](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/reference/frontend-abi.md)维护，插件复用同一实现。

## 状态与拥有期

`SurfaceContext` 与 surface 提供实例、任务、信号和可见性。隐藏、卸载、切账号和新 attempt 撤销旧展示请求；晚到结果核对身份并释放图片租约。已受理写入由原操作 owner 结算。

| 内容 | owner 与行为 |
|---|---|
| 活动设置 | 本地草稿在保存时交给激活期命令 owner；取消或关闭丢弃草稿，失败保留编辑 |
| 壁纸 | 激活期命令 owner 即时提交，失败还原确认值，未知结果核对原操作 |
| 签到任务、Maa 项目和绑定配置 | `ExtensionSurface.drafts` 按实例、插件和目标保留实际编辑；未编辑表单关闭后释放 |
| 敏感输入 | `drafts.protect` 使用专用内存和清除回调，重开默认遮罩；披露与登录授权另行核验 |
| 已受理或未知保存 | 沿原 operationId 结算或只读查询；视图卸载释放展示资源 |
| 父子编辑 | `guardCancel` 先检查整个子树，`settle` 结清所属内容；`onParentSaved` 保留独立配置编辑 |

重开未保存草稿时显示一次 Toast。已有目标在恢复后标记变化字段与开关，首次编辑及新建目标使用普通状态。成功保存更新基线，普通快照刷新保留未提交编辑。

集合删除本次新增的定时项时，业务入口调用展示 owner 的 `discardNewItem(id)` 清除对应字段基线；折叠和隐藏保留基线，已保存项的原基线保留用于撤销与重建。插件警告样式消费宿主现役 `--warning`，与深浅主题同步。

共享交互规则由 Host 的[编辑草稿](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/reference/frontend-state.md#编辑草稿)维护，公开能力见[扩展前端](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/reference/extension-frontend.md#编辑草稿能力)。插件按所属任务管理普通状态、受保护输入和取消/保存结算，普通对象、浏览器存储和日志不保存秘密。

## 登录失败与白屏的最小诊断

可信原生菜单提供刷新、完成并验证与取消。验证失败保留隔离会话，成功后清理窗口、Cookie 和捕获值；取消与迟到响应保持原会话归属。

按窗口创建、CDP、导航、DOM ready、加载完成与取消清理记录阶段。主 frame 导航网络错误保留原会话；捕获、来源和权限检查继续约束原允许范围。

主导航失败会保留窗口，标题显示“官方页面加载失败，请在登录操作中刷新”。刷新重新加载已声明的官方起始地址，初始化、来源检查、秘密隔离与权限限制继续有效。捕获初始化或进程故障仍结束会话。日志只记录阶段、错误数值、来源类别和清理结果，不输出 Cookie、Token 或带查询参数的 URL。

原生测试使用断连后恢复的本地 HTTP 页面检查刷新、验证与取消；官方观测不输入账号、不调用签到。平台账号验证仍由插件负责。

## 错误反馈

操作错误在对应表面用 Toast 呈现，并保留普通草稿。未知写结果的查询入口留在原操作区。活动轮询失败可以继续显示旧缓存，在相关帮助中提供最近成功读取的时间。

可见状态、错误阶段和用户下一步先定义好，再增加必要的错误码。无生产消费者的字段或 code 不算完成可观测性。

## 构建与验证入口

实际前端构建命令和参数归[构建指南](building.md#浏览器模块)，浏览器场景命令归[验证指南](validation.md#前端单模块)。现役入口串联命名、类型和 bundle，同一计划执行一次并分别归类。省略 --extension 会扩大到五个模块，共享输入变化按工具输出确认实际消费者。

源码：[前端构建](../../tooling/build_frontend.mjs)、[场景选择](../../tests/frontend/fixture.mjs)、[插件账号验证](../../plugins/managed/game-checkin/src/Application/CheckInBrowserLogins.cs)。

## 首次准备

Host 在展示主界面之前等待异步 `activate`，之后等待当前页和全局外观的 `mount`。插件应在激活中读取默认只读状态与本地缓存并复用；不要等待外部图片或执行用户业务动作。总预算 30 秒，由宿主取消过期代次并提供重试。

活动插件直接用总览绘制轮播，`read-cached-cover` 只查询本地封面，已有图片解码后完成首轮挂载；详情打开后读取 `read-feed`。壁纸预读当前本地图片，签到预读任务列表。轮询仍只在表面可见时运行。

概览贡献声明 `dashboard` 元数据，布局键由插件持有并保持稳定；停用后宿主保留原键。图片由 manifest 的 `icon` 声明，专项脚本与 Maa 图标均随各自插件包交付。

## 隐藏窗口首屏准备

插件激活缓存与挂载实例在当前前端会话内复用。图片准备使用原始 Blob 的独立解码，禁止把隐藏页面的 HTMLImageElement.decode 或绘制帧作为就绪条件。活动轮播挂载直接消费激活阶段已经验证的封面；页面显示仅恢复可见性相关订阅与轮播。

活动卡片缩放时，视口与内部幻灯片共享高度动画，封面、遮罩和文案随布局同步变化；中断切换从当前高度继续，减少动态效果时直接切换。共享 frontend-ui 在呈现时翻译已知错误码和临时提示，语言切换更新现有 toast，原始错误与操作身份保持不变。
