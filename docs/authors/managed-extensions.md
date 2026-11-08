# managed 扩展：用现有能力完成当前业务

managed 插件只消费公共 SDK，代码按现有 `Domain`、`Application`、`Host` 职责放置；目录名称保持 next 风格。先定位需要恢复的产品行为，再修改最小 owner。

## 六个插件的主要 owner

| 插件 | 业务规则 | 组合与效果适配 | 前端 |
|---|---|---|---|
| custom-wallpaper | 图片选择、轮换和效果 | 当前服务与 Host Documents/Images | `frontend/src` |
| emulator-support | 厂商实例选择、固定命令策略 | `context.Emulators` provider 与 Host typed ports | 无独立浏览器模块 |
| game-activities | 订阅、时间、缓存与刷新调度 | `ActivityCoordinator`、`SdkActivityPorts` | 概览及设置 |
| game-checkin | 平台、游戏、角色、任务、计划与提交状态 | Host effect、SecretDocuments、Desktop、通知 | 签到页面与凭据编辑 |
| live-screenshot | 当前任务预览的呈现范围 | `current-task` provider，Host 采集 owner | 运行预览 |
| maa-framework | 项目编译、选项与执行语义 | compiler、独立 worker、Host 目标端口 | 脚本和绑定编辑器 |

实际文件以该插件 manifest 和源码入口为准，不因表格存在就新建一个同名抽象层。

## SDK 与生命周期

激活入口注册实际能力，注册归当前 activation scope。后台任务有明确取消和异常接收方；停用、卸载、客户端退役、表面隐藏和晚到结果分别遵守现有 owner。异步方法不解析 Host DI，不持有已撤销的权限。

现有 SDK 端口能表达修复时不新增端口。确有缺口时，在任务卡写出生产消费者、缺失能力和最低证明，再同步 Host 权威 schema/SDK；不能手写一套 Host DTO 消除编译错误。

## 数据与外部效果

普通状态以当前 revision/CAS 保存；秘密使用 keep/set/clear，与普通任务一致提交。读取失败不能变成空状态。用户明确清除与没有新值是两种意图。

签到已提交而结果未知时只做可验证的只读核对；Busy 不再次提交。为保留未知副作用判断，不需要把 NullReference、持久化失败或解析不变量全部标成 `transport_error`。已知网络错误归网络类，内部失败保留安全 phase/errorId 和可追踪原因，不记录凭据或响应秘密。

通知受理失败保留签到结果；不要重新签到以弥补通知。活动缓存失败可保留旧数据，但必须呈现最近成功和当前失败状态。

## 本轮两个明确改造点

### 活动源刷新

main 的文字源请求最多 4 并发，基线 next worker 串行逐源等待。现有 `SdkActivityPorts` 已限制 4 并发与每请求预算。本轮在现有 coordinator 内恢复最多 4 个有界刷新，保留同源单飞、订阅 generation、迟到响应拒绝、手动节流、失败退避与逐源提交。

不用先建立通用任务调度库。一个慢源与一个快源的受控场景即可证明快源不被无关慢源串行阻塞；另一个订阅变化场景证明旧响应不能覆盖新设置。并发上界可作为资源承诺验证，内部保存精确次数不作为产品断言。

### 错误分类

仅修改已发现吞失信息的调用边界。网络失败、协议不支持、持久化失败和内部错误应有不同诊断路径，但不新增无人消费的错误码。每个新增码至少有一个日志或界面消费者，仍保留未知写入/未知提交的核对状态。

不要全仓删除 catch。native callback、插件隔离、取消收口和已向用户报告错误的 timer 末端各有实际用途。

## 原生与 Maa 范围

Maa 已有独立 worker；本轮不重写引擎或运行协议。任务资源、原生回调排空、Agent 进程族、目标身份和归档输出保持现有单一 owner。没有相应任务卡时不扩设备方法、不增 DLL 搜索路径、不把项目 JSON 中的 PID/路径当成权限。

修改一个按钮或普通任务参数，不要求加载 Maa 原生库。只有实际 worker、native 生命周期或原包闭包被改动，才把对应的 Windows/原生验证加入统一计划。

## 证明业务，不固定实现

最终持久结果、发送范围、未知结果不重放、账号隔离、停用后不再工作属于产品假设。内部写入 30/6/2 次、特定类名或同一对象引用不属于必须保留的产品行为。

验证先选择一个被修改插件的现役入口。只有公开边界或副作用需要真实 Host 才升级该一条链；不要把全部平台成功签到、三家模拟器安装或所有 Maa 项目作为每次开发的默认条件。[统一验证规则](../developer/validation.md)定义代码完成后的执行顺序。

当前代码证据：[活动串行消费](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/managed/game-activities/src/Application/ActivityCoordinator.cs#L127-L168)、[既有 HTTP 上界](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/managed/game-activities/src/Host/SdkActivityPorts.cs#L23-L34)、[签到分类问题](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/managed/game-checkin/src/Application/HoyoCheckIn.cs#L24-L47)。

## 模拟器 provider 描述

provider 的 `Layouts` 提供安装发现及枚举声明，`Describe` 提供所选目标的实例目录候选和启动/退出命令。目录候选仅能相对已核验安装根或该实例引用的配置文件；Host 解析物理路径并冻结证据。命令只可使用已绑定控制工具，不授予任意进程权限。配置保存 extension/provider 身份，后续执行继续绑定同一注册。

雷电、夜神、BlueStacks 规则与协议测试由 emulator-support 持有；MuMu 保持宿主现役归属。
