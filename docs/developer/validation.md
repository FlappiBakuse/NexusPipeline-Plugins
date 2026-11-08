# 统一定向验证：代码完成后只证明选定假设

**本轮执行顺序固定为：选定任务与最小计划 → 完成该批全部生产代码、必要测试代码和文档 → 去重执行一次定向验证 → 只修复失败及直接影响 → 交付。** 不采用每张任务卡写一点就跑一遍整套验证的方式。

本页提供当前可用入口和范围判断，不是一张必须全部执行的命令清单。用户要求的“最小实现、最小验证”优先于旧文档中的固定方法数量、固定 smoke 数量或逐层全覆盖惯例；保留代码风格和真正的产品边界。

## 1. 代码阶段能做什么

阅读源码、查看 Git 差异、核对固定上游资料、编写实现和产品假设用例、审阅调用链、微调相应文档。不要为建立一个红色基线提前运行 tests，也不要反复执行编译、lint、typecheck、全仓检查或全量打包。

缺少一份源码或真实输入事实时，先补最小只读证据。白屏等运行态问题在代码阶段准备必要诊断，在统一验证阶段采证；采证结果再触发局部 delta，不凭猜测扩大兼容路径。

代码完成门只要求选中任务的实现闭合、跨仓接口意图一致、测试源和文档已就绪，未选任务明确列出。它不是“测试已经通过”。

## 2. 四类职责，允许复用同一次执行

| 职责 | 回答的问题 | 适用范围 |
|---|---|---|
| lint | 文本、语法、命名、依赖边界和生成一致性是否满足现役规则 | 改动文件与直接依赖；规则检查不计入产品测试数 |
| typecheck | .NET/TS 声明和真实公共消费者是否一致 | 受影响工程/模块；C# 与 build 可共享编译 |
| test | 被选产品假设是否成立 | 有明确输入、操作、可观察结果的最小场景 |
| build | 是否形成该任务需要交付的完整插件/客户端产物 | 受影响 slice/包；不是默认重建全部 14 个插件 |

基线工具仍混合职责。`build_frontend.mjs` 同时执行命名、tsc 与 bundle，统一计划调用一次，并把结果分别归类。managed build 同时产生类型诊断与程序集，不能为“四部分”再编译一次。

独立 lint/typecheck 入口若属于本批工具任务，待实现后再写入实际命令。没有实现前，不给 `nexus.py lint`、`--typecheck-only` 等不存在的入口。CI 的编译/打包通过不代表产品 test 已执行。

## 3. 在执行前合并范围

只维护一张短表，字段为：假设、实际受影响 owner、选中入口/场景、必要输入、输出和不能证明的范围。相同构建、相同 SDK 生产者、相同 case 只执行一次。

| 本轮变化 | 最低验证 | 只有什么事实才扩大 |
|---|---|---|
| 文档调整 | 链接/路径/命令与当前源码核对 | 文档揭示代码契约确实不一致 |
| OkNTE 参数 | 固定任务消费者＋该发现向量 | 改动了共享发现或公共协议 |
| BAAH glob/修复 | 发现→文件流→观察器；Host repair 正例与陈旧候选负例 | 确实改变其他 adapter 的修复规则 |
| 活动刷新并发 | 慢/快源可重叠，旧 generation 不发布，上界不超承诺 | 共用网络/调度 owner 被修改 |
| 签到前端/登录 | 选中编辑场景＋一个实际失败阶段；取消/迟到不写错草稿 | 共用捕获规则影响其他具体平台 |
| 壁纸集合与设置导航 | 一个展开/重选/切类流程，普通草稿保留 | 公共控件行为被改动并存在其他消费者 |
| SDK 公开契约 | 实际最小消费者、受影响插件类型检查和必要包闭包 | 破坏了多个明确公共消费者 |

没有现役方法级选择器时，不能假造 `--method` 或 `--filter`。在测试精简任务已纳入本批时，可给现役 runner 加最小明确筛选；否则选择当前最小插件切片一次，并如实记录范围。不为缩小一次验证建立新的测试框架。

## 4. 当前命令与限制

命令中的绝对路径由本机实际工作区提供。输出和依赖放仓外，报告根使用本次新目录，保留原失败记录。

### 前端单模块

```text
node tooling/build_frontend.mjs --sdk-root <Host根> --work-root <依赖根> --output <bundle根> --extension custom-wallpaper
node tests/frontend/fixture.mjs --host-root <同源Host根> --work-root <含playwright-core的依赖根> --bundles <bundle根> --report <报告根> --browser <浏览器exe绝对路径> --extension custom-wallpaper --scenario "wallpaper settings and appearance"
```

