# 官方插件 Agent 指令

本仓实现六个 managed 插件、八个数据专项和五个浏览器模块，消费 Host 公共 SDK。按[任务地图](docs/agents/README.md)读取所属文档与直接代码；[文档导航](docs/README.md)给出权威位置。

## 开工与授权

- 核对分支、HEAD、工作树、暂存区及远端，保护已有字节；未知修改只暂停依赖它的操作。本机遵守 Workspace 规则并使用 `develop`。
- 不 reset、clean、自动 stash、force push、覆盖未知修改或擅自更新依赖/版本。GitHub 写入与真实账号副作用按当前聊天授权执行。
- 仅为模块独立执行规则增加子 AGENTS。Codex 沿工作路径合并指令，同目录优先 AGENTS.override.md，较深规则在适用范围覆盖冲突项；见[官方说明](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。

## 快速定位

| 范围 | 代码 | 文档 |
|---|---|---|
| 专项四阶段与发现 | `plugins/specialized/<id>/adapter`、`extension.json`、`upstream.json` | [专项指南](docs/authors/specialized-adapters.md)、对应 `docs/projects/<id>.md` |
| 共用纯协议与框架 | `adapter-runtime/core`、`adapter-runtime/frameworks` | [架构](docs/architecture/overview.md) |
| managed 业务与 SDK 适配 | `plugins/managed/<id>/src` | [managed 指南](docs/authors/managed-extensions.md)和对应项目页 |
| 浏览器模块与公共 UI | 各 `frontend/src`、`plugins/managed/frontend-ui` | [前端开发](docs/development/frontend.md) |
| SDK 镜像与构建 | `contracts`、`tooling` | [构建指南](docs/development/building.md) |
| 原包集成输出夹具 | `tests/host-fixtures` | [夹具说明](tests/host-fixtures/README.md) |

## 必须保持

- 插件只使用公开 SDK，不导入 Host 私有实现，不建立第二套权限、恢复、配置或调度权威。Domain/Application 维护业务，Host 层转换 SDK。
- 上游参数、任务 ID、配置与日志来源以各插件固定来源为依据，不把同名参数跨游戏套用；锁只记录声明支持范围，最新发行另行核对。
- 专项脚本只返回受限协议结果；物理文件、writer、进程和事务由 Host 管理。未知任务与原字节保留，Unknown/partial 副作用不自动重放。
- 普通状态使用 revision/CAS，keep/set/clear 明确区分。秘密不进入普通 DTO、浏览器存储、日志、截图或 Git。
- 前端复用 SDK 和 frontend-ui；订阅、取消、幂等、单源发布及晚到结果绑定所属 scope。
- 手写文本使用 UTF-8、LF，每文件最多 800 个物理行，覆盖源码、测试、工具、工程配置和文档。命名和例外见[Host 命名规范](https://github.com/FlappiBakuse/NexusPipeline/blob/next/docs/development/naming.md)。函数目标 60 行，超过 100 行审查职责。
- SDK source/identity/lock 和本地化资源由现役 producer 更新，不手填身份或 PASS。依赖、fixture、包与回执写显式仓外根，本机放 Temp。
- 删除代码先核对符号与[加载约定](docs/architecture/overview.md#从加载约定定位)，包括 manifest、拼接脚本、常量生成、SDK 实现和原生回调；保留公开类型的外部调用边界。

## 实现、验证与交付

- 整仓文本与行数检查使用 `python -B tooling/source_checks.py`。

- 按 [CONTRIBUTING](CONTRIBUTING.md)完成本批选定代码、必要断言和文档后，再执行合并的定向计划；失败只补直接影响。
- 构建入口示例：`python -B tooling/build_specialized_slice.py --extension oknte --sdk-receipt <同源SDK回执> --output <仓外根>`；完整输入和打包见[构建](docs/development/building.md)。
- 纯 JS 产品向量：`node tests/specialized/component.mjs <Plugins绝对根> oknte <新仓外报告根>`。需要 Jint 时直接选[验证指南](docs/development/validation.md)中的父入口，复用其 Node 子套件。
- 只编译/打包可使用真实 compile-only SDK 及独立 consumer 编译回执；runtimeConsumers/lifecycle 按实际标 NOT_RUN。运行边界只按选中假设增加。
- 不虚构 `--filter`、`--shared` 或 case 参数；lint、typecheck、test、build 可共享实际执行，结果分别记录。
- 未提交输入记 local-uncommitted、commit/tree 为 null；旧回执保留原身份。缺环境记 NOT_RUN/BLOCKED，真实账号和厂商结果独立验收。
- 纯文档检查链接、锚点、源码路径、命令和 `git diff --check`；原生功能按适用规则交付实际软件。修复或重建不重复提升固定目标版本。

## 维护联动

公共接口检查 Host 参考和镜像；模块边界检查架构；命令检查构建/验证指南；发行检查 operations；用户行为检查对应 user 页。重要长期选择记录有依据的决策，仓库文档只保留项目已实现的内容。新文档归属见[维护规则](docs/README.md#维护规则)。
