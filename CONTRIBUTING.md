# 贡献指南

先确认适配目标、许可证与可分发范围。工程边界见 [AGENTS](AGENTS.md)，按任务选择[文档门户](docs/README.md)。

1. 按[开发流程](docs/development/workflow.md)选择 managed-code 或 data-specialized 目录和 manifest。
2. 使用[宿主公开契约](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/reference/plugin-api/README.md)，不依赖宿主私有实现。
3. 按[测试指南](docs/testing/README.md)验证实际结果、失败恢复和数据隔离；输出使用显式外部目录。
4. 按[发行指南](docs/development/release.md)核对版本与包内容。candidate 不是发布，远端操作需要明确授权。

普通专题、示例与随包说明遵循[文档维护规范](docs/development/documentation.md)。提交中不包含账号、凭据、用户数据、缓存或运行产物。
