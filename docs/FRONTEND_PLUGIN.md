# Frontend API 1.5 插件指南

NexusPipeline 的前端插件运行时加载插件构建后的 ES module/CSS。插件可以通过声明式 UI 贡献接入稳定 slot，也可以在启用且 Frontend API 精确匹配后加载同源资源，增加页面、导航、路由、主题、背景表面和运行画面预览能力。插件源码推荐使用 Vue 3、TypeScript 和 Vite；运行宿主只需要 `web/` 静态资源。

## 适用范围

前端能力与 `data-specialized`、`managed-code` 类型相互独立。任意插件类型都可以在 manifest 中声明前端模块；需要 C# UI、作用域数据、二进制资产、历史展示、插件 Web API 或插件本地化的插件使用宿主 Plugin API v1.6。Frontend API 1.5 提供调度中心运行卡片的 `dispatch.running.sidecar` slot、受控实时画面、通用外观表面（主题、token、背景表面）和插件自有词典访问。

## 目录与 manifest

前端公开资源必须位于插件根目录的 `web/` 下：

```text
plugins/general/Example/
├── plugin.json
├── store.json
├── data/                         # data-specialized 可选
├── ExamplePlugin.dll             # managed-code 可选
├── i18n/                          # 可选 zh-CN/en-US 资源
└── web/
    ├── main.js                   # frontend.entry
    ├── style.css                 # frontend.styles
    ├── components/
    └── images/
```

manifest 需要同时声明 capability 和 `frontend` 对象：

```json
{
  "schemaVersion": 2,
  "name": "example",
  "artifactName": "Example",
  "displayName": "示例扩展",
  "description": "提供额外的管理页面功能",
  "version": "0.1.0",
  "kind": "managed-code",
  "minHostVersion": "0.15.9",
  "apiVersion": "1.6",
  "entryAssembly": "ExamplePlugin.dll",
  "entryType": "ExamplePlugin.EntryPoint",
  "capabilities": ["frontend-module", "ui-contributions"],
  "frontend": {
    "apiVersion": "1.5",
    "entry": "web/main.js",
    "styles": ["web/style.css"]
  },
  "localization": {
    "defaultLocale": "zh-CN",
    "locales": {
      "zh-CN": "i18n/zh-CN.json",
      "en-US": "i18n/en-US.json"
    }
  }
}
```

前端源码位于插件自己的 `frontend/` 目录。根目录 `package.json` 通过 npm workspace 管理前端包；`npm run typecheck:frontend` 检查类型，`npm run build:frontend` 将每个插件构建到对应的 `web/` 目录。提交时保留可复现构建所需的 `package-lock.json`，宿主运行时不需要 Node/npm。

`frontend.entry` 必须是 `.js` 或 `.mjs`；`frontend.styles` 中的文件必须是 `.css`。所有声明文件需要随 ZIP 一起发布并通过宿主安装包校验。路径不能包含绝对路径、反斜杠、空段、`.` 或 `..`。

## 入口生命周期

入口模块导出 `activate(host)`。返回函数或带 `dispose`/`deactivate` 方法的对象即可在插件停用时释放资源：

```js
export function activate(host) {
  const slot = host.slots.register("settings.cards", ({ element }) => {
    // 在 element 内挂载插件组件，并返回组件清理函数
    element.textContent = "Plugin settings";
    return () => element.replaceChildren();
  });
  return () => slot.dispose();
}
```

插件应保存并释放 route、nav、slot、lifecycle 等注册返回的 disposable。每个处理器都应自行管理 AbortController、定时器、事件监听和 MutationObserver。

### 页面无关的插件运行时

需要持续生效的能力（背景表面、主题 token、轮换、轮询、全局快捷键等）属于插件前端模块的生命周期，而不是某个设置卡片或页面。`activate(host)` 中建立运行时并立即启动，slot renderer 只渲染设置界面：

```js
export function activate(host) {
  const runtime = createRuntime(host);   // 读取状态、应用 host.appearance、建立计时器
  void runtime.start();
  const slot = host.slots.register("settings.cards", ({ element }) => {
    // 设置卡片只提交修改并读取运行时快照；卸载时不清理全局外观
    return () => releaseCardResources();
  });
  return () => {
    slot.dispose();
    runtime.dispose();                   // 只有插件停用才清理全局外观与计时器
  };
}
```

宿主页面在任意路由都会加载插件前端模块，因此不需要用户打开设置页面即可生效；slot renderer 返回的清理函数只应释放该 slot 自己创建的资源（缩略图地址、拖拽状态、UI 计时器与监听器）。设置卡片卸载时不要调用 `host.appearance.clearBackground()` 或 `clearTokens()`，否则用户离开设置页面就会丢失背景与配色。单次启动行为（例如"启动时随机选择一次"）应由插件后端在插件启动生命周期中执行，页面访问不参与该语义。

## 前端 host 能力

