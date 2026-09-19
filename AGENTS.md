# AGENTS.md — NexusPipeline-Plugins

继承 Workspace/AGENTS.md。本仓库维护官方插件源码、manifest、catalog、发行包及作者契约。公共 Host/Frontend API 和 nxp-* 元素以 Host 当前契约及本次 SDK 兼容元数据为准。

## 分支与权限

日常开发进入 develop；main 源码经 PR、P1/P2/P3 全量 Qualification 与 squash merge。develop 无自动 stable 发布、无每次修改强制 bump。普通 Agent 不直推 main。唯一生成物例外为专用 stable publisher App，白名单为 catalog.json、.release-state.json、packages/**；源码和工作流不在例外内。

发布流程的构建与写入分进程、分干净 runner。候选源码构建没有 App 私钥或仓库写令牌；writer 只运行受信 main 的发布代码并把候选 ZIP/JSON 作为不可信数据校验。Qualification App 与 Publisher App 分离，前者不具 contents:write/bypass。

App push 的递归由可信 guard 同时验证身份、父链与生成物差异后判定 no-op；单靠 actor 名或提交消息不成立。更新远端必须正常快进，竞态后重新校验基线；禁止 force push 和在开发者工作区 reset latest main。

## 两类插件

managed-code 可以含公开 Frontend API 1.5、公开 slot/route 与 nxp-* 元素；不得依赖 Host Vue 实现、私有 class 或未声明服务。

data-specialized 只含声明、允许的数据、后端判定/配置脚本与 i18n/说明。前端扩展点仅声明宿主能力，实际浏览器代码必须在 Host。禁止专项 frontend 对象（包括空对象/null）、frontend-module、frontend/、web/、Vue/TypeScript/Vite 浏览器工程、HTML/CSS 浏览器载荷和 .NET 程序集。

judge.js/judge.py、configEditor/configValidator.js 是现役后端能力，继续保留，不按 .js 后缀一概删除。当前专项 capability 集为 emulator、self-managed-pc-launch、no-fresh-config；resolve.inputs 使用现有 Host 表单。未知能力拒绝并清楚报告插件/字段，不静默丢弃后继续当正常插件加载。

专项验证须覆盖 source、ZIP 和 Host install/load/serve；纯数据路径不得启动 dotnet、managed tests 或 frontend build。Test-ConfigEditors 仍须执行对应后端行为测试。所有包保持 deterministic ZIP 与 SHA256。

## 版本与 SDK

stable 的 (artifactName, version) 不可对应不同字节。版本和日期只在用户指定后同步；不能由发布脚本自动 bump。原有 stable 下载协议与最近三个版本包的既有保留规则保持。Preview 不写 stable catalog/state/packages，也不提交 develop 生成物。

host.lock.json 的目标语义是 hostApiVersion、frontendApiVersion、supportedLocales；实际构建另固定一次 sdkSourceSha，P1/P2/P3 使用同一源码 SDK，发布重用资格记录中的 SDK。源码 SHA 用于复现本次编译，不表达 API 兼容。

阶段一保留 managed 工程对相邻 Host Abstractions 的 ProjectReference；CI 按固定 sdkSourceSha 检出在预期相邻目录。无需发布 NuGet 才能开工；不得用手写 stub 冒充真实 SDK。Host API1.8 与 Abstractions 包版本1.7.0 暂按现值保留。

## 测试与工具

新 CLI 入口完成前，使用现存：

```text
python tools/repository.py validate-source
python tools/repository.py check-syntax
node tools/Test-ConfigEditors.mjs
node tools/Test-FrontendPlugins.mjs
python -m unittest discover -s tools/tests -v
python tools/repository.py test-managed --full
```

P1=源码/仓库/本地化/语法/配置编辑器/Python 测试/PR生成物政策；P2=全部 managed 与适用 frontend；P3=相对 stable 基线计划、候选 ZIP 与 catalog。手动最终资格三个 Gate 全跑；test-managed 未提供 --full/有效 plan 可能零项目执行，不得据此宣称全量。

tools/repository.py 为 CLI；repository_core.py 保留纯规则与构建；发布编排进入 repository_publish.py；Git/Release HTTP 在单独适配器。实时 stdout/stderr 与非零退出码向上传递。普通业务测试使用可调用接口/结果/文件效果，禁止读取源码函数体匹配。

## Preview

固定 Pre-release plugins-develop，平面资产命名 <Artifact>-<version>-<sha256>.zip。包先上传并复核，catalog.json 最后切换。GitHub 资产替换存在短暂不可用窗口；Host 使用同通道缓存或报告不可用。首次迁移不自动回收历史 preview 包，防止缓存 catalog 引用断裂。

build 可取消，promote 不被新 build 自动取消。stable writer 串行，待发布状态从 .release-state.json 的 sourceCommit 与受信发布快照恢复，不依赖 workflow 排队顺序。dry-run 不产生任何远端写入。

## 文档、数据与交付

作者流程见 CONTRIBUTING.md；专项看 docs/DATA_SPECIALIZED_PLUGIN.md；managed 前端看 docs/FRONTEND_PLUGIN.md；发行看 docs/RELEASING.md。本次契约调整同步 README 和所有布局示例，不保留专项可选 frontend/web 说明。

禁止提交账号、Cookie、Token、密钥、用户设置、日志、临时生成物或无关调试符号。遵守 Workspace 的隔离测试、精确清理、UI行为测试、实时日志与发布授权规范。无生产调用的旧兼容层随最后调用迁移删除；当前事务恢复和第三方真实协议适配继续维护。
