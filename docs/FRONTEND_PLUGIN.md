# Frontend API 1.1 插件指南

NexusPipeline 的前端插件运行时建立在原生 ES module 之上。插件可以通过声明式 UI 贡献接入稳定 slot，也可以在用户确认信任后加载同源 JavaScript/CSS，增加页面、导航、路由、主题和壁纸能力。

## 适用范围

前端能力与 `data-specialized`、`managed-code` 类型相互独立。任意插件类型都可以在 manifest 中声明前端模块；需要 C# UI、作用域数据、历史展示或插件 Web API 的插件使用宿主 Plugin API v1.3。前端 API 1.1 增加 `settings.cards` slot 和服务端同步外观访问。

## 目录与 manifest

前端公开资源必须位于插件根目录的 `web/` 下：

```text
plugins/example/
├── plugin.json
├── data/                         # data-specialized 可选
├── ExamplePlugin.dll             # managed-code 可选
└── web/
    ├── main.js                   # frontend.entry
    ├── style.css                 # frontend.styles
    ├── components/
    └── images/
```

manifest 需要同时声明 capability 和 `frontend` 对象：

```json
{
  "schemaVersion": 1,
  "name": "example",
  "displayName": "示例扩展",
  "description": "提供额外的管理页面功能",
  "version": "0.1.0",
  "kind": "managed-code",
  "apiVersion": "1.3",
  "entryAssembly": "ExamplePlugin.dll",
  "entryType": "ExamplePlugin.EntryPoint",
  "capabilities": ["frontend-module", "ui-contributions"],
  "frontend": {
    "apiVersion": "1.1",
    "entry": "web/main.js",
    "styles": ["web/style.css"]
  }
}
```

`frontend.entry` 必须是 `.js` 或 `.mjs`；`frontend.styles` 中的文件必须是 `.css`。所有声明文件需要随 ZIP 一起发布并通过宿主安装包校验。路径不能包含绝对路径、反斜杠、空段、`.` 或 `..`。

## 入口生命周期

入口模块导出 `activate(host)`。返回函数或带 `dispose`/`deactivate` 方法的对象即可在插件停用时释放资源：

```js
export function activate(host) {
  const action = host.actions.register("refresh", async () => {
    await host.api.post("refresh", {});
  });
  const leave = host.lifecycle.onPageLeave(() => {
    // 停止当前页面的轮询或观察器
  });
  return () => {
    action.dispose();
    leave.dispose();
  };
}
```

插件应保存并释放 action、route、nav、slot、lifecycle 等注册返回的 disposable。每个处理器都应自行管理 AbortController、定时器、事件监听和 MutationObserver。

## 前端 host 能力

| 能力 | 用途 |
|---|---|
| `host.plugin` | 当前插件的只读 name、displayName、version 和资源描述 |
| `host.api.get/post/put/patch/delete` | 调用本插件注册的 `/api/plugin-api/<name>/...` 路由 |
| `host.actions.register(id, handler)` | 注册带 `plugin:<name>:` 命名空间的全局 action |
| `host.routes.register(route, handler)` | 注册 `#/plugin/<name>/<route>` 页面 |
| `host.nav.register(item)` | 增加 `shell.nav` 导航项，item 包含 id、title、route、icon、order |
| `host.slots.register(slot, renderer)` | 为稳定 UI slot 注册自定义 renderer |
| `host.ui.query/save/action` | 读取或提交宿主声明式 UI 贡献 |
| `host.lifecycle.*` | 订阅页面进入、离开、更新和释放事件 |
| `host.appearance` | 注册主题、设置 CSS token、切换主题和管理壁纸 |

`renderer(container, context, host)` 可以直接使用 DOM API；渲染器返回的函数会在 slot 重绘前调用。插件页面可以使用同源 DOM，但应为自己创建的元素添加明确的 `data-plugin-*` 标记，并在释放时移除事件与节点。

## 稳定 UI slot

声明式和自定义 renderer 共用以下 slot 名称：

```text
dashboard.cards                 dashboard.after-running
users.list.badges               users.binding.sections
users.global.sections           scripts.list.badges
scripts.editor.sections         queues.list.badges
queues.editor.sections          dispatch.cards
dispatch.running.badges         dispatch.run.sections
history.list.badges             history.detail.sections
settings.sections               settings.cards
shell.nav
```

slot 的上下文包含 `mode`、`primaryId`、`secondaryId`。页面重绘时，插件通过 `onPageUpdated` 接收更新通知；slot renderer 应允许同一容器被重复渲染。

## Plugin API v1.3 配合方式

managed-code 插件在初始化时检查 `context is IPluginHostContextV1_3`，再按需使用：

