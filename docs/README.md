# 文档导航

本套文档按用户操作、作者任务、当前实现与验证边界组织。业务规则放在所属专题，实际测试结果与源码身份由仓外回执记录。

## 用户：完成具体任务

| 我想做什么 | 阅读 |
|---|---|
| 安装、启停、更新或第一次使用 | [用户入口](user/README.md) |
| 接入一个已经安装的自动化软件 | [八个专项](user/specialized.md) |
| 配置壁纸、活动、模拟器、实时截图或 Maa 直驱 | [通用插件](user/managed.md) |
| 配置签到账号、计划和结果通知 | [游戏签到](user/game-checkin.md) |
| 处理未识别配置、白屏、待确认结果或旧缓存 | [故障处理](user/troubleshooting.md) |

## 作者与开发者：完成一个有边界的修改

| 任务 | 阅读 |
|---|---|
| 决定修改哪一种插件、准备实际输入 | [作者入门](authors/README.md) |
| 修改发现、配置、任务观察与重试 | [专项适配器](authors/specialized-adapters.md) |
| 修改 managed 服务和 SDK 适配 | [managed 扩展](authors/managed-extensions.md) |
| 理解职责、权限、数据与生命周期 | [架构边界](developer/architecture.md) |
| 修改公共控件、集合和插件页面 | [前端开发](developer/frontend.md) |
| 合并验证计划、执行最小必要命令 | [统一定向验证](developer/validation.md) |
| 核对固定上游和正确业务预期 | [上游 oracle](developer/upstream-oracles.md) |
| 了解当前行为与验证边界 | [业务行为与验证边界](developer/behavior-targets.md) |

## Agents：先定位再编辑

先读 [Agents 入口](agents/README.md)，再用[任务地图](agents/change-map.md)选择少量相关文档。根 `AGENTS.md`、当前用户指令和本次任务卡共同约束工作；不要为了写一个 adapter 通读所有 Maa 原生资料。

## 保留的详细参考

既有 `docs/projects/*.md` 继续保存每个上游的任务、输入和证据边界；[Maa 覆盖](developer/maa-coverage.md)保留原生范围；[发行参考](developer/release.md)用于明确要求构造发布产物的任务。它们中的历史 PASS 数量和阶段记录不是本轮执行记录。

长期规则由对应专题维护；项目页保存上游参数、输入和证据边界。实际运行资格以对应源码、原包及环境的验收记录为准。
