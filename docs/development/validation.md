# 定向验证

本页维护产品假设、执行层和实际命令。共同流程归 [CONTRIBUTING](../../CONTRIBUTING.md)，SDK/构建命令归[构建指南](building.md)。选定代码、必要断言与文档完成后，执行合并的最低有效验证。

## 四类职责，允许复用同一次执行

| 职责 | 回答的问题 | 适用范围 |
|---|---|---|
| lint | 文本、语法、命名、依赖边界和生成一致性是否满足现役规则 | 改动文件与直接依赖；规则检查不计入产品测试数 |
| typecheck | .NET/TS 声明和真实公共消费者是否一致 | 受影响工程/模块；C# 与 build 可共享编译 |
| test | 被选产品假设是否成立 | 有明确输入、操作、可观察结果的最小场景 |
| build | 是否形成该任务需要交付的完整插件/客户端产物 | 受影响 slice/包；不是默认重建全部 14 个插件 |

现役构建入口组合执行多种职责。`build_frontend.mjs` 同时执行命名、tsc 与 bundle，统一计划调用一次，并把结果分别归类。managed build 同时产生类型诊断与程序集，不能为“四部分”再编译一次。

CLI 参数以现役解析器为准，构建与产品行为测试分别记录。

## 在执行前合并范围

只维护一张短表，字段为：假设、实际受影响 owner、选中入口/场景、必要输入、输出和不能证明的范围。相同构建、相同 SDK 生产者、相同 case 只执行一次。

| 本轮变化 | 最低验证 | 只有什么事实才扩大 |
|---|---|---|
| 文档调整 | 链接/路径/命令与当前源码核对 | 文档揭示代码契约确实不一致 |
| OkNTE 参数 | 固定任务消费者＋该发现向量 | 改动了共享发现或公共协议 |
| BAAH glob/修复 | 发现→文件流→观察器；Host repair 正例与陈旧候选负例 | 确实改变其他 adapter 的修复规则 |
| 活动刷新并发 | 慢/快源可重叠，旧 generation 不发布，上界不超承诺 | 共用网络/调度 owner 被修改 |
| 签到前端/登录 | 选中编辑场景＋一个实际失败阶段；取消/迟到不写错草稿 | 共用捕获规则影响其他具体平台 |
| 壁纸集合与设置导航 | 展开/重选/切类流程、即时保存与未知结果核对 | 公共控件行为被改动并存在其他消费者 |
| SDK 公开契约 | 实际最小消费者、受影响插件类型检查和必要包闭包 | 破坏了多个明确公共消费者 |

没有现役方法级选择器时，不能假造 `--method` 或 `--filter`。在测试精简任务已纳入本批时，可给现役 runner 加最小明确筛选；否则选择当前最小插件切片一次，并如实记录范围。不为缩小一次验证建立新的测试框架。

## 当前命令与限制

命令中的绝对路径由本机实际工作区提供。输出和依赖放仓外，报告根使用本次新目录，保留原失败记录。

### 前端单模块

```text
node tooling/build_frontend.mjs --sdk-root <Host根> --work-root <依赖根> --output <bundle根> --extension custom-wallpaper
node tests/frontend/fixture.mjs --host-root <同源Host根> --work-root <含playwright-core的依赖根> --bundles <bundle根> --report <报告根> --browser <浏览器exe绝对路径> --extension custom-wallpaper --scenario "wallpaper settings and appearance"
```

`--extension` 可重复选择已知受影响模块。基线不接受 `--shared true`；省略选择会扩大到五个模块。有旧回执时共享输入变化也可能扩大，核对并记录工具输出的 `selectedExtensions`。

fixture 场景必须是现役完整名称；`all` 只在所有该插件场景都与改动有关时使用。受控 ports 不代表真实 Host 安装或真实登录通过。

### 专项组件

MaaEnd、MaaS 与直驱的观察子集协议共用 `adapter-runtime/core/observation-selection.js`；共享向量可执行 `node tests/specialized/observation-selection.mjs <Plugins根> <新仓外报告根>`，同时核验三条实际装配脚本。各插件原有 component 入口继续验证完整观察消费链。

只需要 JS 业务向量时：

```text
node tests/specialized/component.mjs <Plugins绝对根> oknte <新的仓外报告根>
```

该入口按插件选择，不支持 case 参数。回执分别记录装配、向量准备和 Node 行为。准备失败时 Node test 为 `NOT_RUN`，Jint 入口也不执行探针编译或 Jint 行为。Jint 回执分开记录探针编译、输入准备与逐案结果，缺少有效回执时 Jint test 为 `NOT_RUN`。若计划已选择实际 Host/Jint 入口，直接运行下列命令，由它执行 Node 向量：

```text
python -B tests/specialized/verify.py --extension oknte --host-root <Host根> --jint-assembly <实际Jint.dll> --acornima-assembly <实际Acornima.dll> --output <报告根> --work-root <仓外编译根>
```

通用 `verify.py` 的基线 choices 不含 BetterGI。BetterGI 的真实入口是：

