# 贡献指南

感谢为 NexusPipeline 编写插件。提交前请先确认适配目标、许可证和可公开分发的数据范围，再开始编写插件。按任务选择 [文档门户](docs/README.md)，自动化开发约束见 [AGENTS.md](AGENTS.md)。

## 目录与命名

- 插件机器标识使用稳定的小写 kebab-case，例如 `bettergi`、`maaend`。
- 源码目录使用正式大小写的 `artifactName`；`plugin.json` 中的 `name` 是机器标识，`artifactName` 必须与源码目录名保持完全一致。
- `artifactName` 使用 ASCII 字母和数字，首字符为字母，至少包含一个大写字母；正式包目录和 ZIP 文件名必须保持完全一致。
- `displayName` 面向 UI，修改展示文字不应改变 `name`。
- 插件版本使用独立的受限版本字符串，例如 `0.1.0`、`0.1.0-beta.1` 或 `0.1.0-rc.1`；宿主最低版本写在 `plugin.json` 的 `minHostVersion`。
- `store.json.authors` 是正式插件的必填展示元数据，至少包含 1 位作者，作者 URL 为空或使用 HTTPS。
- `data-specialized` 插件只使用 `resolve`、`judgeScript` 和可选的 `configEditor`；已退役的 `configValidator` 会被拒绝；能力只能是 `emulator`、`self-managed-pc-launch`、`no-fresh-config`。它不得声明 `frontend`（包括 `null`），不得包含 `frontend/`、`web/`、浏览器工程或 .NET 程序集。Frontend API `1.6`、`frontend-module`、`frontend/` 和 `web/` 仅适用于 `managed-code`；`EmulatorSupport` 使用 `IPluginHostContext` 注册驱动 provider。

## 开发流程

1. 从现有插件中选择运行目录结构相近的参考实现。
2. `managed-code` 插件创建 `plugins/general/<ArtifactName>/`，`data-specialized` 插件创建 `plugins/specialized/<ArtifactName>/`，按插件类型补齐 manifest、`store.json`、data 资源或 .NET 项目。
3. 数据化插件在目标软件目录验证 profile 推导；代码插件构建并验证入口程序集、依赖和 Plugin API 版本。
4. 验证运行语义、错误处理、用户数据隔离和敏感数据边界。
5. 检查 JSON、脚本源码和发行包不含个人数据。
6. 仅 `managed-code` 可以校验 `frontend-module` capability、Frontend API `1.6`、`frontend/` 的 Vue/TypeScript/Vite 源码、`web/` 构建产物和 slot cleanup 行为；公共控件使用宿主 `nxp-*` Native Custom Elements，不依赖宿主私有 Vue 组件、私有 class 或内部实现。`data-specialized` 只校验三个 Host 声明能力和后端脚本闭包。若使用本地化，使用 `host.lock.json` 的 `supportedLocales` 中声明的规范化 BCP 47 locale，确保默认资源存在、所有语言 key 集合和占位符集合一致、value 为非空字符串且不使用 `legacy.*` key；数据化专项插件的 `inputs.labelKey` 与 `inputs.descriptionKey` 必须在所有 locale 资源中存在；确认公开资源不包含配置、密钥、程序集或调试符号。
7. 正式发行前按授权确定插件版本并同步 `store.json`；未发布的同一目标版本内修复和重建不重复提升版本；工具、文档和 CI 治理改动不制造新插件版本。Pull Request 运行范围验证，手动稳定候选按已发布游标计算累计计划。catalog 尚未包含新插件或新版本时，`validate` 会因源码与现存 catalog 集合不一致而失败；候选生成只写指定的外部新输出目录，不改源 `catalog.json`、`.release-state.json` 或 `packages/`。

## 测试与提交治理

日常验证使用[核心测试](docs/TESTING.md)中的单插件或变化选择入口；真实 Host 与生产插件参与执行，测试输出位于外部目录。

