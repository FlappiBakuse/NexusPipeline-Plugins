# ok-script / PyAppify 框架

项目日常范围见 [OkNTE](../projects/OkNTE.md)、[OkWutheringWaves](../projects/OkWutheringWaves.md)，协议见 [TASK_PROTOCOL](../author/TASK_PROTOCOL.md)。

0.2.0 用官方安装来源、运行入口结构、配置结构和实际进程归属判断兼容。版本号及源码 hash 用于研究复现；相同结构的新版本生成真实日常任务，执行观察与消费失败重试，不进入“任务未核验”占位。旧 0.1.x 包保留其原兼容路径。

安装元数据须指向本款与本渠道，当前版本在安装器可用版本表中，更新器空闲，HEAD 为非零完整提交，origin 属于 metadata 声明的精确官方地址。China 与 Global 分开验证；Global NTE 使用 BnanZ0/ok-nte-update，Global WW 使用 ok-oldking/ok-ww-update。China 镜像仅接受声明的精确地址，不能扩展为域名通配。

持久 running 标志不能替代进程事实：真实 worker/updater 活跃或查询不明时阻断；陈旧 running=true 且 Host 确认安装内 worker 不在运行时可按结构发现，不改写该字段。完整执行路径与冻结资源在运行期复核，外部修改后拒绝证据与重试。GUI 驻留只有在已声明不写接管配置且归属确定时可保留。

日常入口结构来自安装仓库的实际 task 文件，不以项目 main 仓库替代发行安装内容。源码样本与资产见 [上游窗口](../../tools/task-protocol/upstream-window.json)。`fixtures/resources` 中 pinned_upstream_source_with_synthetic_extras 标识真实锁定源码与合成外围资源；日志仍是合成输入。结构回归与发行发现不证明真实游戏完成。

NTE 完整显式布尔列表可选择重试；上游默认补项导致不可单独选择时使用耦合日常范围。WW 隐含步骤采用 whole-daily 耦合范围，失败进入原预算；权威父成功且子失败为 partial，整个父子范围禁止重试。框架、启动器完成不代替业务流闭合。