- `context.Ui.Register`：注册 Form、Badge、Card 贡献。字段类型包括 text、textarea、secret、switch、select、multi-select、status、number、color、range、url；secret 读取只返回 configured 标记，保存使用 keep/set/clear 动作对象；
- `context.ScopedData`：使用 `global`、`user/<id>`、`script/<id>`、`queue/<id>`、`user-script/<userId>/<scriptId>` 等 scope 保存 JSON；
- `context.WebApi.Register`：注册本插件自己的 GET/POST/PUT/PATCH/DELETE 路由；
- `context.History.Register`：在运行历史落盘前生成徽章和字段快照。

宿主 UI 投影端点为：

```text
POST /api/plugin-contributions/ui/query
PUT  /api/plugin-contributions/ui/<plugin>/<contribution>
POST /api/plugin-contributions/ui/<plugin>/<contribution>/action/<action>
```

插件 Web API 的最终路径为 `/api/plugin-api/<plugin>/<route>`。每次调用最多执行 30 秒，JSON 响应上限为 2 MiB；插件异常使用 `code: "plugin_error"` 返回。UI 处理器和历史处理器也有独立超时，超限内容会被宿主丢弃。

`host.appearance.wallpaperStore` 提供 `get()`、`upload(blob, metadata)`、`remove(id)`、`save(config)`、`savePalette(id, tokens)`、`startup()`、`refresh()` 和 `subscribe(callback)`。服务端保存壁纸文件、显示顺序、当前资源、轮换模式、模糊和变暗参数；所有浏览器通过 revision 同步。`startup()` 只用于启动 Web 时推进一次 `startup` 轮换游标。

宿主限制每张壁纸 20 MiB、总容量 128 MiB、最多 20 张，允许 JPEG、PNG、WebP，并校验 MIME、文件头和 SHA256。自定义壁纸启用后仍可使用宿主内置主题选择；配色应使用 `host.appearance.derivePalette(blob)` 生成完整实色 token，再调用 `savePalette` 保存。

## 信任与运行条件

`frontend-module` 表示插件请求前端能力，不能替代用户确认。插件需要同时满足以下条件，入口才会出现在 `GET /api/plugin-runtime/frontend`：

1. 插件已启用且运行时状态为 Active；
2. Plugin API 与 Frontend API 版本兼容；
3. 入口和样式文件通过 manifest 与安装包检查；
4. 用户在插件页明确确认当前插件版本的前端信任。

前端信任按插件版本与前端声明指纹保存。插件更新版本或改变前端声明后，用户需要再次确认；撤销信任会停止后续加载。由于可信前端模块与管理页面同源运行，它可以使用 DOM、同源 fetch 和当前页面可用的管理 API。开发者应把前端代码与发行包一并纳入人工审查。

## 安全与资源边界

- 资源只从 `/plugin-assets/<plugin>/web/...` 读取，支持 GET/HEAD；宿主拒绝路径越界、目录浏览和非白名单扩展名；
- `plugin.json`、配置、密钥、DLL、PDB、日志和用户数据不属于前端公开资源；
- 插件前端不应把 Token、Cookie、密码或用户配置写入 localStorage、IndexedDB、URL、日志或 DOM；
- 主题 token 名称和值会经过宿主前端校验；服务端壁纸资产使用 `user-assets/appearance/wallpapers/`，外观配置使用 `config/appearance.json`，轮换运行状态使用 `.nxp/state/appearance-runtime.json`；浏览器仅保留当前显示 Blob 的短期缓存；
- 业务数据优先通过插件 Web API 和声明式 UI DTO 传递，界面展示使用 `textContent` 或 DOM API 写入文本。

## 发布前检查

- `plugin.json` 的 `frontend-module`、`frontend.apiVersion`、entry 和 styles 一致；
- entry、styles 和其引用的静态资源全部位于 `web/`，ZIP 解压根目录可以直接找到 `plugin.json`；
- managed-code 插件 API 版本与 `IPluginHostContextV1_3` 使用情况一致；`game-checkin` 使用 Plugin API v1.2；
- `activate(host)` 在宿主页面加载，停用、撤销信任和页面切换时无残留定时器、监听器或节点；
- 已验证 `GET /api/plugin-runtime/frontend`、插件 Web API、UI slot、主题/壁纸和错误隔离行为；
- ZIP 不含账号、Token、Cookie、配置、密钥、日志、`obj/`、调试符号或仓库外文件；
- 最终 ZIP 的 artifact 文件名、SHA256、sizeBytes 和 catalog 条目完全一致；插件包提交到 `packages/<ArtifactName>/`，不创建插件 Release 或 tag。