| 能力 | 用途 |
|---|---|
| `host.plugin` | 当前插件的只读 name、displayName、version 和资源描述 |
| `host.api.get/post/put/patch/delete` | 以 JSON 语义调用本插件注册的 `/api/plugin-api/<name>/...` 路由 |
| `host.api.blob(route, { query?, signal? })` | `GET` 读取二进制响应并返回 `Blob` |
| `host.api.upload(route, body, { method?, contentType?, query?, signal? })` | 发送二进制请求体并读取 JSON 响应 |
| `host.routes.register(route, handler)` | 注册 `#/plugin/<name>/<route>` 页面 |
| `host.nav.register(item)` | 增加 `shell.nav` 导航项，item 包含 id、title、route、icon、order |
| `host.slots.register(slot, renderer)` | 为稳定 UI slot 注册自定义 renderer；renderer 接收 `{ element, context }`，在独立 surface 中挂载内容 |
| `host.ui.query/save/action` | 读取或提交宿主声明式 UI 贡献 |
| `host.lifecycle.*` | 订阅页面进入、离开、更新和释放事件 |
| `host.appearance` | 通用外观表面：注册主题、应用主题、设置或清除 CSS token、设置或清除背景表面 |
| `host.executionPreview.capture(runId, signal)` | 读取宿主绑定的当前 PC 游戏客户区或模拟器画面；返回 360p JPEG 或等待状态 |
| `host.i18n` | 读取当前插件的 locale、defaultLocale 和词典，使用 `t(key, args, fallback)` 以及日期/时间/数字格式化 |

`renderer({ element, context })` 可以使用 DOM API 或在 `element` 上挂载 Vue Custom Element；渲染器返回的函数会在 slot 重绘前调用。插件页面可以使用同源 DOM，但应为自己创建的元素添加明确的 `data-plugin-*` 标记，并在释放时移除事件与节点。宿主公共控件通过公开 `nxp-*` Native Custom Elements 提供，注册表为宿主 `frontend/src/ui/register.ts` 的 `NEXUS_PUBLIC_ELEMENTS`，`Test-FrontendPlugins.mjs` 按该集合校验插件产物；元素位置之外的 `nxp-*` 名称（例如自定义事件名）不属于元素使用。

结构组件 `nxp-section-card`（props：`title`、`description`、`variant`；默认插槽为 body，具名插槽 `header`、`description`、`actions`）与 `nxp-collapsible-card`（props：`title`、`description`、`expanded`、`panel-id`；展开变化 emit `toggle`，负载在 `CustomEvent.detail[0]`；body 为默认插槽，header 右侧为 `actions` 具名插槽）用于与宿主设置页保持一致的卡片外观。设置页的折叠协调协议对插件开放：插件展开自己的卡片时向 window 派发 `nxp-settings-panel-toggle`（`detail` 为 `{ panelId }`，收起时 `panelId` 为 `null`），并监听 `nxp-settings-panel-state`（`detail` 为 `{ panelId }`）以收起其它卡片。字段帮助文案在控件容器上设置 `data-help="说明文字"`，由宿主工具提示呈现。

## 稳定 UI slot

声明式和自定义 renderer 共用以下 slot 名称：

```text
dashboard.cards                 dashboard.after-running
users.list.badges               users.binding.sections
users.global.sections           scripts.list.badges
scripts.editor.sections         queues.list.badges
queues.editor.sections          dispatch.cards
dispatch.running.badges         dispatch.running.sidecar
dispatch.run.sections
history.list.badges             history.detail.sections
settings.sections               settings.cards
shell.nav
```

slot 的上下文包含 `mode`、`primaryId`、`secondaryId`。页面重绘时，插件通过 `onPageUpdated` 接收更新通知；slot renderer 应允许同一容器被重复渲染。

## Plugin API v1.6 配合方式

managed-code 插件在初始化时检查 `context is IPluginHostContextV1_6`，再按需使用：

- `context.Ui.Register`：注册 Form、Badge、Card 贡献。字段类型包括 text、textarea、secret、switch、select、multi-select、status、number、color、range、url；secret 读取只返回 configured 标记，保存使用 keep/set/clear 动作对象；
- `context.ScopedData`：使用 `global`、`user/<id>`、`script/<id>`、`queue/<id>`、`user-script/<userId>/<scriptId>` 等 scope 保存 JSON；
- `context.Assets`：按 scope 写入、读取、删除和枚举二进制资产；资产 Id 为内容 SHA256，写入内容寻址且幂等；
- `context.WebApi.Register`：注册本插件自己的 GET/POST/PUT/PATCH/DELETE 路由；请求可带原始请求体流，响应可返回白名单 Content-Type 的二进制流；
- `context.History.Register`：在运行历史落盘前生成徽章和字段快照。
- `context.I18n`：读取插件 manifest 声明的 `i18n/` 资源，使用 `T(key, fallback, args)` 和本地化日期、时间、数字格式化。

只需本地化能力的插件检查 `context is IPluginHostContextV1_4` 即可，该接口名称在 v1.6 中保持不变。

宿主 UI 投影端点为：

```text
POST /api/plugin-contributions/ui/query
PUT  /api/plugin-contributions/ui/<plugin>/<contribution>
POST /api/plugin-contributions/ui/<plugin>/<contribution>/action/<action>
```

