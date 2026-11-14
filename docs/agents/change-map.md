# 任务地图

按当前任务查一行，先阅读指定 owner。这里登记稳定领域入口和假设，不登记每个测试方法名/数量；完整规则见[统一定向验证](../developer/validation.md)。本表中的验证均在全部选中代码完成后执行。

| 改什么 | 第一事实源 | 生产 owner | 必须保持 | 最低验证 |
|---|---|---|---|---|
| OkNTE 日常入口 | [上游 oracle](../developer/upstream-oracles.md#oknte参数必须选中日常消费者) | `plugins/specialized/oknte/adapter/discovery.js` | 真实日常选择；OkWW 独立编号 | 该发现向量＋固定任务消费者 |
| BAAH 日志 | [上游 oracle](../developer/upstream-oracles.md#baah文件名与来源构成同一契约) | `baah/adapter/discovery.js`、`observation.js`；Host FileLog owner | 正确 glob、file:0、无 exit0/stdout 假成功 | 一条发现→选择→观察链与错误来源负例 |
| BAAH 修复 | [专项修复闭环](../authors/specialized-adapters.md#baah-修复闭环) | BAAH configuration＋Host TaskAdapterService | 候选可修复性、CAS、原操作 | false→true preview/apply；陈旧建议拒绝 |
| 普通重试/配置接续 | Host 当前配置与重试文档；[目标表](../developer/behavior-targets.md) | Host 主责，插件仅给允许范围 | 活动进度与原现场、未知副作用不重放 | 已改普通路径＋一个受影响专项消费者 |
| 活动多源加载 | [managed 作者指南](../authors/managed-extensions.md#活动源刷新) | game-activities ActivityCoordinator / SdkActivityPorts | 有界并发、单飞、generation、退避 | 慢/快源与订阅变化两类结果 |
| 签到登录与白屏 | [前端诊断](../developer/frontend.md#登录失败与白屏的最小诊断) | Host Desktop 登录窗口；CheckInBrowserLogins / credential-fields | 失败可继续、凭据隔离、取消/晚到归属 | 报告平台的实际阶段＋直接相关生命周期场景 |
| 签到任务/计划/通知 | [签到项目参考](../projects/game-checkin.md) | game-checkin Domain/Application/Host | 平台区服、任务身份、unknown 只读核对、通知不重复签到 | 选定产品假设的策略/SDK最低层 |
| 壁纸设置集合 | [公共前端](../developer/frontend.md#原子控件和集合一起复用) | custom-wallpaper settings-controls；Host 设置分类 owner | 单展开、置顶、即时设置、图片引用 | 一个设置导航与编辑流程 |
| 实时预览 | [用户范围](../user/managed.md#livescreenshot) | live-screenshot frontend / current-task provider | 当前 run/attempt、隐藏停止、晚到释放 | 当前/旧 attempt 和可见性场景 |
| 模拟器实例 | [项目参考](../projects/emulator-support.md) | emulator-support Domain/Host＋Host emulation | 精确实例、仅停止自有目标 | 实际受影响厂商选择；需要才用真程序 |
| Maa 直驱 | [项目参考](../projects/maa-framework.md)、[覆盖参考](../developer/maa-coverage.md) | maa-framework compiler / worker / frontend | 冻结语义、目标权限、回调与进程族停止 | 受影响层；改 UI 不加载原生引擎 |
| 公共 SDK | 配套 Host schema/SDK 与 `contracts/sdk-source-lock.json` | Host producer → Plugins import_sdk → 实际消费者 | 单一公共契约、准确来源 | 同源producer＋必要独立consumer编译；compile-only可导入，运行消费者仅按选中假设增加 |
| 测试精简 | [验证判据](../developer/validation.md#5-只保留产品假设测试) | 当前测试断言与现役runner | 产品假设仍执行，失败可见 | 删改断言后的定向场景，不反向增加数量门禁 |
| 文档 | [文档导航](../README.md) | 对应用户/作者/开发页 | 当前与目标分开、单一状态入口 | 本次链接、路径、命令与行为一致 |

## 允许扩范围的证据

只有当前变更实际经过共享函数、改变公开契约、影响持久数据或造成直接消费者失败，才把该消费者加入计划。写明原因与新增的一个最小证明；不以“保险起见”“顺手整理”或“未来可能支持”为理由扩大。

## 常见误路由

- BAAH 文件日志修复不需要给所有专项增加 stdout fallback。
- OkNTE 的 `-t 2` 不推广到 OkWW。
- MaaEnd/MaaS 数据专项不转成通用 Maa worker 插件。
- 签到窗口白屏不通过真实签到/领奖来测试网络。
- 前端颜色/边框修复不扩大为后端全仓 build。
- 有价值的工具包完整性测试不因放在 tooling 目录而删除；内部方法数量也不因放在 integration 目录而保留。
