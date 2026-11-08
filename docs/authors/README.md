# 插件作者入门：先完成代码，再统一定向验证

本仓包含六个 managed 插件、八个数据专项和五份浏览器模块。优先恢复 main 已确认的产品行为，保留 next 的 SDK 边界、目录、代码风格、资源所有权和错误模型。不要把修复变成第三次重写。

先读[本轮行为对齐表](../developer/behavior-targets.md)，按任务卡选择实际涉及的 owner；[统一验证](../developer/validation.md)是所有作者路径共用的执行规则。

## 选择最小改动路径

| 改动 | 从哪里开始 | 通常不需要 |
|---|---|---|
| 修改专项程序参数、配置发现或日志声明 | `plugins/specialized/<id>/adapter/discovery.js` 与 `sources.json` | managed 程序集、新 SDK、Maa worker |
| 修改专项任务/配置/日志/重试规则 | 当前插件 adapter 与该上游固定资料 | 复制其他游戏实现、通用兼容框架 |
| 修改一个通用插件的业务 | `plugins/managed/<id>/src/Domain`、`Application`、`Host` 中实际 owner | Host 私有类型、新服务定位器 |
| 修改一个插件页面 | 当前 `frontend/src` 与公开 SDK/UI | 读取 Host 私有 DOM、重做全站组件 |
| 修改共享 UI 行为 | `plugins/managed/frontend-ui` 和实际消费该行为的模块 | 一次性迁移无关界面 |
| 修改产物缺项或安装接线 | manifest、既有 build/package 工具 | 重新实现签名、ZIP 或发行系统 |

专项[作者指南](specialized-adapters.md)与 managed [作者指南](managed-extensions.md)分别说明其边界。MaaEnd/MaaS 专项与通用 Maa 直驱是不同路径，不能因名字相同就要求前者附带 worker 或原生库。

## 本地输入与工具

读当前源码的工具定义后再执行。审查基线 CI 使用 Python 3.13、Node 24，.NET 版本读取配套 Host 的 `global.json`；Plugins 自身没有另一个 `global.json`。本地只准备选中任务需要的工具，修改文档不安装完整原生环境。

两个源码根、依赖工作区、构建输出、测试 fixture 和用户真实数据应分开。下面使用的 `<...>` 都是需要替换的绝对路径或实际回执，不是有效默认值。不要使用用户真实运行目录作 fixture。

SDK 由 Host 的真实公共 SDK 构建产生，Plugins 消费明确回执；`contracts/sdk-source-lock.json` 绑定来源和摘要。不能手改镜像 DTO 或指纹来消除不匹配。

## 一次开发批次

1. **定范围。** 记录选中任务、旧版行为依据、允许修改路径、必要产品假设和输出；把重复验证合并到同一计划。
2. **完成代码。** 顺序处理有依赖的生产修改、相应产品假设测试代码和文档；完成前不逐卡执行 lint/typecheck/test/build。
3. **统一准备输入并验证。** 手写代码和契约已完成后，按依赖产生一次 Host SDK/产物，导入镜像，再运行去重后的定向验证。无需 SDK 变化时复用有效同源输入，避免无故重建。
4. **局部修复与交付。** 失败只回到直接责任代码；再次验证该失败及其直接消费者。记录实际运行、未运行和遗留，不扩成全仓回归。

SDK 改动只有任务卡列出真实消费者与必要缺口才进入范围。它的构建/消费者输入依赖在统一验证阶段顺序完成，不能用此依赖为理由提前跑所有插件测试。生成的镜像同步后记录最终源码身份；手写修改导致假设变化时再做局部修正。

## 实际构建入口

以下为现役命令形状，**只在本批代码完成后**按验证计划选用，不是开工时必须逐条执行的列表。

导入已经形成的同源 Host SDK 与独立 consumer 编译回执。现役 `sdk-packages --compile-only` 的真实产物可用于这一步；回执虽为 `status=PASS`，其 `runtimeConsumers` 和 `lifecycle` 仍是 `NOT_RUN`。只编译/打包不需要额外运行全部消费者；选中 SDK 运行或生命周期假设时才补相应证据，来源、摘要和镜像校验仍必须满足。

```text
python -B tooling/import_sdk.py --receipt <HostSDK消费者回执>
```

构建一个 managed 或一个专项，两条路径按修改对象选择：

```text
python -B tooling/build_managed_slice.py --extension live-screenshot --sdk-receipt <同一回执> --output <仓外managed根>
python -B tooling/build_specialized_slice.py --extension baah --sdk-receipt <同一回执> --output <仓外specialized根>
```

只构建一个受影响的前端模块：

```text
node tooling/build_frontend.mjs --sdk-root <同源Host根> --work-root <仓外依赖根> --output <仓外bundle根> --extension live-screenshot
```

需要交付插件包时使用实际构建输出中打印的 receipt 路径，不猜测固定时间戳目录：

```text
python -B tooling/package_extension.py --build-receipt <构建回执> --sdk-receipt <同一回执> --frontend-receipt <bundle根/build-receipt.json> --output <仓外包根>
```

数据专项和没有前端的 `emulator-support` 不传 `--frontend-receipt`。Maa 直驱另外需要匹配 `runtime.release.json` 的实际 `--runtime-receipt`，只在该插件产物属于交付范围时准备。不能为避免准备成本伪造回执或丢弃原生闭包。

## 验证只证明它实际覆盖的层

Node adapter 组件、Host/Jint 解释器、浏览器受控 ports、真实 ZIP 安装、真实上游运行是不同层。根据被修改的假设选择最低有效层，不能每次从头到尾全跑。若一个公开边界必须跨 Host 与 Plugins 才可证明，则只验证这一条消费链。

合成 fixture 通过不代表真实账号已登录；包验证通过不代表已经正式发行。文档中不追加没有运行证据的 PASS，也不把历史报告数量抄成本轮结果。

## 代码和文档的同步

修改用户可见行为时更新相应用户页的一处步骤或失败处理；修改公开契约时更新权威 schema/SDK 与消费说明；修改任务状态时更新[行为对齐表](../developer/behavior-targets.md)。不在 README、多个项目页和状态页同时追加同一段历史记录。

命令依据：[构建 managed](../../tooling/build_managed_slice.py)、[构建专项](../../tooling/build_specialized_slice.py)、[前端入口](../../tooling/build_frontend.mjs)、[打包](../../tooling/package_extension.py)、[CI 工具版本](../../.github/workflows/ci.yml)。

编译回执语义依据：[Host SDK producer](https://github.com/FlappiBakuse/NexusPipeline/blob/0bb4d144d92805a2d489c65d0be3b7527c7810fd/tooling/sdk_packages.py#L125-L149)、[Plugins 导入条件](../../tooling/import_sdk.py)。

## 多语言词条

各插件在 `locale.ts` 的 `locales` 常量中维护包元数据、任务和诊断词条，使用显式对象字面量，与宿主的 TS 词条组织方式一致。前端界面词条继续由各前端的 TS 模块维护。
`tooling/localization.py` 严格读取该常量并校验重复键、语言声明、字段和长度边界；构建与打包从固定源码生成 manifest 声明的 JSON 资源，不手工维护生成资源。包内语言路径与运行时读取协议保持稳定。
