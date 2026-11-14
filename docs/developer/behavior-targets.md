# 业务行为与验证边界

本页按产品任务连接当前事实源。具体执行结果及源码身份保存在仓外回执；设备、真实账号和正式发行资格按各自范围验证。

| 主题 | 当前行为与约束 | 事实源 |
|---|---|---|
| 专项启动与日志 | 参数、配置与 observation 绑定对应上游；BAAH 使用真实文件日志，OkNTE 使用日常任务入口 | [固定上游](upstream-oracles.md)、各 [项目页](../README.md#保留的详细参考) |
| 配置修复 | 运行阻断与合法修复准入分别判断；保存继续检查 revision、摘要与受保护字段 | [专项作者指南](../authors/specialized-adapters.md) |
| 活动刷新 | 最多四个来源并发，保留同源单飞、订阅代次、退避与逐源提交；封面使用有界持久缓存 | [活动项目](../projects/game-activities.md) |
| 即时设置 | 活动与壁纸变更即时提交，活动取消恢复打开基线；命令沿原操作结算 | [公共前端](frontend.md#状态与拥有期) |
| 编辑草稿 | 实际修改才保留；关闭重开恢复并提醒，已有目标恢复后标记变化；秘密驻留专用内存 | [草稿生命周期](frontend.md#状态与拥有期) |
| 登录 | 导航失败保留窗口与刷新入口；凭据验证、来源、披露授权、取消和迟到结果分别核对 | [登录诊断](frontend.md#登录失败与白屏的最小诊断)、[签到](../projects/game-checkin.md) |
| 普通重试与恢复 | Host 拥有活动配置接续、现场恢复及副作用门禁；专项保留 safe/unknown/partial 语义 | [架构](architecture.md#配置运行与恢复) |
| 错误反馈 | 网络、协议、持久化和内部错误保留安全归因；未知提交只读核对 | [managed 作者指南](../authors/managed-extensions.md#错误分类) |
| Maa 执行 | 独立 worker、冻结输入、目标能力与完整进程族停止由对应 owner 维护 | [Maa 覆盖](maa-coverage.md) |

公共 SDK、CAS、writer 停止证明、scope 撤销和秘密隔离由现役 Host 能力提供。插件维护自己的上游事实与业务语义，按[统一定向验证](validation.md)选择受影响产品假设。

真实游戏、模拟器、平台账号、外部通知与未运行的 SDK 生命周期矩阵继续独立验收。正式包信任与发行见[发布参考](release.md)；用户步骤分别位于[专项](../user/specialized.md)、[通用插件](../user/managed.md)和[签到](../user/game-checkin.md)。
