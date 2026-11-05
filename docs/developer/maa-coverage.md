# Maa 覆盖归属

MaaEnd/MaaStellaSora 调用用户安装的上游程序。两个生产 sources.json 使用 maa-data 与各自配置、日志适配器；通用 MaaFramework 的 compiler/worker 保留独立职责。

| 需要证明的行为 | 当前运行 owner | 定向测试 |
|---|---|---|
| 稳定实例、任务身份、重名和顺序 | 专项配置与 interface 资料解析 | T-PL-02：保存的 MXU/MFA 配置、当前资料及固定实例 ID |
| revision/hash/path、冻结输入和内容身份 | Host SelectedProjectSource、配置修订与执行计划 | T-PL-02：资源 CAS、只读资料身份及不可变内容 |
| start/finish/failure、迟到失败、缺失前导 | 专项 stdout/MonitorLog 观察 | T-PL-02：源、epoch、sequence、重复、同名歧义及最终 drain |
| 选中结果集合 | 专项冻结 task 集合与上游日志 | T-PL-02：非所选任务不得扩大结果集合 |
| 配置选项、重复任务、取消、技术前置和重试 | 专项受限 patch 与 Host 进程执行 | T-PL-02：已知任务身份、前置依赖、重试选择及未知任务保全 |
| native editor prepare/done/cancel/failure | Host 配置事务和 MaaS 有限字段 patch | T-PL-02：停止证明、首次候选修订、字段边界及原字节恢复 |
| Native/program facts、编译与执行计划绑定 | 通用 MaaFramework producer | 通用框架测试；不代表专项或实际上游验收 |

Node 向量、实际 Jint、Windows 上游和完整成品验收分别记录。正式结果必须绑定当前源码、真实消费者、精确场景及原始报告；语法和包合同检查只证明对应边界。

通用 MaaFramework 直驱 adapter 为 native/program fact 的独立消费者，源码及有限 sources.json 位于该 managed 插件 adapter 目录。
其覆盖须证明首次无事实检查点、source/epoch/sequence、任务与实际重复次数绑定、未知输出及最终 drain。
专项 sources.json 不消费此模块；两条运行链的回归和实机结果分别报告。