`--extension` 可重复选择已知受影响模块。基线不接受 `--shared true`；省略选择会扩大到五个模块。有旧回执时共享输入变化也可能扩大，核对并记录工具输出的 `selectedExtensions`。

fixture 场景必须是现役完整名称；`all` 只在所有该插件场景都与改动有关时使用。受控 ports 不代表真实 Host 安装或真实登录通过。

### 专项组件

只需要 JS 业务向量时：

```text
node tests/specialized/component.mjs <Plugins绝对根> oknte <新的仓外报告根>
```

该入口按插件选择，不支持 case 参数。若计划已经选择实际 Host/Jint 入口，则不要先单独运行上述命令，因为后者会在内部执行 Node 向量：

```text
python -B tests/specialized/verify.py --extension oknte --host-root <Host根> --jint-assembly <实际Jint.dll> --acornima-assembly <实际Acornima.dll> --output <报告根> --work-root <仓外编译根>
```

通用 `verify.py` 的基线 choices 不含 BetterGI。BetterGI 的真实入口是：

```text
python -B tests/specialized/bettergi/native_verify.py --host-root <Host根> --jint-assembly <实际Jint.dll> --acornima-assembly <实际Acornima.dll> --output <新的仓外报告根>
```

它内部调用 `verify.mjs`；不存在 `tests/specialized/bettergi/verify.py`。共享发现脚本 `tests/specialized/source-discovery.mjs` 在基线没有 case 选择器，并存在已知陈旧期望；只有本批已修复其相关 oracle/选择后，才把相应行为列入计划，不将“它原来全绿”作为新预期。

### managed 业务与 SDK

例如修改活动服务时，当前最小现役组件入口为：

```text
python -B tests/game-activities/verify.py --sdk-receipt <同源SDK消费者回执> --cache <仓外缓存根> --output <报告根>
```

签到的纯策略入口为 `tests/game-checkin/verify.py --output <报告根> --cache <缓存根>`；确需 SDK 适配时加 `--sdk-receipt <回执>`，确需原包程序集消费时再加实际 `--package-receipt <回执>`。这些入口基线没有方法级筛选；纯策略、SDK、原包是按缺口升级的选择，不要求每次三层重跑。

构建/打包见[作者入口](../authors/README.md#实际构建入口)。只需文档或受控算法证明时，不自动准备真实厂商或完整候选安装。

SDK 输入按真实资格选择：现役 Host `--compile-only` 仍构建独立 consumer，并可产生供 Plugins 导入的真实PASS回执；它不执行runtimeConsumers/lifecycle，这两项必须保持NOT_RUN。只为编译/打包不增加运行消费者，只有所选产品假设确需运行边界才增加相应场景。不能手写PASS或将现有导入条件额外收紧成全部runtime必须通过。详见[作者入口的依据](../authors/README.md#实际构建入口)。

## 5. 只保留产品假设测试

保留能证明结果、数据、权限、外部效果、恢复或承诺容量的断言。纯函数测试可以证明真实逻辑；合同和 tooling 测试也可能保护产物完整性，不能按目录一刀切删除。

删除/改写：内部写入精确次数、同一连接/对象/DOM 身份、索引名字、私有 CSS 结构、固定 job 名称、测试方法数量对账、自己序列化自己再判相等。外部请求不得重复提交、并发不超上界和停止后零新副作用则是产品要求，可以计数。

同一文件有有价值断言时只裁掉实现约束。预期来自批准的行为和固定上游，不由被测实现动态生成。只为本批已选假设补反例，不建立穷举所有未来异常的矩阵。

## 6. 失败、重试和完成

失败先区分产品行为、工具/环境和无效 oracle。只修直接原因，复跑失败项与直接依赖；无条件重试到绿、换更宽命令掩盖失败或跑全仓“求安心”均不成立。

记录：本次真实源码身份、选中场景、命令、退出码、关键结果、必要环境、未运行项。未提交候选记 `local-uncommitted`，commit/tree 为 null；参考 SHA 单独保存。没有实际 Windows/厂商/浏览器条件就记 NOT_RUN，不冒充成功，不自动扩大任务去安装无关软件。

当选定产品假设已有最低有效证据、需要的产物已形成、文档同步，停止可选验证并交付。实际产品执行与正式发布属于不同操作，构建通过不自动触发远端发布。

源码快照包括仓内docs。业务说明尽量在编码阶段定稿，真实验证结果默认写仓外；验证后纯文档修订单列docs-only delta，并分别保留产物冻结输入与当前工作树身份。不要为了更新一行PASS默认重跑产品，也不把旧回执冒充新全树。只有交付确需含新文档的产物时，补必要的产物准备和文档检查。