- 提交按功能边界拆分，每个提交保持可独立验证、审查和回退；提交操作需要维护者明确授权。
- 持久化 UI 测试只覆盖功能结果、ARIA、焦点、状态、提交、路由、API 效果和生命周期。
- 不建立截图外观基线或布局回归。截图数据能力可用两帧合成内容核对实际解码值；正式维护的功能 E2E 留在 tests，运行产物与一次性人工验证脚本放外部临时目录。
- 前端插件使用公开 Frontend API、公开 slot 和 `nxp-*` 元件；公共复合元件与最低宿主版本要求以 [Frontend 插件指南](docs/author/FRONTEND_PLUGIN.md) 的当前清单为准。
- 模拟器 provider 插件覆盖探测的不匹配/错误、重复匹配、优先级、注册撤销、取消与超时边界，并验证冻结驱动完成应用启动、前台查询、截图、应用停止和实例关闭；厂商实现不得在证明实例身份前执行进程清理。

详细字段约定见 [数据化专项插件开发指南](docs/author/DATA_SPECIALIZED_PLUGIN.md)，判断脚本约定见 [JUDGE_SCRIPT.md](docs/author/JUDGE_SCRIPT.md)，代码插件接口约定见 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/reference/plugin-api/README.md)，前端模块约定见 [FRONTEND_PLUGIN.md](docs/author/FRONTEND_PLUGIN.md)。`custom-wallpaper` 使用 Plugin API 2.1 与 Frontend API 1.6，`game-checkin` 使用 Plugin API 2.1 与 Frontend API 1.6，`live-screenshot` 使用 Plugin API 2.1，`EmulatorSupport` 使用 Plugin API 2.1。

## 发行包规则

- stable 由受信 Publisher App 在验证原 candidate job 与包清单后写入 `main` 的 `catalog.json`、`.release-state.json` 和 `packages/<ArtifactName>/`；普通开发者、Agent 和常规 token 不得直接写入。develop preview 使用固定 `plugins-develop` Release，包名为 `<ArtifactName>-<version>-<sha256>.zip`，不修改 stable 文件。
- 每个 artifact 目录最多保留最近三个受限版本包；版本排序遵循 `beta < rc < stable`，旧包仅用于仓库存档，插件平台不提供降级安装。
- stable ZIP 文件名使用 `<ArtifactName>-<version>.zip`，preview ZIP 文件名使用 `<ArtifactName>-<version>-<sha256>.zip`；目录名和文件名区分大小写。`catalog.json` 使用 schemaVersion 2，并包含 `artifactName`、精确包 URL、`sha256`、`sizeBytes` 和最近更新记录。stable 相同 `(artifactName, version)` 的发行包不可覆盖；preview 允许同版本按包哈希更新。
- `packageUrl` 必须精确指向 `https://raw.githubusercontent.com/FlappiBakuse/NexusPipeline-Plugins/main/packages/<ArtifactName>/<ArtifactName>-<version>.zip`。

## 本地检查

提交前至少执行以下检查：

```text
# PR 范围验证：从官方 Host main 固定完整 SHA 后传入
python tools/repo.py check source --base <完整PR基线SHA>
python tools/repo.py check host --host-root <显式Host路径> --sdk-sha <完整HostSHA>
node tests/run.mjs daily --changed --base <完整PR基线SHA> --host-root <显式Host路径>

# 合并后本地候选诊断：合成 run ID 不能用于远端发布
python tools/repo.py release candidate --host-root ..\NexusPipeline --sdk-sha <Host_SHA> --workflow-sha <当前完整SHA> --run-id 1 --run-attempt 1 --output <新的外部stable-candidate目录>

# 获明确远端执行授权后的候选；publish-only 另传原 candidate run ID
gh workflow run publish-stable.yml --ref main -f operation=candidate -f source_ref=main

# develop preview：只写新的外部 preview 候选，不写 stable 文件
python tools/repo.py release plan --channel preview --host-root <显式Host路径> --sdk-sha <完整HostSHA> --output <新plan-phase.json>
# 根据 plan 为每个 artifact 执行 package，再执行 release assemble；见 tools/README.md。

# 完整 ZIP / SHA256 / catalog 审计（手动诊断）
python tools/repo.py release audit --baseline <可信分发完整SHA>
```

