# 贡献指南

第一次开发从[环境与构建入门](docs/getting-started/development.md)开始。先按[文档导航](docs/README.md)确定插件与主题，AI Agent 另遵守 [AGENTS](AGENTS.md)。

## 工作流程

1. 核对分支、HEAD、工作树、暂存区和最新远端引用，保护已有修改。本机使用 `develop`，保全后正常快进或必要合并；未知来源只暂停依赖它的任务。
2. 明确当前插件、上游或平台依据、产品假设、修改边界和交付内容。只读取所属 owner、Host 直接消费者和必要的固定输入。
3. 集中完成本批手写代码、必要产品假设断言与文档。公共 API 变化先在 Host 权威定义，Plugins 通过现役 SDK 导入流程生成镜像。
4. 全部选定改动就绪后，按[验证规范](docs/development/validation.md)去重准备一次 SDK/消费者与受影响插件，执行最低有效层检查。
5. 失败保留原始结果，修直接原因并只补受影响范围。交付真实命令、退出码、源码/产物身份和未运行项。

准备和实现阶段允许阅读、编辑、差异审查及必要生成源；不逐文件运行整套验证。运行诊断先准备最小观测点，依据实际结果补局部实现。

## 工程与安全

插件只消费公开 SDK；普通数据使用 Documents/CAS，秘密使用专用端口。未知提交只读核对，取消、scope 撤销、迟到结果与 writer 停止保持原归属。[架构](docs/architecture/overview.md)、[managed 指南](docs/authors/managed-extensions.md)和[专项指南](docs/authors/specialized-adapters.md)维护各自约束。

文本使用 UTF-8、LF。命名口径由[配套 Host 规范](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/development/naming.md)与实际检查器维护，固定外部签名使用逐项例外。注释说明非显然原因。生成 bundle、本地化 JSON 和 SDK 镜像只通过现役 producer 更新。

构建、依赖、包、测试实例与报告全部进入显式仓外根，本机使用 Temp；用户配置与夹具分离。上游源码用于研究，仓库构建/测试不依赖本机 Reference。

## GitHub 协作

开发提交和推送仅进入 `develop`，按独立可审查、可回退的功能拆分，源码/测试/文档一起处理。先完成全部适用验证，再按当前聊天授权统一推送。main PR 的 [ci.yml](.github/workflows/ci.yml)按完整差异选择生产插件包，项目测试另选。

PR 描述只写最终问题、行为和实际验证。catalog、发行游标和 packages 由 Publisher 维护，候选与正式 writer 流程见[发行](docs/operations/release.md)。提交、推送、PR、tag、合并和发布分别按会话授权执行。

## 文档同步与验证

新功能先找[主题权威](docs/README.md#主题与权威来源)。修改上游映射更新对应项目页及固定来源；修改 SDK 检查 Host 参考和导入镜像；修改构建/验证更新开发指南；修改安装/发布更新 operations；用户行为只更新对应任务页。长期决策的记录条件见[维护规则](docs/README.md#维护规则)。

纯文档修改核对相对链接、标题锚点、代码路径与真实参数，再运行 `git diff --check`。本仓没有独立 Markdown lint 或链接检查 CLI；不为文字修改安装依赖或重建插件。随包 README/changelog 有发行消费者，保留其独立使用职责。
