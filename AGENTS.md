# NexusPipeline-Plugins 开发约束

本仓库维护官方插件源码、manifest、catalog、发行包和插件作者契约。宿主公共 Plugin API、Frontend API 与 `nxp-*` 元件契约以相邻 `NexusPipeline` 仓库的当前文档和公开注册表为准。

## Agent 强制规则

- 动手前检查本仓库的 Git 状态与当前 commit，保留用户已有改动；Workspace 根目录不是 Git 仓库。
- 未经维护者明确授权，不执行 commit、push、tag、Pull Request 或 Release。
- 代码提交按功能边界拆分为可独立验证、审查和回退的变更单元；功能、测试、文档和发行元数据分别保持范围清晰。
- 前端插件必须使用公开 Frontend API、公开 slot 和公开 `nxp-*` Native Custom Elements，不依赖宿主 Vue 内部组件、私有 class 或未声明的 host 能力。
- 不得新增持久化视觉回归测试、截图基线、像素/布局断言或视觉测试套件。临时浏览器验证脚本只能放在操作系统临时目录，验证结束后删除且不得加入 Git。
- 持久化 UI 测试只验证功能结果、ARIA、焦点、状态、提交、路由、API 效果和生命周期；测试使用当前插件契约，不保留旧 API、旧 manifest 或旧数据格式的兼容实现。
- 不得提交用户配置、账号信息、Cookie、Token、密钥、运行日志、缓存、临时目录、程序集调试符号或与发行包无关的本地文件。

详细开发、验证和发行流程见 [CONTRIBUTING.md](CONTRIBUTING.md)、[docs/FRONTEND_PLUGIN.md](docs/FRONTEND_PLUGIN.md)、[docs/DATA_SPECIALIZED_PLUGIN.md](docs/DATA_SPECIALIZED_PLUGIN.md) 和 [docs/RELEASING.md](docs/RELEASING.md)。