```text
python -B tests/specialized/bettergi/native_verify.py --host-root <Host根> --jint-assembly <实际Jint.dll> --acornima-assembly <实际Acornima.dll> --output <新的仓外报告根>
```

它内部调用 `verify.mjs`。共享来源发现使用 `node tests/specialized/source-discovery.mjs <新的仓外报告根>`，按八个专项执行目录、候选、资源和启动参数用例。回执分别记录 adapter 装配准备和行为结果。

诊断翻译用 `node tests/specialized/diagnostic-locales.mjs <Plugins绝对根> <新的仓外报告根>`。它按插件装配一次 adapter，并核对配置和发现实际返回的诊断码是否具备中英文文案。回执分别记录夹具准备与 `test`。准备失败时测试记为 `NOT_RUN`。翻译验证通过后校验源输入。若输入变化，回执整体失败，`inputsUnchanged` 为 `false`，`test` 保留实际结果。

### managed 业务与 SDK

例如修改活动服务时，当前最小现役组件入口为：

```text
python -B tests/game-activities/verify.py --sdk-receipt <同源SDK消费者回执> --cache <仓外缓存根> --output <报告根>
```

签到的纯策略入口为 `tests/game-checkin/verify.py --output <报告根> --cache <缓存根>`。加 `--sdk-receipt <回执>` 选择 SDK 适配用例，同时指定 `--package-receipt <回执>` 时仅运行原包入口用例。三种模式独立记录编译准备与行为测试，SDK 和原包模式在执行前核对 SDK 程序集字节。

构建/打包见[构建指南](building.md)。只需文档或受控算法证明时，不自动准备真实厂商或完整候选安装。

SDK 输入按真实资格选择：现役 Host `--compile-only` 仍构建独立 consumer，并可产生供 Plugins 导入的真实PASS回执；它不执行runtimeConsumers/lifecycle，这两项必须保持NOT_RUN。只为编译/打包不增加运行消费者，只有所选产品假设确需运行边界才增加相应场景。不能手写PASS或将现有导入条件额外收紧成全部runtime必须通过。详见[SDK 输入](building.md#sdk-输入)。

## 只保留产品假设测试

保留能证明结果、数据、权限、外部效果、恢复或承诺容量的断言。纯函数测试可以证明真实逻辑；合同和 tooling 测试也可能保护产物完整性，不能按目录一刀切删除。

删除/改写：内部写入精确次数、同一连接/对象/DOM 身份、索引名字、私有 CSS 结构、固定 job 名称、测试方法数量对账、自己序列化自己再判相等。外部请求不得重复提交、并发不超上界和停止后零新副作用则是产品要求，可以计数。

同一文件有有价值断言时只裁掉实现约束。预期来自批准的行为和固定上游，不由被测实现动态生成。只为本批已选假设补反例，不建立穷举所有未来异常的矩阵。

## 失败、重试和完成

失败先区分产品行为、工具/环境和无效 oracle。只修直接原因，复跑失败项与直接依赖；无条件重试到绿、换更宽命令掩盖失败或跑全仓“求安心”均不成立。

记录：本次真实源码身份、选中场景、命令、退出码、关键结果、必要环境、未运行项。未提交候选记 `local-uncommitted`，commit/tree 为 null；参考 SHA 单独保存。没有实际 Windows/厂商/浏览器条件就记 NOT_RUN，不冒充成功，不自动扩大任务去安装无关软件。

当选定产品假设已有最低有效证据、需要的产物已形成、文档同步，停止可选验证并交付。实际产品执行与正式发布属于不同操作，构建通过不自动触发远端发布。

源码快照包括仓内docs。业务说明尽量在编码阶段定稿，真实验证结果默认写仓外；验证后纯文档修订单列docs-only delta，并分别保留产物冻结输入与当前工作树身份。不要为了更新一行PASS默认重跑产品，也不把旧回执冒充新全树。只有交付确需含新文档的产物时，补必要的产物准备和文档检查。

## SDK 消费者与命名职责

CI 选择规则归本仓 `tooling/ci_plan.py` 的 `plugin_scope`，测试调用本仓实际模块；Host 只维护自己的 `host_scope`。本仓入口拒绝 Host 角色，发布包与 catalog/state 仍受原 Publisher 边界保护。

五个公共发行/路径工具由 Host 的 `tooling/sync_shared_tooling.py --plugins-root <本仓根>` 生成。`tooling/shared-tooling.json` 登记固定来源提交和逐文件摘要；本仓运行 `python -B tooling/check_shared_tooling.py` 独立校验。CI 与发行装配入口先校验镜像，跨仓一致性由 Host 同步命令的 `--check` 模式检查。

SDK 独立消费者只编译真实公开类型及调用，归 typecheck；不执行自造 DTO 往返或反射方法存在性断言。SDK 默认打包入口另执行前端生命周期行为测试；`--compile-only` 跳过该行为测试。回执的 `runtimeConsumers` 固定为 NOT_RUN，`lifecycle` 按实际执行记录，`validationMode` 为 compile-only 或 lifecycle。包内容、来源与消费者使用的实际 SDK 身份继续核验。

命名检查归 lint，规则与逐项例外见[Host 命名规范](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/development/naming.md)。
