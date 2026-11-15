# Agent 任务地图

读取顺序：[AGENTS](../../AGENTS.md) → 本表相关主题 → 项目页和锁 → 生产 owner、直接消费者及测试。共同流程见 [CONTRIBUTING](../../CONTRIBUTING.md)，实际命令见[构建](../development/building.md)和[验证](../development/validation.md)。

| 任务 | 首读 | 代码 owner | 最低验证方向 |
|---|---|---|---|
| 程序、配置或日志发现 | [专项指南](../authors/specialized-adapters.md)、[上游依据](../reference/upstream-oracles.md) | 对应 `adapter/discovery.js`、`sources.json` | 固定消费者、真实来源与发现向量 |
| 配置、任务、观察和重试 | 对应 `docs/projects/<id>.md` | 专项 adapter、`adapter-runtime` | 任务身份、CAS、失败子集与 Unknown 保留 |
| 普通重试或配置恢复 | [架构](../architecture/overview.md)及 Host 配置/重试参考 | Host 主责，插件给有限声明 | 一条实际受影响消费链 |
| 活动并发、缓存与状态 | [活动项目](../projects/game-activities.md) | `game-activities` Domain/Application/Host | 并发上界、generation、逐源发布与离线缓存 |
| 签到、凭据和计划 | [签到项目](../projects/game-checkin.md) | `game-checkin` Domain/Application/Host | 账号隔离、Unknown 只读核对、原操作和通知 |
| 登录窗口和白屏 | [前端诊断](../development/frontend.md#登录失败与白屏的最小诊断) | Host Desktop、CheckInBrowserLogins | 失败阶段、刷新、取消和迟到归属 |
| 壁纸和公共 UI | [前端](../development/frontend.md) | `custom-wallpaper`、`frontend-ui`、Host 公共控件 | 即时设置、分类、图片引用和实际消费者 |
| 当前运行预览 | [实时截图](../user/managed.md#livescreenshot) | `live-screenshot` frontend/current-task | run/attempt、可见性、晚到图片释放 |
| 模拟器选择与控制 | [模拟器项目](../projects/emulator-support.md) | `emulator-support` Domain/Host、Host emulation | 厂商实例和自有目标，真实程序资格另记 |
| Maa 编译或 worker | [Maa 项目](../projects/maa-framework.md)、[覆盖](../reference/maa-coverage.md) | `maa-framework` Domain/compiler/worker | 冻结输入、目标能力、回调和进程族停止 |
| SDK 与产物 | [构建](../development/building.md)、Host SDK 参考 | Host producer → import_sdk → 实际消费者 | 来源、公开 API 编译和必要原包闭包 |
| 发布或 PR | [发行](../operations/release.md) | `tooling`、`.github/workflows` | 同源原候选、服务端身份及明确授权 |
| 文档 | [文档导航](../README.md) | 唯一主题页 | 路径、锚点、命令和当前状态 |

插件路径默认位于 `plugins/managed/<id>` 或 `plugins/specialized/<id>`。MaaEnd/MaaS 专项调用上游程序，通用 MaaFramework 使用独立 compiler/worker；分别读取所需资料。

共享模块、公开契约或真实直接消费者受到影响时，增加对应最小验证；纯页面修改不自动加载原生引擎，单一上游修复不扩成八个游戏矩阵。
