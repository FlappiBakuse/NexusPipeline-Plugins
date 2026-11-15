# 架构与职责边界

本仓通过公开 SDK 为 Host 提供 managed 服务、数据专项和浏览器模块。插件拥有上游/平台业务语义，Host 拥有实例、权限、配置恢复与受控副作用。

## 从用户动作到效果

| 责任 | 当前入口 | 保持的边界 |
|---|---|---|
| 用户选择和草稿 | 插件 `frontend/src`、Host 公开 surface | 类型化意图；隐藏/取消与晚到结果属于当前表面 |
| 插件业务 | `Domain`、`Application` 或受限 adapter | 解释本插件规则，返回明确提案/结果 |
| SDK 适配 | managed `Host` 层、生产 `createFrontend` | 只用公开契约，转换插件领域数据 |
| Host 用例与所有权 | 配套 Host 的配置、执行、调度、秘密、媒体等 owner | 实例、writer、事务、权限与恢复事实保持单一来源 |
| 上游或外部平台 | manifest 已声明的入口与能力 | 准确选择程序、账号、资源、来源与有限副作用 |

managed 注册的能力不是无限授权；调用时仍使用现役 Host scope。数据专项不含 .NET、浏览器或原生运行时，也不自行执行进程和文件操作。

## 从加载约定定位

| 入口或事实源 | 代码位置 | 搜索与验证范围 |
|---|---|---|
| managed 注册 | 各插件 `extension.json` 的 `managed.entryType` → `src/*Extension.cs` 或 `src/Host/*Extension.cs` | Host 反射构造；沿公开 SDK 接口查实际能力消费者 |
| 浏览器注册 | 各 `frontend/src/index.ts` 的 `createFrontend` | Host 动态导入；`activate`、`mount`、`dispose` 由外部生命周期调用 |
| 专项 adapter | `adapter/sources.json` → [generate_adapter.py](../../tooling/generate_adapter.py) | 有序拼接共享 JS 和插件 JS；跨文件函数通过最终脚本可达 |
| 本地化资源 | 各插件 `locale.ts` → [localization.py](../../tooling/localization.py) | AST 读取常量并生成 manifest 声明的 JSON，无需 TS import |
| 编译与发行选择 | [build_inputs.py](../../tooling/build_inputs.py)、[build-policy.json](../../tooling/build-policy.json) | 构建声明拥有插件类型、前端、原生输入及预装选择 |
| 测试消费者 | `tests/consumers`、`tests/host-fixtures`、各领域 `tests/<id>` | SDK 编译、Host 显式输入、Node/Jint 与原生行为分别定位 |

`adapter-runtime` 的声明须放回每个实际 `sources.json` 消费闭包检查；C# 扩展方法按符号绑定查调用。公共插件程序集类型、SDK 接口实现和原生回调保留外部调用边界。

## 共享代码的成立条件

已有两个或以上实际消费者，且它们共享同一业务不变量时，才提取共同逻辑。纯协议归 `adapter-runtime/core`；外部框架真实共同语义归 `adapter-runtime/frameworks`；插件前端共同行为归 `plugins/managed/frontend-ui`。

共享层不反向导入具体插件。不同上游的任务编号、日志闭环和重试能力保持独立；OkNTE 与 OkWW 的 `-t` 不同就是明确反例。新增共享层须有当前消费者和同一不变量。

## 数据与秘密

文档/CAS 是普通状态的事实 owner，Secrets/SecretDocuments 是受保护值的 owner，运行结果与任务配置分别保存。读取或解析失败不能产生空白可写状态。未知格式保留原字节并给明确结果，不自动降级旧协议。