managed-code 插件还应在 `plugins/general/<ArtifactName>/src/` 执行 `dotnet build --no-restore`，确认发行包包含 manifest、入口 DLL 及所需依赖。带前端的插件还应确认 ZIP 中入口与 styles 所列文件均位于 `web/`，浏览器能加载 ES module/CSS，宿主的启用状态、API 兼容性和公开资源校验均正常。仓库工具提供源码校验、宿主 locale 对账、构建、测试、增量打包和发行包校验入口。

MaaFrameworkDriver 的现役 managed 门禁覆盖 PI 编译、授权、导入与配置评估等可离线判定的驱动逻辑；TRX 保存到外部测试根的对应 run 目录，保留每次失败报告。原生 Win32／ADB controller、标准 Agent、pretask 和真实设备须另行人工验收。该插件的 package builder 必须包含独立 worker/runtimeconfig、binding 5.10.0 和 LGPL/GPL 许可。

在 Windows PowerShell 5.1 中，可以使用 `python -m json.tool <file>` 逐个检查 JSON；本机必须已经安装 Python。插件工具负责仓库级源码、构建、测试和发行包校验；插件有效性仍需要使用 NexusPipeline 的插件发现、脚本探测和真实运行流程验证。

建议至少覆盖：

- manifest 的 `name`、`kind`、版本和 data 引用；
- `resolve.json` 的每个 `require` 条件；
- 根目录、嵌套目录和 `searchUpward` 场景；
- 配置路径为文件与目录的场景；
- taskProtocol 配置诊断覆盖配置编辑和脚本保存后的只读评估、超时与错误反馈；
- 若声明 `configEditor`，覆盖 fresh/reuse、多文件或目录候选隔离、附加工作副本写入、错误回滚和进程启动门禁；
- judge 尚未完成、成功、失败、超时和异常输出；
- `replaceConfigs` 与 `config-restore.json` 的恢复结果。
- 插件版本升级后，历史专项实例在无需重新保存的情况下能解析到当前 profile；若变更 `configPath` 或文件/目录形态，必须验证新位置存在时按当前配置建立新快照、新位置缺失时阻断运行并保留旧快照，并在变更说明中标注配置影响。

## 配置诊断审查

`data-specialized` 插件使用 taskProtocol 的 `discover.configAssessment` 进行只读配置诊断。检查应覆盖当前绑定、缺失或异常资源、超时与错误分支；未知事实返回 unknown。旧 `configValidator` 已退役，Host v0.16.9 不运行该脚本，声明它的包需要升级或卸载。

配置编辑准备脚本使用同一受限 JavaScript 宿主，manifest 字段为 `configEditor`。候选配置选择由宿主写入用户绑定的 `configInputs`，脚本读取 `nexus.input.mode`、`configInputName`、`configInputValue` 和 `extras`；`@extra<序号>/` 对应编辑期间的附加工作副本，可写入并随保存或取消收尾。主配置根保持受限只读，脚本异常会阻断目标软件启动并触发现场回滚。

## 判断脚本审查

判断脚本会反复收到累计日志和当前文件清单。代码应满足：

- 输入不完整时无输出，保守等待；
- 结果 JSON 的 `status` 只能是 `success` 或 `failed`；
- `reason` 非空并适合展示给用户；
- 重复调用不会持续修改配置或重复生成不同的恢复状态；
- 选择性重试同时设计配置替换和最终恢复；
- stdout 不输出 Token、密码、完整配置或敏感日志。

Python judge 具备系统解释器权限，必须按受信任代码进行审查。详见 [JUDGE_SCRIPT.md](docs/author/JUDGE_SCRIPT.md)。

## 提交内容清单

Pull Request 应包含：

- 插件源码目录；
- 公开、可复现的 resolve 与 judge 说明；
- 插件版本变化及兼容宿主版本；
- 本地验证结果和已知兼容限制；
- 插件源码、manifest、store 和本地验证结果；发行包、catalog 与摘要由 main 发布工作流生成。

