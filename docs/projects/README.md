# 项目适配索引与历史资格

| 项目 | 当前适配规则 |
|---|---|
| BetterGI | [BetterGI](BetterGI.md) |
| March7thAssistant | [March7thAssistant](March7thAssistant.md) |
| ZenlessZoneZeroOneDragon | [ZenlessZoneZeroOneDragon](ZenlessZoneZeroOneDragon.md) |
| BAAH | [BAAH](BAAH.md) |
| MaaEnd | [MaaEnd](MaaEnd.md) |
| MaaStellaSora | [MaaStellaSora](MaaStellaSora.md) |
| OkNTE | [OkNTE](OkNTE.md) |
| OkWutheringWaves | [OkWutheringWaves](OkWutheringWaves.md) |

## 历史发行发现与实际样本

以下记录对应 2026-09-25 的发现和当时实际样本，不宣称是当前最新版本或补充开发通过结果。

发行页只证明版本存在；源码锁、安装包入口和真实业务支持须分别核验。下列发现不自动扩大本仓库适配器的高级能力。

| 产品 | 最新稳定发行发现 | 本轮可报告范围 |
|---|---|---|
| BetterGI | [0.65.0](https://github.com/babalae/better-genshin-impact/releases/tag/0.65.0) | 单配置真实运行结束，3 项未核验；真实手动取消完成且保留游戏，重复领奖/资源边界尚未逐项确认 |
| March7thAssistant | [v2026.9.25](https://github.com/moesnow/March7thAssistant/releases/tag/v2026.9.25) | 高权限单配置真实运行：1 项确认成功、2 项未核验；静默活动和新发行全部分支尚未确认 |
| ZenlessZoneZeroOneDragon | [v2.5.2](https://github.com/OneDragon-Anything/ZenlessZoneZero-OneDragon/releases/tag/v2.5.2) | 单配置真实运行 5 项确认成功；多账号和应用组顺序的全部变体仍待运行 |
| MaaEnd / MXU | [v2.29.0](https://github.com/MaaEnd/MaaEnd/releases/tag/v2.29.0) / [v2.6.1](https://github.com/MistEO/MXU/releases/tag/v2.6.1) | 明确实例后在高权限 Host 中真实启动游戏并自行退出，3 项确认成功、2 项未核验；超时变体未运行 |
| MaaStellaSora / MXU | [v1.4.4](https://github.com/MaaStellaSora/MaaStellaSora/releases/tag/v1.4.4) / [v2.6.1](https://github.com/MistEO/MXU/releases/tag/v2.6.1) | 本机接口仅由 import 提供任务定义，适配器已兼容并真实启动游戏；3 项未核验，多语言与资源组合未遍历 |
| BAAH | [BAAH2.4.13](https://github.com/BlueArchiveArisHelper/BAAH/releases/tag/BAAH2.4.13) | PC 客户端单配置真实运行结束，3 项未核验；ADB 和静默领取确认仍待验证 |
| OkNTE | [v1.4.0](https://github.com/BnanZ0/ok-nte/releases/tag/v1.4.0) | 本机 China 启动器自行更新到 v1.4.2；精确官方 CNB 来源与受限计划已通过合成及实际准入。两次完整真实执行均因上游运行元数据/配置写入被旧冻结规则误报，最终修正通过 Host 单测但第三次实测依用户要求取消；主游戏退出后启动器进程仍存活，不能报告受限运行完成。Global 未运行，高级判定仍锁定旧组合 |
| OkWutheringWaves | [v3.6.7](https://github.com/ok-oldking/ok-wuthering-waves/releases/tag/v3.6.7) | 现有固定高级组合；受限路径仍按身份与状态检查，真实游戏未运行 |
