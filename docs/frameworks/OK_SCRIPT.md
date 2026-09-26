# ok-script / PyAppify 框架

本页维护 OK 两个专项的发行身份、受限运行和源码对照。项目日常范围见 [OkNTE](../projects/OkNTE.md) 与 [OkWutheringWaves](../projects/OkWutheringWaves.md)。公共证据协议见 [TASK_PROTOCOL](../TASK_PROTOCOL.md)。

两个 ok 插件的初始版本为 `0.1.0`。当前属于开发候选：已核查 China 与 Global 的 ok-ww v3.6.7、ok-nte v1.3.19 完整安装包，日常源码及关键内嵌框架文件与源码锁/对应 wheel 完全一致。经用户明确授权的隔离管理员测试验证官方启动器实际转发 `-a true -u manual -t 1/2 -e`，子进程为包内 Python 3.12.10 `pythonw.exe`，工作目录为 `data/apps/<name>/working/`。解释器保护在业务代码前退出，不能算真实日常完成。

PyAppify 的版本身份异常分支会在手动模式下强制更新；实测异环 v1.3.19 安装包首次启动更新到 v1.3.20。已验证组合的高级判定只读核对发行 `app.json`、detached HEAD、独立 tag ref 和 manifest 固定的 working 文件 SHA-256，要求与 China/Global 渠道分别匹配的精确版本、已安装和空闲更新器。运行资格另核对本安装目录的真实解释器进程，不能只信任 `running`。annotated tag object 与 peeled commit 分别固定，不把两者当同一 SHA。

`running=true` 且真实解释器已退出时，不改写原状态字段，转入受限模式；`running=false` 但本实例解释器仍活跃时仍阻止启动。进程查询失败保持 unknown 并阻止写配置；其他安装目录的同名解释器不构成本实例活跃证据。纯 GUI 启动器驻留默认保留，实际脚本、pip 或其他可能写安装目录的解释器仍需退出后恢复。

上游 [PyAppify 52bc6d9](https://github.com/ok-oldking/pyappify/tree/52bc6d986aae93615673960256549f51f13c92b6) 的更新路径通过 GUI 内的 git2 执行 Git，通过嵌入式解释器执行 `-m pip` 和版本探测。此源码对照只界定已知 helper，不把所有同名进程或纯启动器算 writer，也不证明未知未来 helper、瞬时替换或并发更新绝不存在。检查时的完整路径/进程身份与运行期冻结复核共同保护当前边界。

较新的同主版本可在基础边界成立时受限运行：安装元数据必须指向同款同渠道、当前稳定版本在上游可用版本表中、更新器空闲、HEAD 为完整提交 ID，且仓库 origin 精确指向对应官方来源。OkNTE China 额外接受其[官方构建工作流](https://github.com/BnanZ0/ok-nte/blob/main/.github/workflows/build.yml)列出的精确 `https://cnb.cool/BnanZ0/ok-nte-update.git`；Global 不接受该地址，相似域名和路径也不接受。基础配置对象必须可读取；异环还要求 `Routine Items` 为数组。此分流发生在旧工作文件哈希判定前；Host 仅保留生命周期、超时、取消、清理与隔离，使用单一“任务未核验”占位，不调用旧版观察脚本或选择重试。`single_daily` 只在确认为受限模式且唯一任务为该占位时放行。受限 Host 运行仅把发行资源作为身份冻结对象；启动器自行改写的 `running`、`last_start` 不作为发行身份，可写用户配置仍由现有事务恢复。更新中、错误来源、缺失身份、配置形态不符仍不能进入受限路径；China v1.4.2 的真实正常收尾与 Global 新版安装组合仍待验证。

身份准入只覆盖检查时的本地状态，不能消除启动器之后远端 tag 变化或外部更新的竞争。Host 在运行观察和结束阶段复核冻结资源，变化后拒绝后续证据及重试。固定文件校验不验证完整解释器/依赖，也不能证明瞬时替换未发生；完整发行资格仍须执行。`-e` 的框架完成通知不证明业务成功，LauncherTask 完成也不能关闭异环日常范围。

可复现的上游对照工具（所有输出使用仓库外新路径，游戏与 GUI 不会启动）：

```text
python tools/Probe-OkFramework.py --wheel-root <锁定wheel目录> --output <新报告.json>
python tools/Probe-OkNteNormalization.py --source <锁定DailyRoutineTask.py> --output <新报告.json>
python tools/Probe-OkNteBranches.py --source <锁定DailyRoutineTask.py> --output <新报告.json>
```

框架工具直接从 SHA256 校验后的 `ok_script-2.0.4` 和 `2.0.7b1` wheel 执行原 CLI 解析、任务索引选择、队列和执行方法，设备和任务结果由隔离测试端口控制。规范化工具比较原 `normalize_items` 与适配器纯函数，覆盖空列表、重复、互斥、Python 真值及显式选择后的默认补项。分支工具执行日常原方法与原 `_DailyTaskConfig`，验证 False/None、异常、语言跳过、重复入队以及子配置临时切换恢复；进度回调是明确标注的受控输入，不冒称真实战斗或真实 shift 算法。这些工具不导入游戏模块，也不替代实际发行运行验证。


China 与 Global 使用独立的 commit/tag 身份，关键 working 文件逐字节一致。China 隔离官方 EXE 的参数转发测试同样通过；两款启动后的版本和业务入口保持原身份。`fixtures/resources/` 中的共享文件明确标注 synthetic，仅测试真实 Host 的哈希机制，不能用作官方包的来源证据。
