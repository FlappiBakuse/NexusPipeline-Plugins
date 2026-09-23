# 三月七签到日志桥原型

默认关闭，仅在显式创建的隔离源码会话启用。此目录不进入 data-specialized ZIP，不安装到真实软件，不启动游戏、服务或网络监听。当前支持边界为 **源码原型可验证；官方 v2026.9.7 旁置文件接入不支持**；生产适配器继续使用原生日志，其静默路径仍按现有检测能力处理。

## 来源与实际执行边界

上游 `moesnow/March7thAssistant` 固定提交 `7423dea64552f71332cc71f3c02481695aaec151`。`source_patch.py` 对 `tasks/activity/activitytemplate.py`、`checkInactivity.py` 校验 [源码锁](../task-protocol/source-lock.json) 的 SHA256，生成 [upstream.patch](upstream.patch)。上游许可证为 [GNU GPL v3](UPSTREAM-LICENSE)。此 patch 包含上游上下文；分发修改版时保留对应源码及许可证。

钩子只记录现有分支：原有 prepare 点击成功并等待后设置就绪标记；原有领奖循环成功迭代后增加观测计数。三个命名签到活动各自生成独立 taskKey。实际领取分支须同时有入口就绪和领奖循环证据；入口就绪且原 `_has_reward()` 返回假为正常空奖励成功；入口未就绪或没有领取迭代为 unknown。原函数的 True 不是成功判据。无额外识别、点击或领取动作。

`probe.py` 编译并执行校验过的原类方法体及其最小钩子版本；导入、模块初始化与真实自动化依赖不执行。控制依赖决定识别结果，原类实际执行分支。逐例比较原版与钩子版的点击、查询、等待、日志和返回值。事件产自钩子调用，不由探针根据最终返回值伪造。

## 重现

准备上述提交的只读源码，路径通过参数传递。输出必须是不存在的新目录；工具不会覆盖已有报告。

```text
python -X utf8 tools/march7th-bridge/probe.py --source-root <锁定上游源码> --output <新的外部目录>
dotnet run --project <Host>/tools/NexusPipeline.TaskProtocolTests -- --plugin-root <本仓库> --bridge-replay <新的外部目录>/replay.json
python -X utf8 -m unittest discover -s tools/tests -v
```

生产探针输出原始 JSONL、实际分支/动作/hash 清单、最小 patch 和消费者故障用例。消费者通过真实 TaskLogBuffer 处理半行、EOF、epoch 和 source，再进入受限 Jint/归并器；不允许任意文件、网络或进程访问。测试用 frozen binding/run/attempt/nonce 由驱动创建，payload 无权指定另一个用户绑定。nonce 只做隔离，不证明业务成功。

`nxp_bridge.session(path, enabled=True, run_id=..., attempt_id=..., binding_id=..., nonce=..., upstream_commit=...)` 是隔离驱动的唯一显式启用入口。不传 enabled 不创建文件；退出恢复默认关闭。文件使用排他创建，写入失败不改上游控制流程，也不会补 success。上游异常保留异常并尽可能写 gap。取消测试不再执行游戏动作，消费者按取消结束。

消费者在终止前暂存分支事实，完整检查流后才提交该任务结果；session.ended 本身不推导成功。相同事件幂等，缺序列、重连/截断、冲突重复、版本不符、越界任务和缺失生命周期保留 unknown/诊断。原生命名领取与桥结果一致时合并证据，只计一次；与空奖励/未知冲突时保持 unknown。未出现的另外两个签到活动不会被标成功。

## Windows 发行形态限制

锁定版本的 `March7th Assistant.spec` 从 main.py 生成 PyInstaller PYZ，`runtime_hooks=[]`；官方 `1.build_release.yml` 使用 `uv sync --group build`、`uv run python build.py --task ocr`，再运行 Assistant/Launcher/Updater 三个 spec 并合并产物。参考原件及 hash 见 [packaging-sources.json](packaging-sources.json)。这些构建入口没有装配本原型的钩子；把 Python 文件放到安装目录不能宣称已修改归档内的业务分支。

已在官方 v2026.9.7 完整包的隔离副本上执行未修改 EXE 的 `--help`：管理员进程退出 0、原生帮助完整输出，安装根和 libraries 下的 sitecustomize/usercustomize/nxp_bridge，以及 utils 包旁置标记均未加载。EXE 字节保持不变；打包归档包含活动模块，启动脚本表没有本桥。这证明所测试旁置接入方式不可用，不证明所有可能的扩展机制均不存在。未构建/安装修改版 Assistant，不能标为官方包业务桥支持。要运行修改版须在另一份锁定源码中审查并应用 patch，提供 nxp_bridge 模块和显式会话驱动，再依照上游完整构建要求构建；现有用户安装不在本工具操作范围内。当前可运行验证入口只需 Python 标准库及 Host 联调工具，不依赖上游游戏环境。进一步产品装配和官方发行验证仍是单独工作。

官方实验来源为 [v2026.9.7](https://github.com/moesnow/March7thAssistant/releases/tag/v2026.9.7)，完整 ZIP 大小 788029060 字节、SHA-256 `b5a3eff7d393dbd908529c7095268c1e7023e14fe151d5def57e4c11d03f7048`，包内 Assistant EXE SHA-256 `3f3ef51c786be58ad57ec74c7fa309da5fdc80fc0feeda4a5c8d852d628e7a7b`。其 Python 为 3.14，PE 清单 requireAdministrator；测试需针对隔离副本的显式 UAC 授权。先静态确认帮助解析位于配置/遥测/任务导入之前，才运行 `--help`；不得为了探测钩子直接运行默认任务。源码原型锁定提交与该正式发行版本分别记录，不混作同一候选。