插件 Web API 的最终路径为 `/api/plugin-api/<plugin>/<route>`。每次调用最多执行 30 秒，请求体上限 16 MiB，JSON 响应上限 2 MiB，二进制响应上限 16 MiB；插件异常使用 `code: "plugin_error"` 返回。二进制响应只允许 `image/png`、`image/jpeg`、`image/webp`、`image/gif`、`image/avif` 和 `application/octet-stream`，并附带 `X-Content-Type-Options: nosniff` 与 `Cache-Control: no-store`。UI 处理器和历史处理器也有独立超时，超限内容会被宿主丢弃。

`host.appearance` 提供 `registerTheme(name, definition)`、`applyTheme(name)`、`setTokens(tokens)`、`clearTokens()`、`setBackground(surface)` 和 `clearBackground()`。`setTokens` 的 token 名必须匹配 `--[A-Za-z0-9_-]{1,96}`，值不超过 4096 字符且不含控制字符；token 应用在 `body` 上，跨主题切换保持有效，直到显式清除或替换。`setBackground` 接受 `url`（仅 `http`、`https`、`blob`、`data`）、`blurPx`（0–40）、`dimPercent`（0–80）、`surfaceTransparencyPercent`（0–50）和 `secondarySurfaceTransparency`（默认 `true`）；背景地址交给 `setBackground` 后由宿主外观表面托管，替换或清除时宿主回收上一个 `blob:` Object URL。外观变化由宿主广播 `nexus:appearance-changed`。

壁纸配置、配额、文件校验、去重、轮换与配色属于插件业务：插件用 `context.Assets` 保存资产，用插件 Web API 提供状态与二进制读取，再通过 `host.appearance` 应用背景与 token。宿主不再提供服务端壁纸存储。

运行画面预览接口为 `GET /api/execution-preview/<runId>?plugin=<pluginName>`。PC 模式只读取宿主按进程识别的游戏客户区，模拟器模式使用宿主冻结的 Generic ADB 或 MuMuManager 驱动；插件不能提交进程、窗口或 ADB 目标。响应为 200 JPEG，或带 `X-Nexus-Preview-State` 的 204 等待状态。预览输出保持宽高比，高度最高 360 像素。

## 运行条件

`frontend-module` 表示插件请求前端能力。插件需要同时满足以下条件，入口才会出现在 `GET /api/plugin-runtime/frontend`：

1. 插件已启用且运行时状态为 Active；
2. Plugin API 与 Frontend API 版本兼容；
3. 入口和样式文件通过 manifest 与安装包检查；
4. 入口和样式文件位于插件目录的公开 `web/` 路径，并通过资源扩展名和文件存在性校验。

前端模块与管理页面同源运行，可以使用 DOM、同源 fetch 和当前页面可用的管理 API。Frontend API 只接受精确版本 `1.5`，其他版本不会加载。可见交互控件应使用 `nxp-*` Native Custom Elements 或插件自有 Vue 组件，开发者应把前端源码、构建结果与发行包一并纳入人工审查。

## 安全与资源边界

- 资源只从 `/plugin-assets/<plugin>/web/...` 读取，词典由宿主在前端描述中按插件身份提供；宿主拒绝路径越界、目录浏览和非白名单扩展名；
- `plugin.json`、配置、密钥、DLL、PDB、日志和用户数据不属于前端公开资源；
- 插件前端不应把 Token、Cookie、密码或用户配置写入 localStorage、IndexedDB、URL、日志或 DOM；
- 主题 token 名称和值会经过宿主前端校验；插件二进制资产由插件通过 `context.Assets` 保存在宿主 `config/plugins/{插件名}/assets/` 下，宿主不解释资产业务含义；
- 业务数据优先通过插件 Web API 和声明式 UI DTO 传递，界面展示使用 `textContent` 或 DOM API 写入文本。

## 发布前检查

- `plugin.json` 的 `frontend-module`、`frontend.apiVersion`、entry 和 styles 一致；使用本地化时，`localization.defaultLocale` 必须存在，所有资源文件必须使用相同 key 集合，并随 ZIP 放在 `i18n/` 目录；
- entry、styles 和其引用的静态资源全部位于 `web/`，ZIP 解压根目录可以直接找到 `plugin.json`；
- managed-code 插件 API 版本与宿主当前 Plugin API v1.6 兼容；只需本地化端口的插件继续检查 `IPluginHostContextV1_4`，需要资产端口的插件检查 `IPluginHostContextV1_6`；`custom-wallpaper` 使用 Plugin API v1.6 与 Frontend API 1.5；
- `activate(host)` 在宿主页面加载，停用和页面切换时无残留定时器、监听器或节点；
- 已验证 `GET /api/plugin-runtime/frontend`、插件 Web API（含二进制传输）、UI slot、主题/背景表面和错误隔离行为；
- ZIP 不含账号、Token、Cookie、配置、密钥、日志、`obj/`、调试符号或仓库外文件；
- 最终 ZIP 的 artifact 文件名、SHA256、sizeBytes 和 catalog 条目完全一致；插件包提交到 `packages/<ArtifactName>/`，不创建插件 Release 或 tag。
