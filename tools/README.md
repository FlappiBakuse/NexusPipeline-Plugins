# 仓库工具

唯一 Python 入口为 `python tools/repo.py`，测试编排入口为 `node tests/run.mjs`。参数名精确匹配；未知、重复参数和缺少必需输入会失败。`--root` 默认为入口所在仓库，其他 checkout 必须显式提供。所有构建、依赖缓存、报告及候选输出使用仓库外的新目录；本地配置 TEMP/TMP 等进程环境变量，不修改全局环境。

| 目录 | 职责 |
|---|---|
| `repository/` | 源码、版本、Git 计划、发行事实、归档与确定性打包 |
| `release/` | stable/preview 计划、候选身份、Actions 来源与受保护 writer |
| `sdk/` | 官方 Host 输入及 API、工程、语言注册表检查 |
| `generate/` | 作者脚本、配置编辑器、schema 和待适配脚手架 |
| `docs/` | 本地 Markdown 链接、导航及命令结构检查 |

`adapters/` 是作者源码，`examples/task-protocol/` 是合成示例，`tests/fixtures/task-protocol/` 按专项、`examples/`、`shared/` 和 `shared/resources/` 归类实际 Host 夹具。用例 ID 保持文件名，加载器拒绝重复、大小写冲突和链接路径。生成业务脚本放在各插件的 `data/` 中，不能手改 bundle。

## 检查和生成

```text
python tools/repo.py check source
python tools/repo.py check source --base <完整PR基线SHA>
python tools/repo.py check syntax
python tools/repo.py check docs
python tools/repo.py check host --host-root <Host> --sdk-sha <完整HostSHA>
python tools/repo.py generate tasks --check
python tools/repo.py generate editors --check
python tools/repo.py generate schema --check
python tools/repo.py scaffold task-plugin --artifact MyAdapter --name my-adapter --output <新目录>
```

省略生成命令的 `--check` 会更新正式生成物。脚手架默认 `json-id-array`，支持 `json-map`、`json-parallel-array`、`yaml`、`mxu` 和待适配的 `ok-script-daily`。`--example` 只生成五种可执行合成示例；`ok-script-daily --example` 拒绝。创建目标必须不存在，`--check` 只读比较已有目标。

## 包和候选

```text
python tools/repo.py package --artifact BAAH --output <新包目录> --report <新报告JSON>
python tools/repo.py package --artifact GameCheckIn --host-root <Host> --output <新包目录> --report <新报告JSON>
python tools/repo.py release scope --channel stable --github-output <输出文件>
python tools/repo.py release plan --channel <stable或preview> --host-root <Host> --sdk-sha <完整HostSHA> --output <新plan-phase.json>
python tools/repo.py package --artifact <Artifact> --host-root <Host> --sdk-sha <完整HostSHA> --plan-phase <plan-phase.json> --output <新包阶段目录> --report <新包阶段目录/report.json>
python tools/repo.py release assemble --channel stable --host-root <Host> --sdk-sha <完整HostSHA> --plan-phase <plan-phase.json> --package-phases <包阶段总目录> --workflow-sha <控制SHA> --run-id <id> --run-attempt <attempt> --output <新候选目录>
python tools/repo.py release assemble --channel preview --host-root <Host> --sdk-sha <完整HostSHA> --plan-phase <plan-phase.json> --package-phases <包阶段总目录> --workflow-sha <控制SHA> --run-id <id> --run-attempt <attempt> --output <新候选目录> --producer-output <目录外producer.json>
python tools/repo.py release candidate --host-root <Host> --sdk-sha <完整HostSHA> --workflow-sha <控制SHA> --run-id 1 --run-attempt 1 --output <新本地候选目录>
python tools/repo.py release audit --baseline <可信分发完整SHA>
```

纯数据包不启动 dotnet/npm。managed 包在外部原字节副本中构建，显式引用本次 Host SDK。候选阶段绑定真实源码、SDK、控制器、run/attempt 和 packageInputs；单包阶段同时验证固定计划。历史 ZIP 仅对可信分发基线核对字节，不按当前 manifest 重解释。相同 stable artifact/version 不得改变字节。

## 来源和发布

```text
python tools/repo.py release source --channel <stable或preview> --candidate-run-id <原run> --current-run-id <当前run> --github-output <输出文件>
python tools/repo.py release extract --channel <stable或preview> --artifact-zip <原artifact ZIP> --expected-digest <服务端sha256摘要> --output <新目录>
python tools/repo.py release inspect --channel stable --generated-root <候选目录> --workflow-sha <原控制SHA> --run-id <原run> --run-attempt <原attempt>
python tools/repo.py release inspect --channel preview --generated-root <候选目录> --producer <producer.json> --workflow-sha <原控制SHA> --run-id <原run> --run-attempt <原attempt>
python tools/repo.py release validate --channel stable --root <原源码checkout> --generated-root <候选目录> --source-sha <源码SHA> --workflow-sha <原控制SHA> --run-id <原run> --run-attempt <原attempt>
python tools/repo.py release validate --channel preview --root <原源码checkout> --generated-root <候选目录> --producer <producer.json> --source-sha <源码SHA> --workflow-sha <原控制SHA> --run-id <原run> --run-attempt <原attempt>
python tools/repo.py release publish --channel stable --root <原源码checkout> --generated-root <候选目录> --source-sha <源码SHA> --workflow-sha <原控制SHA> --run-id <原run> --run-attempt <原attempt>
python tools/repo.py release publish --channel preview --source-root <原源码checkout> --generated-root <候选目录> --producer <producer.json> --source-sha <源码SHA> --workflow-sha <原控制SHA> --run-id <原run> --run-attempt <原attempt>
```

来源查询使用 Actions read token。writer 执行代码来自已审核 main 控制 checkout；源码根是独立输入。`publish` 默认验证并输出可审查结果，获授权实际发布才增加 `--remote-write --token-env PLUGIN_PUBLISHER_TOKEN`。preview 先上传并下载核验包，再切换 catalog；stable 仅写回白名单生成物并正常快进。完整发布规则见[发行指南](../docs/RELEASING.md)。

显式低层诊断为 `node tests/config-editors/run.mjs`、`node tests/frontend/run.mjs --host-root <Host>` 与 `python -m unittest discover -s tests/tooling -p "test_*.py" -v`。正式 Python gate 使用 `tests/tooling/unittest_runner.py` 的原生计数报告，拒绝零用例、skip、失败和错误。
