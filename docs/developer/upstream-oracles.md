# 固定上游与业务 oracle

测试预期必须来自已批准的产品行为与明确上游消费者。当前 adapter 的输出不能同时充当被测结果和正确答案。这里保留审查使用的固定输入，不声称这些是今天最新版本，也不要求为了本轮修复升级上游。

## 八个上游锁

| ID | 已审查版本 | 固定源码 SHA | 权威锁 |
|---|---|---|---|
| baah | BAAH2.5.1 | `1f9df2587ff6a6b767e5353a3ce9bb1b8db7c23c` | [upstream.json](../../plugins/specialized/baah/upstream.json) |
| bettergi | 0.66.0 | `0af68c28f6b0e714d5304625ce644736d508022e` | [upstream.json](../../plugins/specialized/bettergi/upstream.json) |
| maaend | v2.35.0 | `00cd200f786f907f2b54276212df2461a7a841ab` | [upstream.json](../../plugins/specialized/maaend/upstream.json) |
| maas | v1.8.0 | `27dfd836e61cb1385cb4dc8ad61e69280d10bb67` | [upstream.json](../../plugins/specialized/maas/upstream.json) |
| march7th | v2026.10.16 | `34c6e4aba914bb8c0cbe1a27e49151cce26f94b4` | [upstream.json](../../plugins/specialized/march7th/upstream.json) |
| oknte | v1.4.21 | `460a7687faa7dc928f7a9c4593d7031e21df493c` | [upstream.json](../../plugins/specialized/oknte/upstream.json) |
| okww | v3.7.12 | `46113e464b823c95d5df988f8eba8b2dd8b45e5e` | [upstream.json](../../plugins/specialized/okww/upstream.json) |
| zzzonedragon | v2.5.6 | `8fe22ef0cf127f596ba6b28047416fb68dacc797` | [upstream.json](../../plugins/specialized/zzzonedragon/upstream.json) |

完整 release、tree、资产及历史验证边界由各锁文件维护；这里是人工检索索引，不另造可用于构建的第二份依赖锁。锁变化时只更新受影响行和语义向量。

## OkNTE：参数必须选中日常消费者

| 证据 | 得出的业务事实 |
|---|---|
| [main resolve](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/408d4e1d57918d471d3a2d3fcdcbd133ac1ebebe/plugins/specialized/OkNTE/data/resolve.json#L13-L18) | 原日常入口包含 `-t 2` |
| [next discovery](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/specialized/oknte/adapter/discovery.js#L3-L9) | 基线改成 `-t 1` |
| [固定上游任务顺序](https://github.com/BnanZ0/ok-nte/blob/460a7687faa7dc928f7a9c4593d7031e21df493c/src/config.py#L195-L198) | 第一项 LauncherTask，第二项 DailyRoutineTask |
| [ok-script 2.0.17 编号转换](https://github.com/ok-oldking/ok-script/blob/2424dc7da0c4a16e716fade8377b69871229c479/ok/__init__.py#L850-L863) | `-t` 为 1-based，执行前减一 |

最小 oracle 应把发现得到的参数交给该已知消费者规则，并断言选择日常。不能只断言 next 仍然返回 `['-t','1','-e']`。OkWW 的固定消费者第一项为日常，不能跟着改成 2。

main 中其余参数的删除是否影响更新策略，不由这个下标结论自动证明；只在任务范围和固定消费者证据明确时修改。

## BAAH：文件名与来源构成同一契约

| 证据 | 得出的业务事实 |
|---|---|
| [main glob](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/408d4e1d57918d471d3a2d3fcdcbd133ac1ebebe/plugins/specialized/BAAH/data/resolve.json#L16-L22) | 使用 `DATA/LOGS/log_*.txt` |
| [next glob](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/specialized/baah/adapter/discovery.js#L32-L38) | 基线声明 `DATA/LOGS/*.log` |
| [固定上游写日志](https://github.com/BlueArchiveArisHelper/BAAH/blob/1f9df2587ff6a6b767e5353a3ce9bb1b8db7c23c/modules/utils/log_utils.py#L40-L49) | 实际生成 `log_<timestamp>.txt` |
| [观察器来源条件](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/specialized/baah/adapter/observation.js#L16-L27) | 只有主声明文件 `file:0` 能建立业务结果 |

正例必须经过发现声明和 Host 文件选择，不能直接向观察器人工塞一个正确 `file:0` 然后认为接线已覆盖。相同文字来自 stdout 或其他文件时不应变为成功。

配置 false→true 建议的证据：[插件提案](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/5f88763ca4f49836b0bead262dad4acfacaebb63/plugins/specialized/baah/adapter/configuration.js#L68-L90)、[Host 对所有 blocking 的拒绝](https://github.com/FlappiBakuse/NexusPipeline/blob/0bb4d144d92805a2d489c65d0be3b7527c7810fd/src/platform/Storage/Extensions/TaskAdapterService.cs#L158-L175)。最小验证通过真实服务 preview/apply，并保留陈旧候选负例。

## 其他插件的 oracle 选择

| 插件 | 最重要的正确答案来源 |
|---|---|
| BetterGI | 选中一条龙配置的身份、顺序和外层日志范围；任意脚本内层不外推 |
| MaaEnd | 明确 `autoStartInstanceId` 与真实实例唯一匹配；夹具须满足前提才测试重复 ID |
| MaaStellaSora | 稳定实例文件身份、实际默认配置来源及原生编辑准备/提交字段 |
| March7th | Launcher/Assistant 职责、YAML 语义、父子任务和上游次数接续 |
| OkWW | 权威日常父范围、partial 禁止重放、4C 次数与原入口续跑边界 |
| ZzzOneDragon | 单一两位实例、现代/旧组来源、体力调用父子回执与原生进度 |

具体规则保留在 `docs/projects`。它们的历史通过数量不作为本轮最低测试数量。

## 证据边界与更新

来源身份核验、Node 向量、生产 Jint、真实 ZIP 安装和上游二进制运行分别记载。第一轮八个组件套件通过不能消除 OkNTE/BAAH 的接线缺陷；当前 source-discovery 在 MaaEnd 前置条件处停止，后续未执行断言不能记作实测失败。

为一个任务只补与之相关的最小上游样例，记录文件、固定版本、业务事实和支持限制。除非任务明确要求新增支持，不自动访问最新 HEAD、不更新八个锁、不添加新格式 fallback。源码事实仍不代表某个发行包内实际捆绑的所有框架版本；真实组合缺证时保留状态。
