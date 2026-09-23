# AGENTS.md — NexusPipeline-Plugins

本文件是本仓库的完整项目级工程约束。所有路径相对本仓库根目录。实施计划和任务可以细化步骤，不能扩大授权、降低测试要求或放宽用户数据保护。维护本仓库不依赖特定父目录名称或仓库外指导文件。

## 1. 项目与定位

本仓库维护官方插件源码、manifest、作者文档、稳定 catalog 和发行 ZIP。Host 为 `FlappiBakuse/NexusPipeline`；两仓库版本独立，Plugin API、Frontend API、manifest 和能力契约协同维护。

开工前运行 `git status --short --branch`、`git rev-parse HEAD`，保留用户已有改动。按下表读取最小范围，再打开对应插件及其测试。

| 事项 | 入口 |
|---|---|
| 插件分组、使用与源码目录 | `README.md` |
| 作者开发与验证 | `CONTRIBUTING.md` |
| data-specialized 数据/能力/脚本 | `docs/DATA_SPECIALIZED_PLUGIN.md` |
| managed 浏览器扩展与公共元素 | `docs/FRONTEND_PLUGIN.md` |
| 判断脚本 | `docs/JUDGE_SCRIPT.md` |
| Preview、Qualification、stable 发布 | `docs/RELEASING.md` |
| 文档导航 | `docs/README.md`、`docs/map.json` |

修改公共契约时同时读取 Host 的 `docs/reference/plugin-api/README.md` 和公开元素注册表。不要根据某台机器的相邻目录或旧 commit 猜测当前 API。CI 在一个运行中固定 SDK source SHA；本地联调显式提供 Host 路径。

## 2. 授权、Git、版本与数据

- 本地代码实施与 commit/push/tag/PR/合并/规则修改/Release 发布分别受用户授权。缺少发布凭据不阻止纯规则、工具和测试实现；不得把缺权限当作 writer 可以永久留空的理由。
- 日常开发进入 `develop`；`main` 源码经 PR、全量 `Plugin Release Qualification`、squash 合并。普通开发者/Agent 不直推或 force push `main`。
- 唯一生成物直推例外为专用 stable publisher App，路径白名单严格为 `catalog.json`、`.release-state.json`、`packages/**`。例外不包含源码、工作流、host.lock 或版本修改。Writer 校验实际 Git 差异、父链和来源后正常快进推送；bypass 权限本身不提供路径隔离。
- 首次安装仓库资格控制面时，单独的控制面初始化 PR 按当时实际生效的门禁与维护者明确审核合入；不携带产品功能或生成物、不伪造新资格、不自动发布。此初始化操作需要独立授权，不能成为已启用门禁后的绕过入口。
- `develop` 同一目标版本可多次修改和预览，不强制每次 bump；不修改稳定 catalog/state/packages。稳定 `(artifactName, version)` 不得对应不同字节。正式版本及日期按用户明确指示，发布脚本不自动 bump。
- 修改前保存 HEAD、diff 和未提交文件的仓库外检查点。未经具体授权不使用 reset/clean/stash/覆盖恢复。备份 tag 仅本地，不推送。
- 不提交账号、Cookie、Token、密钥、用户设置、日志、运行现场、缓存、临时目录、调试符号或无关构建产物。只清理本次生成且核验过的精确路径；保留用户数据和失败证据。
- 获授权后按独立可验证的功能边界提交，Conventional Commits 类型英文、说明中文；不混入无关变更，不设任意文件数冻结门槛。

## 3. 两类插件与包边界

`managed-code` 可以提供公开 Plugin API 以及 Frontend API 1.5 的 slot/route、生命周期与公开 `nxp-*` Native Custom Elements。禁止依赖 Host Vue 内部组件、私有 class 或未声明的宿主服务。

`data-specialized` 只包含 manifest、数据、允许的后端判定/配置脚本、i18n 和说明。浏览器扩展点仅声明受支持的 Host 能力，代码由 Host 实现。拒绝 frontend 字段（含 null/空对象）、frontend-module、frontend/、web/、浏览器工程、HTML/CSS 浏览器载荷和 .NET 程序集。未声明 taskProtocol 的旧插件不能按 .js 后缀删除现役 judge/configEditor/configValidator；声明首发 taskProtocol 0.1.0 的官方插件必须删除 configValidator，保持 configEditor 公共字段但使用 `data/editor.js`。旧开发协议 1.0/1.1/1.2 不作为兼容契约加载。

当前专项能力为 `emulator`、`self-managed-pc-launch`、`no-fresh-config`；`resolve.inputs` 使用 Host 的声明式输入表单。新增能力必须先实现宿主语义、双仓契约及测试。未知能力应清楚报告插件和字段，不静默启用。专项源码、ZIP、Host install/load/serve 都执行相同边界验证。

纯数据插件不启动 dotnet、managed tests 或前端构建；仍执行语法/配置脚本契约并生成 deterministic ZIP 与 SHA256。managed 插件执行真实构建和测试。ZIP 禁止路径穿越、绝对路径、重复/大小写冲突、符号链接和超限解压。稳定包保留现行最近三个版本策略，不清除已发布资产来绕过不可变性。

## 4. 测试与 SDK