禁止提交：

- 用户配置、账号信息、Cookie、Token、密钥和个人路径；
- 运行日志、缓存、临时目录和开发机生成的无关文件；
- 手工修改的 `.release-state.json`、`catalog.json`、`packages/` 或与发行包内容不一致的 SHA256 / `sizeBytes`；
- 未经许可重新分发的第三方二进制或资源。

## 维护约定

插件行为变化时提高插件自身版本，并在 PR 中说明对已有脚本实例 profile、用户配置和判断脚本的影响。宿主 API 变化时同步检查 `minHostVersion`，避免插件索引允许安装到不支持所需契约的宿主版本。

专项任务三阶段协议、作者模板、生成脚本和真实 Host Jint 门禁见[专项任务协议](docs/author/TASK_PROTOCOL.md)。

测试政策登记清单是当前核心能力的事实来源；新增插件同时登记实际组件实例、场景和生产包义务，清单不固定为十三。本机批次、生产 PR 检查、测试 Host source 锁与完整时长规则见 [核心测试](docs/TESTING.md)。

仓库根目录的 `global.json` 固定 .NET 10 SDK 补丁带，允许同一带内的最新补丁。先在仓库内执行 `dotnet --version`，安装匹配的 SDK；只有其他主版本或特征带不满足此输入。生产与隔离 Test Host 继续使用 .NET 10。

专项编辑代码在 `adapters/config-editor/` 维护，运行 `python tools/repo.py generate editors` 后提交生成的八个 `data/editor.js`。不要手改 bundle；`--check` 与 source gate 校验一致性。修复不能进入 discover，诊断不能写配置。完整接口见 [配置编辑](docs/author/CONFIG_EDITOR.md)。

## 开工与完工治理

开工运行 `python tools/repo.py preflight --path <插件或工具目录> --keyword <主题>`；双仓任务显式加 `--host-root <Host路径>`，从该 Host 的现役治理入口读取 UI 注册表和公共 API。没有对端时该范围为 NOT_CHECKED，不能声称双仓契约通过。文档/测试域来自当前 `docs/map.json`，不维护第二份组件清单。

完工运行 `python tools/repo.py check governance --base <完整基线SHA> --working-tree --owner Tools Docs Tests --host-root <Host路径>`。Owner 使用报告中的名称，多个值一次传入；`Plugin/<artifactName>` 来自目录并经现役 manifest 校验，机器 ID 单独从 manifest 读取。报告可用 `--report <仓库外JSON路径>` 保存。纯治理任务加 `--governance-only`，明确拒绝插件、adapter、公开契约和锁输入变更；普通任务的版本授权仍由维护者判断。

此入口复用 runner 的 Git A/R/C、暂存、rename 和未跟踪解析。新增插件资源调用既有 source/manifest/script 边界验证；stable 产物沿用生产检查拒绝，合法 fixture/Schema/adapter 资源放行，未知角色和任务外 Owner 为 REVIEW。不限制文件数或 LOC，不追溯阻断历史目录。REVIEW 的退出码 0 只表示没有确定性拒绝，人工审核仍未完成。

`python tools/repo.py check docs` 同时检查指定前端指南声明及 manifest 示例与 `host.lock.json`；历史旧数字不扫描，模糊表述为 REVIEW，提取失败为 NOT_CHECKED 且非零。路径允许规范化后仍在仓库内的 `../CONTRIBUTING.md`，拒绝不存在或真正仓库外的目标。治理工具不替代 A06、ZIP 检查、生产 PR 检查或功能测试，也不更改发布 writer 权限。工具自测沿用 `python -m unittest discover -s tests/tooling -v`，将隔离输出定位到已登记的外部测试根。

当前公开契约为 Plugin API 2.2 / Frontend API 1.7；managed 包和前端须与该 Host 源输入同时构建。GameActivities 的真实来源缺口见其 README，打包成功不等于来源验收通过。
