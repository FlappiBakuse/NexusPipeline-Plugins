# 上游来源与测试预期

测试预期来自明确需求与固定上游消费者；adapter 输出由独立预期核对。当前支持身份由每个插件 `upstream.json` 维护，构建不依赖本机上游源码目录。

## 上游锁索引

| 插件 | 唯一来源锁 | 业务参考 |
|---|---|---|
| BAAH | [upstream.json](../../plugins/specialized/baah/upstream.json) | [任务、日志与修复](../projects/baah.md) |
| BetterGI | [upstream.json](../../plugins/specialized/bettergi/upstream.json) | [配置组与日志](../projects/bettergi.md) |
| MaaEnd | [upstream.json](../../plugins/specialized/maaend/upstream.json) | [实例与只读资料](../projects/maaend.md) |
| MaaStellaSora | [upstream.json](../../plugins/specialized/maas/upstream.json) | [保存格式与实例](../projects/maas.md) |
| March7th | [upstream.json](../../plugins/specialized/march7th/upstream.json) | [父子任务与次数](../projects/march7th.md) |
| OkNTE | [upstream.json](../../plugins/specialized/oknte/upstream.json) | [日常任务](../projects/oknte.md) |
| OkWW | [upstream.json](../../plugins/specialized/okww/upstream.json) | [日常父项与原入口续跑](../projects/okww.md) |
| ZzzOneDragon | [upstream.json](../../plugins/specialized/zzzonedragon/upstream.json) | [实例、应用组与体力](../projects/zzzonedragon.md) |

锁包含 release/tag/commit/tree 和资产事实；它记录已声明支持范围。核对最新官方稳定发行时使用官方 Release API，排除 draft/prerelease，再解析完整源码 SHA；单独的 tag 名不提供发行状态。

## OkNTE 日常入口

固定 v1.5.12 的 [config.py](https://github.com/BnanZ0/ok-nte/blob/adf9f82f5c55c83eea706af73cf6b01efe0ea9a5/src/config.py) 注册 DailyRoutineTask。当前安装使用 ok-script 3.0.13，运行入口按类名解析 `-t`。 [OkNTE 发现入口](../../plugins/specialized/oknte/adapter/discovery.js)

OkWW 使用自身任务类 DailyTask。两个入口均核对安装版本、唯一发行渠道及实际工作目录源码。组件测试固定类名、手动更新参数、缺少配置资源和源码不一致时的拒绝。 [OkWW 发现入口](../../plugins/specialized/okww/adapter/discovery.js)

## BAAH 文件名与来源

固定 BAAH2.5.15 的 [log_utils.py](https://github.com/BlueArchiveArisHelper/BAAH/blob/90bc43f7586c55f2dff3988fc1b05cad84f46567/modules/utils/log_utils.py)写入 `log_<timestamp>.txt`。本插件[发现入口](../../plugins/specialized/baah/adapter/discovery.js)声明 `DATA/LOGS/log_*.txt`，[观察器](../../plugins/specialized/baah/adapter/observation.js)只接受主文件 `file:0`。

有效场景经过发现、Host 文件选择和实际观察；相同正文来自 stdout 或其他文件时保持未核实。`SAVE_LOG_TO_FILE=false` 的精确修复同时核对原候选、CAS 与权限，规则见[专项指南](../authors/specialized-adapters.md#baah-修复闭环)。

## 更新与证据范围

每次改变上游映射记录固定文件、版本、业务事实和限制，更新受影响项目页与语义向量。上游源码核验、Node、生产 Jint、真实 ZIP 安装、真实发行程序运行分别保留结果与源码身份。

MaaEnd 的额外 pretask 形态夹具与当前锁定发行单独标识；框架解析能力不自动提升为新发行整体支持。
