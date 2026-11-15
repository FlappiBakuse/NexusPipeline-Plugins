# 插件 PR 检查与发行来源

`Plugins / 打包检查` 是 main PR 的固定单 job 检查，十分钟、contents:read，不运行项目测试。
完整 PR 差异绑定 base/head/checkout。文档及纯本机测试变化不构建产品；
单插件变化只打包该插件，shared frontend 覆盖五个真实消费者，adapter-runtime 覆盖专项及 MaaFramework，
未知共享生产输入扩大到全部现役插件。插件随包 README 的变化仍属于该插件输入。

```text
python -B tooling/ci_check.py plan --base <完整baseSHA> --head <完整headSHA> --checkout <实际checkoutSHA> --report <仓外plan.json>
python -B tooling/ci_check.py run --plan <plan.json> --partner-root <固定Host checkout> --output <新仓外目录>
```

需要产品输入时，一次固定官方 Host develop 完整 SHA。SDK 仅构建 Extensibility、Boundaries 及真实传递闭包，
单插件不会因此构建无关 Host/Web。SDK 打包使用 `--compile-only`，运行消费者及 lifecycle 在回执中标 NOT_RUN。
独立消费者编译后，在仓外隔离的插件 checkout 导入生成合同，调用现役 managed/specialized、前端及 ZIP 打包器；
原始两仓 checkout 保持干净。
MaaFramework 仅使用其仓内固定官方原生依赖，经原生产打包器再次核对原包、清单及逐文件字节。
该二进制输入准备不表示真实 Maa 执行通过，也不改变纯数据专项的包边界。

`metadata/catalog/stable.json`、根 `catalog.json`、`metadata/releases/stable-state.json` 与 `packages/` 保留原 Publisher 写入边界；
PR 修改这些生成路径时拒绝运行生产打包。发行游标、历史包及不可变命名不由 PR 检查重写。

未提交源码可准备离线范围与原字节导出：

```text
python -B tooling/ci_check.py plan --local --partner-root <Host源码根> --report <新仓外plan.json>
python -B tooling/source_snapshot.py --output <仓外源码导出根>
```

离线计划为 local-plan-only，不能执行为受保护的 PR 检查。默认源码导出保持 local-uncommitted、null commit/tree。
显式干净 Git 导出使用：

```text
python -B tooling/source_snapshot.py --git-commit <完整HEAD SHA> --output <新仓外源码导出根>
```

该入口检查实际 HEAD、tracked/untracked 清洁状态、完整 Git tree 成员及全部原始 blob 字节，
拒绝链接、子模块和检出换行转换，结束前复核来源。成功才记录 git-commit 与真实 commit/tree。
Windows 文件清单沿用常规文件模式 100644，Git tree 身份独立保存实际 Git 模式。
环境变量、run ID 和任意 SHA 参数不授予正式发行资格；PR 报告始终 publishable=false。

stable/preview 累计发行范围由已发布 `metadata/releases/stable-state.json` 的 sourceCommit 推导。
分发输入使用固定 Git 提交内的 canonical catalog、根投影及 state；发行规划复用已发布包事实与 Git 路径。
源码身份沿现役完整原字节校验执行，发行 metadata 不重新计算未变更包的摘要。
源码目录切换按 artifactName 与 extensionId 识别，保留原 artifactName 大小写。

```text
python -B tooling/plugin_release_plan.py --source-root <插件源码根> --source-commit <干净完整SHA> --distribution-root <分发Git根> --distribution-commit <完整分发SHA> --channel stable --output <新仓外目录>
```

省略 source-commit 时记录 local-uncommitted、null commit/tree。输出须在两份输入之外且为新建或空目录。
变更 stable 包须提升版本，版本不得回退；同一 artifact 保留最新三个 stable/beta/rc SemVer 包。
工具、仓库文档及纯测试变化返回 NO_CHANGES，插件随包 README 仍触发该插件范围。
共享前端与 adapter-runtime 沿真实消费者扩大，其余未知共享生产输入覆盖全部插件。
计划始终 publishable=false，仅写仓外报告，不推进发行游标。

stable 原候选核验与 writer 入口默认只读：

```text
python -B tooling/plugin_release_check.py --run-id <原候选run> --writer-id <本次run> --artifact-id <原artifact> --output <新仓外目录>
```

它复用原 run/attempt/job/artifact 的服务端校验，下载并核对原候选及两仓固定来源。
候选 release 包含唯一 plan 和按 artifactName 索引的 packageMetadata；后者绑定版本路径、SHA256、大小、manifest 摘要及源码子树。
catalog、state、候选文件与固定源码逐项绑定；未变更条目保留，历史包只按 Git 对象身份核对。
数据专项仍受纯数据白名单约束；managed 包必须具有声明的入口、前端、worker 及原生库。