编辑数据与即时设置使用各自的命令 owner，生命周期见[前端](../development/frontend.md#状态与拥有期)。普通字段、受保护输入、披露授权和登录会话分别管理；keep/set/clear 明确区分，日志、浏览器存储和普通文档不携带秘密明文。

上游已有且明确支持的旧保存格式不等同 Nexus main 协议。对外部格式兼容的保留或删除由支持矩阵与真实消费者决定，不凭名字含 legacy/fallback 判断。

## 配置、运行与恢复

插件提出配置修改；Host 核对资源、revision、SHA、expected 值与操作身份。准备工作副本、停止 writer、收集进度、恢复原现场和发布结果都由现有 Host 生命周期协调。

普通重试的配置进度由 Host 接续；专项重试保持冻结选择和已知安全范围。外部提交未知、partial 或不能证明幂等的动作不得因恢复旧界面而重新自动执行。故障诊断必须有消费者，不能只保存在没人读取的字段里。

## 公共 SDK 的唯一来源

Host schema、实际 .NET/前端公共 API 和 UI 元数据是公开契约事实源。Plugins 的 `contracts/` 是经 `import_sdk.py` 导入的镜像。产品版本、SDK 版本、格式 version 和指纹分别管理，构建来源见[SDK 输入](../development/building.md#sdk-输入)。

构建和验证使用同一明确来源，仓外保存依赖、输入、输出与报告。未提交候选记录 `local-uncommitted`，不把审查参考 SHA 冒充候选提交。

## 签到结果与 Maa 冻结导入

GameCheckIn 的结果文案和聚合规则归入 Domain，与运行结果数据放在一起，供运行回读、通知摘要和 Application 的效果门禁共用。受理、提交和确认仍由 Application 及其 SDK 适配负责。

Maa 的 `MaaProjectImport` 及它调用的 MFA、CFA 解析器属于 Domain 的冻结输入编译。它们通过 `MaaSourceSet` 解释已捕获的字节和明确选择的实例。Application 继续负责发现、捕获资源和组织运行，编译探针通过现有 Domain 源码范围消费导入器。

| 验收 | 可观察结果 |
|---|---|
| 依赖边界 | 签到运行回读及摘要从 Domain 取得结果规则。Maa 的导入分派及其四种保存格式的解析均在冻结编译职责内，编译探针移除已迁移导入器的 Application 链接。 |
| 签到结果 | 运行状态核对、结果未知优先和通知摘要沿用现有行为。用纯策略探针及同源签到原包的受控投递场景验证。 |
| Maa 编译 | MXU、MaaPiCli、MFA 与 CFA 保留明确实例选择、任务顺序、来源证据、预编译输出及篡改拒绝。用现役冻结编译探针及同源 SDK 编译验证。 |

## 插件资源与启动准备

Host 安装证明随 activation 拥有期复用；壁纸、活动和签到前端按状态事件与可见性同步。
前端以已有事件订阅和可见性驱动同步，首次显示及重连读取当前状态，隐藏或卸载取消在途请求与订阅。
稳定 revision 不重复发布；签到的状态版本随可观察事实变化，时间显示在本地推进。
活动初始化先读取设置，仅加载选中 feed；未选 feed 在选中时加载，已有未到期缓存的后台 tick 保留。

定向验收使用实际生产模块及选定的原包消费者：无变化时状态请求归零，变更和重连及时同步；
活动零/一/全部选择、签到空列表与运行状态、壁纸关闭/轮播/隐藏覆盖，授权、取消及晚到结果继续绑定当前拥有者。
Host 原生跟踪分别计量文档与安装证明；重复 read-state 不重读安装 journal/plan，卸载及禁用释放长期证明。
实时截图和专项资源发现按各自生命周期及实际消费关系验证。

概览贡献的标题、说明、布局键、默认显示和顺序由插件声明。静态图标属于各插件资源，数据型插件也可通过 manifest 的 `icon` 声明显示图片。Host 消费注册结果和元数据，不维护专项图标表或插件加载优先级。

前端 `activate` 等待自身默认只读数据和本地图片准备；`mount` 等待首轮可用渲染。活动插件使用总览快照和已缓存封面，详情在打开时读取；签到和壁纸复用激活准备结果。缺失外部图片保持占位，隐藏页面停用轮询和交互。Host 统一提供 30 秒预算、取消、失败展示与手动重试。

模拟器插件通过 provider 声明厂商发现、枚举、实例目录及启动/退出命令；Host 保留权限、工具身份和执行证据。MuMu 保持 Host 所有权。预装选择及 Maa 原生输入由 `tooling/build-policy.json`、`tooling/build_inputs.py` 管理；专项协议与厂商 fixture 位于 `tests/host-fixtures`。

SDK 的 vendor 使用插件声明的字符串标识。EmulatorSupport 自己维护三个厂商标识及目标证据编码，保持已有安装与目标选择身份。Host 的安装集成使用 `tests/host-fixtures/storage/emulator-inventory.json` 提供的厂商配置与输出，不在宿主 fixture 内维护厂商规则。