自动化测试从当前终端直接运行并继承权限。普通或管理员终端均可，不主动 UAC、降权或按权限跳过。Windows managed/宿主运行测试仍需要 Windows；平台缺失写明 NOT_RUN，不冒称普通权限导致无法测试。Host 功能联调使用其 asInvoker Test Host，正式发行 EXE 的管理员要求保持。

主要入口如下；准确参数、准备依赖及 SDK 路径见 `CONTRIBUTING.md` 和 `docs/RELEASING.md`：

```text
python tools/repository.py validate-source
python tools/repository.py check-syntax
node tools/Test-ConfigEditors.mjs
python -m unittest discover -s tools/tests -v
python tools/repository.py qualification --group source --base <B> --host-root <Host路径> --sdk-sha <SDK_SHA>
python tools/repository.py qualification --group frontend-managed --host-root <Host路径> --sdk-sha <SDK_SHA>
python tools/repository.py qualification --group candidate --base <B> --host-root <Host路径> --sdk-sha <SDK_SHA> --output <隔离候选目录>
```

P1 = 源码、兼容/本地化元数据、语法、配置编辑器、工具测试和 PR 生成物政策。P2 = 全部 managed 构建/测试和适用前端 typecheck/build/conformance。P3 = 基于目标 main 发行状态的候选计划、实际 ZIP/hash/catalog 验证。最终资格 P1/P2/P3 全跑，不能把未提供 full/plan 导致零项目执行当全量通过。

`host.lock.json` 记录 `hostApiVersion`、`frontendApiVersion`、`supportedLocales` 等兼容契约；SHA 用于固定一次编译输入，不是兼容版本。SDK 来源在 preflight 固定，所有 Gate、candidate build 和 publisher 验证使用同一值。当前阶段可使用真实 Host Abstractions 的 ProjectReference；checkout 布局和 `--host-root` 必须指向同一个 SDK，不手写 stub 冒充 SDK。Host API 版本与 Abstractions 包版本分别治理，不自行统一或递增。

先构建前端再执行依赖构建输出的 conformance。所有工具退出码向上传递；未知分组、缺依赖、空选择、零用例、意外 skip、缺报告和 timeout 均不算通过。测试最低有效层覆盖实际结果，不读取源码函数体匹配普通行为。UI 测试不持久化视觉截图/像素/布局基线，不依赖私有 DOM/class。跨宿主 Smoke 复用 Host 核心流程，不扩增装饰性 UI 测试。

命令 UTF-8、非交互、显示实时阶段与失败摘要。Python 用于适合的文件/规则工具；现役 dotnet/npm/node/.cmd 入口按文档执行。失败保留证据并修根因，不用重试或跳过掩盖。

## 5. Qualification 与发布

PR Feedback 最多 P1/P2/P3 三类，可按影响范围选择；最终手动 Qualification 不接受路径过滤。main 前进后候选同步再完整验证。资格由受信 App 写到确切候选 H，并绑定目标 B、实际工作流 C、runId/runAttempt 和 SDK SHA。只接受所有必需 job 真实成功；相同名称不代表相同来源。

构建 runner 没有发布 App 私钥或仓库写令牌。Writer 在独立干净 runner 运行已审核 main 的发布实现，将候选 ZIP/JSON 视为不可信数据。Qualification App 与 Publisher App 分离；令牌按实际使用时刻生成，不把短期安装令牌长期存为固定 Secret。

Preview 固定 `plugins-develop` Pre-release；平面资产名 `<Artifact>-<version>-<sha256>.zip`。包上传、下载复核后再切换 `catalog.json`。旧 catalog 引用的包不立即回收；短暂不可用由 Host 同通道缓存或明确错误处理。build 可取消，promote 不因新 build 自动取消；旧候选不得覆盖新候选。

Stable 在通过资格的源码合入 main 后构建并写回生成物；不重复全量测试。使用目标 main 的 catalog/state/packages 作为发行基线，候选源码只提供源码输入。维护 `.release-state.json.sourceCommit` 游标，正常快进更新；竞争后重新校验，不 reset 用户工作目录，不依赖工作流排队顺序。App 自身生成物提交的递归过滤同时验证 App 身份、父链和路径，不能只看 actor 名/提交消息。

dry-run 不写远端。实际写入入口必须有可测试实现，不能以永久抛异常代替。上传 Actions artifact 只是候选交付，不是 stable/preview 已发布。远端发布成功须有资产下载及 hash 复核。

## 6. 文档与完成标准

长期规则、命令、布局、状态及错误处理都在本仓库正式文档内维护；完成的实施教程、会话清单、迁移库存、临时审计文件与历史兼容层不成为后续开发依赖。源码变更同步 README、CONTRIBUTING、专项/前端指南及 RELEASING；文档链接和结构可自动验证，不用自然语言 regex 固定措辞。

清理前保留失败证据到外部明确目录，核对本次文件所有权、进程已退出和 Git 状态。永久保留现役 schema、源码、测试、发布工具、作者指南与稳定发行事实；临时产物按精确清单删除。

最终报告分开列实现、实际验证和远端启用状态。用无父文档、无实施包的新 checkout 验证上手路径。未经实际执行不宣称产品构建、全量测试、远端资格或发布通过。
