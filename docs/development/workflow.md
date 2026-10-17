# 插件开发流程

项目强制边界见 [AGENTS](../../AGENTS.md)。

## 开发流程

1. 从现有插件中选择运行目录结构相近的参考实现。
2. `managed-code` 插件创建 `plugins/general/<ArtifactName>/`，`data-specialized` 插件创建 `plugins/specialized/<ArtifactName>/`，按插件类型补齐 manifest、`store.json`、data 资源或 .NET 项目。
3. 数据化插件在目标软件目录验证 profile 推导；代码插件构建并验证入口程序集、依赖和 Plugin API 版本。
4. 验证运行语义、错误处理、用户数据隔离和敏感数据边界。
5. 检查 JSON、脚本源码和发行包不含个人数据。
6. 仅 `managed-code` 可以校验 `frontend-module` capability、Frontend API `1.7`、`frontend/` 的 Vue/TypeScript/Vite 源码、`web/` 构建产物和 slot cleanup 行为；公共控件使用宿主 `nxp-*` Native Custom Elements，不依赖宿主私有 Vue 组件、私有 class 或内部实现。`data-specialized` 只校验三个 Host 声明能力和后端脚本闭包。若使用本地化，使用 `contracts/host-compatibility.json` 的 `supportedLocales` 中声明的规范化 BCP 47 locale，确保默认资源存在、所有语言 key 集合和占位符集合一致、value 为非空字符串且不使用 `legacy.*` key；数据化专项插件的 `inputs.labelKey` 与 `inputs.descriptionKey` 必须在所有 locale 资源中存在；确认公开资源不包含配置、密钥、程序集或调试符号。
7. 正式发行前按授权确定插件版本并同步 manifest、程序集/前端及 `store.json`；未发布的同一目标版本内修复和重建不重复提升版本；工具、文档和 CI 治理改动不制造新插件版本。Pull Request 运行范围验证，手动稳定候选按已发布游标计算累计计划。catalog 尚未包含新插件或新版本时，`validate` 会因源码与现存 catalog 集合不一致而失败；候选生成只写指定的外部新输出目录，不改源 `catalog.json`、`metadata/releases/stable-state.json` 或 `packages/`。

验证入口见[测试指南](../testing/README.md)，候选和不可变包规则见[发行指南](release.md)。

提交采用 Conventional Commits：类型英文、说明中文，按可独立审查、验证、回退的功能边界组织；提交、推送和发布须有当前对话授权。
