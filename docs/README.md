# NexusPipeline-Plugins 文档门户

本目录按插件作者任务提供当前契约、代码入口和验证方向。宿主的公共 UI、Frontend API 和 managed Plugin API 以相邻 [NexusPipeline 文档门户](https://github.com/FlappiBakuse/NexusPipeline/tree/main/docs) 为准；本仓库文档补充插件源码、前端构建、数据化脚本和发行流程。

## 按任务进入

| 任务 | 当前规范 | 代码与验证方向 |
|---|---|---|
| 查询待办与未验证范围 | [项目状态](STATUS.md) | 专项支持限制、真实环境验证与兼容退役计划 |
| 编写 Frontend 插件 | [Frontend 插件指南](FRONTEND_PLUGIN.md) | `plugins/general/*/frontend`、`tools/Test-FrontendPlugins.mjs`；宿主 `nxp-*` 公共元件 |
| 编写 data-specialized 插件 | [数据化插件指南](DATA_SPECIALIZED_PLUGIN.md) | `plugins/specialized/*/data`、`tools/repository.py`；源码与脚本测试 |
| 编写 judge 或 config 脚本 | [判断脚本指南](JUDGE_SCRIPT.md) | `judge.js`、`judge.py`、`config-validator.js`、`config-editor.js` |
| 修改插件版本或包 | [发行指南](RELEASING.md) | `plugin.json`、`store.json`、`catalog.json`、`packages/` |
| 参与仓库开发 | [贡献指南](../CONTRIBUTING.md) | `tools/`、`tools/tests/`；源码校验与增量计划 |
| 查询宿主接口 | [宿主 Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/reference/plugin-api/README.md) | `src/NexusPipeline.Plugin.Abstractions` 与宿主公开注册表 |

机器路由保存在 [map.json](map.json)。Frontend API 的公共 `nxp-*` 元件清单和 `minHostVersion` 规则也记录在 [Frontend 插件指南](FRONTEND_PLUGIN.md)。

专项任务三阶段协议、作者模板、生成脚本和真实 Host Jint 门禁见[专项任务协议](TASK_PROTOCOL.md)。