显式 `--publish` 要求当前服务端 writer 与实际干净 main 控制源码一致。
writer 使用固定官方 Git 数据 API 创建精确白名单的单个提交，并以普通快进更新 main。
新源码、分发基线前进、同版本不同字节、截断目录树或额外写入均拒绝；重复应用同一候选不创建空提交。
公开引用更新后逐项回读新文件的 Git 身份、大小与原候选摘要，才记录 PUBLISHED。
writer 读取候选数据，不调用编译器、包生产者或下载的源码；生产权限继续由独立 Publisher 流程提供。

stable 候选装配复用现役 SDK、编译、前端、原生输入及 ZIP 回执：

```text
python -B tooling/plugin_release_assemble.py --source-root <固定Plugins源码> --source-commit <完整SHA> --partner-root <固定Host源码> --partner-commit <完整SHA> --distribution-root <分发Git根> --distribution-commit <完整分发SHA> --sdk-receipt <SDK回执> --host-build-receipt <同源Host构建回执> --package-receipt <实际包回执> --profile production --output <新仓外目录>
```

package-receipt 按计划内插件重复传入。装配重新调用原 package_inputs owner 核对全部成员，不重新编译或制作 ZIP。
原始源码保持完整 Git 身份，消费工作区的合同镜像按同一 SDK 核对；其他源码变化拒绝。
PackageMetadata 的摘要、大小、manifest 与源码子树在 catalog、state 和候选内共用。
NO_CHANGES 不创建候选目录；删除项无需包或 SDK 构建。候选始终为 CANDIDATE_CREATED_NOT_QUALIFIED，正式资格仍由后续服务端验证产生。

未提交本机候选使用 profile=test 并省略 source-commit、partner-commit，commit/tree 和源码子树保持 null；Test 包与 Host 回执须同属 test。
正式候选保留 production Host/SDK 回执要求及原 main 控制入口；不能用 Test 回执替代。
当前版本发行说明使用 `## <version> - <YYYY-MM-DD>`；本机未发布说明允许无日期，日期保持空值。
日期来自源内声明及已发布创建事实，日期级事实以 UTC 日首投影，构建时间与文件时间不参与列表日期。
全部生成文件只写仓外候选，当前仓库 catalog/state/packages 保持原样。

preview 候选保持全插件计划，消费每个现役插件的原生产包回执：

```text
python -B tooling/plugin_preview_assemble.py --source-root <固定Plugins develop源码> --source-commit <完整SHA> --partner-root <固定Host main源码> --partner-commit <完整SHA> --distribution-root <分发Git根> --distribution-commit <完整分发SHA> --sdk-receipt <SDK回执> --host-build-receipt <同源Host构建回执> --package-receipt <实际包回执> --profile production --output <新仓外目录>
```

每个当前插件均须提供回执，候选重用原包成员验证，不重编译或打 ZIP。
包名保持 `<ArtifactName>-<version>-<完整SHA256>.zip`，公开地址位于 `plugins-develop` Release；catalog 最后切换。
候选目录只含 catalog.json、包及 candidate.json，不写 stable catalog/state/packages。
Test 候选保留 null commit/tree，生产 reader 在服务端操作前拒绝；NO_CHANGES 不生成空候选。
preview 保留未发布版本说明的空日期；列表日期继续来自原声明与已发布事实。

`publish-stable.yml` 与 `publish-develop.yml` 从 main 手动调度，候选输入使用两仓完整 SHA 和固定发行状态 SHA。
`plugin_release_build.py` 复用 SDK、前端及插件原包生产者，stable 仅构建累计变化项，preview 构建全部现役插件；无变化时不上传候选。
候选在单个生产构建 job 内顺序生成并上传，服务端资格核对该 job 的名称、完整成功状态、run/attempt 和 artifact 创建时间。
发布 job 仅检出 main 控制工具、下载指定原候选并验证，不安装产品构建工具链。
preview 的 restore 操作使用 `plugin_preview_check.py`，显式 publish 才写入；新 develop 来源、不同不可变包及外部 catalog 改写均拒绝。
包和 publisher 记录先回读，catalog 最后切换；切换失败恢复本次拥有的原 catalog，保留其他不可变资产。
生产信任未就绪时保持 PENDING；本地候选不写 catalog/state/packages，不创建或移动 tag，不上传资产。
正式 writer 只消费经服务端验证的原成功候选，不重编译；远端操作分别按维护者授权执行。
